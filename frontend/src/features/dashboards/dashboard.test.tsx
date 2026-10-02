import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/reporting", () => ({
  getDashboard: vi.fn(),
}));
vi.mock("../auth/auth-context", () => ({ useAuth: () => AUTH }));

import { getDashboard, type Dashboard } from "../../api/reporting";
import { DashboardPage } from "./DashboardPage";

let AUTH = { user: { roles: ["Employee"] } };

const DASH: Dashboard = {
  scope: "personal",
  period: { from: "2026-09-28", to: "2026-10-04", timezone: "Africa/Cairo" },
  requests: { by_status: { draft: 1, approved: 2, pending_manager: 0 } },
  timesheets: {
    by_status: { collecting: 0, approved: 1, pending_manager: 1 },
  },
  approved_minutes: 480,
  pending_review: 3,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AUTH = { user: { roles: ["Employee"] } };
    vi.mocked(getDashboard).mockResolvedValue(DASH);
  });

  it("shows only the personal dashboard for a plain employee", async () => {
    renderPage();
    expect(await screen.findByText("My dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Team dashboard")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Organization dashboard"),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("8h 00m")).toBeInTheDocument(); // 480 min
    expect(within(screen.getByRole("region", { name: "Personal overview" })).getByText("3")).toBeInTheDocument(); // pending_review
    expect(screen.getByRole("link", { name: "Open timesheet" })).toHaveAttribute("href", expect.stringMatching(/^\/timesheets\?date=\d{4}-\d{2}-\d{2}$/));
  });

  it("adds the team dashboard for a manager", async () => {
    AUTH = { user: { roles: ["Manager"] } };
    renderPage();
    expect(await screen.findByText("Team dashboard")).toBeInTheDocument();
    expect(
      screen.queryByText("Organization dashboard"),
    ).not.toBeInTheDocument();
  });

  it("adds team and organization dashboards for HR", async () => {
    AUTH = { user: { roles: ["HR"] } };
    renderPage();
    expect(await screen.findByText("Team dashboard")).toBeInTheDocument();
    expect(
      await screen.findByText("Organization dashboard"),
    ).toBeInTheDocument();
  });

  it("shows the error state when the endpoint fails", async () => {
    vi.mocked(getDashboard).mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
