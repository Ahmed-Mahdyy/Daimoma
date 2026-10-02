import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
} from "../../api/notifications";
import { ApiError } from "../../api/client";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { useState } from "react";

const KIND_OPTIONS = [
  { value: "", label: "All kinds" },
  { value: "request_review", label: "Request reviews" },
  { value: "request_decision", label: "Request decisions" },
  { value: "timesheet_review", label: "Timesheet reviews" },
  { value: "timesheet_decision", label: "Timesheet decisions" },
  { value: "account_reactivated", label: "Account" },
];

/** Full notification inbox (005): unread/kind filters, per-item and bulk
 * read, and "Open" which resolves the target server-side — the backend
 * rechecks current scope, so following a stale/revoked target returns 404
 * instead of leaking the object. */
export function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [followError, setFollowError] = useState<string | null>(null);

  const unreadOnly = params.get("unread") === "true";
  const kind = params.get("kind") ?? "";
  const page = Number(params.get("page") ?? 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", "inbox", { unreadOnly, kind, page }],
    queryFn: () => listNotifications(unreadOnly, kind || undefined, page),
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
          ? "That item is no longer accessible."
          : "Could not open the notification target.",
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
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) =>
                setFilter("unread", e.target.checked ? "true" : "")
              }
            />
            Unread only
          </label>
          <select
            aria-label="Kind"
            className="rounded-md border px-2 py-1.5 text-sm"
            value={kind}
            onChange={(e) => setFilter("kind", e.target.value)}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {(data?.unread_count ?? 0) > 0 && (
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100"
              onClick={() => readAllMutation.mutate()}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {followError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {followError}
        </p>
      )}

      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={!!data && data.results.length === 0}
        emptyText="No notifications."
      >
        <ul className="mt-3 divide-y">
          {data?.results.map((n) => (
            <li
              key={n.id}
              className={`flex items-start justify-between gap-3 py-3 text-sm ${
                n.is_read ? "text-gray-500" : "font-medium"
              }`}
            >
              <div>
                <p>{n.summary}</p>
                <time className="text-xs text-gray-400">
                  {new Date(n.created_at).toLocaleString()}
                </time>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="text-xs text-brand-700 underline"
                  onClick={() => followMutation.mutate(n.id)}
                >
                  Open
                </button>
                {!n.is_read && (
                  <button
                    type="button"
                    className="text-xs text-brand-700 underline"
                    onClick={() => readMutation.mutate(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
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
