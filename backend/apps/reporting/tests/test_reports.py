"""T006 — scoped report tests (FR-002, FR-003, FR-008). Dates are inclusive
local work dates; request reports key on submitted_at and exclude drafts
(D-009 2026-10-02)."""

from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from apps.conftest import TEST_PASSWORD, login

HOURS = "/api/v1/reports/working-hours/"
REQUESTS = "/api/v1/reports/requests/"

pytestmark = pytest.mark.django_db


def authed(user):
    c = APIClient()
    assert login(c, user, TEST_PASSWORD).status_code == 200
    return c


W = {"from": "2026-09-14", "to": "2026-09-20"}

# Requests key on submitted_at = the real submission instant (today) —
# the request window must cover today, not the synthetic work dates.
_today = date.today()
RW = {
    "from": (_today - timedelta(days=7)).isoformat(),
    "to": _today.isoformat(),
}


class TestWorkingHoursReport:
    def test_employee_own_rows_only(self, reporting_dataset):
        body = authed(reporting_dataset["emp1"]).get(HOURS, W).json()
        assert [r["employee_code"] for r in body["results"]] == ["E001"]
        row = body["results"][0]
        assert row["work_date"] == "2026-09-15"
        assert row["minutes"] == 450
        assert body["totals"]["minutes"] == 450
        # current-assignment labels (D-009)
        assert row["department"] == "Engineering"

    def test_manager_sees_team_not_org(self, reporting_dataset):
        body = authed(reporting_dataset["mgr"]).get(HOURS, W).json()
        codes = {r["employee_code"] for r in body["results"]}
        assert codes == {"E001"}  # emp2's sheet is pending, not approved
        assert body["totals"]["minutes"] == 450

    def test_status_filter_changes_rows(self, reporting_dataset):
        body = (
            authed(reporting_dataset["mgr"]).get(HOURS, {**W, "status": "pending_manager"}).json()
        )
        codes = {r["employee_code"] for r in body["results"]}
        assert codes == {"E002"}
        assert body["totals"]["minutes"] == 240

    def test_work_date_window_boundary(self, reporting_dataset):
        """Entries count by local work_date — a window ending the day before
        the entry returns empty, not the whole sheet's period."""
        body = (
            authed(reporting_dataset["emp1"])
            .get(HOURS, {"from": "2026-09-14", "to": "2026-09-14"})
            .json()
        )
        assert body["results"] == []
        assert body["totals"]["minutes"] == 0

    def test_hr_employee_filter_scoped(self, reporting_dataset):
        ds = reporting_dataset
        body = authed(ds["hr"]).get(HOURS, {**W, "employee": str(ds["emp2"].profile.pk)}).json()
        # emp2 has no approved minutes — empty is a valid result.
        assert body["results"] == []
        body = (
            authed(ds["hr"])
            .get(
                HOURS,
                {**W, "employee": str(ds["emp1"].profile.pk)},
            )
            .json()
        )
        assert body["totals"]["minutes"] == 450

    def test_employee_cannot_widen_scope_via_param(self, reporting_dataset):
        """Asking for a teammate's id never expands employee scope."""
        ds = reporting_dataset
        body = authed(ds["emp1"]).get(HOURS, {**W, "employee": str(ds["emp2"].profile.pk)}).json()
        codes = {r["employee_code"] for r in body["results"]}
        assert codes <= {"E001"}

    def test_foreign_employee_param_yields_empty(self, reporting_dataset, other_org):
        from apps.conftest import make_profile, make_user

        fu = make_user(other_org, "foreign@x.test")
        fp = make_profile(other_org, fu, "F1")
        body = authed(reporting_dataset["hr"]).get(HOURS, {**W, "employee": str(fp.pk)}).json()
        assert body["results"] == []

    def test_range_cap_enforced(self, reporting_dataset):
        resp = authed(reporting_dataset["hr"]).get(
            HOURS, {"from": "2025-01-01", "to": "2026-06-30"}
        )
        assert resp.status_code == 400

    def test_invalid_status_rejected(self, reporting_dataset):
        resp = authed(reporting_dataset["hr"]).get(HOURS, {**W, "status": "bogus"})
        assert resp.status_code == 400


class TestRequestsReport:
    def test_submitted_date_basis_excludes_drafts(self, reporting_dataset):
        """Drafts never appear in reports (D-009); rows key on submitted_at."""
        body = authed(reporting_dataset["hr"]).get(REQUESTS, RW).json()
        titles = {r["title"] for r in body["results"]}
        assert "question" not in titles  # the draft
        assert {
            "annual leave",
            "laptop",
            "sick",
            "monitor",
            "certificate",
        } == titles
        assert body["totals"]["count"] == 5

    def test_status_filter(self, reporting_dataset):
        body = authed(reporting_dataset["hr"]).get(REQUESTS, {**RW, "status": "rejected"}).json()
        assert [r["title"] for r in body["results"]] == ["monitor"]

    def test_type_filter(self, reporting_dataset):
        ds = reporting_dataset
        body = authed(ds["hr"]).get(REQUESTS, {**RW, "type": str(ds["types"]["leave"].pk)}).json()
        assert {r["title"] for r in body["results"]} == {"annual leave", "sick"}

    def test_manager_scope_is_direct_reports(self, reporting_dataset):
        body = authed(reporting_dataset["mgr"]).get(REQUESTS, RW).json()
        titles = {r["title"] for r in body["results"]}
        assert "certificate" not in titles  # lone is not a direct report
        assert len(titles) == 4

    def test_employee_scope_is_own_submitted(self, reporting_dataset):
        body = authed(reporting_dataset["emp1"]).get(REQUESTS, RW).json()
        titles = {r["title"] for r in body["results"]}
        assert titles == {"annual leave", "laptop"}  # draft excluded

    def test_window_before_submission_empty(self, reporting_dataset):
        body = (
            authed(reporting_dataset["hr"])
            .get(REQUESTS, {"from": "2026-08-01", "to": "2026-08-31"})
            .json()
        )
        assert body["results"] == []

    def test_ordering_allowlisted(self, reporting_dataset):
        body = (
            authed(reporting_dataset["hr"]).get(REQUESTS, {**RW, "ordering": "submitted_at"}).json()
        )
        assert body["results"]
        resp = authed(reporting_dataset["hr"]).get(
            REQUESTS, {**RW, "ordering": "employee__user__password"}
        )
        assert resp.status_code == 400
