/** Shared employee-information field lists and the derived contract
 * duration — used by the HR detail/provision pages and the read-only
 * self-profile view so labels stay identical everywhere. */

export const PERSONAL_FIELDS = [
  ["birth_date", "Birth date", "date"],
  ["address", "Address", "text"],
  ["emergency_contact_name", "Emergency contact name", "text"],
  ["emergency_contact_phone", "Emergency contact phone", "tel"],
] as const;

export const EDUCATION_FIELDS = [
  ["highest_qualification", "Highest qualification", "text"],
  ["institution", "Institution", "text"],
  ["field_of_study", "Field of study", "text"],
] as const;

export const EMPLOYMENT_FIELDS = [
  ["work_location", "Work location", "text"],
  ["contract_start_date", "Contract start date", "date"],
  ["contract_end_date", "Contract end date", "date"],
] as const;

/** Mirrors normalize_egyptian_phone on the backend — HTML pattern is
 * implicitly anchored, so no ^$ needed here. */
export const EGYPT_PHONE_PATTERN =
  String.raw`(\+20|0020|0)(1[0125][0-9]{8}|[2-9][0-9]{7,8})`;
export const EGYPT_PHONE_HINT =
  "Egyptian numbers only — e.g. 01012345678 or +201012345678";

/** Graduation year is a bounded choice, never free text (1950 → current). */
export function graduationYears(): number[] {
  const now = new Date().getFullYear();
  return Array.from({ length: now - 1949 }, (_, i) => now - i);
}

/** Derived display for the contract range (no stored duration — it would
 * drift from the dates). Empty start means no contract on file. */
export function contractDuration(
  start: string | null | undefined,
  end: string | null | undefined,
  t: (k: string) => string,
): string {
  if (!start) return "—";
  const from = new Date(start);
  const to = end ? new Date(end) : new Date();
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years ? t("{n} yr").replace("{n}", String(years)) : "",
    rest ? t("{n} mo").replace("{n}", String(rest)) : "",
  ].filter(Boolean);
  const span = parts.join(" ") || t("{n} mo").replace("{n}", "0");
  return end ? span : `${span} · ${t("Open-ended")}`;
}
