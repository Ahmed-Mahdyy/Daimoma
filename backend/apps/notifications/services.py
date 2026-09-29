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
