"""Guarded idempotent synthetic demo seed (007:T011, FR-006, D-008).

Creates one organization, two departments, two managers, four employees
across both teams, two HR users, approved request types, and sample
draft/pending/returned/approved/rejected requests and timesheets through
real domain services. Generates runtime credentials securely, skips
existing records without resetting passwords or overwriting history, and
refuses to run unless ALLOW_DEMO_SEED=1 is explicitly set.
"""

import os
import secrets
from datetime import UTC, date, datetime, timedelta

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import EmployeeProfile, User
from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.employee_requests.allocations import create_grant
from apps.employee_requests.models import EmployeeAllocationGrant, EmployeeRequest, RequestType
from apps.employee_requests.services import create_draft, review_request, submit_request
from apps.organizations.models import Department, Organization
from apps.timesheets.models import TimeEntry
from apps.timesheets.services import (
    create_entries,
    get_or_create_sheet,
    review_sheet,
    submit_day,
    submit_sheet,
)


def _generate_password() -> str:
    # Guaranteed to satisfy UpperLowerDigitValidator + min_length=12.
    return f"Dm9{secrets.token_urlsafe(12)}aA1"


class Command(BaseCommand):
    help = (
        "Seed synthetic demo data (requires ALLOW_DEMO_SEED=1; never overwrites existing records)."
    )

    def handle(self, *args, **options):
        if os.environ.get("ALLOW_DEMO_SEED") != "1":
            raise CommandError(
                "Refusing to run seed_demo without ALLOW_DEMO_SEED=1 in the environment."
            )

        org = Organization.objects.first()
        if org is None:
            org = Organization.objects.create(
                name="Acme Corporation",
                timezone="UTC",
                week_start=0,
                working_weekdays=[0, 1, 2, 3, 4],
            )
            org_status = "created"
        else:
            org_status = "skipped (existing)"

        depts = {}
        for name in ("Engineering", "Operations", "People & Culture"):
            dept, _ = Department.objects.get_or_create(organization=org, name=name)
            depts[name] = dept

        created_credentials: list[tuple[str, str, str]] = []
        skipped_users: list[str] = []

        def ensure_account(
            email: str, code: str, display_name: str, dept_name: str, roles=(), manager_profile=None
        ):
            user = User.objects.filter(email=email).first()
            if user is not None:
                if user.organization_id != org.id:
                    raise CommandError(f"{email} belongs to a different organization.")
                skipped_users.append(email)
            else:
                pwd = _generate_password()
                user = User.objects.create(email=email, organization=org, is_active=True)
                user.set_password(pwd)
                user.save(update_fields=["password"])
                if roles:
                    user.groups.set(Group.objects.filter(name__in=roles))
                created_credentials.append((email, ", ".join(roles) or "Employee", pwd))

            profile, prof_created = EmployeeProfile.objects.get_or_create(
                user=user,
                defaults={
                    "organization": org,
                    "employee_code": code,
                    "display_name": display_name,
                    "department": depts[dept_name],
                    "manager": manager_profile,
                },
            )
            return user, profile, prof_created

        hr1_user, hr1_prof, _ = ensure_account(
            "hr-1@acme.test", "DEMO-HR1", "Hana HR", "People & Culture", roles=(ROLE_HR,)
        )
        hr2_user, hr2_prof, _ = ensure_account(
            "hr-2@acme.test",
            "DEMO-HR2",
            "Hassan HR",
            "People & Culture",
            roles=(ROLE_HR,),
            manager_profile=hr1_prof,
        )
        mgr_eng_user, mgr_eng_prof, _ = ensure_account(
            "mgr-eng@acme.test",
            "DEMO-MGR1",
            "Mona Manager",
            "Engineering",
            roles=(ROLE_MANAGER,),
            manager_profile=hr1_prof,
        )
        mgr_ops_user, mgr_ops_prof, _ = ensure_account(
            "mgr-ops@acme.test",
            "DEMO-MGR2",
            "Omar Manager",
            "Operations",
            roles=(ROLE_MANAGER,),
            manager_profile=hr1_prof,
        )
        emp_eng1_user, emp_eng1_prof, _ = ensure_account(
            "emp-eng-1@acme.test",
            "DEMO-EMP1",
            "Nour Engineer",
            "Engineering",
            manager_profile=mgr_eng_prof,
        )
        emp_eng2_user, emp_eng2_prof, _ = ensure_account(
            "emp-eng-2@acme.test",
            "DEMO-EMP2",
            "Karim Engineer",
            "Engineering",
            manager_profile=mgr_eng_prof,
        )
        emp_ops1_user, emp_ops1_prof, _ = ensure_account(
            "emp-ops-1@acme.test",
            "DEMO-EMP3",
            "Salma Specialist",
            "Operations",
            manager_profile=mgr_ops_prof,
        )
        emp_ops2_user, emp_ops2_prof, _ = ensure_account(
            "emp-ops-2@acme.test",
            "DEMO-EMP4",
            "Tarek Analyst",
            "Operations",
            manager_profile=mgr_ops_prof,
        )

        type_specs = (
            (
                "annual_leave",
                "Annual leave",
                {
                    "unit": "unit",
                    "requires_allocation": True,
                    "requires_dates": True,
                    "requires_hr": False,
                },
            ),
            (
                "early_leave",
                "Early leave",
                {
                    "unit": "hour",
                    "requires_allocation": True,
                    "requires_hr": True,
                    "requires_manager": False,
                },
            ),
            (
                "equipment",
                "Equipment",
                {
                    "unit": "unit",
                    "requires_allocation": False,
                    "requires_item": True,
                    "requires_hr": False,
                },
            ),
            (
                "hr_service",
                "HR service",
                {"unit": "none", "requires_hr": True, "requires_manager": False},
            ),
            (
                "work_from_home",
                "Work from home",
                {
                    "unit": "unit",
                    "requires_allocation": False,
                    "requires_dates": True,
                    "requires_hr": False,
                },
            ),
            ("general", "General request", {"unit": "none", "requires_hr": False}),
        )
        types = {}
        for code, name, defaults in type_specs:
            rt, _ = RequestType.objects.get_or_create(
                organization=org,
                code=code,
                defaults={"name": name, "is_active": True, **defaults},
            )
            types[code] = rt

        # Ensure allocation grants for emp_eng1 and emp_ops1 if none exist yet.
        for prof in (emp_eng1_prof, emp_ops1_prof):
            if not EmployeeAllocationGrant.objects.filter(
                employee=prof, request_type=types["annual_leave"]
            ).exists():
                create_grant(
                    hr1_user, prof, types["annual_leave"], date(2026, 1, 1), date(2027, 12, 31), 21
                )

        # Create synthetic requests across all 5 states through real services (idempotent by title).
        def ensure_demo_request(owner, rt_code, title, target_state, reviewer=None):
            if EmployeeRequest.objects.filter(employee=owner.profile, title=title).exists():
                return
            req = create_draft(
                owner,
                {
                    "type": types[rt_code].pk,
                    "title": title,
                    "description": f"Synthetic demo request ({target_state}).",
                },
            )
            if target_state == "draft":
                return
            req = submit_request(req, owner)
            if target_state == "pending_manager":
                return
            if target_state == "approved":
                review_request(req, reviewer, "approve")
            elif target_state == "returned":
                review_request(
                    req, reviewer, "return", reason="Synthetic demo: please attach project code."
                )
            elif target_state == "rejected":
                review_request(req, reviewer, "reject", reason="Synthetic demo: duplicate request.")

        ensure_demo_request(emp_eng1_user, "general", "Demo draft request", "draft")
        ensure_demo_request(emp_eng1_user, "general", "Demo pending request", "pending_manager")
        ensure_demo_request(
            emp_eng2_user, "general", "Demo returned request", "returned", reviewer=mgr_eng_user
        )
        ensure_demo_request(
            emp_ops1_user, "general", "Demo approved request", "approved", reviewer=mgr_ops_user
        )
        ensure_demo_request(
            emp_ops2_user, "general", "Demo rejected request", "rejected", reviewer=mgr_ops_user
        )

        # Create sample timesheets (collecting, pending_manager, approved) via real services.
        def ensure_demo_sheet(owner, work_date: date, state: str, mgr_user=None):
            sheet = get_or_create_sheet(owner, work_date)
            if not TimeEntry.objects.filter(workday__timesheet=sheet).exists():
                create_entries(
                    sheet.id,
                    owner,
                    {
                        "work_date": work_date,
                        "start_at": datetime.combine(work_date, datetime.min.time(), UTC)
                        + timedelta(hours=9),
                        "end_at": datetime.combine(work_date, datetime.min.time(), UTC)
                        + timedelta(hours=17),
                        "break_minutes": 30,
                        "description": "Synthetic demo workday",
                        "window_reason": "Synthetic demo schedule",
                    },
                )
            sheet.refresh_from_db()
            if state in ("pending_manager", "approved") and sheet.status == "collecting":
                submit_day(sheet.id, work_date, owner)
                submit_sheet(sheet.id, owner)
                sheet.refresh_from_db()
            if state == "approved" and sheet.status == "pending_manager" and mgr_user is not None:
                sheet = review_sheet(sheet.id, mgr_user, "approve")
                if sheet.status == "pending_hr":
                    review_sheet(sheet.id, hr1_user, "approve")

        ensure_demo_sheet(emp_eng1_user, date(2025, 5, 5), "collecting")
        ensure_demo_sheet(emp_eng2_user, date(2025, 5, 12), "pending_manager")
        ensure_demo_sheet(emp_ops1_user, date(2025, 5, 19), "approved", mgr_user=mgr_ops_user)

        self.stdout.write(self.style.SUCCESS(f"Organization '{org.name}': {org_status}"))
        if created_credentials:
            self.stdout.write("Generated synthetic credentials (shown once — store securely):")
            for email, role, pwd in created_credentials:
                self.stdout.write(f"  {email} ({role}): {pwd}")
        if skipped_users:
            self.stdout.write(
                f"Skipped existing accounts (passwords untouched): {', '.join(skipped_users)}"
            )
