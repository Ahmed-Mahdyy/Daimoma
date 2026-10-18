"""T017 — audit redaction/immutability + scoped read access (FR-006, FR-010).

Visibility per owner decision (amended 2026-10-17): HR sees all organization
events; managers and employees have no audit access."""

import pytest
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.conftest import TEST_PASSWORD, make_profile, make_user

AUDIT = "/api/v1/audit-events/"


def authed_client(user):
    c = APIClient()
    c.post("/api/v1/auth/login/", {"email": user.email, "password": TEST_PASSWORD})
    return c


@pytest.mark.django_db
class TestImmutability:
    def test_update_forbidden(self, org):
        event = AuditEvent.objects.create(
            organization=org, action="x", target_type="t", target_id=org.id
        )
        event.action = "changed"
        with pytest.raises(RuntimeError):
            event.save()

    def test_delete_forbidden(self, org):
        event = AuditEvent.objects.create(
            organization=org, action="x", target_type="t", target_id=org.id
        )
        with pytest.raises(RuntimeError):
            event.delete()
        assert AuditEvent.objects.filter(pk=event.pk).exists()

    def test_no_update_or_delete_api(self, org, hr_user):
        event = AuditEvent.objects.create(
            organization=org, action="x", target_type="t", target_id=org.id
        )
        c = authed_client(hr_user)
        assert c.patch(f"{AUDIT}{event.id}/", {}, format="json").status_code in (404, 405)
        assert c.delete(f"{AUDIT}{event.id}/").status_code in (404, 405)


@pytest.mark.django_db
class TestRedaction:
    def test_sensitive_metadata_never_stored(self, org, hr_user):
        from apps.audit.services import record_audit

        event = record_audit(
            org,
            hr_user,
            "test_action",
            org,
            {"name": "ok", "password": "hunter2", "token": "abc", "secret_key": "x"},
        )
        assert event.metadata == {"name": "ok"}

    def test_record_audit_is_append_only_service(self, org, hr_user):
        from apps.audit.services import record_audit

        e1 = record_audit(org, hr_user, "a", org, {})
        e2 = record_audit(org, hr_user, "b", org, {})
        assert AuditEvent.objects.count() == 2
        assert e1.pk != e2.pk


@pytest.mark.django_db
class TestScopedReads:
    def test_hr_sees_all_org_events(self, org, hr_user, employee):
        e1 = AuditEvent.objects.create(
            organization=org,
            actor=hr_user,
            action="a1",
            target_type="accounts.employeeprofile",
            target_id=employee.profile.id,
        )
        e2 = AuditEvent.objects.create(
            organization=org,
            actor=hr_user,
            action="a2",
            target_type="organizations.organization",
            target_id=org.id,
        )
        body = authed_client(hr_user).get(AUDIT).json()
        ids = {r["id"] for r in body["results"]}
        assert {str(e1.id), str(e2.id)} <= ids

    def test_manager_forbidden(self, org, manager):
        # Audit is HR-only (owner decision 2026-10-17) — even for events
        # that target a manager's own direct report.
        report = make_profile(org, make_user(org, "r1@x.test"), "R1", manager=manager.profile)
        AuditEvent.objects.create(
            organization=org,
            action="m1",
            target_type="accounts.employeeprofile",
            target_id=report.id,
        )
        assert authed_client(manager).get(AUDIT).status_code == 403

    def test_employee_forbidden(self, employee):
        assert authed_client(employee).get(AUDIT).status_code == 403

    def test_anonymous_forbidden(self):
        assert APIClient().get(AUDIT).status_code == 403

    def test_cross_org_invisible(self, org, other_org, hr_user):
        foreign = AuditEvent.objects.create(
            organization=other_org, action="x", target_type="t", target_id=other_org.id
        )
        body = authed_client(hr_user).get(AUDIT).json()
        ids = {r["id"] for r in body["results"]}
        assert str(foreign.id) not in ids

    def test_paginated_shape(self, org, hr_user):
        AuditEvent.objects.create(organization=org, action="x", target_type="t", target_id=org.id)
        body = authed_client(hr_user).get(AUDIT).json()
        assert {"count", "next", "previous", "results"} <= set(body)
        row = body["results"][0]
        assert {"id", "action", "target_type", "target_id", "occurred_at", "metadata"} <= set(row)

    def test_filter_by_action(self, org, hr_user):
        AuditEvent.objects.create(
            organization=org, action="keep", target_type="t", target_id=org.id
        )
        AuditEvent.objects.create(
            organization=org, action="drop", target_type="t", target_id=org.id
        )
        body = authed_client(hr_user).get(f"{AUDIT}?action=keep").json()
        assert [r["action"] for r in body["results"]] == ["keep"]

    def test_no_sensitive_fields_in_payload(self, org, hr_user):
        AuditEvent.objects.create(
            organization=org, actor=hr_user, action="x", target_type="t", target_id=org.id
        )
        row = authed_client(hr_user).get(AUDIT).json()["results"][0]
        assert "password" not in str(row).lower()
        assert "token" not in str(row).lower()


@pytest.mark.django_db
class TestOrdering:
    """Allowlisted column ordering for the audit table (DataTable headers
    send ?ordering=<id>); unknown fields are rejected."""

    def test_allowlisted_orderings(self, org, hr_user, employee):
        AuditEvent.objects.create(
            organization=org, actor=employee, action="beta",
            target_type="t", target_id=org.id,
        )
        AuditEvent.objects.create(
            organization=org, actor=hr_user, action="alpha",
            target_type="t", target_id=org.id,
        )
        c = authed_client(hr_user)
        # Logging in itself writes a "login" event — assert the relative
        # order of our two actions rather than the raw head of the list.
        resp = c.get(f"{AUDIT}?ordering=action")
        actions = [r["action"] for r in resp.json()["results"]]
        assert actions == sorted(actions)
        resp = c.get(f"{AUDIT}?ordering=-action")
        actions = [r["action"] for r in resp.json()["results"]]
        assert actions == sorted(actions, reverse=True)
        resp = c.get(f"{AUDIT}?ordering=occurred_at")
        assert resp.status_code == 200
        resp = c.get(f"{AUDIT}?ordering=actor")
        assert resp.status_code == 200

    def test_unknown_ordering_rejected(self, org, hr_user):
        resp = authed_client(hr_user).get(f"{AUDIT}?ordering=target_id")
        assert resp.status_code == 400
