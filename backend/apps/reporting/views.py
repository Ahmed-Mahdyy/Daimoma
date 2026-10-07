"""Dashboard views — thin HTTP adapters over scoped selectors."""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.pagination import DefaultPagination
from apps.accounts.permissions import IsActiveAuthenticated, IsHR, IsManagerOrHR
from apps.reporting.exports import export_requests, export_working_hours
from apps.reporting.selectors import dashboard, request_rows, working_hours_rows

_RANGE_PARAMS = [
    OpenApiParameter("from", OpenApiTypes.DATE, description="Inclusive local start date"),
    OpenApiParameter("to", OpenApiTypes.DATE, description="Inclusive local end date"),
]

PeriodSerializer = inline_serializer(
    name="DashboardPeriod",
    fields={
        "from": drf_serializers.DateField(),
        "to": drf_serializers.DateField(),
        "timezone": drf_serializers.CharField(),
    },
)
DashboardAllocationSerializer = inline_serializer(
    name="DashboardAllocation",
    fields={
        "id": drf_serializers.UUIDField(),
        "request_type": drf_serializers.UUIDField(),
        "type_name": drf_serializers.CharField(),
        "unit": drf_serializers.CharField(),
        "start_date": drf_serializers.DateField(),
        "end_date": drf_serializers.DateField(),
        "granted": drf_serializers.IntegerField(),
        "reserved": drf_serializers.IntegerField(),
        "used": drf_serializers.IntegerField(),
        "remaining": drf_serializers.IntegerField(),
        "expired": drf_serializers.BooleanField(),
    },
)
DashboardSerializer = inline_serializer(
    name="Dashboard",
    fields={
        "scope": drf_serializers.CharField(),
        "period": PeriodSerializer,
        "requests": drf_serializers.DictField(),
        "timesheets": drf_serializers.DictField(),
        "approved_minutes": drf_serializers.IntegerField(),
        "pending_review": drf_serializers.IntegerField(),
        "allocations": drf_serializers.ListSerializer(
            child=DashboardAllocationSerializer, required=False
        ),
    },
)


class _DashboardView(APIView):
    scope = ""
    permission_classes = [IsActiveAuthenticated]

    @extend_schema(parameters=_RANGE_PARAMS, responses={200: DashboardSerializer})
    def get(self, request):
        return Response(dashboard(request.user, self.scope, request.query_params))


class PersonalDashboardView(_DashboardView):
    scope = "personal"


class TeamDashboardView(_DashboardView):
    """Manager: current direct reports. HR: organization-wide (their whole
    'team')."""

    scope = "team"
    permission_classes = [IsManagerOrHR]


class OrganizationDashboardView(_DashboardView):
    scope = "organization"
    permission_classes = [IsHR]


def _paged(request, qs, row_fn, view):
    paginator = DefaultPagination()
    page = paginator.paginate_queryset(qs, request, view=view)
    data = paginator.get_paginated_response([row_fn(r) for r in page]).data
    return data


def _hours_row(r):
    return {
        "work_date": r["work_date"].isoformat(),
        "employee_id": str(r["employee_id"]),
        "employee_code": r["employee__employee_code"],
        "employee_name": r["employee__display_name"],
        "department": r["employee__department__name"],
        "minutes": r["minutes"],
    }


def _request_row(req):
    return {
        "id": str(req.pk),
        "title": req.title,
        "type": req.type.name,
        "unit": req.type.unit,
        "status": req.status,
        "submitted_at": req.submitted_at.isoformat() if req.submitted_at else None,
        "employee_id": str(req.employee_id),
        "employee_code": req.employee.employee_code,
        "employee_name": req.employee.display_name,
        "department": req.employee.department.name if req.employee.department else None,
    }


HoursRowSerializer = inline_serializer(
    name="WorkingHoursRow",
    fields={
        "work_date": drf_serializers.DateField(),
        "employee_id": drf_serializers.UUIDField(),
        "employee_code": drf_serializers.CharField(),
        "employee_name": drf_serializers.CharField(allow_blank=True),
        "department": drf_serializers.CharField(allow_null=True),
        "minutes": drf_serializers.IntegerField(),
    },
)
RequestRowSerializer = inline_serializer(
    name="RequestReportRow",
    fields={
        "id": drf_serializers.UUIDField(),
        "title": drf_serializers.CharField(),
        "type": drf_serializers.CharField(),
        "unit": drf_serializers.CharField(),
        "status": drf_serializers.CharField(),
        "submitted_at": drf_serializers.DateTimeField(allow_null=True),
        "employee_id": drf_serializers.UUIDField(),
        "employee_code": drf_serializers.CharField(),
        "employee_name": drf_serializers.CharField(allow_blank=True),
        "department": drf_serializers.CharField(allow_null=True),
    },
)

_REPORT_PARAMS = _RANGE_PARAMS + [
    OpenApiParameter("status", OpenApiTypes.STR),
    OpenApiParameter("employee", OpenApiTypes.UUID),
    OpenApiParameter("ordering", OpenApiTypes.STR),
]


class WorkingHoursReportView(APIView):
    """GET reports/working-hours/ — scoped employee x work_date minutes.
    `status` selects the sheet's CURRENT status (default approved)."""

    permission_classes = [IsActiveAuthenticated]

    @extend_schema(parameters=_REPORT_PARAMS, responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        rows, meta = working_hours_rows(request.user, request.query_params)
        data = _paged(request, rows, _hours_row, self)
        data["totals"] = {"minutes": meta["minutes"]}
        data["meta"] = {k: v for k, v in meta.items() if k != "minutes"}
        return Response(data)


class RequestsReportView(APIView):
    """GET reports/requests/ — scoped submitted requests (drafts excluded),
    date basis = submitted_at (D-009)."""

    permission_classes = [IsActiveAuthenticated]

    @extend_schema(parameters=_REPORT_PARAMS, responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        qs, meta = request_rows(request.user, request.query_params)
        data = _paged(request, qs, _request_row, self)
        data["totals"] = {"count": qs.count()}
        data["meta"] = meta
        return Response(data)


class WorkingHoursExportView(APIView):
    """GET reports/working-hours/export/ — manager/HR bounded CSV (D-009)."""

    permission_classes = [IsManagerOrHR]

    @extend_schema(parameters=_REPORT_PARAMS, responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        return export_working_hours(request.user, request.query_params)


class RequestsExportView(APIView):
    """GET reports/requests/export/ — manager/HR bounded CSV (D-009)."""

    permission_classes = [IsManagerOrHR]

    @extend_schema(parameters=_REPORT_PARAMS, responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        return export_requests(request.user, request.query_params)
