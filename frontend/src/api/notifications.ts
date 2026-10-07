import { apiFetch, type Paged } from "./client";

export interface NotificationRow {
  id: string;
  event_key: string;
  kind: string;
  summary: string;
  summary_key: string;
  summary_params: Record<string, string>;
  target_type: string;
  target_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPage extends Paged<NotificationRow> {
  unread_count: number;
}

export function listNotifications(
  unread?: "true" | "false",
  kind?: string,
  page?: number,
  ordering?: "created_at" | "-created_at",
) {
  const params = new URLSearchParams();
  if (unread) params.set("unread", unread);
  if (kind) params.set("kind", kind);
  if (ordering) params.set("ordering", ordering);
  if (page && page > 1) params.set("page", String(page));
  const suffix = params.size ? `?${params}` : "";
  return apiFetch<NotificationPage>(`/api/v1/notifications/${suffix}`);
}

/** Cheap poll endpoint for the header badge (D-009: 60s interval). */
export function getUnreadCount() {
  return apiFetch<{ unread_count: number }>(
    "/api/v1/notifications/unread-count/",
  );
}

/** Resolve a notification's target — the server rechecks current scope and
 * returns 404 when the object is no longer accessible. */
export function resolveNotificationTarget(id: string) {
  return apiFetch<{ url: string }>(`/api/v1/notifications/${id}/target/`);
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
