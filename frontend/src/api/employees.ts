import { apiFetch, type Paged } from "./client";

export interface EmployeeSummary {
  id: string;
  email: string;
  is_active: boolean;
  roles: string[];
  employee_code: string;
  display_name: string;
  phone: string;
  job_title: string;
  department: string | null;
  department_name: string | null;
  manager: string | null;
  manager_name: string | null;
  photo_url: string;
  version: number;
}


export interface EmployeeDetail extends EmployeeSummary {
  birth_date: string | null;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  highest_qualification: string;
  institution: string;
  field_of_study: string;
  graduation_year: number | null;
  /** Work/contract fields are present for HR viewers only. */
  employment_start_date?: string | null;
  employment_type?: "" | "full_time" | "part_time" | "contract" | "internship";
  work_location?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
}

export interface EmployeeFilters {
  search?: string;
  is_active?: string;
  department?: string;
  role?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface ManagerChoice {
  /** EmployeeProfile id — use for reporting-line (manager) fields. */
  id: string;
  /** User id — use for user-typed fields like fallback_reviewer. */
  user_id: string;
  display_name: string;
  employee_code: string;
  roles: string[];
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

export function listEmployees(
  filters: EmployeeFilters,
): Promise<Paged<EmployeeSummary>> {
  return apiFetch(`/api/v1/employees/${qs(filters as Record<string, string | number | undefined>)}`);
}

export function getEmployee(id: string): Promise<EmployeeDetail> {
  return apiFetch(`/api/v1/employees/${id}/`);
}

export interface ProvisionInput extends Partial<Pick<EmployeeDetail,
  "birth_date" | "address" | "emergency_contact_name" | "emergency_contact_phone" |
  "highest_qualification" | "institution" | "field_of_study" | "graduation_year" |
  "employment_start_date" | "employment_type" | "work_location" |
  "contract_start_date" | "contract_end_date"
>> {
  email: string;
  employee_code: string;
  display_name?: string;
  phone?: string;
  job_title?: string;
  department?: string | null;
  manager?: string | null;
  roles?: string[];
}

export function provisionEmployee(input: ProvisionInput): Promise<EmployeeDetail> {
  return apiFetch("/api/v1/employees/", { method: "POST", body: input });
}

export interface EmployeeUpdate extends Partial<Pick<EmployeeDetail,
  "birth_date" | "address" | "emergency_contact_name" | "emergency_contact_phone" |
  "highest_qualification" | "institution" | "field_of_study" | "graduation_year" |
  "employment_start_date" | "employment_type" | "work_location" |
  "contract_start_date" | "contract_end_date"
>> {
  email?: string;
  employee_code?: string;
  display_name?: string;
  phone?: string;
  job_title?: string;
  department?: string | null;
  manager?: string | null;
  roles?: string[];
  version?: number;
}

export function updateEmployee(
  id: string,
  input: EmployeeUpdate,
): Promise<EmployeeDetail> {
  return apiFetch(`/api/v1/employees/${id}/`, { method: "PATCH", body: input });
}

export function deactivateEmployee(id: string, reason: string) {
  return apiFetch(`/api/v1/employees/${id}/deactivate/`, {
    method: "POST",
    body: { reason },
  });
}

export function reactivateEmployee(id: string, note: string) {
  return apiFetch(`/api/v1/employees/${id}/reactivate/`, {
    method: "POST",
    body: { note },
  });
}

export function resendInvitation(id: string) {
  return apiFetch(`/api/v1/employees/${id}/resend-invitation/`, {
    method: "POST",
    body: {},
  });
}

export function managerChoices(search?: string) {
  return apiFetch<{ results: ManagerChoice[]; count: number }>(
    `/api/v1/choices/managers/${qs({ search })}`,
  );
}
