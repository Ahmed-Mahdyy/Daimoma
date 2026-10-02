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
