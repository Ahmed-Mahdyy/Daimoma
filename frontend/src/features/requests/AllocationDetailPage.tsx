import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageCrumbs } from "@/components/ui/page-header";
import { RangeInput } from "@/components/ui/range-input";
import { ApiError, apiErrorMessage } from "../../api/client";
import {
  adjustAllocation,
  ALLOCATION_UNIT_LABELS as UNIT_LABELS,
  editAllocationDates,
  formatAllocationAmount,
  getAllocation,
  getAllocationHistory,
  hoursToAmount,
  removeAllocation,
  type AllocationGrant,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatDate, formatDateTime } from "../../lib/dates";

const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** Dedicated allocation record page: dated grant summary, audited date
 * edits, signed adjustments, remove-from-active-use, and full history.
 * Replaces the inline manager panel so long allocation lists stay usable. */
export function AllocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: grant, isLoading, error } = useQuery({
    queryKey: ["allocation", id],
    queryFn: () => getAllocation(id!),
    enabled: Boolean(id),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["allocations"] });
    void queryClient.invalidateQueries({ queryKey: ["allocation", id] });
    void queryClient.invalidateQueries({ queryKey: ["allocation-history", id] });
  };
  const onMutError = (e: unknown) => {
    setNotice(null);
    if (e instanceof ApiError && e.status === 409) {
      setServerError(t("This record changed elsewhere. Refresh and try again."));
      void refresh();
    } else {
      setServerError(apiErrorMessage(e));
    }
  };

  const save = useMutation({
    mutationFn: async (v: {
      grant: AllocationGrant;
      start: string;
      end: string;
      newAmount: number | null;
      reason: string;
    }) => {
      // One Save applies the date edit and/or amount change in sequence.
      // The PATCH response carries the bumped version needed by adjust.
      let current = v.grant;
      if (v.start !== v.grant.start_date || v.end !== v.grant.end_date) {
        current = await editAllocationDates(current, v.start, v.end, v.reason);
      }
      if (v.newAmount !== null && v.newAmount !== current.granted) {
        current = await adjustAllocation(current, v.newAmount - current.granted, v.reason);
      }
      return current;
    },
    onSuccess: () => {
      setServerError(null);
      setNotice(t("Changes saved."));
      void refresh();
    },
    onError: onMutError,
  });
  const remove = useMutation({
    mutationFn: (v: { grant: AllocationGrant; reason: string }) =>
      removeAllocation(v.grant, v.reason),
    onSuccess: () => {
      setServerError(null);
      setNotice(t("Allocation removed from active use."));
      void refresh();
    },
    onError: onMutError,
  });
  const busy = save.isPending || remove.isPending;

  return (
    <div className="mx-auto max-w-6xl">
      {serverError && (
        <div className="mb-3">
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-3">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      <AsyncState isLoading={isLoading} error={error} emptyText="">
        {grant && (
          <>
            <PageCrumbs
              crumbs={[
                { label: t("nav.requests"), to: "/requests" },
                { label: t("nav.allocations"), to: "/settings/allocations" },
                { label: grant.employee_name },
              ]}
            />
            <section className="workspace-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold">
                    {t("Manage allocation — {name}", { name: grant.employee_name })}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {grant.type_name} · {t(UNIT_LABELS[grant.unit])} ·{" "}
                    {formatDate(grant.start_date)} → {formatDate(grant.end_date)} ·{" "}
                    {t("Granted {g} · Reserved {r} · Used {u} · Remaining {rem}", {
                      g: formatAllocationAmount(grant.granted, grant.unit),
                      r: formatAllocationAmount(grant.reserved, grant.unit),
                      u: formatAllocationAmount(grant.used, grant.unit),
                      rem: formatAllocationAmount(grant.remaining, grant.unit),
                    })}
                  </p>
                </div>
                {grant.status === "active" ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                    {t("Active")}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                    {t("Removed")}
                  </span>
                )}
              </div>
            </section>

            <GrantActions
              key={grant.version}
              grant={grant}
              busy={busy}
              onSave={(v) => save.mutate({ grant, ...v })}
              onRemove={(reason) => remove.mutate({ grant, reason })}
            />

            <GrantHistory grant={grant} />
          </>
        )}
      </AsyncState>
    </div>
  );
}

function GrantActions({
  grant,
  busy,
  onSave,
  onRemove,
}: {
  grant: AllocationGrant;
  busy: boolean;
  onSave: (v: {
    start: string;
    end: string;
    newAmount: number | null;
    reason: string;
  }) => void;
  onRemove: (reason: string) => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    start: grant.start_date,
    end: grant.end_date,
    total: formatAllocationAmount(grant.granted, grant.unit),
    reason: "",
  });
  const [voidReason, setVoidReason] = useState("");
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (grant.status !== "active") {
    return (
      <section className="workspace-panel mt-4 p-5">
        <p className="text-sm text-muted-foreground">
          {t("This allocation was removed from active use. Its record and history are preserved.")}
        </p>
      </section>
    );
  }

  return (
    <section className="workspace-panel mt-4 p-5">
      {localError && (
        <div className="mb-3">
          <Alert kind="error">{localError}</Alert>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <form
          className="rounded-lg border border-border p-4 md:col-span-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const entered = Number(form.total);
            const floor = grant.reserved + grant.used;
            const newAmount = grant.unit === "hour" ? hoursToAmount(entered) : entered;
            if (!Number.isFinite(entered) || entered < 0 || !Number.isInteger(newAmount)) {
              setLocalError(t("Enter a valid non-negative amount."));
              return;
            }
            if (newAmount < floor) {
              setLocalError(
                t("Cannot set the grant below {floor} {unit} — that much is already reserved or used on open requests.", {
                  floor: formatAllocationAmount(floor, grant.unit),
                  unit: t(UNIT_LABELS[grant.unit]),
                }),
              );
              return;
            }
            const datesChanged =
              form.start !== grant.start_date || form.end !== grant.end_date;
            const amountChanged = newAmount !== grant.granted;
            if (!datesChanged && !amountChanged) {
              setLocalError(t("Nothing to save — change the dates or the granted total first."));
              return;
            }
            if (!form.reason.trim()) {
              setLocalError(t("A reason is required."));
              return;
            }
            setLocalError(null);
            onSave({
              start: form.start,
              end: form.end,
              newAmount,
              reason: form.reason,
            });
          }}
        >
          <h3 className="text-sm font-semibold">{t("Edit allocation")}</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="text-sm">
              {t("Start – End date")}
              <RangeInput
                fromLabel={t("Start date")}
                toLabel={t("End date")}
                from={{
                  value: form.start,
                  onChange: (e) =>
                    setForm((f) => ({ ...f, start: e.target.value })),
                }}
                to={{
                  value: form.end,
                  onChange: (e) =>
                    setForm((f) => ({ ...f, end: e.target.value })),
                }}
              />
            </div>
            <label className="block text-sm">
              {grant.unit === "hour" ? t("Granted total (hours)") : t("Granted total")}
              <input
                type="number"
                step={grant.unit === "hour" ? 0.25 : 1}
                className={input}
                value={form.total}
                onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Reserved + used: {floor} {unit} — the total cannot be set below that.", {
              floor: formatAllocationAmount(grant.reserved + grant.used, grant.unit),
              unit: t(UNIT_LABELS[grant.unit]),
            })}
          </p>
          <label className="mt-2 block text-sm">
            {t("Reason")}
            <input
              className={input}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </label>
          <Button type="submit" size="sm" className="mt-3" disabled={busy}>
            {t("Save changes")}
          </Button>
        </form>

        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">{t("Remove from active use")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("The allocation stops funding new requests but stays in history. Only possible while nothing is reserved or used.")}
          </p>
          <label className="mt-2 block text-sm">
            {t("Reason")}
            <input
              className={input}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="mt-3"
            disabled={busy || grant.reserved > 0 || grant.used > 0}
            onClick={() => {
              if (!voidReason.trim()) {
                setLocalError(t("A reason is required."));
                return;
              }
              setLocalError(null);
              setConfirmVoid(true);
            }}
          >
            {t("Remove")}
          </Button>
          {(grant.reserved > 0 || grant.used > 0) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Reserved or used amounts must be resolved before removal.")}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmVoid}
        danger
        title={t("Remove this allocation?")}
        body={t("It will no longer fund new requests. The record and its history are preserved.")}
        confirmLabel={t("Remove")}
        onCancel={() => setConfirmVoid(false)}
        onConfirm={() => {
          setConfirmVoid(false);
          onRemove(voidReason);
        }}
      />
    </section>
  );
}

function GrantHistory({ grant }: { grant: AllocationGrant }) {
  const { t } = useLanguage();
  const changes = useQuery({
    queryKey: ["allocation-history", grant.id, "changes"],
    queryFn: () => getAllocationHistory(grant.id, "changes"),
  });
  const adjustments = useQuery({
    queryKey: ["allocation-history", grant.id, "adjustments"],
    queryFn: () => getAllocationHistory(grant.id, "adjustments"),
  });

  return (
    <section className="workspace-panel mt-4 p-5">
      <h2 className="text-lg font-semibold">{t("History")}</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">{t("Adjustments")}</h3>
          <AsyncState
            isLoading={adjustments.isLoading}
            error={adjustments.error}
            isEmpty={(adjustments.data?.results.length ?? 0) === 0}
            emptyText={t("No adjustments yet.")}
          >
            <ul className="mt-2 space-y-1 text-sm">
              {adjustments.data?.results.map((a) => (
                <li key={a.id} className="rounded-md border border-border px-3 py-2">
                  <strong>
                    {a.delta && a.delta > 0
                      ? `+${formatAllocationAmount(a.delta, grant.unit)}`
                      : formatAllocationAmount(a.delta ?? 0, grant.unit)}
                  </strong>{" "}
                  {t(UNIT_LABELS[grant.unit])} — {a.reason}
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(a.occurred_at)}
                  </span>
                </li>
              ))}
            </ul>
          </AsyncState>
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t("Changes")}</h3>
          <AsyncState
            isLoading={changes.isLoading}
            error={changes.error}
            isEmpty={(changes.data?.results.length ?? 0) === 0}
            emptyText={t("No changes yet.")}
          >
            <ul className="mt-2 space-y-1 text-sm">
              {changes.data?.results.map((c) => (
                <li key={c.id} className="rounded-md border border-border px-3 py-2">
                  <strong>{c.action === "voided" ? t("Removed from active use") : t("Dates changed")}</strong>{" "}
                  — {c.reason}
                  {c.previous && c.current && (
                    <span className="block text-xs text-muted-foreground">
                      {c.previous.start_date && c.current.start_date
                        ? `${formatDate(c.previous.start_date)} → ${formatDate(c.current.start_date)} · ${formatDate(c.previous.end_date ?? "")} → ${formatDate(c.current.end_date ?? "")}`
                        : `${c.previous.status ?? ""} → ${c.current.status ?? ""}`}
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(c.occurred_at)}
                  </span>
                </li>
              ))}
            </ul>
          </AsyncState>
        </div>
      </div>
    </section>
  );
}
