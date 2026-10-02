from django.urls import path

from apps.reporting.views import (
    OrganizationDashboardView,
    PersonalDashboardView,
    RequestsExportView,
    RequestsReportView,
    TeamDashboardView,
    WorkingHoursExportView,
    WorkingHoursReportView,
)

urlpatterns = [
    path("dashboards/personal/", PersonalDashboardView.as_view()),
    path("dashboards/team/", TeamDashboardView.as_view()),
    path("dashboards/organization/", OrganizationDashboardView.as_view()),
    path("reports/working-hours/", WorkingHoursReportView.as_view()),
    path("reports/working-hours/export/", WorkingHoursExportView.as_view()),
    path("reports/requests/", RequestsReportView.as_view()),
    path("reports/requests/export/", RequestsExportView.as_view()),
]
