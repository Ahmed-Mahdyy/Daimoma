import uuid

from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    """Append-only administrative/security history (FR-006). No update or
    delete — ordinary APIs and admin must never mutate history. Metadata is
    allowlisted/redacted by the service layer; never store secrets."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="audit_events"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="audit_events",
        help_text="Null only for server-generated system/authentication events.",
    )
    action = models.CharField(max_length=80)
    target_type = models.CharField(max_length=80)
    target_id = models.UUIDField()
    metadata = models.JSONField(default=dict)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["organization", "-occurred_at"]),
        ]

    def __str__(self):
        return f"{self.action} on {self.target_type} at {self.occurred_at}"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("AuditEvent is append-only; updates are forbidden.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("AuditEvent is append-only; deletes are forbidden.")
