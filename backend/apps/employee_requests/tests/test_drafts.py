"""T004 — draft create/edit, typed fields (D-006), ownership, protected fields."""

import pytest

from apps.conftest import TEST_PASSWORD, login
from apps.employee_requests.models import EmployeeRequest

pytestmark = pytest.mark.django_db

LIST = "/api/v1/requests/"
TYPES = "/api/v1/request-types/"


def detail(req_id):
    return f"{LIST}{req_id}/"


def authed(client, user):
    assert login(client, user, TEST_PASSWORD).status_code == 200
    return client


@pytest.fixture
def draft(employee, leave_type):
    return EmployeeRequest.objects.create(
        organization=employee.organization,
        employee=employee.profile,
        type=leave_type,
        title="Beach week",
        description="Family trip",
        start_date="2026-10-05",
        end_date="2026-10-09",
    )


class TestTypesEndpoint:
    def test_employee_sees_active_types_only(self, api_client, employee, leave_type, inactive_type):
        client = authed(api_client, employee)
        resp = client.get(TYPES)
        assert resp.status_code == 200
        codes = {t["code"] for t in resp.json()["results"]}
        assert "LEAVE" in codes and "OLD" not in codes

    def test_hr_sees_inactive_types(self, api_client, hr_user, inactive_type):
        client = authed(api_client, hr_user)
        resp = client.get(TYPES)
        codes = {t["code"] for t in resp.json()["results"]}
        assert "OLD" in codes

    def test_types_exclude_other_orgs(self, api_client, employee, leave_type, other_org_type):
        client = authed(api_client, employee)
        resp = client.get(TYPES)
        assert {t["code"] for t in resp.json()["results"]} == {"LEAVE"}


class TestDraftCreate:
    def test_create_valid_draft(self, api_client, employee, leave_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(leave_type.id),
                "title": "Eid leave",
                "description": "Family",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
            },
        )
        assert resp.status_code == 201, resp.json()
        body = resp.json()
        assert body["status"] == "draft"
        assert body["employee_email"] == "employee@acme.test"
        assert body["version"] == 1

    def test_equipment_requires_item_and_quantity(self, api_client, employee, equipment_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(equipment_type.id),
                "title": "Laptop",
                "description": "For remote work",
            },
        )
        assert resp.status_code == 400
        body = resp.json()
        assert "equipment_item" in body["field_errors"]
        assert "quantity" in body["field_errors"]

    def test_leave_requires_dates(self, api_client, employee, leave_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(leave_type.id),
                "title": "X",
                "description": "d",
            },
        )
        assert resp.status_code == 400
        assert "start_date" in resp.json()["field_errors"]

    def test_end_before_start_rejected(self, api_client, employee, leave_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(leave_type.id),
                "title": "X",
                "description": "d",
                "start_date": "2026-10-09",
                "end_date": "2026-10-05",
            },
        )
        assert resp.status_code == 400
        assert "end_date" in resp.json()["field_errors"]

    def test_unused_category_fields_rejected(self, api_client, employee, leave_type, general_type):
        client = authed(api_client, employee)
        # equipment fields on a leave request are invalid
        resp = client.post(
            LIST,
            {
                "type": str(leave_type.id),
                "title": "X",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
                "quantity": 2,
            },
        )
        assert resp.status_code == 400
        assert "quantity" in resp.json()["field_errors"]
        # dates on a general request are invalid
        resp = client.post(
            LIST,
            {
                "type": str(general_type.id),
                "title": "X",
                "description": "d",
                "start_date": "2026-10-05",
            },
        )
        assert resp.status_code == 400
        assert "start_date" in resp.json()["field_errors"]

    def test_inactive_type_rejected(self, api_client, employee, inactive_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(inactive_type.id),
                "title": "X",
                "description": "d",
            },
        )
        assert resp.status_code == 400
        assert "type" in resp.json()["field_errors"]

    def test_foreign_org_type_rejected(self, api_client, employee, other_org_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(other_org_type.id),
                "title": "X",
                "description": "d",
            },
        )
        assert resp.status_code == 400
        assert "type" in resp.json()["field_errors"]

    def test_protected_fields_rejected(self, api_client, employee, leave_type):
        client = authed(api_client, employee)
        for field, value in [
            ("status", "approved"),
            ("employee", "00000000-0000-0000-0000-000000000001"),
            ("organization", "00000000-0000-0000-0000-000000000001"),
            ("cycle", 3),
            ("submitted_at", "2026-01-01T00:00:00Z"),
        ]:
            resp = client.post(
                LIST,
                {
                    "type": str(leave_type.id),
                    "title": "X",
                    "description": "d",
                    "start_date": "2026-10-05",
                    "end_date": "2026-10-09",
                    field: value,
                },
            )
            assert resp.status_code == 400, field
            assert field in resp.json()["field_errors"], field


class TestDraftEdit:
    def test_owner_edits_own_draft(self, api_client, employee, draft):
        client = authed(api_client, employee)
        resp = client.patch(detail(draft.id), {"title": "New title", "version": 1})
        assert resp.status_code == 200, resp.json()
        assert resp.json()["title"] == "New title"
        assert resp.json()["version"] == 2

    def test_stale_version_conflict(self, api_client, employee, draft):
        client = authed(api_client, employee)
        resp = client.patch(detail(draft.id), {"title": "New", "version": 99})
        assert resp.status_code == 409

    def test_other_employee_cannot_edit(self, api_client, org, employee, draft):
        from apps.conftest import make_profile, make_user

        other = make_user(org, "other@acme.test")
        make_profile(org, other, "E009")
        client = authed(api_client, other)
        resp = client.patch(detail(draft.id), {"title": "Hijack", "version": 1})
        assert resp.status_code == 404
        resp = client.get(detail(draft.id))
        assert resp.status_code == 404

    def test_cannot_change_type_to_foreign_org(self, api_client, employee, draft, other_org_type):
        client = authed(api_client, employee)
        resp = client.patch(
            detail(draft.id),
            {
                "type": str(other_org_type.id),
                "version": 1,
            },
        )
        assert resp.status_code == 400
        assert "type" in resp.json()["field_errors"]


class TestDraftListScope:
    def test_employee_sees_only_own(self, api_client, org, employee, draft):
        from apps.conftest import make_profile, make_user

        other = make_user(org, "other@acme.test")
        other_profile = make_profile(org, other, "E009")
        EmployeeRequest.objects.create(
            organization=org,
            employee=other_profile,
            type=draft.type,
            title="Not mine",
        )
        client = authed(api_client, employee)
        resp = client.get(LIST)
        titles = {r["title"] for r in resp.json()["results"]}
        assert titles == {"Beach week"}

    def test_manager_sees_non_drafts_of_reports_only(
        self, api_client, org, employee, manager, draft
    ):
        # employee reports to manager
        employee.profile.manager = manager.profile
        employee.profile.save()
        client = authed(api_client, manager)
        resp = client.get(LIST)
        # draft is invisible to the manager even though employee is a direct report
        assert all(r["title"] != "Beach week" for r in resp.json()["results"])

    def test_hr_cannot_see_others_drafts(self, api_client, hr_user, draft):
        client = authed(api_client, hr_user)
        resp = client.get(LIST)
        assert all(r["title"] != "Beach week" for r in resp.json()["results"])

    def test_unauthenticated_rejected(self, api_client):
        assert api_client.get(LIST).status_code == 403
        assert api_client.post(LIST, {}).status_code == 403
