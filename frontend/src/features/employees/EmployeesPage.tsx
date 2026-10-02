import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/filter-bar";

import { listDepartments } from "../../api/departments";
import { listEmployees, type EmployeeSummary } from "../../api/employees";
import { useLanguage } from "../../app/LanguageProvider";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { useAuth } from "../auth/auth-context";

const columns = (t: (key: string) => string): ColumnDef<EmployeeSummary, unknown>[] => [
  {
    accessorKey: "employee_code",
    header: t("Code"),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.employee_code}</span>
    ),
  },
  {
    accessorKey: "display_name",
    header: t("Name"),
    cell: ({ row }) => (
      <Link to={`/employees/${row.original.id}`} className="workspace-link">
        {row.original.display_name || row.original.email}
      </Link>
    ),
  },
  { accessorKey: "email", header: t("Email") },
  {
    id: "department",
    header: t("Department"),
    cell: ({ row }) => row.original.department_name ?? "—",
  },
  {
    id: "roles",
    header: t("Roles"),
    enableSorting: false,
    cell: ({ row }) => row.original.roles.join(", ") || t("Employee"),
  },
  {
    id: "is_active",
    header: t("Status"),
    cell: ({ row }) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          row.original.is_active
            ? "bg-green-100 text-green-800"
            : "bg-gray-200 text-gray-600"
        }`}
      >
        {row.original.is_active ? t("Active") : t("Inactive")}
      </span>
    ),
  },
];

/** Scoped employee directory (FR-009): filters, ordering, pagination.
 * The server scopes by role — employees see only themselves here. */
export function EmployeesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isHr = user?.roles.includes("HR") ?? false;
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");

  const filters = {
    search: params.get("search") ?? "",
    is_active: params.get("is_active") ?? "",
    department: params.get("department") ?? "",
    role: params.get("role") ?? "",
    ordering: params.get("ordering") ?? "employee_code",
    page: Number(params.get("page") ?? 1),
    page_size: 25,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["employees", filters],
    queryFn: () => listEmployees(filters),
    placeholderData: (prev) => prev,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
    enabled: isHr,
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
        <div><span className="text-xs font-bold uppercase tracking-widest text-brand-700">{t("PEOPLE / DIRECTORY")}</span><h1 className="mt-1 text-3xl font-bold">{t("Employees")}</h1><p className="mt-1 text-sm text-slate-600">{t("Find teammates and manage your organization.")}</p></div>
        {isHr && <div className="flex flex-wrap items-center gap-2"><Button asChild variant="outline"><Link to="/departments">{t("Departments")}</Link></Button><Button asChild><Link to="/employees/new">{t("New employee")}</Link></Button></div>}
      </div>

      <FilterBar>
        <SearchField
          label={t("Search")}
          ariaLabel={t("Search employees")}
          value={searchInput}
          onChange={setSearchInput}
          onSearch={() => setParam("search", searchInput)}
          placeholder={t("Name, code or email…")}
        />
        <FilterSelect
          label={t("Status")}
          ariaLabel={t("Filter by status")}
          value={filters.is_active}
          onChange={(v) => setParam("is_active", v)}
        >
          <option value="">{t("Any status")}</option>
          <option value="true">{t("Active")}</option>
          <option value="false">{t("Inactive")}</option>
        </FilterSelect>
        <FilterSelect
          label={t("Role")}
          ariaLabel={t("Filter by role")}
          value={filters.role}
          onChange={(v) => setParam("role", v)}
        >
          <option value="">{t("Any role")}</option>
          <option value="Employee">{t("Employee")}</option>
          <option value="Manager">{t("Manager")}</option>
          <option value="HR">HR</option>
        </FilterSelect>
        {departments && (
          <FilterSelect
            label={t("Department")}
            ariaLabel={t("Filter by department")}
            value={filters.department}
            onChange={(v) => setParam("department", v)}
          >
            <option value="">{t("Any department")}</option>
            {departments.results.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </FilterSelect>
        )}
      </FilterBar>

      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={data?.results.length === 0}
        emptyText={t("No employees match these filters.")}
      >
        <DataTable<EmployeeSummary>
          columns={columns(t)}
          data={data?.results ?? []}
          manualSorting
          sorting={sorting}
          onSortingChange={(u) =>
            setParam("ordering", sortingToOrdering(applySortingUpdater(u, sorting)))
          }
          emptyText={t("No employees match these filters.")}
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
