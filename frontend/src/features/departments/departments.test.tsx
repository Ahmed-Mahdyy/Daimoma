import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/employees", () => ({ managerChoices: vi.fn().mockResolvedValue({ results: [], count: 0 }), listEmployees: vi.fn() }));

vi.mock("../../api/departments", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../api/departments")>();
  return {
    ...mod,
    listDepartments: vi.fn(),
    getDepartment: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
  };
});

import { getDepartment, listDepartments, updateDepartment } from "../../api/departments";
import { listEmployees, managerChoices } from "../../api/employees";
import { DepartmentsPage } from "./DepartmentsPage";
import { DepartmentDetailPage } from "./DepartmentDetailPage";

const ROWS = [
  { id: "d-2", name: "Bravo", manager: null, manager_name: null, is_active: true, created_at: "2026-01-02T00:00:00Z" },
  { id: "d-1", name: "Alpha", manager: null, manager_name: null, is_active: false, created_at: "2026-01-01T00:00:00Z" },
  { id: "d-3", name: "Charlie", manager: null, manager_name: null, is_active: true, created_at: "2026-01-03T00:00:00Z" },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DepartmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rowNames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0]?.textContent);

describe("DepartmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDepartments).mockResolvedValue({
      count: ROWS.length,
      results: ROWS,
    });
  });

  it("lists departments in a sortable table", async () => {
    renderPage();
    expect(await screen.findByRole("table")).toBeInTheDocument();
    // Default sort: newest first so freshly added rows surface on page 1.
    expect(rowNames()).toEqual(["Charlie", "Bravo", "Alpha"]);

    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);

    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(rowNames()).toEqual(["Charlie", "Bravo", "Alpha"]);
  });

  it("paginates long lists client-side", async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `d-${i}`,
      name: `Dept ${String(i).padStart(2, "0")}`,
      manager: null,
      manager_name: null,
      is_active: true,
      created_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    }));
    vi.mocked(listDepartments).mockResolvedValue({
      count: many.length,
      results: many,
    });
    renderPage();
    await screen.findByRole("table");
    expect(screen.getAllByRole("row")).toHaveLength(11); // header + 10 rows
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("keeps row actions and links per department", async () => {
    renderPage();
    const bravo = (await screen.findAllByRole("row")).find((r) =>
      r.textContent?.includes("Bravo"),
    )!;
    expect(within(bravo).getByRole("link", { name: "Bravo" })).toHaveAttribute(
      "href",
      "/departments/d-2",
    );
    const edit = within(bravo).getByRole("link", { name: "Edit" });
    expect(edit).toHaveAttribute("href", "/departments/d-2?edit=true");
    expect(edit).toHaveAttribute("data-variant", "outline");
    expect(
      within(bravo).getByRole("button", { name: "Deactivate" }),
    ).toHaveAttribute("data-variant", "destructive");
  });

  it("searches departments through the scoped API", async () => {
    vi.mocked(listDepartments).mockImplementation(async (filters = {}) => ({
      count: ROWS.length,
      results: ROWS.filter((r) =>
        !filters.search || r.name.toLowerCase().includes(filters.search.toLowerCase()),
      ),
    }));
    renderPage();
    await screen.findByRole("table");

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search departments" }),
      "bravo{enter}",
    );
    await waitFor(() =>
      expect(listDepartments).toHaveBeenCalledWith({ search: "bravo" }),
    );
    expect(rowNames()).toEqual(["Bravo"]);

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() =>
      expect(listDepartments).toHaveBeenLastCalledWith({ search: "" }),
    );
    expect(rowNames()).toHaveLength(3);
  });

  it("shows department statistics and edits its manager without editing reporting lines", async () => {
    vi.mocked(getDepartment).mockResolvedValue({ ...ROWS[0], manager: "m-1", manager_name: "Taylor" });
    vi.mocked(listEmployees).mockResolvedValue({ count: 1, next: null, previous: null, results: [{
      id: "m-1", display_name: "Taylor", email: "t@example.test", employee_code: "M1", job_title: "Lead",
      department: "d-2", department_name: "Bravo", manager: null, manager_name: null,
      is_active: true, roles: ["Manager"], phone: "", photo_url: "", version: 1,
    }] });
    vi.mocked(managerChoices).mockResolvedValue({ count: 1, results: [{ id: "m-1", user_id: "u-1", display_name: "Taylor", employee_code: "M1", roles: ["Manager"] }] });
    vi.mocked(updateDepartment).mockResolvedValue({ ...ROWS[0], name: "Operations", manager: null, manager_name: null });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={["/departments/d-2?edit=true"]}>
      <Routes><Route path="/departments/:id" element={<DepartmentDetailPage />} /></Routes>
    </MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Employees count")).toBeInTheDocument();
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Taylor" })[0]).toHaveAttribute("href", "/employees/m-1");
    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Operations");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Manager" }), "");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateDepartment).toHaveBeenCalledWith("d-2", { name: "Operations", manager: null });
  });
});
