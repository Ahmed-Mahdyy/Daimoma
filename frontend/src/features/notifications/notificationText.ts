import type { NotificationRow } from "../../api/notifications";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export function notificationSummary(
  notification: Pick<NotificationRow, "summary" | "summary_key" | "summary_params">,
  t: Translate,
) {
  if (!notification.summary_key) return notification.summary;
  const translated = t(notification.summary_key, notification.summary_params);
  return translated === notification.summary_key
    ? notification.summary
    : translated;
}
