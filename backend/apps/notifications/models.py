import uuid

from django.conf import settings
from django.db import models


class Notification(models.Model):
    """Recipient-only durable in-app notifications (FR-007). event_key +
    recipient uniqueness gives idempotent delivery; target_type is allowlisted
    by the service layer — never arbitrary user-supplied URLs."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="notifications"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="notifications"
    )
    event_key = models.CharField(max_length=160)
    kind = models.CharField(max_length=40)
    summary = models.CharField(max_length=240)
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "event_key"],
                name="notification_unique_recipient_event",
            ),
        ]
        indexes = [
            models.Index(fields=["recipient", "read_at"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.kind} -> {self.recipient_id}"

    @property
    def is_read(self) -> bool:
        return self.read_at is not None
