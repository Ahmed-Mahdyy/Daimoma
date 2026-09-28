import pytest


@pytest.fixture(autouse=True)
def _locmem_email(settings):
    """Ensure tests never send real email — locmem backend always."""
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
