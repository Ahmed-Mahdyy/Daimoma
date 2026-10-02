# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
"""True multi-connection race tests (plan §Verification): threads with
separate PostgreSQL connections, not a single rolled-back transaction.
The employee-before-sheet lock order must serialize competing writers so
exactly one valid outcome is recorded."""

import threading
from datetime import UTC, date, datetime

import pytest
from config.exceptions import ConflictError
from django.contrib.auth.models import Group
from django.db import connections
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.conftest import make_profile, make_user
from apps.timesheets.models import TimeEntry, Timesheet, WorkDay
from apps.timesheets.services import (
    create_entries,
    get_or_create_sheet,
    review_sheet,
    submit_day,
    submit_sheet,
    update_entry,
)

pytestmark = pytest.mark.django_db(transaction=True)

WEEK = date(2026, 9, 21)  # a past Monday


def run_in_threads(*fns):
    """Run callables on threads with isolated DB connections.
    Returns (results, errors) lists aligned with `fns`."""
    results, errors = [None] * len(fns), [None] * len(fns)

    def wrapper(i, fn):
        try:
            results[i] = fn()
        except Exception as exc:  # noqa: BLE001 - capture to assert in main thread
            errors[i] = exc
        finally:
            connections["default"].close()

    threads = [threading.Thread(target=wrapper, args=(i, fn)) for i, fn in enumerate(fns)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    return results, errors


@pytest.fixture
def roles():
    """transaction=True truncates migration-seeded groups between tests."""
    Group.objects.get_or_create(name=ROLE_MANAGER)
    Group.objects.get_or_create(name=ROLE_HR)


@pytest.fixture
def cast(roles, org):
    emp_user = make_user(org, "race-emp@acme.test")
    emp = make_profile(org, emp_user, "R001")
    mgr_user = make_user(org, "race-mgr@acme.test")
    mgr_user.groups.add(Group.objects.get(name=ROLE_MANAGER))
    mgr = make_profile(org, mgr_user, "R002")
    emp.manager = mgr
    emp.save(update_fields=["manager"])
    hr = make_user(org, "race-hr@acme.test")
    hr.groups.add(Group.objects.get(name=ROLE_HR))
    make_profile(org, hr, "R003")
    return emp_user, mgr_user, hr


def ts(hour, minute=0):
    return datetime(2026, 9, 25, hour, minute, tzinfo=UTC)


class TestConcurrentEntries:
    def test_overlapping_creates_single_winner(self, cast, org):
        emp_user, _, _ = cast
        sheet = get_or_create_sheet(emp_user, WEEK)
        # Same employee, same instant, two connections — the profile lock
        # serializes; the loser must see the committed row and be rejected.
        results, errors = run_in_threads(
            lambda: create_entries(
                sheet.pk,
                emp_user,
                {
                    "work_date": date(2026, 9, 25),
                    "start_at": ts(9),
                    "end_at": ts(12),
                    "break_minutes": 0,
                    "description": "A",
                },
            ),
            lambda: create_entries(
                sheet.pk,
                emp_user,
                {
                    "work_date": date(2026, 9, 25),
                    "start_at": ts(10),
                    "end_at": ts(13),
                    "break_minutes": 0,
                    "description": "B",
                },
            ),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert sum(isinstance(e, ValidationError) for e in errors) == 1
        assert TimeEntry.objects.filter(employee__user=emp_user).count() == 1

    def test_concurrent_edit_stale_version_one_wins(self, cast, org):
        emp_user, _, _ = cast
        sheet = get_or_create_sheet(emp_user, WEEK)
        entry = create_entries(
            sheet.pk,
            emp_user,
            {
                "work_date": date(2026, 9, 25),
                "start_at": ts(9),
                "end_at": ts(12),
                "break_minutes": 0,
            },
        )[0]
        sheet.refresh_from_db()
        patch = {
            "start_at": ts(9, 15),
            "end_at": ts(12),
            "break_minutes": 0,
            "expected_version": sheet.version,
        }
        results, errors = run_in_threads(
            lambda: update_entry(entry.pk, emp_user, dict(patch)),
            lambda: update_entry(entry.pk, emp_user, dict(patch)),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert sum(isinstance(e, ConflictError) for e in errors) == 1
        entry.refresh_from_db()
        assert entry.start_at == ts(9, 15)


class TestConcurrentTransitions:
    def _submitted_sheet(self, emp_user):
        sheet = get_or_create_sheet(emp_user, WEEK)
        create_entries(
            sheet.pk,
            emp_user,
            {
                "work_date": date(2026, 9, 25),
                "start_at": ts(9),
                "end_at": ts(17),
                "break_minutes": 0,
            },
        )
        submit_day(sheet.pk, date(2026, 9, 25), emp_user)
        submit_sheet(sheet.pk, emp_user)
        sheet.refresh_from_db()
        return sheet

    def test_duplicate_week_submit_single_outcome(self, cast, org):
        emp_user, _, _ = cast
        sheet = get_or_create_sheet(emp_user, WEEK)
        create_entries(
            sheet.pk,
            emp_user,
            {
                "work_date": date(2026, 9, 25),
                "start_at": ts(9),
                "end_at": ts(17),
                "break_minutes": 0,
            },
        )
        submit_day(sheet.pk, date(2026, 9, 25), emp_user)
        results, errors = run_in_threads(
            lambda: submit_sheet(sheet.pk, emp_user),
            lambda: submit_sheet(sheet.pk, emp_user),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert sum(isinstance(e, ConflictError) for e in errors) == 1
        sheet.refresh_from_db()
        assert sheet.cycle == 1
        assert sheet.status == Timesheet.Status.PENDING_MANAGER

    def test_duplicate_day_submit_single_outcome(self, cast, org):
        emp_user, _, _ = cast
        sheet = get_or_create_sheet(emp_user, WEEK)
        create_entries(
            sheet.pk,
            emp_user,
            {
                "work_date": date(2026, 9, 25),
                "start_at": ts(9),
                "end_at": ts(17),
                "break_minutes": 0,
            },
        )
        results, errors = run_in_threads(
            lambda: submit_day(sheet.pk, date(2026, 9, 25), emp_user),
            lambda: submit_day(sheet.pk, date(2026, 9, 25), emp_user),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert sum(isinstance(e, ConflictError) for e in errors) == 1
        day = WorkDay.objects.get(timesheet=sheet, work_date=date(2026, 9, 25))
        assert day.status == WorkDay.Status.SUBMITTED
        assert day.version == 2  # created at 1 — exactly one submit increment

    def test_concurrent_review_decisions_single_outcome(self, cast, org):
        emp_user, mgr_user, _ = cast
        sheet = self._submitted_sheet(emp_user)
        # Same reviewer racing approve vs return — the sheet lock serializes;
        # the loser sees a non-pending stage or a new reviewer and fails.
        results, errors = run_in_threads(
            lambda: review_sheet(sheet.pk, mgr_user, "approve", expected_version=sheet.version),
            lambda: review_sheet(
                sheet.pk,
                mgr_user,
                "return",
                reason="fix it",
                expected_version=sheet.version,
            ),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert sum(isinstance(e, (ConflictError, PermissionDenied)) for e in errors) == 1
        sheet.refresh_from_db()
        # Exactly one decision recorded — either advanced or returned, not both.
        assert sheet.status in (
            Timesheet.Status.PENDING_HR,
            Timesheet.Status.APPROVED,
            Timesheet.Status.RETURNED,
        )
        assert sheet.events.count() == 2  # submitted + exactly one decision

    def test_duplicate_period_creation_same_sheet(self, cast, org):
        emp_user, _, _ = cast
        results, errors = run_in_threads(
            lambda: get_or_create_sheet(emp_user, WEEK),
            lambda: get_or_create_sheet(emp_user, WEEK),
        )
        assert errors == [None, None]
        assert results[0].pk == results[1].pk
        assert Timesheet.objects.filter(employee__user=emp_user).count() == 1
