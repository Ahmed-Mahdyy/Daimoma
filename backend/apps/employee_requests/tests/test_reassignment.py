"""T013 — D-004 pending-step reassignment on reporting-line changes: the new
manager (or HR fallback) owns outstanding steps immediately, old manager
access is revoked, completed history is preserved, and no eligible reviewer
blocks the administrative change."""

import pytest
from django.contrib.auth.models import Group

from apps.accounts.permissions import ROLE_MANAGER
from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.employee_requests.models import EmployeeRequest
from apps.employee_requests.services import submit_request

pytestmark = pytest.mark.django_db

LIST = "/api/v1/requests/"
EMPLOYEES = "/api/v1/employees/"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


def make_draft(org, profile, req_type, **kw):
    defaults = dict(organization=org, employee=profile, type=req_type, title="Req", description="d")
    return EmployeeRequest.objects.create(**{**defaults, **kw})


@pytest.fixture
def manager2(org):
    user = make_user(org, "mgr2@acme.test")
    user.groups.add(Group.objects.get(name=ROLE_MANAGER))
    make_profile(org, user, "M002")
    return user


@pytest.fixture
def report(org, manager):
    user = make_user(org, "report@acme.test")
    make_profile(org, user, "E100", manager=manager.profile)
    return user


@pytest.fixture
def pending_req(report, manager, leave_type):
    req = make_draft(
        report.organization,
        report.profile,
        leave_type,
        start_date="2026-10-05",
        end_date="2026-10-09",
    )
    return submit_request(req, report)


def hr_change_manager(api_client, hr_user, profile, new_manager_id):
    client = authed(api_client, hr_user)
    return client.patch(
        f"{EMPLOYEES}{profile.id}/",
        {
            "manager": new_manager_id if new_manager_id is not None else "",
            "version": profile.version,
        },
    )


class TestReassignment:
    def test_pending_step_moves_to_new_manager(
        self, api_client, hr_user, report, manager, manager2, pending_req
    ):
        profile = report.profile
        resp = hr_change_manager(api_client, hr_user, profile, str(manager2.profile.id))
        assert resp.status_code == 200, resp.json()
        step = pending_req.steps.get(cycle=1)
        step.refresh_from_db()
        assert step.reviewer_id == manager2.id
        # Old manager can no longer decide
        old = authed(api_client, manager)
        resp = old.post(f"{LIST}{pending_req.id}/approve/", {"version": step.request.version})
        assert resp.status_code in (403, 404)
        # New manager can
        new = authed(api_client, manager2)
        step.request.refresh_from_db()
        resp = new.post(
            f"{LIST}{pending_req.id}/approve/",
            {"version": step.request.version},
        )
        assert resp.status_code == 200, resp.json()

    def test_reassignment_event_recorded(self, api_client, hr_user, report, manager2, pending_req):
        hr_change_manager(api_client, hr_user, report.profile, str(manager2.profile.id))
        event = pending_req.events.filter(event_type="reviewer_reassigned")
        assert event.exists()

    def test_unassigned_manager_falls_back_to_hr(
        self, api_client, hr_user, report, manager, pending_req
    ):
        resp = hr_change_manager(api_client, hr_user, report.profile, None)
        assert resp.status_code == 200, resp.json()
        step = pending_req.steps.get(cycle=1)
        step.refresh_from_db()
        assert step.reviewer_id == hr_user.id

    def test_no_eligible_reviewer_blocks_change(
        self, api_client, org, hr_user, manager, leave_type
    ):
        # Owner is the org's only HR user; their request is pending a manager
        # step with mgr1. Reassigning the manager to an inactive profile
        # leaves no eligible reviewer (the fallback excludes the owner
        # themselves) — the whole admin change must roll back (D-004).
        hr_user.profile.manager = manager.profile
        hr_user.profile.save()
        req = make_draft(
            org,
            hr_user.profile,
            leave_type,
            start_date="2026-10-05",
            end_date="2026-10-09",
        )
        req = submit_request(req, hr_user)
        assert req.steps.get(cycle=1).reviewer_id == manager.id
        inactive_mgr = make_user(org, "dead@acme.test", is_active=False)
        inactive_profile = make_profile(org, inactive_mgr, "X001")
        profile = hr_user.profile
        resp = hr_change_manager(api_client, hr_user, profile, str(inactive_profile.id))
        assert resp.status_code == 400
        profile.refresh_from_db()
        assert profile.manager_id == manager.profile.id  # change rolled back
        step = req.steps.get(cycle=1)
        step.refresh_from_db()
        assert step.reviewer_id == manager.id  # step untouched

    def test_completed_steps_untouched(
        self, api_client, hr_user, report, manager, manager2, leave_type
    ):
        req = make_draft(
            report.organization,
            report.profile,
            leave_type,
            start_date="2026-10-05",
            end_date="2026-10-09",
        )
        req = submit_request(req, report)
        # Manager returns for correction; employee resubmits — the returned
        # step must keep its original reviewer.
        client = authed(api_client, manager)
        resp = client.post(f"{LIST}{req.id}/return/", {"reason": "fix", "version": req.version})
        assert resp.status_code == 200, resp.json()
        req.refresh_from_db()
        # employee resubmits -> cycle 2 pending with manager
        c2 = authed(api_client, report)
        resp = c2.post(f"{LIST}{req.id}/submit/", {"version": req.version})
        assert resp.status_code == 200, resp.json()
        req.refresh_from_db()
        # now reassign manager
        hr_change_manager(api_client, hr_user, report.profile, str(manager2.profile.id))
        s1 = req.steps.get(cycle=1)
        s1.refresh_from_db()
        assert s1.reviewer_id == manager.id  # history preserved
        assert s1.status == "returned"
        s2 = req.steps.get(cycle=2)
        s2.refresh_from_db()
        assert s2.reviewer_id == manager2.id
