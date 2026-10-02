import hashlib
import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom user created before the first migration (T004).
    Email is the only sign-in identifier — no username (owner decision)."""

    username = None
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="users",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="user_email_ci_unique"),
        ]

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class EmployeeProfile(models.Model):
    """Per-user profile. Employee-editable: display_name, phone,
    preferred_locale. Everything else is HR-controlled (D-003)."""

    class Locale(models.TextChoices):
        EN = "en", "English"
        AR = "ar", "Arabic"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="profiles"
    )
    user = models.OneToOneField(User, on_delete=models.PROTECT, related_name="profile")
    employee_code = models.CharField(max_length=40)
    department = models.ForeignKey(
        "organizations.Department",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="members",
    )
    manager = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="direct_reports",
    )
    job_title = models.CharField(max_length=150, blank=True)
    photo = models.ImageField(upload_to="profile_photos/%Y/%m/", blank=True)
    photo_content_type = models.CharField(max_length=50, blank=True)
    display_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    preferred_locale = models.CharField(max_length=16, choices=Locale.choices, default=Locale.EN)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "employee_code"],
                name="profile_unique_employee_code_per_org",
            ),
            models.CheckConstraint(
                condition=~models.Q(manager=models.F("pk")),
                name="profile_no_self_manager",
            ),
        ]

    def __str__(self):
        return self.employee_code

    def clean(self):
        errors = {}
        if self.user_id and self.organization_id:
            if self.user.organization_id != self.organization_id:
                errors["organization"] = "Profile organization must match the user's organization."
        if self.department_id and self.organization_id:
            if self.department.organization_id != self.organization_id:
                errors["department"] = "Department must belong to the same organization."
        if self.manager_id and self.organization_id:
            if self.manager.organization_id != self.organization_id:
                errors["manager"] = "Manager must belong to the same organization."
        if self.manager_id and self.manager_id == self.pk:
            errors["manager"] = "An employee cannot manage themselves."
        if errors:
            raise ValidationError(errors)


class EmailToken(models.Model):
    """Single-use invitation/recovery links (D-009). Only the SHA-256 digest is
    stored — the raw token exists only in the emailed link and is never logged."""

    class Purpose(models.TextChoices):
        INVITATION = "invitation", "Invitation"
        RECOVERY = "recovery", "Password recovery"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_tokens")
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "purpose", "used_at"]),
        ]

    def __str__(self):
        return f"{self.purpose} token for {self.user_id}"

    @staticmethod
    def digest(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode()).hexdigest()
