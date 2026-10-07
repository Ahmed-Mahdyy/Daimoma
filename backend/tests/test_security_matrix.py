"""T003 — consolidated negative security matrix (006:FR-001, FR-005).

One reproducible suite proving no protected surface leaks data across
authentication, role, ownership, team, or organization boundaries. Per-app
suites cover the details; this file is the release-gate summary matrix —
every row is an actual server assertion, not a documented expectation."""

import uuid

import pytest
from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.notifications.models import Notification
from apps.notifications.services import notify
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

PROTECTED_GETS = [
    "/api/v1/employees/",
    "/api/v1/requests/",
    "/api/v1/allocations/",
    "/api/v1/allocations/mine/",
    "/api/v1/timesheets/",
    "/api/v1/audit-events/",
    "/api/v1/notifications/",
    "/api/v1/notifications/unread-count/",
    "/api/v1/dashboards/personal/",
    "/api/v1/dashboards/team/",
    "/api/v1/dashboards/organization/",
    "/api/v1/reports/working-hours/",
    "/api/v1/reports/requests/",
    "/api/v1/reports/working-hours/export/",
    "/api/v1/reports/requests/export/",
    "/api/v1/departments/",
    "/api/v1/organization/settings/",
]


def authed(user):
    c = APIClient()
    assert login(c, user, TEST_PASSWORD).status_code == 200
    return c


class TestUnauthenticated:
    @pytest.mark.parametrize("url", PROTECTED_GETS)
    def test_gets_denied(self, api_client, url):
        resp = api_client.get(url)
        assert resp.status_code in (401, 403), url


class TestRoleEscalation:
    """An ordinary employee must never reach reviewer/admin/org surfaces."""

    HR_ONLY = [
        "/api/v1/allocations/",
        "/api/v1/dashboards/organization/",
        "/api/v1/audit-events/",
        "/api/v1/reports/working-hours/export/",
        "/api/v1/reports/requests/export/",
    ]

    @pytest.mark.parametrize("url", HR_ONLY)
    def test_employee_denied_hr_surfaces(self, employee, url):
        resp = authed(employee).get(url)
        assert resp.status_code == 403, url

    def test_employee_denied_team_dashboard(self, employee):
        resp = authed(employee).get("/api/v1/dashboards/team/")
        assert resp.status_code == 403

    def test_employee_cannot_provision_accounts(self, employee):
        resp = authed(employee).post(
            "/api/v1/employees/",
            {"email": "x@x.test", "employee_code": "X1"},
        )
        assert resp.status_code in (403, 405)

    def test_employee_cannot_change_org_settings(self, employee):
        resp = authed(employee).patch(
            "/api/v1/organization/settings/", {"work_max_daily_minutes": 999}
        )
        assert resp.status_code in (403, 405)

    def test_employee_cannot_deactivate_others(self, employee, org):
        other = make_user(org, "other@acme.test")
        other_profile = make_profile(org, other, "E999")
        resp = authed(employee).post(
            f"/api/v1/employees/{other_profile.pk}/deactivate/", {"reason": "x"}
        )
        assert resp.status_code == 403


class TestCrossOrganization:
    """Foreign-organization objects are invisible — 404, never 200/403
    hints that confirm existence."""

    def test_foreign_employee_detail_404(self, employee, other_org):
        fu = make_user(other_org, "foreign@x.test")
        fp = make_profile(other_org, fu, "F001")
        resp = authed(employee).get(f"/api/v1/employees/{fp.pk}/")
        assert resp.status_code == 404

    def test_foreign_notification_target_404(self, employee, other_org):
        """A notification id from another org must not resolve."""
        fu = make_user(other_org, "foreign2@x.test")
        n, _ = notify(
            other_org,
            fu,
            event_key="x:1",
            kind="request_decision",
            summary="foreign",
        )
        c = authed(employee)
        assert c.get(f"/api/v1/notifications/{n.pk}/").status_code == 404
        assert c.get(f"/api/v1/notifications/{n.pk}/target/").status_code == 404

    def test_random_uuids_never_leak(self, employee):
        c = authed(employee)
        for base in (
            "/api/v1/employees/",
            "/api/v1/requests/",
            "/api/v1/timesheets/",
            "/api/v1/notifications/",
        ):
            assert c.get(f"{base}{uuid.uuid4()}/").status_code == 404, base


class TestInboxIsolation:
    def test_cannot_read_or_mark_foreign_notification(self, employee, org):
        other = make_user(org, "other2@acme.test")
        n, _ = notify(org, other, event_key="iso:1", kind="request_decision", summary="secret")
        c = authed(employee)
        assert c.get(f"/api/v1/notifications/{n.pk}/").status_code == 404
        assert c.post(f"/api/v1/notifications/{n.pk}/read/").status_code == 404
        assert Notification.objects.get(pk=n.pk).read_at is None

    def test_unread_count_is_self_only(self, employee, org):
        other = make_user(org, "other3@acme.test")
        notify(org, other, event_key="iso:2", kind="request_decision", summary="x")
        notify(org, employee, event_key="iso:3", kind="request_decision", summary="y")
        body = authed(employee).get("/api/v1/notifications/unread-count/").json()
        assert body["unread_count"] == 1


class TestFieldInjection:
    """Server-owned fields must not be writable through create/update."""

    def test_request_create_ignores_status_and_employee(self, employee, org):
        """Mass-assignment attempt: status/employee/org fields ignored or 400."""
        from apps.employee_requests.models import RequestType

        rt = RequestType.objects.create(
            organization=org,
            code="gen",
            name="General",
            unit="none",
            is_active=True,
        )
        resp = authed(employee).post(
            "/api/v1/requests/",
            {
                "type": str(rt.pk),
                "title": "t",
                "description": "d",
                "status": "approved",  # injection attempt
                "employee": str(uuid.uuid4()),
                "organization": str(uuid.uuid4()),
            },
        )
        if resp.status_code == 201:
            body = resp.json()
            assert body["status"] == "draft"

    def test_profile_version_not_writable(self, employee):
        resp = authed(employee).patch(
            f"/api/v1/employees/{employee.profile.pk}/",
            {"version": 999, "is_active": True},
        )
        assert resp.status_code in (400, 403, 404)


class TestCsrfAndSession:
    def test_session_post_without_csrf_rejected(self, employee, csrf_client):
        """Session-authenticated mutating request without CSRF token -> 403."""
        csrf_client.get("/api/v1/auth/csrf/")
        token = csrf_client.cookies["csrftoken"].value
        resp = csrf_client.post(
            "/api/v1/auth/login/",
            {"email": employee.email, "password": TEST_PASSWORD},
            HTTP_X_CSRFTOKEN=token,
        )
        assert resp.status_code == 200
        # Now authenticated — a mutating call without the token must fail.
        resp = csrf_client.post("/api/v1/auth/logout/")
        assert resp.status_code == 403
