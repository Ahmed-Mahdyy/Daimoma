import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { listEmployees } from "../../api/employees";
import {
  ALLOCATION_UNIT_LABELS as UNIT_LABELS,
  formatAllocationAmount,
  listAllocations,
  type AllocationGrant,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { formatDate } from "../../lib/dates";

const PAGE_SIZE = 25;

/** HR allocation administration (008): dated employee/type grants.
 * Rows open a dedicated record page for date edits, adjustments,
 * removal and history — the list itself stays compact. */
export function AllocationsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | AllocationGrant["status"]>("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["allocations", { page, status: statusFilter, employee: employeeFilter, search }],
    queryFn: () =>
      listAllocations({
        page,
        status: statusFilter || undefined,
        employee: employeeFilter || undefined,
        search: search || undefined,
      }),
  });
  const { data: employees } = useQuery({
    queryKey: ["employees", "allocation-pick"],
    queryFn: () => listEmployees({ is_active: "true", page_size: 100, ordering: "display_name" }),
  });

  const columns: ColumnDef<AllocationGrant, unknown>[] = [
    {
      accessorKey: "employee_name",
      header: t("Employee"),
      cell: ({ row }) => (
        <Link
          to={`/settings/allocations/${row.original.id}`}
          className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-[#8bd6c2]"
        >
          {row.original.employee_name}
        </Link>
      ),
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
          {formatAllocationAmount(row.original.granted, row.original.unit)} /{" "}
          {formatAllocationAmount(row.original.reserved, row.original.unit)} /{" "}
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
  ];

  return (
    <div>
      <FilterBar
        header={
          <PageHeader
            crumbs={[
              { label: t("nav.requests"), to: "/requests" },
              { label: t("nav.allocations") },
            ]}
            title={t("Employee allocations")}
            description={t("Assign dated allowances for allocation-required types. Requests reserve capacity when submitted and release it when returned or rejected. Removed allocations keep their history.")}
            actions={
              <Button asChild>
                <Link to="/settings/allocations/new">{t("Add allocation")}</Link>
              </Button>
            }
          />
        }
        search={
          <SearchField
            ariaLabel={t("Search allocations")}
            value={searchInput}
            onChange={setSearchInput}
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder={t("Employee, code, email or type…")}
          />
        }
        activeFilters={
          (employeeFilter ? 1 : 0) + (statusFilter ? 1 : 0)
        }
      >
        <FilterSelect
          label={t("Employee")}
          value={employeeFilter}
          onChange={(v) => {
            setEmployeeFilter(v);
            setPage(1);
          }}
        >
          <option value="">{t("All employees")}</option>
          {(employees?.results ?? []).map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.display_name || emp.employee_code}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={t("Status")}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as "" | AllocationGrant["status"]);
            setPage(1);
          }}
        >
          <option value="">{t("Any status")}</option>
          <option value="active">{t("Active")}</option>
          <option value="void">{t("Removed")}</option>
        </FilterSelect>
      </FilterBar>

      <AsyncState isLoading={isLoading} error={error}>
        <div className="mt-3">
          <DataTable<AllocationGrant>
            columns={columns}
            data={data?.results ?? []}
            emptyText={t("No allocations yet.")}
            onRowClick={(r) => navigate(`/settings/allocations/${r.id}`)}
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

    </div>
  );
}
