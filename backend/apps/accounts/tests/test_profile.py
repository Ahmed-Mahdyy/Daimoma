"""Profile mass-assignment and protected-field tests (T010, FR-003/FR-010).
Employee may edit only display_name, phone, preferred_locale. Every other
field — including is_staff/is_superuser/organization — must be rejected."""

import pytest
from rest_framework.test import APIClient

from .conftest import TEST_PASSWORD

ME_URL = "/api/v1/me/"

PROTECTED_FIELDS = [
    "email",
    "employee_code",
    "job_title",
    "department",
    "manager",
    "organization",
    "is_staff",
    "is_superuser",
    "is_active",
    "role",
    "user",
    "password",
]


@pytest.fixture
def logged_in(api_client, employee):
    api_client.post(
        "/api/v1/auth/login/",
        {"email": "employee@acme.test", "password": TEST_PASSWORD},
    )
    return api_client


@pytest.fixture
def logged_in_csrf(csrf_client, employee):
    csrf_client.force_login(employee)
    csrf_client.get("/api/v1/auth/csrf/")
    return csrf_client


@pytest.mark.django_db
class TestMeRead:
    def test_returns_profile_summary(self, logged_in, employee):
        response = logged_in.get(ME_URL)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "employee@acme.test"
        assert data["employee_code"] == "E001"
        assert data["preferred_locale"] == "en"
        assert "password" not in data
        assert "is_staff" not in data
        assert "is_superuser" not in data
        assert "version" in data

    def test_roles_exposed_as_business_groups(self, logged_in, hr_user):
        hr_client = APIClient()
        hr_client.post(
            "/api/v1/auth/login/",
            {"email": "hr@acme.test", "password": TEST_PASSWORD},
        )
        response = hr_client.get(ME_URL)
        assert response.json()["roles"] == ["HR"]

    def test_unauthenticated_rejected(self, api_client):
        response = api_client.get(ME_URL)
        assert response.status_code == 403
        assert response.json()["code"] == "authentication_required"


@pytest.mark.django_db
class TestMeUpdate:
    def test_allowed_fields_update(self, logged_in, employee):
        response = logged_in.patch(
            ME_URL,
            {
                "display_name": "Sara K.",
                "phone": "+20 100 000 0000",
                "preferred_locale": "ar",
            },
            format="json",
        )
        assert response.status_code == 200
        employee.profile.refresh_from_db()
        assert employee.profile.display_name == "Sara K."
        assert employee.profile.phone == "+20 100 000 0000"
        assert employee.profile.preferred_locale == "ar"

    def test_allowed_fields_are_the_complete_allowlist(self, logged_in, employee):
        """Every field outside {display_name, phone, preferred_locale,
        version} must be rejected — including all privilege fields."""
        for field in PROTECTED_FIELDS:
            response = logged_in.patch(ME_URL, {field: "x"}, format="json")
            assert response.status_code == 400, f"{field} was not rejected"
            assert response.json()["code"] == "validation_error"
        employee.refresh_from_db()
        assert not employee.is_staff
        assert not employee.is_superuser
        assert employee.email == "employee@acme.test"
        assert employee.profile.employee_code == "E001"

    def test_unknown_field_rejected(self, logged_in):
        response = logged_in.patch(ME_URL, {"hax": "x"}, format="json")
        assert response.status_code == 400

    def test_invalid_locale_rejected(self, logged_in):
        response = logged_in.patch(ME_URL, {"preferred_locale": "fr"}, format="json")
        assert response.status_code == 400
        assert "preferred_locale" in response.json()["field_errors"]

    def test_stale_version_conflict(self, logged_in, employee):
        response = logged_in.patch(
            ME_URL,
            {"display_name": "X Y", "version": employee.profile.version + 5},
            format="json",
        )
        assert response.status_code == 409
        assert response.json()["code"] == "state_conflict"

    def test_version_increments_on_save(self, logged_in, employee):
        before = employee.profile.version
        logged_in.patch(ME_URL, {"display_name": "Zed"}, format="json")
        employee.profile.refresh_from_db()
        assert employee.profile.version == before + 1

    def test_patch_requires_csrf(self, logged_in_csrf):
        response = logged_in_csrf.patch(ME_URL, {"display_name": "X"}, format="json")
        assert response.status_code == 403
        assert response.json()["code"] == "csrf_failed"

    def test_patch_with_csrf_succeeds(self, logged_in_csrf):
        token = logged_in_csrf.cookies["csrftoken"].value
        response = logged_in_csrf.patch(
            ME_URL,
            {"display_name": "Via CSRF"},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        assert response.status_code == 200

    def test_unauthenticated_patch_rejected(self, api_client):
        response = api_client.patch(ME_URL, {"display_name": "X"}, format="json")
        assert response.status_code == 403
