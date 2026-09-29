import { apiFetch } from "./client";

export interface Department {
  id: string;
  name: string;
  is_active: boolean;
}

export function listDepartments() {
  return apiFetch<{ results: Department[]; count: number }>(
    "/api/v1/departments/",
  );
}

export function createDepartment(name: string) {
  return apiFetch<Department>("/api/v1/departments/", {
    method: "POST",
    body: { name },
  });
}

export function updateDepartment(
  id: string,
  input: { name?: string; is_active?: boolean },
) {
  return apiFetch<Department>(`/api/v1/departments/${id}/`, {
    method: "PATCH",
    body: input,
  });
}
