"""Scoped directory selectors (T015): every list is role-scoped before any
filter, count, or pagination. Filters and ordering are allowlisted — arbitrary
model fields can never be probed through query params."""

import uuid

from django.db.models import Q
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import ROLE_EMPLOYEE, ROLE_HR, ROLE_MANAGER
from apps.accounts.selectors import visible_profiles

VALID_ROLES = {ROLE_EMPLOYEE, ROLE_MANAGER, ROLE_HR}

ORDERING_ALLOWLIST = {
    "display_name",
    "-display_name",
    "employee_code",
    "-employee_code",
    "email",
    "-email",
    "job_title",
    "-job_title",
}

ORDERING_FIELD_MAP = {"email": "user__email", "-email": "-user__email"}


def scoped_directory(user, params):
    """Role-scoped employee list with bounded filters/ordering.

    Params (all optional): is_active=true|false, department=<uuid>,
    role=Employee|Manager|HR, search=<text>, ordering=<allowlisted field>.
    Unknown ordering values and malformed filter values are rejected (400);
    unrecognized params are ignored, never interpreted as field lookups."""
    qs = visible_profiles(user).prefetch_related("user__groups")

    if (active := params.get("is_active")) is not None:
        flag = {"true": True, "false": False}.get(active.lower())
        if flag is None:
            raise ValidationError({"is_active": ["Expected 'true' or 'false'."]})
        qs = qs.filter(user__is_active=flag)

    if dept := params.get("department"):
        try:
            dept_id = uuid.UUID(dept)
        except (ValueError, AttributeError):
            raise ValidationError({"department": ["Invalid department id."]}) from None
        qs = qs.filter(department_id=dept_id)

    if role := params.get("role"):
        if role not in VALID_ROLES:
            raise ValidationError({"role": ["Unknown role."]})
        if role == ROLE_EMPLOYEE:
            # "Employee" is implicit — users with no elevated business roles.
            qs = qs.exclude(user__groups__name__in=[ROLE_MANAGER, ROLE_HR])
        else:
            qs = qs.filter(user__groups__name=role)

    if search := params.get("search", "").strip():
        qs = qs.filter(
            Q(display_name__icontains=search)
            | Q(user__email__icontains=search)
            | Q(employee_code__icontains=search)
        )

    ordering = params.get("ordering", "employee_code")
    if ordering not in ORDERING_ALLOWLIST:
        raise ValidationError({"ordering": ["Unsupported ordering field."]})
    field = ORDERING_FIELD_MAP.get(ordering, ordering)
    # UUID tie-breaker keeps pagination deterministic under duplicate values.
    return qs.order_by(field, "id")
