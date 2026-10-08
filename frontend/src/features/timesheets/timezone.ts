/** Wall-clock (datetime-local input, "YYYY-MM-DDTHH:mm") in `tz` → UTC Date.
 * Two-pass offset resolution keeps DST transitions correct. */
export function zonedToUtc(tz: string, local: string): Date {
  const naive = Date.parse(`${local}:00Z`);
  if (Number.isNaN(naive)) return new Date(NaN);
  let utc = naive - tzOffsetMinutes(tz, naive) * 60_000;
  // second pass — the offset at the resolved instant may differ across DST
  utc = naive - tzOffsetMinutes(tz, utc) * 60_000;
  return new Date(utc);
}

export function tzOffsetMinutes(tz: string, utcMillis: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcMillis);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const asIfUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")) % 24,
    Number(get("minute")),
    Number(get("second")),
  );
  return Math.round((asIfUtc - utcMillis) / 60_000);
}

/** "YYYY-MM-DD" for a wall-clock local input string. */
export function localDate(local: string): string {
  return local.slice(0, 10);
}

/** "YYYY-MM-DD" today in `tz` — day-level future checks belong to the
 * sheet's timezone, not the browser's. */
export function todayInZone(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "YYYY-MM-DDTHH:mm" now in `tz` — max for datetime-local inputs. */
export function nowInZone(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export function formatMinutes(minutes: number, lang: "en" | "ar" = "en"): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === "ar") {
    return `${h}س ${String(m).padStart(2, "0")}د`;
  }
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** HH:mm in the sheet's timezone for display. */
export function formatTimeInZone(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
