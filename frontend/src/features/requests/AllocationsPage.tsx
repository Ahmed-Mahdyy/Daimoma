import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ApiError, apiErrorMessage } from "../../api/client";
import { listEmployees } from "../../api/employees";
import {
  adjustAllocation,
  ALLOCATION_UNIT_LABELS as UNIT_LABELS,
  editAllocationDates,
  formatAllocationAmount,
  getAllocationHistory,
  hoursToAmount,
  listAllocations,
  removeAllocation,
  type AllocationGrant,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { formatDate, formatDateTime } from "../../lib/dates";

const PAGE_SIZE = 25;

const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** HR allocation administration (008): dated employee/type grants with
 * audited date edits, signed adjustments and remove-from-active-use.
 * Records are never deleted — removal flips status and keeps history. */
export function AllocationsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | AllocationGrant["status"]>("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["allocations", { page, status: statusFilter, employee: employeeFilter }],
    queryFn: () =>
      listAllocations({
        page,
        status: statusFilter || undefined,
        employee: employeeFilter || undefined,
      }),
  });
  const { data: employees } = useQuery({
    queryKey: ["employees", "allocation-pick"],
    queryFn: () => listEmployees({ is_active: "true", page_size: 100, ordering: "display_name" }),
  });

  const selected = data?.results.find((g) => g.id === selectedId) ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["allocations"] });
  const onMutError = (e: unknown) => {
    setNotice(null);
    if (e instanceof ApiError && e.status === 409) {
      setServerError(t("This record changed elsewhere. Refresh and try again."));
      void refresh();
    } else {
      setServerError(apiErrorMessage(e));
    }
  };

  const editDates = useMutation({
    mutationFn: (v: { grant: AllocationGrant; start: string; end: string; reason: string }) =>
      editAllocationDates(v.grant, v.start, v.end, v.reason),
    onSuccess: () => {
      setServerError(null);
      setNotice(t("Dates updated."));
      void refresh();
    },
    onError: onMutError,
  });
  const adjust = useMutation({
    mutationFn: (v: { grant: AllocationGrant; delta: number; reason: string }) =>
      adjustAllocation(v.grant, v.delta, v.reason),
    onSuccess: () => {
      setServerError(null);
      setNotice(t("Adjustment applied."));
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
      setSelectedId(null);
      void refresh();
    },
    onError: onMutError,
  });

  const columns: ColumnDef<AllocationGrant, unknown>[] = [
    {
      accessorKey: "employee_name",
      header: t("Employee"),
      cell: ({ row }) => <span className="font-medium">{row.original.employee_name}</span>,
    },
    { accessorKey: "type_name", header: t("Request type") },
    {
      accessorKey: "unit",
      header: t("Unit"),
      cell: ({ row }) => t(UNIT_LABELS[row.original.unit]),
    },
    {
      id: "period",
      header: t("Grant dates"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-gray-600 dark:text-muted-foreground">
          {formatDate(row.original.start_date)} → {formatDate(row.original.end_date)}
        </span>
      ),
    },
    {
      id: "balance",
      header: t("Granted / Reserved / Used"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-gray-600 dark:text-muted-foreground">
          {formatAllocationAmount(row.original.granted, row.original.unit)} ·{" "}
          {formatAllocationAmount(row.original.reserved, row.original.unit)} ·{" "}
          {formatAllocationAmount(row.original.used, row.original.unit)}
        </span>
      ),
    },
    {
      accessorKey: "remaining",
      header: t("Remaining"),
      cell: ({ row }) => (
        <strong className={row.original.remaining <= 0 ? "text-amber-700 dark:text-amber-300" : ""}>
          {formatAllocationAmount(row.original.remaining, row.original.unit)}
        </strong>
      ),
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) =>
        row.original.status === "active" ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
            {t("Active")}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
            {t("Removed")}
          </span>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSelectedId(row.original.id)}
        >
          {t("Manage")}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-widest text-brand-700">
        {t("HR / WORKFLOWS")}
      </span>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-3xl font-bold">{t("Employee allocations")}</h1>
          <p className="mt-2 text-base font-medium leading-relaxed text-gray-600">
            {t("Assign dated allowances for allocation-required types. Requests reserve capacity when submitted and release it when returned or rejected. Removed allocations keep their history.")}
          </p>
        </div>
        <Button asChild>
          <Link to="/settings/allocations/new">{t("Add allocation")}</Link>
        </Button>
      </div>
      {serverError && (
        <div className="mt-3">
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}
      {notice && (
        <div className="mt-3">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          {t("Employee")}
          <select
            className={input}
            value={employeeFilter}
            onChange={(e) => {
              setEmployeeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("All employees")}</option>
            {(employees?.results ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.display_name || emp.employee_code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          {t("Status")}
          <select
            className={input}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "" | AllocationGrant["status"]);
              setPage(1);
            }}
          >
            <option value="">{t("Any status")}</option>
            <option value="active">{t("Active")}</option>
            <option value="void">{t("Removed")}</option>
          </select>
        </label>
      </div>

      <AsyncState isLoading={isLoading} error={error}>
        <div className="mt-3">
          <DataTable<AllocationGrant>
            columns={columns}
            data={data?.results ?? []}
            emptyText={t("No allocations yet.")}
            footer={
              <PaginationControls
                count={data?.count ?? 0}
                page={page}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            }
          />
        </div>
      </AsyncState>

      {selected && (
        <GrantManager
          grant={selected}
          busy={editDates.isPending || adjust.isPending || remove.isPending}
          onClose={() => setSelectedId(null)}
          onSaveDates={(start, end, reason) =>
            editDates.mutate({ grant: selected, start, end, reason })
          }
          onAdjust={(delta, reason) => adjust.mutate({ grant: selected, delta, reason })}
          onRemove={(reason) => remove.mutate({ grant: selected, reason })}
        />
      )}
    </div>
  );
}

function GrantManager({
  grant,
  busy,
  onClose,
  onSaveDates,
  onAdjust,
  onRemove,
}: {
  grant: AllocationGrant;
  busy: boolean;
  onClose: () => void;
  onSaveDates: (start: string, end: string, reason: string) => void;
  onAdjust: (delta: number, reason: string) => void;
  onRemove: (reason: string) => void;
}) {
  const { t } = useLanguage();
  const [dates, setDates] = useState({ start: grant.start_date, end: grant.end_date, reason: "" });
  const [adjust, setAdjust] = useState({ delta: "", reason: "" });
  const [voidReason, setVoidReason] = useState("");
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isActive = grant.status === "active";

  const changes = useQuery({
    queryKey: ["allocation-history", grant.id, "changes"],
    queryFn: () => getAllocationHistory(grant.id, "changes"),
    enabled: historyOpen,
  });
  const adjustments = useQuery({
    queryKey: ["allocation-history", grant.id, "adjustments"],
    queryFn: () => getAllocationHistory(grant.id, "adjustments"),
    enabled: historyOpen,
  });

  return (
    <section
      aria-labelledby="allocation-manage"
      className="workspace-panel mt-4 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="allocation-manage" className="text-lg font-semibold">
            {t("Manage allocation — {name}", { name: grant.employee_name })}
          </h2>
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
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("Close")}
        </Button>
      </div>
      {localError && (
        <div className="mt-3">
          <Alert kind="error">{localError}</Alert>
        </div>
      )}

      {isActive ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <form
            className="rounded-lg border border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!dates.reason.trim()) {
                setLocalError(t("A reason is required."));
                return;
              }
              setLocalError(null);
              onSaveDates(dates.start, dates.end, dates.reason);
            }}
          >
            <h3 className="text-sm font-semibold">{t("Edit dates")}</h3>
            <label className="mt-2 block text-sm">
              {t("Start date")}
              <input
                type="date"
                className={input}
                value={dates.start}
                onChange={(e) => setDates((d) => ({ ...d, start: e.target.value }))}
              />
            </label>
            <label className="mt-2 block text-sm">
              {t("End date")}
              <input
                type="date"
                className={input}
                value={dates.end}
                onChange={(e) => setDates((d) => ({ ...d, end: e.target.value }))}
              />
            </label>
            <label className="mt-2 block text-sm">
              {t("Reason")}
              <input
                className={input}
                value={dates.reason}
                onChange={(e) => setDates((d) => ({ ...d, reason: e.target.value }))}
              />
            </label>
            <Button type="submit" size="sm" className="mt-3" disabled={busy}>
              {t("Save dates")}
            </Button>
          </form>

          <form
            className="rounded-lg border border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const entered = Number(adjust.delta);
              const delta = grant.unit === "hour" ? hoursToAmount(entered) : entered;
              if (!Number.isInteger(delta) || delta === 0) {
                setLocalError(t("Adjustment must be nonzero."));
                return;
              }
              if (!adjust.reason.trim()) {
                setLocalError(t("A reason is required."));
                return;
              }
              setLocalError(null);
              onAdjust(delta, adjust.reason);
            }}
          >
            <h3 className="text-sm font-semibold">{t("Adjust amount")}</h3>
            <label className="mt-2 block text-sm">
              {grant.unit === "hour" ? t("Delta (± hours)") : t("Delta (± units)")}
              <input
                type="number"
                step={grant.unit === "hour" ? 0.25 : 1}
                className={input}
                value={adjust.delta}
                onChange={(e) => setAdjust((a) => ({ ...a, delta: e.target.value }))}
              />
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Positive increases the grant, negative decreases it — never below reserved plus used.")}
            </p>
            <label className="mt-2 block text-sm">
              {t("Reason")}
              <input
                className={input}
                value={adjust.reason}
                onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))}
              />
            </label>
            <Button type="submit" size="sm" className="mt-3" disabled={busy}>
              {t("Apply adjustment")}
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
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("This allocation was removed from active use. Its record and history are preserved.")}
        </p>
      )}

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((v) => !v)}
        >
          {historyOpen ? t("Hide history") : t("History")}
        </Button>
        {historyOpen && (
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
        )}
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
