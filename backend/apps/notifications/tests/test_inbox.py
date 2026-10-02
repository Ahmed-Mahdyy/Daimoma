"""T010 — inbox gaps (FR-005, FR-008): unread-count endpoint, kind filter,
and target-follow that rechecks CURRENT authorization."""

from datetime import UTC, date, datetime

import pytest
from rest_framework.test import APIClient

from apps.conftest import TEST_PASSWORD, login
from apps.notifications.services import notify
from apps.timesheets.services import (
    create_entries,
    get_or_create_sheet,
    submit_day,
    submit_sheet,
)

BASE = "/api/v1/notifications/"

pytestmark = pytest.mark.django_db


def authed(user):
    c = APIClient()
    assert login(c, user, TEST_PASSWORD).status_code == 200
    return c


def _notify(user, key, kind="timesheet_review", target=None):
    return notify(
        user.organization,
        user,
        event_key=key,
        kind=kind,
        summary="something happened",
        target=target,
    )


class TestUnreadCount:
    def test_count_endpoint(self, employee):
        _notify(employee, "k1")
        _notify(employee, "k2")
        body = authed(employee).get(f"{BASE}unread-count/").json()
        assert body == {"unread_count": 2}

    def test_count_is_recipient_only(self, employee, manager):
        _notify(manager, "k1")
        body = authed(employee).get(f"{BASE}unread-count/").json()
        assert body["unread_count"] == 0

    def test_unauthenticated(self, api_client):
        assert api_client.get(f"{BASE}unread-count/").status_code in (401, 403)


class TestKindFilter:
    def test_filter_by_kind(self, employee):
        _notify(employee, "k1", kind="timesheet_review")
        _notify(employee, "k2", kind="request_decision")
        body = authed(employee).get(BASE, {"kind": "request_decision"}).json()
        assert [r["kind"] for r in body["results"]] == ["request_decision"]

    def test_unknown_kind_returns_empty(self, employee):
        _notify(employee, "k1")
        body = authed(employee).get(BASE, {"kind": "nope"}).json()
        assert body["results"] == []


class TestTargetFollow:
    """GET notifications/{id}/target/ returns the frontend path only when
    the caller can CURRENTLY access the target object."""

    def _submitted_sheet(self, employee, manager):
        """emp submits a week so the manager holds a real notification with
        a timesheet target."""
        sheet = get_or_create_sheet(employee, date(2026, 9, 14))
        employee.profile.manager = manager.profile
        employee.profile.save(update_fields=["manager"])
        create_entries(
            sheet.pk,
            employee,
            {
                "work_date": date(2026, 9, 14),
                "start_at": datetime(2026, 9, 14, 9, tzinfo=UTC),
                "end_at": datetime(2026, 9, 14, 17, tzinfo=UTC),
                "break_minutes": 0,
            },
        )
        submit_day(sheet.pk, date(2026, 9, 14), employee)
        submit_sheet(sheet.pk, employee)
        return sheet

    def test_target_path_for_accessible_sheet(self, employee, manager, hr_user):
        sheet = self._submitted_sheet(employee, manager)
        n = manager.notifications.get(target_id=sheet.pk)
        resp = authed(manager).get(f"{BASE}{n.pk}/target/")
        assert resp.status_code == 200
        assert resp.json()["url"] == f"/timesheets/{sheet.pk}"

    def test_target_lost_access_is_not_found(self, employee, manager, hr_user):
        """Reassign the employee's manager — the old manager's notification
        persists but its target must not resolve for them anymore."""
        sheet = self._submitted_sheet(employee, manager)
        n = manager.notifications.get(target_id=sheet.pk)
        from apps.conftest import make_profile, make_user

        # A second manager takes over the reporting line — the former
        # manager loses access to the pending sheet.
        other = make_user(employee.organization, "mgr2@acme.test")
        other.groups.set(manager.groups.all())
        make_profile(employee.organization, other, "M009")
        resp = authed(hr_user).patch(
            f"/api/v1/employees/{employee.profile.pk}/",
            {"manager": str(other.profile.pk), "version": employee.profile.version},
        )
        assert resp.status_code == 200
        resp = authed(manager).get(f"{BASE}{n.pk}/target/")
        assert resp.status_code == 404

    def test_target_of_other_users_notification_404(self, employee, manager, hr_user):
        sheet = self._submitted_sheet(employee, manager)
        n = manager.notifications.get(target_id=sheet.pk)
        resp = authed(employee).get(f"{BASE}{n.pk}/target/")
        assert resp.status_code == 404
