import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/departments", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../api/departments")>();
  return {
    ...mod,
    listDepartments: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
  };
});

import { listDepartments } from "../../api/departments";
import { DepartmentsPage } from "./DepartmentsPage";

const ROWS = [
  { id: "d-2", name: "Bravo", is_active: true, created_at: "2026-01-02T00:00:00Z" },
  { id: "d-1", name: "Alpha", is_active: false, created_at: "2026-01-01T00:00:00Z" },
  { id: "d-3", name: "Charlie", is_active: true, created_at: "2026-01-03T00:00:00Z" },
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
    expect(
      within(bravo).getByRole("button", { name: "Rename" }),
    ).toBeInTheDocument();
    expect(
      within(bravo).getByRole("button", { name: "Deactivate" }),
    ).toBeInTheDocument();
  });
});
