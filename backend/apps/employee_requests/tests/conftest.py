import pytest

from apps.conftest import *  # noqa: F401,F403
from apps.employee_requests.models import RequestType


@pytest.fixture
def leave_type(org):
    return RequestType.objects.create(
        organization=org, code="LEAVE", name="Leave", category="leave"
    )


@pytest.fixture
def equipment_type(org):
    return RequestType.objects.create(
        organization=org,
        code="EQP",
        name="Equipment",
        category="equipment",
        requires_hr=True,
    )


@pytest.fixture
def general_type(org):
    return RequestType.objects.create(
        organization=org, code="GEN", name="General", category="general"
    )


@pytest.fixture
def inactive_type(org):
    return RequestType.objects.create(
        organization=org,
        code="OLD",
        name="Retired",
        category="general",
        is_active=False,
    )


@pytest.fixture
def other_org_type(other_org):
    return RequestType.objects.create(
        organization=other_org, code="LEAVE", name="Leave", category="leave"
    )
