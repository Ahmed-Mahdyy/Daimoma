import { apiFetch, type Paged } from "./client";

export type RequestStatus =
  | "draft"
  | "pending_manager"
  | "pending_hr"
  | "approved"
  | "returned"
  | "rejected";

export type StepStatus = "waiting" | "pending" | "approved" | "rejected" | "returned";

export type AllocationUnit = "none" | "unit" | "hour";

export interface RequestType {
  id: string;
  code: string;
  name: string;
  unit: AllocationUnit;
  requires_item?: boolean;
  requires_dates?: boolean;
  help_text?: string;
  requires_manager?: boolean;
  requires_hr?: boolean;
  requires_allocation?: boolean;
  is_active?: boolean;
  created_at?: string;
}

export interface ApprovalStep {
  cycle: number;
  sequence: number;
  required_role: "manager" | "hr";
  reviewer: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  status: StepStatus;
  reason: string;
  decided_at: string | null;
}

export interface RequestEvent {
  event_type: string;
  actor: string | null;
  actor_name: string | null;
  actor_email: string | null;
  previous_status: string;
  new_status: string;
  cycle: number;
  version: number;
  reason: string;
  snapshot: Record<string, unknown>;
  occurred_at: string;
}

export interface EmployeeRequest {
  id: string;
  employee: string;
  employee_name: string | null;
  employee_email: string;
  employee_code: string;
  type: string;
  type_name: string;
  type_unit: AllocationUnit;
  title: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  equipment_item: string;
  quantity: number | null;
  hours: string | null;
  status: RequestStatus;
  cycle: number;
  version: number;
  submitted_at: string | null;
  current_step: ApprovalStep | null;
  created_at: string;
  updated_at: string;
}

export interface RequestFilters {
  status?: string;
  type?: string;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface RequestDraftInput {
  type: string;
  title: string;
  description: string;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  equipment_item?: string;
  quantity?: number | null;
  hours?: number | null;
  version?: number;
}

export interface RequestHistory {
  events: RequestEvent[];
  steps: ApprovalStep[];
}

export interface RequestTypeWriteInput {
  name: string;
  unit: AllocationUnit;
  requires_item?: boolean;
  requires_dates?: boolean;
  requires_allocation?: boolean;
  help_text?: string;
  requires_manager?: boolean;
  requires_hr?: boolean;
  is_active?: boolean;
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

export function listRequests(filters: RequestFilters): Promise<Paged<EmployeeRequest>> {
  return apiFetch(
    `/api/v1/requests/${qs(filters as Record<string, string | number | undefined>)}`,
  );
}

export function getRequest(id: string): Promise<EmployeeRequest> {
  return apiFetch(`/api/v1/requests/${id}/`);
}

export function createRequest(input: RequestDraftInput): Promise<EmployeeRequest> {
  return apiFetch("/api/v1/requests/", { method: "POST", body: input });
}

export function updateRequest(
  id: string,
  input: Partial<RequestDraftInput>,
): Promise<EmployeeRequest> {
  return apiFetch(`/api/v1/requests/${id}/`, { method: "PATCH", body: input });
}

export function submitRequest(id: string, version: number): Promise<EmployeeRequest> {
  return apiFetch(`/api/v1/requests/${id}/submit/`, {
    method: "POST",
    body: { version },
  });
}

function review(id: string, action: string, version: number, reason?: string) {
  return apiFetch<EmployeeRequest>(`/api/v1/requests/${id}/${action}/`, {
    method: "POST",
    body: { version, reason: reason ?? "" },
  });
}

export const approveRequest = (id: string, version: number) =>
  review(id, "approve", version);
export const rejectRequest = (id: string, version: number, reason: string) =>
  review(id, "reject", version, reason);
export const returnRequest = (id: string, version: number, reason: string) =>
  review(id, "return", version, reason);

export function getRequestHistory(id: string): Promise<RequestHistory> {
  return apiFetch(`/api/v1/requests/${id}/history/`);
}

export function deleteRequest(id: string): Promise<void> {
  return apiFetch(`/api/v1/requests/${id}/`, { method: "DELETE" });
}

export interface BulkDeleteResult {
  deleted: number;
  /** Ids the server skipped — not owned, not draft, or out of scope. */
  skipped: string[];
}

export function bulkDeleteRequests(ids: string[]): Promise<BulkDeleteResult> {
  return apiFetch("/api/v1/requests/bulk-delete/", {
    method: "POST",
    body: { ids },
  });
}

export function listRequestTypes(): Promise<Paged<RequestType>> {
  // HR-managed lists are small; 100 keeps selects and the table complete.
  return apiFetch("/api/v1/request-types/?page_size=100");
}

export function getRequestType(id: string): Promise<RequestType> {
  return apiFetch(`/api/v1/request-types/${id}/`);
}

export function createRequestType(input: RequestTypeWriteInput): Promise<RequestType> {
  return apiFetch("/api/v1/request-types/", { method: "POST", body: input });
}

export function updateRequestType(
  id: string,
  input: Partial<RequestTypeWriteInput>,
): Promise<RequestType> {
  return apiFetch(`/api/v1/request-types/${id}/`, { method: "PATCH", body: input });
}

export interface AllocationGrant {
  id: string;
  employee: string;
  employee_name: string;
  request_type: string;
  type_name: string;
  unit: "unit" | "hour";
  start_date: string;
  end_date: string;
  initial_amount: number;
  status: "active" | "void";
  version: number;
  granted: number;
  reserved: number;
  used: number;
  remaining: number;
  created_at: string;
  voided_at: string | null;
}

export const ALLOCATION_UNIT_LABELS: Record<AllocationGrant["unit"], string> = {
  unit: "units",
  hour: "hours",
};

/** Hour-unit rows store whole minutes; units store plain counts. */
export function formatAllocationAmount(amount: number, unit: AllocationGrant["unit"]): string {
  if (unit === "hour") {
    const hours = amount / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(2)}`;
  }
  return String(amount);
}

/** Convert a user-entered hours value into the API's whole-minute amount. */
export function hoursToAmount(hours: number): number {
  return Math.round(hours * 60);
}

export interface AllocationPreview {
  required: boolean;
  amount: number;
  unit?: AllocationGrant["unit"];
  status: "not_required" | "no_grant" | "insufficient" | "available";
  remaining?: number | null;
  grant?: string | null;
}

export interface AllocationCreateInput {
  employee: string;
  request_type: string;
  start_date: string;
  end_date: string;
  initial_amount: number;
}

export interface AllocationHistoryEntry {
  id: string;
  actor: string;
  reason: string;
  occurred_at: string;
  delta?: number;
  action?: string;
  previous?: Record<string, string>;
  current?: Record<string, string>;
}

export function listAllocations(filters: {
  page?: number;
  employee?: string;
  status?: AllocationGrant["status"];
  search?: string;
} = {}): Promise<Paged<AllocationGrant>> {
  return apiFetch(`/api/v1/allocations/${qs(filters)}`);
}

export function listMyAllocations(): Promise<Paged<AllocationGrant>> {
  return apiFetch("/api/v1/allocations/mine/");
}

export function getAllocation(id: string): Promise<AllocationGrant> {
  return apiFetch(`/api/v1/allocations/${id}/`);
}

export function getAllocationPreview(input: Partial<RequestDraftInput>): Promise<AllocationPreview> {
  const params = new URLSearchParams();
  for (const field of ["type", "start_date", "end_date", "start_time", "end_time", "equipment_item", "quantity", "hours"] as const) {
    const value = input[field];
    if (value !== undefined && value !== null && value !== "") params.set(field, String(value));
  }
  return apiFetch(`/api/v1/requests/allocation-preview/?${params}`);
}

export function createAllocation(input: AllocationCreateInput): Promise<AllocationGrant> {
  return apiFetch("/api/v1/allocations/", { method: "POST", body: input });
}

export function editAllocationDates(
  grant: AllocationGrant, start_date: string, end_date: string, reason: string,
): Promise<AllocationGrant> {
  return apiFetch(`/api/v1/allocations/${grant.id}/`, {
    method: "PATCH", body: { start_date, end_date, reason, version: grant.version },
  });
}

export function adjustAllocation(
  grant: AllocationGrant, delta: number, reason: string,
): Promise<AllocationGrant> {
  return apiFetch(`/api/v1/allocations/${grant.id}/adjust/`, {
    method: "POST", body: { delta, reason, version: grant.version },
  });
}

export function removeAllocation(grant: AllocationGrant, reason: string): Promise<AllocationGrant> {
  return apiFetch(`/api/v1/allocations/${grant.id}/void/`, {
    method: "POST", body: { reason, version: grant.version },
  });
}

export function getAllocationHistory(
  id: string, kind: "adjustments" | "changes", page = 1,
): Promise<Paged<AllocationHistoryEntry>> {
  return apiFetch(`/api/v1/allocations/${id}/${kind}/?page=${page}`);
}
