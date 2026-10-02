import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import {
  getOrCreateTimesheet,
  listTimesheets,
  type Timesheet,
} from "../../api/timesheets";
import { apiErrorMessage } from "../../api/client";
import { useLanguage } from "../../app/LanguageProvider";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { formatMinutes } from "./timezone";
import { TimesheetStatusBadge } from "./TimesheetStatusBadge";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "collecting", label: "Collecting" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_hr", label: "Pending HR" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

/** Local "today" for the week picker — UTC slicing would drift near midnight. */
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const columns = (
  t: (key: string, params?: Record<string, string | number>) => string,
  lang: "en" | "ar",
): ColumnDef<Timesheet, unknown>[] => [
  {
    accessorKey: "period_start",
    header: t("Week"),
    cell: ({ row }) => (
      <Link
        to={`/timesheets/${row.original.id}`}
        className="font-medium workspace-link-quiet"
      >
        {row.original.period_start} – {row.original.period_end}
      </Link>
    ),
  },
  {
    id: "employee",
    header: t("Employee"),
    cell: ({ row }) =>
      row.original.employee_name || row.original.employee_email,
  },
  {
    accessorKey: "status",
    header: t("Status"),
    cell: ({ row }) => (
      <>
        <TimesheetStatusBadge status={row.original.status} />
        {row.original.cycle > 1 && (
          <span className="ms-1 text-xs text-gray-500">
            {t("cycle {n}", { n: row.original.cycle })}
          </span>
        )}
      </>
    ),
  },
  {
    accessorKey: "total_minutes",
    header: t("Total"),
    cell: ({ row }) => formatMinutes(row.original.total_minutes, lang),
  },
  {
    id: "reviewer",
    header: t("Reviewer"),
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-gray-600">{row.original.reviewer_name ?? "—"}</span>
    ),
  },
];

/** Scoped timesheet list — the server scopes by role: employees see their
 * own sheets, managers direct reports' submitted sheets, HR the org's. */
export function TimesheetsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, lang } = useLanguage();

  const filters = {
    status: params.get("status") ?? "",
    ordering: params.get("ordering") ?? "-period_start",
    page: Number(params.get("page") ?? 1),
    page_size: 25,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["timesheets", filters],
    queryFn: () => listTimesheets(filters),
    placeholderData: (prev) => prev,
  });

  const [anchorDate, setAnchorDate] = useState(() => {
    const candidate = params.get("date") ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(candidate))
      ? candidate
      : new Date().toISOString().slice(0, 10);
  });

  const openWeek = useMutation({
    mutationFn: (date: string) => getOrCreateTimesheet(date),
    onSuccess: (sheet) => {
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      navigate(`/timesheets/${sheet.id}`);
    },
  });

  const sorting = orderingToSorting(filters.ordering);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><span className="text-xs font-bold uppercase tracking-widest text-brand-700">{t("WORKSPACE / TIME")}</span><h1 className="mt-1 text-3xl font-bold">{t("Timesheets")}</h1><p className="mt-1 text-sm text-slate-600">{t("Record time and follow each week's progress.")}</p></div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            <span className="sr-only">{t("Week containing date")}</span>
            <Input
              type="date"
              value={anchorDate}
              max={localToday()}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <Button type="button" onClick={() => openWeek.mutate(anchorDate)} disabled={openWeek.isPending}>
            {t("Open week")}
          </Button>
        </div>
      </div>
      {openWeek.isError && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {apiErrorMessage(openWeek.error)}
        </p>
      )}

      <FilterBar>
        <FilterSelect
          label={t("Status")}
          value={filters.status}
          onChange={(v) => setParam("status", v)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      <AsyncState isLoading={isLoading} error={error}>
        {data && data.results.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
            {t("No timesheets found.")}
          </p>
        ) : (
          <DataTable<Timesheet>
            columns={columns(t, lang)}
            data={data?.results ?? []}
            manualSorting
            sorting={sorting}
            onSortingChange={(u) =>
              setParam("ordering", sortingToOrdering(applySortingUpdater(u, sorting)))
            }
            emptyText={t("No timesheets found.")}
            footer={
              data && (
                <PaginationControls
                  page={filters.page}
                  count={data.count}
                  pageSize={filters.page_size}
                  onPage={(p) => setParam("page", String(p))}
                />
              )
            }
          />
        )}
      </AsyncState>
    </div>
  );
}
