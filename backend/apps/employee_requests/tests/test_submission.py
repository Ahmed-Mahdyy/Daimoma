"""T008 — submission: reviewer resolution (D-004), self-review guard, HR
fallback, duplicates/races, route+content snapshots, notifications."""

import pytest
from django.contrib.auth.models import Group

from apps.accounts.permissions import ROLE_HR
from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.employee_requests.models import EmployeeRequest
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

LIST = "/api/v1/requests/"


def submit_url(req_id):
    return f"{LIST}{req_id}/submit/"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


def make_draft(org, profile, req_type, **kw):
    defaults = dict(
        organization=org,
        employee=profile,
        type=req_type,
        title="Req",
        description="d",
    )
    return EmployeeRequest.objects.create(**{**defaults, **kw})


@pytest.fixture
def report(org, manager, leave_type):
    """An employee whose manager is the `manager` fixture."""
    user = make_user(org, "report@acme.test")
    make_profile(org, user, "E100", manager=manager.profile)
    return user


@pytest.fixture
def draft(report, leave_type):
    return make_draft(report.organization, report.profile, leave_type)


class TestSubmission:
    def test_submit_routes_to_manager(self, api_client, report, manager, draft):
        client = authed(api_client, report)
        resp = client.post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        body = resp.json()
        assert body["status"] == "pending_manager"
        assert body["cycle"] == 1
        draft.refresh_from_db()
        assert draft.submitted_at is not None
        step = draft.steps.get(cycle=1)
        assert step.sequence == 1
        assert step.required_role == "manager"
        assert step.reviewer_id == manager.id
        assert step.status == "pending"

    def test_submit_notifies_reviewer(self, api_client, report, manager, draft):
        client = authed(api_client, report)
        client.post(submit_url(draft.id), {"version": 1})
        notif = Notification.objects.filter(recipient=manager)
        assert notif.exists()
        text = notif.first().summary.lower()
        assert "review" in text or "pending" in text

    def test_snapshot_freezes_route(self, api_client, report, manager, draft):
        client = authed(api_client, report)
        client.post(submit_url(draft.id), {"version": 1})
        draft.refresh_from_db()
        snap = draft.route_snapshot
        assert snap["reviewer_id"] == str(manager.id)
        assert snap["requires_hr"] is False

    def test_requires_hr_adds_waiting_hr_step(
        self,
        api_client,
        report,
        manager,
        hr_user,
        draft,
        equipment_type,
    ):
        req = make_draft(
            report.organization,
            report.profile,
            equipment_type,
            title="Laptop",
            equipment_item="MBP",
            quantity=1,
        )
        client = authed(api_client, report)
        resp = client.post(submit_url(req.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        steps = list(req.steps.filter(cycle=1).order_by("sequence"))
        assert len(steps) == 2
        assert steps[0].required_role == "manager" and steps[0].status == "pending"
        assert steps[1].required_role == "hr" and steps[1].status == "waiting"
        assert steps[1].reviewer_id == hr_user.id

    def test_hr_step_reviewer_is_eligible_hr(
        self,
        api_client,
        report,
        manager,
        hr_user,
        equipment_type,
    ):
        # Multiple HR users exist — step reviewer must be an active HR who is
        # not the request owner.
        hr2 = make_user(report.organization, "hr2@acme.test")
        hr2.groups.add(Group.objects.get(name=ROLE_HR))
        make_profile(report.organization, hr2, "H002")
        req = make_draft(
            report.organization,
            report.profile,
            equipment_type,
            title="Laptop",
            equipment_item="MBP",
            quantity=1,
        )
        client = authed(api_client, report)
        client.post(submit_url(req.id), {"version": 1})
        hr_step = req.steps.get(cycle=1, sequence=2)
        assert hr_step.reviewer_id in {hr_user.id, hr2.id}


class TestReviewerFallback:
    def test_no_manager_falls_back_to_hr(self, api_client, org, employee, leave_type, hr_user):
        draft = make_draft(org, employee.profile, leave_type)
        client = authed(api_client, employee)
        resp = client.post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        step = draft.steps.get(cycle=1)
        assert step.required_role == "hr"
        assert step.reviewer_id == hr_user.id
        draft.refresh_from_db()
        # With no manager, the HR step is the pending (first) review.
        assert draft.status == "pending_hr"

    def test_self_fallback_reviewer_skipped(self, api_client, org, hr_user, leave_type):
        # org.fallback_reviewer IS the requester — self-review is forbidden
        # (D-004), so another eligible HR must be picked.
        hr2 = make_user(org, "hr2@acme.test")
        hr2.groups.add(Group.objects.get(name=ROLE_HR))
        make_profile(org, hr2, "H002")
        org.fallback_reviewer = hr_user
        org.save()
        draft = make_draft(org, hr_user.profile, leave_type)
        client = authed(api_client, hr_user)
        resp = client.post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        step = draft.steps.get(cycle=1)
        assert step.reviewer_id == hr2.id

    def test_hr_requester_falls_back_to_other_hr(self, api_client, org, hr_user, leave_type):
        hr2 = make_user(org, "hr2@acme.test")
        hr2.groups.add(Group.objects.get(name=ROLE_HR))
        make_profile(org, hr2, "H002")
        draft = make_draft(org, hr_user.profile, leave_type)
        client = authed(api_client, hr_user)
        resp = client.post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 200, resp.json()
        step = draft.steps.get(cycle=1)
        assert step.reviewer_id == hr2.id

    def test_no_eligible_reviewer_blocks(self, api_client, org, employee, leave_type):
        # No manager and no HR user at all → submission blocked, not unowned.
        draft = make_draft(org, employee.profile, leave_type)
        client = authed(api_client, employee)
        resp = client.post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 400
        draft.refresh_from_db()
        assert draft.status == "draft"
        assert draft.steps.count() == 0


class TestSubmissionGuards:
    def test_duplicate_submit_rejected(self, api_client, report, draft):
        client = authed(api_client, report)
        assert client.post(submit_url(draft.id), {"version": 1}).status_code == 200
        resp = client.post(submit_url(draft.id), {"version": 2})
        assert resp.status_code == 409
        assert draft.steps.filter(cycle=1).count() == 1

    def test_stale_version_rejected(self, api_client, report, draft):
        client = authed(api_client, report)
        resp = client.post(submit_url(draft.id), {"version": 99})
        assert resp.status_code == 409

    def test_non_owner_cannot_submit(self, api_client, manager, draft):
        client = authed(api_client, manager)
        resp = client.post(submit_url(draft.id), {"version": 1})
        assert resp.status_code == 404

    def test_unauthenticated_rejected(self, api_client, draft):
        assert api_client.post(submit_url(draft.id), {}).status_code == 403

    def test_events_recorded(self, api_client, report, draft):
        client = authed(api_client, report)
        client.post(submit_url(draft.id), {"version": 1})
        event = draft.events.get(event_type="submitted")
        assert event.cycle == 1
        assert event.new_status == "pending_manager"
        assert event.snapshot  # content snapshot retained
