import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../api/notifications", () => ({
  getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
  listNotifications: vi.fn().mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    unread_count: 0,
    results: [],
  }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  resolveNotificationTarget: vi.fn(),
}));

import { useAuth } from "../features/auth/auth-context";
import { AppLayout } from "./AppLayout";
import { LanguageProvider } from "./LanguageProvider";
import { ThemeProvider } from "./ThemeProvider";

function renderLayout(roles: string[]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { email: "u@x.test", roles, display_name: "U" } as never,
    isLoading: false,
    isAuthenticated: true,
    refresh: vi.fn(),
    signOut: vi.fn(),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
      <LanguageProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<p>home</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
      </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("AppLayout role-aware navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows only base links for a plain employee", () => {
    renderLayout([]);
    // The directory is manager/HR-only in nav (the API still self-scopes).
    expect(
      screen.queryByRole("link", { name: "Employees" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Departments" }),
    ).not.toBeInTheDocument();
  });

  it("shows Audit + Employees for a manager but not Departments", () => {
    renderLayout(["Manager"]);
    expect(screen.getByRole("link", { name: "Audit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Employees" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Departments" }),
    ).not.toBeInTheDocument();
  });

  it("shows Settings submenu with Audit + Request types for HR", () => {
    renderLayout(["HR"]);
    expect(screen.getByRole("link", { name: "Audit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Departments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request types" }),
    ).toHaveAttribute("href", "/requests/types");
    expect(screen.getByRole("link", { name: "Add employee" })).toHaveAttribute("href", "/employees/new");
  });

  it("persists a light/dark preference", () => {
    renderLayout([]);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("daimoma-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("switches the shell to Arabic + RTL and persists the choice", () => {
    renderLayout([]);
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Arabic" }),
    );
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(localStorage.getItem("daimoma-lang")).toBe("ar");
    expect(screen.getByRole("link", { name: "الطلبات" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "التبديل إلى الإنجليزية" }),
    );
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(screen.getByRole("link", { name: "Requests" })).toBeInTheDocument();
  });
});
