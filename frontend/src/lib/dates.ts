/** Locale-aware date formatting synced from LanguageProvider: Arabic mode
 * renders dates/times with ar-EG names; English keeps the browser default. */

let locale: string | undefined;

export function setDateLocale(lang: "en" | "ar") {
  locale = lang === "ar" ? "ar" : undefined;
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(locale);
}

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString(locale);
}

/** Local "today" as YYYY-MM-DD — UTC slicing would drift near midnight. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
