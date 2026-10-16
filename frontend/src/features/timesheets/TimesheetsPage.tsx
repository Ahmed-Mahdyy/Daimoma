import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { UserCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  getOrCreateTimesheet,
  listTimesheets,
  type Timesheet,
} from "../../api/timesheets";
import { apiErrorMessage } from "../../api/client";
import { localToday } from "../../lib/dates";
import { useLanguage } from "../../app/LanguageProvider";
import { useOptionalAuth } from "../auth/auth-context";
import { YouBadge } from "../../components/ui/YouBadge";
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

const columns = (
  t: (key: string, params?: Record<string, string | number>) => string,
  lang: "en" | "ar",
  ownProfileId: string | null,
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
    cell: ({ row }) => (
      <span>
        {row.original.employee_name || row.original.employee_email}
        {row.original.employee === ownProfileId && <YouBadge />}
      </span>
    ),
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
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");

  // Managers/HR see scoped team/org rows — flag rows that are their own.
  const me = useOptionalAuth();
  const ownProfileId =
    me && (me.roles.includes("Manager") || me.roles.includes("HR"))
      ? me.id
      : null;

  const mine = params.get("mine") === "1";
  const filters = {
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    employee: mine && ownProfileId ? ownProfileId : undefined,
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
      {openWeek.isError && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {apiErrorMessage(openWeek.error)}
        </p>
      )}

      <FilterBar
        header={
          <PageHeader
            crumbs={[
              { label: t("nav.workspace"), to: "/" },
              { label: t("nav.timesheets") },
            ]}
            title={t("Timesheets")}
            description={t("Record time and follow each week's progress.")}
            actions={
              <>
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
                <Button type="button" onClick={() => openWeek.mutate(anchorDate)} disabled={openWeek.isPending || anchorDate > localToday()}>
                  {t("Open week")}
                </Button>
              </>
            }
          />
        }
        activeFilters={[filters.status].filter(Boolean).length + (mine ? 1 : 0)}
        search={
          <>
            <SearchField
              label={t("Search")}
              ariaLabel={t("Search timesheets")}
              value={searchInput}
              onChange={setSearchInput}
              onSearch={(v) => setParam("search", v)}
              placeholder={t("Employee name, code or email…")}
            />
            {ownProfileId && (
              <button
                type="button"
                aria-pressed={mine}
                onClick={() => setParam("mine", mine ? "" : "1")}
                className={`inline-flex h-10 items-center gap-2 self-end rounded-xl border px-3.5 text-sm font-semibold shadow-sm transition-colors ${
                  mine
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "bg-background/60 hover:border-brand-700/40"
                }`}
              >
                <UserCheck className="size-4" aria-hidden="true" />
                {t("Only mine")}
              </button>
            )}
          </>
        }
      >
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
            columns={columns(t, lang, ownProfileId)}
            rowClassName={(ts) =>
              ts.employee === ownProfileId ? "bg-brand-50/60 dark:bg-white/5" : ""
            }
            data={data?.results ?? []}
            onRowClick={(ts) => navigate(`/timesheets/${ts.id}`)}
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
