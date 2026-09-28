from django.contrib.auth import logout, update_session_auth_hash
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import CsrfEnforcedSessionAuthentication
from apps.accounts.permissions import IsActiveAuthenticated
from apps.accounts.serializers import (
    LoginSerializer,
    MeSerializer,
    PasswordChangeSerializer,
    PasswordResetRequestSerializer,
    TokenPasswordSerializer,
    UserSummarySerializer,
)
from apps.accounts.services import (
    accept_invitation,
    change_password,
    confirm_password_reset,
    login_user,
    request_password_reset,
)


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfBootstrapView(APIView):
    """GET /api/v1/auth/csrf/ — sets the csrftoken cookie so the SPA can send
    the X-CSRFToken header on unsafe requests. Returns no personal data."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"detail": "ok"})


class LoginView(APIView):
    """POST /api/v1/auth/login/ — email/password. Explicitly CSRF-protected
    even for anonymous callers; bounded failures; generic error."""

    permission_classes = [AllowAny]
    authentication_classes = [CsrfEnforcedSessionAuthentication]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = login_user(request, **serializer.validated_data)
        return Response(UserSummarySerializer(user).data)


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — ends the current session only."""

    permission_classes = [IsActiveAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"detail": "Signed out."})


class InvitationAcceptView(APIView):
    """POST /api/v1/auth/invitations/accept/ — single-use 48h token + new
    password. Replay, expiry, and policy violations all rejected."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = TokenPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        accept_invitation(serializer.validated_data["token"], serializer.validated_data["password"])
        return Response({"detail": "Invitation accepted."})


class PasswordResetRequestView(APIView):
    """POST /api/v1/auth/password-reset/ — generic acknowledgement; never
    reveals whether the email maps to an account."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_password_reset(serializer.validated_data["email"])
        return Response({"detail": "If the email is registered, a recovery link was sent."})


class PasswordResetConfirmView(APIView):
    """POST /api/v1/auth/password-reset/confirm/ — 30-min single-use token;
    on success all existing sessions are invalidated."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = TokenPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        confirm_password_reset(
            serializer.validated_data["token"], serializer.validated_data["password"]
        )
        return Response({"detail": "Password updated."})


class MePasswordView(APIView):
    """POST /api/v1/me/password/ — requires the current password; ends all
    other sessions while keeping the caller's session alive."""

    permission_classes = [IsActiveAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_password(
            request.user,
            serializer.validated_data["current_password"],
            serializer.validated_data["new_password"],
            keep_session_key=request.session.session_key,
        )
        update_session_auth_hash(request, request.user)
        return Response({"detail": "Password changed."})


class MeView(APIView):
    """GET /api/v1/me/ — own profile summary.
    PATCH /api/v1/me/ — allowlisted self-service fields only."""

    permission_classes = [IsActiveAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user.profile).data)

    def patch(self, request):
        profile = request.user.profile
        serializer = MeSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
