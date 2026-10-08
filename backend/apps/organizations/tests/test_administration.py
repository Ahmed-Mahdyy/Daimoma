"""HR administration tests (T013, FR-002/FR-004/FR-005/FR-010):
provisioning, roles, reporting lines, last-HR protection, deactivation/
reactivation, departments, and organization settings."""

from unittest.mock import patch

import pytest
from django.contrib.auth.models import Group
from django.core import mail
from rest_framework.test import APIClient

from apps.accounts.models import EmailToken, User
from apps.accounts.permissions import ROLE_HR, ROLE_MANAGER
from apps.audit.models import AuditEvent
from apps.conftest import TEST_PASSWORD, make_profile, make_user
from apps.organizations.models import Department

EMPLOYEES = "/api/v1/employees/"
DEPARTMENTS = "/api/v1/departments/"
SETTINGS = "/api/v1/organization/settings/"


def hr_client(hr_user):
    c = APIClient()
    c.post("/api/v1/auth/login/", {"email": hr_user.email, "password": TEST_PASSWORD})
    return c


def authed_client(user):
    c = APIClient()
    c.post("/api/v1/auth/login/", {"email": user.email, "password": TEST_PASSWORD})
    return c


@pytest.mark.django_db
class TestProvision:
    PAYLOAD = {
        "email": "newbie@acme.test",
        "employee_code": "E100",
        "display_name": "New Person",
        "job_title": "Analyst",
    }

    def test_hr_provisions_atomically(self, hr_user, org):
        response = hr_client(hr_user).post(
            EMPLOYEES, {**self.PAYLOAD, "roles": ["Manager"]}, format="json"
        )
        assert response.status_code == 201
        user = User.objects.get(email="newbie@acme.test")
        assert user.organization == org
        assert not user.is_active  # inactive until invitation accepted
        assert not user.has_usable_password()
        assert user.groups.filter(name=ROLE_MANAGER).exists()
        assert user.profile.employee_code == "E100"
        # Invitation issued + emailed + audited.
        assert EmailToken.objects.filter(
            user=user, purpose=EmailToken.Purpose.INVITATION, used_at__isnull=True
        ).exists()
        assert len(mail.outbox) == 1
        assert AuditEvent.objects.filter(action="employee_provisioned", target_id=user.id).exists()

    def test_hr_provisions_employee_information(self, hr_user):
        payload = {
            **self.PAYLOAD,
            "birth_date": "1995-05-20",
            "address": "Example address",
            "emergency_contact_name": "Example Contact",
            "emergency_contact_phone": "+20 100 000 0000",
            "highest_qualification": "Bachelor's",
            "institution": "Example University",
            "field_of_study": "Engineering",
            "graduation_year": 2017,
            "employment_start_date": "2025-01-15",
            "employment_type": "full_time",
            "work_location": "Cairo",
            "contract_start_date": "2025-01-15",
            "contract_end_date": "2027-01-14",
        }
        response = hr_client(hr_user).post(EMPLOYEES, payload, format="json")
        assert response.status_code == 201
        assert response.json()["highest_qualification"] == "Bachelor's"
        assert response.json()["work_location"] == "Cairo"
        profile = User.objects.get(email=self.PAYLOAD["email"]).profile
        assert profile.birth_date.isoformat() == "1995-05-20"
        assert profile.contract_end_date.isoformat() == "2027-01-14"

    def test_invalid_employee_information_rejected(self, hr_user):
        invalid = (("birth_date", "2099-01-01"), ("graduation_year", 1800),
                   ("employment_type", "unknown"))
        for field, value in invalid:
            response = hr_client(hr_user).post(
                EMPLOYEES, {**self.PAYLOAD, field: value}, format="json"
            )
            assert response.status_code == 400
            assert field in response.json()["field_errors"]
        assert not User.objects.filter(email=self.PAYLOAD["email"]).exists()

    def test_contract_end_before_start_rejected(self, hr_user):
        response = hr_client(hr_user).post(
            EMPLOYEES,
            {
                **self.PAYLOAD,
                "contract_start_date": "2026-02-01",
                "contract_end_date": "2026-01-01",
            },
            format="json",
        )
        assert response.status_code == 400
        assert "contract_end_date" in response.json()["field_errors"]

    @pytest.mark.parametrize("role_fixture", ["employee", "manager"])
    def test_non_hr_forbidden(self, role_fixture, request):
        user = request.getfixturevalue(role_fixture)
        response = authed_client(user).post(EMPLOYEES, self.PAYLOAD, format="json")
        assert response.status_code == 403

    def test_duplicate_email_rejected(self, hr_user, employee):
        response = hr_client(hr_user).post(
            EMPLOYEES, {**self.PAYLOAD, "email": "EMPLOYEE@acme.test"}, format="json"
        )
        assert response.status_code == 400

    def test_duplicate_phone_rejected(self, hr_user, employee, org):
        employee.profile.phone = "01055550000"
        employee.profile.save(update_fields=["phone"])
        response = hr_client(hr_user).post(
            EMPLOYEES, {**self.PAYLOAD, "phone": "010 5555 0000"}, format="json"
        )
        assert response.status_code == 400
        assert "phone" in response.json()["field_errors"]
        assert not User.objects.filter(email=self.PAYLOAD["email"]).exists()

    def test_cross_org_manager_rejected(self, hr_user, other_org):
        foreign = make_profile(other_org, make_user(other_org, "m@x.test"), "M9")
        response = hr_client(hr_user).post(
            EMPLOYEES, {**self.PAYLOAD, "manager": str(foreign.id)}, format="json"
        )
        assert response.status_code == 400

    def test_cross_org_department_rejected(self, hr_user, other_org):
        foreign = Department.objects.create(organization=other_org, name="Elsewhere")
        response = hr_client(hr_user).post(
            EMPLOYEES, {**self.PAYLOAD, "department": str(foreign.id)}, format="json"
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestAdminUpdate:
    def _patch(self, client, profile, payload):
        return client.patch(f"{EMPLOYEES}{profile.id}/", payload, format="json")

    def test_hr_updates_admin_fields(self, hr_user, employee, org):
        dept = Department.objects.create(organization=org, name="Ops")
        response = self._patch(
            hr_client(hr_user),
            employee.profile,
            {"job_title": "Lead", "department": str(dept.id), "display_name": "E"},
        )
        assert response.status_code == 200
        employee.profile.refresh_from_db()
        assert employee.profile.job_title == "Lead"
        assert employee.profile.department == dept
        assert employee.profile.display_name == "E"

    def test_hr_updates_information_without_logging_personal_values(self, hr_user, employee):
        response = self._patch(
            hr_client(hr_user), employee.profile,
            {"address": "Private address", "graduation_year": 2020, "employment_type": "part_time"},
        )
        assert response.status_code == 200
        employee.profile.refresh_from_db()
        assert employee.profile.address == "Private address"
        assert response.json()["graduation_year"] == 2020
        event = AuditEvent.objects.filter(action="employee_updated").latest("occurred_at")
        assert "Private address" not in str(event.metadata)

    def test_contract_range_checked_against_stored_date(self, hr_user, employee):
        """A partial PATCH carries only one side of the range — the service
        must compare it against the stored counterpart."""
        c = hr_client(hr_user)
        assert self._patch(
            c, employee.profile, {"contract_start_date": "2026-01-01"}
        ).status_code == 200
        response = self._patch(c, employee.profile, {"contract_end_date": "2025-12-31"})
        assert response.status_code == 400
        employee.profile.refresh_from_db()
        assert employee.profile.contract_end_date is None
        assert self._patch(
            c, employee.profile, {"contract_end_date": "2027-12-31"}
        ).status_code == 200

    def test_duplicate_phone_rejected(self, hr_user, employee, org):
        other = make_profile(
            org, make_user(org, "other@x.test"), "E2", phone="01055550000"
        )
        c = hr_client(hr_user)
        response = self._patch(c, employee.profile, {"phone": "010 5555 0000"})
        assert response.status_code == 400
        assert "phone" in response.json()["field_errors"]
        # Keeping the same value on the same employee is allowed.
        assert self._patch(c, other, {"phone": "010 5555 0000"}).status_code == 200
        # Blank phones don't collide.
        assert self._patch(c, employee.profile, {"phone": ""}).status_code == 200

    def test_non_egyptian_phones_rejected(self, hr_user, employee):
        c = hr_client(hr_user)
        for field in ("phone", "emergency_contact_phone"):
            response = self._patch(c, employee.profile, {field: "+1 555 000 0000"})
            assert response.status_code == 400, field
            assert field in response.json()["field_errors"]
        assert self._patch(
            c, employee.profile, {"phone": "010 1234 5678"}
        ).status_code == 200
        employee.profile.refresh_from_db()
        assert employee.profile.phone == "01012345678"

    def test_privilege_fields_never_writable(self, hr_user, employee):
        for field in ["is_staff", "is_superuser", "is_active", "password"]:
            response = self._patch(hr_client(hr_user), employee.profile, {field: True})
            assert response.status_code == 400, field
        employee.refresh_from_db()
        assert not employee.is_staff and not employee.is_superuser

    @pytest.mark.parametrize("role_fixture", ["employee", "manager"])
    def test_non_hr_cannot_patch(self, role_fixture, request, employee):
        user = request.getfixturevalue(role_fixture)
        response = self._patch(authed_client(user), employee.profile, {"job_title": "Hax"})
        assert response.status_code == 403

    def test_manager_cannot_patch_own_report(self, hr_user, manager, org):
        report = make_profile(org, make_user(org, "r@x.test"), "R1", manager=manager.profile)
        response = self._patch(authed_client(manager), report, {"job_title": "Hax"})
        assert response.status_code == 403

    def test_role_grant_and_revoke(self, hr_user, employee):
        c = hr_client(hr_user)
        response = self._patch(c, employee.profile, {"roles": ["Manager", "HR"]})
        assert response.status_code == 200
        assert set(employee.groups.values_list("name", flat=True)) == {
            ROLE_MANAGER,
            ROLE_HR,
        }
        response = self._patch(c, employee.profile, {"roles": []})
        assert response.status_code == 200
        assert employee.groups.count() == 0

    def test_unknown_role_rejected(self, hr_user, employee):
        response = self._patch(hr_client(hr_user), employee.profile, {"roles": ["SuperAdmin"]})
        assert response.status_code == 400

    def test_last_hr_cannot_lose_hr_role(self, hr_user):
        response = self._patch(hr_client(hr_user), hr_user.profile, {"roles": ["Manager"]})
        assert response.status_code == 400
        assert hr_user.groups.filter(name=ROLE_HR).exists()

    def test_second_hr_can_lose_hr_role(self, hr_user, employee):
        employee.groups.add(Group.objects.get(name=ROLE_HR))
        response = self._patch(hr_client(hr_user), employee.profile, {"roles": ["Manager"]})
        assert response.status_code == 200
        assert not employee.groups.filter(name=ROLE_HR).exists()

    def test_reporting_line_cycle_rejected(self, hr_user, org):
        p1 = make_profile(org, make_user(org, "p1@x.test"), "P1")
        p2 = make_profile(org, make_user(org, "p2@x.test"), "P2", manager=p1)
        c = hr_client(hr_user)
        # p2 manages p1's report is fine; making p1's manager p2 creates a cycle.
        response = self._patch(c, p1, {"manager": str(p2.id)})
        assert response.status_code == 400
        p1.refresh_from_db()
        assert p1.manager_id is None

    def test_self_manager_rejected(self, hr_user, employee):
        response = self._patch(
            hr_client(hr_user), employee.profile, {"manager": str(employee.profile.id)}
        )
        assert response.status_code == 400

    def test_stale_version_conflict(self, hr_user, employee):
        response = self._patch(
            hr_client(hr_user),
            employee.profile,
            {"job_title": "X", "version": employee.profile.version + 3},
        )
        assert response.status_code == 409
        assert response.json()["code"] == "state_conflict"

    def test_out_of_scope_employee_404(self, hr_user, other_org):
        foreign = make_profile(other_org, make_user(other_org, "f@x.test"), "F1")
        response = self._patch(hr_client(hr_user), foreign, {"job_title": "X"})
        assert response.status_code == 404


@pytest.mark.django_db
class TestDeactivation:
    def test_deactivate_kills_sessions_and_audits(self, hr_user, employee):
        victim = authed_client(employee)
        assert victim.get("/api/v1/me/").status_code == 200
        response = hr_client(hr_user).post(
            f"{EMPLOYEES}{employee.profile.id}/deactivate/", {"reason": "Left"}
        )
        assert response.status_code == 200
        employee.refresh_from_db()
        assert not employee.is_active
        assert victim.get("/api/v1/me/").status_code == 403
        event = AuditEvent.objects.get(action="employee_deactivated")
        assert event.metadata["reason"] == "Left"

    def test_last_hr_cannot_be_deactivated(self, hr_user):
        response = hr_client(hr_user).post(
            f"{EMPLOYEES}{hr_user.profile.id}/deactivate/", {"reason": "x"}
        )
        assert response.status_code in (400, 409)
        hr_user.refresh_from_db()
        assert hr_user.is_active

    def test_non_hr_cannot_deactivate(self, manager, employee):
        response = authed_client(manager).post(
            f"{EMPLOYEES}{employee.profile.id}/deactivate/", {"reason": "x"}
        )
        assert response.status_code == 403

    def test_reactivate_restores_without_sessions(self, hr_user, employee):
        employee.is_active = False
        employee.save(update_fields=["is_active"])
        old_session = authed_client(employee)  # would-be stale session client
        response = hr_client(hr_user).post(f"{EMPLOYEES}{employee.profile.id}/reactivate/", {})
        assert response.status_code == 200
        employee.refresh_from_db()
        assert employee.is_active
        # Fresh sign-in works; nothing resurrects prior sessions server-side.
        assert old_session.get("/api/v1/me/").status_code == 403
        assert authed_client(employee).get("/api/v1/me/").status_code == 200

    def test_resend_invitation_rotates_token(self, hr_user, invited_user):
        c = hr_client(hr_user)
        response = c.post(f"{EMPLOYEES}{invited_user.profile.id}/resend-invitation/", {})
        assert response.status_code == 200
        tokens = EmailToken.objects.filter(user=invited_user, purpose=EmailToken.Purpose.INVITATION)
        assert tokens.filter(used_at__isnull=True).count() == 1


@pytest.mark.django_db
class TestDepartments:
    def test_crud_and_deactivate_unassigns(self, hr_user, employee, org):
        c = hr_client(hr_user)
        response = c.post(DEPARTMENTS, {"name": "Engineering"}, format="json")
        assert response.status_code == 201
        dept_id = response.json()["id"]

        employee.profile.department_id = dept_id
        employee.profile.save(update_fields=["department"])

        response = c.patch(f"{DEPARTMENTS}{dept_id}/", {"is_active": False}, format="json")
        assert response.status_code == 200
        employee.profile.refresh_from_db()
        assert employee.profile.department is None  # left unassigned, not blocked
        assert not Department.objects.get(id=dept_id).is_active

    def test_normalized_name_unique(self, hr_user, org):
        c = hr_client(hr_user)
        c.post(DEPARTMENTS, {"name": "People Ops"}, format="json")
        response = c.post(DEPARTMENTS, {"name": "  people   ops "}, format="json")
        assert response.status_code == 400

    def test_no_delete_endpoint(self, hr_user, org):
        dept = Department.objects.create(organization=org, name="X")
        response = hr_client(hr_user).delete(f"{DEPARTMENTS}{dept.id}/")
        assert response.status_code == 405
        assert Department.objects.filter(id=dept.id).exists()

    def test_non_hr_forbidden(self, employee):
        c = authed_client(employee)
        assert c.get(DEPARTMENTS).status_code == 403
        assert c.post(DEPARTMENTS, {"name": "Y"}, format="json").status_code == 403

    def test_department_manager_create_edit_and_clear(self, hr_user, employee, org):
        employee.groups.add(Group.objects.get(name=ROLE_MANAGER))
        c = hr_client(hr_user)
        response = c.post(
            DEPARTMENTS, {"name": "Operations", "manager": str(employee.profile.id)}, format="json"
        )
        assert response.status_code == 201
        dept_id = response.json()["id"]
        assert response.json()["manager"] == str(employee.profile.id)
        assert response.json()["manager_name"] == employee.profile.employee_code
        assert c.get(f"{DEPARTMENTS}{dept_id}/").json()["manager"] == str(employee.profile.id)
        response = c.patch(f"{DEPARTMENTS}{dept_id}/", {"name": "Operations team"}, format="json")
        assert response.status_code == 200
        response = c.patch(f"{DEPARTMENTS}{dept_id}/", {"manager": None}, format="json")
        assert response.json()["manager"] is None
        response = c.patch(
            f"{DEPARTMENTS}{dept_id}/", {"manager": str(employee.profile.id)}, format="json"
        )
        assert response.json()["manager"] == str(employee.profile.id)
        assert employee.profile.manager_id is None

    def test_department_manager_must_be_active_org_manager(self, hr_user, employee, org, other_org):
        c = hr_client(hr_user)
        foreign = make_profile(other_org, make_user(other_org, "lead@x.test"), "M9")
        for manager_id in (str(employee.profile.id), str(foreign.id)):
            response = c.post(
                DEPARTMENTS, {"name": "Operations", "manager": manager_id}, format="json"
            )
            assert response.status_code == 400
        employee.groups.add(Group.objects.get(name=ROLE_MANAGER))
        employee.is_active = False
        employee.save(update_fields=["is_active"])
        response = c.post(
            DEPARTMENTS, {"name": "Operations", "manager": str(employee.profile.id)},
            format="json",
        )
        assert response.status_code == 400

    def test_department_search_matches_name_and_manager(self, hr_user, employee, org, other_org):
        employee.groups.add(Group.objects.get(name=ROLE_MANAGER))
        employee.profile.display_name = "Morgan Lead"
        employee.profile.save(update_fields=["display_name"])
        Department.objects.create(organization=org, name="Engineering")
        Department.objects.create(organization=org, name="Operations", manager=employee.profile)
        Department.objects.create(organization=other_org, name="Engineering Annex")
        c = hr_client(hr_user)

        def names(response):
            return {d["name"] for d in response.json()["results"]}

        assert names(c.get(f"{DEPARTMENTS}?search=engin")) == {"Engineering"}
        assert names(c.get(f"{DEPARTMENTS}?search=morgan")) == {"Operations"}
        assert names(c.get(f"{DEPARTMENTS}?search={employee.email}")) == {"Operations"}
        # Organization scope applies before the text filter.
        assert names(c.get(f"{DEPARTMENTS}?search=annex")) == set()
        assert names(c.get(f"{DEPARTMENTS}?search=zzz")) == set()

    def test_department_manager_is_private_to_hr(self, hr_user, employee, org, other_org):
        dept = Department.objects.create(organization=org, name="Operations")
        foreign = Department.objects.create(organization=other_org, name="Elsewhere")
        assert authed_client(employee).get(f"{DEPARTMENTS}{dept.id}/").status_code == 403
        response = authed_client(employee).patch(
            f"{DEPARTMENTS}{dept.id}/", {"manager": None}, format="json"
        )
        assert response.status_code == 403
        assert hr_client(hr_user).get(f"{DEPARTMENTS}{foreign.id}/").status_code == 404
        response = hr_client(hr_user).patch(
            f"{DEPARTMENTS}{foreign.id}/", {"manager": None}, format="json"
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestOrgSettings:
    def test_get_and_patch(self, hr_user):
        c = hr_client(hr_user)
        response = c.get(SETTINGS)
        assert response.status_code == 200
        assert response.json()["timezone"] == "UTC"

        response = c.patch(SETTINGS, {"timezone": "Africa/Cairo", "week_start": 6}, format="json")
        assert response.status_code == 200
        assert response.json()["week_start"] == 6

    def test_invalid_timezone_rejected(self, hr_user):
        response = hr_client(hr_user).patch(SETTINGS, {"timezone": "Not/AZone"}, format="json")
        assert response.status_code == 400

    def test_fallback_reviewer_must_be_hr(self, hr_user, employee):
        response = hr_client(hr_user).patch(
            SETTINGS, {"fallback_reviewer": str(employee.id)}, format="json"
        )
        assert response.status_code == 400

    def test_fallback_reviewer_accepts_hr(self, hr_user):
        response = hr_client(hr_user).patch(
            SETTINGS, {"fallback_reviewer": str(hr_user.id)}, format="json"
        )
        assert response.status_code == 200

    def test_non_hr_forbidden(self, manager):
        assert authed_client(manager).get(SETTINGS).status_code == 403

    def test_email_settings_round_trip_and_password_hidden(self, hr_user, org):
        c = hr_client(hr_user)
        response = c.patch(
            SETTINGS,
            {
                "email_mode": "smtp", "email_host": "smtp.test", "email_port": 587,
                "email_host_user": "mailer", "email_host_password": "s3cret!",
                "email_use_tls": True, "email_from": "no-reply@x.test",
            },
            format="json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email_password_set"] is True
        assert "email_host_password" not in data
        org.refresh_from_db()
        assert org.email_host_password == "s3cret!"

        # A blank password keeps the stored one; a non-blank replaces it.
        response = c.patch(SETTINGS, {"email_host_user": "u2"}, format="json")
        org.refresh_from_db()
        assert org.email_host_password == "s3cret!"
        c.patch(SETTINGS, {"email_host_password": "n3w!"}, format="json")
        org.refresh_from_db()
        assert org.email_host_password == "n3w!"

        # The credential never appears in audit metadata.
        for event in AuditEvent.objects.filter(action="organization_settings_updated"):
            assert "s3cret" not in str(event.metadata) and "n3w" not in str(event.metadata)

    def test_email_settings_validation(self, hr_user, org):
        c = hr_client(hr_user)
        response = c.patch(
            SETTINGS, {"email_use_tls": True, "email_use_ssl": True}, format="json"
        )
        assert response.status_code == 400
        response = c.patch(
            SETTINGS, {"email_mode": "smtp", "email_host": "  "}, format="json"
        )
        assert response.status_code == 400

    def test_email_test_endpoint_permissions_and_probe(self, hr_user, employee, org):
        org.email_mode = "smtp"
        org.email_host = "smtp.test"
        org.email_host_password = "s3cret!"
        org.save()
        url = f"{SETTINGS}test-email/"

        assert authed_client(employee).post(url, {}, format="json").status_code == 403

        c = hr_client(hr_user)
        with patch("django.core.mail.get_connection") as get_conn:
            response = c.post(url, {}, format="json")
        assert response.status_code == 200
        kwargs = get_conn.call_args.kwargs
        assert kwargs["host"] == "smtp.test" and kwargs["password"] == "s3cret!"
        sent = get_conn.return_value.send_messages.call_args.args[0][0]
        assert sent.to == [hr_user.email]

        # Overrides let HR verify unsaved form values; a blank password still
        # means the stored one.
        with patch("django.core.mail.get_connection") as get_conn:
            response = c.post(
                url, {"email_host": "smtp2.test", "email_host_password": ""}, format="json"
            )
        assert response.status_code == 200
        kwargs = get_conn.call_args.kwargs
        assert kwargs["host"] == "smtp2.test" and kwargs["password"] == "s3cret!"

    def test_invitation_uses_org_smtp_when_enabled(self, hr_user, employee, org):
        from apps.accounts.services import issue_invitation

        org.email_mode = "smtp"
        org.email_host = "smtp.test"
        org.email_use_tls = True
        org.email_from = "noreply@x.test"
        org.save()
        with (
            patch("apps.accounts.services.EmailMultiAlternatives") as mail_cls,
            patch("django.core.mail.get_connection") as get_conn,
        ):
            issue_invitation(employee)
        kwargs = get_conn.call_args.kwargs
        assert kwargs["host"] == "smtp.test" and kwargs["use_tls"] is True
        call = mail_cls.call_args
        assert call.args[2] == "noreply@x.test"  # from_email
        assert call.kwargs["connection"] is get_conn.return_value
        mail_cls.return_value.send.assert_called_once_with()

        # env mode never builds a custom connection
        org.email_mode = "env"
        org.save()
        with (
            patch("apps.accounts.services.EmailMultiAlternatives") as mail_cls,
            patch("django.core.mail.get_connection") as get_conn,
        ):
            issue_invitation(employee)
        get_conn.assert_not_called()
        assert mail_cls.call_args.kwargs["connection"] is None

    def test_email_test_failure_is_safe(self, hr_user, org):
        from smtplib import SMTPAuthenticationError

        org.email_mode = "smtp"
        org.email_host = "smtp.test"
        org.email_host_password = "s3cret!"
        org.save()
        with patch("django.core.mail.get_connection") as get_conn:
            get_conn.return_value.send_messages.side_effect = SMTPAuthenticationError(
                535, b"s3cret! rejected"
            )
            response = hr_client(hr_user).post(
                f"{SETTINGS}test-email/", {}, format="json"
            )
        assert response.status_code == 400
        # Classified, safe message — the raw server reply/credential never leaks.
        body = str(response.json())
        assert "s3cret" not in body
        assert AuditEvent.objects.filter(action="email_connection_test_failed").exists()
