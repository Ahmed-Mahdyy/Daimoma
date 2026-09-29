from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import SessionAuthentication


class CsrfEnforcedSessionAuthentication(SessionAuthentication):
    """SessionAuthentication only enforces CSRF for authenticated users.
    The contract requires CSRF on login too, so enforce it unconditionally."""

    def authenticate(self, request):
        result = super().authenticate(request)
        self.enforce_csrf(request)
        return result


class CsrfEnforcedSessionScheme(OpenApiAuthenticationExtension):
    """Documents session auth as cookie-based so generated clients know to
    carry the sessionid cookie and X-CSRFToken header."""

    target_class = "apps.accounts.authentication.CsrfEnforcedSessionAuthentication"
    name = "csrfCookieAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": "sessionid"}
