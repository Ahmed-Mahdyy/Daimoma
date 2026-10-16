"""Guarded idempotent synthetic demo seed (007:T011, FR-006, D-008).

Creates one organization, five departments, four managers, ten employees,
three HR users, approved request types, allocation grants, and realistic
typed requests plus multi-week timesheets through real domain services so
dashboards and reports render meaningful data. Generates runtime credentials
securely (or a shared password when DEMO_SEED_PASSWORD is set for demo
quick-login), skips existing records without resetting passwords or
overwriting history, and refuses to run unless ALLOW_DEMO_SEED=1 is
explicitly set.
"""

import os
import secrets
from datetime import UTC, date, datetime, time, timedelta

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import EmployeeProfile, User
from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.employee_requests.allocations import create_grant
from apps.employee_requests.models import EmployeeAllocationGrant, EmployeeRequest, RequestType
from apps.employee_requests.services import create_draft, review_request, submit_request
from apps.organizations.models import Department, Organization
from apps.timesheets.models import Timesheet, WorkDay
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


# (email, employee_code, display_name, department, roles, manager_email)
PEOPLE = [
    ("hr-1@acme.test", "DEMO-HR1", "Hana Abdelrahman", "People & Culture", (ROLE_HR,), None),
    ("hr-2@acme.test", "DEMO-HR2", "Hassan El-Sayed", "People & Culture", (ROLE_HR,), "hr-1@acme.test"),
    ("mgr-eng@acme.test", "DEMO-MGR1", "Mona Kamel", "Engineering", (ROLE_MANAGER,), "hr-1@acme.test"),
    ("mgr-ops@acme.test", "DEMO-MGR2", "Omar Farouk", "Operations", (ROLE_MANAGER,), "hr-1@acme.test"),
    ("dina.mansour@acme.test", "DEMO-MGR3", "Dina Mansour", "Finance", (ROLE_MANAGER,), "hr-1@acme.test"),
    ("hossam.nabil@acme.test", "DEMO-MGR4", "Hossam Nabil", "Sales & Marketing", (ROLE_MANAGER,), "hr-1@acme.test"),
    ("emp-eng-1@acme.test", "DEMO-EMP1", "Nourhan Adel", "Engineering", (), "mgr-eng@acme.test"),
    ("emp-eng-2@acme.test", "DEMO-EMP2", "Karim Youssef", "Engineering", (), "mgr-eng@acme.test"),
    ("ahmed.refaat@acme.test", "DEMO-EMP11", "Ahmed Refaat", "Engineering", (), "mgr-eng@acme.test"),
    ("emp-ops-1@acme.test", "DEMO-EMP3", "Salma Fathy", "Operations", (), "mgr-ops@acme.test"),
    ("emp-ops-2@acme.test", "DEMO-EMP4", "Tarek Mostafa", "Operations", (), "mgr-ops@acme.test"),
    ("mariam.adel@acme.test", "DEMO-EMP12", "Mariam Adel", "Operations", (), "mgr-ops@acme.test"),
    ("yasmin.fouad@acme.test", "DEMO-EMP13", "Yasmin Fouad", "Finance", (), "dina.mansour@acme.test"),
    ("omar.sherif@acme.test", "DEMO-EMP14", "Omar Sherif", "Finance", (), "dina.mansour@acme.test"),
    ("layla.ibrahim@acme.test", "DEMO-EMP15", "Layla Ibrahim", "Sales & Marketing", (), "hossam.nabil@acme.test"),
    ("nada.hassan@acme.test", "DEMO-EMP16", "Nada Hassan", "Sales & Marketing", (), "hossam.nabil@acme.test"),
]

# Old placeholder display names → realistic names (updated only when the
# stored name still matches the placeholder exactly).
NAME_BACKFILL = {
    "Hana HR": "Hana Abdelrahman",
    "Hassan HR": "Hassan El-Sayed",
    "Mona Manager": "Mona Kamel",
    "Omar Manager": "Omar Farouk",
    "Nour Engineer": "Nourhan Adel",
    "Karim Engineer": "Karim Youssef",
    "Salma Specialist": "Salma Fathy",
    "Tarek Analyst": "Tarek Mostafa",
}

DEPARTMENTS = ("Engineering", "Operations", "People & Culture", "Finance", "Sales & Marketing")

# Rotated per employee for realistic schedule variance.
SCHEDULES = [
    (time(8, 0), time(16, 30), 45),
    (time(9, 0), time(17, 30), 60),
    (time(8, 30), time(17, 0), 30),
]

DAY_DESCRIPTIONS = [
    "Sprint development and code review",
    "Client support and ticket triage",
    "Invoice processing and reconciliation",
    "Campaign content and social scheduling",
    "Standup, planning and documentation",
]

# (request_type_code, title, state) — field payloads are built per type.
REQUEST_SPECS = [
    ("annual_leave", "Annual leave — family trip", "approved"),
    ("work_from_home", "Work from home — office maintenance", "approved"),
    ("equipment", "Second monitor for desk setup", "approved"),
    ("general", "Parking spot assignment", "pending_manager"),
    ("hr_service", "Employment letter for bank account", "pending_hr"),
    ("early_leave", "Early leave — doctor appointment", "approved"),
    ("annual_leave", "Annual leave — Eid holiday", "pending_manager"),
    ("equipment", "Replacement laptop charger", "returned"),
    ("general", "Access to analytics dashboard", "rejected"),
    ("work_from_home", "Work from home — home internet upgrade", "draft"),
    ("hr_service", "Salary certificate for visa application", "approved"),
    ("early_leave", "Early leave — school pickup", "rejected"),
    ("general", "Team offsite budget request", "draft"),
]


def _request_fields(req_type, idx: int, today: date) -> dict:
    """Typed field payloads matching validate_fields_for_type per unit."""
    base = date(2026, 9, 1) + timedelta(days=idx * 3)
    if req_type.unit == "hour":
        return {
            "start_date": base,
            "start_time": time(14, 0),
            "end_time": time(16, 30),
        }
    if req_type.requires_item:
        return {
            "equipment_item": ["Monitor", "Laptop charger", "Ergonomic chair", "Headset"][idx % 4],
            "quantity": (idx % 2) + 1,
        }
    if req_type.requires_dates:
        return {
            "start_date": base,
            "end_date": base + timedelta(days=2 + idx % 4),
        }
    return {}


class Command(BaseCommand):
    help = (
        "Seed synthetic demo data (requires ALLOW_DEMO_SEED=1; never overwrites existing records)."
    )

    def handle(self, *args, **options):
        if os.environ.get("ALLOW_DEMO_SEED") != "1":
            raise CommandError(
                "Refusing to run seed_demo without ALLOW_DEMO_SEED=1 in the environment."
            )

        shared_password = os.environ.get("DEMO_SEED_PASSWORD") or None
        today = timezone.now().date()

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
        for name in DEPARTMENTS:
            dept, _ = Department.objects.get_or_create(organization=org, name=name)
            depts[name] = dept

        created_credentials: list[tuple[str, str, str]] = []
        skipped_users: list[str] = []
        profiles: dict[str, EmployeeProfile] = {}
        users: dict[str, User] = {}

        def ensure_account(email, code, display_name, dept_name, roles=(), manager_email=None):
            manager_profile = profiles.get(manager_email) if manager_email else None
            user = User.objects.filter(email=email).first()
            if user is not None:
                if user.organization_id != org.id:
                    raise CommandError(f"{email} belongs to a different organization.")
                skipped_users.append(email)
            else:
                pwd = shared_password or _generate_password()
                user = User.objects.create(email=email, organization=org, is_active=True)
                user.set_password(pwd)
                user.save(update_fields=["password"])
                if roles:
                    user.groups.set(Group.objects.filter(name__in=roles))
                created_credentials.append((email, ", ".join(roles) or "Employee", pwd))

            profile, _ = EmployeeProfile.objects.get_or_create(
                user=user,
                defaults={
                    "organization": org,
                    "employee_code": code,
                    "display_name": display_name,
                    "department": depts[dept_name],
                    "manager": manager_profile,
                },
            )
            # Narrow backfill: only rename rows still carrying a placeholder name.
            if profile.display_name in NAME_BACKFILL:
                profile.display_name = NAME_BACKFILL[profile.display_name]
                profile.save(update_fields=["display_name", "updated_at"])
            users[email] = user
            profiles[email] = profile
            return user, profile

        for email, code, display_name, dept_name, roles, manager_email in PEOPLE:
            ensure_account(email, code, display_name, dept_name, roles, manager_email)

        hr1_user = users["hr-1@acme.test"]

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

        # Allocation grants for every profile (21 leave days + 480 early-leave
        # minutes — hour rows store whole minutes).
        for profile in profiles.values():
            for rt_code, amount in (("annual_leave", 21), ("early_leave", 480)):
                rt = types[rt_code]
                if not EmployeeAllocationGrant.objects.filter(
                    employee=profile, request_type=rt
                ).exists():
                    create_grant(
                        hr1_user, profile, rt, date(2026, 1, 1), date(2027, 12, 31), amount
                    )

        # Typed requests in every state, driven through real services. The
        # current pending step's reviewer is read back from the DB so the
        # correct manager/HR decides regardless of route resolution order.
        def ensure_demo_request(owner, rt_code, title, target_state, extra_fields):
            profile = owner.profile
            if EmployeeRequest.objects.filter(employee=profile, title=title).exists():
                return "skipped"
            req = create_draft(
                owner,
                {
                    "type": types[rt_code].pk,
                    "title": title,
                    "description": f"{title} — submitted for review.",
                    **extra_fields,
                },
            )
            if target_state == "draft":
                return "draft"
            req = submit_request(req, owner)
            while True:
                req.refresh_from_db()
                if req.status == target_state or req.status in (
                    "approved",
                    "rejected",
                    "returned",
                ):
                    break
                step = (
                    req.steps.filter(cycle=req.cycle, status="pending")
                    .select_related("reviewer")
                    .order_by("sequence")
                    .first()
                )
                if step is None:
                    break
                # Advance toward the target: approve intermediate stages for
                # pending/approved targets, decide once for reject/return.
                if target_state in ("pending_manager", "pending_hr", "approved"):
                    review_request(req, step.reviewer, "approve")
                elif target_state == "rejected":
                    review_request(
                        req, step.reviewer, "reject", reason="Does not meet current policy."
                    )
                elif target_state == "returned":
                    review_request(
                        req,
                        step.reviewer,
                        "return",
                        reason="Please add the project code and resubmit.",
                    )
            return req.status

        request_stats: dict[str, int] = {}
        all_people = list(profiles.keys())
        for i, email in enumerate(all_people):
            owner = users[email]
            # Each person gets 3 requests, rotated across the spec table so
            # every type and every state is represented across the org.
            for j in range(3):
                rt_code, title, state = REQUEST_SPECS[(i * 3 + j) % len(REQUEST_SPECS)]
                try:
                    result = ensure_demo_request(
                        owner, rt_code, title, state, _request_fields(types[rt_code], i + j, today)
                    )
                    request_stats[result] = request_stats.get(result, 0) + 1
                except Exception as exc:  # noqa: BLE001 — report, keep seeding
                    self.stderr.write(f"Request '{title}' for {email}: {exc}")

        # Multi-week timesheets for every profile through real services.
        # Weeks -4..-1: fully submitted + reviewed; current week: entries for
        # past working days submitted, sheet left collecting.
        def ensure_day(sheet, owner, work_date: date, sched_idx: int, desc_idx: int):
            if WorkDay.objects.filter(timesheet=sheet, work_date=work_date).exists():
                return
            start_t, end_t, brk = SCHEDULES[sched_idx % len(SCHEDULES)]
            create_entries(
                sheet.id,
                owner,
                {
                    "work_date": work_date,
                    "start_at": datetime.combine(work_date, start_t, UTC),
                    "end_at": datetime.combine(work_date, end_t, UTC),
                    "break_minutes": brk,
                    "description": DAY_DESCRIPTIONS[desc_idx % len(DAY_DESCRIPTIONS)],
                },
            )

        def seed_week(owner, week_start: date, target: str, sched_idx: int, desc_idx: int):
            sheet = get_or_create_sheet(owner, week_start)
            workdays = [
                week_start + timedelta(days=d)
                for d in range(7)
                if (week_start + timedelta(days=d)).weekday() in (org.working_weekdays or [])
                and week_start + timedelta(days=d) < today
            ]
            for d in workdays:
                ensure_day(sheet, owner, d, sched_idx, desc_idx)
                day = WorkDay.objects.get(timesheet=sheet, work_date=d)
                if day.status in (WorkDay.Status.DRAFT, WorkDay.Status.RETURNED):
                    try:
                        submit_day(sheet.id, d, owner)
                    except Exception:  # noqa: BLE001 — rerun on locked sheet
                        return
            sheet.refresh_from_db()
            if target == "collecting" or sheet.status != Timesheet.Status.COLLECTING:
                return
            try:
                submit_sheet(sheet.id, owner)
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(f"Sheet {sheet.id} submit for {owner.email}: {exc}")
                return
            sheet.refresh_from_db()
            while sheet.status in (
                Timesheet.Status.PENDING_MANAGER,
                Timesheet.Status.PENDING_HR,
            ):
                if target == sheet.status:
                    return
                reviewer = sheet.current_reviewer
                if reviewer is None:
                    return
                review_sheet(sheet.id, reviewer, "approve")
                sheet.refresh_from_db()

        current_week_start = today - timedelta(days=(today.weekday() - org.week_start) % 7)
        for i, email in enumerate(all_people):
            owner = users[email]
            for w in range(4, 0, -1):
                ws = current_week_start - timedelta(days=7 * w)
                # Week -1 varies by person; older weeks all approved.
                if w == 1:
                    target = ("approved", "pending_hr", "pending_manager")[i % 3]
                else:
                    target = "approved"
                try:
                    seed_week(owner, ws, target, i + w, i)
                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(f"Sheet week {ws} for {email}: {exc}")
            try:
                seed_week(owner, current_week_start, "collecting", i, i + 1)
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(f"Current-week sheet for {email}: {exc}")

        self.stdout.write(self.style.SUCCESS(f"Organization '{org.name}': {org_status}"))
        if created_credentials:
            if shared_password:
                self.stdout.write(
                    f"All new accounts share DEMO_SEED_PASSWORD from the environment: {shared_password}"
                )
            else:
                self.stdout.write("Generated synthetic credentials (shown once — store securely):")
                for email, role, pwd in created_credentials:
                    self.stdout.write(f"  {email} ({role}): {pwd}")
        if skipped_users:
            self.stdout.write(
                f"Skipped existing accounts (passwords untouched): {', '.join(skipped_users)}"
            )
        if request_stats:
            self.stdout.write(f"Requests: {request_stats}")
