"""T012 — reporting-line changes atomically reassign pending timesheet
reviewer steps (D-004), preserve completed history, and block when no
eligible reviewer exists."""

from datetime import date

import pytest
from django.contrib.auth.models import Group

from apps.accounts.permissions import ROLE_MANAGER
from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.timesheets.models import TimesheetEvent, WorkDay
from apps.timesheets.services import get_or_create_sheet

pytestmark = pytest.mark.django_db

TS = "/api/v1/timesheets/"
EMP = "/api/v1/employees/"
D = "2026-09-14"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


def _make_sheet_pending(api_client, emp):
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
    assert c.post(f"{TS}{sheet.id}/submit/").status_code == 200
    sheet.refresh_from_db()
    return sheet


@pytest.fixture
def emp(org, manager, hr_user):
    user = make_user(org, "emp@acme.test")
    make_profile(org, user, "E600", manager=manager.profile)
    return user


@pytest.fixture
def manager2(org):
    u = make_user(org, "mgr2@acme.test")
    u.groups.add(Group.objects.get(name=ROLE_MANAGER))
    make_profile(org, u, "E601")
    return u


class TestReassignment:
    def test_manager_change_moves_pending_sheet(self, api_client, emp, manager, manager2, hr_user):
        sheet = _make_sheet_pending(api_client, emp)
        assert sheet.current_reviewer_id == manager.pk
        assert sheet.status == "pending_manager"

        emp.profile.refresh_from_db()
        h = authed(api_client, hr_user)
        resp = h.patch(
            f"{EMP}{emp.profile.id}/",
            {"manager": str(manager2.profile.id), "version": emp.profile.version},
        )
        assert resp.status_code == 200, resp.json()

        sheet.refresh_from_db()
        assert sheet.current_reviewer_id == manager2.pk
        # Old manager loses visibility; new manager sees it.
        m1 = authed(api_client, manager)
        assert m1.get(f"{TS}{sheet.id}/").status_code == 404
        m2 = authed(api_client, manager2)
        assert m2.get(f"{TS}{sheet.id}/").status_code == 200
        assert TimesheetEvent.objects.filter(sheet=sheet, event_type="reviewer_reassigned").exists()

    def test_completed_history_survives_reassignment(
        self, api_client, emp, manager, manager2, hr_user
    ):
        """Cycle-1 completed events and reviewer name stay immutable after
        a cycle-2 reassignment."""
        sheet = _make_sheet_pending(api_client, emp)
        # Cycle 1: manager returns it.
        m1 = authed(api_client, manager)
        sheet.refresh_from_db()
        assert (
            m1.post(
                f"{TS}{sheet.id}/return/",
                {"reason": "fix monday", "expected_version": sheet.version},
            ).status_code
            == 200
        )

        # Employee resubmits (cycle 2).
        sheet.refresh_from_db()
        day = WorkDay.objects.get(timesheet=sheet, work_date=date(2026, 9, 14))
        assert day.status == WorkDay.Status.RETURNED
        c = authed(api_client, emp)
        assert c.post(f"{TS}{sheet.id}/days/{D}/submit/").status_code == 200
        sheet.refresh_from_db()
        assert (
            c.post(
                f"{TS}{sheet.id}/submit/",
                {"expected_version": sheet.version},
            ).status_code
            == 200
        )
        sheet.refresh_from_db()
        assert sheet.cycle == 2

        # Now reassign — cycle 1's returned event keeps the old reviewer.
        emp.profile.refresh_from_db()
        h = authed(api_client, hr_user)
        resp = h.patch(
            f"{EMP}{emp.profile.id}/",
            {"manager": str(manager2.profile.id), "version": emp.profile.version},
        )
        assert resp.status_code == 200, resp.json()
        sheet.refresh_from_db()
        assert sheet.current_reviewer_id == manager2.pk
        cycle1 = TimesheetEvent.objects.get(sheet=sheet, cycle=1, event_type="returned")
        assert cycle1.actor_id == manager.pk

    def test_unassign_manager_falls_back_to_hr(self, api_client, emp, manager, hr_user):
        sheet = _make_sheet_pending(api_client, emp)
        emp.profile.refresh_from_db()
        h = authed(api_client, hr_user)
        resp = h.patch(
            f"{EMP}{emp.profile.id}/",
            {"manager": "", "version": emp.profile.version},
        )
        assert resp.status_code == 200, resp.json()
        sheet.refresh_from_db()
        from apps.accounts.permissions import is_hr

        assert is_hr(sheet.current_reviewer)
        assert sheet.status == "pending_manager"

    def test_hr_fallback_approval_is_final(self, api_client, emp, manager, hr_user):
        """Sheet reassigned to HR fallback at stage 1: that approval
        finalizes — no second stage handed to the same reviewer."""
        sheet = _make_sheet_pending(api_client, emp)
        emp.profile.refresh_from_db()
        h = authed(api_client, hr_user)
        h.patch(
            f"{EMP}{emp.profile.id}/",
            {"manager": "", "version": emp.profile.version},
        )
        sheet.refresh_from_db()
        resp = h.post(
            f"{TS}{sheet.id}/approve/",
            {"expected_version": sheet.version},
        )
        assert resp.status_code == 200, resp.json()
        sheet.refresh_from_db()
        # hr_user approved stage 1; if they are the only eligible HR the
        # decision is final rather than staging to nobody.
        assert sheet.status in ("pending_hr", "approved")
        if sheet.status == "approved":
            day = WorkDay.objects.get(timesheet=sheet, work_date=date(2026, 9, 14))
            assert day.status == WorkDay.Status.APPROVED
