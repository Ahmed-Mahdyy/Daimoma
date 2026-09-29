import { apiFetch, type Paged } from "./client";

export interface AuditEventRow {
  id: string;
  action: string;
  actor_email: string | null;
  actor_name: string | null;
  target_type: string;
  target_id: string;
  metadata: Record<string, string>;
  occurred_at: string;
}

export function listAuditEvents(params?: {
  action?: string;
  page?: number;
  page_size?: number;
}) {
  const query = new URLSearchParams();
  if (params?.action) query.set("action", params.action);
  if (params?.page) query.set("page", String(params.page));
  if (params?.page_size) query.set("page_size", String(params.page_size));
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<Paged<AuditEventRow>>(`/api/v1/audit-events/${suffix}`);
}
