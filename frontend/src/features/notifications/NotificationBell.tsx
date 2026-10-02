import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "../../api/client";
import { useLanguage } from "../../app/LanguageProvider";
import { formatDateTime } from "../../lib/dates";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
} from "../../api/notifications";

/** Notification bell with unread badge + dropdown list. The badge polls the
 * cheap unread-count endpoint every 60s (D-009) and pauses while the tab is
 * hidden; the full list only fetches when the dropdown opens. Clicking an
 * item resolves its target server-side and navigates to the exact record. */
export function NotificationBell() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: count } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 60_000, // pauses when the tab is hidden (default behavior)
  });

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    enabled: open,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });
  const followMutation = useMutation({
    mutationFn: resolveNotificationTarget,
    onSuccess: ({ url }, id) => {
      setError(null);
      setOpen(false);
      readMutation.mutate(id);
      navigate(url);
    },
    onError: (e) => {
      setError(
        e instanceof ApiError && e.status === 404
          ? t("That item is no longer accessible.")
          : t("Could not open the notification."),
      );
    },
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = count?.unread_count ?? 0;
  const items = data?.results ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("Notifications, {count} unread", { count: unread })}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg border border-transparent p-2 text-slate-600 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-slate-500/60 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-80 rounded-lg border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">{t("Notifications")}</span>
            {unread > 0 && (
              <button
                type="button"
                aria-label={t("Mark all read")}
                title={t("Mark all read")}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => readAllMutation.mutate()}
              >
                <CheckCheck className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto p-1">
            {items.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">{t("No notifications.")}</li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-1 border-b px-1 py-1 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => followMutation.mutate(n.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1.5 py-1.5 text-start text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-brand-500"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        n.is_read ? "text-muted-foreground" : "font-medium"
                      }
                    >
                      {n.summary}
                    </span>
                    <time className="block text-xs text-muted-foreground">
                      {formatDateTime(n.created_at)}
                    </time>
                  </span>
                </button>
                {!n.is_read && (
                  <button
                    type="button"
                    aria-label={t("Mark read")}
                    title={t("Mark read")}
                    className="mt-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={() => readMutation.mutate(n.id)}
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="border-t px-3 py-2 text-center">
            <Link
              to="/notifications"
              className="workspace-link text-xs"
              onClick={() => setOpen(false)}
            >
              {t("View all notifications")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
