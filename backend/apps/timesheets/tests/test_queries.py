# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
"""T017 — scoped list filters/ordering/pagination + query budgets.
Lists/details/history must not scale queries with row count."""

from datetime import date, timedelta

import pytest
from django.contrib.auth.models import Group

from apps.accounts.permissions import ROLE_HR
from apps.conftest import TEST_PASSWORD, login, make_profile, make_user
from apps.timesheets.services import get_or_create_sheet

pytestmark = pytest.mark.django_db

TS = "/api/v1/timesheets/"
D = "2026-09-14"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


@pytest.fixture
def emp(org, manager, hr_user):
    user = make_user(org, "emp@acme.test")
    make_profile(org, user, "E800", manager=manager.profile)
    return user


@pytest.fixture
def emp2(org, manager):
    user = make_user(org, "emp2@acme.test")
    make_profile(org, user, "E801", manager=manager.profile)
    return user


def _sheet_with_entry(api_client, user, d):
    c = authed(api_client, user)
    sheet = get_or_create_sheet(user, d)
    day = c.post(
        f"{TS}{sheet.id}/entries/",
        {
            "work_date": d.isoformat(),
            "start_at": f"{d.isoformat()}T09:00:00Z",
            "end_at": f"{d.isoformat()}T17:00:00Z",
            "break_minutes": 30,
        },
    )
    assert day.status_code == 201
    return sheet


def _submit_sheet(api_client, user, d):
    """Day-submit + week-submit so the sheet is visible to reviewers."""
    c = authed(api_client, user)
    sheet = _sheet_with_entry(api_client, user, d)
    assert c.post(f"{TS}{sheet.id}/days/{d.isoformat()}/submit/").status_code == 200
    sheet.refresh_from_db()
    assert c.post(f"{TS}{sheet.id}/submit/", {"expected_version": sheet.version}).status_code == 200
    return sheet


class TestScopedList:
    def test_manager_sees_direct_reports_only(self, api_client, org, emp, emp2, manager, hr_user):
        _submit_sheet(api_client, emp, date(2026, 9, 14))
        _submit_sheet(api_client, emp2, date(2026, 9, 14))
        outsider = make_user(org, "outside@acme.test")
        make_profile(org, outsider, "E802")  # no manager — not a report
        _submit_sheet(api_client, outsider, date(2026, 9, 14))

        m = authed(api_client, manager)
        resp = m.get(TS)
        assert resp.status_code == 200
        employees = {r["employee_code"] for r in resp.json()["results"]}
        assert employees == {"E800", "E801"}

    def test_employee_sees_only_own(self, api_client, org, emp, emp2, manager, hr_user):
        _sheet_with_entry(api_client, emp, date(2026, 9, 14))
        _sheet_with_entry(api_client, emp2, date(2026, 9, 14))
        c = authed(api_client, emp)
        resp = c.get(TS)
        codes = {r["employee_code"] for r in resp.json()["results"]}
        assert codes == {"E800"}

    def test_foreign_org_invisible(self, api_client, org, other_org, emp, manager, hr_user):
        fu = make_user(other_org, "f@x.test")
        make_profile(other_org, fu, "F1")
        # foreign org needs its own HR for the two-stage route to resolve
        foreign_hr = make_user(other_org, "fhr@x.test")
        foreign_hr.groups.add(Group.objects.get(name=ROLE_HR))
        make_profile(other_org, foreign_hr, "F2")
        _submit_sheet(api_client, fu, date(2026, 9, 14))
        _submit_sheet(api_client, emp, date(2026, 9, 14))
        h = authed(api_client, hr_user)
        resp = h.get(TS)
        codes = {r["employee_code"] for r in resp.json()["results"]}
        assert "F1" not in codes
        # direct detail is a 404 too
        foreign_sheet = get_or_create_sheet(fu, date(2026, 9, 14))
        assert h.get(f"{TS}{foreign_sheet.id}/").status_code == 404

    def test_status_and_ordering_filters(self, api_client, emp, manager, hr_user):
        _sheet_with_entry(api_client, emp, date(2026, 9, 14))
        _sheet_with_entry(api_client, emp, date(2026, 9, 21))
        c = authed(api_client, emp)
        resp = c.get(f"{TS}?ordering=period_start")
        periods = [r["period_start"] for r in resp.json()["results"]]
        assert periods == sorted(periods)
        resp = c.get(f"{TS}?status=collecting")
        assert all(r["status"] == "collecting" for r in resp.json()["results"])
        resp = c.get(f"{TS}?ordering=bogus")
        assert resp.status_code == 400

    def test_period_filter(self, api_client, emp, hr_user):
        _sheet_with_entry(api_client, emp, date(2026, 9, 14))
        _sheet_with_entry(api_client, emp, date(2026, 9, 21))
        c = authed(api_client, emp)
        resp = c.get(f"{TS}?period=2026-09-15")
        results = resp.json()["results"]
        assert len(results) == 1
        assert results[0]["period_start"] == "2026-09-14"
        assert c.get(f"{TS}?period=not-a-date").status_code == 400


@pytest.mark.django_db
class TestQueryBudget:
    def test_list_bounded_queries(
        self, api_client, emp, manager, hr_user, django_assert_max_num_queries
    ):
        for week in range(6):
            _sheet_with_entry(api_client, emp, date(2026, 8, 3) + timedelta(weeks=week))
        c = authed(api_client, hr_user)
        with django_assert_max_num_queries(15):
            resp = c.get(TS)
        assert resp.status_code == 200

    def test_detail_bounded_queries(self, api_client, emp, hr_user, django_assert_max_num_queries):
        sheet = _sheet_with_entry(api_client, emp, date(2026, 9, 14))
        c = authed(api_client, emp)
        with django_assert_max_num_queries(15):
            resp = c.get(f"{TS}{sheet.id}/")
        assert resp.status_code == 200

    def test_history_bounded_queries(
        self, api_client, emp, manager, hr_user, django_assert_max_num_queries
    ):
        sheet = _sheet_with_entry(api_client, emp, date(2026, 9, 14))
        c = authed(api_client, emp)
        c.post(f"{TS}{sheet.id}/days/{D}/submit/")
        sheet.refresh_from_db()
        c.post(f"{TS}{sheet.id}/submit/", {"expected_version": sheet.version})
        with django_assert_max_num_queries(15):
            resp = c.get(f"{TS}{sheet.id}/history/")
        assert resp.status_code == 200
