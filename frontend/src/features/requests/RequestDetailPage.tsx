import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import {
  approveRequest,
  getRequest,
  getRequestHistory,
  rejectRequest,
  returnRequest,
  submitRequest,
  type EmployeeRequest,
} from "../../api/requests";
import { AsyncState } from "../../components/ui/AsyncState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useAuth } from "../auth/auth-context";
import { StatusBadge } from "./StatusBadge";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value ?? "—"}</dd>
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
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const title = action === "reject" ? "Reject request" : "Return for correction";
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
          Reason <span className="text-red-600">(required)</span>
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
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!reason.trim()) {
                setErr("A reason is required.");
                return;
              }
              onConfirm(reason.trim());
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
              action === "reject" ? "bg-red-700" : "bg-amber-600"
            }`}
          >
            {busy ? "Working…" : action === "reject" ? "Reject" : "Return"}
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<"reject" | "return" | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);

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
          ? "This request changed since you loaded it — the page has been refreshed."
          : e.message,
      );
      if (e.status === 409) refresh();
    } else {
      setServerError("Something went wrong. Please try again.");
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

  const isOwner = !!user && !!req && req.employee_email === user.email;
  const isReviewer =
    !!user && !!req?.current_step && req.current_step.reviewer_email === user.email;
  const editable = req && (req.status === "draft" || req.status === "returned");

  return (
    <div className="mx-auto max-w-3xl">
      <AsyncState isLoading={isLoading} error={error} emptyText="">
        {req && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <Link to="/requests" className="text-sm text-gray-600 hover:underline">
                ← Requests
              </Link>
              <StatusBadge status={req.status} />
            </div>
            <h1 className="text-2xl font-semibold">{req.title}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {req.type_name} · {req.employee_name || req.employee_email}
              {req.cycle > 0 && ` · cycle ${req.cycle}`}
            </p>

            {serverError && (
              <p
                role="alert"
                className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700"
              >
                {serverError}
              </p>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-4 rounded-md border bg-white p-4 sm:grid-cols-3">
              <Field label="Status" value={<StatusBadge status={req.status} />} />
              <Field
                label="Submitted"
                value={
                  req.submitted_at
                    ? new Date(req.submitted_at).toLocaleString()
                    : "Not submitted"
                }
              />
              <Field
                label="Current reviewer"
                value={req.current_step?.reviewer_name ?? req.current_step?.reviewer_email ?? "—"}
              />
              {req.start_date && (
                <Field label="Start" value={req.start_date} />
              )}
              {req.end_date && <Field label="End" value={req.end_date} />}
              {req.equipment_item && (
                <Field label="Item" value={req.equipment_item} />
              )}
              {req.quantity != null && (
                <Field label="Quantity" value={req.quantity} />
              )}
              <div className="col-span-full">
                <Field label="Details" value={req.description || "—"} />
              </div>
            </dl>

            {/* Steps */}
            <h2 className="mt-6 text-lg font-semibold">Review steps</h2>
            <ul className="mt-2 space-y-2">
              {history?.steps.map((s) => (
                <li
                  key={`${s.cycle}-${s.sequence}`}
                  className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm"
                >
                  <span>
                    Cycle {s.cycle} ·{" "}
                    {s.required_role === "manager" ? "Manager" : "HR"} review —{" "}
                    {s.reviewer_name || s.reviewer_email || "Unassigned"}
                    {s.reason && (
                      <span className="ml-2 text-gray-500">“{s.reason}”</span>
                    )}
                  </span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
              {(!history || history.steps.length === 0) && (
                <li className="text-sm text-gray-500">
                  No review steps yet — submit the request to route it.
                </li>
              )}
            </ul>

            {/* Timeline */}
            <h2 className="mt-6 text-lg font-semibold">History</h2>
            <ul className="mt-2 space-y-2">
              {history?.events.map((e, i) => (
                <li
                  key={i}
                  className="rounded-md border-l-4 border-brand-300 bg-white px-3 py-2 text-sm"
                >
                  <span className="font-medium">{e.event_type}</span>
                  {e.actor_name || e.actor_email ? (
                    <span className="text-gray-600">
                      {" "}
                      by {e.actor_name || e.actor_email}
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
                  Edit draft
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
                    ? "Submitting…"
                    : req.cycle === 0
                      ? "Submit for review"
                      : "Resubmit"}
                </button>
              </div>
            )}

            {/* Reviewer actions */}
            {isReviewer && req.current_step && (
              <div className="mt-6 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <span className="text-sm font-medium text-amber-900">
                  This request awaits your decision.
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmApprove(true)}
                    className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setReasonAction("return")}
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Return
                  </button>
                  <button
                    type="button"
                    onClick={() => setReasonAction("reject")}
                    className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Reject
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
              title="Approve request"
              body={`Approve “${req.title}”${
                req.current_step?.required_role === "manager" &&
                req.type_name
                  ? ""
                  : ""
              }? This decision is final for this step.`}
              confirmLabel="Approve"
              onConfirm={() => decide.mutate({ action: "approve" })}
              onCancel={() => setConfirmApprove(false)}
            />
          </>
        )}
      </AsyncState>
    </div>
  );
}
