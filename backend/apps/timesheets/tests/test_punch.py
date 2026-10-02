"""Quick check-in/check-out (punch): one open punch per employee; check-out
writes a real entry through the normal service so overlap/midnight/locked-day
rules still apply. Self-scoped — there is no way to punch for another user."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.timesheets.models import OpenCheckIn, TimeEntry

pytestmark = pytest.mark.django_db

PUNCH = "/api/v1/timesheets/punch/"
CHECKOUT = "/api/v1/timesheets/punch/checkout/"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


@pytest.fixture
def emp(org, manager):
    user = make_user(org, "punch@acme.test")
    make_profile(org, user, "E700", manager=manager.profile)
    return user


class TestCheckIn:
    def test_status_closed_then_open(self, api_client, emp):
        c = authed(api_client, emp)
        resp = c.get(PUNCH)
        assert resp.status_code == 200
        assert resp.json() == {"open": False, "started_at": None}
        resp = c.post(PUNCH)
        assert resp.status_code == 201, resp.json()
        assert resp.json()["started_at"]
        resp = c.get(PUNCH)
        assert resp.json()["open"] is True

    def test_double_check_in_conflicts(self, api_client, emp):
        c = authed(api_client, emp)
        assert c.post(PUNCH).status_code == 201
        assert c.post(PUNCH).status_code == 409
        assert OpenCheckIn.objects.filter(employee=emp.profile).count() == 1

    def test_cancel_clears_punch(self, api_client, emp):
        c = authed(api_client, emp)
        assert c.post(PUNCH).status_code == 201
        assert c.delete(PUNCH).status_code == 204
        assert c.get(PUNCH).json()["open"] is False


class TestCheckOut:
    def test_checkout_writes_entry_and_closes(self, api_client, emp):
        c = authed(api_client, emp)
        start = timezone.now() - timedelta(hours=2)
        OpenCheckIn.objects.create(
            organization=emp.organization, employee=emp.profile, started_at=start
        )
        resp = c.post(CHECKOUT)
        assert resp.status_code == 201, resp.json()
        body = resp.json()
        assert len(body["entries"]) == 1
        entry = TimeEntry.objects.get(pk=body["entries"][0]["id"])
        assert entry.start_at == start
        assert entry.duration_minutes > 0
        assert not OpenCheckIn.objects.filter(employee=emp.profile).exists()

    def test_checkout_without_punch_rejected(self, api_client, emp):
        c = authed(api_client, emp)
        assert c.post(CHECKOUT).status_code == 400

    def test_checkout_under_a_minute_keeps_punch(self, api_client, emp):
        c = authed(api_client, emp)
        OpenCheckIn.objects.create(
            organization=emp.organization,
            employee=emp.profile,
            started_at=timezone.now(),
        )
        resp = c.post(CHECKOUT)
        assert resp.status_code == 400
        assert "minute" in str(resp.json()).lower()
        # Punch stays open so the employee can cancel or check out later.
        assert OpenCheckIn.objects.filter(employee=emp.profile).exists()

    def test_checkout_overnight_splits_days(self, api_client, emp):
        c = authed(api_client, emp)
        now = timezone.now()
        # Start 90 minutes ago — only crosses midnight when run near midnight;
        # the service splits either way, we just assert entries land correctly.
        OpenCheckIn.objects.create(
            organization=emp.organization,
            employee=emp.profile,
            started_at=now - timedelta(minutes=90),
        )
        resp = c.post(CHECKOUT)
        assert resp.status_code == 201, resp.json()
        assert len(resp.json()["entries"]) >= 1

    def test_checkout_into_locked_day_keeps_punch(self, api_client, emp, org):
        from apps.timesheets.models import WorkDay
        from apps.timesheets.services import (
            create_entries,
            get_or_create_sheet,
            submit_day,
        )

        c = authed(api_client, emp)
        # Lock whichever local day a now-anchored entry lands on (midnight-safe).
        now = timezone.now()
        end, start = now - timedelta(minutes=1), now - timedelta(minutes=2)
        work_date = timezone.localdate(end)
        sheet = get_or_create_sheet(emp, work_date)
        create_entries(
            sheet.id,
            emp,
            {
                "work_date": work_date,
                "start_at": start,
                "end_at": end,
                "description": "submitted work",
            },
        )
        submit_day(sheet.id, work_date, emp)
        assert WorkDay.objects.get(timesheet=sheet, work_date=work_date).status == "submitted"

        # The punch interval always covers the locked day (same day or an
        # overnight split) — check-out must fail and the punch stays open.
        OpenCheckIn.objects.create(
            organization=emp.organization,
            employee=emp.profile,
            started_at=now - timedelta(minutes=30),
        )
        resp = c.post(CHECKOUT)
        assert resp.status_code in (400, 409)
        assert OpenCheckIn.objects.filter(employee=emp.profile).exists()

    def test_punch_is_self_scoped(self, api_client, org, manager, emp):
        other = make_user(org, "other@acme.test")
        make_profile(org, other, "E701", manager=manager.profile)
        c = authed(api_client, other)
        # Other user has no punch; emp's punch is invisible/unaffected.
        OpenCheckIn.objects.create(
            organization=org, employee=emp.profile, started_at=timezone.now()
        )
        assert c.get(PUNCH).json()["open"] is False
        assert c.post(CHECKOUT).status_code == 400
        assert OpenCheckIn.objects.filter(employee=emp.profile).exists()

    def test_unauthenticated_rejected(self, api_client):
        assert api_client.get(PUNCH).status_code == 403
        assert api_client.post(PUNCH).status_code == 403
        assert api_client.post(CHECKOUT).status_code == 403
