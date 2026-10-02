"""T008 — bounded, sanitized CSV exports (FR-004, FR-008).
Exports reuse the report selectors exactly: same scope, same filters."""

import csv
import io
from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from apps.conftest import TEST_PASSWORD, login, make_user
from apps.employee_requests.services import create_draft, submit_request

HOURS_CSV = "/api/v1/reports/working-hours/export/"
REQ_CSV = "/api/v1/reports/requests/export/"

pytestmark = pytest.mark.django_db


def authed(user):
    c = APIClient()
    assert login(c, user, TEST_PASSWORD).status_code == 200
    return c


W = {"from": "2026-09-14", "to": "2026-09-20"}
_today = date.today()
RW = {
    "from": (_today - timedelta(days=7)).isoformat(),
    "to": _today.isoformat(),
}


def rows(resp):
    assert resp["Content-Type"].startswith("text/csv")
    return list(csv.reader(io.StringIO(resp.content.decode())))


class TestHoursExport:
    def test_manager_csv_matches_report_rows(self, reporting_dataset):
        resp = authed(reporting_dataset["mgr"]).get(HOURS_CSV, W)
        assert resp.status_code == 200
        data = rows(resp)
        header, body = data[0], data[1:]
        assert "minutes" in header and "work_date" in header
        assert len(body) == 1
        assert body[0][header.index("minutes")] == "450"
        assert body[0][header.index("employee_code")] == "E001"

    def test_employee_cannot_export(self, reporting_dataset):
        resp = authed(reporting_dataset["emp1"]).get(HOURS_CSV, W)
        assert resp.status_code == 403

    def test_export_respects_filters(self, reporting_dataset):
        resp = authed(reporting_dataset["mgr"]).get(HOURS_CSV, {**W, "status": "pending_manager"})
        data = rows(resp)
        assert len(data) == 2  # header + emp2's 240-min row


class TestRequestExport:
    def test_request_csv_rows(self, reporting_dataset):
        resp = authed(reporting_dataset["hr"]).get(REQ_CSV, RW)
        assert resp.status_code == 200
        data = rows(resp)
        assert len(data) == 6  # header + 5 submitted requests
        header = data[0]
        titles = [r[header.index("title")] for r in data[1:]]
        assert "question" not in titles  # drafts excluded

    def test_manager_export_excludes_non_reports(self, reporting_dataset):
        resp = authed(reporting_dataset["mgr"]).get(REQ_CSV, RW)
        data = rows(resp)
        header = data[0]
        titles = [r[header.index("title")] for r in data[1:]]
        assert "certificate" not in titles  # lone is not mgr's report


class TestExportSafety:
    def test_formula_injection_neutralized(self, reporting_dataset, api_client):
        """A title crafted as a spreadsheet formula must not survive as an
        executable cell (leading =, +, -, @, tab/CR, or whitespace-hidden)."""
        ds = reporting_dataset
        evil = make_user(ds["org"], "evil@acme.test")
        from apps.conftest import make_profile

        make_profile(ds["org"], evil, "E999", manager=ds["mgr"].profile)
        req = create_draft(
            evil,
            {
                "type": str(ds["types"]["general"].pk),
                "title": '=HYPERLINK("http://evil","click")',
                "description": "  +SUM(A1:A9)",
            },
        )
        submit_request(req, evil)
        resp = authed(ds["hr"]).get(REQ_CSV, RW)
        data = resp.content.decode()
        for line in data.splitlines():
            for cell in next(csv.reader([line])):
                stripped = cell.lstrip()
                assert not stripped.startswith(("=", "+", "@"))
                assert "\t" not in cell[:1] and "\r" not in cell[:1]
        assert "'=HYPERLINK" in data or "\"'=HYPERLINK" in data

    def test_export_range_cap(self, reporting_dataset):
        resp = authed(reporting_dataset["hr"]).get(
            REQ_CSV, {"from": "2020-01-01", "to": "2026-10-02"}
        )
        assert resp.status_code == 400

    def test_export_row_cap_fails_loudly(self, reporting_dataset, monkeypatch):
        """Over the row cap → validation error, never silent truncation."""
        from apps.reporting import selectors

        monkeypatch.setattr(selectors, "EXPORT_ROW_LIMIT", 1)
        resp = authed(reporting_dataset["hr"]).get(REQ_CSV, RW)
        assert resp.status_code == 400
