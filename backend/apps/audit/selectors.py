"""Scoped audit reads (FR-006, amended 2026-10-17): HR sees all organization
events. Managers no longer have audit access — the view returns 403 for them
and this selector defensively returns an empty queryset for non-HR callers."""

from apps.accounts.permissions import is_hr
from apps.audit.models import AuditEvent


def scoped_events(user):
    qs = AuditEvent.objects.select_related("actor").filter(organization_id=user.organization_id)
    if not is_hr(user):
        return qs.none()
    return qs
