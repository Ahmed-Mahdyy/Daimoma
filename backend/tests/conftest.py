import pytest
from apps.accounts.models import EmployeeProfile, User
from apps.organizations.models import Organization
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _locmem_email(settings):
    """Ensure tests never send real email — locmem backend always."""
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def csrf_client():
    return APIClient(enforce_csrf_checks=True)


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Acme", timezone="UTC", week_start=0)


@pytest.fixture
def other_org(db):
    return Organization.objects.create(name="OtherCo", timezone="UTC", week_start=0)


@pytest.fixture
def employee(org):
    user = User.objects.create_user(
        email="employee@acme.test", password="CorrectHorse42", organization=org
    )
    EmployeeProfile.objects.create(organization=org, user=user, employee_code="E001")
    return user
