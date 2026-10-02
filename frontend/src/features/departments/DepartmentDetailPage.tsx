import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";

import { getDepartment } from "../../api/departments";
import { listEmployees, type EmployeeSummary } from "../../api/employees";
import { useLanguage } from "../../app/LanguageProvider";
import { AsyncState } from "../../components/ui/AsyncState";

const PAGE_SIZE = 10;

const columns = (t: (key: string) => string): ColumnDef<EmployeeSummary, unknown>[] => [
  {
    accessorKey: "display_name",
    header: t("Name"),
    cell: ({ row }) => (
      <Link
        to={`/employees/${row.original.id}`}
        className="font-medium workspace-link-quiet"
      >
        {row.original.display_name || row.original.email}
      </Link>
    ),
  },
  {
    accessorKey: "employee_code",
    header: t("Code"),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.employee_code}</span>
    ),
  },
  {
    accessorKey: "job_title",
    header: t("Job title"),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.job_title || "—"}
      </span>
    ),
  },
  {
    id: "manager",
    header: t("Manager"),
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.manager_name || "—"}
      </span>
    ),
  },
  {
    id: "is_active",
    header: t("Status"),
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "secondary"}>
        {row.original.is_active ? t("Active") : t("Inactive")}
      </Badge>
    ),
  },
];

/** HR department record: details plus the current members, paginated via the
 * server-scoped directory (department filter + ?page=). */
export function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("employee_code");
  const sorting = orderingToSorting(ordering);

  const { data: dept, isLoading, error } = useQuery({
    queryKey: ["department", id],
    queryFn: () => getDepartment(id!),
    enabled: !!id,
  });

  const members = useQuery({
    queryKey: ["employees", "department", id, page, ordering],
    queryFn: () =>
      listEmployees({ department: id, ordering, page, page_size: PAGE_SIZE }),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });

  if (!dept) {
    return <AsyncState isLoading={isLoading} error={error}>{null}</AsyncState>;
  }

  const total = members.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-widest text-brand-700">{t("HR / ORGANIZATION")}</span>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{dept.name}</h1>
        <Badge variant={dept.is_active ? "default" : "secondary"}>
          {dept.is_active ? t("Active") : t("Inactive")}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Department record — members below reflect the current assignment.")}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("Current employees")} ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncState
            isLoading={members.isLoading}
            error={members.error}
            isEmpty={members.data?.results.length === 0}
            emptyText={t("No employees are assigned to this department.")}
          >
            <DataTable<EmployeeSummary>
              columns={columns(t)}
              data={members.data?.results ?? []}
              bare
              manualSorting
              sorting={sorting}
              onSortingChange={(u) => {
                setOrdering(
                  sortingToOrdering(applySortingUpdater(u, sorting)) ||
                    "employee_code",
                );
                setPage(1);
              }}
              emptyText={t("No employees are assigned to this department.")}
            />
            {pages > 1 && (
              <nav aria-label={t("Members pages")} className="mt-4 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("Previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("Page {page} of {pages}", { page, pages })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("Next")}
                </Button>
              </nav>
            )}
          </AsyncState>
        </CardContent>
      </Card>
    </div>
  );
}
