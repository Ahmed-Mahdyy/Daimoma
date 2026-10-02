from django.urls import path

from apps.notifications.views import (
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
    NotificationTargetView,
    UnreadCountView,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view()),
    path("notifications/unread-count/", UnreadCountView.as_view()),
    path("notifications/read-all/", NotificationReadAllView.as_view()),
    path("notifications/<uuid:pk>/read/", NotificationReadView.as_view()),
    path("notifications/<uuid:pk>/target/", NotificationTargetView.as_view()),
]
