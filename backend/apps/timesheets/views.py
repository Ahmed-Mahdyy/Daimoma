"""HTTP adapters for the timesheet contract (contracts/api.md). All state
changes run in services.py; views only parse, scope, and serialize."""

from datetime import date as date_type

from drf_spectacular.utils import extend_schema
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.timesheets import selectors, services
from apps.timesheets.models import TimeEntry
from apps.timesheets.serializers import (
    SheetTransitionSerializer,
    TimeEntrySerializer,
    TimeEntryWriteSerializer,
    TimesheetCreateSerializer,
    TimesheetEventSerializer,
    TimesheetSerializer,
)


def _scoped_or_404(user, sheet_id):
    sheet = selectors.sheet_for(user, sheet_id)
    if sheet is None:
        from rest_framework.exceptions import NotFound

        raise NotFound()
    return sheet


def _detail(sheet):
    from apps.timesheets.selectors import day_totals

    return TimesheetSerializer(sheet, context={"totals": day_totals(sheet)})


class TimesheetListView(APIView):
    @extend_schema(responses=TimesheetSerializer(many=True))
    def get(self, request):
        qs = selectors.timesheet_queryset(request.user, request.query_params)
        from apps.accounts.pagination import DefaultPagination

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(TimesheetSerializer(page, many=True).data)

    @extend_schema(
        request=TimesheetCreateSerializer,
        responses={201: TimesheetSerializer},
    )
    def post(self, request):
        ser = TimesheetCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sheet = services.get_or_create_sheet(request.user, ser.validated_data["period_start"])
        return Response(
            _detail(sheet).data,
            status=http_status.HTTP_201_CREATED,
        )


class TimesheetDetailView(APIView):
    @extend_schema(responses=TimesheetSerializer)
    def get(self, request, pk):
        sheet = _scoped_or_404(request.user, pk)
        return Response(_detail(sheet).data)

    @extend_schema(responses=TimesheetSerializer)
    def delete(self, request, pk):
        # No sheet deletion endpoint — scoped fetch kept for parity; removal
        # requires a separately-approved retention operation.
        _scoped_or_404(request.user, pk)
        return Response(status=http_status.HTTP_405_METHOD_NOT_ALLOWED)


class EntryListView(APIView):
    @extend_schema(
        request=TimeEntryWriteSerializer,
        responses={201: TimeEntrySerializer(many=True)},
    )
    def post(self, request, pk):
        _scoped_or_404(request.user, pk)
        ser = TimeEntryWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        created = services.create_entries(pk, request.user, ser.validated_data)
        return Response(
            TimeEntrySerializer(created, many=True).data,
            status=http_status.HTTP_201_CREATED,
        )


class EntryDetailView(APIView):
    def _entry_or_404(self, request, entry_id):
        entry = (
            TimeEntry.objects.filter(pk=entry_id)
            .select_related("workday", "workday__timesheet")
            .first()
        )
        if entry is None:
            from rest_framework.exceptions import NotFound

            raise NotFound()
        # Entry visibility == parent sheet scope.
        if selectors.sheet_for(request.user, entry.workday.timesheet_id) is None:
            from rest_framework.exceptions import NotFound

            raise NotFound()
        return entry

    @extend_schema(request=TimeEntryWriteSerializer, responses=TimeEntrySerializer)
    def patch(self, request, pk, entry_pk):
        self._entry_or_404(request, entry_pk)
        ser = TimeEntryWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        entry = services.update_entry(entry_pk, request.user, ser.validated_data)
        return Response(TimeEntrySerializer(entry).data)


class EntryVoidView(APIView):
    @extend_schema(request=SheetTransitionSerializer, responses={204: None})
    def post(self, request, pk, entry_pk):
        EntryDetailView()._entry_or_404(request, entry_pk)
        ser = SheetTransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        services.void_entry(
            entry_pk,
            request.user,
            expected_version=ser.validated_data.get("expected_version"),
        )
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class DaySubmitView(APIView):
    @extend_schema(request=None, responses=TimesheetSerializer)
    def post(self, request, pk, work_date):
        _scoped_or_404(request.user, pk)
        try:
            d = date_type.fromisoformat(work_date)
        except ValueError:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"work_date": ["Invalid date."]}) from None
        services.submit_day(pk, d, request.user)
        return Response(_detail(selectors.sheet_for(request.user, pk)).data)


class _SheetActionView(APIView):
    @extend_schema(request=SheetTransitionSerializer, responses=TimesheetSerializer)
    def post(self, request, pk):
        raise NotImplementedError


class SheetSubmitView(APIView):
    @extend_schema(request=SheetTransitionSerializer, responses=TimesheetSerializer)
    def post(self, request, pk):
        _scoped_or_404(request.user, pk)
        ser = SheetTransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sheet = services.submit_sheet(
            pk,
            request.user,
            expected_version=ser.validated_data.get("expected_version"),
        )
        return Response(_detail(sheet).data)


class SheetApproveView(_SheetActionView):
    @extend_schema(request=SheetTransitionSerializer, responses=TimesheetSerializer)
    def post(self, request, pk):
        _scoped_or_404(request.user, pk)
        ser = SheetTransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        sheet = services.review_sheet(
            pk,
            request.user,
            "approve",
            expected_version=data.get("expected_version"),
        )
        return Response(_detail(sheet).data)


class SheetRejectView(_SheetActionView):
    @extend_schema(request=SheetTransitionSerializer, responses=TimesheetSerializer)
    def post(self, request, pk):
        _scoped_or_404(request.user, pk)
        ser = SheetTransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        sheet = services.review_sheet(
            pk,
            request.user,
            "reject",
            reason=data.get("reason", ""),
            expected_version=data.get("expected_version"),
        )
        return Response(_detail(sheet).data)


class SheetReturnView(_SheetActionView):
    @extend_schema(request=SheetTransitionSerializer, responses=TimesheetSerializer)
    def post(self, request, pk):
        _scoped_or_404(request.user, pk)
        ser = SheetTransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        sheet = services.review_sheet(
            pk,
            request.user,
            "return",
            reason=data.get("reason", ""),
            expected_version=data.get("expected_version"),
        )
        return Response(_detail(sheet).data)


class SheetReopenView(APIView):
    @extend_schema(request=SheetTransitionSerializer, responses=TimesheetSerializer)
    def post(self, request, pk):
        _scoped_or_404(request.user, pk)
        ser = SheetTransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        sheet = services.reopen_sheet(
            pk,
            request.user,
            reason=data.get("reason", ""),
            expected_version=data.get("expected_version"),
        )
        return Response(_detail(sheet).data)


class SheetHistoryView(APIView):
    @extend_schema(responses=TimesheetEventSerializer(many=True))
    def get(self, request, pk):
        sheet = _scoped_or_404(request.user, pk)
        return Response(
            TimesheetEventSerializer(
                sheet.events.select_related("actor", "actor__profile"), many=True
            ).data
        )
