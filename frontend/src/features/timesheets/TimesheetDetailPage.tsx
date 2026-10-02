import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import {
  approveTimesheet,
  createEntry,
  getTimesheet,
  getTimesheetHistory,
  rejectTimesheet,
  reopenTimesheet,
  returnTimesheet,
  submitDay,
  submitTimesheet,
  updateEntry,
  voidEntry,
  type TimeEntry,
  type Timesheet,
  type WorkDay,
} from "../../api/timesheets";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useAuth } from "../../features/auth/auth-context";
import {
  formatMinutes,
  formatTimeInZone,
  localDate,
  zonedToUtc,
} from "./timezone";
import { DayStatusBadge, TimesheetStatusBadge } from "./TimesheetStatusBadge";

const EDITABLE_SHEETS = new Set(["collecting", "returned"]);
const EDITABLE_DAYS = new Set(["draft", "returned"]);

function fieldErr(e: ApiError, key: string): string | null {
  const v = e.fieldErrors?.[key];
  if (v == null) return null;
  return Array.isArray(v) ? String(v[0]) : String(v);
}

/** Number of local-day segments an interval spans (1 = same day). */
function segmentCount(startLocal: string, endLocal: string): number {
  const [sy, sm, sd] = localDate(startLocal).split("-").map(Number);
  const [ey, em, ed] = localDate(endLocal).split("-").map(Number);
  const days =
    (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000;
  return Math.max(1, Math.round(days) + 1);
}

function EntryDialog({
  sheet,
  entry,
  defaultDate,
  onClose,
  onSaved,
}: {
  sheet: Timesheet;
  entry: TimeEntry | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = entry !== null;
  const [workDate] = useState(entry?.work_date ?? defaultDate);
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: sheet.timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
  };
  const [start, setStart] = useState(
    entry ? toLocal(entry.start_at) : `${workDate}T09:00`,
  );
  const [end, setEnd] = useState(
    entry ? toLocal(entry.end_at) : `${workDate}T17:00`,
  );
  const [breakMin, setBreakMin] = useState(
    entry ? String(entry.break_minutes) : "0",
  );
  const [description, setDescription] = useState(entry?.description ?? "");
  const [windowReason, setWindowReason] = useState(entry?.window_reason ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const save = useMutation<TimeEntry[] | TimeEntry>({
    mutationFn: () => {
      const startAt = zonedToUtc(sheet.timezone, start);
      const endAt = zonedToUtc(sheet.timezone, end);
      const body = {
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        description,
        window_reason: windowReason,
      };
      if (isEdit) {
        return updateEntry(sheet.id, entry.id, {
          ...body,
          break_minutes: Number(breakMin) || 0,
        });
      }
      const n = segmentCount(start, end);
      return createEntry(sheet.id, {
        ...body,
        work_date: workDate,
        segment_breaks:
          n > 1 ? [Number(breakMin) || 0, ...Array(n - 1).fill(0)] : undefined,
        break_minutes: n > 1 ? undefined : Number(breakMin) || 0,
      });
    },
    onSuccess: () => {
      setFormError(null);
      onSaved();
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const fe: Record<string, string> = {};
        for (const k of [
          "start_at",
          "end_at",
          "break_minutes",
          "segment_breaks",
          "window_reason",
          "work_date",
          "description",
        ]) {
          const m = fieldErr(e, k);
          if (m) fe[k] = m;
        }
        setFieldErrors(fe);
        setFormError(Object.keys(fe).length ? null : e.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    },
  });

  const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
  const err = (k: string) =>
    fieldErrors[k] ? (
      <p role="alert" className="mt-1 text-sm text-red-700">
        {fieldErrors[k]}
      </p>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
        className="w-full max-w-md rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="entry-title" className="text-lg font-semibold">
          {isEdit ? "Edit entry" : "Add entry"} — {workDate}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Times are entered in {sheet.timezone} and stored in UTC.
        </p>
        {formError && (
          <div className="mt-3">
            <Alert kind="error">{formError}</Alert>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Start
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={input}
            />
            {err("start_at")}
          </label>
          <label className="block text-sm font-medium">
            End
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={input}
            />
            {err("end_at")}
          </label>
          <label className="block text-sm font-medium">
            Break (minutes)
            <input
              type="number"
              min={0}
              value={breakMin}
              onChange={(e) => setBreakMin(e.target.value)}
              className={input}
            />
            {err("break_minutes")}
            {err("segment_breaks")}
          </label>
          <label className="block text-sm font-medium">
            Window reason
            <input
              type="text"
              value={windowReason}
              onChange={(e) => setWindowReason(e.target.value)}
              placeholder="Required if outside working window"
              className={input}
            />
            {err("window_reason")}
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium">
          Description
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={input}
          />
          {err("description")}
        </label>
        {localDate(start) !== localDate(end) && (
          <p className="mt-2 text-xs text-amber-700">
            This interval crosses midnight — it will be split across days.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : isEdit ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonDialog({
  title,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
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
        <label htmlFor="ts-reason" className="mt-3 block text-sm font-medium">
          Reason <span className="text-red-600">(required)</span>
        </label>
        <textarea
          id="ts-reason"
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
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Working…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ReasonAction = "reject" | "return" | "reopen";

/** Week editor + review surface (FR-001..FR-008): day rows with entries,
 * daily submission, weekly submit, reviewer decisions, HR reopen, history.
 * Mutations send expected_version — 409 refreshes rather than guessing. */
export function TimesheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [entryDialog, setEntryDialog] = useState<{
    entry: TimeEntry | null;
    date: string;
  } | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [voidTarget, setVoidTarget] = useState<TimeEntry | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: sheet, isLoading, error } = useQuery({
    queryKey: ["timesheet", id],
    queryFn: () => getTimesheet(id!),
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ["timesheet-history", id],
    queryFn: () => getTimesheetHistory(id!),
    enabled: !!id && showHistory,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["timesheet", id] });
    queryClient.invalidateQueries({ queryKey: ["timesheet-history", id] });
    queryClient.invalidateQueries({ queryKey: ["timesheets"] });
  };

  const onError = (e: unknown) => {
    if (e instanceof ApiError) {
      setServerError(
        e.status === 409
          ? "This timesheet changed since you loaded it — the page has been refreshed."
          : e.message,
      );
      if (e.status === 409) refresh();
    } else {
      setServerError("Something went wrong. Please try again.");
    }
  };

  const act = useMutation({
    mutationFn: async (v: {
      kind: "submit-day" | "submit" | "approve" | "reject" | "return" | "reopen" | "void";
      date?: string;
      entry?: TimeEntry;
      reason?: string;
    }) => {
      if (!sheet) return;
      switch (v.kind) {
        case "submit-day":
          return submitDay(sheet.id, v.date!);
        case "submit":
          return submitTimesheet(sheet.id, sheet.version);
        case "approve":
          return approveTimesheet(sheet.id, sheet.version);
        case "reject":
          return rejectTimesheet(sheet.id, sheet.version, v.reason ?? "");
        case "return":
          return returnTimesheet(sheet.id, sheet.version, v.reason ?? "");
        case "reopen":
          return reopenTimesheet(sheet.id, sheet.version, v.reason ?? "");
        case "void":
          return voidEntry(sheet.id, v.entry!.id);
      }
    },
    onSuccess: () => {
      setServerError(null);
      refresh();
    },
    onError,
  });

  const daysByDate = useMemo(() => {
    const map = new Map<string, WorkDay>();
    for (const d of sheet?.days ?? []) map.set(d.work_date, d);
    return map;
  }, [sheet]);

  const weekDates = useMemo(() => {
    if (!sheet) return [];
    const out: string[] = [];
    const d0 = new Date(`${sheet.period_start}T00:00:00Z`);
    for (let i = 0; i < 7; i++) {
      out.push(new Date(d0.getTime() + i * 86_400_000).toISOString().slice(0, 10));
    }
    return out;
  }, [sheet]);

  if (!sheet) {
    return <AsyncState isLoading={isLoading} error={error}>{null}</AsyncState>;
  }

  const isOwner = !!user && sheet.employee_email === user.email;
  const isHr = !!user?.roles.includes("HR");
  const isReviewer =
    !!user && sheet.reviewer_email === user.email &&
    (sheet.status === "pending_manager" || sheet.status === "pending_hr");
  const sheetEditable = isOwner && EDITABLE_SHEETS.has(sheet.status);
  const submittedDays = sheet.days.filter((d) =>
    ["submitted", "approved"].includes(d.status),
  ).length;
  const draftWithEntries = sheet.days.filter(
    (d) => d.status === "draft" && d.entries.some((e) => !e.voided_at),
  ).length;

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link to="/timesheets" className="text-brand-700 hover:underline">
          ← Timesheets
        </Link>
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Week {sheet.period_start} – {sheet.period_end}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {sheet.employee_name || sheet.employee_email} ·{" "}
            {sheet.timezone} · cycle {sheet.cycle} · total{" "}
            {formatMinutes(sheet.total_minutes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimesheetStatusBadge status={sheet.status} />
          {(sheet.status === "pending_manager" ||
            sheet.status === "pending_hr") && (
            <span className="text-sm text-gray-600">
              reviewer: {sheet.reviewer_name ?? sheet.reviewer_email}
            </span>
          )}
        </div>
      </div>

      {serverError && (
        <div className="mt-3">
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {weekDates.map((d) => {
          const day = daysByDate.get(d);
          const dayEditable =
            sheetEditable &&
            (!day || EDITABLE_DAYS.has(day.status));
          const activeEntries =
            day?.entries.filter((e) => !e.voided_at) ?? [];
          const canSubmitDay =
            sheetEditable &&
            day &&
            EDITABLE_DAYS.has(day.status) &&
            activeEntries.length > 0;
          return (
            <section
              key={d}
              className="rounded-md border bg-white p-4"
              aria-label={`Day ${d}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{d}</h2>
                  {day && <DayStatusBadge status={day.status} />}
                  <span className="text-sm text-gray-500">
                    {day ? formatMinutes(day.total_minutes) : "0h 00m"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {dayEditable && (
                    <button
                      type="button"
                      onClick={() =>
                        setEntryDialog({ entry: null, date: d })
                      }
                      className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Add entry
                    </button>
                  )}
                  {canSubmitDay && (
                    <button
                      type="button"
                      onClick={() =>
                        act.mutate({ kind: "submit-day", date: d })
                      }
                      disabled={act.isPending}
                      className="rounded-md bg-brand-700 px-2 py-1 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Submit day
                    </button>
                  )}
                </div>
              </div>
              {activeEntries.length > 0 && (
                <ul className="mt-2 divide-y divide-gray-100">
                  {day!.entries.map((e) => (
                    <li
                      key={e.id}
                      className={`flex flex-wrap items-center gap-3 py-2 text-sm ${
                        e.voided_at ? "text-gray-400 line-through" : ""
                      }`}
                    >
                      <span className="font-mono">
                        {formatTimeInZone(e.start_at, sheet.timezone)}–
                        {formatTimeInZone(e.end_at, sheet.timezone)}
                      </span>
                      <span>{formatMinutes(e.duration_minutes)}</span>
                      {e.break_minutes > 0 && (
                        <span className="text-gray-500">
                          break {e.break_minutes}m
                        </span>
                      )}
                      {e.window_flag && (
                        <span
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                          title={e.window_reason}
                        >
                          outside window
                        </span>
                      )}
                      {e.description && (
                        <span className="text-gray-600">{e.description}</span>
                      )}
                      {dayEditable && !e.voided_at && (
                        <span className="ms-auto flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEntryDialog({ entry: e, date: d })
                            }
                            className="text-brand-700 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setVoidTarget(e)}
                            className="text-red-700 hover:underline"
                          >
                            Void
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {sheetEditable && (
          <button
            type="button"
            onClick={() => setConfirmSubmit(true)}
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white"
          >
            Submit week
          </button>
        )}
        {isReviewer && (
          <>
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
          </>
        )}
        {isHr && (sheet.status === "approved" || sheet.status === "rejected") && (
          <button
            type="button"
            onClick={() => setReasonAction("reopen")}
            className="rounded-md border border-amber-600 px-3 py-1.5 text-sm font-medium text-amber-700"
          >
            Reopen
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          {showHistory ? "Hide history" : "History"}
        </button>
      </div>
      {sheetEditable && (
        <p className="mt-2 text-xs text-gray-500">
          Submitting the week requires at least one submitted day
          {draftWithEntries > 0
            ? ` — ${draftWithEntries} day(s) still hold unsubmitted entries.`
            : submittedDays === 0
              ? "."
              : ` (${submittedDays} submitted).`}
        </p>
      )}

      {showHistory && history && (
        <section className="mt-4 rounded-md border bg-white p-4" aria-label="History">
          <h2 className="font-medium">History</h2>
          <ol className="mt-2 space-y-2 text-sm">
            {history.map((ev, i) => (
              <li key={i} className="flex flex-wrap gap-2">
                <span className="text-gray-500">
                  {new Date(ev.occurred_at).toLocaleString()}
                </span>
                <span className="font-medium">{ev.event_type}</span>
                {ev.actor_name && <span>by {ev.actor_name}</span>}
                <span className="text-gray-500">
                  {ev.previous_state} → {ev.new_state} (cycle {ev.cycle})
                </span>
                {ev.reason && (
                  <span className="text-gray-600">“{ev.reason}”</span>
                )}
              </li>
            ))}
            {history.length === 0 && (
              <li className="text-gray-500">No events yet.</li>
            )}
          </ol>
        </section>
      )}

      {entryDialog && (
        <EntryDialog
          sheet={sheet}
          entry={entryDialog.entry}
          defaultDate={entryDialog.date}
          onClose={() => setEntryDialog(null)}
          onSaved={refresh}
        />
      )}

      {reasonAction && (
        <ReasonDialog
          title={
            reasonAction === "reject"
              ? "Reject timesheet"
              : reasonAction === "return"
                ? "Return week for correction"
                : "Reopen timesheet"
          }
          busy={act.isPending}
          onCancel={() => setReasonAction(null)}
          onConfirm={(reason) =>
            act.mutate(
              { kind: reasonAction, reason },
              { onSuccess: () => setReasonAction(null) },
            )
          }
        />
      )}

      {confirmApprove && (
        <ConfirmDialog
          open
          title="Approve timesheet"
          body={`Approve this week (${formatMinutes(sheet.total_minutes)})${
            sheet.status === "pending_manager"
              ? "? It will move to HR review."
              : "?"
          }`}
          confirmLabel="Approve"
          onConfirm={() =>
            act.mutate(
              { kind: "approve" },
              { onSuccess: () => setConfirmApprove(false) },
            )
          }
          onCancel={() => setConfirmApprove(false)}
        />
      )}

      {confirmSubmit && (
        <ConfirmDialog
          open
          title="Submit week"
          body={`Submit this week for review? ${submittedDays} day(s) submitted, ${formatMinutes(sheet.total_minutes)} total.`}
          confirmLabel="Submit"
          onConfirm={() =>
            act.mutate(
              { kind: "submit" },
              { onSuccess: () => setConfirmSubmit(false) },
            )
          }
          onCancel={() => setConfirmSubmit(false)}
        />
      )}

      {voidTarget && (
        <ConfirmDialog
          open
          danger
          title="Void entry"
          body={`Void the ${formatTimeInZone(voidTarget.start_at, sheet.timezone)}–${formatTimeInZone(voidTarget.end_at, sheet.timezone)} entry? It stays in history but no longer counts toward totals.`}
          confirmLabel="Void"
          onConfirm={() =>
            act.mutate(
              { kind: "void", entry: voidTarget },
              { onSuccess: () => setVoidTarget(null) },
            )
          }
          onCancel={() => setVoidTarget(null)}
        />
      )}
    </div>
  );
}
