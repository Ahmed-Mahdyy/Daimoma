"""Tests for guarded idempotent synthetic demo seeding (007:T011)."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import EmployeeProfile, User
from apps.employee_requests.models import EmployeeRequest
from apps.timesheets.models import Timesheet


@pytest.mark.django_db
def test_seed_demo_refuses_without_explicit_guard(monkeypatch):
    monkeypatch.delenv("ALLOW_DEMO_SEED", raising=False)
    with pytest.raises(CommandError, match="ALLOW_DEMO_SEED=1"):
        call_command("seed_demo")


@pytest.mark.django_db
def test_seed_demo_is_idempotent_and_preserves_existing_passwords(monkeypatch):
    monkeypatch.setenv("ALLOW_DEMO_SEED", "1")
    out1 = StringIO()
    call_command("seed_demo", stdout=out1)
    first_output = out1.getvalue()
    assert "Generated synthetic credentials" in first_output
    assert User.objects.filter(email="hr-1@acme.test").exists()
    assert EmployeeProfile.objects.count() >= 8
    assert set(EmployeeRequest.objects.values_list("status", flat=True)) >= {
        "draft",
        "pending_manager",
        "returned",
        "approved",
        "rejected",
    }
    assert Timesheet.objects.filter(status="approved").exists()

    # Record password hashes before second run.
    hashes_before = dict(User.objects.values_list("email", "password"))
    req_count_before = EmployeeRequest.objects.count()

    out2 = StringIO()
    call_command("seed_demo", stdout=out2)
    second_output = out2.getvalue()
    assert "Skipped existing accounts" in second_output
    assert "Generated synthetic credentials" not in second_output
    assert dict(User.objects.values_list("email", "password")) == hashes_before
    assert EmployeeRequest.objects.count() == req_count_before
