import { apiFetch, type Paged } from "./client";

export type RequestStatus =
  | "draft"
  | "pending_manager"
  | "pending_hr"
  | "approved"
  | "returned"
  | "rejected";

export type StepStatus = "waiting" | "pending" | "approved" | "rejected" | "returned";

export interface RequestType {
  id: string;
  code: string;
  name: string;
  category:
    | "leave"
    | "equipment"
    | "hr_service"
    | "work_from_home"
    | "early_leave"
    | "general";
  help_text?: string;
  requires_manager?: boolean;
  requires_hr?: boolean;
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
  type_category: RequestType["category"];
  title: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  equipment_item: string;
  quantity: number | null;
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
  version?: number;
}

export interface RequestHistory {
  events: RequestEvent[];
  steps: ApprovalStep[];
}

export interface RequestTypeWriteInput {
  code: string;
  name: string;
  category: RequestType["category"];
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

export function listRequestTypes(): Promise<Paged<RequestType>> {
  // HR-managed lists are small; 100 keeps selects and the table complete.
  return apiFetch("/api/v1/request-types/?page_size=100");
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
