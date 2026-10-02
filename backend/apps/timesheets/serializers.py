"""Explicit allowlists for timesheet payloads. Workflow fields (status,
reviewer, totals, period, employee, organization) are never writable —
transitions go through service actions only."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.timesheets.models import TimeEntry, Timesheet, WorkDay


class TimeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "work_date",
            "start_at",
            "end_at",
            "break_minutes",
            "duration_minutes",
            "description",
            "window_flag",
            "window_reason",
            "voided_at",
        ]
        read_only_fields = fields


class TimeEntryWriteSerializer(serializers.Serializer):
    """Create/update payload. start_at/end_at must carry explicit UTC
    offsets (ISO-8601 with offset)."""

    work_date = serializers.DateField(required=False)
    start_at = serializers.DateTimeField(required=False)
    end_at = serializers.DateTimeField(required=False)
    break_minutes = serializers.IntegerField(required=False, min_value=0)
    segment_breaks = serializers.ListField(
        child=serializers.IntegerField(min_value=0),
        required=False,
        help_text="Explicit per-day break allocation when the interval crosses local midnight.",
    )
    description = serializers.CharField(required=False, max_length=1000, allow_blank=True)
    window_reason = serializers.CharField(required=False, max_length=500, allow_blank=True)
    expected_version = serializers.IntegerField(required=False, min_value=1)


class WorkDaySerializer(serializers.ModelSerializer):
    entries = TimeEntrySerializer(many=True, read_only=True)
    total_minutes = serializers.SerializerMethodField()

    class Meta:
        model = WorkDay
        fields = [
            "id",
            "work_date",
            "status",
            "submitted_at",
            "version",
            "total_minutes",
            "entries",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.IntegerField)
    def get_total_minutes(self, day):
        entries = getattr(day, "non_voided_entries", None)
        if entries is None:
            entries = [e for e in day.entries.all() if e.voided_at is None]
        return sum(e.duration_minutes for e in entries)


class TimesheetSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.display_name", read_only=True, default=""
    )
    employee_email = serializers.EmailField(source="employee.user.email", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    reviewer_name = serializers.SerializerMethodField()
    reviewer_email = serializers.SerializerMethodField()
    total_minutes = serializers.SerializerMethodField()
    days = serializers.SerializerMethodField()

    class Meta:
        model = Timesheet
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_email",
            "employee_code",
            "period_start",
            "period_end",
            "timezone",
            "status",
            "current_reviewer",
            "reviewer_name",
            "reviewer_email",
            "cycle",
            "version",
            "submitted_at",
            "total_minutes",
            "days",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_reviewer_name(self, sheet) -> str | None:
        profile = getattr(sheet.current_reviewer, "profile", None)
        return profile.display_name if profile else None

    def get_reviewer_email(self, sheet) -> str | None:
        return sheet.current_reviewer.email if sheet.current_reviewer else None

    def get_total_minutes(self, sheet) -> int:
        totals = self.context.get("totals")
        if totals is not None:
            return sum(totals.values())
        return sum(
            e.duration_minutes
            for d in sheet.days.all()
            for e in d.entries.all()
            if e.voided_at is None
        )

    @extend_schema_field(WorkDaySerializer(many=True))
    def get_days(self, sheet):
        days = getattr(sheet, "_prefetched_days", None)
        if days is None:
            days = sheet.days.all()
        return WorkDaySerializer(days, many=True).data


class TimesheetCreateSerializer(serializers.Serializer):
    """Only an anchor date — period bounds + timezone are server-derived."""

    period_start = serializers.DateField()


class SheetTransitionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    expected_version = serializers.IntegerField(required=False, min_value=1)


class TimesheetEventSerializer(serializers.Serializer):
    event_type = serializers.CharField()
    actor_email = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()
    previous_state = serializers.CharField()
    new_state = serializers.CharField()
    cycle = serializers.IntegerField()
    version = serializers.IntegerField()
    reason = serializers.CharField()
    snapshot = serializers.JSONField()
    occurred_at = serializers.DateTimeField()

    def get_actor_email(self, event) -> str | None:
        return event.actor.email if event.actor else None

    def get_actor_name(self, event) -> str | None:
        if not event.actor:
            return None
        profile = getattr(event.actor, "profile", None)
        return profile.display_name if profile else None
