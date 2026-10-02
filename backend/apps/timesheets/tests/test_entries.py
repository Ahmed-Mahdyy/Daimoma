"""T005 — entry create/update/void, ownership, overlap, future-time, window
flag+reason, and daily-submission lock tests (FR-001, FR-002, FR-003)."""

from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.timesheets.models import WorkDay
from apps.timesheets.services import get_or_create_sheet

pytestmark = pytest.mark.django_db

TS = "/api/v1/timesheets/"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


@pytest.fixture
def emp(org, manager):
    user = make_user(org, "emp@acme.test")
    make_profile(org, user, "E500", manager=manager.profile)
    return user


@pytest.fixture
def sheet(emp):
    return get_or_create_sheet(emp, date(2026, 9, 14))  # Mon Oct 5 week


def entry_payload(**kw):
    # 2026-09-14 was a Monday; use a past fixed window.
    return {
        "work_date": "2026-09-14",
        "start_at": "2026-09-14T09:00:00Z",
        "end_at": "2026-09-14T17:00:00Z",
        "break_minutes": 30,
        "description": "feature work",
        **kw,
    }


class TestCreate:
    def test_create_entry_computes_minutes(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        resp = c.post(f"{TS}{sheet.id}/entries/", entry_payload())
        assert resp.status_code == 201, resp.json()
        body = resp.json()
        assert len(body) == 1
        assert body[0]["duration_minutes"] == 450  # 8h - 30m break
        assert body[0]["work_date"] == "2026-09-14"
        assert body[0]["window_flag"] is False

    def test_overlap_same_day_rejected(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        assert c.post(f"{TS}{sheet.id}/entries/", entry_payload()).status_code == 201
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                start_at="2026-09-14T12:00:00Z", end_at="2026-09-14T18:00:00Z", break_minutes=0
            ),
        )
        assert resp.status_code == 400

    def test_overlap_across_days_rejected(self, api_client, emp, sheet):
        """Overlap is global across the employee's active entries."""
        c = authed(api_client, emp)
        assert (
            c.post(
                f"{TS}{sheet.id}/entries/",
                entry_payload(
                    start_at="2026-09-14T22:00:00Z", end_at="2026-09-15T02:00:00Z", break_minutes=0
                ),
            ).status_code
            == 201
        )
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                work_date="2026-09-15",
                start_at="2026-09-15T01:00:00Z",
                end_at="2026-09-15T09:00:00Z",
                break_minutes=0,
            ),
        )
        assert resp.status_code == 400

    def test_midnight_split_creates_two_rows(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        # 22:00→02:00 UTC = crosses UTC midnight (org tz is UTC)
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                start_at="2026-09-14T22:00:00Z", end_at="2026-09-15T02:00:00Z", break_minutes=0
            ),
        )
        assert resp.status_code == 201, resp.json()
        rows = resp.json()
        assert len(rows) == 2
        assert {r["work_date"] for r in rows} == {"2026-09-14", "2026-09-15"}
        assert sum(r["duration_minutes"] for r in rows) == 240

    def test_break_on_split_needs_segment_breaks(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                start_at="2026-09-14T22:00:00Z", end_at="2026-09-15T02:00:00Z", break_minutes=30
            ),
        )
        assert resp.status_code == 400
        payload = entry_payload(
            start_at="2026-09-14T22:00:00Z",
            end_at="2026-09-15T02:00:00Z",
            segment_breaks=[15, 15],
        )
        payload.pop("break_minutes")
        resp = c.post(f"{TS}{sheet.id}/entries/", payload)
        assert resp.status_code == 201
        assert sum(r["break_minutes"] for r in resp.json()) == 30

    def test_future_end_rejected(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        future = timezone.now() + timedelta(days=30)
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                work_date=str(future.date()),
                start_at=future.isoformat(),
                end_at=(future + timedelta(hours=8)).isoformat(),
            ),
        )
        assert resp.status_code == 400
        assert "future" in str(resp.json()).lower()

    def test_break_not_less_than_elapsed(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(end_at="2026-09-14T10:00:00Z", break_minutes=60),
        )
        assert resp.status_code == 400

    def test_date_outside_period_rejected(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                work_date="2026-09-21",
                start_at="2026-09-21T09:00:00Z",
                end_at="2026-09-21T17:00:00Z",
            ),
        )
        assert resp.status_code == 400


class TestWindowFlag:
    def test_out_of_window_requires_reason(self, api_client, org, emp, sheet):
        org.work_earliest_start = "08:00"
        org.work_latest_end = "20:00"
        org.save()
        c = authed(api_client, emp)
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                start_at="2026-09-14T06:00:00Z", end_at="2026-09-14T10:00:00Z", break_minutes=0
            ),
        )
        assert resp.status_code == 400
        assert "window_reason" in resp.json()["field_errors"]

    def test_out_of_window_with_reason_flagged(self, api_client, org, emp, sheet):
        org.work_earliest_start = "08:00"
        org.save()
        c = authed(api_client, emp)
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                start_at="2026-09-14T06:00:00Z",
                end_at="2026-09-14T10:00:00Z",
                break_minutes=0,
                window_reason="on-call incident",
            ),
        )
        assert resp.status_code == 201
        assert resp.json()[0]["window_flag"] is True
        assert resp.json()[0]["window_reason"] == "on-call incident"

    def test_over_daily_max_flagged(self, api_client, org, emp, sheet):
        org.work_max_daily_minutes = 300  # 5h
        org.save()
        c = authed(api_client, emp)
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(window_reason="double shift"),
        )
        assert resp.status_code == 201
        assert resp.json()[0]["window_flag"] is True


class TestDaySubmission:
    def _add(self, c, sheet, **kw):
        resp = c.post(f"{TS}{sheet.id}/entries/", entry_payload(**kw))
        assert resp.status_code == 201, resp.json()
        return resp.json()

    def test_submit_day_locks_entries(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        self._add(c, sheet)
        resp = c.post(f"{TS}{sheet.id}/days/2026-09-14/submit/")
        assert resp.status_code == 200
        day = WorkDay.objects.get(timesheet=sheet, work_date=date(2026, 9, 14))
        assert day.status == WorkDay.Status.SUBMITTED
        # new entries on a submitted day are rejected
        resp = c.post(
            f"{TS}{sheet.id}/entries/",
            entry_payload(
                start_at="2026-09-14T18:00:00Z", end_at="2026-09-14T19:00:00Z", break_minutes=0
            ),
        )
        assert resp.status_code == 409

    def test_empty_day_submit_rejected(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        resp = c.post(f"{TS}{sheet.id}/days/2026-09-14/submit/")
        assert resp.status_code == 400

    def test_double_submit_conflict(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        self._add(c, sheet)
        assert c.post(f"{TS}{sheet.id}/days/2026-09-14/submit/").status_code == 200
        assert c.post(f"{TS}{sheet.id}/days/2026-09-14/submit/").status_code == 409


class TestUpdateVoid:
    def _mk(self, c, sheet, **kw):
        resp = c.post(f"{TS}{sheet.id}/entries/", entry_payload(**kw))
        assert resp.status_code == 201
        return resp.json()[0]

    def test_patch_recomputes_minutes(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        e = self._mk(c, sheet)
        resp = c.patch(
            f"{TS}{sheet.id}/entries/{e['id']}/",
            {"end_at": "2026-09-14T18:00:00Z"},
        )
        assert resp.status_code == 200
        assert resp.json()["duration_minutes"] == 510

    def test_patch_overlap_rejected(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        self._mk(c, sheet, end_at="2026-09-14T12:00:00Z")
        e2 = self._mk(c, sheet, start_at="2026-09-14T13:00:00Z", end_at="2026-09-14T17:00:00Z")
        resp = c.patch(
            f"{TS}{sheet.id}/entries/{e2['id']}/",
            {"start_at": "2026-09-14T11:00:00Z"},
        )
        assert resp.status_code == 400

    def test_void_removes_from_totals(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        e = self._mk(c, sheet)
        resp = c.post(f"{TS}{sheet.id}/entries/{e['id']}/void/")
        assert resp.status_code == 204
        sheet.refresh_from_db()
        detail = c.get(f"{TS}{sheet.id}/").json()
        assert detail["total_minutes"] == 0
        assert detail["days"][0]["entries"][0]["voided_at"] is not None

    def test_stale_version_conflict(self, api_client, emp, sheet):
        c = authed(api_client, emp)
        e = self._mk(c, sheet)
        sheet.refresh_from_db()
        resp = c.patch(
            f"{TS}{sheet.id}/entries/{e['id']}/",
            {"break_minutes": 0, "expected_version": sheet.version - 1},
        )
        assert resp.status_code == 409


class TestScoping:
    def test_entries_on_foreign_sheet_404(self, api_client, org, other_org, emp, sheet):
        outsider = make_user(other_org, "outsider@x.test")
        make_profile(other_org, outsider, "X1")
        c = authed(api_client, outsider)
        resp = c.post(f"{TS}{sheet.id}/entries/", entry_payload())
        assert resp.status_code == 404

    def test_manager_cannot_edit_employee_sheet(self, api_client, org, manager, emp, sheet):
        c = authed(api_client, manager)
        # manager can't even see a collecting sheet
        assert c.get(f"{TS}{sheet.id}/").status_code == 404
        resp = c.post(f"{TS}{sheet.id}/entries/", entry_payload())
        assert resp.status_code == 404
