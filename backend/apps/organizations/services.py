"""HR administration services (T014). Transactional boundaries, last-HR
protection, reporting-line cycle checks, and audit appends live here — views
are thin adapters."""

import logging

from config.exceptions import ConflictError
from django.contrib.auth.models import Group
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from apps.accounts.models import EMPLOYEE_INFORMATION_FIELDS, EmployeeProfile, User
from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.accounts.services import invalidate_user_sessions, issue_invitation
from apps.audit.services import record_audit
from apps.notifications.services import notify
from apps.organizations.models import Department, Organization

logger = logging.getLogger(__name__)

BUSINESS_ROLES = {ROLE_MANAGER, ROLE_HR}


def _audit(org, actor, action, target, metadata=None):
    return record_audit(org, actor, action, target, metadata)


def _other_active_hr_exists(org, excluding_user):
    return (
        User.objects.filter(organization=org, is_active=True, groups__name=ROLE_HR)
        .exclude(pk=excluding_user.pk)
        .exists()
    )


def _guard_last_hr(profile):
    """The last active HR must not be deactivated or lose the HR role."""
    user = profile.user
    if user.groups.filter(name=ROLE_HR).exists() and not _other_active_hr_exists(
        profile.organization, user
    ):
        raise ValidationError(
            {"detail": ["Cannot remove the organization's last HR administrator."]}
        )


def _resolve_org_profile(org, profile_id, field):
    if profile_id in (None, ""):
        return None
    try:
        return EmployeeProfile.objects.get(pk=profile_id, organization=org)
    except EmployeeProfile.DoesNotExist:
        raise ValidationError({field: ["Employee not found in this organization."]}) from None


def _resolve_org_department(org, dept_id):
    if dept_id in (None, ""):
        return None
    try:
        return Department.objects.get(pk=dept_id, organization=org)
    except Department.DoesNotExist:
        raise ValidationError(
            {"department": ["Department not found in this organization."]}
        ) from None


def _resolve_roles(names):
    unknown = set(names) - BUSINESS_ROLES
    if unknown:
        raise ValidationError({"roles": [f"Unknown roles: {', '.join(sorted(unknown))}."]})
    return list(Group.objects.filter(name__in=names))


def _check_reporting_cycle(profile, new_manager):
    """Follow the manager chain upward; reject if it would loop back."""
    seen = {profile.pk}
    current = new_manager
    while current is not None:
        if current.pk in seen:
            raise ValidationError({"manager": ["This assignment would create a reporting cycle."]})
        seen.add(current.pk)
        current = current.manager


@transaction.atomic
def provision_employee(
    actor,
    org,
    *,
    email,
    employee_code,
    display_name="",
    phone="",
    job_title="",
    department=None,
    manager=None,
    roles=(),
    **information,
):
    """Create user (inactive, unusable password) + profile + groups, then
    issue the invitation — all in one transaction."""
    unknown = set(information) - set(EMPLOYEE_INFORMATION_FIELDS)
    if unknown:
        raise ValidationError({field: ["Unsupported employee field."] for field in unknown})
    if User.objects.filter(email__iexact=email).exists():
        raise ValidationError({"email": ["An account with this email already exists."]})
    if phone and EmployeeProfile.objects.filter(organization=org, phone=phone).exists():
        raise ValidationError(
            {"phone": ["An employee with this phone number already exists."]}
        )
    dept = _resolve_org_department(org, department)
    mgr = _resolve_org_profile(org, manager, "manager")
    groups = _resolve_roles(roles)

    user = User(email=email.lower(), organization=org, is_active=False)
    user.set_unusable_password()
    user.save()
    try:
        profile = EmployeeProfile(
            organization=org,
            user=user,
            employee_code=employee_code,
            display_name=display_name,
            phone=phone,
            job_title=job_title,
            department=dept,
            manager=mgr,
            **information,
        )
        profile.full_clean()
        profile.save()
        user.groups.set(groups)
        issue_invitation(user)
    except Exception:
        raise
    _audit(org, actor, "employee_provisioned", user)
    return user


@transaction.atomic
def update_employee(actor, profile, attrs, *, expected_version=None):
    """Allowlisted administrative update: job_title, display_name, phone,
    department, manager, roles, email, employee_code, employee information.
    Optimistic-lock check happens under select_for_update."""
    profile = EmployeeProfile.objects.select_for_update().get(pk=profile.pk)
    org = profile.organization
    if expected_version is not None and expected_version != profile.version:
        raise ConflictError("Employee record changed; refresh and retry.")

    changes = {}
    if "email" in attrs:
        email = attrs["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exclude(pk=profile.user_id).exists():
            raise ValidationError({"email": ["Email is already in use."]})
        profile.user.email = email
        profile.user.save(update_fields=["email"])
        changes["email"] = email
    if "employee_code" in attrs:
        profile.employee_code = attrs["employee_code"]
        changes["employee_code"] = attrs["employee_code"]
    if attrs.get("phone") and EmployeeProfile.objects.filter(
        organization=org, phone=attrs["phone"]
    ).exclude(pk=profile.pk).exists():
        raise ValidationError(
            {"phone": ["An employee with this phone number already exists."]}
        )
    for field in ("display_name", "phone", "job_title", *EMPLOYEE_INFORMATION_FIELDS):
        if field in attrs:
            setattr(profile, field, attrs[field])
            changes[field] = (
                "updated" if field in EMPLOYEE_INFORMATION_FIELDS else str(attrs[field])
            )
    if "department" in attrs:
        profile.department = _resolve_org_department(org, attrs["department"])
        changes["department"] = str(attrs["department"] or "")
    if "manager" in attrs:
        mgr = _resolve_org_profile(org, attrs["manager"], "manager")
        _check_reporting_cycle(profile, mgr)
        profile.manager = mgr
        changes["manager"] = str(attrs["manager"] or "")
        # D-004: pending manager-steps move to the new reviewer (or HR
        # fallback) atomically; a missing eligible reviewer blocks the change.
        from apps.employee_requests.services import reassign_pending_manager_steps
        from apps.timesheets.services import reassign_pending_sheets

        reassign_pending_manager_steps(profile, mgr)
        reassign_pending_sheets(profile, mgr)
    if "roles" in attrs:
        new_groups = _resolve_roles(attrs["roles"])
        removing_hr = (
            ROLE_HR not in attrs["roles"] and profile.user.groups.filter(name=ROLE_HR).exists()
        )
        if removing_hr:
            _guard_last_hr(profile)
        profile.user.groups.set(new_groups)
        changes["roles"] = sorted(attrs["roles"])

    # Contract range check on the merged record — a partial PATCH may carry
    # only one side, which the serializer cannot compare against the stored
    # counterpart.
    if (
        profile.contract_start_date
        and profile.contract_end_date
        and profile.contract_end_date < profile.contract_start_date
    ):
        raise ValidationError(
            {"contract_end_date": ["Contract end date cannot be before the start date."]}
        )

    profile.version += 1
    try:
        profile.save()
    except IntegrityError as exc:
        raise ValidationError({"detail": ["Update conflicts with an existing record."]}) from exc
    if changes:
        _audit(org, actor, "employee_updated", profile, changes)
    return profile


@transaction.atomic
def deactivate_employee(actor, profile, reason=""):
    profile = EmployeeProfile.objects.select_for_update().get(pk=profile.pk)
    _guard_last_hr(profile)
    user = profile.user
    user.is_active = False
    user.save(update_fields=["is_active"])
    invalidate_user_sessions(user)
    _audit(
        org=profile.organization,
        actor=actor,
        action="employee_deactivated",
        target=profile,
        metadata={"reason": reason},
    )


@transaction.atomic
def reactivate_employee(actor, profile, note=""):
    profile = EmployeeProfile.objects.select_for_update().get(pk=profile.pk)
    user = profile.user
    user.is_active = True
    user.save(update_fields=["is_active"])
    # Old sessions stay dead — the user signs in fresh (owner decision).
    event = _audit(profile.organization, actor, "employee_reactivated", profile, {"note": note})
    # Recipient selector: the affected user, keyed by the audit event so a
    # retried emission can never duplicate the notification.
    notify(
        profile.organization,
        user,
        event_key=f"audit:{event.id}",
        kind="account_reactivated",
        summary="Your account was reactivated by HR.",
        target=profile,
    )


@transaction.atomic
def resend_invitation(actor, profile):
    """New single-use link; the previous one is permanently invalidated
    inside issue_invitation."""
    issue_invitation(profile.user)
    _audit(profile.organization, actor, "invitation_resent", profile)


def _department_manager(org, manager_id):
    if manager_id is None:
        return None
    try:
        return EmployeeProfile.objects.get(
            pk=manager_id, organization=org, user__is_active=True,
            user__groups__name=ROLE_MANAGER,
        )
    except EmployeeProfile.DoesNotExist:
        raise ValidationError(
            {"manager": ["Select an active manager in this organization."]}
        ) from None


@transaction.atomic
def create_department(actor, org, name, manager=None):
    dept = Department(organization=org, name=name, manager=_department_manager(org, manager))
    try:
        dept.save()
    except IntegrityError as exc:
        raise ValidationError({"name": ["A department with this name already exists."]}) from exc
    _audit(org, actor, "department_created", dept, {"name": dept.name})
    return dept


@transaction.atomic
def update_department(actor, dept, *, name=None, is_active=None, manager=...):
    dept = Department.objects.select_for_update().get(pk=dept.pk)
    changes = {}
    if manager is not ...:
        dept.manager = _department_manager(dept.organization, manager)
        changes["manager"] = str(manager or "")
    if name is not None:
        dept.name = name
        changes["name"] = name
    if is_active is not None:
        dept.is_active = is_active
        changes["is_active"] = is_active
    try:
        dept.save()
    except IntegrityError as exc:
        raise ValidationError({"name": ["A department with this name already exists."]}) from exc
    # Deactivation leaves members unassigned rather than blocking (owner decision).
    if is_active is False:
        dept.members.update(department=None)
    if changes:
        _audit(dept.organization, actor, "department_updated", dept, changes)
    return dept


EMAIL_FIELDS = (
    "email_mode", "email_host", "email_port", "email_host_user",
    "email_use_tls", "email_use_ssl", "email_timeout", "email_from",
)


@transaction.atomic
def update_org_settings(actor, org, attrs):
    org = Organization.objects.select_for_update().get(pk=org.pk)
    changes = {}
    for field in ("name", "timezone", "week_start", "working_weekdays", *EMAIL_FIELDS):
        if field in attrs:
            setattr(org, field, attrs[field])
            changes[field] = attrs[field]
    if "email_host_password" in attrs and attrs["email_host_password"]:
        # Blank password means "keep the stored one"; it is never audited.
        org.email_host_password = attrs["email_host_password"]
        changes["email_host_password"] = "updated"  # noqa: S105 - marker, not a password
    if "fallback_reviewer" in attrs:
        reviewer = attrs["fallback_reviewer"]
        if reviewer:
            reviewer_id = reviewer.pk if isinstance(reviewer, User) else reviewer
            try:
                user = User.objects.get(
                    pk=reviewer_id,
                    organization=org,
                    is_active=True,
                    groups__name=ROLE_HR,
                )
            except User.DoesNotExist:
                raise ValidationError(
                    {"fallback_reviewer": ["Must be an active HR member."]}
                ) from None
            org.fallback_reviewer = user
        else:
            org.fallback_reviewer = None
        changes["fallback_reviewer"] = str(reviewer or "")
    try:
        org.full_clean()
        org.save()
    except Exception as exc:
        from django.core.exceptions import ValidationError as DjangoVE

        if isinstance(exc, DjangoVE):
            raise ValidationError(exc.message_dict) from exc
        raise
    if changes:
        _audit(org, actor, "organization_settings_updated", org, changes)
    return org


def test_email_connection(actor, org, overrides):
    """Verify SMTP connectivity/auth and send a probe email to the caller.
    Unsaved form values may be tested: blank password reuses the stored one.
    Credentials never appear in responses or audit metadata."""
    params = {
        "host": overrides.get("email_host") or org.email_host,
        "port": overrides.get("email_port") or org.email_port,
        "username": overrides.get("email_host_user") or org.email_host_user,
        "password": overrides.get("email_host_password") or org.email_host_password,
        "use_tls": overrides.get("email_use_tls", org.email_use_tls),
        "use_ssl": overrides.get("email_use_ssl", org.email_use_ssl),
        "timeout": overrides.get("email_timeout") or org.email_timeout,
    }
    if params["use_tls"] and params["use_ssl"]:
        raise ValidationError({"email_use_ssl": ["TLS and SSL are mutually exclusive."]})
    if not params["host"].strip():
        raise ValidationError({"email_host": ["Enter the mail server host first."]})

    from django.core.mail import get_connection
    from django.core.mail.message import EmailMessage

    connection = get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend", **params
    )
    from_email = overrides.get("email_from") or org.email_from or None
    try:
        with connection:
            EmailMessage(
                subject="Daimoma email test",
                body="This message confirms the configured SMTP connection works.",
                from_email=from_email,
                to=[actor.email],
                connection=connection,
            ).send()
    except Exception as exc:
        # Safe classification — never echo credentials or raw server banners.
        from smtplib import SMTPAuthenticationError, SMTPConnectError, SMTPServerDisconnected

        if isinstance(exc, SMTPAuthenticationError):
            detail = "Authentication failed — check the username and password."
        elif isinstance(exc, (SMTPConnectError, SMTPServerDisconnected, OSError)):
            detail = "Could not reach the mail server — check host, port, and encryption."
        else:
            detail = "The mail server rejected the connection — check the settings."
        _audit(org, actor, "email_connection_test_failed", org, {"error": type(exc).__name__})
        raise ValidationError({"detail": [detail]}) from None
    _audit(org, actor, "email_connection_tested", org)


def eligible_managers(org):
    """Choices for reporting-line edits: profiles in this org (any employee
    can manage — the Manager *role* governs review rights)."""
    return (
        EmployeeProfile.objects.filter(organization=org, user__is_active=True)
        .select_related("user")
        .order_by("display_name", "employee_code")
    )


def hr_members(org):
    return User.objects.filter(organization=org, is_active=True, groups__name=ROLE_HR).exclude(
        profile__isnull=True
    )
