"""Scoped audit reads (FR-006): HR sees all organization events; managers see
events affecting current direct reports only (profile or user targets);
employees get no events — the view layer returns 403 for them."""

from django.db.models import Q

from apps.accounts.models import EmployeeProfile
from apps.accounts.permissions import is_hr
from apps.audit.models import AuditEvent


def scoped_events(user):
    qs = AuditEvent.objects.select_related("actor").filter(organization_id=user.organization_id)
    if is_hr(user):
        return qs
    # Manager scope: targets that are the profile or user of a CURRENT
    # direct report. Reporting-line changes therefore move visibility too.
    report_ids = list(
        EmployeeProfile.objects.filter(manager__user=user).values_list("id", "user_id")
    )
    profile_ids = [r[0] for r in report_ids]
    user_ids = [r[1] for r in report_ids]
    return qs.filter(
        Q(target_type="accounts.employeeprofile", target_id__in=profile_ids)
        | Q(target_type="accounts.user", target_id__in=user_ids)
    )
