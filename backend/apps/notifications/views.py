from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.pagination import DefaultPagination
from apps.accounts.permissions import IsActiveAuthenticated
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import mark_all_read, mark_read

PagedNotifications = inline_serializer(
    name="PagedNotifications",
    fields={
        "count": drf_serializers.IntegerField(),
        "next": drf_serializers.URLField(allow_null=True),
        "previous": drf_serializers.URLField(allow_null=True),
        "unread_count": drf_serializers.IntegerField(),
        "results": NotificationSerializer(many=True),
    },
)
DetailSerializer = inline_serializer(
    name="NotificationDetail", fields={"detail": drf_serializers.CharField()}
)


class NotificationListView(APIView):
    """GET /api/v1/notifications/ — recipient-only, paginated, `?unread=true`
    filter; the envelope always carries `unread_count` for the bell."""

    permission_classes = [IsActiveAuthenticated]
    http_method_names = ["get", "head", "options"]

    @extend_schema(responses={200: PagedNotifications}, operation_id="notifications_list")
    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user)
        if request.query_params.get("unread") == "true":
            qs = qs.filter(read_at__isnull=True)
        unread = Notification.objects.filter(recipient=request.user, read_at__isnull=True).count()
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        data = paginator.get_paginated_response(NotificationSerializer(page, many=True).data).data
        data["unread_count"] = unread
        return Response(data)


class NotificationReadView(APIView):
    """POST /api/v1/notifications/{id}/read/ — recipient-only; others' ids
    are 404 (non-enumerating). Idempotent."""

    permission_classes = [IsActiveAuthenticated]

    @extend_schema(request=None, responses={200: NotificationSerializer})
    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            raise NotFound from None
        mark_read(notification)
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    """POST /api/v1/notifications/read-all/ — marks every unread row for the
    caller; never touches other recipients."""

    permission_classes = [IsActiveAuthenticated]

    @extend_schema(request=None, responses={200: DetailSerializer})
    def post(self, request):
        count = mark_all_read(request.user)
        return Response({"detail": f"{count} notifications marked read."})
