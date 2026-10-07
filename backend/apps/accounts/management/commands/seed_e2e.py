"""Seed synthetic users for local e2e/browser verification (D-008: synthetic
data only). Idempotent — safe to re-run. Passwords are test-only constants."""

import os
from datetime import UTC, date, datetime, timedelta

from django.conf import settings
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import ValidationError

from apps.accounts.models import EmployeeProfile, User
from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.organizations.models import Department, Organization
from apps.timesheets.models import TimeEntry
from apps.timesheets.services import create_entries, get_or_create_sheet

E2E_PASSWORD = os.environ.get("E2E_SEED_PASSWORD", "E2ePassw0rd1")


def upsert_user(org, email, roles=()):
    user, created = User.objects.get_or_create(
        email=email, defaults={"organization": org, "is_active": True}
    )
    if created:
        user.set_password(E2E_PASSWORD)
        user.save(update_fields=["password"])
        user.groups.set(Group.objects.filter(name__in=roles))
    elif user.organization_id != org.id:
        raise CommandError("A demo email already belongs to another organization.")
    return user


class Command(BaseCommand):
    help = "Seed synthetic e2e users (local development only)."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Synthetic demo seeding is limited to development.")
        # Legacy databases seeded under the old name keep one org — rename it
        # rather than create a second organization.
        org = Organization.objects.filter(name="Acme Corporation").first()
        legacy = Organization.objects.filter(name="E2E Corp").first()
        if org is None and legacy is not None:
            legacy.name = "Acme Corporation"
            legacy.save(update_fields=["name"])
            org = legacy
        if org is None:
            org = Organization.objects.create(
                name="Acme Corporation", timezone="UTC", week_start=0
            )

        departments = {
            name: Department.objects.get_or_create(
                organization=org, name=name
            )[0]
            for name in (
                "Engineering",
                "People & Culture",
                "Finance & Accounting",
                "Operations",
            )
        }

        def assign(profile, **fields):
            dirty = {
                k: v
                for k, v in fields.items()
                if getattr(profile, k) != v
            }
            if dirty:
                for k, v in dirty.items():
                    setattr(profile, k, v)
                profile.save()

        hr = upsert_user(org, "hr-e2e@acme.test", [ROLE_HR])
        hr_profile, _ = EmployeeProfile.objects.get_or_create(
            user=hr,
            defaults={
                "organization": org,
                "employee_code": "E2E-HR",
                "display_name": "Harriet HR",
            },
        )
        assign(hr_profile, department=departments["People & Culture"])
        manager = upsert_user(org, "manager-e2e@acme.test", [ROLE_MANAGER])
        mgr_profile, _ = EmployeeProfile.objects.get_or_create(
            user=manager,
            defaults={
                "organization": org,
                "employee_code": "E2E-MGR",
                "display_name": "Manny Manager",
            },
        )
        assign(mgr_profile, department=departments["Engineering"])
        employee = upsert_user(org, "employee-e2e@acme.test")
        emp_profile, _ = EmployeeProfile.objects.get_or_create(
            user=employee,
            defaults={
                "organization": org,
                "employee_code": "E2E-EMP",
                "display_name": "Edu Employee",
                "manager": mgr_profile,
            },
        )
        assign(
            emp_profile,
            department=departments["Engineering"],
            manager=mgr_profile,
        )

        from apps.employee_requests.models import RequestType

        RequestType.objects.get_or_create(
            organization=org,
            code="annual_leave",
            defaults={
                "name": "Annual leave",
                "unit": "none",
                "requires_hr": False,
                "is_active": True,
            },
        )
        for code, unit, name in (
            ("early_leave", "hour", "Early leave"),
            ("equipment", "none", "Equipment"),
            ("hr_service", "none", "HR service"),
            ("work_from_home", "none", "Work from home"),
            ("general", "none", "General request"),
        ):
            RequestType.objects.get_or_create(
                organization=org,
                code=code,
                defaults={"name": name, "unit": unit, "is_active": True},
            )

        for user in (employee, manager, hr):
            work_date = date(2025, 6, 2)
            # Stale overlapping sheets in an already-used dev database can make
            # opening the demo week fail; the sample entry is best-effort.
            try:
                sheet = get_or_create_sheet(user, work_date)
            except ValidationError:
                continue
            if not TimeEntry.objects.filter(workday__timesheet=sheet).exists():
                try:
                    create_entries(
                        sheet.id,
                        user,
                        {
                            "work_date": work_date,
                            "start_at": datetime.combine(
                                work_date, datetime.min.time(), UTC
                            )
                            + timedelta(hours=9),
                            "end_at": datetime.combine(
                                work_date, datetime.min.time(), UTC
                            )
                            + timedelta(hours=17),
                            "break_minutes": 30,
                            "description": "Synthetic example workday",
                            "window_reason": "Synthetic demo schedule",
                        },
                    )
                except ValidationError:
                    # The day is owned by a stale overlapping sheet in this
                    # dev database — the demo entry is best-effort only.
                    continue
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded synthetic users, request types and sample timesheets in '{org.name}'."
            )
        )
