# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
"""T002 — reference interval/DST/week-boundary/minute-calculation tests.
These pin the pure time rules before any domain logic (FR-001, FR-002).
The backend is authoritative: clients send explicit UTC instants; all local
semantics derive from the sheet's timezone snapshot."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest
from django.core.exceptions import ValidationError

from apps.timesheets.timecalc import (
    elapsed_minutes,
    local_date,
    period_bounds,
    split_at_midnight,
    window_flags,
)

UTC = UTC
CAIRO = ZoneInfo("Africa/Cairo")
NEW_YORK = ZoneInfo("America/New_York")


class TestElapsedMinutes:
    def test_simple_interval(self):
        s = datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
        e = datetime(2026, 10, 5, 17, 30, tzinfo=UTC)
        assert elapsed_minutes(s, e, 0) == 510

    def test_break_subtracted(self):
        s = datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
        e = datetime(2026, 10, 5, 17, 30, tzinfo=UTC)
        assert elapsed_minutes(s, e, 30) == 480

    def test_break_equal_to_elapsed_rejected(self):
        s = datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
        e = datetime(2026, 10, 5, 10, 0, tzinfo=UTC)
        with pytest.raises(ValidationError):
            elapsed_minutes(s, e, 60)

    def test_break_greater_than_elapsed_rejected(self):
        s = datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
        e = datetime(2026, 10, 5, 10, 0, tzinfo=UTC)
        with pytest.raises(ValidationError):
            elapsed_minutes(s, e, 90)

    def test_negative_break_rejected(self):
        s = datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
        e = datetime(2026, 10, 5, 10, 0, tzinfo=UTC)
        with pytest.raises(ValidationError):
            elapsed_minutes(s, e, -5)

    def test_end_not_after_start_rejected(self):
        s = datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
        with pytest.raises(ValidationError):
            elapsed_minutes(s, s, 0)

    def test_seconds_truncated_to_minute_precision(self):
        s = datetime(2026, 10, 5, 9, 0, 30, tzinfo=UTC)
        e = datetime(2026, 10, 5, 10, 0, 45, tzinfo=UTC)
        assert elapsed_minutes(s, e, 0) == 60  # 60min15s -> 60


class TestLocalDate:
    """work_date must derive from the SHEET timezone, never from UTC or the
    browser's clock."""

    def test_local_date_cairo_same_day(self):
        # 09:00 UTC = 12:00 Cairo (UTC+3 in October)
        dt = datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
        assert local_date(dt, CAIRO) == date(2026, 10, 5)

    def test_local_date_utc_next_day_but_local_same(self):
        # 22:30 UTC Oct 5 = 01:30 Cairo Oct 6 — work_date is the local date
        dt = datetime(2026, 10, 5, 22, 30, tzinfo=UTC)
        assert local_date(dt, CAIRO) == date(2026, 10, 6)
        assert local_date(dt, UTC) == date(2026, 10, 5)


class TestOvernightSplit:
    """Intervals crossing local midnight split into per-day segments (D-005)."""

    def test_same_day_no_split(self):
        s = datetime(2026, 10, 5, 9, 0, tzinfo=UTC)
        e = datetime(2026, 10, 5, 17, 0, tzinfo=UTC)
        segs = split_at_midnight(s, e, CAIRO)
        assert segs == [(date(2026, 10, 5), s, e)]

    def test_overnight_splits_at_local_midnight(self):
        # Cairo: start 22:00 local Oct 5 (19:00 UTC), end 02:00 local Oct 6
        s = datetime(2026, 10, 5, 19, 0, tzinfo=UTC)  # 22:00 Cairo
        e = datetime(2026, 10, 5, 23, 0, tzinfo=UTC)  # 02:00 Cairo next day
        segs = split_at_midnight(s, e, CAIRO)
        assert len(segs) == 2
        assert segs[0][0] == date(2026, 10, 5)
        assert segs[1][0] == date(2026, 10, 6)
        # first segment ends at local midnight; second starts there
        assert local_date(segs[0][2], CAIRO) == date(2026, 10, 6)
        assert local_date(segs[1][1], CAIRO) == date(2026, 10, 6)

    def test_utc_overnight_may_not_split_locally(self):
        # 22:00-02:00 UTC is 01:00-05:00 next-day Cairo — splits on the LOCAL day
        s = datetime(2026, 10, 5, 22, 0, tzinfo=UTC)
        e = datetime(2026, 10, 6, 2, 0, tzinfo=UTC)
        segs = split_at_midnight(s, e, CAIRO)
        assert [seg[0] for seg in segs] == [date(2026, 10, 6)]


class TestWeekBounds:
    """Weekly period derives from org timezone + configured week_start."""

    def test_monday_week_start(self):
        start, end = period_bounds(date(2026, 10, 7), 0)  # Wednesday, Mon start
        assert (start, end) == (date(2026, 10, 5), date(2026, 10, 11))

    def test_sunday_week_start(self):
        start, end = period_bounds(date(2026, 10, 7), 6)  # Sunday start
        assert (start, end) == (date(2026, 10, 4), date(2026, 10, 10))

    def test_on_boundary(self):
        start, end = period_bounds(date(2026, 10, 5), 0)  # exactly Monday
        assert (start, end) == (date(2026, 10, 5), date(2026, 10, 11))
        start, end = period_bounds(date(2026, 10, 11), 0)  # exactly Sunday
        assert (start, end) == (date(2026, 10, 5), date(2026, 10, 11))


class TestWindowFlags:
    """HR-configured window (earliest start / latest end / max daily minutes);
    violations require a reason but are recorded, not rejected (D-005)."""

    def test_inside_window_no_flag(self):
        assert (
            window_flags("08:00", "20:00", 600, day_start="09:00", day_end="17:00", daily_total=480)
            == []
        )

    def test_before_earliest_flagged(self):
        flags = window_flags(
            "08:00", "20:00", 600, day_start="06:30", day_end="17:00", daily_total=480
        )
        assert "start_before_earliest" in flags

    def test_after_latest_flagged(self):
        flags = window_flags(
            "08:00", "20:00", 600, day_start="09:00", day_end="22:00", daily_total=480
        )
        assert "end_after_latest" in flags

    def test_over_max_daily_flagged(self):
        flags = window_flags(
            "08:00", "20:00", 480, day_start="09:00", day_end="18:00", daily_total=540
        )
        assert "over_max_daily" in flags

    def test_unset_bounds_unrestricted(self):
        assert (
            window_flags(None, None, None, day_start="02:00", day_end="23:00", daily_total=1200)
            == []
        )
