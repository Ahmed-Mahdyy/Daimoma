from django.urls import path

from apps.organizations.views import (
    DepartmentDetailView,
    DepartmentListView,
    EmployeeDeactivateView,
    EmployeeDetailView,
    EmployeeListView,
    EmployeeReactivateView,
    EmployeeResendInvitationView,
    ManagerChoicesView,
    OrgSettingsView,
)

urlpatterns = [
    path("employees/", EmployeeListView.as_view()),
    path("employees/<uuid:pk>/", EmployeeDetailView.as_view()),
    path("employees/<uuid:pk>/deactivate/", EmployeeDeactivateView.as_view()),
    path("employees/<uuid:pk>/reactivate/", EmployeeReactivateView.as_view()),
    path(
        "employees/<uuid:pk>/resend-invitation/",
        EmployeeResendInvitationView.as_view(),
    ),
    path("departments/", DepartmentListView.as_view()),
    path("choices/managers/", ManagerChoicesView.as_view()),
    path("departments/<uuid:pk>/", DepartmentDetailView.as_view()),
    path("organization/settings/", OrgSettingsView.as_view()),
]
