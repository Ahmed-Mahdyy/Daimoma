import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/timesheets", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../api/timesheets")>();
  return {
    ...mod,
    listTimesheets: vi.fn(),
    getTimesheet: vi.fn(),
    getTimesheetHistory: vi.fn(),
    getOrCreateTimesheet: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    voidEntry: vi.fn(),
    submitDay: vi.fn(),
    submitTimesheet: vi.fn(),
    approveTimesheet: vi.fn(),
    rejectTimesheet: vi.fn(),
    returnTimesheet: vi.fn(),
    reopenTimesheet: vi.fn(),
  };
});

const AUTH = {
  user: {
    id: "u-emp",
    email: "emp@acme.test",
    roles: [] as string[],
    display_name: "Emmie",
  },
  isLoading: false,
  isAuthenticated: true,
};
vi.mock("../auth/auth-context", () => ({ useAuth: () => AUTH }));

import {
  approveTimesheet,
  getTimesheet,
  getTimesheetHistory,
  listTimesheets,
  submitDay,
  submitTimesheet,
  voidEntry,
} from "../../api/timesheets";
import { TimesheetDetailPage } from "./TimesheetDetailPage";
import { TimesheetsPage } from "./TimesheetsPage";

const ENTRY = {
  id: "e1",
  work_date: "2026-09-14",
  start_at: "2026-09-14T07:00:00Z",
  end_at: "2026-09-14T15:00:00Z",
  break_minutes: 30,
  duration_minutes: 450,
  description: "Dev work",
  window_flag: false,
  window_reason: "",
  voided_at: null,
};

function sheet(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    employee: "p1",
    employee_name: "Emmie",
    employee_email: "emp@acme.test",
    employee_code: "E1",
    period_start: "2026-09-14",
    period_end: "2026-09-20",
    timezone: "UTC",
    status: "collecting",
    current_reviewer: null,
    reviewer_name: null,
    reviewer_email: null,
    cycle: 1,
    version: 3,
    submitted_at: null,
    total_minutes: 450,
    days: [
      {
        id: "d1",
        work_date: "2026-09-14",
        status: "draft",
        submitted_at: null,
        version: 1,
        total_minutes: 450,
        entries: [ENTRY],
      },
    ],
    created_at: "2026-09-14T00:00:00Z",
    updated_at: "2026-09-14T00:00:00Z",
    ...over,
  };
}

function renderDetail() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/timesheets/s1"]}>
        <Routes>
          <Route path="/timesheets/:id" element={<TimesheetDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TimesheetsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the scoped list", async () => {
    vi.mocked(listTimesheets).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [sheet({ days: [] }) as never],
    });
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TimesheetsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("2026-09-14 – 2026-09-20")).toBeInTheDocument(),
    );
    expect(screen.getByText("7h 30m")).toBeInTheDocument();
    const cell = screen
      .getByText("2026-09-14 – 2026-09-20")
      .closest("tr")!;
    expect(cell.textContent).toContain("Collecting");
  });

  it("searches timesheets through the scoped API", async () => {
    vi.mocked(listTimesheets).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [sheet({ days: [] }) as never],
    });
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TimesheetsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("2026-09-14 – 2026-09-20")).toBeInTheDocument(),
    );

    await userEvent.type(
      screen.getByRole("textbox", { name: "Search timesheets" }),
      "em{enter}",
    );
    await waitFor(() =>
      expect(listTimesheets).toHaveBeenCalledWith(
        expect.objectContaining({ search: "em" }),
      ),
    );
  });
});

describe("TimesheetDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTimesheetHistory).mockResolvedValue([]);
  });

  it("shows the week grid, entries, and owner actions", async () => {
    vi.mocked(getTimesheet).mockResolvedValue(sheet() as never);
    renderDetail();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Week 2026-09-14 – 2026-09-20" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("07:00–15:00")).toBeInTheDocument();
    expect(screen.getAllByText("Submit day").length).toBe(1);
    expect(screen.getByText("Submit week")).toBeInTheDocument();
    expect(screen.getAllByText("Add entry").length).toBe(7);
  });

  it("submits a day via the API", async () => {
    vi.mocked(getTimesheet).mockResolvedValue(sheet() as never);
    vi.mocked(submitDay).mockResolvedValue(sheet() as never);
    renderDetail();
    await waitFor(() => screen.getByText("Submit day"));
    await userEvent.click(screen.getByText("Submit day"));
    await waitFor(() =>
      expect(submitDay).toHaveBeenCalledWith("s1", "2026-09-14"),
    );
  });

  it("submits the week with a confirmation", async () => {
    vi.mocked(getTimesheet).mockResolvedValue(sheet() as never);
    vi.mocked(submitTimesheet).mockResolvedValue(sheet() as never);
    renderDetail();
    await waitFor(() => screen.getByText("Submit week"));
    await userEvent.click(screen.getByText("Submit week"));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Submit" }).find(
        (b) => dialog.contains(b),
      )!,
    );
    await waitFor(() =>
      expect(submitTimesheet).toHaveBeenCalledWith("s1", 3),
    );
  });

  it("voids an entry after confirmation", async () => {
    vi.mocked(getTimesheet).mockResolvedValue(sheet() as never);
    vi.mocked(voidEntry).mockResolvedValue(undefined as never);
    renderDetail();
    await waitFor(() => screen.getByText("Void"));
    await userEvent.click(screen.getByText("Void"));
    const voidDialog = await screen.findByRole("dialog");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Void" }).find(
        (b) => voidDialog.contains(b),
      )!,
    );
    await waitFor(() => expect(voidEntry).toHaveBeenCalledWith("s1", "e1"));
  });

  it("shows reviewer actions only to the current reviewer", async () => {
    vi.mocked(getTimesheet).mockResolvedValue(
      sheet({
        status: "pending_manager",
        current_reviewer: "someone-else",
        reviewer_name: "Boss",
        reviewer_email: "boss@acme.test",
      }) as never,
    );
    renderDetail();
    await waitFor(() => screen.getByText("Pending manager"));
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit week")).not.toBeInTheDocument();
  });

  it("lets the assigned reviewer approve", async () => {
    vi.mocked(getTimesheet).mockResolvedValue(
      sheet({
        status: "pending_manager",
        current_reviewer: "rev-1",
        reviewer_name: "Me",
        reviewer_email: "emp@acme.test",
      }) as never,
    );
    vi.mocked(approveTimesheet).mockResolvedValue(sheet() as never);
    renderDetail();
    await waitFor(() => screen.getByText("Approve"));
    await userEvent.click(screen.getByText("Approve"));
    const approveDialog = await screen.findByRole("dialog");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Approve" }).find(
        (b) => approveDialog.contains(b),
      )!,
    );
    await waitFor(() =>
      expect(approveTimesheet).toHaveBeenCalledWith("s1", 3),
    );
  });
});
