from django.http import Http404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.pagination import DefaultPagination
from apps.accounts.permissions import IsActiveAuthenticated, IsHR
from apps.employee_requests.models import RequestType
from apps.employee_requests.selectors import (
    active_request_types,
    request_queryset,
    scoped_requests,
)
from apps.employee_requests.serializers import (
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
        ser = RequestTypeWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from rest_framework.exceptions import ValidationError

        if RequestType.objects.filter(
            organization_id=request.user.organization_id,
            code__iexact=ser.validated_data["code"].strip(),
        ).exists():
            raise ValidationError({"code": ["A type with this code already exists."]})
        req_type = RequestType.objects.create(
            organization_id=request.user.organization_id, **ser.validated_data
        )
        return Response(RequestTypeSerializer(req_type).data, status=status.HTTP_201_CREATED)


class RequestTypeDetailView(APIView):
    permission_classes = [IsActiveAuthenticated, IsHR]

    def _type(self, request, pk):
        try:
            return RequestType.objects.get(pk=pk, organization_id=request.user.organization_id)
        except (RequestType.DoesNotExist, ValueError):
            raise Http404 from None

    @extend_schema(
        request=RequestTypeWriteSerializer,
        responses={200: RequestTypeSerializer},
    )
    def patch(self, request, pk):
        req_type = self._type(request, pk)
        ser = RequestTypeWriteSerializer(instance=req_type, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if (code := data.get("code")) and code.strip().lower() != req_type.code.lower():
            from rest_framework.exceptions import ValidationError

            if RequestType.objects.filter(
                organization_id=request.user.organization_id,
                code__iexact=code.strip(),
            ).exists():
                raise ValidationError({"code": ["A type with this code already exists."]})
        for f, v in data.items():
            setattr(req_type, f, v)
        req_type.save()
        return Response(RequestTypeSerializer(req_type).data)


# Schema-only detail serializer for documented error bodies.
DetailSerializer = inline_serializer(
    name="RequestDetail",
    fields={
        "code": serializers.CharField(),
        "detail": serializers.CharField(),
        "request_id": serializers.CharField(),
    },
)
