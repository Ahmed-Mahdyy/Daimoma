import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/notifications", () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  resolveNotificationTarget: vi.fn(),
}));

import {
  listNotifications,
  markNotificationRead,
  resolveNotificationTarget,
} from "../../api/notifications";
import { ApiError } from "../../api/client";
import { NotificationsPage } from "./NotificationsPage";

const NOTIF = {
  id: "n1",
  event_key: "req:1",
  kind: "request_decision",
  summary: "Your request was approved.",
  target_type: "employee_requests.employeerequest",
  target_id: "r1",
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/notifications"]}>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/requests/:id" element={<p>request detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listNotifications).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      unread_count: 1,
      results: [NOTIF],
    });
  });

  it("lists notifications and marks one read", async () => {
    vi.mocked(markNotificationRead).mockResolvedValue({
      ...NOTIF,
      is_read: true,
    });
    renderPage();
    expect(
      await screen.findByText(/request was approved/i),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /mark read/i }),
    );
    await waitFor(() =>
      expect(vi.mocked(markNotificationRead).mock.calls[0]?.[0]).toBe("n1"),
    );
  });

  it("follows the target via the server-side resolver and navigates", async () => {
    vi.mocked(resolveNotificationTarget).mockResolvedValue({
      url: "/requests/r1",
    });
    vi.mocked(markNotificationRead).mockResolvedValue({
      ...NOTIF,
      is_read: true,
    });
    renderPage();
    await screen.findByText(/request was approved/i);
    await userEvent.click(
      screen.getByRole("button", { name: /request was approved/i }),
    );
    await waitFor(() =>
      expect(vi.mocked(resolveNotificationTarget).mock.calls[0]?.[0]).toBe(
        "n1",
      ),
    );
    expect(await screen.findByText("request detail")).toBeInTheDocument();
  });

  it("surfaces a friendly error when the target is no longer accessible", async () => {
    vi.mocked(resolveNotificationTarget).mockRejectedValue(
      new ApiError(404, { code: "not_found", detail: "Not found." }),
    );
    renderPage();
    await screen.findByText(/request was approved/i);
    await userEvent.click(
      screen.getByRole("button", { name: /request was approved/i }),
    );
    expect(
      await screen.findByText(/no longer accessible/i),
    ).toBeInTheDocument();
  });
});
