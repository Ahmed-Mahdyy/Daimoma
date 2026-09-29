"""Seed synthetic users for local e2e/browser verification (D-008: synthetic
data only). Idempotent — safe to re-run. Passwords are test-only constants."""

import os

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from apps.accounts.models import EmployeeProfile, User
from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.organizations.models import Organization

E2E_PASSWORD = os.environ.get("E2E_SEED_PASSWORD", "E2ePassw0rd1")


def upsert_user(org, email, roles=()):
    user, _ = User.objects.get_or_create(
        email=email, defaults={"organization": org, "is_active": True}
    )
    user.organization = org
    user.is_active = True
    user.set_password(E2E_PASSWORD)
    user.save()
    user.groups.set(Group.objects.filter(name__in=roles))
    return user


class Command(BaseCommand):
    help = "Seed synthetic e2e users (local development only)."

    def handle(self, *args, **options):
        org, _ = Organization.objects.get_or_create(
            name="E2E Corp", defaults={"timezone": "UTC", "week_start": 0}
        )
        hr = upsert_user(org, "hr-e2e@acme.test", [ROLE_HR])
        hr_profile, _ = EmployeeProfile.objects.get_or_create(
            user=hr,
            defaults={
                "organization": org,
                "employee_code": "E2E-HR",
                "display_name": "Harriet HR",
            },
        )
        manager = upsert_user(org, "manager-e2e@acme.test", [ROLE_MANAGER])
        mgr_profile, _ = EmployeeProfile.objects.get_or_create(
            user=manager,
            defaults={
                "organization": org,
                "employee_code": "E2E-MGR",
                "display_name": "Manny Manager",
            },
        )
        employee = upsert_user(org, "employee-e2e@acme.test")
        EmployeeProfile.objects.get_or_create(
            user=employee,
            defaults={
                "organization": org,
                "employee_code": "E2E-EMP",
                "display_name": "Edu Employee",
                "manager": mgr_profile,
            },
        )

        from apps.employee_requests.models import RequestType

        RequestType.objects.get_or_create(
            organization=org,
            code="annual_leave",
            defaults={
                "name": "Annual leave",
                "category": "leave",
                "requires_hr": False,
                "is_active": True,
            },
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded e2e org '{org.name}' (hr/manager/employee-e2e@acme.test, "
                f"password {E2E_PASSWORD})"
            )
        )
