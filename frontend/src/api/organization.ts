import { apiFetch } from "./client";

export interface OrgEmailSettings {
  email_mode: "env" | "smtp";
  email_host: string;
  email_port: number;
  email_host_user: string;
  /** Write-only — the API never returns the stored password. */
  email_host_password?: string;
  email_password_set: boolean;
  email_use_tls: boolean;
  email_use_ssl: boolean;
  email_timeout: number;
  email_from: string;
}

export interface OrgSettings extends OrgEmailSettings {
  id: string;
  name: string;
  timezone: string;
  week_start: number;
  working_weekdays: number[];
  fallback_reviewer: string | null;
}

export type OrgEmailTestInput = Partial<
  Omit<OrgEmailSettings, "email_mode" | "email_password_set">
>;

export function getOrgSettings() {
  return apiFetch<OrgSettings>("/api/v1/organization/settings/");
}

export function updateOrgSettings(input: Partial<OrgSettings>) {
  return apiFetch<OrgSettings>("/api/v1/organization/settings/", {
    method: "PATCH",
    body: input,
  });
}

export function testOrgEmail(input: OrgEmailTestInput) {
  return apiFetch<{ detail: string }>("/api/v1/organization/settings/test-email/", {
    method: "POST",
    body: input,
  });
}
