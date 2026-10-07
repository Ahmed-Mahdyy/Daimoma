import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
} from "../../api/notifications";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";

import { ApiError } from "../../api/client";
import { useLanguage } from "../../app/LanguageProvider";
import { formatDateTime } from "../../lib/dates";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { notificationSummary } from "./notificationText";
import { useState } from "react";

const KIND_OPTIONS = [
  { value: "", label: "All" },
  { value: "request_review", label: "Request reviews" },
  { value: "request_decision", label: "Request decisions" },
  { value: "timesheet_review", label: "Timesheet reviews" },
  { value: "timesheet_decision", label: "Timesheet decisions" },
];

/** Full notification inbox (005): unread/kind filters, per-item and bulk
 * read, and "Open" which resolves the target server-side — the backend
 * rechecks current scope, so following a stale/revoked target returns 404
 * instead of leaking the object. */
export function NotificationsPage() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [followError, setFollowError] = useState<string | null>(null);

  const unread = params.get("unread") ?? "";
  const kind = params.get("kind") ?? "";
  const ordering = params.get("ordering") === "created_at" ? "created_at" : "-created_at";
  const page = Number(params.get("page") ?? 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", "inbox", { unread, kind, ordering, page }],
    queryFn: () =>
      listNotifications(
        (unread || undefined) as "true" | "false" | undefined,
        kind || undefined,
        page,
        ordering,
      ),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["notifications"] });
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
      setFollowError(null);
      readMutation.mutate(id);
      navigate(url);
    },
    onError: (e) => {
      setFollowError(
        e instanceof ApiError && e.status === 404
          ? t("That item is no longer accessible.")
          : t("Could not open the notification target."),
      );
    },
  });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{t("Notifications")}</h1>

      <FilterBar>
        <FilterSelect
          label={t("Status")}
          value={unread}
          onChange={(v) => setFilter("unread", v)}
        >
          <option value="">{t("All")}</option>
          <option value="true">{t("Unread")}</option>
          <option value="false">{t("Read")}</option>
        </FilterSelect>
        <FilterSelect
          label={t("Filter")}
          value={kind}
          onChange={(v) => setFilter("kind", v)}
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={t("Order")}
          value={ordering}
          onChange={(v) => setFilter("ordering", v === "created_at" ? "created_at" : "")}
        >
          <option value="-created_at">{t("Newest first")}</option>
          <option value="created_at">{t("Oldest first")}</option>
        </FilterSelect>
        {(data?.unread_count ?? 0) > 0 && (
          <div className="ms-auto">
            <button
              type="button"
              className="h-10 rounded-xl border px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
              onClick={() => readAllMutation.mutate()}
            >
              {t("Mark all read")}
            </button>
          </div>
        )}
      </FilterBar>

      {followError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {followError}
        </p>
      )}

      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={!!data && data.results.length === 0}
        emptyText={t("No notifications.")}
      >
        <ul className="workspace-panel divide-y px-2">
          {data?.results.map((n) => (
            <li key={n.id} className="flex items-start gap-2 py-1">
              <button
                type="button"
                onClick={() => followMutation.mutate(n.id)}
                className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-brand-500"}`}
                />
                <span className="min-w-0">
                  <span className={n.is_read ? "text-gray-500" : "font-medium"}>
                    {notificationSummary(n, t)}
                  </span>
                  <time className="block text-xs text-gray-400">
                    {formatDateTime(n.created_at)}
                  </time>
                </span>
              </button>
              {!n.is_read && (
                <button
                  type="button"
                  className="workspace-link mt-2 shrink-0 text-xs"
                  onClick={() => readMutation.mutate(n.id)}
                >
                  {t("Mark read")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </AsyncState>
      <PaginationControls
        count={data?.count ?? 0}
        page={page}
        pageSize={25}
        onPage={(p) => {
          const next = new URLSearchParams(params);
          next.set("page", String(p));
          setParams(next);
        }}
      />
    </div>
  );
}
