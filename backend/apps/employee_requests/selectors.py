"""Scoped request selectors (T003/T015): role scope is applied before any
filter, count, or pagination. Filters and ordering are allowlisted — arbitrary
model fields can never be probed through query params."""

import uuid

from django.db.models import Q
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import is_hr, is_manager
from apps.employee_requests.models import EmployeeRequest, RequestType

ORDERING_ALLOWLIST = {
    "created_at",
    "-created_at",
    "submitted_at",
    "-submitted_at",
    "status",
    "-status",
    "title",
    "-title",
}


def scoped_requests(user):
    """Request visibility per D-003 (drafts visible only to their owner):
    - employee -> own requests (all statuses)
    - manager -> own + current direct reports' NON-DRAFT requests
    - HR      -> whole organization's non-draft + own drafts
    Scoped before any count/page/filter."""
    own = Q(employee__user=user)
    if is_hr(user):
        return EmployeeRequest.objects.filter(
            Q(organization_id=user.organization_id)
            & (own | ~Q(status=EmployeeRequest.Status.DRAFT))
        )
    if is_manager(user):
        return EmployeeRequest.objects.filter(
            Q(organization_id=user.organization_id)
            & (own | (Q(employee__manager__user=user) & ~Q(status=EmployeeRequest.Status.DRAFT)))
        )
    return EmployeeRequest.objects.filter(own & Q(organization_id=user.organization_id))


def request_queryset(user, params):
    """Role-scoped request list with bounded filters/ordering.

    Params (all optional): status=<choice>, type=<uuid>, employee=<uuid>,
    search=<text>, ordering=<allowlisted field>. Unknown ordering and malformed
    filters are rejected (400); unrecognized params are ignored."""
    qs = scoped_requests(user).select_related(
        "employee", "employee__user", "employee__department", "type"
    )

    if status := params.get("status"):
        if status not in EmployeeRequest.Status.values:
            raise ValidationError({"status": ["Unknown status."]})
        qs = qs.filter(status=status)

    if raw := params.get("type"):
        try:
            type_id = uuid.UUID(raw)
        except (ValueError, AttributeError):
            raise ValidationError({"type": ["Invalid type id."]}) from None
        qs = qs.filter(type_id=type_id)

    if raw := params.get("employee"):
        try:
            employee_id = uuid.UUID(raw)
        except (ValueError, AttributeError):
            raise ValidationError({"employee": ["Invalid employee id."]}) from None
        qs = qs.filter(employee_id=employee_id)

    if search := params.get("search", "").strip():
        qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

    ordering = params.get("ordering", "-created_at")
    if ordering not in ORDERING_ALLOWLIST:
        raise ValidationError({"ordering": ["Unsupported ordering field."]})
    # UUID tie-breaker keeps pagination deterministic under duplicate values.
    return qs.order_by(ordering, "id")


def active_request_types(user):
    """Active types the caller may draft against — every authenticated employee
    sees the org's active types; HR sees all for administration."""
    qs = RequestType.objects.filter(organization_id=user.organization_id)
    if not is_hr(user):
        qs = qs.filter(is_active=True)
    return qs.order_by("name")
