"""T013 — bounded-query budgets for reporting endpoints (FR-003, FR-008).
Aggregations must stay O(1) in rows returned: a dashboard is a handful of
aggregate queries regardless of dataset size; a report page is one grouped
query plus pagination overhead — never per-row lookups."""

import pytest
from rest_framework.test import APIClient

from apps.conftest import TEST_PASSWORD, login

pytestmark = pytest.mark.django_db


def authed(user):
    c = APIClient()
    assert login(c, user, TEST_PASSWORD).status_code == 200
    return c


class TestQueryBudgets:
    def test_personal_dashboard_is_bounded(self, reporting_dataset, django_assert_num_queries):
        c = authed(reporting_dataset["emp1"])
        # session + user + profile + org + req counts + sheet counts +
        # minutes aggregate + 2 pending-review counts + session write —
        # all constant regardless of dataset size.
        with django_assert_num_queries(12):
            resp = c.get(
                "/api/v1/dashboards/personal/",
                {"from": "2026-09-14", "to": "2026-09-20"},
            )
        assert resp.status_code == 200

    def test_org_dashboard_is_bounded(self, reporting_dataset, django_assert_num_queries):
        c = authed(reporting_dataset["hr"])
        # As personal + 2 role-group lookups (is_hr/is_manager), still O(1).
        with django_assert_num_queries(13):
            resp = c.get(
                "/api/v1/dashboards/organization/",
                {"from": "2026-09-14", "to": "2026-09-20"},
            )
        assert resp.status_code == 200

    def test_hours_report_is_bounded(self, reporting_dataset, django_assert_num_queries):
        c = authed(reporting_dataset["mgr"])
        with django_assert_num_queries(12):
            resp = c.get(
                "/api/v1/reports/working-hours/",
                {"from": "2026-09-14", "to": "2026-09-20"},
            )
        assert resp.status_code == 200

    def test_requests_report_is_bounded(self, reporting_dataset, django_assert_num_queries):
        c = authed(reporting_dataset["hr"])
        with django_assert_num_queries(10):
            resp = c.get(
                "/api/v1/reports/requests/",
                {"from": "2026-09-01", "to": "2026-10-02"},
            )
        assert resp.status_code == 200
