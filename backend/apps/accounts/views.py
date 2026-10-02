from django.contrib.auth import logout, update_session_auth_hash
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
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

DetailSerializer = inline_serializer(
    name="DetailResponse", fields={"detail": drf_serializers.CharField()}
)


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfBootstrapView(APIView):
    """GET /api/v1/auth/csrf/ — sets the csrftoken cookie so the SPA can send
    the X-CSRFToken header on unsafe requests. Returns no personal data."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: DetailSerializer})
    def get(self, request):
        return Response({"detail": "ok"})


class LoginView(APIView):
    """POST /api/v1/auth/login/ — email/password. Explicitly CSRF-protected
    even for anonymous callers; bounded failures; generic error."""

    permission_classes = [AllowAny]
    authentication_classes = [CsrfEnforcedSessionAuthentication]

    @extend_schema(request=LoginSerializer, responses={200: UserSummarySerializer})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = login_user(request, **serializer.validated_data)
        return Response(UserSummarySerializer(user).data)


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — ends the current session only."""

    permission_classes = [IsActiveAuthenticated]

    @extend_schema(request=None, responses={200: DetailSerializer})
    def post(self, request):
        logout(request)
        return Response({"detail": "Signed out."})


class InvitationAcceptView(APIView):
    """POST /api/v1/auth/invitations/accept/ — single-use 48h token + new
    password. Replay, expiry, and policy violations all rejected."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=TokenPasswordSerializer, responses={200: DetailSerializer})
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

    @extend_schema(request=PasswordResetRequestSerializer, responses={200: DetailSerializer})
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

    @extend_schema(request=TokenPasswordSerializer, responses={200: DetailSerializer})
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

    @extend_schema(request=PasswordChangeSerializer, responses={200: DetailSerializer})
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

    @extend_schema(responses={200: MeSerializer})
    def get(self, request):
        return Response(MeSerializer(request.user.profile).data)

    @extend_schema(request=MeSerializer, responses={200: MeSerializer})
    def patch(self, request):
        profile = request.user.profile
        serializer = MeSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


PHOTO_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
PHOTO_MAX_BYTES = 2 * 1024 * 1024


class MePhotoView(APIView):
    """GET /api/v1/me/photo/ — stream the caller's profile photo (auth-gated;
    private media is never served as an open static file).
    POST /api/v1/me/photo/ — multipart upload; PNG/JPEG/WebP up to 2 MiB.
    DELETE /api/v1/me/photo/ — remove the current photo."""

    permission_classes = [IsActiveAuthenticated]

    @extend_schema(
        responses={(200, "image/*"): OpenApiTypes.BINARY},
        description="Returns the photo bytes (image/png, image/jpeg or "
        "image/webp). 404 when no photo is set.",
    )
    def get(self, request):
        from django.http import FileResponse, Http404

        profile = request.user.profile
        if not profile.photo:
            raise Http404
        return FileResponse(
            profile.photo.open("rb"),
            content_type=profile.photo_content_type or "application/octet-stream",
        )

    @extend_schema(
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {"photo": {"type": "string", "format": "binary"}},
                "required": ["photo"],
            }
        },
        responses={200: MeSerializer},
    )
    def post(self, request):
        import io

        from PIL import Image
        from rest_framework.exceptions import ValidationError

        upload = request.FILES.get("photo")
        if upload is None:
            raise ValidationError({"photo": ["Choose an image file."]})
        if upload.size > PHOTO_MAX_BYTES:
            raise ValidationError(
                {"photo": ["Photo must be smaller than 2 MiB."]}
            )
        if upload.content_type not in PHOTO_MIME_TYPES:
            raise ValidationError(
                {"photo": ["Use a PNG, JPEG, or WebP image."]}
            )
        try:
            # verify() detects truncated/spoofed content; context_type alone
            # is user-controlled and cannot be trusted.
            Image.open(io.BytesIO(upload.read())).verify()
            upload.seek(0)
        except Exception:
            raise ValidationError(
                {"photo": ["That file is not a valid image."]}
            ) from None

        profile = request.user.profile
        profile.photo = upload
        profile.photo_content_type = upload.content_type
        profile.save(update_fields=["photo", "photo_content_type", "updated_at"])
        return Response(MeSerializer(profile).data)

    @extend_schema(responses={200: MeSerializer})
    def delete(self, request):
        profile = request.user.profile
        if profile.photo:
            profile.photo.delete(save=False)
            profile.photo = ""
            profile.photo_content_type = ""
            profile.save(
                update_fields=["photo", "photo_content_type", "updated_at"]
            )
        return Response(MeSerializer(profile).data)
