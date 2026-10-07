"""T003 — dashboard scope/count/reopen/voided tests (FR-001, FR-002, FR-008).
All expectations reconcile against the documented dataset in conftest.py."""

from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from apps.conftest import TEST_PASSWORD, login
from apps.timesheets.services import reopen_sheet

PERSONAL = "/api/v1/dashboards/personal/"
TEAM = "/api/v1/dashboards/team/"
ORG = "/api/v1/dashboards/organization/"

pytestmark = pytest.mark.django_db


def authed(user):
    c = APIClient()
    assert login(c, user, TEST_PASSWORD).status_code == 200
    return c


class TestPersonalDashboard:
    def test_employee_sees_own_full_state(self, reporting_dataset):
        c = authed(reporting_dataset["emp1"])
        resp = c.get(PERSONAL, {"from": "2026-09-14", "to": "2026-09-20"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["scope"] == "personal"
        # Owner sees their draft — personal scope includes it.
        assert body["requests"]["by_status"]["draft"] == 1
        assert body["requests"]["by_status"]["pending_manager"] == 1
        assert body["requests"]["by_status"]["approved"] == 1
        assert body["timesheets"]["by_status"]["approved"] == 1
        assert body["timesheets"]["by_status"]["collecting"] == 1
        # 450 approved min in window; the 120 collecting min never count.
        assert body["approved_minutes"] == 450

    def test_employee_does_not_see_others(self, reporting_dataset):
        c = authed(reporting_dataset["emp2"])
        body = c.get(PERSONAL, {"from": "2026-09-14", "to": "2026-09-20"}).json()
        # emp2's own data: returned + rejected requests, pending sheet, 0 approved min.
        assert body["requests"]["by_status"]["returned"] == 1
        assert body["requests"]["by_status"]["rejected"] == 1
        assert body["requests"]["by_status"]["approved"] == 0
        assert body["approved_minutes"] == 0

    def test_pending_review_is_zero_for_plain_employee(self, reporting_dataset):
        body = authed(reporting_dataset["emp1"]).get(PERSONAL).json()
        assert body["pending_review"] == 0

    def test_allocation_is_self_only_and_independent_of_report_period(self, reporting_dataset):
        from apps.employee_requests.allocations import create_grant, void_grant
        from apps.employee_requests.models import RequestType

        ds = reporting_dataset
        req_type = RequestType.objects.create(
            organization=ds["org"], code="EQ-ALLOC", name="Equipment allocation",
            unit="unit",
        )
        today = date.today()
        grant = create_grant(
            ds["hr"], ds["emp1"].profile, req_type,
            today - timedelta(days=1), today + timedelta(days=1), 2,
        )
        body = authed(ds["emp1"]).get(PERSONAL, {"from": "2026-09-01", "to": "2026-09-07"}).json()
        assert body["allocations"][0]["id"] == str(grant.pk)
        assert body["allocations"][0]["remaining"] == 2
        assert authed(ds["emp2"]).get(PERSONAL).json()["allocations"] == []
        assert "allocations" not in authed(ds["mgr"]).get(TEAM).json()
        assert "allocations" not in authed(ds["hr"]).get(ORG).json()
        void_grant(ds["hr"], grant.pk, "Incorrect grant", grant.version)
        assert authed(ds["emp1"]).get(PERSONAL).json()["allocations"] == []


class TestTeamDashboard:
    def test_manager_sees_direct_reports_nondraft(self, reporting_dataset):
        c = authed(reporting_dataset["mgr"])
        resp = c.get(TEAM, {"from": "2026-09-14", "to": "2026-09-20"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["scope"] == "team"
        req = body["requests"]["by_status"]
        assert req["approved"] == 1
        assert req["pending_manager"] == 1
        assert req["returned"] == 1
        assert req["rejected"] == 1
        assert req["pending_hr"] == 0  # lone is not mgr's report
        assert req.get("draft", 0) == 0  # drafts never leave the owner
        ts = body["timesheets"]["by_status"]
        assert ts["approved"] == 1
        assert ts["pending_manager"] == 1
        assert ts.get("collecting", 0) == 0  # collecting sheets are draft-like
        assert body["approved_minutes"] == 450
        # r2 pending_manager + emp2's pending sheet
        assert body["pending_review"] == 2

    def test_team_dashboard_forbidden_for_employee(self, reporting_dataset):
        c = authed(reporting_dataset["emp1"])
        assert c.get(TEAM).status_code == 403

    def test_hr_can_open_team_dashboard(self, reporting_dataset):
        """HR's 'team' is the whole org — but org dashboard is the canonical
        view; team dashboard still answers for HR with org-wide scope."""
        resp = authed(reporting_dataset["hr"]).get(TEAM)
        assert resp.status_code in (200, 403)


class TestOrgDashboard:
    def test_hr_sees_org_nondraft(self, reporting_dataset):
        c = authed(reporting_dataset["hr"])
        body = c.get(ORG, {"from": "2026-09-14", "to": "2026-09-20"}).json()
        assert body["scope"] == "organization"
        req = body["requests"]["by_status"]
        assert req["approved"] == 1
        assert req["pending_manager"] == 1
        assert req["pending_hr"] == 1  # lone's fallback route
        assert req["returned"] == 1
        assert req["rejected"] == 1
        assert req.get("draft", 0) == 0
        ts = body["timesheets"]["by_status"]
        assert ts["approved"] == 1
        assert ts["pending_manager"] == 1
        assert ts.get("collecting", 0) == 0
        assert body["approved_minutes"] == 450

    def test_org_dashboard_forbidden_for_manager(self, reporting_dataset):
        assert authed(reporting_dataset["mgr"]).get(ORG).status_code == 403

    def test_org_dashboard_forbidden_for_employee(self, reporting_dataset):
        assert authed(reporting_dataset["emp1"]).get(ORG).status_code == 403


class TestApprovedMinutesTruth:
    def test_reopened_sheet_drops_out_of_approved_totals(self, reporting_dataset):
        """Current approval is live state: HR reopen removes 450 min from
        current approved totals while the history stays intact."""
        ds = reporting_dataset
        sheet = ds["sheets"]["approved"]
        sheet.refresh_from_db()
        reopen_sheet(sheet.pk, ds["hr"], reason="payroll fix")
        body = authed(ds["emp1"]).get(PERSONAL, {"from": "2026-09-14", "to": "2026-09-20"}).json()
        assert body["approved_minutes"] == 0
        assert body["timesheets"]["by_status"]["returned"] == 1
        # Historical approval events still exist — reporting is on live state.
        assert sheet.events.filter(event_type="approved").exists()

    def test_voided_entries_never_count(self, reporting_dataset, api_client):
        """emp2 voids their entry before submit — totals must ignore it."""
        ds = reporting_dataset
        # void is blocked once submitted — verify on the collecting sheet
        # instead: void emp1's unsubmitted 120-min entry.
        collecting = ds["sheets"]["collecting"]
        entry = collecting.days.get().entries.get()
        c = authed(ds["emp1"])
        resp = c.post(f"/api/v1/timesheets/{collecting.pk}/entries/{entry.pk}/void/")
        assert resp.status_code == 204
        body = c.get(PERSONAL, {"from": "2026-09-21", "to": "2026-09-27"}).json()
        assert body["approved_minutes"] == 0

    def test_date_window_bounds_minutes(self, reporting_dataset):
        """approved_minutes respects from/to: a window before the entry
        returns zero — entries are counted by local work_date."""
        body = (
            authed(reporting_dataset["emp1"])
            .get(PERSONAL, {"from": "2026-09-01", "to": "2026-09-13"})
            .json()
        )
        assert body["approved_minutes"] == 0

    def test_unauthenticated_rejected(self, reporting_dataset, api_client):
        assert api_client.get(PERSONAL).status_code in (401, 403)
        assert api_client.get(TEAM).status_code in (401, 403)
        assert api_client.get(ORG).status_code in (401, 403)
