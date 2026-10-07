import { apiFetch } from "./client";

export interface OrgSettings {
  id: string;
  name: string;
  timezone: string;
  week_start: number;
  working_weekdays: number[];
  fallback_reviewer: string | null;
}

export function getOrgSettings() {
  return apiFetch<OrgSettings>("/api/v1/organization/settings/");
}

export function updateOrgSettings(input: Partial<OrgSettings>) {
  return apiFetch<OrgSettings>("/api/v1/organization/settings/", {
    method: "PATCH",
    body: input,
  });
}
