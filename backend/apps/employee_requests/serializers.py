from rest_framework import serializers

from apps.employee_requests.models import (
    DATE_CATEGORIES,
    TIME_CATEGORIES,
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
            "category",
            "help_text",
            "requires_manager",
            "requires_hr",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class RequestTypeWriteSerializer(serializers.Serializer):
    """HR type configuration — organization assigned server-side."""

    code = serializers.CharField(max_length=40)
    name = serializers.CharField(max_length=120)
    category = serializers.ChoiceField(choices=RequestType.Category.choices)
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
        return attrs


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
    type_category = serializers.CharField(source="type.category", read_only=True)
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
            "type_category",
            "title",
            "description",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "equipment_item",
            "quantity",
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
    """Draft input allowlist — category-typed fields only; ownership/status/
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
    version = serializers.IntegerField(required=False, min_value=1)

    def to_internal_value(self, data):
        unknown = set(data) - self.ALLOWED
        if unknown:
            raise serializers.ValidationError(
                {k: ["This field cannot be set."] for k in sorted(unknown)}
            )
        return super().to_internal_value(data)


def validate_fields_for_category(category: str, data: dict, errors: dict):
    """D-006 typed-field contract: date categories need ordered dates;
    equipment needs item + quantity>=1; other categories reject unused fields."""
    if category in DATE_CATEGORIES:
        start, end = data.get("start_date"), data.get("end_date")
        if not start:
            errors.setdefault("start_date", []).append("Required for this type.")
        if not end:
            errors.setdefault("end_date", []).append("Required for this type.")
        if start and end and end < start:
            errors.setdefault("end_date", []).append("Cannot be before start date.")
        for f in ("equipment_item", "quantity", "start_time", "end_time"):
            if data.get(f) not in (None, ""):
                errors.setdefault(f, []).append("Not used by this type.")
    elif category in TIME_CATEGORIES:
        # Same-day time range (e.g. early leave): the day is start_date and
        # the range is start_time -> end_time; end_time must be later.
        if not data.get("start_date"):
            errors.setdefault("start_date", []).append("Required for this type.")
        start_t, end_t = data.get("start_time"), data.get("end_time")
        if not start_t:
            errors.setdefault("start_time", []).append("Required for this type.")
        if not end_t:
            errors.setdefault("end_time", []).append("Required for this type.")
        if start_t and end_t and end_t <= start_t:
            errors.setdefault("end_time", []).append("Must be after the start time.")
        for f in ("end_date", "equipment_item", "quantity"):
            if data.get(f) not in (None, ""):
                errors.setdefault(f, []).append("Not used by this type.")
    elif category == "equipment":
        if not (data.get("equipment_item") or "").strip():
            errors.setdefault("equipment_item", []).append("Required for this type.")
        if data.get("quantity") is None:
            errors.setdefault("quantity", []).append("Required for this type.")
        for f in ("start_date", "end_date", "start_time", "end_time"):
            if data.get(f) is not None:
                errors.setdefault(f, []).append("Not used by this type.")
    else:
        for f in ("start_date", "end_date", "start_time", "end_time", "equipment_item", "quantity"):
            if data.get(f) not in (None, ""):
                errors.setdefault(f, []).append("Not used by this type.")


class RequestReviewSerializer(serializers.Serializer):
    """Approve/reject/return input — expected version guards stale clients."""

    reason = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    version = serializers.IntegerField(min_value=1)
