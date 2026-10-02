"""Generate the approved D-009 performance dataset (500 employees, 52 weeks
of timesheets ~130k entries, ~5k requests, ~20k notifications) into a
dedicated synthetic 'PerfCorp' organization.

Guards: requires --confirm and refuses to run when DEBUG is off — this is a
measurement fixture, never production data. Re-running is idempotent per
employee_count (skips if the org already has that many profiles)."""

import uuid
from datetime import UTC, date, datetime, timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import EmployeeProfile, User
from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.employee_requests.models import EmployeeRequest, RequestType
from apps.notifications.models import Notification
from apps.organizations.models import Organization
from apps.timesheets.models import TimeEntry, Timesheet, WorkDay

BATCH = 2000
ORG_NAME = "PerfCorp (synthetic)"
PERF_PASSWORD = "PerfPassw0rd1"  # noqa: S105 — synthetic fixture credential


class Command(BaseCommand):
    help = "Seed the D-009 synthetic performance dataset (non-production only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm", action="store_true", help="Acknowledge synthetic load generation."
        )
        parser.add_argument("--employees", type=int, default=500)
        parser.add_argument("--weeks", type=int, default=52)
        parser.add_argument("--requests", type=int, default=5000)
        parser.add_argument("--notifications", type=int, default=20000)

    def handle(self, *args, **opts):
        if not opts["confirm"]:
            raise CommandError("Pass --confirm to generate synthetic load data.")
        if not settings.DEBUG:
            raise CommandError("Refusing to seed perf data when DEBUG is off.")

        org, _ = Organization.objects.get_or_create(
            name=ORG_NAME, defaults={"timezone": "UTC", "week_start": 0}
        )
        n_emp = opts["employees"]
        existing = EmployeeProfile.objects.filter(organization=org).count()
        if existing >= n_emp:
            self.stdout.write(f"PerfCorp already has {existing} profiles — nothing to do.")
            return

        self.stdout.write(f"Seeding {n_emp} employees, {opts['weeks']} weeks…")

        # One shared hash — password-verify cost must not dominate seeding.
        pw_hash = make_password(PERF_PASSWORD)

        hr = User.objects.create_user(
            email="hr-perf@perf.test", password=PERF_PASSWORD, organization=org
        )
        hr.groups.add(Group.objects.get(name=ROLE_HR))
        make_profile = EmployeeProfile.objects.create
        make_profile(organization=org, user=hr, employee_code="P-HR", display_name="Perf HR")

        users, profiles = [], []
        for i in range(10):
            mu = User(
                email=f"mgr{i}-perf@perf.test", organization=org, password=pw_hash, is_active=True
            )
            users.append(mu)
        for i in range(n_emp):
            users.append(
                User(
                    email=f"emp{i}-perf@perf.test",
                    organization=org,
                    password=pw_hash,
                    is_active=True,
                )
            )
        User.objects.bulk_create(users)
        users = list(User.objects.filter(organization=org).exclude(pk=hr.pk))
        for i, u in enumerate(users):
            profiles.append(
                EmployeeProfile(
                    organization=org,
                    user=u,
                    employee_code=f"P{i:05d}",
                    display_name=f"Perf User {i}",
                )
            )
        EmployeeProfile.objects.bulk_create(profiles, batch_size=BATCH)
        profiles = list(EmployeeProfile.objects.filter(organization=org).exclude(user=hr))
        mgr_profiles = [p for p in profiles if p.user.email.startswith("mgr")]
        for p in mgr_profiles:
            p.user.groups.add(Group.objects.get(name=ROLE_MANAGER))
        # Assign every non-manager a manager (round-robin).
        to_update = []
        non_mgr = [p for p in profiles if p not in mgr_profiles]
        for i, p in enumerate(non_mgr):
            p.manager = mgr_profiles[i % len(mgr_profiles)]
            to_update.append(p)
        EmployeeProfile.objects.bulk_update(to_update, ["manager"], batch_size=BATCH)
        employee_profiles = non_mgr
        self.stdout.write(f"  {len(employee_profiles)} employees + {len(mgr_profiles)} managers")

        rtype = RequestType.objects.get_or_create(
            organization=org,
            code="perf_leave",
            defaults={
                "name": "Perf Leave",
                "category": "leave",
                "requires_hr": False,
                "is_active": True,
            },
        )[0]

        # ---- Timesheets: `weeks` approved sheets x 5 days x 1 entry/employee
        n_weeks = opts["weeks"]
        week0 = date(2025, 1, 6)  # a Monday, fully in the past
        now = datetime.now(UTC)
        sheet_rows = []
        for p in employee_profiles:
            for w in range(n_weeks):
                start = week0 + timedelta(weeks=w)
                sheet_rows.append(
                    Timesheet(
                        organization=org,
                        employee=p,
                        period_start=start,
                        period_end=start + timedelta(days=6),
                        timezone="UTC",
                        status=Timesheet.Status.APPROVED,
                        cycle=1,
                        version=2,
                        submitted_at=now,
                    )
                )
                if len(sheet_rows) >= BATCH:
                    Timesheet.objects.bulk_create(sheet_rows)
                    sheet_rows = []
        if sheet_rows:
            Timesheet.objects.bulk_create(sheet_rows)
        self.stdout.write("  timesheets done")

        sheets = Timesheet.objects.filter(organization=org).order_by("employee_id", "period_start")
        day_rows, entry_rows = [], []
        for sheet in sheets.iterator(chunk_size=BATCH):
            for d in range(5):
                wd = WorkDay(
                    id=uuid.uuid4(),
                    organization=org,
                    employee=sheet.employee,
                    timesheet=sheet,
                    work_date=sheet.period_start + timedelta(days=d),
                    status=WorkDay.Status.APPROVED,
                    submitted_at=now,
                    version=2,
                )
                day_rows.append(wd)
            if len(day_rows) >= BATCH:
                WorkDay.objects.bulk_create(day_rows)
                day_rows = []
        if day_rows:
            WorkDay.objects.bulk_create(day_rows)
        self.stdout.write("  workdays done")

        for day in WorkDay.objects.filter(organization=org).iterator(chunk_size=BATCH):
            day_date = day.work_date
            entry_rows.append(
                TimeEntry(
                    organization=org,
                    employee=day.employee,
                    workday=day,
                    work_date=day_date,
                    start_at=datetime.combine(day_date, datetime.min.time(), UTC)
                    + timedelta(hours=9),
                    end_at=datetime.combine(day_date, datetime.min.time(), UTC)
                    + timedelta(hours=17),
                    break_minutes=0,
                    duration_minutes=480,
                    description="perf",
                    window_flag=False,
                )
            )
            if len(entry_rows) >= BATCH:
                TimeEntry.objects.bulk_create(entry_rows)
                entry_rows = []
        if entry_rows:
            TimeEntry.objects.bulk_create(entry_rows)
        self.stdout.write("  time entries done")

        # ---- Requests: spread across employees, all submitted, mixed status
        statuses = [
            EmployeeRequest.Status.APPROVED,
            EmployeeRequest.Status.PENDING_MANAGER,
            EmployeeRequest.Status.RETURNED,
            EmployeeRequest.Status.REJECTED,
        ]
        req_rows = []
        for i in range(opts["requests"]):
            p = employee_profiles[i % len(employee_profiles)]
            req_rows.append(
                EmployeeRequest(
                    organization=org,
                    employee=p,
                    type=rtype,
                    title=f"Perf request {i}",
                    description="perf",
                    status=statuses[i % len(statuses)],
                    cycle=1,
                    version=2,
                    submitted_at=now,
                    start_date=date(2025, 6, 1),
                    end_date=date(2025, 6, 2),
                )
            )
            if len(req_rows) >= BATCH:
                EmployeeRequest.objects.bulk_create(req_rows)
                req_rows = []
        if req_rows:
            EmployeeRequest.objects.bulk_create(req_rows)
        self.stdout.write("  requests done")

        # ---- Notifications
        n_rows = []
        for i in range(opts["notifications"]):
            p = employee_profiles[i % len(employee_profiles)]
            n_rows.append(
                Notification(
                    organization=org,
                    recipient=p.user,
                    event_key=f"perf:{i}",
                    kind="request_decision",
                    summary=f"Perf notification {i}",
                )
            )
            if len(n_rows) >= BATCH:
                Notification.objects.bulk_create(n_rows)
                n_rows = []
        if n_rows:
            Notification.objects.bulk_create(n_rows)
        self.stdout.write("  notifications done")

        self.stdout.write(
            self.style.SUCCESS(
                f"PerfCorp seeded: {n_emp} employees, {n_weeks}w sheets, "
                f"{opts['requests']} requests, {opts['notifications']} notifications"
            )
        )
