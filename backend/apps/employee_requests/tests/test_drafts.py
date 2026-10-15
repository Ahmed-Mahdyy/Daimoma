"""T004 — draft create/edit, typed fields (D-006), ownership, protected fields."""

from datetime import date

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
def unit_grant(org, employee, hr_user, unit_type):
    """A covering grant so allocation-gated draft creation succeeds."""
    from apps.employee_requests.allocations import create_grant

    return create_grant(
        hr_user, employee.profile, unit_type,
        date(2026, 10, 1), date(2026, 10, 31), 20,
    )


@pytest.fixture
def hour_grant(org, employee, hr_user, early_leave_type):
    """A covering grant so allocation-gated draft creation succeeds."""
    from apps.employee_requests.allocations import create_grant

    return create_grant(
        hr_user, employee.profile, early_leave_type,
        date(2026, 10, 1), date(2026, 10, 31), 480,
    )


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

    def test_undated_unit_type_requires_dates(self, api_client, employee, unit_type):
        # Non-item unit types count the quantity from the date range, so the
        # range is mandatory — there is no manual quantity input.
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(unit_type.id),
                "title": "Leave",
                "description": "Time off",
            },
        )
        assert resp.status_code == 400
        body = resp.json()
        assert "end_date" in body["field_errors"]

    def test_item_unit_type_keeps_manual_quantity(
        self, api_client, employee, hr_user, org
    ):
        # Item types (equipment) still take a hand-entered quantity; dates do
        # not override it.
        from apps.employee_requests.allocations import create_grant
        from apps.employee_requests.models import RequestType

        counted = RequestType.objects.create(
            organization=org, code="CNT", name="Counted item",
            unit="unit", requires_item=True,
        )
        create_grant(
            hr_user, employee.profile, counted,
            date(2026, 10, 1), date(2026, 10, 31), 10,
        )
        client = authed(api_client, employee)
        resp = client.post(
            LIST, {"type": str(counted.id), "title": "X", "description": "d"},
        )
        assert resp.status_code == 400
        assert "quantity" in resp.json()["field_errors"]
        resp = client.post(
            LIST,
            {
                "type": str(counted.id),
                "title": "X",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
                "quantity": 3,
            },
        )
        assert resp.status_code == 201, resp.json()
        assert resp.json()["quantity"] == 3

    def test_dated_unit_type_derives_quantity(
        self, api_client, employee, unit_type, unit_grant
    ):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(unit_type.id),
                "title": "Leave",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
                "quantity": 99,
            },
        )
        assert resp.status_code == 201, resp.json()
        # The submitted value is never authoritative — Mon–Fri counts 5.
        assert resp.json()["quantity"] == 5

    def test_dated_unit_type_counts_configured_weekdays(
        self, api_client, employee, unit_type, org, unit_grant
    ):
        org.working_weekdays = [0, 1, 2]  # Mon–Wed
        org.save(update_fields=["working_weekdays"])
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(unit_type.id),
                "title": "Leave",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
            },
        )
        assert resp.status_code == 201, resp.json()
        assert resp.json()["quantity"] == 3

    def test_update_rederives_quantity(self, api_client, employee, unit_type):
        client = authed(api_client, employee)
        req = EmployeeRequest.objects.create(
            organization=employee.organization,
            employee=employee.profile,
            type=unit_type,
            title="Leave",
            start_date="2026-10-05",
            end_date="2026-10-06",
            quantity=2,
        )
        resp = client.patch(detail(req.id), {"end_date": "2026-10-09"})
        assert resp.status_code == 200, resp.json()
        assert resp.json()["quantity"] == 5

    def test_no_grant_blocks_draft_creation(self, api_client, employee, unit_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(unit_type.id),
                "title": "Leave",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
            },
        )
        assert resp.status_code == 400
        assert "allocation" in str(resp.json()).lower()
        assert not EmployeeRequest.objects.filter(title="Leave").exists()

    def test_insufficient_balance_blocks_creation(
        self, api_client, employee, hr_user, unit_type
    ):
        from apps.employee_requests.allocations import create_grant

        # Only 2 available, the week needs 5.
        create_grant(
            hr_user, employee.profile, unit_type,
            date(2026, 10, 1), date(2026, 10, 31), 2,
        )
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(unit_type.id),
                "title": "Leave",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
            },
        )
        assert resp.status_code == 400
        assert "only 2 units remain" in str(resp.json())
        assert not EmployeeRequest.objects.filter(title="Leave").exists()

    def test_covering_grant_allows_draft(
        self, api_client, employee, unit_type, unit_grant
    ):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(unit_type.id),
                "title": "Leave",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
            },
        )
        assert resp.status_code == 201, resp.json()
        assert resp.json()["quantity"] == 5

    def test_dates_required_for_requires_dates_type(self, api_client, employee, org):
        from apps.employee_requests.models import RequestType

        wfh = RequestType.objects.create(
            organization=org, code="WFH", name="Work from home",
            unit="none", requires_dates=True,
        )
        client = authed(api_client, employee)
        resp = client.post(
            LIST, {"type": str(wfh.id), "title": "X", "description": "d"}
        )
        assert resp.status_code == 400
        assert "end_date" in resp.json()["field_errors"]
        resp = client.post(
            LIST,
            {
                "type": str(wfh.id),
                "title": "X",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
            },
        )
        assert resp.status_code == 201, resp.json()

    def test_opted_out_unit_type_needs_no_grant(self, api_client, employee, org):
        from apps.employee_requests.models import RequestType

        counted = RequestType.objects.create(
            organization=org, code="CNT", name="Counted",
            unit="unit", requires_allocation=False,
        )
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(counted.id),
                "title": "X",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
            },
        )
        assert resp.status_code == 201, resp.json()
        assert resp.json()["quantity"] == 5

    def test_non_allocation_type_needs_no_grant(self, api_client, employee, leave_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(leave_type.id),
                "title": "Note",
                "description": "d",
                "start_date": "2026-10-05",
                "end_date": "2026-10-09",
            },
        )
        assert resp.status_code == 201, resp.json()

    def test_partial_date_range_rejected(self, api_client, employee, leave_type):
        client = authed(api_client, employee)
        resp = client.post(
            LIST,
            {
                "type": str(leave_type.id),
                "title": "X",
                "description": "d",
                "start_date": "2026-10-05",
            },
        )
        assert resp.status_code == 400
        assert "end_date" in resp.json()["field_errors"]

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

    def test_amount_fields_rejected_on_none_type(self, api_client, employee, leave_type):
        client = authed(api_client, employee)
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
        resp = client.post(
            LIST,
            {
                "type": str(leave_type.id),
                "title": "X",
                "description": "d",
                "hours": "1.00",
            },
        )
        assert resp.status_code == 400
        assert "hours" in resp.json()["field_errors"]

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


class TestHourType:
    """Hour-unit type: the billed amount derives from the from/to times on a
    single day (15-minute blocks, 30-minute minimum); a submitted `hours`
    value is ignored."""

    def payload(self, early_leave_type, **kw):
        return {
            "type": str(early_leave_type.id),
            "title": "Leaving early",
            "description": "Appointment",
            "start_date": "2026-10-05",
            "start_time": "14:00",
            "end_time": "15:30",
            **kw,
        }

    def test_create_valid_hour_request(
        self, api_client, employee, early_leave_type, hour_grant
    ):
        client = authed(api_client, employee)
        resp = client.post(LIST, self.payload(early_leave_type))
        assert resp.status_code == 201, resp.json()
        body = resp.json()
        assert body["hours"] == "1.50"
        assert body["start_date"] == "2026-10-05"

    def test_times_required(self, api_client, employee, early_leave_type):
        client = authed(api_client, employee)
        body = self.payload(early_leave_type)
        del body["start_time"]
        del body["end_time"]
        resp = client.post(LIST, body)
        assert resp.status_code == 400
        assert "end_time" in resp.json()["field_errors"]

    def test_date_required(self, api_client, employee, early_leave_type):
        client = authed(api_client, employee)
        body = self.payload(early_leave_type)
        del body["start_date"]
        resp = client.post(LIST, body)
        assert resp.status_code == 400
        assert "start_date" in resp.json()["field_errors"]

    def test_submitted_hours_ignored(
        self, api_client, employee, early_leave_type, hour_grant
    ):
        """The user's bug: a forged hours value must not override the times."""
        client = authed(api_client, employee)
        resp = client.post(LIST, self.payload(early_leave_type, hours="99.00"))
        assert resp.status_code == 201, resp.json()
        assert resp.json()["hours"] == "1.50"

    def test_hours_round_up_to_quarter(
        self, api_client, employee, early_leave_type, hour_grant
    ):
        client = authed(api_client, employee)
        resp = client.post(
            LIST, self.payload(early_leave_type, end_time="14:20")
        )
        assert resp.status_code == 201, resp.json()
        # 20 elapsed minutes bill the 30-minute minimum.
        assert resp.json()["hours"] == "0.50"

    def test_times_with_seconds_rejected(
        self, api_client, employee, early_leave_type
    ):
        client = authed(api_client, employee)
        resp = client.post(
            LIST, self.payload(early_leave_type, end_time="15:30:30")
        )
        assert resp.status_code == 400
        assert "end_time" in resp.json()["field_errors"]

    def test_multi_day_range_rejected(
        self, api_client, employee, early_leave_type
    ):
        client = authed(api_client, employee)
        resp = client.post(
            LIST, self.payload(early_leave_type, end_date="2026-10-06")
        )
        assert resp.status_code == 400
        assert "end_date" in resp.json()["field_errors"]

    def test_quantity_rejected_on_hour_type(self, api_client, employee, early_leave_type):
        client = authed(api_client, employee)
        resp = client.post(LIST, self.payload(early_leave_type, quantity=2))
        assert resp.status_code == 400
        assert "quantity" in resp.json()["field_errors"]

    def test_unpaired_time_rejected(self, api_client, employee, early_leave_type):
        client = authed(api_client, employee)
        body = self.payload(early_leave_type)
        del body["end_time"]
        resp = client.post(LIST, body)
        assert resp.status_code == 400
        assert "end_time" in resp.json()["field_errors"]


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


BULK = "/api/v1/requests/bulk-delete/"


class TestDraftDelete:
    """Draft deletion is owner-only and draft-only; submitted work has a
    review trail and must be decided, never deleted."""

    def test_owner_deletes_own_draft(self, api_client, employee, draft):
        client = authed(api_client, employee)
        resp = client.delete(detail(draft.pk))
        assert resp.status_code == 204
        assert not EmployeeRequest.objects.filter(pk=draft.pk).exists()

    def test_other_users_draft_is_not_visible(self, api_client, draft):
        # Drafts are out of every non-owner's scope — non-enumerating 404.
        from apps.conftest import make_profile, make_user
        other = make_user(draft.organization, "other@acme.test")
        make_profile(draft.organization, other, "E009")
        client = authed(api_client, other)
        assert client.delete(detail(draft.pk)).status_code == 404
        assert EmployeeRequest.objects.filter(pk=draft.pk).exists()

    def test_hr_cannot_delete_others_draft(self, api_client, hr_user, draft):
        client = authed(api_client, hr_user)
        assert client.delete(detail(draft.pk)).status_code == 404
        assert EmployeeRequest.objects.filter(pk=draft.pk).exists()

    def test_non_draft_cannot_be_deleted(self, api_client, employee, draft):
        draft.status = EmployeeRequest.Status.PENDING_MANAGER
        draft.save()
        client = authed(api_client, employee)
        assert client.delete(detail(draft.pk)).status_code == 400
        assert EmployeeRequest.objects.filter(pk=draft.pk).exists()

    def test_manager_cannot_delete_reports_request(
        self, api_client, org, employee, manager, draft
    ):
        employee.profile.manager = manager.profile
        employee.profile.save()
        draft.status = EmployeeRequest.Status.PENDING_MANAGER
        draft.save()
        client = authed(api_client, manager)
        # In scope (non-draft report request) but not owned -> 403.
        assert client.delete(detail(draft.pk)).status_code == 403
        assert EmployeeRequest.objects.filter(pk=draft.pk).exists()

    def test_bulk_deletes_only_own_drafts(self, api_client, org, employee, draft, leave_type):
        from apps.conftest import make_profile, make_user

        other = make_user(org, "other@acme.test")
        other_profile = make_profile(org, other, "E009")
        others_draft = EmployeeRequest.objects.create(
            organization=org, employee=other_profile, type=leave_type, title="Not mine"
        )
        submitted = EmployeeRequest.objects.create(
            organization=org,
            employee=employee.profile,
            type=leave_type,
            title="Submitted",
            status=EmployeeRequest.Status.PENDING_MANAGER,
        )
        second_draft = EmployeeRequest.objects.create(
            organization=org, employee=employee.profile, type=leave_type, title="Mine 2"
        )
        client = authed(api_client, employee)
        resp = client.post(
            BULK,
            {"ids": [str(draft.pk), str(second_draft.pk), str(others_draft.pk), str(submitted.pk)]},
            format="json",
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["deleted"] == 2
        assert set(body["skipped"]) == {str(others_draft.pk), str(submitted.pk)}
        remaining = set(
            EmployeeRequest.objects.values_list("id", flat=True)
        )
        assert remaining == {others_draft.pk, submitted.pk}

    def test_bulk_rejects_invalid_payload(self, api_client, employee):
        client = authed(api_client, employee)
        assert client.post(BULK, {"ids": []}, format="json").status_code == 400
        assert client.post(BULK, {"ids": ["not-a-uuid"]}, format="json").status_code == 400
        assert client.post(BULK, {}, format="json").status_code == 400

    def test_bulk_cross_org_skipped(self, api_client, employee, other_org, other_org_type):
        from apps.conftest import make_profile, make_user

        foreign = make_user(other_org, "foreign@acme.test")
        foreign_profile = make_profile(other_org, foreign, "F001")
        foreign_draft = EmployeeRequest.objects.create(
            organization=other_org,
            employee=foreign_profile,
            type=other_org_type,
            title="Foreign",
        )
        client = authed(api_client, employee)
        resp = client.post(BULK, {"ids": [str(foreign_draft.pk)]}, format="json")
        assert resp.status_code == 200
        assert resp.json() == {"deleted": 0, "skipped": [str(foreign_draft.pk)]}
        assert EmployeeRequest.objects.filter(pk=foreign_draft.pk).exists()

    def test_unauthenticated_delete_rejected(self, api_client, draft):
        assert api_client.delete(detail(draft.pk)).status_code == 403
        assert api_client.post(BULK, {"ids": [str(draft.pk)]}, format="json").status_code == 403
