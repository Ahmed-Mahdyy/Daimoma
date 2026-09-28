"""Auth API contract tests (T008): login/logout, CSRF, invitation,
password reset, password change, session expiry, and abuse limits."""

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import EmailToken

from .conftest import INVITED_PASSWORD, TEST_PASSWORD

LOGIN_URL = "/api/v1/auth/login/"
LOGOUT_URL = "/api/v1/auth/logout/"
ACCEPT_URL = "/api/v1/auth/invitations/accept/"
RESET_URL = "/api/v1/auth/password-reset/"
RESET_CONFIRM_URL = "/api/v1/auth/password-reset/confirm/"
ME_PASSWORD_URL = "/api/v1/me/password/"


def login(client, email, password=TEST_PASSWORD):
    return client.post(LOGIN_URL, {"email": email, "password": password})


@pytest.mark.django_db
class TestLogin:
    def test_success_returns_user_summary(self, api_client, employee):
        response = login(api_client, "employee@acme.test")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "employee@acme.test"
        assert "password" not in data and "token" not in data

    def test_email_case_insensitive(self, api_client, employee):
        response = login(api_client, "EMPLOYEE@Acme.TEST")
        assert response.status_code == 200

    def test_wrong_password_rejected_generic(self, api_client, employee):
        response = login(api_client, "employee@acme.test", "WrongPassw0rdX")
        assert response.status_code == 403
        assert response.json()["code"] == "invalid_credentials"

    def test_unknown_email_same_generic_error(self, api_client, employee):
        bad_pass = login(api_client, "employee@acme.test", "WrongPassw0rdX")
        no_user = login(api_client, "ghost@acme.test", "WrongPassw0rdX")
        assert no_user.status_code == bad_pass.status_code == 403
        assert no_user.json()["code"] == bad_pass.json()["code"]

    def test_inactive_user_cannot_login(self, api_client, invited_user):
        response = login(api_client, "invited@acme.test", "AnyPassw0rd123")
        assert response.status_code == 403

    def test_login_requires_csrf(self, csrf_client, employee):
        response = csrf_client.post(
            LOGIN_URL, {"email": "employee@acme.test", "password": TEST_PASSWORD}
        )
        assert response.status_code == 403
        assert response.json()["code"] == "csrf_failed"

    def test_login_throttled_after_failures(self, api_client, employee, settings):
        settings.AUTH_THROTTLE_MAX_ATTEMPTS = 3
        for _ in range(3):
            login(api_client, "employee@acme.test", "WrongPassw0rdX")
        response = login(api_client, "employee@acme.test", "WrongPassw0rdX")
        assert response.status_code == 429
        assert response.json()["code"] == "rate_limited"

    def test_error_envelope_shape(self, api_client, employee):
        response = login(api_client, "employee@acme.test", "WrongPassw0rdX")
        body = response.json()
        assert set(body) >= {"code", "detail", "request_id"}
        assert "WrongPassw0rdX" not in str(body)


@pytest.mark.django_db
class TestLogout:
    def test_logout_requires_auth(self, api_client):
        response = api_client.post(LOGOUT_URL)
        assert response.status_code == 403
        assert response.json()["code"] == "authentication_required"

    def test_logout_invalidates_session(self, api_client, employee):
        login(api_client, "employee@acme.test")
        response = api_client.post(LOGOUT_URL)
        assert response.status_code == 200
        # Session is dead — logout again must fail.
        assert api_client.post(LOGOUT_URL).status_code == 403


@pytest.mark.django_db
class TestInvitationAccept:
    def _issue(self, invited_user):
        from apps.accounts.services import issue_invitation

        return issue_invitation(invited_user)

    def test_accept_sets_password_and_activates(self, api_client, invited_user):
        token = self._issue(invited_user)
        response = api_client.post(ACCEPT_URL, {"token": token, "password": INVITED_PASSWORD})
        assert response.status_code == 200
        invited_user.refresh_from_db()
        assert invited_user.is_active
        assert invited_user.check_password(INVITED_PASSWORD)

    def test_token_single_use(self, api_client, invited_user):
        token = self._issue(invited_user)
        api_client.post(ACCEPT_URL, {"token": token, "password": INVITED_PASSWORD})
        replay = api_client.post(ACCEPT_URL, {"token": token, "password": "OtherPassw0rd1"})
        assert replay.status_code == 400
        assert replay.json()["code"] == "invalid_token"

    def test_expired_token_rejected(self, api_client, invited_user, settings):
        settings.INVITATION_TOKEN_HOURS = 0
        token = self._issue(invited_user)
        response = api_client.post(ACCEPT_URL, {"token": token, "password": INVITED_PASSWORD})
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_token"

    def test_weak_password_rejected(self, api_client, invited_user):
        token = self._issue(invited_user)
        for weak in ["short", "alllowercase1234", "ALLUPPER1234", "NoDigitsHere"]:
            response = api_client.post(ACCEPT_URL, {"token": token, "password": weak})
            assert response.status_code == 400, weak
            assert response.json()["code"] == "validation_error"
        # Token not consumed by rejected passwords.
        ok = api_client.post(ACCEPT_URL, {"token": token, "password": INVITED_PASSWORD})
        assert ok.status_code == 200

    def test_unknown_token_rejected(self, api_client):
        response = api_client.post(
            ACCEPT_URL, {"token": "not-a-real-token", "password": INVITED_PASSWORD}
        )
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_token"

    def test_reissue_invalidates_previous_link(self, api_client, invited_user):
        from apps.accounts.services import issue_invitation

        old_token = issue_invitation(invited_user)
        new_token = issue_invitation(invited_user)
        assert (
            api_client.post(
                ACCEPT_URL, {"token": old_token, "password": INVITED_PASSWORD}
            ).status_code
            == 400
        )
        assert (
            api_client.post(
                ACCEPT_URL, {"token": new_token, "password": INVITED_PASSWORD}
            ).status_code
            == 200
        )


@pytest.mark.django_db
class TestPasswordReset:
    def test_generic_ack_no_enumeration(self, api_client, employee):
        known = api_client.post(RESET_URL, {"email": "employee@acme.test"})
        unknown = api_client.post(RESET_URL, {"email": "ghost@acme.test"})
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()

    def test_existing_account_receives_email(self, api_client, employee):
        api_client.post(RESET_URL, {"email": "employee@acme.test"})
        assert len(mail.outbox) == 1
        import re

        assert re.search(r"token=([A-Za-z0-9_\-]+)", mail.outbox[0].body)

    def test_unknown_account_no_email_same_response(self, api_client):
        response = api_client.post(RESET_URL, {"email": "ghost@acme.test"})
        assert response.status_code == 200
        assert len(mail.outbox) == 0

    def _extract_token(self):
        import re

        body = mail.outbox[-1].body
        return re.search(r"token=([A-Za-z0-9_\-]+)", body).group(1)

    def test_confirm_sets_password(self, api_client, employee):
        api_client.post(RESET_URL, {"email": "employee@acme.test"})
        token = self._extract_token()
        response = api_client.post(
            RESET_CONFIRM_URL, {"token": token, "password": INVITED_PASSWORD}
        )
        assert response.status_code == 200
        employee.refresh_from_db()
        assert employee.check_password(INVITED_PASSWORD)

    def test_confirm_replay_denied(self, api_client, employee):
        api_client.post(RESET_URL, {"email": "employee@acme.test"})
        token = self._extract_token()
        api_client.post(RESET_CONFIRM_URL, {"token": token, "password": INVITED_PASSWORD})
        replay = api_client.post(
            RESET_CONFIRM_URL, {"token": token, "password": "AnotherPassw0rd9"}
        )
        assert replay.status_code == 400

    def test_confirm_expired_token(self, api_client, employee, settings):
        settings.RECOVERY_TOKEN_MINUTES = 0
        api_client.post(RESET_URL, {"email": "employee@acme.test"})
        token = self._extract_token()
        response = api_client.post(
            RESET_CONFIRM_URL, {"token": token, "password": INVITED_PASSWORD}
        )
        assert response.status_code == 400

    def test_completed_recovery_kills_sessions(self, api_client, employee):
        other = APIClient()
        login(other, "employee@acme.test")  # pre-existing session
        api_client.post(RESET_URL, {"email": "employee@acme.test"})
        token = self._extract_token()
        api_client.post(RESET_CONFIRM_URL, {"token": token, "password": INVITED_PASSWORD})
        assert other.post(LOGOUT_URL).status_code == 403


@pytest.mark.django_db
class TestPasswordChange:
    def test_requires_current_password(self, api_client, employee):
        login(api_client, "employee@acme.test")
        response = api_client.post(
            ME_PASSWORD_URL,
            {"current_password": "WrongPassw0rdX", "new_password": INVITED_PASSWORD},
        )
        assert response.status_code == 403

    def test_change_ends_other_sessions(self, api_client, employee):
        other = APIClient()
        login(other, "employee@acme.test")
        login(api_client, "employee@acme.test")
        response = api_client.post(
            ME_PASSWORD_URL,
            {"current_password": TEST_PASSWORD, "new_password": INVITED_PASSWORD},
        )
        assert response.status_code == 200
        # This session stays alive...
        assert api_client.post(LOGOUT_URL).status_code == 200
        # ...but the other session is dead.
        assert other.post(LOGOUT_URL).status_code == 403

    def test_unauthenticated_rejected(self, api_client):
        response = api_client.post(
            ME_PASSWORD_URL,
            {"current_password": TEST_PASSWORD, "new_password": INVITED_PASSWORD},
        )
        assert response.status_code == 403


@pytest.mark.django_db
class TestSessionExpiry:
    def _stale_session_client(self, user, seconds_idle):
        client = APIClient()
        login(client, user.email)
        session = client.session
        session["_daimoma_last_seen"] = (
            timezone.now() - timezone.timedelta(seconds=seconds_idle)
        ).timestamp()
        session.save()
        return client

    def test_idle_expiry(self, employee, settings):
        settings.SESSION_IDLE_SECONDS = 7200
        client = self._stale_session_client(employee, 7201)
        assert client.post(LOGOUT_URL).status_code == 403

    def test_within_idle_window_allowed(self, employee, settings):
        settings.SESSION_IDLE_SECONDS = 7200
        client = self._stale_session_client(employee, 3600)
        assert client.post(LOGOUT_URL).status_code == 200

    def test_absolute_expiry(self, employee, settings):
        settings.SESSION_ABSOLUTE_SECONDS = 86400
        client = APIClient()
        login(client, employee.email)
        session = client.session
        session["_daimoma_absolute_deadline"] = (
            timezone.now() - timezone.timedelta(seconds=1)
        ).timestamp()
        session.save()
        assert client.post(LOGOUT_URL).status_code == 403


@pytest.mark.django_db
class TestEmailTokenModel:
    def test_tokens_stored_hashed_not_raw(self, invited_user):
        from apps.accounts.services import issue_invitation

        raw = issue_invitation(invited_user)
        record = EmailToken.objects.get()
        assert record.token_hash != raw
        assert raw not in record.token_hash

    def test_recovery_token_expiry_uses_minutes(self, employee, settings):
        settings.RECOVERY_TOKEN_MINUTES = 30
        from apps.accounts.services import issue_recovery_token

        issue_recovery_token(employee)
        record = EmailToken.objects.get()
        delta = record.expires_at - timezone.now()
        assert 1700 < delta.total_seconds() <= 1800


@pytest.mark.django_db
class TestNoSecretLeakage:
    def test_token_never_in_error_responses(self, api_client, invited_user):
        from apps.accounts.services import issue_invitation

        token = issue_invitation(invited_user)
        api_client.post(ACCEPT_URL, {"token": token, "password": INVITED_PASSWORD})
        replay = api_client.post(ACCEPT_URL, {"token": token, "password": "OtherPassw0rd1"})
        assert token not in str(replay.json())
