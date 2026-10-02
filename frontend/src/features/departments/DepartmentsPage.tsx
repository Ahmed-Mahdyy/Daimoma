import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";

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
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["departments"] });

  const createMutation = useMutation({
    mutationFn: () => createDepartment(newName.trim()),
    onSuccess: () => {
      setNewName("");
      setNotice(t("Department created."));
      void invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("Failed.")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name?: string; is_active?: boolean }) =>
      updateDepartment(input.id, { name: input.name, is_active: input.is_active }),
    onSuccess: () => {
      setRenaming(null);
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
        cell: ({ row }) => {
          const d = row.original;
          if (renaming === d.id) {
            return (
              <span className="flex items-center gap-2">
                <Input
                  aria-label={t("Rename {name}", { name: d.name })}
                  className="max-w-xs"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
                <button
                  type="button"
                  className="workspace-link"
                  onClick={() =>
                    updateMutation.mutate({ id: d.id, name: renameValue.trim() })
                  }
                >
                  {t("Save")}
                </button>
                <button
                  type="button"
                  className="workspace-link workspace-link-muted"
                  onClick={() => setRenaming(null)}
                >
                  {t("Cancel")}
                </button>
              </span>
            );
          }
          return (
            <Link
              to={`/departments/${d.id}`}
              className={`font-medium workspace-link-quiet ${d.is_active ? "" : "text-gray-400 line-through"}`}
            >
              {d.name}
            </Link>
          );
        },
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
            <span className="flex items-center gap-3">
              <button
                type="button"
                className="workspace-link"
                onClick={() => {
                  setRenaming(d.id);
                  setRenameValue(d.name);
                }}
              >
                {t("Rename")}
              </button>
              {d.is_active ? (
                <button
                  type="button"
                  className="workspace-link workspace-link-danger"
                  onClick={() => setDeactivating(d.id)}
                >
                  {t("Deactivate")}
                </button>
              ) : (
                <button
                  type="button"
                  className="workspace-link workspace-link-success"
                  onClick={() =>
                    updateMutation.mutate({ id: d.id, is_active: true })
                  }
                >
                  {t("Reactivate")}
                </button>
              )}
            </span>
          );
        },
      },
    ],
    [renaming, renameValue, updateMutation, t],
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
        <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
          {t("Add department")}
        </Button>
      </form></CardContent></Card>

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
