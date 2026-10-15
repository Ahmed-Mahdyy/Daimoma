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

/** Working days in the inclusive [start, end] range, mirroring the server's
 * allocation rule: days are counted against the org's configured weekdays
 * (0=Mon … 6=Sun); every calendar day counts when none are configured.
 * Returns null without a full, ordered range. */
export function countWorkingDays(
  startISO: string,
  endISO: string,
  weekdays: number[],
): number | null {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }
  const set = new Set(weekdays);
  let count = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // JS getDay() is Sun=0..Sat=6; the backend uses Python weekday() Mon=0..Sun=6.
    if (!set.size || set.has((d.getDay() + 6) % 7)) count += 1;
  }
  return count;
}

/** Billed hours between two same-day "HH:MM" times, mirroring the server's
 * rule: elapsed minutes round up to the next 15-minute block with a
 * 30-minute minimum. Returns null without a full, ordered pair. */
export function chargedHours(from: string, to: string): number | null {
  const parts = (v: string) => v.split(":").map(Number);
  if (!from || !to || from.length < 5 || to.length < 5) return null;
  const [fh, fm] = parts(from);
  const [th, tm] = parts(to);
  const minutes = th * 60 + tm - (fh * 60 + fm);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.max(30, Math.ceil(minutes / 15) * 15) / 60;
}

/** Local "today" as YYYY-MM-DD — UTC slicing would drift near midnight. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
