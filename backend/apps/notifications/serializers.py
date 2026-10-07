from rest_framework import serializers

from apps.notifications.models import Notification

_REQUEST_REVIEW_SUFFIX = " awaits your review."
_REQUEST_DECISION_KEYS = {
    " was approved.": "notification.requestApproved",
    " was rejected.": "notification.requestRejected",
    " was returned for correction.": "notification.requestReturned",
}
_TIMESHEET_REVIEW_PREFIX = "Timesheet "
_TIMESHEET_REVIEW_SUFFIX = " awaits your review."
_TIMESHEET_DECISION_PREFIX = "Your timesheet for "
_TIMESHEET_DECISION_KEYS = {
    " was approved.": "notification.timesheetApproved",
    " was rejected.": "notification.timesheetRejected",
}
_STATIC_MESSAGE_KEYS = {
    "Your account was reactivated by HR.": "notification.accountReactivated",
    "A timesheet passed manager review and needs HR approval.": ("notification.timesheetHrReview"),
    "Your timesheet was returned for correction.": "notification.timesheetReturned",
    "Your timesheet was reopened for correction by HR.": "notification.timesheetReopened",
    "A pending timesheet was reassigned to you.": "notification.timesheetReassigned",
}


def _message_parts(notification: Notification) -> tuple[str, dict[str, str]]:
    """Return a stable i18n key + safe params for stored English summaries.

    Notifications are durable records, so the stored summary remains the
    English fallback while this derived metadata lets the UI localize rows
    emitted before structured presentation data existed."""
    summary = notification.summary
    if notification.kind == "request_review" and summary.endswith(_REQUEST_REVIEW_SUFFIX):
        return "notification.requestReview", {"title": summary[: -len(_REQUEST_REVIEW_SUFFIX)]}
    if notification.kind == "request_decision":
        for suffix, key in _REQUEST_DECISION_KEYS.items():
            if summary.endswith(suffix):
                return key, {"title": summary[: -len(suffix)]}
    if notification.kind == "timesheet_review":
        if summary.startswith(_TIMESHEET_REVIEW_PREFIX) and summary.endswith(
            _TIMESHEET_REVIEW_SUFFIX
        ):
            period = summary[len(_TIMESHEET_REVIEW_PREFIX) : -len(_TIMESHEET_REVIEW_SUFFIX)]
            return "notification.timesheetReview", {"period": period}
    elif notification.kind == "timesheet_decision":
        if summary.startswith(_TIMESHEET_DECISION_PREFIX):
            for suffix, key in _TIMESHEET_DECISION_KEYS.items():
                if summary.endswith(suffix):
                    date = summary[len(_TIMESHEET_DECISION_PREFIX) : -len(suffix)]
                    return key, {"date": date}
    if key := _STATIC_MESSAGE_KEYS.get(summary):
        return key, {}
    return "", {}


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(read_only=True)
    summary_key = serializers.SerializerMethodField()
    summary_params = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "event_key",
            "kind",
            "summary",
            "summary_key",
            "summary_params",
            "target_type",
            "target_id",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_summary_key(self, obj: Notification) -> str:
        return _message_parts(obj)[0]

    def get_summary_params(self, obj: Notification) -> dict[str, str]:
        return _message_parts(obj)[1]
