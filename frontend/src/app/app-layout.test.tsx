import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../api/notifications", () => ({
  listNotifications: vi.fn().mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    unread_count: 0,
    results: [],
  }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import { useAuth } from "../features/auth/auth-context";
import { AppLayout } from "./AppLayout";

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
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<p>home</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppLayout role-aware navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows only base links for a plain employee", () => {
    renderLayout([]);
    expect(screen.getByRole("link", { name: "Employees" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Departments" }),
    ).not.toBeInTheDocument();
  });

  it("shows Audit for a manager but not Departments", () => {
    renderLayout(["Manager"]);
    expect(screen.getByRole("link", { name: "Audit" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Departments" }),
    ).not.toBeInTheDocument();
  });

  it("shows Audit and Departments for HR", () => {
    renderLayout(["HR"]);
    expect(screen.getByRole("link", { name: "Audit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Departments" })).toBeInTheDocument();
  });
});
