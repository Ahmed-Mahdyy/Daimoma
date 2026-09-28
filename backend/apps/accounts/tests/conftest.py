import pytest
from django.contrib.auth.models import Group
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import EmployeeProfile, User
from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.organizations.models import Organization

TEST_PASSWORD = "CorrectHorse42"
INVITED_PASSWORD = "NewPassw0rdZebra"


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """Login-throttle state must not leak between tests."""
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


def make_user(org, email, password=TEST_PASSWORD, **kwargs):
    return User.objects.create_user(email=email, password=password, organization=org, **kwargs)


def make_profile(org, user, code, **kwargs):
    return EmployeeProfile.objects.create(organization=org, user=user, employee_code=code, **kwargs)


@pytest.fixture
def employee(org):
    user = make_user(org, "employee@acme.test")
    make_profile(org, user, "E001")
    return user


@pytest.fixture
def manager(org):
    user = make_user(org, "manager@acme.test")
    user.groups.add(Group.objects.get(name=ROLE_MANAGER))
    make_profile(org, user, "M001")
    return user


@pytest.fixture
def hr_user(org):
    user = make_user(org, "hr@acme.test")
    user.groups.add(Group.objects.get(name=ROLE_HR))
    make_profile(org, user, "H001")
    return user


@pytest.fixture
def invited_user(org):
    """Account provisioned by HR but not yet activated — unusable password,
    inactive until invitation acceptance."""
    user = make_user(org, "invited@acme.test", password=None, is_active=False)
    user.set_unusable_password()
    user.save(update_fields=["password"])
    make_profile(org, user, "E002")
    return user
