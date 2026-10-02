import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/ui/data-table";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/filter-bar";
import {
  listRequests,
  listRequestTypes,
  type EmployeeRequest,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { formatDate } from "../../lib/dates";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { StatusBadge } from "./StatusBadge";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_hr", label: "Pending HR" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

const columns = (t: (key: string) => string): ColumnDef<EmployeeRequest, unknown>[] => [
  {
    accessorKey: "title",
    header: t("Title"),
    cell: ({ row }) => (
      <Link
        to={`/requests/${row.original.id}`}
        className="font-medium workspace-link-quiet"
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    id: "type",
    header: t("Type"),
    cell: ({ row }) => (
      <span className="text-gray-700">{row.original.type_name}</span>
    ),
  },
  {
    id: "employee",
    header: t("Employee"),
    cell: ({ row }) => (
      <span className="text-gray-700">
        {row.original.employee_name || row.original.employee_email}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: t("Status"),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "submitted_at",
    header: t("Submitted"),
    cell: ({ row }) => (
      <span className="text-gray-600">
        {row.original.submitted_at
          ? formatDate(row.original.submitted_at)
          : "—"}
      </span>
    ),
  },
];

/** Scoped request list (FR-008): the server scopes by role — employees see
 * their own work, managers their reports' non-draft work, HR the org's. */
export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");

  const filters = {
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    type: params.get("type") ?? "",
    ordering: params.get("ordering") ?? "-created_at",
    page: Number(params.get("page") ?? 1),
    page_size: 25,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["requests", filters],
    queryFn: () => listRequests(filters),
    placeholderData: (prev) => prev,
  });

  const { data: types } = useQuery({
    queryKey: ["request-types"],
    queryFn: listRequestTypes,
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><span className="text-xs font-bold uppercase tracking-widest text-brand-700">{t("WORKSPACE / REQUESTS")}</span><h1 className="mt-1 text-3xl font-bold">{t("Requests")}</h1><p className="mt-1 text-sm text-slate-600">{t("Track submissions and keep every decision in view.")}</p></div>
        <Link
          to="/requests/new"
          className="workspace-primary"
        >
          {t("New request")}
        </Link>
      </div>

      <FilterBar>
        <SearchField
          label={t("Search")}
          ariaLabel={t("Search requests")}
          value={searchInput}
          onChange={setSearchInput}
          onSearch={() => setParam("search", searchInput)}
          placeholder={t("Title or description…")}
        />
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
        <FilterSelect
          label={t("Type")}
          value={filters.type}
          onChange={(v) => setParam("type", v)}
        >
          <option value="">{t("All")}</option>
          {types?.results.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={!data || data.results.length === 0}
        emptyText={t("No requests match your filters.")}
      >
        <DataTable<EmployeeRequest>
          columns={columns(t)}
          data={data?.results ?? []}
          manualSorting
          sorting={sorting}
          onSortingChange={(u) =>
            setParam("ordering", sortingToOrdering(applySortingUpdater(u, sorting)))
          }
          emptyText={t("No requests match your filters.")}
          footer={
            data && (
              <PaginationControls
                count={data.count}
                page={filters.page}
                pageSize={filters.page_size}
                onPage={(p) => setParam("page", String(p))}
              />
            )
          }
        />
      </AsyncState>
    </div>
  );
}
