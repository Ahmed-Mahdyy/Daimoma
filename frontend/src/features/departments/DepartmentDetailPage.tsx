import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";

import { getDepartment, updateDepartment } from "../../api/departments";
import { listEmployees, managerChoices, type EmployeeSummary } from "../../api/employees";
import { useLanguage } from "../../app/LanguageProvider";
import { AsyncState } from "../../components/ui/AsyncState";
import { Alert } from "../../components/ui/Alert";

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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [edit, setEdit] = useState<{ name: string; manager: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const { data: managers } = useQuery({
    queryKey: ["managerChoices"],
    queryFn: () => managerChoices(),
  });
  const update = useMutation({
    mutationFn: (input: { name: string; manager: string | null }) => updateDepartment(id!, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(["department", id], saved);
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
      setEdit(null);
      setSearchParams({}, { replace: true });
      setNotice(t("Department updated."));
      setErrorMessage(null);
    },
    onError: (e) => setErrorMessage(e instanceof Error ? e.message : t("Failed.")),
  });

  if (!dept) {
    return <AsyncState isLoading={isLoading} error={error}>{null}</AsyncState>;
  }

  const total = members.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const editing = edit !== null || searchParams.get("edit") === "true";
  const values = edit ?? { name: dept.name, manager: dept.manager ?? "" };

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
      {errorMessage && <div className="mt-4"><Alert kind="error">{errorMessage}</Alert></div>}
      {notice && <div className="mt-4"><Alert kind="success">{notice}</Alert></div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle>{t("Name")}</CardTitle></CardHeader><CardContent>{dept.name}</CardContent></Card>
        <Card><CardHeader><CardTitle>{t("Manager")}</CardTitle></CardHeader><CardContent>{dept.manager ? (
          <Link className="workspace-link-quiet" to={`/employees/${dept.manager}`}>{dept.manager_name || t("Manager")}</Link>
        ) : t("None")}</CardContent></Card>
        <Card><CardHeader><CardTitle>{t("Employees count")}</CardTitle></CardHeader><CardContent>{members.isLoading ? t("Loading…") : members.error ? t("Failed.") : total}</CardContent></Card>
      </div>
      {!editing ? (
        <Button type="button" className="mt-5" variant="outline" onClick={() => setEdit({ name: dept.name, manager: dept.manager ?? "" })}>{t("Edit")}</Button>
      ) : (
        <form className="workspace-panel mt-5 grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setErrorMessage(null); update.mutate({ name: values.name.trim(), manager: values.manager || null }); }}>
          <label className="text-sm font-medium">{t("Name")}
            <input className="mt-1 block w-full rounded-md border px-3 py-2" required maxLength={120} value={values.name} onChange={(e) => setEdit({ ...values, name: e.target.value })} />
          </label>
          <label className="text-sm font-medium">{t("Manager")}
            <select className="mt-1 block w-full rounded-md border px-3 py-2" value={values.manager} onChange={(e) => setEdit({ ...values, manager: e.target.value })}>
              <option value="">{t("None")}</option>
              {managers?.results.filter((m) => m.roles.includes("Manager") || m.id === dept.manager).map((m) => (
                <option key={m.id} value={m.id}>{m.display_name || m.employee_code}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={update.isPending || !values.name.trim()}>{t("Save")}</Button>
            <Button type="button" variant="outline" onClick={() => { setEdit(null); setSearchParams({}, { replace: true }); setErrorMessage(null); }}>{t("Cancel")}</Button>
          </div>
        </form>
      )}

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
