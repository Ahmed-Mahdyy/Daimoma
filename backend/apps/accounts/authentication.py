from rest_framework.authentication import SessionAuthentication


class CsrfEnforcedSessionAuthentication(SessionAuthentication):
    """SessionAuthentication only enforces CSRF for authenticated users.
    The contract requires CSRF on login too, so enforce it unconditionally."""

    def authenticate(self, request):
        result = super().authenticate(request)
        self.enforce_csrf(request)
        return result
