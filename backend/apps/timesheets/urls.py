# Copyright (c) 2026 CDS Solutions SRL. (http://cdsegypt.com)
# Maintainer: Eng.Ramadan Khalil (<ramadan.khalil@cdsegypt.com>),
#             Eng.Ahmed Mahdy (<ahmed.mahdy@cdsegypt.com>)
# It is forbidden to publish, distribute, sublicense, or sell copies
# of the Software or modified copies of the Software.
from django.urls import path

from apps.timesheets import views

urlpatterns = [
    path("timesheets/", views.TimesheetListView.as_view()),
    path("timesheets/<uuid:pk>/", views.TimesheetDetailView.as_view()),
    path("timesheets/<uuid:pk>/entries/", views.EntryListView.as_view()),
    path(
        "timesheets/<uuid:pk>/entries/<uuid:entry_pk>/",
        views.EntryDetailView.as_view(),
    ),
    path(
        "timesheets/<uuid:pk>/entries/<uuid:entry_pk>/void/",
        views.EntryVoidView.as_view(),
    ),
    path(
        "timesheets/<uuid:pk>/days/<str:work_date>/submit/",
        views.DaySubmitView.as_view(),
    ),
    path("timesheets/<uuid:pk>/submit/", views.SheetSubmitView.as_view()),
    path("timesheets/<uuid:pk>/approve/", views.SheetApproveView.as_view()),
    path("timesheets/<uuid:pk>/reject/", views.SheetRejectView.as_view()),
    path("timesheets/<uuid:pk>/return/", views.SheetReturnView.as_view()),
    path("timesheets/<uuid:pk>/reopen/", views.SheetReopenView.as_view()),
    path("timesheets/<uuid:pk>/history/", views.SheetHistoryView.as_view()),
]
