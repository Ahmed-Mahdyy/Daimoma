import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/notifications", () => ({
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications";
import { NotificationBell } from "./NotificationBell";

const NOTIF = {
  id: "n1",
  event_key: "audit:1",
  kind: "account_reactivated",
  summary: "Your account was reactivated by HR.",
  target_type: "accounts.employeeprofile",
  target_id: "x",
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
};

function renderBell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUnreadCount).mockResolvedValue({ unread_count: 1 });
  });

  it("shows the unread count badge", async () => {
    vi.mocked(listNotifications).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      unread_count: 1,
      results: [NOTIF],
    });
    renderBell();
    expect(
      await screen.findByRole("button", { name: /1 unread/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("lists notifications in the dropdown and marks one read", async () => {
    vi.mocked(listNotifications).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      unread_count: 1,
      results: [NOTIF],
    });
    vi.mocked(markNotificationRead).mockResolvedValue({ ...NOTIF, is_read: true });
    renderBell();
    await userEvent.click(
      await screen.findByRole("button", { name: /unread/i }),
    );
    expect(await screen.findByText(/reactivated by HR/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /mark read$/i }));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalled());
    expect(vi.mocked(markNotificationRead).mock.calls[0][0]).toBe("n1");
  });

  it("closes the dropdown with Escape", async () => {
    vi.mocked(listNotifications).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      unread_count: 1,
      results: [NOTIF],
    });
    renderBell();
    await userEvent.click(
      await screen.findByRole("button", { name: /unread/i }),
    );
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("marks all read", async () => {
    vi.mocked(listNotifications).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      unread_count: 2,
      results: [NOTIF, { ...NOTIF, id: "n2", event_key: "audit:2" }],
    });
    renderBell();
    await userEvent.click(
      await screen.findByRole("button", { name: /unread/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /mark all read/i }),
    );
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
  });
});
