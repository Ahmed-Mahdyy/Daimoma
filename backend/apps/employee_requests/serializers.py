from rest_framework import serializers

from apps.employee_requests.models import (
    AllocationAdjustment,
    AllocationGrantChange,
    EmployeeAllocationGrant,
    EmployeeRequest,
    RequestApprovalStep,
    RequestEvent,
    RequestType,
)


class RequestTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestType
        fields = [
            "id",
            "code",
            "name",
            "unit",
            "help_text",
            "requires_manager",
            "requires_hr",
            "requires_allocation",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "code", "requires_allocation", "created_at"]


class RequestTypeWriteSerializer(serializers.Serializer):
    """HR type configuration — organization and code assigned server-side;
    a measurable unit means the type draws from allocations."""

    name = serializers.CharField(max_length=120)
    unit = serializers.ChoiceField(choices=RequestType.Unit.choices, default="none")
    help_text = serializers.CharField(required=False, allow_blank=True, default="")
    requires_manager = serializers.BooleanField(default=True)
    requires_hr = serializers.BooleanField(default=False)
    is_active = serializers.BooleanField(default=True)

    def validate(self, attrs):
        requires_manager = attrs.get(
            "requires_manager", getattr(self.instance, "requires_manager", True)
        )
        requires_hr = attrs.get(
            "requires_hr", getattr(self.instance, "requires_hr", False)
        )
        if not requires_manager and not requires_hr:
            raise serializers.ValidationError(
                {"requires_hr": "At least one approval stage is required."}
            )
        unit = attrs.get("unit", getattr(self.instance, "unit", None))
        if self.instance and unit != self.instance.unit and (
            self.instance.allocation_grants.exists()
            or EmployeeRequest.objects.filter(
                type=self.instance, allocation_commitments__isnull=False
            ).exists()
        ):
            raise serializers.ValidationError(
                {"unit": "Unit cannot change after allocation use."}
            )
        return attrs


class AllocationGrantSerializer(serializers.ModelSerializer):
    type_name = serializers.CharField(source="request_type.name", read_only=True)
    employee_name = serializers.CharField(source="employee.display_name", read_only=True)
    granted = serializers.SerializerMethodField()
    reserved = serializers.SerializerMethodField()
    used = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeAllocationGrant
        fields = [
            "id", "employee", "employee_name", "request_type", "type_name", "unit",
            "start_date", "end_date", "initial_amount", "status", "version",
            "granted", "reserved", "used", "remaining", "created_at", "voided_at",
        ]
        read_only_fields = fields

    def _totals(self, grant):
        from apps.employee_requests.allocations import grant_totals

        if not hasattr(grant, "_serialized_allocation_totals"):
            grant._serialized_allocation_totals = grant_totals(grant)
        return grant._serialized_allocation_totals

    def get_granted(self, grant) -> int:
        return self._totals(grant)["granted"]

    def get_reserved(self, grant) -> int:
        return self._totals(grant)["reserved"]

    def get_used(self, grant) -> int:
        return self._totals(grant)["used"]

    def get_remaining(self, grant) -> int:
        return self._totals(grant)["remaining"]


class AllocationAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllocationAdjustment
        fields = ["id", "delta", "reason", "actor", "occurred_at"]
        read_only_fields = fields


class AllocationChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllocationGrantChange
        fields = ["id", "action", "previous", "current", "reason", "actor", "occurred_at"]
        read_only_fields = fields


class StrictAllocationInput(serializers.Serializer):
    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {field: ["This field cannot be set."] for field in sorted(unknown)}
            )
        return super().to_internal_value(data)


class AllocationPreviewSerializer(StrictAllocationInput):
    type = serializers.UUIDField()
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    start_time = serializers.TimeField(required=False)
    end_time = serializers.TimeField(required=False)
    equipment_item = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.IntegerField(required=False, min_value=1)
    hours = serializers.DecimalField(
        required=False, max_digits=5, decimal_places=2, min_value=0
    )


class AllocationCreateSerializer(StrictAllocationInput):
    employee = serializers.UUIDField()
    request_type = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    initial_amount = serializers.IntegerField(min_value=1)


class AllocationDateEditSerializer(StrictAllocationInput):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    version = serializers.IntegerField(min_value=1)


class AllocationAdjustSerializer(StrictAllocationInput):
    delta = serializers.IntegerField()
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    version = serializers.IntegerField(min_value=1)


class AllocationVoidSerializer(StrictAllocationInput):
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    version = serializers.IntegerField(min_value=1)


class ApprovalStepSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(
        source="reviewer.profile.display_name", read_only=True, default=None
    )
    reviewer_email = serializers.EmailField(source="reviewer.email", read_only=True, default=None)

    class Meta:
        model = RequestApprovalStep
        fields = [
            "cycle",
            "sequence",
            "required_role",
            "reviewer",
            "reviewer_name",
            "reviewer_email",
            "status",
            "reason",
            "decided_at",
        ]


class RequestEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(
        source="actor.profile.display_name", read_only=True, default=None
    )
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default=None)

    class Meta:
        model = RequestEvent
        fields = [
            "event_type",
            "actor",
            "actor_name",
            "actor_email",
            "previous_status",
            "new_status",
            "cycle",
            "version",
            "reason",
            "snapshot",
            "occurred_at",
        ]


class EmployeeRequestSerializer(serializers.ModelSerializer):
    """Read shape for scoped lists/details — organization, owner, status and
    workflow fields are server-owned and never writable through this API."""

    employee_name = serializers.CharField(
        source="employee.display_name", read_only=True, default=None
    )
    employee_email = serializers.EmailField(
        source="employee.user.email", read_only=True, default=None
    )
    employee_code = serializers.CharField(
        source="employee.employee_code", read_only=True, default=None
    )
    type_name = serializers.CharField(source="type.name", read_only=True)
    type_unit = serializers.CharField(source="type.unit", read_only=True)
    current_step = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeRequest
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_email",
            "employee_code",
            "type",
            "type_name",
            "type_unit",
            "title",
            "description",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "equipment_item",
            "quantity",
            "hours",
            "status",
            "cycle",
            "version",
            "submitted_at",
            "current_step",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_current_step(self, req) -> dict | None:
        for s in getattr(req, "prefetched_steps", req.steps.all()):
            if s.cycle == req.cycle and s.status == "pending":
                return ApprovalStepSerializer(s).data
        return None


class RequestDraftSerializer(serializers.Serializer):
    """Draft input allowlist — typed fields only; ownership/status/
    workflow fields are rejected (mass-assignment protection)."""

    ALLOWED = {
        "type",
        "title",
        "description",
        "start_date",
        "end_date",
        "start_time",
        "end_time",
        "equipment_item",
        "quantity",
        "hours",
        "version",
    }

    type = serializers.UUIDField()
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=5000, allow_blank=True, default="")
    start_date = serializers.DateField(required=False, allow_null=True, default=None)
    end_date = serializers.DateField(required=False, allow_null=True, default=None)
    start_time = serializers.TimeField(required=False, allow_null=True, default=None)
    end_time = serializers.TimeField(required=False, allow_null=True, default=None)
    equipment_item = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    quantity = serializers.IntegerField(required=False, allow_null=True, default=None, min_value=1)
    hours = serializers.DecimalField(
        required=False, allow_null=True, default=None,
        max_digits=5, decimal_places=2, min_value=0,
    )
    version = serializers.IntegerField(required=False, min_value=1)

    def to_internal_value(self, data):
        unknown = set(data) - self.ALLOWED
        if unknown:
            raise serializers.ValidationError(
                {k: ["This field cannot be set."] for k in sorted(unknown)}
            )
        return super().to_internal_value(data)


def validate_fields_for_type(unit: str, data: dict, errors: dict):
    """Unit-typed field contract (2026-10-05): a measurable unit requires its
    amount — whole quantity for "unit", quarter-hour hours for "hour";
    "none" rejects amount fields. Dates/times stay optional for every type
    but must be coherent when provided (paired and ordered)."""
    start, end = data.get("start_date"), data.get("end_date")
    if bool(start) != bool(end):
        errors.setdefault("end_date", []).append("Provide both start and end dates.")
    if start and end and end < start:
        errors.setdefault("end_date", []).append("Cannot be before start date.")
    start_t, end_t = data.get("start_time"), data.get("end_time")
    if bool(start_t) != bool(end_t):
        errors.setdefault("end_time", []).append("Provide both start and end times.")
    if start_t and end_t and end_t <= start_t:
        errors.setdefault("end_time", []).append("Must be after the start time.")
    if unit == "unit":
        if data.get("quantity") is None:
            errors.setdefault("quantity", []).append("Required for this type.")
        if data.get("hours") is not None:
            errors.setdefault("hours", []).append("Not used by this type.")
    elif unit == "hour":
        hours = data.get("hours")
        if hours is None:
            errors.setdefault("hours", []).append("Required for this type.")
        elif hours <= 0 or (hours * 4) != int(hours * 4):
            errors.setdefault("hours", []).append("Use quarter-hour steps (0.25, 0.5, ...).")
        if data.get("quantity") is not None:
            errors.setdefault("quantity", []).append("Not used by this type.")
    else:
        if data.get("quantity") is not None:
            errors.setdefault("quantity", []).append("Not used by this type.")
        if data.get("hours") is not None:
            errors.setdefault("hours", []).append("Not used by this type.")


class RequestReviewSerializer(serializers.Serializer):
    """Approve/reject/return input — expected version guards stale clients."""

    reason = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    version = serializers.IntegerField(min_value=1)
