import { apiFetch } from "./client";

export interface Department {
  id: string;
  name: string;
  manager: string | null;
  manager_name: string | null;
  is_active: boolean;
  created_at: string;
}

export function getDepartment(id: string) {
  return apiFetch<Department>(`/api/v1/departments/${id}/`);
}

export function listDepartments(filters: { search?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  const suffix = query.toString();
  return apiFetch<{ results: Department[]; count: number }>(
    `/api/v1/departments/${suffix ? `?${suffix}` : ""}`,
  );
}

export function createDepartment(name: string, manager: string | null) {
  return apiFetch<Department>("/api/v1/departments/", {
    method: "POST",
    body: { name, manager },
  });
}

export function updateDepartment(
  id: string,
  input: { name?: string; manager?: string | null; is_active?: boolean },
) {
  return apiFetch<Department>(`/api/v1/departments/${id}/`, {
    method: "PATCH",
    body: input,
  });
}
