import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import {
  approveRequest,
  deleteRequest,
  getRequest,
  getRequestHistory,
  rejectRequest,
  returnRequest,
  submitRequest,
  type EmployeeRequest,
} from "../../api/requests";
import { AsyncState } from "../../components/ui/AsyncState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useLanguage } from "../../app/LanguageProvider";
import { useAuth } from "../auth/auth-context";
import { StatusBadge } from "./StatusBadge";

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-300">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-slate-100">{value ?? "—"}</dd>
    </div>
  );
}

function ReasonDialog({
  action,
  onConfirm,
  onCancel,
  busy,
}: {
  action: "reject" | "return";
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const title = action === "reject" ? t("Reject request") : t("Return for correction");
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-title"
        className="w-full max-w-md rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reason-title" className="text-lg font-semibold">
          {title}
        </h2>
        <label htmlFor="reason" className="mt-3 block text-sm font-medium">
          {t("Reason")} <span className="text-red-600">{t("(required)")}</span>
        </label>
        <textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setErr("");
          }}
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          autoFocus
        />
        {err && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {err}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!reason.trim()) {
                setErr(t("A reason is required."));
                return;
              }
              onConfirm(reason.trim());
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
              action === "reject" ? "bg-red-700" : "bg-amber-600"
            }`}
          >
            {busy ? t("Working…") : action === "reject" ? t("Reject") : t("Return")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Request detail (FR-007): status, typed fields, review steps + event
 * timeline, owner submit/resubmit, reviewer approve/reject/return. All
 * mutations send the expected version — a 409 surfaces a conflict message. */
export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<"reject" | "return" | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: req, isLoading, error } = useQuery({
    queryKey: ["request", id],
    queryFn: () => getRequest(id!),
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ["request-history", id],
    queryFn: () => getRequestHistory(id!),
    enabled: !!id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["request", id] });
    queryClient.invalidateQueries({ queryKey: ["request-history", id] });
    queryClient.invalidateQueries({ queryKey: ["requests"] });
  };

  const onError = (e: unknown) => {
    if (e instanceof ApiError) {
      setServerError(
        e.status === 409
          ? t("This request changed since you loaded it — the page has been refreshed.")
          : e.message,
      );
      if (e.status === 409) refresh();
    } else {
      setServerError(t("Something went wrong. Please try again."));
    }
  };

  const submit = useMutation({
    mutationFn: (r: EmployeeRequest) => submitRequest(r.id, r.version),
    onSuccess: () => {
      setServerError(null);
      refresh();
    },
    onError,
  });

  const decide = useMutation({
    mutationFn: async (v: {
      action: "approve" | "reject" | "return";
      reason?: string;
    }) => {
      if (!req) return;
      if (v.action === "approve") return approveRequest(req.id, req.version);
      if (v.action === "reject")
        return rejectRequest(req.id, req.version, v.reason ?? "");
      return returnRequest(req.id, req.version, v.reason ?? "");
    },
    onSuccess: () => {
      setServerError(null);
      setReasonAction(null);
      setConfirmApprove(false);
      refresh();
    },
    onError,
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRequest(id),
    onSuccess: () => {
      setConfirmDelete(false);
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      navigate("/requests");
    },
    onError,
  });

  const isOwner = !!user && !!req && req.employee_email === user.email;
  const isReviewer =
    !!user && !!req?.current_step && req.current_step.reviewer_email === user.email;
  const editable = req && (req.status === "draft" || req.status === "returned");

  return (
    <div className="mx-auto max-w-3xl">
      <AsyncState isLoading={isLoading} error={error} emptyText="">
        {req && (
          <>
            <p className="mb-2 text-sm">
              <Link to="/requests" className="workspace-link-quiet workspace-link-muted">
                <span aria-hidden="true" className="inline-block rtl:-scale-x-100">←</span> {t("Requests")}
              </Link>
            </p>
            <div className="workspace-panel mb-4 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold">{req.title}</h1>
                <p className="mt-1 text-sm text-gray-600">
                  {req.type_name} · {req.employee_name || req.employee_email}
                  {req.cycle > 0 && ` · ${t("cycle {n}", { n: req.cycle })}`}
                </p>
              </div>
              <StatusBadge status={req.status} />
            </div>

            {serverError && (
              <p
                role="alert"
                className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200"
              >
                {serverError}
              </p>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl border bg-white p-5 shadow-sm dark:border-[#4d6970] dark:bg-[#244047] sm:grid-cols-3">
              <Field label={t("Status")} value={<StatusBadge status={req.status} />} />
              <Field
                label={t("Submitted")}
                value={
                  req.submitted_at
                    ? new Date(req.submitted_at).toLocaleString()
                    : t("Not submitted")
                }
              />
              <Field
                label={t("Current reviewer")}
                value={req.current_step?.reviewer_name ?? req.current_step?.reviewer_email ?? "—"}
              />
              {req.start_date && (
                <Field
                  label={req.type_unit === "hour" ? t("Date") : t("Start")}
                  value={req.start_date}
                />
              )}
              {req.end_date && req.end_date !== req.start_date && (
                <Field label={t("End")} value={req.end_date} />
              )}
              {req.start_time && (
                <Field label={t("From")} value={req.start_time.slice(0, 5)} />
              )}
              {req.end_time && (
                <Field label={t("To")} value={req.end_time.slice(0, 5)} />
              )}
              {req.equipment_item && (
                <Field label={t("Item")} value={req.equipment_item} />
              )}
              {req.quantity != null && (
                <Field label={t("Quantity")} value={req.quantity} />
              )}
              {req.hours != null && (
                <Field label={t("Hours")} value={req.hours} />
              )}
              <Field className="col-span-full" label={t("Details")} value={req.description || "—"} />
            </dl>

            {/* Steps */}
            <h2 className="mt-6 text-lg font-semibold">{t("Review steps")}</h2>
            <ul className="mt-2 space-y-2">
              {history?.steps.map((s) => (
                <li
                  key={`${s.cycle}-${s.sequence}`}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm dark:border-[#4d6970] dark:bg-[#244047] dark:text-slate-100"
                >
                  <span>
                    {t("Cycle {n}", { n: s.cycle })} ·{" "}
                    {t(s.required_role === "manager" ? "Manager review" : "HR review")} —{" "}
                    {s.reviewer_name || s.reviewer_email || t("Unassigned")}
                    {s.reason && (
                      <span className="ml-2 text-gray-500">“{s.reason}”</span>
                    )}
                  </span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
              {(!history || history.steps.length === 0) && (
                <li className="text-sm text-gray-500">
                  {t("No review steps yet — submit the request to route it.")}
                </li>
              )}
            </ul>

            {/* Timeline */}
            <h2 className="mt-6 text-lg font-semibold">{t("History")}</h2>
            <ul className="mt-2 space-y-2">
              {history?.events.map((e, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-slate-200 border-s-4 border-s-brand-300 bg-white px-4 py-3 text-sm dark:border-[#4d6970] dark:border-s-brand-300 dark:bg-[#244047] dark:text-slate-100"
                >
                  <span className="font-medium">{t(e.event_type)}</span>
                  {e.actor_name || e.actor_email ? (
                    <span className="text-gray-600">
                      {" "}
                      {t("by")} {e.actor_name || e.actor_email}
                    </span>
                  ) : null}
                  {e.reason && (
                    <span className="text-gray-600"> — “{e.reason}”</span>
                  )}
                  <span className="ml-2 text-xs text-gray-400">
                    {new Date(e.occurred_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            {/* Owner actions */}
            {isOwner && editable && (
              <div className="mt-6 flex items-center gap-3">
                <Link
                  to={`/requests/${req.id}/edit`}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  {t("Edit draft")}
                </Link>
                <button
                  type="button"
                  disabled={submit.isPending}
                  onClick={() => {
                    setServerError(null);
                    submit.mutate(req);
                  }}
                  className="rounded-md bg-brand-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submit.isPending
                    ? t("Submitting…")
                    : req.cycle === 0
                      ? t("Submit for review")
                      : t("Resubmit")}
                </button>
                {req.status === "draft" && (
                  <button
                    type="button"
                    disabled={del.isPending}
                    onClick={() => setConfirmDelete(true)}
                    className="ms-auto inline-flex items-center gap-1.5 rounded-md border border-[#f2c9c2] px-3 py-1.5 text-sm font-semibold text-[#b42318] transition-colors hover:bg-[#fdf2f0] disabled:opacity-60 dark:border-[#d5715b]/30 dark:hover:bg-[#b42318]/15"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t("Delete draft")}
                  </button>
                )}
              </div>
            )}

            {/* Reviewer actions */}
            {isReviewer && req.current_step && (
              <div className="mt-6 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
                <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {t("This request awaits your decision.")}
                </span>
                <div className="ms-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmApprove(true)}
                    className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    {t("Approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReasonAction("return")}
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    {t("Return")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReasonAction("reject")}
                    className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    {t("Reject")}
                  </button>
                </div>
              </div>
            )}

            {reasonAction && (
              <ReasonDialog
                action={reasonAction}
                busy={decide.isPending}
                onConfirm={(reason) =>
                  decide.mutate({ action: reasonAction, reason })
                }
                onCancel={() => setReasonAction(null)}
              />
            )}
            <ConfirmDialog
              open={confirmApprove}
              title={t("Approve request")}
              body={t("Approve “{title}”? This decision is final for this step.", {
                title: req.title,
              })}
              confirmLabel={t("Approve")}
              onConfirm={() => decide.mutate({ action: "approve" })}
              onCancel={() => setConfirmApprove(false)}
            />
            <ConfirmDialog
              open={confirmDelete}
              danger
              title={t("Delete this draft?")}
              body={t("This will permanently delete “{title}”. This cannot be undone.", {
                title: req.title,
              })}
              confirmLabel={t("Delete")}
              onConfirm={() => del.mutate(req.id)}
              onCancel={() => setConfirmDelete(false)}
            />
          </>
        )}
      </AsyncState>
    </div>
  );
}
