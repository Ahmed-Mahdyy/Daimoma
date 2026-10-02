from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from apps.accounts.pagination import DefaultPagination
from apps.accounts.permissions import IsManagerOrHR
from apps.audit.selectors import scoped_events
from apps.audit.serializers import AuditEventSerializer

# Allowlisted ordering for the audit list (column-id → ORM field).
AUDIT_ORDERING = {
    "occurred_at": "occurred_at",
    "-occurred_at": "-occurred_at",
    "action": "action",
    "-action": "-action",
    "actor": "actor__email",
    "-actor": "-actor__email",
}

PagedAuditEvents = inline_serializer(
    name="PagedAuditEvents",
    fields={
        "count": drf_serializers.IntegerField(),
        "next": drf_serializers.URLField(allow_null=True),
        "previous": drf_serializers.URLField(allow_null=True),
        "results": AuditEventSerializer(many=True),
    },
)


class AuditEventListView(APIView):
    """GET /api/v1/audit-events/ — paginated, scoped audit history.

    HR: all organization events. Managers: events affecting current direct
    reports only. Employees: 403. Append-only — no detail/patch/delete."""

    permission_classes = [IsManagerOrHR]
    http_method_names = ["get", "head", "options"]

    @extend_schema(responses={200: PagedAuditEvents}, operation_id="audit_events_list")
    def get(self, request):
        qs = scoped_events(request.user)
        if action := request.query_params.get("action", "").strip():
            qs = qs.filter(action=action)
        ordering = request.query_params.get("ordering", "-occurred_at")
        if ordering not in AUDIT_ORDERING:
            raise ValidationError({"ordering": ["Unsupported ordering field."]})
        field = AUDIT_ORDERING[ordering]
        qs = qs.order_by(field, "-id" if field.startswith("-") else "id")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(AuditEventSerializer(page, many=True).data)
