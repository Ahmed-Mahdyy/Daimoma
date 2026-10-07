"""T002 — deterministic synthetic dataset with documented expected metrics.
Every dashboard/report assertion reconciles against these fixed numbers,
never against recomputed query results (which would hide scope bugs).

Dataset (org "Acme", UTC, week_start=Monday):

  emp1 (E001, dept A, manager=mgr)   emp2 (E002, dept B, manager=mgr)
  lone (E003, dept B, no manager -> HR fallback route)
  mgr (M001, dept A)                 hr (H001)

Requests:
  r1 emp1 leave      submitted -> mgr approve                    APPROVED
  r2 emp1 equipment  submitted                                   PENDING_MANAGER
  r3 emp1 general    never submitted                             DRAFT (owner-only)
  r4 emp2 leave      submitted -> mgr return                     RETURNED
  r5 emp2 equipment  submitted -> mgr reject                     REJECTED
  r6 lone hr_service submitted                                   PENDING_HR (fallback)

Timesheets (week 2026-09-14..20 unless noted):
  emp1: 09-15 09:00-17:00 break 30 = 450 min, day+week submitted,
        mgr+hr approved                                          APPROVED
  emp2: 09-16 09:00-13:00           = 240 min, day+week submitted  PENDING_MANAGER
  emp1: week 2026-09-21, 09-22 10:00-12:00 = 120 min, unsubmitted  COLLECTING

Expected (window 2026-09-14..2026-09-20):
  personal emp1: requests {draft:1, pending_manager:1, approved:1}
                 timesheets {collecting:1, approved:1}, approved_minutes=450
  team mgr:      requests {pending_manager:1, returned:1, rejected:1, approved:1}
                 timesheets {pending_manager:1, approved:1}
                 approved_minutes=450, pending_review=2 (r2 + emp2 sheet)
  org hr:        requests {pending_manager:1, pending_hr:1, returned:1,
                           rejected:1, approved:1}  (drafts excluded)
                 timesheets {pending_manager:1, approved:1}
                 approved_minutes=450
"""

from datetime import UTC, date, datetime

import pytest
from django.contrib.auth.models import Group

from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.conftest import make_profile, make_user
from apps.employee_requests.models import RequestType
from apps.employee_requests.services import (
    create_draft,
    review_request,
    submit_request,
)
from apps.organizations.models import Department
from apps.timesheets.services import (
    create_entries,
    get_or_create_sheet,
    review_sheet,
    submit_day,
    submit_sheet,
)

WINDOW = (date(2026, 9, 14), date(2026, 9, 20))


def ts(day, hour):
    return datetime(2026, 9, day, hour, tzinfo=UTC)


def _req(user, req_type, **extra):
    data = {"type": str(req_type.pk), "title": extra.pop("title", "req")}
    if req_type.name == "Leave":
        data.update(start_date="2026-09-15", end_date="2026-09-15")
    if req_type.unit == "unit":
        data.update(quantity=1, equipment_item="Laptop")
    data.update(extra)
    return create_draft(user, data)


@pytest.fixture
def reporting_dataset(org):
    dept_a = Department.objects.create(organization=org, name="Engineering")
    dept_b = Department.objects.create(organization=org, name="Operations")

    hr = make_user(org, "hr@acme.test")
    hr.groups.add(Group.objects.get(name=ROLE_HR))
    make_profile(org, hr, "H001")

    mgr = make_user(org, "mgr@acme.test")
    mgr.groups.add(Group.objects.get(name=ROLE_MANAGER))
    mgr_profile = make_profile(org, mgr, "M001", department=dept_a)

    emp1 = make_user(org, "emp1@acme.test")
    make_profile(org, emp1, "E001", department=dept_a, manager=mgr_profile)
    emp2 = make_user(org, "emp2@acme.test")
    make_profile(org, emp2, "E002", department=dept_b, manager=mgr_profile)
    lone = make_user(org, "lone@acme.test")
    make_profile(org, lone, "E003", department=dept_b)

    leave = RequestType.objects.create(
        organization=org, code="LEAVE", name="Leave", unit="none"
    )
    equip = RequestType.objects.create(
        organization=org, code="EQ", name="Equipment", unit="none"
    )
    gen = RequestType.objects.create(
        organization=org, code="GEN", name="General", unit="none"
    )

    r1 = _req(emp1, leave, title="annual leave")
    submit_request(r1, emp1)
    review_request(r1, mgr, "approve")

    r2 = _req(emp1, equip, title="laptop")
    submit_request(r2, emp1)

    _req(emp1, gen, title="question")  # draft, never submitted

    r4 = _req(emp2, leave, title="sick")
    submit_request(r4, emp2)
    review_request(r4, mgr, "return", reason="wrong dates")

    r5 = _req(emp2, equip, title="monitor")
    submit_request(r5, emp2)
    review_request(r5, mgr, "reject", reason="not needed")

    hrsvc = RequestType.objects.create(
        organization=org, code="HRSVC", name="HR service", unit="none"
    )
    r6 = _req(lone, hrsvc, title="certificate")
    submit_request(r6, lone)

    # emp1 approved week: 450 min
    s1 = get_or_create_sheet(emp1, date(2026, 9, 14))
    create_entries(
        s1.pk,
        emp1,
        {
            "work_date": date(2026, 9, 15),
            "start_at": ts(15, 9),
            "end_at": ts(15, 17),
            "break_minutes": 30,
        },
    )
    submit_day(s1.pk, date(2026, 9, 15), emp1)
    submit_sheet(s1.pk, emp1)
    review_sheet(s1.pk, mgr, "approve")
    s1.refresh_from_db()
    review_sheet(s1.pk, hr, "approve")

    # emp2 pending week: 240 min
    s2 = get_or_create_sheet(emp2, date(2026, 9, 14))
    create_entries(
        s2.pk,
        emp2,
        {
            "work_date": date(2026, 9, 16),
            "start_at": ts(16, 9),
            "end_at": ts(16, 13),
            "break_minutes": 0,
        },
    )
    submit_day(s2.pk, date(2026, 9, 16), emp2)
    submit_sheet(s2.pk, emp2)

    # emp1 collecting week: 120 min, invisible outside personal scope
    s3 = get_or_create_sheet(emp1, date(2026, 9, 21))
    create_entries(
        s3.pk,
        emp1,
        {
            "work_date": date(2026, 9, 22),
            "start_at": datetime(2026, 9, 22, 10, tzinfo=UTC),
            "end_at": datetime(2026, 9, 22, 12, tzinfo=UTC),
            "break_minutes": 0,
        },
    )

    return {
        "org": org,
        "hr": hr,
        "mgr": mgr,
        "emp1": emp1,
        "emp2": emp2,
        "lone": lone,
        "dept_a": dept_a,
        "dept_b": dept_b,
        "types": {"leave": leave, "equipment": equip, "general": gen, "hrsvc": hrsvc},
        "requests": {"r1": r1, "r2": r2, "r4": r4, "r5": r5, "r6": r6},
        "sheets": {"approved": s1, "pending": s2, "collecting": s3},
        "window": WINDOW,
        "approved_minutes": 450,
    }
