# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
"""Sheet/workday integrity: overlapping sheets are refused at open time and
a workday that already exists in another sheet is a validation error, never
a 500."""
from datetime import UTC, date, datetime, timedelta

import pytest
from rest_framework.exceptions import ValidationError

from apps.conftest import make_profile, make_user
from apps.timesheets.models import Timesheet, WorkDay
from apps.timesheets.services import create_entries, get_or_create_sheet
from apps.timesheets.timecalc import period_bounds

pytestmark = pytest.mark.django_db


@pytest.fixture
def emp(org):
    user = make_user(org, "int-emp@acme.test")
    make_profile(org, user, "E900")
    return user


def make_sheet(profile, org, pstart, pend):
    return Timesheet.objects.create(
        organization=org,
        employee=profile,
        period_start=pstart,
        period_end=pend,
        timezone=org.timezone,
    )


class TestSheetOverlap:
    def test_overlapping_sheet_rejected(self, org, emp):
        # Past week so the future-week guard stays out of the way.
        pstart, pend = period_bounds(date(2026, 8, 10), org.week_start)
        # A stray/incorrectly-bounded sheet overlaps that week — creating a
        # fresh sheet there must be refused.
        make_sheet(
            emp.profile, org, pstart - timedelta(days=1), pstart + timedelta(days=1)
        )
        with pytest.raises(ValidationError):
            get_or_create_sheet(emp, date(2026, 8, 10))

    def test_existing_sheet_wins_despite_stray_overlap(self, org, emp):
        pstart, pend = period_bounds(date(2026, 8, 10), org.week_start)
        real = get_or_create_sheet(emp, date(2026, 8, 10))
        make_sheet(
            emp.profile, org, pstart - timedelta(days=1), pstart + timedelta(days=1)
        )
        assert get_or_create_sheet(emp, date(2026, 8, 12)).id == real.id

    def test_same_week_still_opens(self, org, emp):
        sheet1 = get_or_create_sheet(emp, date(2026, 8, 17))
        sheet2 = get_or_create_sheet(emp, date(2026, 8, 20))
        assert sheet1.id == sheet2.id

    def test_duplicate_workday_maps_to_validation_error(
        self, org, emp
    ):
        pstart, pend = period_bounds(date(2026, 8, 10), org.week_start)
        sheet = get_or_create_sheet(emp, date(2026, 8, 10))
        # Simulate a workday that already lives in another sheet.
        stray = make_sheet(
            emp.profile, org, date(2026, 7, 6), date(2026, 7, 12)
        )
        WorkDay.objects.create(
            organization=org,
            employee=emp.profile,
            timesheet=stray,
            work_date=pstart,
        )
        with pytest.raises(ValidationError) as exc:
            create_entries(
                sheet.id,
                emp,
                {
                    "work_date": pstart,
                    "start_at": datetime(2026, 8, 10, 9, tzinfo=UTC),
                    "end_at": datetime(2026, 8, 10, 10, tzinfo=UTC),
                    "break_minutes": 0,
                    "note": "",
                },
            )
        assert "another timesheet" in str(exc.value).lower()
