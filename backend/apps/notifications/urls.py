from django.urls import path

from apps.notifications.views import (
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view()),
    path("notifications/read-all/", NotificationReadAllView.as_view()),
    path("notifications/<uuid:pk>/read/", NotificationReadView.as_view()),
]
