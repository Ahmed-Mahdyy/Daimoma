import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/reporting", () => ({
  getDashboard: vi.fn(),
}));
vi.mock("../auth/auth-context", () => ({
  useAuth: () => AUTH,
  useOptionalAuth: () => AUTH.user,
}));

import { getDashboard, type Dashboard } from "../../api/reporting";
import { LanguageProvider } from "../../app/LanguageProvider";
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
      <LanguageProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
    expect(screen.queryByRole("tab", { name: "Team dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pending review items")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan your day")).not.toBeInTheDocument();
  });

  it("separates the manager's work from team oversight", async () => {
    const interaction = userEvent.setup();
    AUTH = { user: { roles: ["Manager"] } };
    renderPage();
    expect(await screen.findByRole("tab", { name: "Team dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Organization dashboard" })).not.toBeInTheDocument();
    expect(await screen.findByText("Pending review items")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Personal overview" })).getByText("3")).toBeInTheDocument(); // pending_review
    expect(getDashboard).toHaveBeenCalledWith("personal");
    expect(getDashboard).not.toHaveBeenCalledWith("team");
    await interaction.click(screen.getByRole("tab", { name: "Team dashboard" }));
    expect(await screen.findByRole("region", { name: "Team dashboard" })).toBeVisible();
    expect(getDashboard).toHaveBeenCalledWith("team");
    expect(screen.queryByRole("region", { name: "Personal overview" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pending review items")).not.toBeInTheDocument();
  });

  it("offers HR separate team and organization views", async () => {
    const interaction = userEvent.setup();
    AUTH = { user: { roles: ["HR"] } };
    renderPage();
    expect(await screen.findByRole("tab", { name: "Team dashboard" })).toBeInTheDocument();
    await interaction.click(screen.getByRole("tab", { name: "Organization dashboard" }));
    expect(await screen.findByRole("region", { name: "Organization dashboard" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Personal overview" })).not.toBeInTheDocument();
  });

  it("localizes the role-aware views in Arabic", async () => {
    localStorage.setItem("daimoma-lang", "ar");
    AUTH = { user: { roles: ["Manager"] } };
    const interaction = userEvent.setup();
    renderPage();
    const tablist = await screen.findByRole("tablist", { name: "عروض لوحة التحكم" });
    expect(tablist).toBeInTheDocument();
    // The Tabs subtree must inherit RTL — Radix defaults to dir="ltr".
    expect(tablist.closest("[data-slot='tabs']")).toHaveAttribute("dir", "rtl");
    expect(await screen.findByText("عناصر بانتظار المراجعة")).toBeInTheDocument();
    await interaction.click(screen.getByRole("tab", { name: "لوحة الفريق" }));
    expect(await screen.findByRole("region", { name: "لوحة الفريق" })).toBeVisible();
  });

  it("shows the error state when the endpoint fails", async () => {
    vi.mocked(getDashboard).mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
