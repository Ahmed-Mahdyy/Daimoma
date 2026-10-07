"""T015 — scoped search/filter/order/pagination + history + type config
isolation. D-004/D-009: scope before count; allowlisted params only."""

from datetime import date

import pytest

from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.employee_requests.models import EmployeeRequest, RequestType
from apps.employee_requests.services import submit_request

pytestmark = pytest.mark.django_db

LIST = "/api/v1/requests/"
TYPES = "/api/v1/request-types/"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


def make_draft(org, profile, req_type, **kw):
    defaults = dict(organization=org, employee=profile, type=req_type, title="Req", description="d")
    return EmployeeRequest.objects.create(**{**defaults, **kw})


@pytest.fixture
def report(org, manager):
    user = make_user(org, "report@acme.test")
    make_profile(org, user, "E100", manager=manager.profile)
    return user


@pytest.fixture
def report2(org, manager):
    user = make_user(org, "report2@acme.test")
    make_profile(org, user, "E101", manager=manager.profile)
    return user


def submitted(org, profile, req_type, title):
    req = make_draft(
        org, profile, req_type, title=title, start_date="2026-10-05", end_date="2026-10-09"
    )
    return submit_request(req, profile.user)


class TestScopedList:
    def test_manager_sees_two_teams_scoped(
        self, api_client, org, report, report2, manager, leave_type, hr_user
    ):
        submitted(org, report.profile, leave_type, "R1 leave")
        submitted(org, report2.profile, leave_type, "R2 leave")
        # an unrelated org user's request must not leak in
        outsider = make_user(org, "outside@acme.test")
        outside_profile = make_profile(org, outsider, "E999")  # different manager (none)
        out_req = make_draft(org, outside_profile, leave_type, title="Outside")
        submit_request(out_req, outsider)  # falls to HR — still out of manager scope
        client = authed(api_client, manager)
        resp = client.get(LIST)
        titles = {r["title"] for r in resp.json()["results"]}
        assert titles == {"R1 leave", "R2 leave"}

    def test_search_filters_within_scope(self, api_client, org, report, manager, leave_type):
        submitted(org, report.profile, leave_type, "Beach holiday")
        submitted(org, report.profile, leave_type, "Conference trip")
        client = authed(api_client, manager)
        resp = client.get(LIST, {"search": "beach"})
        titles = {r["title"] for r in resp.json()["results"]}
        assert titles == {"Beach holiday"}

    def test_status_filter(self, api_client, org, report, manager, leave_type):
        submitted(org, report.profile, leave_type, "Pending one")
        make_draft(org, report.profile, leave_type, title="Draft one")
        client = authed(api_client, report)
        resp = client.get(LIST, {"status": "draft"})
        titles = {r["title"] for r in resp.json()["results"]}
        assert titles == {"Draft one"}

    def test_bad_status_rejected(self, api_client, report):
        client = authed(api_client, report)
        resp = client.get(LIST, {"status": "bogus"})
        assert resp.status_code == 400

    def test_ordering_allowlist(self, api_client, org, report, leave_type):
        make_draft(org, report.profile, leave_type, title="Beta")
        make_draft(org, report.profile, leave_type, title="Alpha")
        client = authed(api_client, report)
        resp = client.get(LIST, {"ordering": "title"})
        titles = [r["title"] for r in resp.json()["results"]]
        assert titles == ["Alpha", "Beta"]
        resp = client.get(LIST, {"ordering": "__proto__"})
        assert resp.status_code == 400

    def test_related_field_ordering(self, api_client, org, report, leave_type):
        """Column sorting maps allowlisted ids to joined fields (type name,
        employee display name)."""
        other_type = RequestType.objects.create(
            organization=org, code="EQP", name="Equipment", unit="unit",
        )
        make_draft(org, report.profile, leave_type, title="T1")
        make_draft(org, report.profile, other_type, title="T2")
        client = authed(api_client, report)
        resp = client.get(LIST, {"ordering": "-type"})
        assert resp.status_code == 200
        types = [r["type_name"] for r in resp.json()["results"]]
        assert types == sorted(types, reverse=True)
        resp = client.get(LIST, {"ordering": "employee"})
        assert resp.status_code == 200

    def test_pagination_bounded(self, api_client, org, report, leave_type):
        for i in range(30):
            make_draft(org, report.profile, leave_type, title=f"R{i:02d}")
        client = authed(api_client, report)
        resp = client.get(LIST)
        body = resp.json()
        assert body["count"] == 30
        assert len(body["results"]) == 25
        resp = client.get(LIST, {"page_size": 200})
        assert len(resp.json()["results"]) <= 100

    def test_history_endpoint_scoped(self, api_client, org, report, manager, leave_type):
        req = submitted(org, report.profile, leave_type, "Hist")
        client = authed(api_client, report)
        resp = client.get(f"{LIST}{req.id}/history/")
        assert resp.status_code == 200
        body = resp.json()
        assert any(e["event_type"] == "submitted" for e in body["events"])
        assert len(body["steps"]) == 1
        assert body["steps"][0]["required_role"] == "manager"

        outsider = make_user(org, "sneak@acme.test")
        make_profile(org, outsider, "E998")
        c2 = authed(api_client, outsider)
        assert c2.get(f"{LIST}{req.id}/history/").status_code == 404


class TestTypeConfigIsolation:
    def test_type_change_does_not_rewrite_history(
        self, api_client, org, report, manager, hr_user, leave_type
    ):
        req = submitted(org, report.profile, leave_type, "Frozen")
        snap = req.route_snapshot
        assert snap["requires_hr"] is False
        # HR flips requires_hr — the submitted cycle must keep its route
        leave_type.requires_hr = True
        leave_type.save()
        req.refresh_from_db()
        assert req.route_snapshot == snap
        assert req.steps.count() == 1  # no retroactive HR step

    def test_type_admin_hr_only(self, api_client, org, report):
        client = authed(api_client, report)
        resp = client.post(
            TYPES,
            {
                "name": "New",
                "unit": "none",
            },
        )
        assert resp.status_code in (403, 404)


class TestTypeAdmin:
    def test_hr_creates_and_edits_type(self, api_client, hr_user):
        client = authed(api_client, hr_user)
        resp = client.post(
            TYPES,
            {
                "name": "Work from home",
                "unit": "none",
                "requires_hr": True,
            },
        )
        assert resp.status_code == 201, resp.json()
        body = resp.json()
        assert body["code"]  # server-generated, not client-supplied
        tid = body["id"]
        resp = client.patch(f"{TYPES}{tid}/", {"is_active": False})
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_unit_locked_after_allocation_use(self, api_client, org, hr_user):
        from apps.employee_requests.allocations import create_grant

        req_type = RequestType.objects.create(
            organization=org, code="ALLOC", name="Allocated", unit="unit",
        )
        emp = make_user(org, "lock-emp@acme.test")
        profile = make_profile(org, emp, "L001")
        create_grant(hr_user, profile, req_type, date(2026, 10, 1), date(2026, 10, 31), 2)
        client = authed(api_client, hr_user)
        resp = client.patch(f"{TYPES}{req_type.pk}/", {"unit": "hour"})
        assert resp.status_code == 400
        assert "unit" in resp.json()["field_errors"]


@pytest.mark.django_db
class TestQueryBudget:
    """T018 — list/detail/history must not scale queries with row count."""

    def test_request_list_bounded_queries(
        self, api_client, org, report, leave_type, django_assert_max_num_queries
    ):
        for i in range(30):
            make_draft(org, report.profile, leave_type, title=f"R{i}")
        client = authed(api_client, report)  # login outside measured block
        with django_assert_max_num_queries(15):
            resp = client.get(LIST)
        assert resp.status_code == 200

    def test_request_detail_bounded_queries(
        self, api_client, org, report, leave_type, django_assert_max_num_queries
    ):
        req = submitted(org, report.profile, leave_type, "Budgeted")
        client = authed(api_client, report)
        with django_assert_max_num_queries(15):
            resp = client.get(f"{LIST}{req.id}/")
        assert resp.status_code == 200

    def test_request_history_bounded_queries(
        self, api_client, org, report, leave_type, django_assert_max_num_queries
    ):
        req = submitted(org, report.profile, leave_type, "Budgeted")
        client = authed(api_client, report)
        with django_assert_max_num_queries(15):
            resp = client.get(f"{LIST}{req.id}/history/")
        assert resp.status_code == 200
