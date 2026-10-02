from django.urls import path

from apps.employee_requests.views import (
    RequestApproveView,
    RequestDetailView,
    RequestHistoryView,
    RequestListView,
    RequestRejectView,
    RequestReturnView,
    RequestSubmitView,
    RequestTypeDetailView,
    RequestTypeListView,
)

urlpatterns = [
    path("requests/", RequestListView.as_view()),
    path("requests/<uuid:pk>/", RequestDetailView.as_view()),
    path("requests/<uuid:pk>/submit/", RequestSubmitView.as_view()),
    path("requests/<uuid:pk>/approve/", RequestApproveView.as_view()),
    path("requests/<uuid:pk>/reject/", RequestRejectView.as_view()),
    path("requests/<uuid:pk>/return/", RequestReturnView.as_view()),
    path("requests/<uuid:pk>/history/", RequestHistoryView.as_view()),
    path("request-types/", RequestTypeListView.as_view()),
    path("request-types/<uuid:pk>/", RequestTypeDetailView.as_view()),
]
