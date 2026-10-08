from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import (
    EMPLOYEE_INFORMATION_FIELDS,
    EMPLOYEE_WORK_FIELDS,
    EmployeeProfile,
)
from apps.accounts.validators import normalize_egyptian_phone
from apps.organizations.models import Department, Organization


class DepartmentSerializer(serializers.ModelSerializer):
    manager = serializers.UUIDField(source="manager_id", required=False, allow_null=True)
    manager_name = serializers.SerializerMethodField()

    def get_manager_name(self, obj) -> str | None:
        if not obj.manager_id:
            return None
        return obj.manager.display_name or obj.manager.employee_code

    class Meta:
        model = Department
        fields = ["id", "name", "manager", "manager_name", "is_active", "created_at"]
        read_only_fields = ["id", "manager_name", "created_at"]


class EmployeeSummarySerializer(serializers.ModelSerializer):
    """Safe directory fields — never exposes auth internals."""

    email = serializers.EmailField(source="user.email", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    roles = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    manager_name = serializers.CharField(
        source="manager.display_name", read_only=True, default=None
    )
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = [
            "id",
            "email",
            "is_active",
            "roles",
            "employee_code",
            "display_name",
            "phone",
            "job_title",
            "department",
            "department_name",
            "manager",
            "manager_name",
            "photo_url",
            "version",
        ]

    def get_roles(self, profile) -> list[str]:
        # .all() consumes the prefetch_related cache; .values_list() would not.
        return sorted(g.name for g in profile.user.groups.all())

    def get_photo_url(self, profile) -> str:
        """Scoped photo endpoint; `v` busts caches after a re-upload."""
        if not profile.photo:
            return ""
        return (
            f"/api/v1/employees/{profile.pk}/photo/"
            f"?v={int(profile.updated_at.timestamp())}"
        )


class EmployeeDetailSerializer(EmployeeSummarySerializer):
    class Meta(EmployeeSummarySerializer.Meta):
        fields = [*EmployeeSummarySerializer.Meta.fields, *EMPLOYEE_INFORMATION_FIELDS]

    def to_representation(self, instance):
        """Work/contract details are HR-only: the keys are omitted entirely
        for employees and managers, never sent as masked values."""
        data = super().to_representation(instance)
        if self.context.get("hide_work_info"):
            for field in EMPLOYEE_WORK_FIELDS:
                data.pop(field, None)
        return data


class EmployeeInformationFields(serializers.Serializer):
    birth_date = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    emergency_contact_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    emergency_contact_phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    highest_qualification = serializers.CharField(max_length=150, required=False, allow_blank=True)
    institution = serializers.CharField(max_length=150, required=False, allow_blank=True)
    field_of_study = serializers.CharField(max_length=150, required=False, allow_blank=True)
    graduation_year = serializers.IntegerField(min_value=1900, required=False, allow_null=True)
    employment_start_date = serializers.DateField(required=False, allow_null=True)
    employment_type = serializers.ChoiceField(
        choices=EmployeeProfile.EmploymentType.choices, required=False, allow_blank=True
    )
    work_location = serializers.CharField(max_length=150, required=False, allow_blank=True)
    contract_start_date = serializers.DateField(required=False, allow_null=True)
    contract_end_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        start = attrs.get("contract_start_date")
        end = attrs.get("contract_end_date")
        if start and end and end < start:
            raise serializers.ValidationError(
                {"contract_end_date": ["Contract end date cannot be before the start date."]}
            )
        return attrs

    # Phone fields are declared on the subclasses but share this validator —
    # numbers are normalized (separators stripped) on every write path.
    def validate_phone(self, value):
        return normalize_egyptian_phone(value)

    def validate_emergency_contact_phone(self, value):
        return normalize_egyptian_phone(value)

    def validate_birth_date(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("Birth date cannot be in the future.")
        return value

    def validate_graduation_year(self, value):
        if value and value > timezone.localdate().year:
            raise serializers.ValidationError("Graduation year cannot be in the future.")
        return value


class EmployeeProvisionSerializer(EmployeeInformationFields):
    """HR provisioning input — organization and privileges are assigned
    server-side; the allowlist contains no is_staff/is_superuser/password."""

    email = serializers.EmailField()
    employee_code = serializers.CharField(max_length=40)
    display_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    job_title = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    department = serializers.UUIDField(required=False, allow_null=True)
    manager = serializers.UUIDField(required=False, allow_null=True)
    roles = serializers.ListField(child=serializers.CharField(), required=False, default=list)

    def to_internal_value(self, data):
        allowed = set(self.fields)
        rejected = set(data) - allowed
        if rejected:
            raise serializers.ValidationError(
                {f: ["This field is not accepted."] for f in sorted(rejected)}
            )
        return super().to_internal_value(data)


class EmployeeUpdateSerializer(EmployeeInformationFields):
    """Explicit allowlist for PATCH employees/{id}/ — everything else,
    including privilege fields, is rejected outright."""

    ALLOWED = {
        "email",
        "employee_code",
        "display_name",
        "phone",
        "job_title",
        *EMPLOYEE_INFORMATION_FIELDS,
        "department",
        "manager",
        "roles",
        "version",
    }

    email = serializers.EmailField(required=False)
    employee_code = serializers.CharField(max_length=40, required=False)
    display_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    job_title = serializers.CharField(max_length=150, required=False, allow_blank=True)
    department = serializers.UUIDField(required=False, allow_null=True)
    manager = serializers.UUIDField(required=False, allow_null=True)
    roles = serializers.ListField(child=serializers.CharField(), required=False)
    version = serializers.IntegerField(min_value=1, required=False)

    def to_internal_value(self, data):
        rejected = set(data) - self.ALLOWED
        if rejected:
            raise serializers.ValidationError(
                {f: ["This field is not writable."] for f in sorted(rejected)}
            )
        return super().to_internal_value(data)


class OrgSettingsSerializer(serializers.ModelSerializer):
    email_host_password = serializers.CharField(
        max_length=255, required=False, allow_blank=True, write_only=True
    )
    email_password_set = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id", "name", "timezone", "week_start", "working_weekdays", "fallback_reviewer",
            "email_mode", "email_host", "email_port", "email_host_user",
            "email_host_password", "email_password_set", "email_use_tls",
            "email_use_ssl", "email_timeout", "email_from",
        ]
        read_only_fields = ["id"]

    def get_email_password_set(self, obj) -> bool:
        return bool(obj.email_host_password)

    def validate(self, attrs):
        use_tls = attrs.get("email_use_tls", getattr(self.instance, "email_use_tls", False))
        use_ssl = attrs.get("email_use_ssl", getattr(self.instance, "email_use_ssl", False))
        if use_tls and use_ssl:
            raise serializers.ValidationError(
                {"email_use_ssl": ["TLS and SSL are mutually exclusive."]}
            )
        mode = attrs.get("email_mode", getattr(self.instance, "email_mode", None))
        host = attrs.get("email_host", getattr(self.instance, "email_host", ""))
        if mode == Organization.EmailMode.SMTP and not (host or "").strip():
            raise serializers.ValidationError(
                {"email_host": ["SMTP mode requires a mail server host."]}
            )
        return attrs

    def validate_working_weekdays(self, value):
        if (
            not isinstance(value, list)
            or any(type(day) is not int or day not in range(7) for day in value)
            or len(value) != len(set(value))
        ):
            raise serializers.ValidationError("Select distinct weekdays from 0 to 6.")
        return value


class OrgEmailTestSerializer(serializers.Serializer):
    """Optional overrides for the test-connection call; omitted fields fall
    back to the stored organization config. A blank password means 'use the
    stored one'."""

    email_host = serializers.CharField(max_length=255, required=False, allow_blank=True)
    email_port = serializers.IntegerField(required=False, min_value=1, max_value=65535)
    email_host_user = serializers.CharField(max_length=255, required=False, allow_blank=True)
    email_host_password = serializers.CharField(max_length=255, required=False, allow_blank=True)
    email_use_tls = serializers.BooleanField(required=False)
    email_use_ssl = serializers.BooleanField(required=False)
    email_timeout = serializers.IntegerField(required=False, min_value=1, max_value=300)
    email_from = serializers.CharField(max_length=255, required=False, allow_blank=True)


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=300, required=False, default="")
    note = serializers.CharField(max_length=300, required=False, default="")
