import { useMutation, useQuery } from "@tanstack/react-query";
import { type ColumnDef, type OnChangeFn, type SortingState } from "@tanstack/react-table";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";
import { FilterInput, FilterSelect, FiltersToggle } from "@/components/ui/filter-bar";
import { listEmployees } from "../../api/employees";
import { listRequestTypes } from "../../api/requests";
import {
  downloadReportCsv,
  getHoursReport,
  getRequestsReport,
  type HoursReportParams,
  type HoursRow,
  type RequestReportRow,
  type RequestsReportParams,
} from "../../api/reporting";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { formatDate } from "../../lib/dates";
import { formatMinutes } from "../timesheets/timezone";
import { useAuth } from "../auth/auth-context";
import { useLanguage } from "../../app/LanguageProvider";

const HOURS_STATUSES = [
  { value: "approved", label: "Approved" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_hr", label: "Pending HR" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

const REQUEST_STATUSES = [
  { value: "", label: "All" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_hr", label: "Pending HR" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

function useScopedEmployees() {
  return useQuery({
    queryKey: ["employees", "report-filter"],
    queryFn: () => listEmployees({ is_active: "true", page_size: 100 }),
  });
}

function TypeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useLanguage();
  const { data } = useQuery({
    queryKey: ["request-types", "report-filter"],
    queryFn: () => listRequestTypes(),
  });
  return (
    <FilterSelect label={t("Request type")} value={value} onChange={onChange}>
      <option value="">{t("All")}</option>
      {(data?.results ?? []).map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </FilterSelect>
  );
}

function EmployeeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useLanguage();
  const { data } = useScopedEmployees();
  return (
    <FilterSelect label={t("Employee")} value={value} onChange={onChange}>
      <option value="">{t("All employees")}</option>
      {(data?.results ?? []).map((e) => (
        <option key={e.id} value={e.id}>
          {e.display_name} ({e.employee_code})
        </option>
      ))}
    </FilterSelect>
  );
}

function ExportButton({
  kind,
  params,
}: {
  kind: "working-hours" | "requests";
  params: HoursReportParams | RequestsReportParams;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const roles = user?.roles ?? [];
  const exportMutation = useMutation({
    mutationFn: () => downloadReportCsv(kind, params),
  });
  if (!roles.includes("Manager") && !roles.includes("HR")) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="outline" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
        {exportMutation.isPending ? t("Exporting…") : t("Export CSV")}
      </Button>
      {exportMutation.error && (
        <span role="alert" className="text-xs text-red-700">
          {exportMutation.error.message}
        </span>
      )}
    </span>
  );
}

const hoursColumns = (
  t: (key: string) => string,
  lang: "en" | "ar",
): ColumnDef<HoursRow, unknown>[] => [
  { accessorKey: "work_date", header: t("Date") },
  {
    accessorKey: "employee_code",
    header: t("Employee"),
    cell: ({ row }) => (
      <>
        {row.original.employee_name}{" "}
        <span className="text-gray-500">({row.original.employee_code})</span>
      </>
    ),
  },
  {
    id: "department",
    header: t("Department"),
    enableSorting: false,
    cell: ({ row }) => row.original.department ?? "—",
  },
  {
    accessorKey: "minutes",
    header: t("Hours"),
    cell: ({ row }) => (
      <span className="float-right">{formatMinutes(row.original.minutes, lang)}</span>
    ),
  },
];

const requestReportColumns = (t: (key: string) => string): ColumnDef<RequestReportRow, unknown>[] => [
  { accessorKey: "title", header: t("Title") },
  {
    accessorKey: "type",
    header: t("Type"),
    enableSorting: false,
  },
  { accessorKey: "status", header: t("Status") },
  {
    id: "employee",
    header: t("Employee"),
    enableSorting: false,
    cell: ({ row }) => (
      <>
        {row.original.employee_name}{" "}
        <span className="text-gray-500">({row.original.employee_code})</span>
      </>
    ),
  },
  {
    accessorKey: "submitted_at",
    header: t("Submitted"),
    cell: ({ row }) =>
      row.original.submitted_at
        ? formatDate(row.original.submitted_at)
        : "—",
  },
];

function HoursReport({
  params,
  onPage,
  sorting,
  onSortingChange,
}: {
  params: HoursReportParams;
  onPage: (p: number) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}) {
  const { t, lang } = useLanguage();
  const { data, isLoading, error } = useQuery({
    queryKey: ["report", "hours", params],
    queryFn: () => getHoursReport(params),
    placeholderData: (prev) => prev,
  });
  return (
    <AsyncState
      isLoading={isLoading}
      error={error}
      isEmpty={!!data && data.results.length === 0}
      emptyText={t("No working hours in this period.")}
    >
      {data && (
        <>
          <p className="mb-2 text-sm text-gray-600">
            {data.meta.period.from} → {data.meta.period.to} ({data.meta.timezone}
            ) — {t("grouped by")} {data.meta.grouping} — {t("total")}{" "}
            <strong>{formatMinutes(data.totals.minutes, lang)}</strong>
          </p>
          <DataTable<HoursRow>
            columns={hoursColumns(t, lang)}
            data={data.results}
            manualSorting
            sorting={sorting}
            onSortingChange={onSortingChange}
            emptyText={t("No working hours in this period.")}
            footer={
              <PaginationControls
                count={data.count}
                page={params.page ?? 1}
                pageSize={25}
                onPage={onPage}
              />
            }
          />
        </>
      )}
    </AsyncState>
  );
}

function RequestsReport({
  params,
  onPage,
  sorting,
  onSortingChange,
}: {
  params: RequestsReportParams;
  onPage: (p: number) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}) {
  const { t } = useLanguage();
  const { data, isLoading, error } = useQuery({
    queryKey: ["report", "requests", params],
    queryFn: () => getRequestsReport(params),
    placeholderData: (prev) => prev,
  });
  return (
    <AsyncState
      isLoading={isLoading}
      error={error}
      isEmpty={!!data && data.results.length === 0}
      emptyText={t("No submitted requests in this period.")}
    >
      {data && (
        <>
          <p className="mb-2 text-sm text-gray-600">
            {data.meta.period.from} → {data.meta.period.to} {t("by submitted date")} (
            {data.meta.timezone}) — <strong>{data.totals.count}</strong>{" "}
            {t("requests")}
          </p>
          <DataTable<RequestReportRow>
            columns={requestReportColumns(t)}
            data={data.results}
            manualSorting
            sorting={sorting}
            onSortingChange={onSortingChange}
            emptyText={t("No submitted requests in this period.")}
            footer={
              <PaginationControls
                count={data.count}
                page={params.page ?? 1}
                pageSize={25}
                onPage={onPage}
              />
            }
          />
        </>
      )}
    </AsyncState>
  );
}

/** Scoped reports (005): drafts are never included (submitted-date basis,
 * D-009); filters narrow within the caller's server-side scope. */
export function ReportsPage() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"hours" | "requests">("hours");

  const filters = {
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    status: params.get("status") ?? "",
    employee: params.get("employee") ?? "",
    type: params.get("type") ?? "",
    ordering: params.get("ordering") ?? "",
    page: Number(params.get("page") ?? 1),
  };

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  };

  const reportActiveFilters = [
    filters.from,
    filters.to,
    filters.status,
    filters.employee,
    filters.type,
  ].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(reportActiveFilters > 0);

  const sorting = orderingToSorting(filters.ordering);
  const onSortingChange: OnChangeFn<SortingState> = (u) =>
    setFilter("ordering", sortingToOrdering(applySortingUpdater(u, sorting)));

  const hoursParams: HoursReportParams = {
    from: filters.from || undefined,
    to: filters.to || undefined,
    status: filters.status || undefined,
    employee: filters.employee || undefined,
    ordering: filters.ordering || undefined,
    page: filters.page,
  };
  const requestsParams: RequestsReportParams = {
    ...hoursParams,
    type: filters.type || undefined,
  };

  return (
    <div className="workspace-panel p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><span className="text-xs font-bold uppercase tracking-widest text-brand-700">{t("INSIGHTS / REPORTING")}</span><h1 className="mt-1 text-3xl font-bold">{t("Reports")}</h1><p className="mt-1 text-sm text-slate-600">{t("Understand activity across your scope.")}</p></div>
        <div role="tablist" aria-label={t("Report type")} className="flex gap-1">
          {(
            [
              ["hours", t("Working hours")],
              ["requests", t("Requests")],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              variant={tab === key ? "default" : "ghost"}
              onClick={() => {
                setTab(key);
                // Status, type and ordering choices differ between the two
                // reports — drop them so a stale value can't 400 the new tab.
                const next = new URLSearchParams(params);
                for (const k of ["status", "type", "ordering", "page"]) {
                  next.delete(k);
                }
                setParams(next);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <FiltersToggle
          open={filtersOpen}
          activeFilters={reportActiveFilters}
          onToggle={() => setFiltersOpen((v) => !v)}
        />
        <div
          className={`${
            filtersOpen ? "flex" : "hidden"
          } w-full flex-wrap items-end gap-x-4 gap-y-3 max-md:[&>*]:w-full`}
        >
        <FilterInput
          label={t("From")}
          type="date"
          value={filters.from}
          onChange={(e) => setFilter("from", e.target.value)}
        />
        <FilterInput
          label={t("To")}
          type="date"
          value={filters.to}
          onChange={(e) => setFilter("to", e.target.value)}
        />
        {tab === "requests" ? (
          <FilterSelect
            label={t("Status")}
            value={filters.status}
            onChange={(v) => setFilter("status", v)}
          >
            {REQUEST_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </FilterSelect>
        ) : (
          <FilterSelect
            label={t("Status")}
            value={filters.status}
            onChange={(v) => setFilter("status", v)}
          >
            <option value="">{t("Approved only (default)")}</option>
            {HOURS_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </FilterSelect>
        )}
        <EmployeeFilter
          value={filters.employee}
          onChange={(v) => setFilter("employee", v)}
        />
        {tab === "requests" && (
          <TypeFilter
            value={filters.type}
            onChange={(v) => setFilter("type", v)}
          />
        )}
        </div>
        <ExportButton
          kind={tab === "hours" ? "working-hours" : "requests"}
          params={tab === "hours" ? hoursParams : requestsParams}
        />
      </div>

      <div className="mt-4">
        {tab === "hours" ? (
          <HoursReport
            params={hoursParams}
            sorting={sorting}
            onSortingChange={onSortingChange}
            onPage={(p) => {
              const next = new URLSearchParams(params);
              next.set("page", String(p));
              setParams(next);
            }}
          />
        ) : (
          <RequestsReport
            params={requestsParams}
            sorting={sorting}
            onSortingChange={onSortingChange}
            onPage={(p) => {
              const next = new URLSearchParams(params);
              next.set("page", String(p));
              setParams(next);
            }}
          />
        )}
      </div>
    </div>
  );
}
