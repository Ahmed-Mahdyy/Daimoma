import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.accounts.models import EmployeeProfile, User
from apps.organizations.models import Department, Organization


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Acme", timezone="UTC", week_start=0)


@pytest.fixture
def other_org(db):
    return Organization.objects.create(name="OtherCo", timezone="UTC", week_start=0)


def make_user(org, email):
    return User.objects.create_user(email=email, password="UnusedPassw0rd", organization=org)


def make_profile(org, user, code, **kwargs):
    return EmployeeProfile.objects.create(organization=org, user=user, employee_code=code, **kwargs)


@pytest.mark.django_db
class TestUser:
    def test_email_normalized_lowercase(self, org):
        user = make_user(org, "Alice@Example.COM")
        assert user.email == "alice@example.com"

    def test_case_insensitive_email_uniqueness(self, org):
        make_user(org, "alice@example.com")
        with pytest.raises(IntegrityError):
            make_user(org, "ALICE@EXAMPLE.COM")

    def test_no_username_field(self, org):
        user = make_user(org, "bob@example.com")
        assert user.username is None
        assert User.USERNAME_FIELD == "email"


@pytest.mark.django_db
class TestEmployeeProfile:
    def test_employee_code_unique_per_org(self, org, other_org):
        make_profile(org, make_user(org, "a@x.test"), "E1")
        # Same code in another org is allowed
        make_profile(other_org, make_user(other_org, "b@x.test"), "E1")
        with pytest.raises(IntegrityError):
            make_profile(org, make_user(org, "c@x.test"), "E1")

    def test_self_manager_rejected_at_db_level(self, org):
        profile = make_profile(org, make_user(org, "a@x.test"), "E1")
        profile.manager = profile
        with pytest.raises(IntegrityError):
            profile.save()

    def test_cross_org_manager_rejected_by_clean(self, org, other_org):
        manager = make_profile(other_org, make_user(other_org, "m@x.test"), "M1")
        profile = make_profile(org, make_user(org, "e@x.test"), "E2")
        profile.manager = manager
        with pytest.raises(ValidationError):
            profile.full_clean()

    def test_cross_org_department_rejected_by_clean(self, org, other_org):
        dept = Department.objects.create(organization=other_org, name="Ops")
        profile = make_profile(org, make_user(org, "e@x.test"), "E2")
        profile.department = dept
        with pytest.raises(ValidationError):
            profile.full_clean()

    def test_profile_org_must_match_user_org(self, org, other_org):
        user = make_user(org, "e@x.test")
        with pytest.raises(ValidationError):
            p = EmployeeProfile(organization=other_org, user=user, employee_code="E9")
            p.full_clean()

    def test_department_optional(self, org):
        profile = make_profile(org, make_user(org, "e@x.test"), "E5")
        assert profile.department is None
        profile.full_clean()  # no department is valid
