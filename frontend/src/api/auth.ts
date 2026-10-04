/**
 * Auth API surface for /api/v1/ (contracts/api.md). Session is a
 * same-origin cookie — nothing is persisted to localStorage.
 */
import { apiFetch, apiUpload } from "./client";

export interface Me {
  id: string;
  email: string;
  roles: string[];
  employee_code: string;
  display_name: string;
  phone: string;
  photo_url: string;
  job_title: string;
  department: string | null;
  manager: string | null;
  version: number;
}

export interface LoginResponse {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
}

export const fetchMe = () => apiFetch<Me>("/api/v1/me/");

export const login = (email: string, password: string) =>
  apiFetch<LoginResponse>("/api/v1/auth/login/", {
    method: "POST",
    body: { email, password },
  });

export const logout = () =>
  apiFetch<{ detail: string }>("/api/v1/auth/logout/", { method: "POST" });

export const acceptInvitation = (token: string, password: string) =>
  apiFetch<{ detail: string }>("/api/v1/auth/invitations/accept/", {
    method: "POST",
    body: { token, password },
  });

export const requestPasswordReset = (email: string) =>
  apiFetch<{ detail: string }>("/api/v1/auth/password-reset/", {
    method: "POST",
    body: { email },
  });

export const confirmPasswordReset = (token: string, password: string) =>
  apiFetch<{ detail: string }>("/api/v1/auth/password-reset/confirm/", {
    method: "POST",
    body: { token, password },
  });

export const updateMe = (
  patch: Partial<Pick<Me, "display_name" | "phone">> & {
    version?: number;
  },
) => apiFetch<Me>("/api/v1/me/", { method: "PATCH", body: patch });

export const uploadMyPhoto = (file: File) => {
  const form = new FormData();
  form.append("photo", file);
  return apiUpload<Me>("/api/v1/me/photo/", form);
};

export const deleteMyPhoto = () =>
  apiFetch<Me>("/api/v1/me/photo/", { method: "DELETE" });

export const changePassword = (
  currentPassword: string,
  newPassword: string,
) =>
  apiFetch<{ detail: string }>("/api/v1/me/password/", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
