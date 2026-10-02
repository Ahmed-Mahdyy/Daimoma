from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.pagination import DefaultPagination
from apps.accounts.permissions import IsActiveAuthenticated, IsHR
from apps.accounts.selectors import get_visible_profile
from apps.organizations.models import Department
from apps.organizations.selectors import scoped_directory
from apps.organizations.serializers import (
    DepartmentSerializer,
    EmployeeProvisionSerializer,
    EmployeeSummarySerializer,
    EmployeeUpdateSerializer,
    OrgSettingsSerializer,
    ReasonSerializer,
)
from apps.organizations.services import (
    create_department,
    deactivate_employee,
    eligible_managers,
    provision_employee,
    reactivate_employee,
    resend_invitation,
    update_department,
    update_employee,
    update_org_settings,
)

DetailSerializer = inline_serializer(
    name="OrgDetailResponse", fields={"detail": drf_serializers.CharField()}
)
PagedEmployees = inline_serializer(
    name="PagedEmployees",
    fields={
        "count": drf_serializers.IntegerField(),
        "results": EmployeeSummarySerializer(many=True),
    },
)
PagedDepartments = inline_serializer(
    name="PagedDepartments",
    fields={
        "count": drf_serializers.IntegerField(),
        "results": DepartmentSerializer(many=True),
    },
)
ManagerChoicesSerializer = inline_serializer(
    name="ManagerChoices",
    fields={
        "count": drf_serializers.IntegerField(),
        "results": inline_serializer(
            name="ManagerChoice",
            fields={
                "id": drf_serializers.UUIDField(),
                "user_id": drf_serializers.UUIDField(),
                "display_name": drf_serializers.CharField(),
                "employee_code": drf_serializers.CharField(),
                "roles": drf_serializers.ListField(child=drf_serializers.CharField()),
            },
            many=True,
        ),
    },
)


def _org(request):
    return request.user.organization


class EmployeeListView(APIView):
    """GET — scoped directory: employee sees self, manager sees current
    direct reports, HR sees the organization (no general directory).
    POST — HR provisioning only."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsHR()]
        return [IsActiveAuthenticated()]

    @extend_schema(responses={200: PagedEmployees}, operation_id="employees_list")
    def get(self, request):
        qs = scoped_directory(request.user, request.query_params)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(EmployeeSummarySerializer(page, many=True).data)

    @extend_schema(
        request=EmployeeProvisionSerializer,
        responses={201: EmployeeSummarySerializer},
    )
    def post(self, request):
        serializer = EmployeeProvisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = provision_employee(request.user, _org(request), **serializer.validated_data)
        return Response(
            EmployeeSummarySerializer(user.profile).data,
            status=status.HTTP_201_CREATED,
        )


class EmployeeDetailView(APIView):
    """GET — same scoped-visibility rules as the list; out-of-scope ids are
    404 (non-enumerating). PATCH — HR only."""

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsHR()]
        return [IsActiveAuthenticated()]

    def _profile(self, request, pk):
        try:
            return get_visible_profile(request.user, pk)
        except Exception:
            raise NotFound from None

    @extend_schema(responses={200: EmployeeSummarySerializer})
    def get(self, request, pk):
        return Response(EmployeeSummarySerializer(self._profile(request, pk)).data)

    @extend_schema(request=EmployeeUpdateSerializer, responses={200: EmployeeSummarySerializer})
    def patch(self, request, pk):
        profile = self._profile(request, pk)
        serializer = EmployeeUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        attrs = dict(serializer.validated_data)
        version = attrs.pop("version", None)
        profile = update_employee(request.user, profile, attrs, expected_version=version)
        return Response(EmployeeSummarySerializer(profile).data)


class EmployeePhotoView(APIView):
    """GET /api/v1/employees/{id}/photo/ — streams the employee's photo under
    the same scoped visibility as the detail endpoint; out-of-scope ids and
    missing photos are both 404 (non-enumerating)."""

    permission_classes = [IsActiveAuthenticated]
    http_method_names = ["get", "head", "options"]

    @extend_schema(
        responses={(200, "image/*"): OpenApiTypes.BINARY},
        description="Returns photo bytes; 404 when out of scope or unset.",
    )
    def get(self, request, pk):
        from django.http import FileResponse

        profile = get_visible_profile(request.user, pk)  # 404 when out of scope
        if not profile.photo:
            raise NotFound
        return FileResponse(
            profile.photo.open("rb"),
            content_type=profile.photo_content_type or "application/octet-stream",
        )


class _HRAction(APIView):
    permission_classes = [IsHR]

    def _profile(self, request, pk):
        org = request.user.organization
        from apps.accounts.models import EmployeeProfile

        try:
            return EmployeeProfile.objects.select_related("user").get(pk=pk, organization=org)
        except EmployeeProfile.DoesNotExist:
            raise NotFound from None


class EmployeeDeactivateView(_HRAction):
    @extend_schema(request=ReasonSerializer, responses={200: DetailSerializer})
    def post(self, request, pk):
        serializer = ReasonSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        deactivate_employee(
            request.user,
            self._profile(request, pk),
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response({"detail": "Employee deactivated."})


class EmployeeReactivateView(_HRAction):
    @extend_schema(request=ReasonSerializer, responses={200: DetailSerializer})
    def post(self, request, pk):
        serializer = ReasonSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        reactivate_employee(
            request.user,
            self._profile(request, pk),
            note=serializer.validated_data.get("note", ""),
        )
        return Response({"detail": "Employee reactivated."})


class EmployeeResendInvitationView(_HRAction):
    @extend_schema(request=None, responses={200: DetailSerializer})
    def post(self, request, pk):
        resend_invitation(request.user, self._profile(request, pk))
        return Response({"detail": "Invitation re-issued."})


class DepartmentListView(APIView):
    permission_classes = [IsHR]

    @extend_schema(responses={200: PagedDepartments}, operation_id="departments_list")
    def get(self, request):
        qs = Department.objects.filter(organization=_org(request))
        return Response({"results": DepartmentSerializer(qs, many=True).data, "count": qs.count()})

    @extend_schema(request=DepartmentSerializer, responses={201: DepartmentSerializer})
    def post(self, request):
        serializer = DepartmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dept = create_department(
            request.user, _org(request), name=serializer.validated_data["name"]
        )
        return Response(DepartmentSerializer(dept).data, status=status.HTTP_201_CREATED)


class DepartmentDetailView(APIView):
    """PATCH only — departments are deactivated, never deleted."""

    permission_classes = [IsHR]
    http_method_names = ["get", "patch", "head", "options"]

    def _dept(self, request, pk):
        try:
            return Department.objects.get(pk=pk, organization=_org(request))
        except Department.DoesNotExist:
            raise NotFound from None

    @extend_schema(responses={200: DepartmentSerializer})
    def get(self, request, pk):
        return Response(DepartmentSerializer(self._dept(request, pk)).data)

    @extend_schema(request=DepartmentSerializer, responses={200: DepartmentSerializer})
    def patch(self, request, pk):
        dept = self._dept(request, pk)
        serializer = DepartmentSerializer(dept, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        dept = update_department(request.user, dept, **serializer.validated_data)
        return Response(DepartmentSerializer(dept).data)


class ManagerChoicesView(APIView):
    """GET /api/v1/choices/managers/ — HR-only scoped options for the
    reporting-line field: active profiles inside the caller's organization.
    Never exposes global user lists."""

    permission_classes = [IsHR]

    @extend_schema(responses={200: ManagerChoicesSerializer})
    def get(self, request):
        qs = eligible_managers(request.user.organization).prefetch_related("user__groups")
        if search := request.query_params.get("search", "").strip():
            qs = qs.filter(display_name__icontains=search)
        results = [
            {
                "id": str(p.id),
                "user_id": str(p.user_id),
                "display_name": p.display_name,
                "employee_code": p.employee_code,
                "roles": sorted(g.name for g in p.user.groups.all()),
            }
            for p in qs
        ]
        return Response({"results": results, "count": len(results)})


class OrgSettingsView(APIView):
    permission_classes = [IsHR]

    @extend_schema(responses={200: OrgSettingsSerializer})
    def get(self, request):
        return Response(OrgSettingsSerializer(_org(request)).data)

    @extend_schema(request=OrgSettingsSerializer, responses={200: OrgSettingsSerializer})
    def patch(self, request):
        serializer = OrgSettingsSerializer(_org(request), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        org = update_org_settings(request.user, _org(request), serializer.validated_data)
        return Response(OrgSettingsSerializer(org).data)
