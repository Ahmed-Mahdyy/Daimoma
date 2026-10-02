import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

# Categories approved under D-006 (2026-09-29); fixed set, no free-form types.
DATE_CATEGORIES = {"leave", "work_from_home"}


class RequestType(models.Model):
    """HR-managed request type. Routing config (requires_hr) applies to new
    cycles only — submitted work keeps its route snapshot (D-004/D-006)."""

    class Category(models.TextChoices):
        LEAVE = "leave", "Leave"
        EQUIPMENT = "equipment", "Equipment"
        HR_SERVICE = "hr_service", "HR service"
        WORK_FROM_HOME = "work_from_home", "Work from home"
        GENERAL = "general", "General"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="request_types"
    )
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=20, choices=Category.choices)
    help_text = models.TextField(blank=True)
    requires_hr = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"], name="uniq_requesttype_org_code"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"

    def clean(self):
        if not self.code or not self.code.strip():
            raise ValidationError({"code": "Code cannot be blank."})
        if not self.name or not self.name.strip():
            raise ValidationError({"name": "Name cannot be blank."})


class EmployeeRequest(models.Model):
    """An employee's internal request. `version` is the optimistic-lock token;
    `cycle` counts submission cycles (0 = never submitted). `route_snapshot`
    freezes the reviewer/route plan at submit time so later config or
    reporting-line changes never reinterpret past cycles."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_MANAGER = "pending_manager", "Pending manager"
        PENDING_HR = "pending_hr", "Pending HR"
        APPROVED = "approved", "Approved"
        RETURNED = "returned", "Returned"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="requests"
    )
    employee = models.ForeignKey(
        "accounts.EmployeeProfile", on_delete=models.PROTECT, related_name="requests"
    )
    type = models.ForeignKey(RequestType, on_delete=models.PROTECT, related_name="requests")
    title = models.CharField(max_length=200)
    description = models.TextField()
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    equipment_item = models.CharField(max_length=120, blank=True)
    quantity = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    cycle = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    route_snapshot = models.JSONField(default=dict, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]
        indexes = [
            models.Index(fields=["organization", "employee", "status", "-created_at"]),
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    @property
    def editable(self):
        return self.status in (self.Status.DRAFT, self.Status.RETURNED)

    def clean(self):
        errors = {}
        if (
            self.employee_id
            and self.organization_id
            and (self.employee.organization_id != self.organization_id)
        ):
            errors["employee"] = "Employee must belong to the request's organization."
        if (
            self.type_id
            and self.organization_id
            and (self.type.organization_id != self.organization_id)
        ):
            errors["type"] = "Request type must belong to the request's organization."
        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "End date cannot be before the start date."
        if self.quantity is not None and self.quantity < 1:
            errors["quantity"] = "Quantity must be at least 1."
        if self.description and len(self.description) > 5000:
            errors["description"] = "Description cannot exceed 5000 characters."
        if errors:
            raise ValidationError(errors)


class RequestApprovalStep(models.Model):
    """One reviewer's decision within a submission cycle. The current pending
    step is the only one its reviewer may act on; completed steps are immutable
    history (D-004)."""

    class StepStatus(models.TextChoices):
        WAITING = "waiting", "Waiting"
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        RETURNED = "returned", "Returned"

    class RequiredRole(models.TextChoices):
        MANAGER = "manager", "Manager"
        HR = "hr", "HR"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(EmployeeRequest, on_delete=models.CASCADE, related_name="steps")
    cycle = models.PositiveIntegerField()
    sequence = models.PositiveSmallIntegerField()
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="review_steps",
    )
    required_role = models.CharField(max_length=10, choices=RequiredRole.choices)
    status = models.CharField(max_length=10, choices=StepStatus.choices, default=StepStatus.WAITING)
    reason = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["cycle", "sequence"]
        constraints = [
            models.UniqueConstraint(
                fields=["request", "cycle", "sequence"],
                name="uniq_step_request_cycle_seq",
            )
        ]
        indexes = [models.Index(fields=["reviewer", "status"])]

    def __str__(self):
        return f"Step {self.sequence} of {self.request_id} (cycle {self.cycle})"


class RequestEvent(models.Model):
    """Append-only per-request history row. `version` mirrors the request's
    optimistic-lock value at write time, making each event unique per
    mutation; `snapshot` holds the allowlisted route/content snapshot."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(EmployeeRequest, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="request_events",
    )
    event_type = models.CharField(max_length=40)
    previous_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20, blank=True)
    cycle = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField()
    reason = models.TextField(blank=True)
    snapshot = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["occurred_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["request", "version"], name="uniq_event_request_version"
            )
        ]

    def __str__(self):
        return f"{self.event_type} on {self.request_id} (cycle {self.cycle})"
