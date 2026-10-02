import { apiFetch, type Paged } from "./client";

export type TimesheetStatus =
  | "collecting"
  | "pending_manager"
  | "pending_hr"
  | "approved"
  | "returned"
  | "rejected";

export type WorkDayStatus = "draft" | "submitted" | "returned" | "approved";

export interface TimeEntry {
  id: string;
  work_date: string;
  start_at: string;
  end_at: string;
  break_minutes: number;
  duration_minutes: number;
  description: string;
  window_flag: boolean;
  window_reason: string;
  voided_at: string | null;
}

export interface WorkDay {
  id: string;
  work_date: string;
  status: WorkDayStatus;
  submitted_at: string | null;
  version: number;
  total_minutes: number;
  entries: TimeEntry[];
}

export interface Timesheet {
  id: string;
  employee: string;
  employee_name: string;
  employee_email: string;
  employee_code: string;
  period_start: string;
  period_end: string;
  timezone: string;
  status: TimesheetStatus;
  current_reviewer: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  cycle: number;
  version: number;
  submitted_at: string | null;
  total_minutes: number;
  days: WorkDay[];
  created_at: string;
  updated_at: string;
}

export interface TimesheetEvent {
  event_type: string;
  actor_email: string | null;
  actor_name: string | null;
  previous_state: string;
  new_state: string;
  cycle: number;
  version: number;
  reason: string;
  snapshot: Record<string, unknown>;
  occurred_at: string;
}

export interface TimesheetFilters {
  status?: string;
  employee?: string;
  period?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface TimeEntryInput {
  work_date: string;
  start_at: string;
  end_at: string;
  break_minutes?: number;
  segment_breaks?: number[];
  description?: string;
  window_reason?: string;
}

export interface TimeEntryUpdateInput {
  start_at?: string;
  end_at?: string;
  break_minutes?: number;
  segment_breaks?: number[];
  description?: string;
  window_reason?: string;
  expected_version?: number;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string | number] => e[1] !== undefined && e[1] !== "",
  );
  const query = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return query ? `?${query}` : "";
}

export function listTimesheets(
  filters: TimesheetFilters,
): Promise<Paged<Timesheet>> {
  return apiFetch(
    `/api/v1/timesheets/${qs(filters as Record<string, string | number | undefined>)}`,
  );
}

export function getTimesheet(id: string): Promise<Timesheet> {
  return apiFetch(`/api/v1/timesheets/${id}/`);
}

export function getOrCreateTimesheet(anchorDate: string): Promise<Timesheet> {
  return apiFetch("/api/v1/timesheets/", {
    method: "POST",
    body: { period_start: anchorDate },
  });
}

export function createEntry(
  sheetId: string,
  input: TimeEntryInput,
): Promise<TimeEntry[]> {
  return apiFetch(`/api/v1/timesheets/${sheetId}/entries/`, {
    method: "POST",
    body: input,
  });
}

export function updateEntry(
  sheetId: string,
  entryId: string,
  input: TimeEntryUpdateInput,
): Promise<TimeEntry> {
  return apiFetch(`/api/v1/timesheets/${sheetId}/entries/${entryId}/`, {
    method: "PATCH",
    body: input,
  });
}

export function voidEntry(sheetId: string, entryId: string): Promise<void> {
  return apiFetch(`/api/v1/timesheets/${sheetId}/entries/${entryId}/void/`, {
    method: "POST",
    body: {},
  });
}

export function submitDay(
  sheetId: string,
  workDate: string,
): Promise<Timesheet> {
  return apiFetch(`/api/v1/timesheets/${sheetId}/days/${workDate}/submit/`, {
    method: "POST",
    body: {},
  });
}

function transition(
  sheetId: string,
  action: string,
  expectedVersion: number,
  reason?: string,
): Promise<Timesheet> {
  return apiFetch(`/api/v1/timesheets/${sheetId}/${action}/`, {
    method: "POST",
    body: { expected_version: expectedVersion, reason: reason ?? "" },
  });
}

export const submitTimesheet = (id: string, v: number) =>
  transition(id, "submit", v);
export const approveTimesheet = (id: string, v: number) =>
  transition(id, "approve", v);
export const rejectTimesheet = (id: string, v: number, reason: string) =>
  transition(id, "reject", v, reason);
export const returnTimesheet = (id: string, v: number, reason: string) =>
  transition(id, "return", v, reason);
export const reopenTimesheet = (id: string, v: number, reason: string) =>
  transition(id, "reopen", v, reason);

export function getTimesheetHistory(id: string): Promise<TimesheetEvent[]> {
  return apiFetch(`/api/v1/timesheets/${id}/history/`);
}

export interface PunchStatus {
  open: boolean;
  started_at: string | null;
}

export function getPunchStatus(): Promise<PunchStatus> {
  return apiFetch("/api/v1/timesheets/punch/");
}

export function checkIn(): Promise<{ started_at: string }> {
  return apiFetch("/api/v1/timesheets/punch/", { method: "POST" });
}

export function checkOut(): Promise<{ timesheet: string; entries: TimeEntry[] }> {
  return apiFetch("/api/v1/timesheets/punch/checkout/", { method: "POST" });
}

export function cancelCheckIn(): Promise<void> {
  return apiFetch("/api/v1/timesheets/punch/", { method: "DELETE" });
}
