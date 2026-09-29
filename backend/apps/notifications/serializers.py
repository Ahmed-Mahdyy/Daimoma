from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "event_key",
            "kind",
            "summary",
            "target_type",
            "target_id",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields
