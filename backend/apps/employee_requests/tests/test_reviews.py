# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
"""T011 — review transitions (D-004): approve/reject/return, both routes,
required reasons, self-review denial, wrong-stage, version races, resubmit."""

import pytest
from django.contrib.auth.models import Group

from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.employee_requests.models import EmployeeRequest
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

LIST = "/api/v1/requests/"


def act_url(req_id, action):
    return f"{LIST}{req_id}/{action}/"


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
def pending_request(report, manager, leave_type):
    """Submitted request awaiting manager review."""
    req = make_draft(
        report.organization,
        report.profile,
        leave_type,
        start_date="2026-10-05",
        end_date="2026-10-09",
    )
    from apps.employee_requests.services import submit_request

    return submit_request(req, report)


@pytest.fixture
def hr_pending_request(report, manager, hr_user, equipment_type):
    """Submitted HR-required request: manager step pending, HR step waiting."""
    req = make_draft(
        report.organization,
        report.profile,
        equipment_type,
        title="Laptop",
        equipment_item="MBP",
        quantity=1,
    )
    from apps.employee_requests.services import submit_request

    return submit_request(req, report)


class TestManagerOnlyRoute:
    def test_manager_approves_final(self, api_client, manager, pending_request):
        client = authed(api_client, manager)
        resp = client.post(
            act_url(pending_request.id, "approve"),
            {"version": pending_request.version},
        )
        assert resp.status_code == 200, resp.json()
        pending_request.refresh_from_db()
        assert pending_request.status == "approved"
        step = pending_request.steps.get(cycle=1)
        assert step.status == "approved"
        assert step.decided_at is not None

    def test_approval_notifies_owner(self, api_client, manager, report, pending_request):
        client = authed(api_client, manager)
        client.post(act_url(pending_request.id, "approve"), {"version": pending_request.version})
        notif = Notification.objects.filter(recipient=report)
        assert notif.exists()
        assert "approved" in notif.first().summary.lower()

    def test_manager_rejects_with_reason(self, api_client, manager, pending_request):
        client = authed(api_client, manager)
        resp = client.post(
            act_url(pending_request.id, "reject"),
            {
                "reason": "Insufficient coverage",
                "version": pending_request.version,
            },
        )
        assert resp.status_code == 200
        pending_request.refresh_from_db()
        assert pending_request.status == "rejected"
        assert pending_request.steps.get(cycle=1).reason == "Insufficient coverage"

    def test_reject_requires_reason(self, api_client, manager, pending_request):
        client = authed(api_client, manager)
        resp = client.post(
            act_url(pending_request.id, "reject"),
            {"version": pending_request.version},
        )
        assert resp.status_code == 400
        pending_request.refresh_from_db()
        assert pending_request.status == "pending_manager"

    def test_return_with_reason_sends_back(self, api_client, manager, pending_request):
        client = authed(api_client, manager)
        resp = client.post(
            act_url(pending_request.id, "return"),
            {
                "reason": "Wrong dates",
                "version": pending_request.version,
            },
        )
        assert resp.status_code == 200
        pending_request.refresh_from_db()
        assert pending_request.status == "returned"
        assert pending_request.steps.get(cycle=1).status == "returned"

    def test_return_requires_reason(self, api_client, manager, pending_request):
        client = authed(api_client, manager)
        resp = client.post(
            act_url(pending_request.id, "return"),
            {"version": pending_request.version},
        )
        assert resp.status_code == 400


class TestHrRequiredRoute:
    def test_manager_approval_advances_to_hr(
        self,
        api_client,
        manager,
        hr_user,
        hr_pending_request,
    ):
        client = authed(api_client, manager)
        resp = client.post(
            act_url(hr_pending_request.id, "approve"),
            {"version": hr_pending_request.version},
        )
        assert resp.status_code == 200
        hr_pending_request.refresh_from_db()
        assert hr_pending_request.status == "pending_hr"
        steps = list(hr_pending_request.steps.filter(cycle=1).order_by("sequence"))
        assert steps[0].status == "approved"
        assert steps[1].status == "pending"
        # HR reviewer notified
        assert Notification.objects.filter(recipient=hr_user).exists()

    def test_hr_approval_completes(self, api_client, manager, hr_user, hr_pending_request):
        c1 = authed(api_client, manager)
        c1.post(act_url(hr_pending_request.id, "approve"), {"version": hr_pending_request.version})
        hr_pending_request.refresh_from_db()
        c2 = authed(api_client, hr_user)
        resp = c2.post(
            act_url(hr_pending_request.id, "approve"),
            {"version": hr_pending_request.version},
        )
        assert resp.status_code == 200
        hr_pending_request.refresh_from_db()
        assert hr_pending_request.status == "approved"

    def test_manager_cannot_decide_hr_step(self, api_client, manager, hr_user, hr_pending_request):
        client = authed(api_client, manager)
        client.post(
            act_url(hr_pending_request.id, "approve"),
            {"version": hr_pending_request.version},
        )
        hr_pending_request.refresh_from_db()
        # Manager tries to also decide the HR step — forbidden (no self/second decision)
        resp = client.post(
            act_url(hr_pending_request.id, "approve"),
            {"version": hr_pending_request.version},
        )
        assert resp.status_code in (403, 404)
        hr_pending_request.refresh_from_db()
        assert hr_pending_request.status == "pending_hr"


class TestReviewGuards:
    def test_wrong_reviewer_rejected(self, api_client, org, manager, hr_pending_request):
        other_mgr = make_user(org, "mgr2@acme.test")
        other_mgr.groups.add(Group.objects.get(name="Manager"))
        make_profile(org, other_mgr, "M002")
        client = authed(api_client, other_mgr)
        resp = client.post(
            act_url(hr_pending_request.id, "approve"),
            {"version": hr_pending_request.version},
        )
        assert resp.status_code in (403, 404)

    def test_owner_cannot_approve(self, api_client, report, pending_request):
        client = authed(api_client, report)
        resp = client.post(
            act_url(pending_request.id, "approve"),
            {"version": pending_request.version},
        )
        assert resp.status_code in (403, 404)

    def test_stale_version_conflict(self, api_client, manager, pending_request):
        client = authed(api_client, manager)
        resp = client.post(act_url(pending_request.id, "approve"), {"version": 99})
        assert resp.status_code == 409

    def test_double_decision_blocked(self, api_client, manager, hr_pending_request):
        client = authed(api_client, manager)
        assert (
            client.post(
                act_url(hr_pending_request.id, "approve"),
                {"version": hr_pending_request.version},
            ).status_code
            == 200
        )
        # Second approve on the completed step must not create another decision
        hr_pending_request.refresh_from_db()
        resp = client.post(
            act_url(hr_pending_request.id, "approve"),
            {"version": hr_pending_request.version},
        )
        assert resp.status_code in (403, 404, 409)
        assert hr_pending_request.steps.filter(cycle=1, sequence=1, status="approved").count() == 1

    def test_decided_request_immutable(self, api_client, report, manager, pending_request):
        c1 = authed(api_client, manager)
        c1.post(act_url(pending_request.id, "approve"), {"version": pending_request.version})
        pending_request.refresh_from_db()
        # owner cannot edit an approved request
        c2 = authed(api_client, report)
        resp = c2.patch(
            f"{LIST}{pending_request.id}/",
            {"title": "sneak", "version": pending_request.version},
        )
        assert resp.status_code in (400, 409)
        pending_request.refresh_from_db()
        assert pending_request.title == "Req"

    def test_approve_already_approved_conflict(self, api_client, manager, pending_request, hr_user):
        client = authed(api_client, manager)
        client.post(act_url(pending_request.id, "approve"), {"version": pending_request.version})
        c2 = authed(api_client, hr_user)
        resp = c2.post(
            act_url(pending_request.id, "approve"),
            {"version": pending_request.version + 1},
        )
        assert resp.status_code in (403, 404, 409)


class TestReturnResubmit:
    def test_resubmit_starts_new_cycle(self, api_client, report, manager, pending_request):
        c1 = authed(api_client, manager)
        c1.post(
            act_url(pending_request.id, "return"),
            {
                "reason": "Fix dates",
                "version": pending_request.version,
            },
        )
        pending_request.refresh_from_db()
        # owner edits and resubmits
        c2 = authed(api_client, report)
        resp = c2.patch(
            f"{LIST}{pending_request.id}/",
            {"title": "Fixed", "version": pending_request.version},
        )
        assert resp.status_code == 200
        pending_request.refresh_from_db()
        resp = c2.post(act_url(pending_request.id, "submit"), {"version": pending_request.version})
        assert resp.status_code == 200, resp.json()
        pending_request.refresh_from_db()
        assert pending_request.cycle == 2
        assert pending_request.status == "pending_manager"
        # history preserved: cycle-1 step still shows the return decision
        s1 = pending_request.steps.get(cycle=1)
        assert s1.status == "returned" and s1.reason == "Fix dates"
        s2 = pending_request.steps.get(cycle=2)
        assert s2.status == "pending"
        # resubmission event exists
        assert pending_request.events.filter(cycle=2, event_type="submitted").exists()

    def test_rejected_is_terminal(self, api_client, report, manager, pending_request):
        c1 = authed(api_client, manager)
        c1.post(
            act_url(pending_request.id, "reject"),
            {
                "reason": "No",
                "version": pending_request.version,
            },
        )
        pending_request.refresh_from_db()
        c2 = authed(api_client, report)
        resp = c2.post(act_url(pending_request.id, "submit"), {"version": pending_request.version})
        assert resp.status_code == 409
        pending_request.refresh_from_db()
        assert pending_request.status == "rejected"
