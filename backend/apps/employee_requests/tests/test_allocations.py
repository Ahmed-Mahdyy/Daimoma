from datetime import UTC, date, time, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.conftest import login, make_profile, make_user
from apps.employee_requests.models import EmployeeRequest, RequestType
from apps.employee_requests.services import review_request, submit_request

pytestmark = pytest.mark.django_db


@pytest.fixture
def allocation_cast(org):
    Group.objects.get_or_create(name=ROLE_HR)
    Group.objects.get_or_create(name=ROLE_MANAGER)
    employee = make_user(org, "allocation-employee@acme.test")
    profile = make_profile(org, employee, "A100")
    manager = make_user(org, "allocation-manager@acme.test")
    manager.groups.add(Group.objects.get(name=ROLE_MANAGER))
    profile.manager = make_profile(org, manager, "A101")
    profile.save(update_fields=["manager"])
    hr = make_user(org, "allocation-hr@acme.test")
    hr.groups.add(Group.objects.get(name=ROLE_HR))
    make_profile(org, hr, "A102")
    return employee, manager, hr


def test_existing_types_and_requests_do_not_require_allocations(org, allocation_cast):
    employee, _, _ = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="OLD", name="Old leave", unit="none"
    )
    assert req_type.requires_allocation is False
    req = EmployeeRequest.objects.create(
        organization=org,
        employee=employee.profile,
        type=req_type,
        title="Earlier request",
        start_date=date(2026, 10, 5),
        end_date=date(2026, 10, 5),
    )
    submit_request(req, employee)
    assert not req.allocation_commitments.exists()


def test_unit_request_charges_quantity():
    from apps.employee_requests.allocations import amount_for_request

    req = EmployeeRequest(type=RequestType(unit="unit"), quantity=2)
    assert amount_for_request(req) == 2
    req.quantity = None
    with pytest.raises(ValidationError):
        amount_for_request(req)


def test_dated_unit_request_derives_working_day_quantity(org):
    from apps.employee_requests.allocations import amount_for_request

    req_type = RequestType(organization=org, code="L", name="Leave", unit="unit")
    # Mon 2026-10-05 → Sun 2026-10-11 inclusive: 7 calendar days.
    req = EmployeeRequest(
        organization=org, type=req_type, quantity=99,
        start_date=date(2026, 10, 5), end_date=date(2026, 10, 11),
    )
    # The submitted quantity is never authoritative for dated requests.
    assert amount_for_request(req) == 7
    org.working_weekdays = [0, 1, 2, 3, 4]  # Mon–Fri
    assert amount_for_request(req) == 5
    # Sat–Sun only → no configured working day in range.
    req.start_date = date(2026, 10, 10)
    req.end_date = date(2026, 10, 11)
    with pytest.raises(ValidationError):
        amount_for_request(req)


def test_hour_request_charges_whole_minutes():
    from apps.employee_requests.allocations import amount_for_request

    req = EmployeeRequest(type=RequestType(unit="hour"), hours=Decimal("0.50"))
    assert amount_for_request(req) == 30
    req.hours = Decimal("0.75")
    assert amount_for_request(req) == 45
    req.hours = Decimal("2.00")
    assert amount_for_request(req) == 120
    req.hours = None
    with pytest.raises(ValidationError):
        amount_for_request(req)


def test_hour_request_charges_derived_times():
    """The billed amount comes from the from/to times — stored hours are a
    fallback for rows saved before derivation only."""
    from apps.employee_requests.allocations import amount_for_request

    req = EmployeeRequest(
        type=RequestType(unit="hour"),
        start_time=time(14, 0),
        end_time=time(15, 30),
        hours=Decimal("99.00"),
    )
    assert amount_for_request(req) == 90
    req.end_time = time(14, 20)
    assert amount_for_request(req) == 30


def test_submission_reserves_and_final_approval_uses_grant(org, allocation_cast):
    from apps.employee_requests.models import EmployeeAllocationGrant

    employee, manager, _ = allocation_cast
    req_type = RequestType.objects.create(
        organization=org,
        code="ALLOC",
        name="Allocated leave",
        unit="unit",
    )
    grant = EmployeeAllocationGrant.objects.create(
        organization=org,
        employee=employee.profile,
        request_type=req_type,
        unit="unit",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 31),
        initial_amount=10,
    )
    req = EmployeeRequest.objects.create(
        organization=org,
        employee=employee.profile,
        type=req_type,
        title="Allocated units",
        start_date=date(2026, 10, 5),
        end_date=date(2026, 10, 6),
        quantity=2,
    )
    submit_request(req, employee)
    commitment = req.allocation_commitments.get(cycle=1)
    assert (commitment.grant_id, commitment.amount, commitment.disposition) == (
        grant.id,
        2,
        "reserved",
    )
    review_request(req, manager, "approve")
    commitment.refresh_from_db()
    assert commitment.disposition == "used"


def test_hr_can_adjust_edit_and_remove_unused_grant(org, allocation_cast):
    from apps.employee_requests.allocations import (
        adjust_grant,
        create_grant,
        edit_grant_dates,
        grant_totals,
        void_grant,
    )

    employee, _, hr = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="EQ", name="Equipment", unit="unit",
    )
    grant = create_grant(hr, employee.profile, req_type, date(2026, 10, 1), date(2026, 10, 31), 2)
    adjust_grant(hr, grant.pk, 1, "Annual replacement", grant.version)
    grant.refresh_from_db()
    assert grant_totals(grant) == {"granted": 3, "reserved": 0, "used": 0, "remaining": 3}
    edit_grant_dates(
        hr, grant.pk, date(2026, 10, 2), date(2026, 11, 1), "Correct dates", grant.version
    )
    grant.refresh_from_db()
    assert grant.changes.filter(action="dates_changed").count() == 1
    void_grant(hr, grant.pk, "Awarded to wrong employee", grant.version)
    grant.refresh_from_db()
    assert grant.status == "void"
    assert grant.changes.filter(action="voided").count() == 1
    assert grant.adjustments.count() == 1


def test_hr_cannot_remove_used_grant(org, allocation_cast):
    from apps.employee_requests.allocations import create_grant, void_grant

    employee, manager, hr = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="EQ", name="Equipment", unit="unit",
    )
    today = date.today()
    grant = create_grant(
        hr, employee.profile, req_type,
        today - timedelta(days=2), today + timedelta(days=2), 1,
    )
    req = EmployeeRequest.objects.create(
        organization=org, employee=employee.profile, type=req_type,
        title="Keyboard", equipment_item="Keyboard", quantity=1,
    )
    submit_request(req, employee)
    review_request(req, manager, "approve")
    with pytest.raises(ValidationError):
        void_grant(hr, grant.pk, "Wrong award", grant.version)
    grant.refresh_from_db()
    assert grant.status == "active"


def test_overlapping_active_grants_rejected(org, allocation_cast):
    from apps.employee_requests.allocations import create_grant

    employee, _, hr = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="EQ", name="Equipment", unit="unit",
    )
    create_grant(hr, employee.profile, req_type, date(2026, 10, 1), date(2026, 10, 31), 2)
    with pytest.raises(ValidationError):
        create_grant(hr, employee.profile, req_type, date(2026, 10, 31), date(2026, 11, 30), 2)


def test_hr_grant_list_and_employee_self_visibility(api_client, org, allocation_cast):
    from apps.employee_requests.allocations import create_grant

    employee, manager, hr = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="EQ", name="Equipment", unit="unit",
    )
    grant = create_grant(hr, employee.profile, req_type, date(2026, 10, 1), date(2026, 10, 31), 2)
    assert login(api_client, employee).status_code == 200
    mine = api_client.get("/api/v1/allocations/mine/")
    assert mine.status_code == 200
    assert mine.json()["results"][0]["id"] == str(grant.pk)
    assert api_client.get(f"/api/v1/allocations/{grant.pk}/").status_code == 200
    assert api_client.post("/api/v1/allocations/", {}).status_code == 403
    assert login(api_client, manager).status_code == 200
    assert api_client.get(f"/api/v1/allocations/{grant.pk}/").status_code == 404
    assert login(api_client, hr).status_code == 200
    assert api_client.get("/api/v1/allocations/").json()["results"][0]["id"] == str(grant.pk)


def test_other_organization_grant_does_not_leak(api_client, allocation_cast, other_org):
    from apps.employee_requests.models import EmployeeAllocationGrant

    _, _, hr = allocation_cast
    foreign_user = make_user(other_org, "foreign-allocation@other.test")
    foreign = make_profile(other_org, foreign_user, "F100")
    foreign_type = RequestType.objects.create(
        organization=other_org, code="EQ", name="Equipment", unit="unit",
    )
    grant = EmployeeAllocationGrant.objects.create(
        organization=other_org, employee=foreign, request_type=foreign_type,
        unit="unit", start_date=date(2026, 10, 1), end_date=date(2026, 10, 31),
        initial_amount=2,
    )
    assert login(api_client, hr).status_code == 200
    assert api_client.get("/api/v1/allocations/").json()["count"] == 0
    assert api_client.get(f"/api/v1/allocations/{grant.pk}/").status_code == 404
    assert api_client.post(
        f"/api/v1/allocations/{grant.pk}/void/", {"reason": "x", "version": 1}
    ).status_code == 404


def test_grant_list_search_matches_employee_and_type(api_client, org, allocation_cast, other_org):
    from apps.employee_requests.allocations import create_grant
    from apps.employee_requests.models import EmployeeAllocationGrant

    employee, _, hr = allocation_cast
    employee.profile.display_name = "Nadia Saleh"
    employee.profile.save(update_fields=["display_name"])
    eq = RequestType.objects.create(
        organization=org, code="EQ", name="Equipment", unit="unit",
    )
    wfh = RequestType.objects.create(
        organization=org, code="WFH", name="Remote days", unit="unit",
    )
    grant = create_grant(hr, employee.profile, eq, date(2026, 10, 1), date(2026, 10, 31), 2)
    other = create_grant(hr, employee.profile, wfh, date(2026, 10, 1), date(2026, 10, 31), 3)
    both = {str(grant.pk), str(other.pk)}

    foreign = make_profile(other_org, make_user(other_org, "nadia-clone@other.test"), "F200")
    foreign_type = RequestType.objects.create(
        organization=other_org, code="EQ", name="Equipment", unit="unit",
    )
    EmployeeAllocationGrant.objects.create(
        organization=other_org, employee=foreign, request_type=foreign_type,
        unit="unit", start_date=date(2026, 10, 1), end_date=date(2026, 10, 31),
        initial_amount=2,
    )

    assert login(api_client, hr).status_code == 200
    url = "/api/v1/allocations/"

    # Employee name, code and email all match both of the employee's grants.
    for term in ("nadia", "A100", "allocation-employee@acme.test"):
        results = api_client.get(url, {"search": term}).json()["results"]
        assert {r["id"] for r in results} == both
    # Type name narrows to a single grant.
    by_type = api_client.get(url, {"search": "equipment"}).json()["results"]
    assert [r["id"] for r in by_type] == [str(grant.pk)]
    # No-match and cross-org isolation.
    assert api_client.get(url, {"search": "no-such-thing"}).json()["count"] == 0
    assert api_client.get(url, {"search": "nadia-clone"}).json()["count"] == 0


def test_preview_shows_billed_minutes_without_reserving(api_client, org, allocation_cast):
    from apps.employee_requests.allocations import create_grant

    employee, _, hr = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="EARLY", name="Early leave", unit="hour",
    )
    grant = create_grant(
        hr, employee.profile, req_type, date(2026, 10, 1), date(2026, 10, 31), 240
    )
    assert login(api_client, employee).status_code == 200
    resp = api_client.get("/api/v1/requests/allocation-preview/", {
        "type": str(req_type.pk), "start_date": "2026-10-05",
        "end_date": "2026-10-05", "start_time": "14:00", "end_time": "14:45",
    })
    assert resp.status_code == 200, resp.content
    assert resp.json()["amount"] == 45
    assert resp.json()["remaining"] == 240
    assert resp.json()["status"] == "available"
    assert grant.commitments.count() == 0


def test_hr_grant_api_edits_are_audited(api_client, org, allocation_cast):
    employee, _, hr = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="EQ", name="Equipment", unit="unit",
    )
    assert login(api_client, hr).status_code == 200
    resp = api_client.post("/api/v1/allocations/", {
        "employee": str(employee.profile.pk), "request_type": str(req_type.pk),
        "start_date": "2026-10-01", "end_date": "2026-10-31", "initial_amount": 2,
    })
    assert resp.status_code == 201, resp.content
    grant_id, version = resp.json()["id"], resp.json()["version"]
    resp = api_client.patch(f"/api/v1/allocations/{grant_id}/", {
        "start_date": "2026-10-02", "end_date": "2026-10-31",
        "reason": "Correct date", "version": version,
    })
    assert resp.status_code == 200, resp.content
    resp = api_client.post(f"/api/v1/allocations/{grant_id}/adjust/", {
        "delta": -1, "reason": "Correct award", "version": resp.json()["version"],
    })
    assert resp.status_code == 200, resp.content
    assert resp.json()["granted"] == 1
    history = api_client.get(f"/api/v1/allocations/{grant_id}/changes/").json()
    assert history["results"][0]["reason"] == "Correct date"
    adjustments = api_client.get(f"/api/v1/allocations/{grant_id}/adjustments/").json()
    assert adjustments["results"][0]["delta"] == -1
    resp = api_client.post(f"/api/v1/allocations/{grant_id}/void/", {
        "reason": "Wrong employee", "version": resp.json()["version"],
    })
    assert resp.status_code == 200, resp.content
    assert resp.json()["status"] == "void"
    assert api_client.get("/api/v1/allocations/?status=void").json()["count"] == 1


def test_return_releases_and_resubmit_reserves_new_cycle(org, allocation_cast):
    from apps.employee_requests.allocations import create_grant, grant_totals

    employee, manager, hr = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="LEAVE-ALLOC", name="Leave", unit="unit",
    )
    grant = create_grant(
        hr, employee.profile, req_type, date(2026, 10, 1), date(2026, 10, 31), 3
    )
    req = EmployeeRequest.objects.create(
        organization=org, employee=employee.profile, type=req_type,
        title="Leave", start_date=date(2026, 10, 5), end_date=date(2026, 10, 6),
        quantity=2,
    )
    submit_request(req, employee)
    assert grant_totals(grant)["remaining"] == 1
    review_request(req, manager, "return", reason="Change dates")
    assert grant_totals(grant)["remaining"] == 3
    assert req.allocation_commitments.get(cycle=1).disposition == "released"
    # Dated unit requests derive the charge from the range — shortening the
    # dates to a single day is how the employee "edits" the quantity.
    req.end_date = req.start_date
    req.save(update_fields=["end_date"])
    submit_request(req, employee)
    assert req.allocation_commitments.get(cycle=2).amount == 1
    assert grant_totals(grant)["remaining"] == 2


def test_expired_grant_blocks_new_submission_but_not_pending_review(
    org, allocation_cast, monkeypatch
):
    from datetime import datetime

    from apps.employee_requests.allocations import create_grant

    employee, manager, hr = allocation_cast
    req_type = RequestType.objects.create(
        organization=org, code="LEAVE-ALLOC", name="Leave", unit="unit",
    )
    grant = create_grant(
        hr, employee.profile, req_type, date(2026, 10, 1), date(2026, 10, 31), 3
    )
    monkeypatch.setattr(
        "apps.employee_requests.allocations.timezone.now",
        lambda: datetime(2026, 10, 30, 9, 0, tzinfo=UTC),
    )
    req = EmployeeRequest.objects.create(
        organization=org, employee=employee.profile, type=req_type,
        title="Leave", start_date=date(2026, 10, 30), end_date=date(2026, 10, 30),
        quantity=1,
    )
    submit_request(req, employee)
    monkeypatch.setattr(
        "apps.employee_requests.allocations.timezone.now",
        lambda: datetime(2026, 11, 1, 9, 0, tzinfo=UTC),
    )
    review_request(req, manager, "return", reason="Correct title")
    assert req.allocation_commitments.get(cycle=1).disposition == "released"
    with pytest.raises(ValidationError):
        submit_request(req, employee)
    assert grant.commitments.count() == 1
    req.refresh_from_db()
    assert req.cycle == 1
