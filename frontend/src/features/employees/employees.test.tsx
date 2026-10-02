import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/employees", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../api/employees")>();
  return { ...mod, listEmployees: vi.fn(), managerChoices: vi.fn() };
});
vi.mock("../../api/departments", () => ({
  listDepartments: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
}));
vi.mock("../auth/auth-context", () => ({
  useAuth: () => ({
    user: { email: "hr@x.test", roles: ["HR"], display_name: "HR" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

import { listEmployees } from "../../api/employees";
import { EmployeesPage } from "./EmployeesPage";

const EMPLOYEE = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "ada@acme.test",
  is_active: true,
  roles: ["Manager"],
  employee_code: "E100",
  display_name: "Ada",
  phone: "",
  job_title: "Lead",
  preferred_locale: "en",
  department: null,
  department_name: null,
  manager: null,
  manager_name: null,
  photo_url: "",
  version: 1,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EmployeesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders directory rows and filter controls", async () => {
    vi.mocked(listEmployees).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [EMPLOYEE],
    });
    renderPage();
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByLabelText(/search employees/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by role/i)).toBeInTheDocument();
    // Column headers drive server-side ordering via ?ordering=.
    expect(
      screen.getByRole("button", { name: "Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /new employee/i }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", async () => {
    vi.mocked(listEmployees).mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    renderPage();
    expect(
      await screen.findByText(/no employees match/i),
    ).toBeInTheDocument();
  });

  it("shows an accessible error when the request fails", async () => {
    vi.mocked(listEmployees).mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("boom"),
    );
  });
});
