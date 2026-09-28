"""Auth services (T009). Views are thin adapters; all state transitions,
token lifecycle, throttling, session invalidation, and audit writes live
here. Raw tokens are never stored or logged — only their SHA-256 digest."""

import logging
import secrets
from datetime import timedelta

from config.exceptions import InvalidCredentials, InvalidToken
from django.conf import settings
from django.contrib.auth import authenticate, login
from django.contrib.auth.password_validation import validate_password
from django.contrib.sessions.models import Session
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError

from apps.accounts.models import EmailToken, User
from apps.audit.models import AuditEvent

logger = logging.getLogger(__name__)

THROTTLE_PREFIX = "auth-fail"


def _audit(org, actor, action, target_id, metadata=None):
    AuditEvent.objects.create(
        organization=org,
        actor=actor,
        action=action,
        target_type="accounts.User",
        target_id=target_id,
        metadata=metadata or {},
    )


def _issue_token(user, purpose, ttl):
    """Invalidate any outstanding same-purpose links, then mint a new one."""
    now = timezone.now()
    EmailToken.objects.filter(user=user, purpose=purpose, used_at__isnull=True).update(used_at=now)
    raw = secrets.token_urlsafe(32)
    EmailToken.objects.create(
        user=user,
        purpose=purpose,
        token_hash=EmailToken.digest(raw),
        expires_at=now + ttl,
    )
    return raw


def _send_link(user, raw_token, path, subject):
    """Delivery via configured backend (console/file locally). The token lives
    only inside the emailed link — never in logs."""
    link = f"{settings.FRONTEND_BASE_URL}{path}?token={raw_token}"
    try:
        send_mail(subject, f"Use this link to continue: {link}", None, [user.email])
    except Exception:  # delivery failure must not reverse the transition
        logger.exception("mail_delivery_failed purpose_path=%s", path)


@transaction.atomic
def issue_invitation(user):
    """(Re-)issue a 48h single-use invitation link; previous links die."""
    raw = _issue_token(
        user,
        EmailToken.Purpose.INVITATION,
        timedelta(hours=settings.INVITATION_TOKEN_HOURS),
    )
    _send_link(user, raw, "/accept-invitation", "You have been invited to Daimoma")
    _audit(
        user.organization,
        actor=None,
        action="invitation_issued",
        target_id=user.id,
    )
    return raw


@transaction.atomic
def issue_recovery_token(user):
    raw = _issue_token(
        user,
        EmailToken.Purpose.RECOVERY,
        timedelta(minutes=settings.RECOVERY_TOKEN_MINUTES),
    )
    _send_link(user, raw, "/reset-password/confirm", "Daimoma password recovery")
    _audit(user.organization, actor=None, action="recovery_issued", target_id=user.id)
    return raw


def _consume_token(raw_token, purpose):
    try:
        token = EmailToken.objects.select_for_update().get(
            token_hash=EmailToken.digest(raw_token or ""), purpose=purpose
        )
    except EmailToken.DoesNotExist:
        raise InvalidToken from None
    if token.used_at is not None or token.expires_at <= timezone.now():
        raise InvalidToken
    return token


def _validated_new_password(password, user):
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise ValidationError({"password": exc.messages}) from exc


@transaction.atomic
def accept_invitation(raw_token, password):
    token = _consume_token(raw_token, EmailToken.Purpose.INVITATION)
    user = token.user
    _validated_new_password(password, user)
    user.set_password(password)
    user.is_active = True
    user.save(update_fields=["password", "is_active"])
    token.used_at = timezone.now()
    token.save(update_fields=["used_at"])
    _audit(user.organization, actor=user, action="invitation_accepted", target_id=user.id)


@transaction.atomic
def request_password_reset(email):
    """Generic acknowledgement — identical outcome whether or not the account
    exists (no enumeration). Only existing, active users get mail."""
    user = User.objects.filter(email__iexact=email.strip()).first()
    if user and user.is_active:
        issue_recovery_token(user)


@transaction.atomic
def confirm_password_reset(raw_token, password):
    token = _consume_token(raw_token, EmailToken.Purpose.RECOVERY)
    user = token.user
    _validated_new_password(password, user)
    user.set_password(password)
    user.save(update_fields=["password"])
    token.used_at = timezone.now()
    token.save(update_fields=["used_at"])
    invalidate_user_sessions(user)
    _audit(
        user.organization,
        actor=user,
        action="password_reset_completed",
        target_id=user.id,
    )


@transaction.atomic
def change_password(user, current_password, new_password, keep_session_key=None):
    """Requires the current password; ends all sessions except the caller's."""
    if not user.check_password(current_password):
        raise PermissionDenied("Current password is incorrect.")
    _validated_new_password(new_password, user)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    invalidate_user_sessions(user, keep_session_key=keep_session_key)
    _audit(user.organization, actor=user, action="password_changed", target_id=user.id)


def invalidate_user_sessions(user, keep_session_key=None):
    """Delete every stored session for the user (deactivation, recovery,
    password change). The caller's session may be kept."""
    for session in Session.objects.iterator():
        data = session.get_decoded()
        if data.get("_auth_user_id") != str(user.id):
            continue
        if keep_session_key and session.session_key == keep_session_key:
            continue
        session.delete()


def _throttle_key(email, ip):
    return f"{THROTTLE_PREFIX}:{email.lower()}:{ip}"


def login_user(request, email, password):
    """Email-only sign-in with bounded failure counting (5 attempts / 5 min,
    D-009). Generic invalid_credentials error — no enumeration."""
    email = email.strip().lower()
    ip = request.META.get("REMOTE_ADDR", "unknown")
    key = _throttle_key(email, ip)
    max_attempts = getattr(settings, "AUTH_THROTTLE_MAX_ATTEMPTS", 5)
    if cache.get(key, 0) >= max_attempts:
        raise Throttled()

    user = authenticate(request, username=email, password=password)
    if user is None or not user.is_active:
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=300)
        raise InvalidCredentials

    cache.delete(key)
    login(request, user)
    now = timezone.now().timestamp()
    request.session["_daimoma_last_seen"] = now
    request.session["_daimoma_absolute_deadline"] = now + settings.SESSION_ABSOLUTE_SECONDS
    request.session.set_expiry(settings.SESSION_ABSOLUTE_SECONDS)
    _audit(user.organization, actor=user, action="login", target_id=user.id)
    return user
