from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "apps.accounts",
    "apps.organizations",
    "apps.audit",
    "apps.notifications",
    "apps.employee_requests",
    "apps.timesheets",
    "apps.reporting",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.SessionExpiryMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = 60

# Password validation — owner-approved policy: min 12 chars, upper + lower + digit.
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "apps.accounts.password_validation.UpperLowerDigitValidator"},
]

LANGUAGE_CODE = "en"
LANGUAGES = [("en", "English"), ("ar", "Arabic")]
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

AUTH_USER_MODEL = "accounts.User"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Session policy (D-009): 2h idle / 24h absolute, enforced by middleware in T009.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_IDLE_SECONDS = env.int("SESSION_IDLE_SECONDS", default=7200)
SESSION_ABSOLUTE_SECONDS = env.int("SESSION_ABSOLUTE_SECONDS", default=86400)
CSRF_COOKIE_SAMESITE = "Lax"
# Origins allowed to submit unsafe requests — the SPA origin, env-driven.
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

# Email delivery — fully env-driven. Development defaults to the console
# backend; production sets the SMTP backend plus host/credential vars.
# USE_TLS and USE_SSL are mutually exclusive (Django raises if both are true).
EMAIL_BACKEND = env(
    "DJANGO_EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = env("DJANGO_EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("DJANGO_EMAIL_PORT", default=25)
EMAIL_HOST_USER = env("DJANGO_EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("DJANGO_EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("DJANGO_EMAIL_USE_TLS", default=False)
EMAIL_USE_SSL = env.bool("DJANGO_EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = env.int("DJANGO_EMAIL_TIMEOUT", default=30)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@daimoma.local")
SERVER_EMAIL = env("DJANGO_SERVER_EMAIL", default=DEFAULT_FROM_EMAIL)
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:5173")

INVITATION_TOKEN_HOURS = env.int("INVITATION_TOKEN_HOURS", default=48)
RECOVERY_TOKEN_MINUTES = env.int("RECOVERY_TOKEN_MINUTES", default=30)
# Bounded login failures: max attempts per email+IP in a 5-minute window (D-009).
AUTH_THROTTLE_MAX_ATTEMPTS = env.int("AUTH_THROTTLE_MAX_ATTEMPTS", default=5)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "apps.accounts.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Daimoma API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "ENUM_NAME_OVERRIDES": {
        "TimesheetStatusEnum": "apps.timesheets.models.Timesheet.Status",
    },
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "plain": {"format": "%(levelname)s %(asctime)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "plain"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        # Never log request bodies or auth payloads.
        "django.request": {"level": "WARNING"},
        "django.security": {"level": "WARNING"},
    },
}
