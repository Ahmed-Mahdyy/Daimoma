"""Scoped reporting projections (005). Live queries over the source of
truth — no independently stored summary copies (AGENTS §7). Every list,
count, and aggregate applies the caller's scope BEFORE aggregating.

Scope (D-003):
  employee -> own profile only
  manager  -> current direct reports
  HR       -> whole organization
"""

import uuid
from datetime import date
from zoneinfo import ZoneInfo

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import EmployeeProfile
from apps.accounts.permissions import is_hr, is_manager
from apps.employee_requests.models import (
    EmployeeAllocationGrant,
    EmployeeRequest,
    RequestApprovalStep,
)
from apps.employee_requests.serializers import AllocationGrantSerializer
from apps.timesheets.models import TimeEntry, Timesheet

MAX_RANGE_DAYS = 366  # D-009 (2026-10-02)
EXPORT_ROW_LIMIT = 10_000  # D-009 (2026-10-02)
INBOX_PAGE_SIZE = 50

# Drafts/collecting sheets are owner-visible only; they never appear in
# team/org projections (D-003) or reports (D-009: drafts excluded).
REQUEST_OPEN_STATUSES = [
    EmployeeRequest.Status.PENDING_MANAGER,
    EmployeeRequest.Status.PENDING_HR,
    EmployeeRequest.Status.APPROVED,
    EmployeeRequest.Status.RETURNED,
    EmployeeRequest.Status.REJECTED,
]
SHEET_OPEN_STATUSES = [
    Timesheet.Status.PENDING_MANAGER,
    Timesheet.Status.PENDING_HR,
    Timesheet.Status.APPROVED,
    Timesheet.Status.RETURNED,
    Timesheet.Status.REJECTED,
]


def _profile_ids(user, *, scope):
    """Profile ids the caller may aggregate over."""
    if scope == "personal":
        try:
            return [user.profile.pk]
        except EmployeeProfile.DoesNotExist:
            raise ValidationError({"detail": ["No employee profile."]}) from None
    if scope == "team":
        if is_hr(user):
            return EmployeeProfile.objects.filter(organization_id=user.organization_id)
        if is_manager(user):
            try:
                return EmployeeProfile.objects.filter(manager=user.profile)
            except EmployeeProfile.DoesNotExist:
                raise ValidationError({"detail": ["No employee profile."]}) from None
        raise PermissionDenied("Team dashboard requires a manager or HR role.")
    if scope == "organization":
        if not is_hr(user):
            raise PermissionDenied("Organization dashboard requires HR.")
        return EmployeeProfile.objects.filter(organization_id=user.organization_id)
    raise ValidationError({"detail": ["Unknown scope."]})


def parse_range(query_params, org):
    """from/to query params -> inclusive local dates (defaults: org's
    current week). Enforces the 366-day cap."""
    from apps.timesheets.timecalc import period_bounds

    raw_from = query_params.get("from")
    raw_to = query_params.get("to")
    if not raw_from and not raw_to:
        from django.utils import timezone

        today = timezone.localdate()
        raw_from, raw_to = (d.isoformat() for d in period_bounds(today, org.week_start))
    try:
        start = date.fromisoformat(raw_from)
        end = date.fromisoformat(raw_to)
    except (TypeError, ValueError):
        raise ValidationError({"detail": ["from/to must be ISO dates (YYYY-MM-DD)."]}) from None
    if end < start:
        raise ValidationError({"to": ["`to` must not precede `from`."]})
    if (end - start).days > MAX_RANGE_DAYS:
        raise ValidationError(
            {"detail": [f"Date range exceeds the {MAX_RANGE_DAYS}-day reporting limit."]}
        )
    return start, end


def _status_counts(qs, choices):
    """Stable shape: every declared status key present, zero-filled."""
    rows = qs.values("status").annotate(n=Count("pk"))
    counts = {key: 0 for key in choices}
    counts.update({r["status"]: r["n"] for r in rows})
    return counts


def _approved_minutes(profile_ids, start, end):
    """Live approved minutes: active entries on currently-APPROVED sheets,
    counted by local work_date (D-009). Reopened/voided never count."""
    return (
        TimeEntry.objects.filter(
            employee_id__in=profile_ids,
            voided_at__isnull=True,
            workday__timesheet__status=Timesheet.Status.APPROVED,
            work_date__gte=start,
            work_date__lte=end,
        ).aggregate(total=Sum("duration_minutes"))["total"]
        or 0
    )


def _pending_review_count(user):
    """Items currently awaiting THIS user's decision."""
    reqs = RequestApprovalStep.objects.filter(
        reviewer=user,
        status=RequestApprovalStep.StepStatus.PENDING,
        request__status__in=(
            EmployeeRequest.Status.PENDING_MANAGER,
            EmployeeRequest.Status.PENDING_HR,
        ),
    ).count()
    sheets = Timesheet.objects.filter(
        current_reviewer=user,
        status__in=(Timesheet.Status.PENDING_MANAGER, Timesheet.Status.PENDING_HR),
    ).count()
    return reqs + sheets


def _personal_allocations(user):
    today = timezone.localtime(timezone.now(), ZoneInfo(user.organization.timezone)).date()
    grants = (
        EmployeeAllocationGrant.objects.filter(
            organization_id=user.organization_id,
            employee__user=user,
            status=EmployeeAllocationGrant.Status.ACTIVE,
        )
        .filter(Q(start_date__lte=today, end_date__gte=today) | Q(
            end_date__lt=today, commitments__disposition="reserved"
        ))
        .distinct()
        .select_related("employee", "request_type")
        .prefetch_related("adjustments", "commitments")
        .order_by("end_date", "pk")
    )
    return [
        {**AllocationGrantSerializer(grant).data, "expired": grant.end_date < today}
        for grant in grants
    ]


def dashboard(user, scope, query_params):
    profile_ids = _profile_ids(user, scope=scope)
    start, end = parse_range(query_params, user.organization)

    req_qs = EmployeeRequest.objects.filter(employee_id__in=profile_ids)
    sheet_qs = Timesheet.objects.filter(employee_id__in=profile_ids)
    if scope != "personal":
        req_qs = req_qs.filter(status__in=REQUEST_OPEN_STATUSES)
        sheet_qs = sheet_qs.filter(status__in=SHEET_OPEN_STATUSES)

    result = {
        "scope": scope,
        "period": {
            "from": start.isoformat(),
            "to": end.isoformat(),
            "timezone": user.organization.timezone,
        },
        "requests": {"by_status": _status_counts(req_qs, EmployeeRequest.Status.values)},
        "timesheets": {"by_status": _status_counts(sheet_qs, Timesheet.Status.values)},
        "approved_minutes": _approved_minutes(profile_ids, start, end),
        "pending_review": _pending_review_count(user),
    }
    if scope == "personal":
        result["allocations"] = _personal_allocations(user)
    return result


def _report_profile_ids(user):
    """Report scope = the caller's widest legitimate scope (D-003)."""
    if is_hr(user):
        return EmployeeProfile.objects.filter(organization_id=user.organization_id), False
    if is_manager(user):
        try:
            return EmployeeProfile.objects.filter(manager=user.profile), False
        except EmployeeProfile.DoesNotExist:
            raise ValidationError({"detail": ["No employee profile."]}) from None
    try:
        return EmployeeProfile.objects.filter(pk=user.profile.pk), True
    except EmployeeProfile.DoesNotExist:
        raise ValidationError({"detail": ["No employee profile."]}) from None


def _scope_employee_filter(profile_ids, params):
    """?employee=<profile pk> intersects with scope — never widens it."""
    raw = params.get("employee")
    if not raw:
        return profile_ids
    try:
        pid = uuid.UUID(raw)
    except (ValueError, AttributeError):
        raise ValidationError({"employee": ["Not a valid employee id."]}) from None
    return profile_ids.filter(pk=pid)


def _validated(params, key, choices, default=None):
    value = params.get(key, default)
    if value is not None and value not in choices:
        raise ValidationError({key: [f"Must be one of: {', '.join(choices)}."]})
    return value


def working_hours_rows(user, params):
    """Employee x work_date minute rows for sheets in the selected current
    status. Dates are inclusive local work dates (D-009)."""
    profile_ids, personal = _report_profile_ids(user)
    profile_ids = _scope_employee_filter(profile_ids, params)
    start, end = parse_range(params, user.organization)
    status = _validated(
        params, "status", Timesheet.Status.values, default=Timesheet.Status.APPROVED
    )
    ordering = _validated(
        params,
        "ordering",
        ["work_date", "-work_date", "minutes", "-minutes", "employee_code", "-employee_code"],
        default="work_date",
    )
    order_field = (
        "employee__employee_code" if ordering.lstrip("-").startswith("employee") else ordering
    )

    qs = TimeEntry.objects.filter(
        employee_id__in=profile_ids,
        voided_at__isnull=True,
        work_date__gte=start,
        work_date__lte=end,
        workday__timesheet__status=status,
    )
    if not personal:
        # Non-owner scopes never see unsubmitted (collecting) work.
        qs = qs.exclude(workday__timesheet__status=Timesheet.Status.COLLECTING)
    dept = params.get("department")
    if dept:
        qs = qs.filter(employee__department_id=dept)
    rows = (
        qs.values(
            "work_date",
            "employee_id",
            "employee__employee_code",
            "employee__display_name",
            "employee__department__name",
        )
        .annotate(minutes=Sum("duration_minutes"))
        .order_by(order_field, "employee_id")
    )
    return rows, {
        "minutes": rows.aggregate(t=Sum("minutes"))["t"] or 0,
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "timezone": user.organization.timezone,
        "status": status,
        "grouping": "employee x work_date; department/manager are current assignments",
    }


def request_rows(user, params):
    """Submitted requests only — drafts are excluded from reports (D-009).
    Date filter keys on local submitted_at date."""
    profile_ids, _ = _report_profile_ids(user)
    profile_ids = _scope_employee_filter(profile_ids, params)
    start, end = parse_range(params, user.organization)
    status = _validated(params, "status", REQUEST_OPEN_STATUSES)
    ordering = _validated(
        params,
        "ordering",
        ["submitted_at", "-submitted_at", "title", "-title", "status", "-status"],
        default="-submitted_at",
    )
    qs = EmployeeRequest.objects.filter(
        employee_id__in=profile_ids,
        submitted_at__isnull=False,
        submitted_at__date__gte=start,
        submitted_at__date__lte=end,
    ).select_related("type", "employee", "employee__user", "employee__department")
    if status:
        qs = qs.filter(status=status)
    rtype = params.get("type")
    if rtype:
        qs = qs.filter(type_id=rtype)
    dept = params.get("department")
    if dept:
        qs = qs.filter(employee__department_id=dept)
    qs = qs.order_by(ordering, "pk")
    return qs, {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "timezone": user.organization.timezone,
        "date_basis": "submitted_at (drafts excluded)",
        "grouping": "department/manager are current assignments",
    }
