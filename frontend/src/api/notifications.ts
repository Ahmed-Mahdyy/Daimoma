import { apiFetch, type Paged } from "./client";

export interface NotificationRow {
  id: string;
  event_key: string;
  kind: string;
  summary: string;
  target_type: string;
  target_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPage extends Paged<NotificationRow> {
  unread_count: number;
}

export function listNotifications(unreadOnly = false) {
  const suffix = unreadOnly ? "?unread=true" : "";
  return apiFetch<NotificationPage>(`/api/v1/notifications/${suffix}`);
}

export function markNotificationRead(id: string) {
  return apiFetch<NotificationRow>(`/api/v1/notifications/${id}/read/`, {
    method: "POST",
    body: {},
  });
}

export function markAllNotificationsRead() {
  return apiFetch("/api/v1/notifications/read-all/", {
    method: "POST",
    body: {},
  });
}
