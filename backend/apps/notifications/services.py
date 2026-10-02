"""Explicit notification creation + read transitions (FR-007).

`event_key` + recipient uniqueness makes delivery idempotent — retrying an
emission never creates a duplicate row. event_key is namespaced by the
emitting domain (e.g. `audit:<event_id>`)."""

from django.utils import timezone

from apps.notifications.models import Notification


def notify(org, recipient, *, event_key, kind, summary, target=None):
    """Create-or-return the notification for (recipient, event_key).

    `target` is an optional model instance; its type/id are stored so the UI
    can deep-link. Returns (notification, created)."""
    target_type = ""
    target_id = None
    if target is not None:
        target_type = f"{target._meta.app_label}.{target._meta.model_name}"
        target_id = target.pk
    notification, created = Notification.objects.get_or_create(
        recipient=recipient,
        event_key=event_key,
        defaults={
            "organization": org,
            "kind": kind,
            "summary": str(summary)[:240],
            "target_type": target_type,
            "target_id": target_id,
        },
    )
    return notification, created


def mark_read(notification):
    """Idempotent single-read transition."""
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
    return notification


def mark_all_read(user):
    """Mark all of the user's unread notifications read. Returns count."""
    return Notification.objects.filter(recipient=user, read_at__isnull=True).update(
        read_at=timezone.now()
    )


def resolve_target_url(notification, user) -> str | None:
    """Map a notification's stored target to a frontend path — only when the
    caller can CURRENTLY access that object (005 FR-005). A stale target
    (revoked scope, deleted object, foreign org) resolves to None; callers
    answer 404 so the notification never leaks target content."""
    tt, tid = notification.target_type, notification.target_id
    if not tt or tid is None:
        return None
    if tt == "timesheets.timesheet":
        from apps.timesheets.selectors import sheet_for

        return f"/timesheets/{tid}" if sheet_for(user, tid) else None
    if tt == "employee_requests.employeerequest":
        from apps.employee_requests.selectors import scoped_requests

        if scoped_requests(user).filter(pk=tid).exists():
            return f"/requests/{tid}"
        return None
    if tt == "accounts.employeeprofile":
        from apps.accounts.models import EmployeeProfile
        from apps.accounts.permissions import is_hr

        if (
            is_hr(user)
            and EmployeeProfile.objects.filter(
                pk=tid, organization_id=user.organization_id
            ).exists()
        ):
            return f"/employees/{tid}"
        return None
    return None
