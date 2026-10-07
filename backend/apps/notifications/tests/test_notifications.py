"""T017 — notification recipient isolation, deduplication, read flows
(FR-007, FR-010)."""

import pytest
from rest_framework.test import APIClient

from apps.conftest import TEST_PASSWORD
from apps.notifications.models import Notification

NOTIFICATIONS = "/api/v1/notifications/"


def authed_client(user):
    c = APIClient()
    c.post("/api/v1/auth/login/", {"email": user.email, "password": TEST_PASSWORD})
    return c


def notify(recipient, event_key, org=None, **kw):
    from apps.notifications.services import notify as _notify

    notification, _created = _notify(
        org or recipient.organization,
        recipient,
        event_key=event_key,
        kind=kw.pop("kind", "test"),
        summary=kw.pop("summary", "hello"),
        **kw,
    )
    return notification


@pytest.mark.django_db
class TestDeduplication:
    def test_same_event_key_no_duplicate(self, employee):
        notify(employee, "evt:1")
        notify(employee, "evt:1")
        assert Notification.objects.filter(recipient=employee).count() == 1

    def test_same_key_different_recipients_ok(self, employee, manager):
        notify(employee, "evt:1")
        notify(manager, "evt:1")
        assert Notification.objects.count() == 2


@pytest.mark.django_db
class TestRecipientIsolation:
    def test_list_only_own(self, employee, manager):
        notify(employee, "a")
        notify(manager, "b")
        body = authed_client(employee).get(NOTIFICATIONS).json()
        assert body["count"] == 1
        assert body["results"][0]["event_key"] == "a"

    def test_anonymous_forbidden(self):
        assert APIClient().get(NOTIFICATIONS).status_code == 403

    def test_read_others_id_404(self, employee, manager):
        n = notify(manager, "b")
        response = authed_client(employee).post(f"{NOTIFICATIONS}{n.id}/read/", {})
        assert response.status_code == 404
        n.refresh_from_db()
        assert not n.is_read


@pytest.mark.django_db
class TestReadFlows:
    def test_mark_read(self, employee):
        n = notify(employee, "a")
        response = authed_client(employee).post(f"{NOTIFICATIONS}{n.id}/read/", {})
        assert response.status_code == 200
        n.refresh_from_db()
        assert n.is_read

    def test_mark_read_idempotent(self, employee):
        n = notify(employee, "a")
        c = authed_client(employee)
        assert c.post(f"{NOTIFICATIONS}{n.id}/read/", {}).status_code == 200
        assert c.post(f"{NOTIFICATIONS}{n.id}/read/", {}).status_code == 200
        assert Notification.objects.filter(recipient=employee).count() == 1

    def test_unread_filter_and_count(self, employee):
        notify(employee, "a")
        n2 = notify(employee, "b")
        c = authed_client(employee)
        c.post(f"{NOTIFICATIONS}{n2.id}/read/", {})
        body = c.get(f"{NOTIFICATIONS}?unread=true").json()
        assert body["count"] == 1
        assert body["results"][0]["event_key"] == "a"
        assert body["unread_count"] == 1

    def test_read_all(self, employee):
        notify(employee, "a")
        notify(employee, "b")
        c = authed_client(employee)
        response = c.post(f"{NOTIFICATIONS}read-all/", {})
        assert response.status_code == 200
        assert Notification.objects.filter(recipient=employee, read_at__isnull=True).count() == 0

    def test_paginated_shape_and_fields(self, employee):
        notify(employee, "a", summary="Something happened")
        body = authed_client(employee).get(NOTIFICATIONS).json()
        assert {"count", "next", "previous", "results"} <= set(body)
        row = body["results"][0]
        assert {"id", "kind", "summary", "read_at", "created_at"} <= set(row)

    def test_read_all_only_own(self, employee, manager):
        notify(employee, "a")
        notify(manager, "b")
        authed_client(employee).post(f"{NOTIFICATIONS}read-all/", {})
        assert Notification.objects.get(recipient=manager).is_read is False


@pytest.mark.django_db
class TestPresentationMetadata:
    def test_known_request_summary_exposes_translation_parts(self, employee):
        notify(
            employee,
            "request:1:cycle1:pending",
            kind="request_review",
            summary="Equipment keyboard awaits your review.",
        )
        row = authed_client(employee).get(NOTIFICATIONS).json()["results"][0]
        assert row["summary"] == "Equipment keyboard awaits your review."
        assert row["summary_key"] == "notification.requestReview"
        assert row["summary_params"] == {"title": "Equipment keyboard"}

    def test_unknown_summary_falls_back_without_translation_key(self, employee):
        notify(employee, "custom:1", summary="Something custom happened.")
        row = authed_client(employee).get(NOTIFICATIONS).json()["results"][0]
        assert row["summary"] == "Something custom happened."
        assert row["summary_key"] == ""
        assert row["summary_params"] == {}
