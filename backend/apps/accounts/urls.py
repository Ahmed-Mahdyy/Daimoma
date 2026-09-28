from django.urls import path

from apps.accounts.views import (
    CsrfBootstrapView,
    InvitationAcceptView,
    LoginView,
    LogoutView,
    MePasswordView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
)

urlpatterns = [
    path("auth/csrf/", CsrfBootstrapView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("auth/invitations/accept/", InvitationAcceptView.as_view()),
    path("auth/password-reset/", PasswordResetRequestView.as_view()),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("me/", MeView.as_view()),
    path("me/password/", MePasswordView.as_view()),
]
