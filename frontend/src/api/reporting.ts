/**
 * Dashboard/report client (005). Reports are scoped server-side — filter
 * params narrow within the caller's scope, never widen it (D-003/D-009).
 */
import { apiFetch, type Paged } from "./client";

export interface DashboardPeriod {
  from: string;
  to: string;
  timezone: string;
}

export interface Dashboard {
  scope: "personal" | "team" | "organization";
  period: DashboardPeriod;
  requests: { by_status: Record<string, number> };
  timesheets: { by_status: Record<string, number> };
  approved_minutes: number;
  pending_review: number;
}

export interface HoursRow {
  work_date: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string | null;
  minutes: number;
}

export interface RequestReportRow {
  id: string;
  title: string;
  type: string;
  category: string;
  status: string;
  submitted_at: string | null;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string | null;
}

export interface ReportMeta {
  period: { from: string; to: string };
  timezone: string;
  grouping: string;
  status?: string;
  date_basis?: string;
}

export interface HoursPage extends Paged<HoursRow> {
  totals: { minutes: number };
  meta: ReportMeta;
}

export interface RequestPage extends Paged<RequestReportRow> {
  totals: { count: number };
  meta: ReportMeta;
}

export type DashboardScope = "personal" | "team" | "organization";

export function getDashboard(scope: DashboardScope, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const suffix = params.size ? `?${params}` : "";
  return apiFetch<Dashboard>(`/api/v1/dashboards/${scope}/${suffix}`);
}

export interface HoursReportParams {
  from?: string;
  to?: string;
  status?: string;
  employee?: string;
  ordering?: string;
  page?: number;
}

export function getHoursReport(params: HoursReportParams) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  return apiFetch<HoursPage>(`/api/v1/reports/working-hours/?${qs}`);
}

export interface RequestsReportParams extends HoursReportParams {
  type?: string;
}

export function getRequestsReport(params: RequestsReportParams) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  return apiFetch<RequestPage>(`/api/v1/reports/requests/?${qs}`);
}

/** CSV export — fetch → blob download (D-009: manager/HR only server-side). */
export async function downloadReportCsv(
  kind: "working-hours" | "requests",
  params: HoursReportParams | RequestsReportParams,
): Promise<void> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const resp = await fetch(`/api/v1/reports/${kind}/export/?${qs}`, {
    credentials: "same-origin",
  });
  if (!resp.ok) {
    let detail = `Export failed (${resp.status})`;
    try {
      const body = (await resp.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // non-JSON error body
    }
    throw new Error(detail);
  }
  const blob = await resp.blob();
  const disposition = resp.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] ?? `${kind}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
