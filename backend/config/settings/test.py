from .base import *  # noqa: F403

# Test settings: faster password hashing, deterministic behavior.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
DATABASES["default"]["NAME"] = env(  # noqa: F405
    "TEST_DATABASE_NAME", default="daimoma_test"
)
