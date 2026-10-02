from rest_framework import serializers

from apps.accounts.models import EmployeeProfile
from apps.organizations.models import Department, Organization


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


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
            "preferred_locale",
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


class EmployeeProvisionSerializer(serializers.Serializer):
    """HR provisioning input — organization and privileges are assigned
    server-side; the allowlist contains no is_staff/is_superuser/password."""

    email = serializers.EmailField()
    employee_code = serializers.CharField(max_length=40)
    display_name = serializers.CharField(max_length=150, required=False, default="")
    phone = serializers.CharField(max_length=40, required=False, default="")
    job_title = serializers.CharField(max_length=150, required=False, default="")
    preferred_locale = serializers.ChoiceField(
        choices=EmployeeProfile.Locale.choices, required=False, default="en"
    )
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


class EmployeeUpdateSerializer(serializers.Serializer):
    """Explicit allowlist for PATCH employees/{id}/ — everything else,
    including privilege fields, is rejected outright."""

    ALLOWED = {
        "email",
        "employee_code",
        "display_name",
        "phone",
        "job_title",
        "preferred_locale",
        "department",
        "manager",
        "roles",
        "version",
    }

    email = serializers.EmailField(required=False)
    employee_code = serializers.CharField(max_length=40, required=False)
    display_name = serializers.CharField(max_length=150, required=False)
    phone = serializers.CharField(max_length=40, required=False)
    job_title = serializers.CharField(max_length=150, required=False)
    preferred_locale = serializers.ChoiceField(
        choices=EmployeeProfile.Locale.choices, required=False
    )
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
    class Meta:
        model = Organization
        fields = ["id", "name", "timezone", "week_start", "fallback_reviewer"]
        read_only_fields = ["id"]


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=300, required=False, default="")
    note = serializers.CharField(max_length=300, required=False, default="")
