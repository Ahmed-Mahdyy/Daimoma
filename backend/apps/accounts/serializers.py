from config.exceptions import ConflictError
from rest_framework import serializers

from apps.accounts.models import EmployeeProfile
from apps.accounts.validators import normalize_egyptian_phone


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )


class TokenPasswordSerializer(serializers.Serializer):
    """Shared shape for invitation acceptance and recovery confirmation."""

    token = serializers.CharField(write_only=True, trim_whitespace=False)
    password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )
    new_password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )


class UserSummarySerializer(serializers.Serializer):
    """Safe user summary — never exposes password, tokens, or staff flags."""

    id = serializers.UUIDField()
    email = serializers.EmailField()
    display_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()

    def get_display_name(self, user) -> str:
        profile = getattr(user, "profile", None)
        return profile.display_name if profile else ""

    def get_roles(self, user) -> list[str]:
        return sorted(user.groups.values_list("name", flat=True))


class MeSerializer(serializers.ModelSerializer):
    """Read/write serializer for GET/PATCH /api/v1/me/.

    Explicit allowlist: only display_name and phone are
    writable. Any other key in the payload — including privilege fields —
    is rejected with validation_error (no silent drops). `version` carries
    the optimistic-lock value and is never written directly."""

    WRITABLE = {"display_name", "phone", "version"}

    email = serializers.EmailField(source="user.email", read_only=True)
    roles = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    department = serializers.UUIDField(read_only=True)
    manager = serializers.UUIDField(read_only=True)
    org_working_weekdays = serializers.SerializerMethodField()
    version = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = EmployeeProfile
        fields = [
            "id",
            "email",
            "roles",
            "employee_code",
            "display_name",
            "phone",
            "photo_url",
            "job_title",
            "department",
            "manager",
            "org_working_weekdays",
            "version",
        ]
        read_only_fields = [
            "id",
            "email",
            "roles",
            "employee_code",
            "photo_url",
            "job_title",
            "department",
            "manager",
            "org_working_weekdays",
        ]

    def get_org_working_weekdays(self, profile) -> list[int]:
        return profile.organization.working_weekdays or []

    def get_roles(self, profile) -> list[str]:
        return sorted(profile.user.groups.values_list("name", flat=True))

    def get_photo_url(self, profile) -> str:
        """Auth-gated photo URL; the `v` param busts caches after upload."""
        if not profile.photo:
            return ""
        return f"/api/v1/me/photo/?v={int(profile.updated_at.timestamp())}"

    def validate_phone(self, value):
        value = normalize_egyptian_phone(value)
        if value and EmployeeProfile.objects.filter(
            organization=self.instance.organization, phone=value
        ).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError(
                "An employee with this phone number already exists."
            )
        return value

    def to_internal_value(self, data):
        rejected = set(data) - self.WRITABLE
        if rejected:
            raise serializers.ValidationError(
                {field: ["This field is not writable."] for field in sorted(rejected)}
            )
        return super().to_internal_value(data)

    def validate(self, attrs):
        version = attrs.pop("version", None)
        if version is not None and self.instance and version != self.instance.version:
            raise ConflictError("Profile was modified elsewhere; refresh and retry.")
        return attrs

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.version += 1
        instance.save()
        return instance
