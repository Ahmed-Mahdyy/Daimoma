from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import ALLOWED_HOSTS, SECRET_KEY, env

DEBUG = False

if not SECRET_KEY or SECRET_KEY == "dev-only-insecure-change-me":  # noqa: S105 - forbidden-value check
    raise ImproperlyConfigured(
        "Production requires a unique non-default DJANGO_SECRET_KEY."
    )
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "Production requires explicit DJANGO_ALLOWED_HOSTS."
    )

# TLS terminates at the deployment proxy; the local production-like smoke
# (T024/D-007) sets DJANGO_SECURE_SSL_REDIRECT=0 because localhost has no cert.
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
# Cookie Secure flags default to True; the HTTP-only demo deployment on a bare
# IP (no domain/TLS) disables them via env because browsers drop Secure cookies
# over http:// — see docs/evidence/007-release.md.
SESSION_COOKIE_SECURE = env.bool("DJANGO_SESSION_COOKIE_SECURE", default=True)
CSRF_COOKIE_SECURE = env.bool("DJANGO_CSRF_COOKIE_SECURE", default=True)
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
