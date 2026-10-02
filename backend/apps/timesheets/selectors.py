# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
"""Scoped timesheet selectors (T004): role scope applies before any filter,
count, or pagination. COLLECTING sheets are the employee's private workspace —
managers and HR only see submitted (non-COLLECTING) sheets, matching D-003's
draft visibility rule."""

import uuid
from datetime import date

from django.db.models import Q
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import is_hr, is_manager
from apps.timesheets.models import Timesheet

ORDERING_ALLOWLIST = {
    "period_start",
    "-period_start",
    "submitted_at",
    "-submitted_at",
    "status",
    "-status",
}


def scoped_timesheets(user):
    """Sheet visibility per D-003:
    - employee -> own sheets (all statuses)
    - manager  -> own + current direct reports' non-COLLECTING sheets
    - HR       -> organization's non-COLLECTING sheets + own"""
    own = Q(employee__user=user)
    if is_hr(user):
        return Timesheet.objects.filter(
            Q(organization_id=user.organization_id) & (own | ~Q(status=Timesheet.Status.COLLECTING))
        )
    if is_manager(user):
        return Timesheet.objects.filter(
            Q(organization_id=user.organization_id)
            & (own | (Q(employee__manager__user=user) & ~Q(status=Timesheet.Status.COLLECTING)))
        )
    return Timesheet.objects.filter(own & Q(organization_id=user.organization_id))


def timesheet_queryset(user, params):
    """Scoped list with bounded filters/ordering. Params: status, employee,
    period_start (YYYY-MM-DD = period containing that date), ordering."""
    qs = scoped_timesheets(user).select_related(
        "employee", "employee__user", "employee__department", "current_reviewer"
    )

    if status := params.get("status"):
        if status not in Timesheet.Status.values:
            raise ValidationError({"status": ["Unknown status."]})
        qs = qs.filter(status=status)

    if raw := params.get("employee"):
        try:
            qs = qs.filter(employee_id=uuid.UUID(raw))
        except (ValueError, AttributeError) as exc:
            raise ValidationError({"employee": ["Invalid employee id."]}) from exc

    if raw := params.get("period"):
        try:
            anchor = date.fromisoformat(raw)
        except (ValueError, AttributeError) as exc:
            raise ValidationError({"period": ["Invalid date (YYYY-MM-DD)."]}) from exc
        qs = qs.filter(period_start__lte=anchor, period_end__gte=anchor)

    ordering = params.get("ordering", "-period_start")
    if ordering not in ORDERING_ALLOWLIST:
        raise ValidationError({"ordering": ["Unsupported ordering field."]})
    return qs.order_by(ordering, "id")


def sheet_for(user, sheet_id):
    """Scoped sheet fetch — 404, never 403, for out-of-scope ids."""
    return (
        scoped_timesheets(user)
        .filter(pk=sheet_id)
        .select_related("employee", "employee__user", "organization", "current_reviewer")
        .first()
    )


def sheet_days(sheet):
    """WorkDays for a sheet with their non-voided entries, cheapest first."""
    return sheet.days.all().prefetch_related("entries").order_by("work_date")


def day_totals(sheet):
    """{work_date: worked minutes} over non-voided entries."""
    from django.db.models import Sum

    rows = (
        sheet.days.all()
        .filter(entries__voided_at__isnull=True)
        .values("work_date")
        .annotate(total=Sum("entries__duration_minutes"))
    )
    return {r["work_date"]: r["total"] for r in rows}
