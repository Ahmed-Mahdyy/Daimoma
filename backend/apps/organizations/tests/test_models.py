import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.organizations.models import Department, Organization


@pytest.mark.django_db
class TestOrganization:
    def test_valid_iana_timezone_required(self):
        org = Organization(name="Acme", timezone="Not/AZone", week_start=0)
        with pytest.raises(ValidationError):
            org.full_clean()

    def test_week_start_range(self):
        org = Organization(name="Acme", timezone="UTC", week_start=7)
        with pytest.raises(ValidationError):
            org.full_clean()


@pytest.mark.django_db
class TestDepartment:
    def test_normalized_unique_name_per_org(self, db):
        org = Organization.objects.create(name="Acme")
        Department.objects.create(organization=org, name="Finance")
        with pytest.raises(IntegrityError):
            Department.objects.create(organization=org, name="  finance  ")

    def test_same_name_allowed_in_other_org(self, db):
        org = Organization.objects.create(name="Acme")
        other = Organization.objects.create(name="OtherCo")
        Department.objects.create(organization=org, name="Ops")
        Department.objects.create(organization=other, name="Ops")
