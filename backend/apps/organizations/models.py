import uuid
from zoneinfo import available_timezones

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower


class Organization(models.Model):
    """Single-organization deployment (D-003); schema stays org-keyed so every
    business row carries its organization for scoping."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    timezone = models.CharField(max_length=64, default="UTC")
    week_start = models.PositiveSmallIntegerField(default=0)  # 0=Monday … 6=Sunday
    fallback_reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="fallback_for_organizations",
        help_text="Eligible non-self HR reviewer used when no manager can review (D-004).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def clean(self):
        if not self.name or not self.name.strip():
            raise ValidationError({"name": "Organization name cannot be blank."})
        if self.timezone not in available_timezones():
            raise ValidationError({"timezone": "Must be a valid IANA timezone."})
        if not 0 <= self.week_start <= 6:
            raise ValidationError({"week_start": "Must be between 0 (Monday) and 6 (Sunday)."})


class Department(models.Model):
    """HR-managed; deactivated, never deleted (D-004 history preservation).
    Members of a deactivated department are left unassigned by the service
    layer — membership is optional."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="departments"
    )
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"), "organization", name="department_unique_name_per_org"
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name = " ".join(self.name.split()) if self.name else self.name
        super().save(*args, **kwargs)

    def clean(self):
        if not self.name or not self.name.strip():
            raise ValidationError({"name": "Department name cannot be blank."})
