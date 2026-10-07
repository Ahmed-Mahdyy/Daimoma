import pytest

from apps.conftest import *  # noqa: F401,F403
from apps.employee_requests.models import RequestType


@pytest.fixture
def leave_type(org):
    return RequestType.objects.create(
        organization=org, code="LEAVE", name="Leave", unit="none"
    )


@pytest.fixture
def equipment_type(org):
    return RequestType.objects.create(
        organization=org,
        code="EQP",
        name="Equipment",
        unit="none",
        requires_hr=True,
    )


@pytest.fixture
def unit_type(org):
    return RequestType.objects.create(
        organization=org, code="UNT", name="Countable", unit="unit"
    )


@pytest.fixture
def general_type(org):
    return RequestType.objects.create(
        organization=org, code="GEN", name="General", unit="none"
    )


@pytest.fixture
def early_leave_type(org):
    return RequestType.objects.create(
        organization=org, code="EARLY", name="Early leave", unit="hour"
    )


@pytest.fixture
def inactive_type(org):
    return RequestType.objects.create(
        organization=org,
        code="OLD",
        name="Retired",
        unit="none",
        is_active=False,
    )


@pytest.fixture
def other_org_type(other_org):
    return RequestType.objects.create(
        organization=other_org, code="LEAVE", name="Leave", unit="none"
    )
