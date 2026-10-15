import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

# D-006 categories replaced 2026-10-05 (owner): request types are free-named;
# a visible allocation `unit` decides the measured input — none (no amount),
# unit (whole-count quantity) or hour (quarter-hour amount, stored as minutes
# in allocation rows). requires_allocation is derived from unit.


class RequestType(models.Model):
    """HR-managed request type. Routing config (requires_hr) applies to new
    cycles only — submitted work keeps its route snapshot (D-004/D-006)."""

    class Unit(models.TextChoices):
        NONE = "none", "Not measurable"
        UNIT = "unit", "Units"
        HOUR = "hour", "Hours"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="request_types"
    )
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=120)
    unit = models.CharField(max_length=20, choices=Unit.choices, default=Unit.NONE)
    requires_item = models.BooleanField(
        default=False,
        help_text="Ask the employee for an item/asset name on this type (e.g. equipment).",
    )
    requires_dates = models.BooleanField(
        default=False,
        help_text="Ask the employee for a start/end date range on this type "
        "(e.g. leave, work from home).",
    )
    help_text = models.TextField(blank=True)
    requires_manager = models.BooleanField(default=True)
    requires_hr = models.BooleanField(default=False)
    # Tri-state: None (default) follows the unit — measured types draw from
    # allocations, plain ones don't. HR may explicitly opt a measured type out
    # (False); "none" types can never draw.
    requires_allocation = models.BooleanField(default=None, null=True)
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

    def save(self, *args, **kwargs):
        # "none" types can never draw from an allocation; a measured type with
        # no explicit choice defaults to drawing (opt-out by setting False).
        if self.unit == self.Unit.NONE:
            self.requires_allocation = False
        elif self.requires_allocation is None:
            self.requires_allocation = True
        super().save(*args, **kwargs)

    def clean(self):
        if not self.code or not self.code.strip():
            raise ValidationError({"code": "Code cannot be blank."})
        if not self.name or not self.name.strip():
            raise ValidationError({"name": "Name cannot be blank."})
        if not self.requires_manager and not self.requires_hr:
            raise ValidationError(
                {"requires_hr": "At least one approval stage is required."}
            )


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
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    equipment_item = models.CharField(max_length=120, blank=True)
    quantity = models.PositiveIntegerField(null=True, blank=True)
    hours = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
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
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            errors["end_time"] = "End time must be after the start time."
        if self.quantity is not None and self.quantity < 1:
            errors["quantity"] = "Quantity must be at least 1."
        if self.hours is not None and self.hours <= 0:
            errors["hours"] = "Hours must be positive."
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


class EmployeeAllocationGrant(models.Model):
    class Unit(models.TextChoices):
        # "hour" rows store whole minutes in `amount`-typed columns.
        UNIT = "unit", "Units"
        HOUR = "hour", "Hours"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        VOID = "void", "Removed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="allocation_grants"
    )
    employee = models.ForeignKey(
        "accounts.EmployeeProfile", on_delete=models.PROTECT, related_name="allocation_grants"
    )
    request_type = models.ForeignKey(
        RequestType, on_delete=models.PROTECT, related_name="allocation_grants"
    )
    unit = models.CharField(max_length=16, choices=Unit.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    initial_amount = models.PositiveIntegerField()
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.ACTIVE)
    version = models.PositiveIntegerField(default=1)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="granted_allocations",
    )
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="voided_allocations",
    )
    void_reason = models.TextField(blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["organization", "employee", "request_type", "status"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(initial_amount__gt=0), name="allocation_positive_award"
            ),
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="allocation_dates_ordered",
            ),
        ]

    def __str__(self):
        return f"{self.employee_id} / {self.request_type_id} ({self.start_date}–{self.end_date})"

    def clean(self):
        errors = {}
        if self.end_date and self.start_date and self.end_date < self.start_date:
            errors["end_date"] = "End date must not precede start date."
        if self.initial_amount is not None and self.initial_amount < 1:
            errors["initial_amount"] = "Award must be positive."
        if (
            self.employee_id and self.organization_id
            and self.employee.organization_id != self.organization_id
        ):
            errors["employee"] = "Employee must belong to this organization."
        if (
            self.request_type_id and self.organization_id
            and self.request_type.organization_id != self.organization_id
        ):
            errors["request_type"] = "Request type must belong to this organization."
        if self.request_type_id and self.unit != self.request_type.unit:
            errors["unit"] = "Unit must match the request type's unit."
        if errors:
            raise ValidationError(errors)


class AllocationAdjustment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grant = models.ForeignKey(
        EmployeeAllocationGrant, on_delete=models.PROTECT, related_name="adjustments"
    )
    delta = models.IntegerField()
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    reason = models.TextField()
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=~models.Q(delta=0), name="allocation_nonzero_delta")
        ]

    def __str__(self):
        return f"{self.delta:+d} for {self.grant_id}"


class AllocationGrantChange(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grant = models.ForeignKey(
        EmployeeAllocationGrant, on_delete=models.PROTECT, related_name="changes"
    )
    action = models.CharField(max_length=20)
    previous = models.JSONField(default=dict)
    current = models.JSONField(default=dict)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    reason = models.TextField()
    occurred_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} for {self.grant_id}"


class RequestAllocationCommitment(models.Model):
    class Disposition(models.TextChoices):
        RESERVED = "reserved", "Reserved"
        USED = "used", "Used"
        RELEASED = "released", "Released"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        EmployeeRequest, on_delete=models.PROTECT, related_name="allocation_commitments"
    )
    grant = models.ForeignKey(
        EmployeeAllocationGrant, on_delete=models.PROTECT, related_name="commitments"
    )
    cycle = models.PositiveIntegerField()
    amount = models.PositiveIntegerField()
    unit = models.CharField(max_length=16, choices=EmployeeAllocationGrant.Unit.choices)
    disposition = models.CharField(
        max_length=10, choices=Disposition.choices, default=Disposition.RESERVED
    )
    snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["request", "cycle"], name="uniq_allocation_request_cycle"
            ),
            models.CheckConstraint(
                condition=models.Q(amount__gt=0), name="allocation_positive_commitment"
            ),
        ]
        indexes = [models.Index(fields=["grant", "disposition"])]

    def __str__(self):
        return f"{self.amount} {self.unit} for {self.request_id} cycle {self.cycle}"
