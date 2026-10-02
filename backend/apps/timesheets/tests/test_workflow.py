"""T009 — sheet submission, two-stage review, return/resubmit, self-review,
stale-version, and immutability tests (FR-003..FR-007)."""

from datetime import date

import pytest

from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.timesheets.models import TimesheetEvent, WorkDay
from apps.timesheets.services import get_or_create_sheet

pytestmark = pytest.mark.django_db

TS = "/api/v1/timesheets/"
D = "2026-09-14"  # Monday


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


def payload(**kw):
    return {
        "work_date": D,
        "start_at": "2026-09-14T09:00:00Z",
        "end_at": "2026-09-14T17:00:00Z",
        "break_minutes": 30,
        **kw,
    }


@pytest.fixture
def emp(org, manager, hr_user):
    user = make_user(org, "emp@acme.test")
    make_profile(org, user, "E500", manager=manager.profile)
    return user


@pytest.fixture
def submitted_sheet(api_client, emp):
    """Sheet with one submitted day."""
    c = authed(api_client, emp)
    sheet = get_or_create_sheet(emp, date(2026, 9, 14))
    assert c.post(f"{TS}{sheet.id}/entries/", payload()).status_code == 201
    assert c.post(f"{TS}{sheet.id}/days/{D}/submit/").status_code == 200
    return sheet


class TestSubmission:
    def test_week_submit_routes_to_manager(self, api_client, emp, manager, submitted_sheet):
        c = authed(api_client, emp)
        resp = c.post(f"{TS}{submitted_sheet.id}/submit/", {})
        assert resp.status_code == 200, resp.json()
        body = resp.json()
        assert body["status"] == "pending_manager"
        assert body["reviewer_email"] == manager.email
        submitted_sheet.refresh_from_db()
        assert submitted_sheet.cycle == 1
        assert submitted_sheet.route_snapshot["manager_id"] == str(manager.id)

    def test_no_submitted_days_rejected(self, api_client, emp):
        c = authed(api_client, emp)
        sheet = get_or_create_sheet(emp, date(2026, 9, 14))
        resp = c.post(f"{TS}{sheet.id}/submit/", {})
        assert resp.status_code == 400

    def test_draft_day_with_entries_blocks_submit(self, api_client, emp, submitted_sheet):
        """Entries on an unsubmitted day must be submitted or voided first."""
        c = authed(api_client, emp)
        c.post(
            f"{TS}{submitted_sheet.id}/entries/",
            payload(
                work_date="2026-09-15",
                start_at="2026-09-15T09:00:00Z",
                end_at="2026-09-15T17:00:00Z",
            ),
        )
        resp = c.post(f"{TS}{submitted_sheet.id}/submit/", {})
        assert resp.status_code == 400
        assert "2026-09-15" in str(resp.json())

    def test_entries_locked_after_submit(self, api_client, emp, submitted_sheet):
        c = authed(api_client, emp)
        assert c.post(f"{TS}{submitted_sheet.id}/submit/", {}).status_code == 200
        resp = c.post(
            f"{TS}{submitted_sheet.id}/entries/",
            payload(
                work_date="2026-09-16",
                start_at="2026-09-16T09:00:00Z",
                end_at="2026-09-16T17:00:00Z",
            ),
        )
        assert resp.status_code == 409
        resp = c.post(f"{TS}{submitted_sheet.id}/submit/", {})
        assert resp.status_code == 409

    def test_self_review_fallback_to_hr(self, api_client, org, hr_user):
        """Owner is their own manager fallback path: eligible HR reviews."""
        lone = make_user(org, "lone@acme.test")
        make_profile(org, lone, "E900")  # no manager
        c = authed(api_client, lone)
        sheet = get_or_create_sheet(lone, date(2026, 9, 14))
        assert c.post(f"{TS}{sheet.id}/entries/", payload()).status_code == 201
        assert c.post(f"{TS}{sheet.id}/days/{D}/submit/").status_code == 200
        resp = c.post(f"{TS}{sheet.id}/submit/", {})
        assert resp.status_code == 200
        # no manager -> pending_hr straight away
        assert resp.json()["status"] == "pending_hr"
        assert resp.json()["reviewer_email"] == hr_user.email

    def test_no_reviewers_blocks_submit(self, api_client, org):
        sole = make_user(org, "sole@acme.test")
        make_profile(org, sole, "E901")
        # make sole the only HR (fallback for self) — self can't review
        from django.contrib.auth.models import Group

        from apps.accounts.permissions import ROLE_HR

        sole.groups.add(Group.objects.get(name=ROLE_HR))
        c = authed(api_client, sole)
        sheet = get_or_create_sheet(sole, date(2026, 9, 14))
        assert c.post(f"{TS}{sheet.id}/entries/", payload()).status_code == 201
        assert c.post(f"{TS}{sheet.id}/days/{D}/submit/").status_code == 200
        resp = c.post(f"{TS}{sheet.id}/submit/", {})
        assert resp.status_code == 400


class TestTwoStageReview:
    def test_full_manager_then_hr_approve(self, api_client, emp, manager, hr_user, submitted_sheet):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        # manager approves → pending_hr
        m = authed(api_client, manager)
        resp = m.post(f"{TS}{submitted_sheet.id}/approve/", {})
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending_hr"
        assert resp.json()["reviewer_email"] == hr_user.email
        # HR approves → approved; days approved
        h = authed(api_client, hr_user)
        resp = h.post(f"{TS}{submitted_sheet.id}/approve/", {})
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"
        day = WorkDay.objects.get(timesheet=submitted_sheet, work_date=date(2026, 9, 14))
        assert day.status == WorkDay.Status.APPROVED

    def test_employee_cannot_approve(self, api_client, emp, submitted_sheet):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        resp = api_client.post(f"{TS}{submitted_sheet.id}/approve/", {})
        assert resp.status_code in (403, 404)
        submitted_sheet.refresh_from_db()
        assert submitted_sheet.status == "pending_manager"

    def test_wrong_stage_reviewer_rejected(
        self, api_client, emp, manager, hr_user, submitted_sheet
    ):
        """HR cannot approve during the manager stage (stage order)."""
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        h = authed(api_client, hr_user)
        resp = h.post(f"{TS}{submitted_sheet.id}/approve/", {})
        assert resp.status_code == 403
        submitted_sheet.refresh_from_db()
        assert submitted_sheet.status == "pending_manager"

    def test_hr_fallback_approval_finalizes(self, api_client, org, hr_user):
        """No manager → HR fallback's single approval is final (D-004)."""
        lone = make_user(org, "lone@acme.test")
        make_profile(org, lone, "E902")
        c = authed(api_client, lone)
        sheet = get_or_create_sheet(lone, date(2026, 9, 14))
        c.post(f"{TS}{sheet.id}/entries/", payload())
        c.post(f"{TS}{sheet.id}/days/{D}/submit/")
        assert c.post(f"{TS}{sheet.id}/submit/", {}).json()["status"] == "pending_hr"
        h = authed(api_client, hr_user)
        resp = h.post(f"{TS}{sheet.id}/approve/", {})
        assert resp.json()["status"] == "approved"

    def test_return_unlocks_week_and_reason_recorded(
        self, api_client, emp, manager, submitted_sheet
    ):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        m = authed(api_client, manager)
        resp = m.post(f"{TS}{submitted_sheet.id}/return/", {"reason": "fix Friday"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "returned"
        day = WorkDay.objects.get(timesheet=submitted_sheet, work_date=date(2026, 9, 14))
        assert day.status == WorkDay.Status.RETURNED
        # employee can edit again
        c = authed(api_client, emp)
        e = day.entries.first()
        resp = c.patch(
            f"{TS}{submitted_sheet.id}/entries/{e.id}/",
            {"break_minutes": 45},
        )
        assert resp.status_code == 200
        # reason in history
        events = c.get(f"{TS}{submitted_sheet.id}/history/").json()
        assert any(ev["event_type"] == "returned" and ev["reason"] == "fix Friday" for ev in events)

    def test_resubmit_increments_cycle(self, api_client, emp, manager, submitted_sheet):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        m = authed(api_client, manager)
        m.post(f"{TS}{submitted_sheet.id}/return/", {"reason": "again"})
        c = authed(api_client, emp)
        # returned day is treated as submitted on resubmit
        resp = c.post(f"{TS}{submitted_sheet.id}/submit/", {})
        assert resp.status_code == 200
        assert resp.json()["cycle"] == 2
        day = WorkDay.objects.get(timesheet=submitted_sheet, work_date=date(2026, 9, 14))
        assert day.status == WorkDay.Status.SUBMITTED

    def test_reject_terminal_and_reason_required(self, api_client, emp, manager, submitted_sheet):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        m = authed(api_client, manager)
        assert m.post(f"{TS}{submitted_sheet.id}/reject/", {}).status_code == 400
        resp = m.post(f"{TS}{submitted_sheet.id}/reject/", {"reason": "fraud"})
        assert resp.json()["status"] == "rejected"
        # terminal: no edits, no resubmit
        c = authed(api_client, emp)
        assert c.post(f"{TS}{submitted_sheet.id}/submit/", {}).status_code == 409
        assert (
            c.post(
                f"{TS}{submitted_sheet.id}/entries/",
                payload(
                    work_date="2026-09-16",
                    start_at="2026-09-16T09:00:00Z",
                    end_at="2026-09-16T17:00:00Z",
                ),
            ).status_code
            == 409
        )

    def test_stale_version_409(self, api_client, emp, manager, submitted_sheet):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        m = authed(api_client, manager)
        submitted_sheet.refresh_from_db()
        stale = submitted_sheet.version - 1
        resp = m.post(f"{TS}{submitted_sheet.id}/approve/", {"expected_version": stale})
        assert resp.status_code == 409

    def test_double_decision_conflict(self, api_client, emp, manager, hr_user, submitted_sheet):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        m = authed(api_client, manager)
        assert m.post(f"{TS}{submitted_sheet.id}/approve/", {}).status_code == 200
        # second approve attempt by same manager: no longer the reviewer
        resp = m.post(f"{TS}{submitted_sheet.id}/approve/", {})
        assert resp.status_code in (403, 409)
        assert (
            TimesheetEvent.objects.filter(
                sheet=submitted_sheet, event_type="approved_manager"
            ).count()
            == 1
        )


class TestReopen:
    def test_hr_reopens_approved(self, api_client, emp, manager, hr_user, submitted_sheet):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        authed(api_client, manager).post(f"{TS}{submitted_sheet.id}/approve/", {})
        authed(api_client, hr_user).post(f"{TS}{submitted_sheet.id}/approve/", {})
        h = authed(api_client, hr_user)
        resp = h.post(f"{TS}{submitted_sheet.id}/reopen/", {"reason": "payroll correction"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "returned"
        day = WorkDay.objects.get(timesheet=submitted_sheet, work_date=date(2026, 9, 14))
        assert day.status == WorkDay.Status.RETURNED

    def test_non_hr_cannot_reopen(self, api_client, emp, manager, hr_user, submitted_sheet):
        authed(api_client, emp).post(f"{TS}{submitted_sheet.id}/submit/", {})
        authed(api_client, manager).post(f"{TS}{submitted_sheet.id}/approve/", {})
        authed(api_client, hr_user).post(f"{TS}{submitted_sheet.id}/approve/", {})
        m = authed(api_client, manager)
        resp = m.post(f"{TS}{submitted_sheet.id}/reopen/", {"reason": "nope"})
        assert resp.status_code == 403
        submitted_sheet.refresh_from_db()
        assert submitted_sheet.status == "approved"
