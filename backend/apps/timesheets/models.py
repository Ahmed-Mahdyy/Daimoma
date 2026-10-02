import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Timesheet(models.Model):
    """Weekly review unit (D-005). `version` is the optimistic-lock token;
    `cycle` counts submission cycles (0 = never submitted). `timezone` and
    the period bounds are snapshots — later org-setting changes never
    reinterpret existing sheets."""

    class Status(models.TextChoices):
        COLLECTING = "collecting", "Collecting"
        PENDING_MANAGER = "pending_manager", "Pending manager"
        PENDING_HR = "pending_hr", "Pending HR"
        APPROVED = "approved", "Approved"
        RETURNED = "returned", "Returned"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="timesheets"
    )
    employee = models.ForeignKey(
        "accounts.EmployeeProfile", on_delete=models.PROTECT, related_name="timesheets"
    )
    period_start = models.DateField()
    period_end = models.DateField()
    timezone = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COLLECTING)
    current_reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="timesheets_to_review",
    )
    cycle = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    submitted_at = models.DateTimeField(null=True, blank=True)
    route_snapshot = models.JSONField(
        default=dict,
        help_text="Frozen reviewer route for the current cycle (D-004/D-005).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-period_start"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "period_start"], name="uniq_timesheet_emp_period"
            ),
            models.CheckConstraint(
                condition=models.Q(period_end__gt=models.F("period_start")),
                name="timesheet_period_order",
            ),
            models.CheckConstraint(
                condition=models.Q(version__gte=1), name="timesheet_version_gte1"
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status", "period_start"]),
        ]

    def __str__(self):
        return f"{self.employee} {self.period_start}..{self.period_end}"

    def clean(self):
        if self.period_end and self.period_start:
            if (self.period_end - self.period_start).days != 6:
                raise ValidationError({"period_end": "Sheets cover exactly 7 days."})


class WorkDay(models.Model):
    """Daily submission unit (D-005): employees submit each day independently;
    submitting locks the day's entries. Status flows back up from the parent
    sheet's review outcome."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        RETURNED = "returned", "Returned"
        APPROVED = "approved", "Approved"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="workdays"
    )
    employee = models.ForeignKey(
        "accounts.EmployeeProfile", on_delete=models.PROTECT, related_name="workdays"
    )
    timesheet = models.ForeignKey(Timesheet, on_delete=models.PROTECT, related_name="days")
    work_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    submitted_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["work_date"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "work_date"], name="uniq_workday_emp_date"),
            models.CheckConstraint(condition=models.Q(version__gte=1), name="workday_version_gte1"),
        ]
        indexes = [
            models.Index(fields=["timesheet", "work_date"]),
        ]

    def __str__(self):
        return f"{self.employee} {self.work_date}"


class TimeEntry(models.Model):
    """One worked interval (already split at local midnight by the service).
    `duration_minutes` is server-calculated; `work_date` is the local date in
    the sheet's timezone snapshot. Out-of-window entries keep `window_flag`
    plus a mandatory `window_reason` (D-005). `voided_at` is the recorded
    removal — entries are never hard-deleted."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="time_entries"
    )
    employee = models.ForeignKey(
        "accounts.EmployeeProfile", on_delete=models.PROTECT, related_name="time_entries"
    )
    workday = models.ForeignKey(WorkDay, on_delete=models.PROTECT, related_name="entries")
    work_date = models.DateField()
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    break_minutes = models.IntegerField(default=0)
    duration_minutes = models.IntegerField()
    description = models.CharField(max_length=1000, blank=True)
    window_flag = models.BooleanField(default=False)
    window_reason = models.CharField(max_length=500, blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["work_date", "start_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_at__gt=models.F("start_at")),
                name="entry_end_after_start",
            ),
            models.CheckConstraint(
                condition=models.Q(break_minutes__gte=0), name="entry_break_nonneg"
            ),
            models.CheckConstraint(
                condition=models.Q(duration_minutes__gt=0), name="entry_duration_pos"
            ),
            models.CheckConstraint(
                condition=models.Q(window_flag=False) | ~models.Q(window_reason=""),
                name="entry_flag_needs_reason",
            ),
        ]
        indexes = [
            models.Index(fields=["employee", "start_at", "end_at"]),
        ]

    def __str__(self):
        return f"{self.employee} {self.work_date} {self.duration_minutes}m"


class OpenCheckIn(models.Model):
    """One open clock-in per employee — the quick check-in/check-out flow.
    The row is deleted when check-out writes a real TimeEntry through the
    normal service (so overlap/midnight/window rules still apply), or when
    the employee cancels it. It is never a timesheet entry itself."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="open_check_ins"
    )
    employee = models.OneToOneField(
        "accounts.EmployeeProfile", on_delete=models.CASCADE, related_name="open_check_in"
    )
    started_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.employee} checked in {self.started_at}"


class TimesheetEvent(models.Model):
    """Immutable per-cycle history; one row per sheet version. `snapshot`
    stores an allowlisted summary (submitted totals/days/timezone), never
    secrets or free-text beyond the required reason."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sheet = models.ForeignKey(Timesheet, on_delete=models.PROTECT, related_name="events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="timesheet_events",
    )
    event_type = models.CharField(max_length=40)
    previous_state = models.CharField(max_length=20, blank=True)
    new_state = models.CharField(max_length=20, blank=True)
    cycle = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField()
    reason = models.TextField(blank=True)
    snapshot = models.JSONField(default=dict)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["occurred_at"]
        constraints = [
            models.UniqueConstraint(fields=["sheet", "version"], name="uniq_tsevent_sheet_version"),
        ]

    def __str__(self):
        return f"{self.sheet_id} {self.event_type} v{self.version}"
