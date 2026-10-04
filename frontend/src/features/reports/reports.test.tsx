import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/reporting", () => ({
  getHoursReport: vi.fn(),
  getRequestsReport: vi.fn(),
  downloadReportCsv: vi.fn(),
}));
vi.mock("../../api/employees", () => ({
  listEmployees: vi.fn().mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        id: "e1",
        email: "emp@example.com",
        employee_code: "E001",
        display_name: "Emma Employee",
        is_active: true,
        roles: ["Employee"],
        department: null,
        department_name: null,
        manager: null,
        manager_name: null,
        phone: "",
        job_title: "",
        version: 1,
      },
    ],
  }),
}));
vi.mock("../auth/auth-context", () => ({ useAuth: () => AUTH }));

import { getHoursReport, getRequestsReport } from "../../api/reporting";
import { ReportsPage } from "./ReportsPage";

let AUTH = { user: { roles: ["Manager"] } };

const HOURS_PAGE = {
  count: 1,
  next: null,
  previous: null,
  totals: { minutes: 240 },
  meta: {
    period: { from: "2026-09-14", to: "2026-09-20" },
    timezone: "Africa/Cairo",
    grouping: "day",
  },
  results: [
    {
      work_date: "2026-09-15",
      employee_id: "e1",
      employee_code: "E001",
      employee_name: "Emma Employee",
      department: "Engineering",
      minutes: 240,
    },
  ],
};

const REQUESTS_PAGE = {
  count: 1,
  next: null,
  previous: null,
  totals: { count: 1 },
  meta: {
    period: { from: "2026-09-01", to: "2026-10-02" },
    timezone: "Africa/Cairo",
    grouping: "none",
    date_basis: "submitted_at",
  },
  results: [
    {
      id: "r1",
      title: "New laptop",
      type: "Equipment",
      category: "equipment",
      status: "approved",
      submitted_at: "2026-10-01T10:00:00Z",
      employee_id: "e1",
      employee_code: "E001",
      employee_name: "Emma Employee",
      department: "Engineering",
    },
  ],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AUTH = { user: { roles: ["Manager"] } };
    vi.mocked(getHoursReport).mockResolvedValue(HOURS_PAGE);
    vi.mocked(getRequestsReport).mockResolvedValue(REQUESTS_PAGE);
  });

  it("renders the working-hours report with totals", async () => {
    renderPage();
    expect(await screen.findByText("Emma Employee")).toBeInTheDocument();
    expect(screen.getAllByText("4h 00m").length).toBeGreaterThan(0);
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("switches to the requests report tab", async () => {
    renderPage();
    await screen.findByText("Emma Employee");
    await userEvent.click(
      screen.getByRole("tab", { name: "Requests" }),
    );
    expect(await screen.findByText("New laptop")).toBeInTheDocument();
    await waitFor(() => expect(getRequestsReport).toHaveBeenCalled());
  });

  it("hides the CSV export button for plain employees", async () => {
    AUTH = { user: { roles: ["Employee"] } };
    renderPage();
    await screen.findByText("Emma Employee");
    expect(
      screen.queryByRole("button", { name: /export csv/i }),
    ).not.toBeInTheDocument();
  });

  it("triggers the CSV download for managers", async () => {
    const { downloadReportCsv } = await import("../../api/reporting");
    renderPage();
    await screen.findByText("Emma Employee");
    await userEvent.click(
      screen.getByRole("button", { name: /export csv/i }),
    );
    await waitFor(() =>
      expect(vi.mocked(downloadReportCsv)).toHaveBeenCalledWith(
        "working-hours",
        expect.objectContaining({ page: 1 }),
      ),
    );
  });
});
