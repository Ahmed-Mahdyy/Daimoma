from django.http import Http404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import EmployeeProfile
from apps.accounts.pagination import DefaultPagination
from apps.accounts.permissions import IsActiveAuthenticated, IsHR, is_hr
from apps.employee_requests.allocations import (
    adjust_grant,
    create_grant,
    edit_grant_dates,
    preview,
    void_grant,
)
from apps.employee_requests.models import EmployeeAllocationGrant, RequestType
from apps.employee_requests.selectors import (
    active_request_types,
    request_queryset,
    scoped_requests,
)
from apps.employee_requests.serializers import (
    AllocationAdjustmentSerializer,
    AllocationAdjustSerializer,
    AllocationChangeSerializer,
    AllocationCreateSerializer,
    AllocationDateEditSerializer,
    AllocationGrantSerializer,
    AllocationPreviewSerializer,
    AllocationVoidSerializer,
    ApprovalStepSerializer,
    EmployeeRequestSerializer,
    RequestDraftSerializer,
    RequestEventSerializer,
    RequestReviewSerializer,
    RequestTypeSerializer,
    RequestTypeWriteSerializer,
)
from apps.employee_requests.services import (
    create_draft,
    review_request,
    submit_request,
    update_draft,
)


def _visible_request(user, pk):
    """Non-enumerating fetch: out-of-scope ids are 404, not 403."""
    try:
        return (
            scoped_requests(user)
            .prefetch_related("steps", "steps__reviewer", "steps__reviewer__profile")
            .get(pk=pk)
        )
    except Exception:
        raise Http404 from None


def _new_type_code(name):
    """Server-generated internal code — never shown or edited in the UI; the
    random suffix keeps the (org, code) uniqueness constraint satisfied."""
    from uuid import uuid4

    from django.utils.text import slugify

    base = slugify(name)[:30] or "type"
    return f"{base}-{uuid4().hex[:8]}"


class RequestListView(APIView):
    permission_classes = [IsActiveAuthenticated]

    @extend_schema(
        responses={200: EmployeeRequestSerializer(many=True)},
        operation_id="requests_list",
    )
    def get(self, request):
        qs = request_queryset(request.user, request.query_params).prefetch_related(
            "steps", "steps__reviewer", "steps__reviewer__profile"
        )
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request)
        data = EmployeeRequestSerializer(page, many=True).data
        return paginator.get_paginated_response(data)

    @extend_schema(
        request=RequestDraftSerializer,
        responses={201: EmployeeRequestSerializer},
        operation_id="requests_create",
    )
    def post(self, request):
        ser = RequestDraftSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req = create_draft(request.user, ser.validated_data)
        return Response(EmployeeRequestSerializer(req).data, status=status.HTTP_201_CREATED)


class RequestDetailView(APIView):
    permission_classes = [IsActiveAuthenticated]

    @extend_schema(responses={200: EmployeeRequestSerializer})
    def get(self, request, pk):
        req = _visible_request(request.user, pk)
        return Response(EmployeeRequestSerializer(req).data)

    @extend_schema(
        request=RequestDraftSerializer,
        responses={200: EmployeeRequestSerializer},
    )
    def patch(self, request, pk):
        req = _visible_request(request.user, pk)
        ser = RequestDraftSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        req = update_draft(req, request.user, ser.validated_data)
        return Response(EmployeeRequestSerializer(req).data)


class RequestSubmitView(APIView):
    permission_classes = [IsActiveAuthenticated]

    @extend_schema(
        request=RequestReviewSerializer,
        responses={200: EmployeeRequestSerializer},
    )
    def post(self, request, pk):
        req = _visible_request(request.user, pk)
        # Only the owner may submit — the scope check above already excludes
        # other users' drafts; enforce owner explicitly for clarity.
        if req.employee.user_id != request.user.pk:
            raise Http404
        ser = RequestReviewSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        req = submit_request(req, request.user, ser.validated_data.get("version"))
        return Response(EmployeeRequestSerializer(req).data)


class _RequestActionView(APIView):
    """Approve/reject/return the current pending step."""

    permission_classes = [IsActiveAuthenticated]
    action = ""

    @extend_schema(
        request=RequestReviewSerializer,
        responses={200: EmployeeRequestSerializer},
    )
    def post(self, request, pk):
        req = _visible_request(request.user, pk)
        ser = RequestReviewSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        req = review_request(
            req,
            request.user,
            self.action,
            reason=ser.validated_data.get("reason", ""),
            expected_version=ser.validated_data.get("version"),
        )
        return Response(EmployeeRequestSerializer(req).data)


class RequestApproveView(_RequestActionView):
    action = "approve"


class RequestRejectView(_RequestActionView):
    action = "reject"


class RequestReturnView(_RequestActionView):
    action = "return"


class RequestHistoryView(APIView):
    """Immutable per-request history — events + all steps across cycles."""

    permission_classes = [IsActiveAuthenticated]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="RequestHistory",
                fields={
                    "events": RequestEventSerializer(many=True),
                    "steps": ApprovalStepSerializer(many=True),
                },
            )
        }
    )
    def get(self, request, pk):
        req = _visible_request(request.user, pk)
        return Response(
            {
                "events": RequestEventSerializer(req.events.all(), many=True).data,
                "steps": ApprovalStepSerializer(req.steps.all(), many=True).data,
            }
        )


class RequestTypeListView(APIView):
    permission_classes = [IsActiveAuthenticated]

    @extend_schema(
        responses={200: RequestTypeSerializer(many=True)},
        operation_id="request_types_list",
    )
    def get(self, request):
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(active_request_types(request.user), request)
        return paginator.get_paginated_response(RequestTypeSerializer(page, many=True).data)

    @extend_schema(
        request=RequestTypeWriteSerializer,
        responses={201: RequestTypeSerializer},
        operation_id="request_types_create",
    )
    def post(self, request):
        from apps.accounts.permissions import is_hr

        if not is_hr(request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied
        ser = RequestTypeWriteSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        req_type = RequestType.objects.create(
            organization_id=request.user.organization_id,
            code=_new_type_code(ser.validated_data["name"]),
            **ser.validated_data,
        )
        return Response(RequestTypeSerializer(req_type).data, status=status.HTTP_201_CREATED)


class RequestTypeDetailView(APIView):
    permission_classes = [IsActiveAuthenticated, IsHR]

    def _type(self, request, pk):
        try:
            return RequestType.objects.get(pk=pk, organization_id=request.user.organization_id)
        except (RequestType.DoesNotExist, ValueError):
            raise Http404 from None

    @extend_schema(responses={200: RequestTypeSerializer})
    def get(self, request, pk):
        return Response(RequestTypeSerializer(self._type(request, pk)).data)

    @extend_schema(
        request=RequestTypeWriteSerializer,
        responses={200: RequestTypeSerializer},
    )
    def patch(self, request, pk):
        req_type = self._type(request, pk)
        ser = RequestTypeWriteSerializer(
            instance=req_type, data=request.data, partial=True, context={"request": request}
        )
        ser.is_valid(raise_exception=True)
        for f, v in ser.validated_data.items():
            setattr(req_type, f, v)
        req_type.save()
        return Response(RequestTypeSerializer(req_type).data)


def _allocation_queryset():
    return EmployeeAllocationGrant.objects.select_related(
        "employee", "request_type"
    ).prefetch_related("adjustments", "commitments")


def _visible_grant(user, pk):
    qs = _allocation_queryset().filter(organization_id=user.organization_id)
    if not is_hr(user):
        qs = qs.filter(employee__user=user, status="active")
    try:
        return qs.get(pk=pk)
    except (EmployeeAllocationGrant.DoesNotExist, ValueError):
        raise Http404 from None


AllocationPreviewResponse = inline_serializer(
    name="AllocationPreview",
    fields={
        "required": serializers.BooleanField(),
        "amount": serializers.IntegerField(),
        "unit": serializers.CharField(required=False),
        "status": serializers.CharField(),
        "remaining": serializers.IntegerField(allow_null=True, required=False),
        "grant": serializers.UUIDField(allow_null=True, required=False),
    },
)


class AllocationPreviewView(APIView):
    permission_classes = [IsActiveAuthenticated]

    @extend_schema(
        parameters=[AllocationPreviewSerializer], responses={200: AllocationPreviewResponse}
    )
    def get(self, request):
        ser = AllocationPreviewSerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)
        req_type = RequestType.objects.filter(
            pk=ser.validated_data["type"], organization_id=request.user.organization_id,
            is_active=True,
        ).first()
        if req_type is None:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"type": ["Unknown or inactive request type."]})
        return Response(preview(request.user, req_type, ser.validated_data))


class AllocationMineView(APIView):
    permission_classes = [IsActiveAuthenticated]

    @extend_schema(responses={200: AllocationGrantSerializer(many=True)})
    def get(self, request):
        qs = _allocation_queryset().filter(
            organization_id=request.user.organization_id,
            employee__user=request.user,
            status="active",
        ).order_by("-end_date", "pk")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AllocationGrantSerializer(page, many=True).data)


class AllocationListView(APIView):
    permission_classes = [IsHR]

    @extend_schema(responses={200: AllocationGrantSerializer(many=True)})
    def get(self, request):
        qs = _allocation_queryset().filter(organization_id=request.user.organization_id)
        if employee := request.query_params.get("employee"):
            try:
                qs = qs.filter(employee_id=serializers.UUIDField().run_validation(employee))
            except serializers.ValidationError:
                raise serializers.ValidationError(
                    {"employee": ["Invalid employee ID."]}
                ) from None
        if grant_status := request.query_params.get("status"):
            if grant_status not in EmployeeAllocationGrant.Status.values:
                raise serializers.ValidationError({"status": ["Invalid allocation status."]})
            qs = qs.filter(status=grant_status)
        qs = qs.order_by("-created_at", "pk")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AllocationGrantSerializer(page, many=True).data)

    @extend_schema(request=AllocationCreateSerializer, responses={201: AllocationGrantSerializer})
    def post(self, request):
        ser = AllocationCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        from rest_framework.exceptions import ValidationError

        try:
            employee = EmployeeProfile.objects.get(
                pk=data["employee"], organization_id=request.user.organization_id
            )
            req_type = RequestType.objects.get(
                pk=data["request_type"], organization_id=request.user.organization_id
            )
        except (EmployeeProfile.DoesNotExist, RequestType.DoesNotExist):
            raise ValidationError(
                {"detail": ["Employee or type not found in this organization."]}
            ) from None
        grant = create_grant(
            request.user, employee, req_type, data["start_date"], data["end_date"],
            data["initial_amount"],
        )
        return Response(AllocationGrantSerializer(grant).data, status=status.HTTP_201_CREATED)


class AllocationDetailView(APIView):
    permission_classes = [IsActiveAuthenticated]

    @extend_schema(responses={200: AllocationGrantSerializer})
    def get(self, request, pk):
        return Response(AllocationGrantSerializer(_visible_grant(request.user, pk)).data)

    @extend_schema(request=AllocationDateEditSerializer, responses={200: AllocationGrantSerializer})
    def patch(self, request, pk):
        if not is_hr(request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied
        _visible_grant(request.user, pk)
        ser = AllocationDateEditSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        grant = edit_grant_dates(request.user, pk, **ser.validated_data)
        return Response(AllocationGrantSerializer(grant).data)


class AllocationAdjustView(APIView):
    permission_classes = [IsHR]

    @extend_schema(request=AllocationAdjustSerializer, responses={200: AllocationGrantSerializer})
    def post(self, request, pk):
        _visible_grant(request.user, pk)
        ser = AllocationAdjustSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        grant = adjust_grant(request.user, pk, **ser.validated_data)
        return Response(AllocationGrantSerializer(grant).data)


class AllocationVoidView(APIView):
    permission_classes = [IsHR]

    @extend_schema(request=AllocationVoidSerializer, responses={200: AllocationGrantSerializer})
    def post(self, request, pk):
        _visible_grant(request.user, pk)
        ser = AllocationVoidSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        grant = void_grant(request.user, pk, **ser.validated_data)
        return Response(AllocationGrantSerializer(grant).data)


class AllocationHistoryView(APIView):
    permission_classes = [IsHR]
    kind = ""

    @extend_schema(responses={200: AllocationChangeSerializer(many=True)})
    def get(self, request, pk):
        grant = _visible_grant(request.user, pk)
        if self.kind == "adjustments":
            qs = grant.adjustments.order_by("-occurred_at", "pk")
            serializer = AllocationAdjustmentSerializer
        else:
            qs = grant.changes.order_by("-occurred_at", "pk")
            serializer = AllocationChangeSerializer
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(serializer(page, many=True).data)


class AllocationAdjustmentsView(AllocationHistoryView):
    kind = "adjustments"


class AllocationChangesView(AllocationHistoryView):
    kind = "changes"


# Schema-only detail serializer for documented error bodies.
DetailSerializer = inline_serializer(
    name="RequestDetail",
    fields={
        "code": serializers.CharField(),
        "detail": serializers.CharField(),
        "request_id": serializers.CharField(),
    },
)
