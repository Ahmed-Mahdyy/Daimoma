"""Explicit audit creation (FR-006). Metadata is allowlisted/redacted here —
callers may pass arbitrary field changes but secrets can never persist."""

from apps.audit.models import AuditEvent

# Any metadata key containing one of these fragments is dropped. Audit trails
# record *that* something changed, never credentials or token material.
SENSITIVE_MARKERS = ("password", "token", "secret", "credential", "session")

MAX_METADATA_VALUE = 500


def _redact(metadata):
    clean = {}
    for key, value in (metadata or {}).items():
        lowered = str(key).lower()
        if any(marker in lowered for marker in SENSITIVE_MARKERS):
            continue
        text = str(value)
        clean[key] = text[:MAX_METADATA_VALUE]
    return clean


def record_audit(org, actor, action, target, metadata=None):
    """Append a single immutable event. `target` may be a model instance or
    an object exposing `pk`; the type is derived from its app/model name."""
    if hasattr(target, "_meta"):
        target_type = f"{target._meta.app_label}.{target._meta.model_name}"
        target_id = target.pk
    else:
        target_type = str(type(target).__name__).lower()
        target_id = target
    return AuditEvent.objects.create(
        organization=org,
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata=_redact(metadata),
    )
