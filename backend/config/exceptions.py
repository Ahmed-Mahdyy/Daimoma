import uuid

from rest_framework.exceptions import (
    APIException,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.views import exception_handler


class ConflictError(APIException):
    """Business-state conflict (stale version, invalid transition)."""

    status_code = 409
    default_code = "state_conflict"
    default_detail = "The resource is in a conflicting state."


class InvalidCredentials(APIException):
    """Generic auth failure — identical for wrong password, unknown email,
    and inactive account so the response reveals no account existence."""

    status_code = 403
    default_code = "invalid_credentials"
    default_detail = "The email or password is incorrect."


class InvalidToken(APIException):
    """Expired, used, or unknown invitation/recovery link."""

    status_code = 400
    default_code = "invalid_token"
    default_detail = "This link is invalid or has expired."


def _code_for(exc: APIException) -> str:
    if isinstance(exc, NotAuthenticated):
        return "authentication_required"
    if isinstance(exc, PermissionDenied):
        # DRF surfaces CSRF failures as PermissionDenied with a CSRF detail.
        detail = str(getattr(exc, "detail", ""))
        if "csrf" in detail.lower():
            return "csrf_failed"
        return "permission_denied"
    if isinstance(exc, ValidationError):
        return "validation_error"
    if isinstance(exc, Throttled):
        return "rate_limited"
    if isinstance(exc, NotFound):
        return "not_found"
    code = getattr(exc, "default_code", "error")
    return code if isinstance(code, str) else "error"


def api_exception_handler(exc, context):
    """Safe error envelope: {code, detail, field_errors?, request_id?}.
    Never leaks tracebacks, passwords, or tokens to clients."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    detail = getattr(exc, "detail", response.data)
    body: dict = {"code": _code_for(exc)}

    if isinstance(exc, ValidationError):
        body["detail"] = "Validation failed."
        body["field_errors"] = detail
    else:
        body["detail"] = detail if isinstance(detail, str) else str(detail)

    request = context.get("request")
    request_id = request.META.get("HTTP_X_REQUEST_ID") if request is not None else None
    body["request_id"] = request_id or str(uuid.uuid4())
    response.data = body
    return response
