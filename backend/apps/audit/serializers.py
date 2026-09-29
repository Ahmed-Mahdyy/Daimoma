from rest_framework import serializers

from apps.audit.models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    """Read-only safe audit shape: no actor internals, no secrets (metadata
    is already redacted at write time)."""

    actor_email = serializers.EmailField(source="actor.email", read_only=True)
    actor_name = serializers.CharField(
        source="actor.profile.display_name", read_only=True, default=None
    )

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "action",
            "actor_email",
            "actor_name",
            "target_type",
            "target_id",
            "metadata",
            "occurred_at",
        ]
