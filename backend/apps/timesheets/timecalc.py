"""Pure time-domain rules for timesheets (FR-001, FR-002, D-005).

All functions take explicit UTC-aware datetimes plus the sheet's timezone
snapshot — local semantics (work_date, midnight splits, week bounds) derive
from that timezone, never from the server's clock or the browser's."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError


def elapsed_minutes(start: datetime, end: datetime, break_minutes: int) -> int:
    """Worked minutes = (end - start) - unpaid break, truncated to whole
    minutes. Rejects non-positive elapsed and break >= elapsed."""
    if end <= start:
        raise ValidationError("end must be after start")
    if break_minutes < 0:
        raise ValidationError("break_minutes cannot be negative")
    elapsed = int((end - start).total_seconds() // 60)
    if break_minutes >= elapsed:
        raise ValidationError("break must be shorter than the interval")
    return elapsed - break_minutes


def local_date(dt: datetime, tz: ZoneInfo) -> date:
    return dt.astimezone(tz).date()


def split_at_midnight(
    start: datetime, end: datetime, tz: ZoneInfo
) -> list[tuple[date, datetime, datetime]]:
    """Split an interval at each local-midnight boundary. Returns
    [(work_date, segment_start, segment_end)] in order. A segment's work_date
    is the local date on which it STARTS."""
    if end <= start:
        raise ValidationError("end must be after start")
    segments = []
    cursor = start
    while True:
        local = cursor.astimezone(tz)
        next_midnight = datetime.combine(local.date() + timedelta(days=1), time.min, tzinfo=tz)
        if next_midnight >= end:
            segments.append((local.date(), cursor, end))
            break
        segments.append((local.date(), cursor, next_midnight))
        cursor = next_midnight
    return segments


def period_bounds(anchor: date, week_start: int) -> tuple[date, date]:
    """Inclusive [start, end] of the week containing `anchor`.
    week_start: 0=Monday … 6=Sunday."""
    delta = (anchor.weekday() - week_start) % 7
    start = anchor - timedelta(days=delta)
    return start, start + timedelta(days=6)


def window_flags(
    earliest: str | time | None,
    latest: str | time | None,
    max_daily_minutes: int | None,
    *,
    day_start: str | time,
    day_end: str | time,
    daily_total: int,
) -> list[str]:
    """Working-window violations for a saved entry (D-005 flag+reason).
    `day_start`/`day_end`/`daily_total` are the entry's local-day bounds and
    the resulting day total. None bounds are unrestricted."""

    def to_time(v):
        if v is None:
            return None
        if isinstance(v, time):
            return v
        h, m = map(int, str(v).split(":")[:2])
        return time(h, m)

    flags = []
    lo, hi = to_time(earliest), to_time(latest)
    if lo is not None and to_time(day_start) < lo:
        flags.append("start_before_earliest")
    if hi is not None and to_time(day_end) > hi:
        flags.append("end_after_latest")
    if max_daily_minutes is not None and daily_total > max_daily_minutes:
        flags.append("over_max_daily")
    return flags
