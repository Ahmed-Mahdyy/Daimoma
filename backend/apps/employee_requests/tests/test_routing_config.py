# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
"""Configurable approval chain: requires_manager/requires_hr combinations
(D-004 amendment). Covers HR-only routes, manager-only routes, combined
routes, invalid empty chains, fallback rules, and snapshot immutability."""
import pytest

from apps.conftest import make_profile, make_user
from apps.employee_requests.models import EmployeeRequest, RequestType
from apps.employee_requests.tests.test_submission import authed, make_draft

pytestmark = pytest.mark.django_db


def submit_url(request_id):
    return f"/api/v1/requests/{request_id}/submit/"


def type_url(type_id):
    return f"/api/v1/request-types/{type_id}/"


@pytest.fixture
def report(org, manager):
    user = make_user(org, "route-report@acme.test")
    make_profile(org, user, "R100", manager=manager.profile)
    return user


def make_type(org, **kw):
    defaults = dict(
        organization=org,
        code="RT1",
        name="Route test",
        unit="none",
    )
    return RequestType.objects.create(**{**defaults, **kw})


class TestRouteCombinations:
    def test_hr_only_routes_straight_to_hr(
        self, api_client, org, report, manager, hr_user
    ):
        req_type = make_type(
            org, requires_manager=False, requires_hr=True
        )
        draft = make_draft(org, report.profile, req_type)
        resp = authed(api_client, report).post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        assert resp.json()["status"] == "pending_hr"
        step = draft.steps.get(cycle=1)
        assert draft.steps.filter(cycle=1).count() == 1
        assert step.required_role == "hr"
        assert step.reviewer_id == hr_user.id
        assert step.status == "pending"

    def test_manager_only_single_step(
        self, api_client, org, report, manager, hr_user
    ):
        req_type = make_type(org, requires_manager=True, requires_hr=False)
        draft = make_draft(org, report.profile, req_type)
        resp = authed(api_client, report).post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        assert resp.json()["status"] == "pending_manager"
        assert draft.steps.filter(cycle=1).count() == 1
        step = draft.steps.get(cycle=1)
        assert step.required_role == "manager"
        assert step.reviewer_id == manager.id

    def test_manager_then_hr_two_steps(
        self, api_client, org, report, manager, hr_user
    ):
        req_type = make_type(org, requires_manager=True, requires_hr=True)
        draft = make_draft(org, report.profile, req_type)
        resp = authed(api_client, report).post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        steps = list(draft.steps.filter(cycle=1).order_by("sequence"))
        assert [(s.required_role, s.status) for s in steps] == [
            ("manager", "pending"),
            ("hr", "waiting"),
        ]

    def test_hr_only_blocks_when_no_eligible_hr(
        self, api_client, org, report, manager
    ):
        """HR-only type with no eligible HR -> submission blocked, not
        silently rerouted to the manager."""
        req_type = make_type(org, requires_manager=False, requires_hr=True)
        draft = make_draft(org, report.profile, req_type)
        resp = authed(api_client, report).post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 400
        draft.refresh_from_db()
        assert draft.status == EmployeeRequest.Status.DRAFT

    def test_manager_only_falls_back_to_hr_without_manager(
        self, api_client, org, employee, hr_user
    ):
        req_type = make_type(org, requires_manager=True, requires_hr=False)
        draft = make_draft(org, employee.profile, req_type)
        resp = authed(api_client, employee).post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        assert resp.json()["status"] == "pending_hr"
        step = draft.steps.get(cycle=1)
        assert step.required_role == "hr"
        assert step.reviewer_id == hr_user.id


class TestTypeConfiguration:
    def test_empty_chain_rejected_on_create(self, api_client, hr_user):
        resp = authed(api_client, hr_user).post(
            "/api/v1/request-types/",
            {
                "name": "No reviewers",
                "unit": "none",
                "requires_manager": False,
                "requires_hr": False,
            },
        )
        assert resp.status_code == 400

    def test_empty_chain_rejected_on_patch(self, api_client, hr_user, org):
        req_type = make_type(org, requires_manager=True, requires_hr=True)
        resp = authed(api_client, hr_user).patch(
            type_url(req_type.id), {"requires_manager": False, "requires_hr": False}
        )
        assert resp.status_code == 400
        req_type.refresh_from_db()
        assert req_type.requires_manager and req_type.requires_hr

    def test_patch_can_switch_to_hr_only(self, api_client, hr_user, org):
        req_type = make_type(org, requires_manager=True, requires_hr=False)
        resp = authed(api_client, hr_user).patch(
            type_url(req_type.id), {"requires_manager": False, "requires_hr": True}
        )
        assert resp.status_code == 200, resp.json()
        assert resp.json()["requires_manager"] is False
        assert resp.json()["requires_hr"] is True

    def test_config_change_keeps_existing_cycle(
        self, api_client, org, report, manager, hr_user
    ):
        """Existing route snapshots/steps are immutable: reconfiguring the
        type mid-cycle does not reinterpret a submitted request."""
        req_type = make_type(org, requires_manager=True, requires_hr=True)
        draft = make_draft(org, report.profile, req_type)
        client = authed(api_client, report)
        client.post(submit_url(draft.id), {"version": 1})
        draft.refresh_from_db()
        snapshot = dict(draft.route_snapshot)

        req_type.requires_manager = False
        req_type.save()
        draft.refresh_from_db()
        assert draft.route_snapshot == snapshot
        assert draft.steps.filter(cycle=1).count() == 2
