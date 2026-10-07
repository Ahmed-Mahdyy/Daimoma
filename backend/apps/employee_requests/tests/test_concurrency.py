"""T004 (006) — true multi-connection race tests for request workflows:
threads with separate PostgreSQL connections, not a rolled-back transaction.
Exactly one decision/submission must win every race — no double decisions,
no lost transitions, no corrupted steps."""

import threading
from datetime import date, timedelta

import pytest
from config.exceptions import ConflictError
from django.contrib.auth.models import Group
from django.db import connections
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.conftest import make_profile, make_user
from apps.employee_requests.allocations import adjust_grant, create_grant, grant_totals
from apps.employee_requests.models import EmployeeRequest, RequestType
from apps.employee_requests.services import (
    create_draft,
    review_request,
    submit_request,
)

pytestmark = pytest.mark.django_db(transaction=True)


def run_in_threads(*fns):
    """Run callables on threads with isolated DB connections.
    Returns (results, errors) lists aligned with `fns`."""
    results, errors = [None] * len(fns), [None] * len(fns)

    def wrapper(i, fn):
        try:
            results[i] = fn()
        except Exception as exc:  # noqa: BLE001 - capture to assert in main thread
            errors[i] = exc
        finally:
            connections["default"].close()

    threads = [threading.Thread(target=wrapper, args=(i, fn)) for i, fn in enumerate(fns)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    return results, errors


@pytest.fixture
def roles():
    """transaction=True truncates migration-seeded groups between tests."""
    Group.objects.get_or_create(name=ROLE_MANAGER)
    Group.objects.get_or_create(name=ROLE_HR)


@pytest.fixture
def cast(roles, org):
    emp_user = make_user(org, "race-emp@acme.test")
    emp = make_profile(org, emp_user, "R001")
    mgr_user = make_user(org, "race-mgr@acme.test")
    mgr_user.groups.add(Group.objects.get(name=ROLE_MANAGER))
    mgr = make_profile(org, mgr_user, "R002")
    emp.manager = mgr
    emp.save(update_fields=["manager"])
    hr = make_user(org, "race-hr@acme.test")
    hr.groups.add(Group.objects.get(name=ROLE_HR))
    make_profile(org, hr, "R003")
    rtype = RequestType.objects.create(
        organization=org,
        code="leave",
        name="Leave",
        unit="none",
        requires_hr=True,
        is_active=True,
    )
    return emp_user, mgr_user, hr, rtype


def _draft(emp_user, rtype, title="leave"):
    return create_draft(
        emp_user,
        {
            "type": str(rtype.pk),
            "title": title,
            "start_date": "2026-09-15",
            "end_date": "2026-09-15",
        },
    )


def _submitted(emp_user, rtype):
    req = _draft(emp_user, rtype)
    submit_request(req, emp_user)
    req.refresh_from_db()
    return req


class TestConcurrentSubmission:
    def test_duplicate_submit_single_cycle(self, cast, org):
        emp_user, _, _, rtype = cast
        req = _draft(emp_user, rtype)
        results, errors = run_in_threads(
            lambda: submit_request(req, emp_user),
            lambda: submit_request(req, emp_user),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert sum(isinstance(e, ConflictError) for e in errors) == 1
        req.refresh_from_db()
        assert req.status == EmployeeRequest.Status.PENDING_MANAGER
        assert req.cycle == 1
        assert req.steps.count() == 2  # manager + HR steps, created once

    def test_stale_version_submit_loses(self, cast, org):
        emp_user, _, _, rtype = cast
        req = _draft(emp_user, rtype)
        results, errors = run_in_threads(
            lambda: submit_request(req, emp_user, expected_version=req.version),
            lambda: submit_request(req, emp_user, expected_version=req.version),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert sum(isinstance(e, ConflictError) for e in errors) == 1


class TestConcurrentReview:
    def test_approve_vs_return_single_outcome(self, cast, org):
        emp_user, mgr_user, _, rtype = cast
        req = _submitted(emp_user, rtype)
        results, errors = run_in_threads(
            lambda: review_request(req, mgr_user, "approve", expected_version=req.version),
            lambda: review_request(
                req,
                mgr_user,
                "return",
                reason="fix dates",
                expected_version=req.version,
            ),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert sum(isinstance(e, (ConflictError, PermissionDenied)) for e in errors) == 1
        req.refresh_from_db()
        assert req.status in (
            EmployeeRequest.Status.PENDING_HR,
            EmployeeRequest.Status.RETURNED,
        )
        # submit event + exactly one decision event — never both.
        assert req.events.count() == 2
        decided = req.steps.filter(cycle=1, status__in=("approved", "returned"))
        assert decided.count() == 1

    def test_double_approve_single_outcome(self, cast, org):
        emp_user, mgr_user, _, rtype = cast
        req = _submitted(emp_user, rtype)
        results, errors = run_in_threads(
            lambda: review_request(req, mgr_user, "approve", expected_version=req.version),
            lambda: review_request(req, mgr_user, "approve", expected_version=req.version),
        )
        wins = [r for r in results if r]
        assert len(wins) == 1
        assert (
            sum(isinstance(e, (ConflictError, PermissionDenied, ValidationError)) for e in errors)
            == 1
        )
        req.refresh_from_db()
        assert req.status == EmployeeRequest.Status.PENDING_HR


class TestConcurrentAllocations:
    def test_two_requests_cannot_spend_same_item(self, cast, org):
        employee, _, hr, _ = cast
        request_type = RequestType.objects.create(
            organization=org, code="allocated-equipment", name="Equipment",
            unit="unit",
        )
        today = date.today()
        grant = create_grant(
            hr, employee.profile, request_type,
            today - timedelta(days=2), today + timedelta(days=2), 1,
        )
        requests = [
            create_draft(employee, {
                "type": request_type.pk, "title": f"Item {n}",
                "equipment_item": "Keyboard", "quantity": 1,
            }) for n in range(2)
        ]
        results, errors = run_in_threads(
            *(lambda req=req: submit_request(req, employee) for req in requests)
        )
        assert sum(result is not None for result in results) == 1
        assert sum(isinstance(error, ValidationError) for error in errors) == 1
        grant.refresh_from_db()
        assert grant_totals(grant)["remaining"] == 0
        assert grant.commitments.count() == 1

    def test_competing_adjustments_use_version(self, cast, org):
        employee, _, hr, _ = cast
        request_type = RequestType.objects.create(
            organization=org, code="allocated-equipment", name="Equipment",
            unit="unit",
        )
        today = date.today()
        grant = create_grant(
            hr, employee.profile, request_type,
            today - timedelta(days=2), today + timedelta(days=2), 2,
        )
        results, errors = run_in_threads(
            lambda: adjust_grant(hr, grant.pk, 1, "Correction", grant.version),
            lambda: adjust_grant(hr, grant.pk, 1, "Correction", grant.version),
        )
        assert sum(result is not None for result in results) == 1
        assert sum(isinstance(error, ConflictError) for error in errors) == 1
        grant.refresh_from_db()
        assert grant_totals(grant)["granted"] == 3
