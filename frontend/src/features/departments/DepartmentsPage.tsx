import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, SearchField } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { managerChoices } from "../../api/employees";

import {
  createDepartment,
  listDepartments,
  updateDepartment,
  type Department,
} from "../../api/departments";
import { useLanguage } from "../../app/LanguageProvider";
import { formatDate } from "../../lib/dates";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

/** HR department management: add/rename/deactivate — never delete, so
 * member history stays intact. */
export function DepartmentsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const [newName, setNewName] = useState("");
  const [newManager, setNewManager] = useState("");
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const search = params.get("search") ?? "";

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["departments", { search }],
    queryFn: () => listDepartments({ search }),
  });
  const { data: managers } = useQuery({
    queryKey: ["managerChoices"],
    queryFn: () => managerChoices(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["departments"] });

  const setSearchParam = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("search", value);
    else next.delete("search");
    setParams(next, { replace: true });
  };

  const createMutation = useMutation({
    mutationFn: () => createDepartment(newName.trim(), newManager || null),
    onSuccess: () => {
      setNewName("");
      setNewManager("");
      setNotice(t("Department created."));
      void invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("Failed.")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name?: string; is_active?: boolean }) =>
      updateDepartment(input.id, { name: input.name, is_active: input.is_active }),
    onSuccess: () => {
      setDeactivating(null);
      setNotice(t("Department updated."));
      void invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("Failed.")),
  });

  const columns = useMemo<ColumnDef<Department, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("Name"),
        cell: ({ row }) => (
          <Link
            to={`/departments/${row.original.id}`}
            className={`font-medium workspace-link-quiet ${row.original.is_active ? "" : "text-gray-400 line-through"}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "manager_name",
        header: t("Manager"),
        cell: ({ row }) => row.original.manager_name || "—",
      },
      {
        accessorKey: "is_active",
        header: t("Status"),
        sortingFn: (a, b) =>
          Number(b.original.is_active) - Number(a.original.is_active),
        cell: ({ row }) =>
          row.original.is_active ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {t("Active")}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {t("Inactive")}
            </span>
          ),
      },
      {
        accessorKey: "created_at",
        header: t("Created"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("Actions"),
        enableSorting: false,
        cell: ({ row }) => {
          const d = row.original;
          return (
            <span className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/departments/${d.id}?edit=true`}>{t("Edit")}</Link>
              </Button>
              {d.is_active ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeactivating(d.id)}
                >
                  {t("Deactivate")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    updateMutation.mutate({ id: d.id, is_active: true })
                  }
                >
                  {t("Reactivate")}
                </Button>
              )}
            </span>
          );
        },
      },
    ],
    [updateMutation, t],
  );

  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-widest text-brand-700">{t("HR / ORGANIZATION")}</span>
      <h1 className="mt-1 text-3xl font-bold">{t("Departments")}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {t("Deactivated departments keep their history; members become unassigned.")}
      </p>

      {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mt-3"><Alert kind="success">{notice}</Alert></div>}

      <Card className="mt-5"><CardHeader><CardTitle>{t("Add a department")}</CardTitle></CardHeader><CardContent><form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setNotice(null);
          if (newName.trim()) createMutation.mutate();
        }}
      >
        <Input
          aria-label={t("New department name")}
          placeholder={t("New department name")}
          className="min-w-44 flex-1"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <label className="flex min-w-44 flex-1 items-center gap-2 text-sm">
          {t("Manager")}
          <select className="min-w-0 flex-1 rounded-md border px-2 py-2" value={newManager} onChange={(e) => setNewManager(e.target.value)}>
            <option value="">{t("None")}</option>
            {managers?.results.filter((m) => m.roles.includes("Manager")).map((m) => (
              <option key={m.id} value={m.id}>{m.display_name || m.employee_code}</option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
          {t("Add department")}
        </Button>
      </form></CardContent></Card>

      <FilterBar>
        <SearchField
          label={t("Search")}
          ariaLabel={t("Search departments")}
          value={searchInput}
          onChange={setSearchInput}
          onSearch={setSearchParam}
          placeholder={t("Department or manager…")}
        />
      </FilterBar>

      <AsyncState isLoading={isLoading} error={loadError} isEmpty={data?.results.length === 0} emptyText={t("No departments yet.")}>
        <div className="mt-5">
          <DataTable
            columns={columns}
            data={data?.results ?? []}
            emptyText={t("No departments yet.")}
            clientPagination
            defaultSorting={[{ id: "created_at", desc: true }]}
          />
        </div>
      </AsyncState>

      <ConfirmDialog
        open={deactivating !== null}
        danger
        title={t("Deactivate department?")}
        body={t("Members of this department become unassigned. The department and its history are preserved.")}
        confirmLabel={t("Deactivate")}
        onConfirm={() =>
          deactivating &&
          updateMutation.mutate({ id: deactivating, is_active: false })
        }
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}
