"""T014 — HR-only reopening: reason requirement, non-final guard, stale
versions, history preservation, approved-total exclusion (FR-006, FR-008)."""

from datetime import date

import pytest

from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.timesheets.models import TimesheetEvent, WorkDay
from apps.timesheets.services import get_or_create_sheet

pytestmark = pytest.mark.django_db

TS = "/api/v1/timesheets/"
D = "2026-09-14"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


@pytest.fixture
def emp(org, manager, hr_user):
    user = make_user(org, "emp@acme.test")
    make_profile(org, user, "E700", manager=manager.profile)
    return user


@pytest.fixture
def approved_sheet(api_client, emp, manager, hr_user):
    c = authed(api_client, emp)
    sheet = get_or_create_sheet(emp, date(2026, 9, 14))
    assert (
        c.post(
            f"{TS}{sheet.id}/entries/",
            {
                "work_date": D,
                "start_at": "2026-09-14T09:00:00Z",
                "end_at": "2026-09-14T17:00:00Z",
                "break_minutes": 30,
            },
        ).status_code
        == 201
    )
    assert c.post(f"{TS}{sheet.id}/days/{D}/submit/").status_code == 200
    sheet.refresh_from_db()
    assert c.post(f"{TS}{sheet.id}/submit/", {"expected_version": sheet.version}).status_code == 200
    sheet.refresh_from_db()
    m = authed(api_client, manager)
    assert (
        m.post(f"{TS}{sheet.id}/approve/", {"expected_version": sheet.version}).status_code == 200
    )
    sheet.refresh_from_db()
    h = authed(api_client, hr_user)
    assert (
        h.post(f"{TS}{sheet.id}/approve/", {"expected_version": sheet.version}).status_code == 200
    )
    sheet.refresh_from_db()
    assert sheet.status == "approved"
    return sheet


class TestReopenGuards:
    def test_employee_cannot_reopen(self, api_client, emp, approved_sheet):
        c = authed(api_client, emp)
        resp = c.post(f"{TS}{approved_sheet.id}/reopen/", {"reason": "r"})
        assert resp.status_code == 403
        approved_sheet.refresh_from_db()
        assert approved_sheet.status == "approved"

    def test_manager_cannot_reopen(self, api_client, manager, approved_sheet):
        m = authed(api_client, manager)
        resp = m.post(f"{TS}{approved_sheet.id}/reopen/", {"reason": "r"})
        assert resp.status_code == 403

    def test_reason_required(self, api_client, hr_user, approved_sheet):
        h = authed(api_client, hr_user)
        resp = h.post(f"{TS}{approved_sheet.id}/reopen/", {"reason": "  "})
        assert resp.status_code == 400
        approved_sheet.refresh_from_db()
        assert approved_sheet.status == "approved"

    def test_pending_sheet_cannot_be_reopened(self, api_client, emp, manager, hr_user):
        c = authed(api_client, emp)
        sheet = get_or_create_sheet(emp, date(2026, 9, 21))
        assert (
            c.post(
                f"{TS}{sheet.id}/entries/",
                {
                    "work_date": "2026-09-21",
                    "start_at": "2026-09-21T09:00:00Z",
                    "end_at": "2026-09-21T17:00:00Z",
                    "break_minutes": 0,
                },
            ).status_code
            == 201
        )
        assert c.post(f"{TS}{sheet.id}/days/2026-09-21/submit/").status_code == 200
        sheet.refresh_from_db()
        assert (
            c.post(f"{TS}{sheet.id}/submit/", {"expected_version": sheet.version}).status_code
            == 200
        )
        h = authed(api_client, hr_user)
        resp = h.post(f"{TS}{sheet.id}/reopen/", {"reason": "early"})
        assert resp.status_code == 409

    def test_stale_version_conflict(self, api_client, hr_user, approved_sheet):
        h = authed(api_client, hr_user)
        resp = h.post(
            f"{TS}{approved_sheet.id}/reopen/",
            {"reason": "fix", "expected_version": approved_sheet.version + 9},
        )
        assert resp.status_code == 409


class TestReopenEffects:
    def test_history_preserved_and_editable(self, api_client, emp, hr_user, approved_sheet):
        h = authed(api_client, hr_user)
        approved_sheet.refresh_from_db()
        resp = h.post(
            f"{TS}{approved_sheet.id}/reopen/",
            {"reason": "payroll correction", "expected_version": approved_sheet.version},
        )
        assert resp.status_code == 200, resp.json()
        # Approval history intact + reopen event recorded with reason.
        types = list(
            TimesheetEvent.objects.filter(sheet=approved_sheet)
            .order_by("version")
            .values_list("event_type", flat=True)
        )
        assert "approved_manager" in types
        assert "approved" in types
        reopen_evt = TimesheetEvent.objects.get(sheet=approved_sheet, event_type="reopened")
        assert reopen_evt.reason == "payroll correction"
        # Days editable again; employee can add an entry.
        day = WorkDay.objects.get(timesheet=approved_sheet, work_date=date(2026, 9, 14))
        assert day.status == WorkDay.Status.RETURNED
        c = authed(api_client, emp)
        assert (
            c.post(
                f"{TS}{approved_sheet.id}/entries/",
                {
                    "work_date": "2026-09-15",
                    "start_at": "2026-09-15T09:00:00Z",
                    "end_at": "2026-09-15T12:00:00Z",
                    "break_minutes": 0,
                },
            ).status_code
            == 201
        )

    def test_reopened_sheet_excluded_from_approved_list(
        self, api_client, emp, hr_user, approved_sheet
    ):
        """A reopened sheet no longer counts as currently approved."""
        h = authed(api_client, hr_user)
        h.post(f"{TS}{approved_sheet.id}/reopen/", {"reason": "correction"})
        resp = h.get(f"{TS}?status=approved")
        ids = [s["id"] for s in resp.json()["results"]]
        assert str(approved_sheet.id) not in ids
        resp = h.get(f"{TS}?status=returned")
        ids = [s["id"] for s in resp.json()["results"]]
        assert str(approved_sheet.id) in ids

    def test_reopened_sheet_resubmits_as_new_cycle(
        self, api_client, emp, manager, hr_user, approved_sheet
    ):
        h = authed(api_client, hr_user)
        h.post(f"{TS}{approved_sheet.id}/reopen/", {"reason": "correction"})
        approved_sheet.refresh_from_db()
        assert approved_sheet.cycle == 1
        c = authed(api_client, emp)
        assert c.post(f"{TS}{approved_sheet.id}/days/{D}/submit/").status_code == 200
        approved_sheet.refresh_from_db()
        assert (
            c.post(
                f"{TS}{approved_sheet.id}/submit/",
                {"expected_version": approved_sheet.version},
            ).status_code
            == 200
        )
        approved_sheet.refresh_from_db()
        assert approved_sheet.cycle == 2
        # Cycle-1 approvals remain in history.
        assert TimesheetEvent.objects.filter(
            sheet=approved_sheet, cycle=1, event_type="approved"
        ).exists()
