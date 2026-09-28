from django.conf import settings
from django.contrib.auth import logout
from django.utils import timezone


class SessionExpiryMiddleware:
    """Enforces the session policy (D-009): 2h idle / 24h absolute.
    Login stamps `_daimoma_last_seen` and `_daimoma_absolute_deadline`;
    each authenticated request renews the idle window. Expired sessions
    are flushed and the request continues anonymous -> 403 on protected
    endpoints with code=authentication_required."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            now = timezone.now().timestamp()
            last_seen = request.session.get("_daimoma_last_seen")
            deadline = request.session.get("_daimoma_absolute_deadline")
            idle_expired = last_seen is not None and now - last_seen > settings.SESSION_IDLE_SECONDS
            absolute_expired = deadline is not None and now > deadline
            if idle_expired or absolute_expired:
                logout(request)  # flushes the session server-side
            else:
                request.session["_daimoma_last_seen"] = now
        return self.get_response(request)
