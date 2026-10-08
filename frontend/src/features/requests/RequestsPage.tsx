import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  type RowSelectionState,
  type Table,
} from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { ApiError } from "../../api/client";
import {
  bulkDeleteRequests,
  deleteRequest,
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

const CHECKBOX_CLS =
  "size-4 cursor-pointer accent-brand-700 transition-opacity disabled:cursor-not-allowed disabled:opacity-30";

/** Header checkbox — selects every *selectable* row on the page; shows the
 * mixed state via the native indeterminate flag. */
function SelectAllRows({ table }: { table: Table<EmployeeRequest> }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLInputElement>(null);
  const rows = table.getRowModel().rows.filter((r) => r.getCanSelect());
  const selected = rows.filter((r) => r.getIsSelected()).length;
  const all = rows.length > 0 && selected === rows.length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !all && selected > 0;
  }, [all, selected]);
  return (
    <input
      type="checkbox"
      ref={ref}
      className={CHECKBOX_CLS}
      checked={all}
      disabled={rows.length === 0}
      onChange={() => rows.forEach((r) => r.toggleSelected(!all))}
      aria-label={t("Select all")}
    />
  );
}

const columns = (
  t: (key: string, params?: Record<string, string | number>) => string,
  onDelete: (req: EmployeeRequest) => void,
): ColumnDef<EmployeeRequest, unknown>[] => [
  {
    id: "select",
    enableSorting: false,
    header: ({ table }) => <SelectAllRows table={table} />,
    cell: ({ row }) => (
      <input
        type="checkbox"
        className={CHECKBOX_CLS}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        aria-label={t("Select request")}
        title={row.getCanSelect() ? t("Select request") : t("Only drafts can be deleted.")}
      />
    ),
  },
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
  {
    id: "actions",
    enableSorting: false,
    header: "",
    cell: ({ row }) =>
      row.original.status === "draft" ? (
        <button
          type="button"
          onClick={() => onDelete(row.original)}
          aria-label={t("Delete draft")}
          title={t("Delete draft")}
          className="grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-[#fdf2f0] hover:text-[#b42318] dark:hover:bg-[#b42318]/15"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      ) : null,
  },
];

/** Scoped request list (FR-008): the server scopes by role — employees see
 * their own work, managers their reports' non-draft work, HR the org's. */
export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedIds = Object.keys(rowSelection);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["requests"] });

  const bulkDelete = useMutation({
    mutationFn: bulkDeleteRequests,
    onSuccess: (res) => {
      setRowSelection({});
      setConfirmBulk(false);
      setNotice(
        res.skipped.length
          ? t("Deleted {deleted}; {skipped} skipped — only your own drafts can be deleted.", {
              deleted: res.deleted,
              skipped: res.skipped.length,
            })
          : t("Deleted {count} drafts.", { count: res.deleted }),
      );
      invalidate();
    },
    onError: (e) =>
      setNotice(e instanceof ApiError ? e.message : t("Delete failed — try again.")),
  });

  const deleteOne = useMutation({
    mutationFn: deleteRequest,
    onSuccess: () => {
      setDeleteTarget(null);
      setNotice(t("Draft deleted."));
      invalidate();
    },
    onError: (e) =>
      setNotice(e instanceof ApiError ? e.message : t("Delete failed — try again.")),
  });

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
      <FilterBar
        header={
          <PageHeader
            eyebrow={t("WORKSPACE / REQUESTS")}
            title={t("Requests")}
            description={t("Track submissions and keep every decision in view.")}
            actions={
              <Link to="/requests/new" className="workspace-primary">
                {t("New request")}
              </Link>
            }
          />
        }
        activeFilters={[filters.status, filters.type].filter(Boolean).length}
        search={
          <SearchField
            label={t("Search")}
            ariaLabel={t("Search requests")}
            value={searchInput}
            onChange={setSearchInput}
            onSearch={(v) => setParam("search", v)}
            placeholder={t("Title or description…")}
          />
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

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200/80 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#1e3a3f]">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t("{count} selected", { count: selectedIds.length })}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRowSelection({})}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-accent dark:text-slate-300"
            >
              {t("Clear selection")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmBulk(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#b42318] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#932018]"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("Delete selected")}
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-4 text-sm font-medium text-slate-600 dark:text-slate-300">
          {notice}
        </p>
      )}

      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={!data || data.results.length === 0}
        emptyText={t("No requests match your filters.")}
      >
        <DataTable<EmployeeRequest>
          columns={columns(t, setDeleteTarget)}
          data={data?.results ?? []}
          manualSorting
          sorting={sorting}
          onSortingChange={(u) =>
            setParam("ordering", sortingToOrdering(applySortingUpdater(u, sorting)))
          }
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          enableRowSelection={(row) => row.original.status === "draft"}
          getRowId={(r) => r.id}
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

      <ConfirmDialog
        open={confirmBulk}
        danger
        title={t("Delete selected drafts?")}
        body={
          selectedIds.length === 1
            ? t("This will permanently delete 1 draft request. This cannot be undone.")
            : t(
                "This will permanently delete {count} draft requests. This cannot be undone.",
                { count: selectedIds.length },
              )
        }
        confirmLabel={t("Delete")}
        onConfirm={() => bulkDelete.mutate(selectedIds)}
        onCancel={() => setConfirmBulk(false)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        danger
        title={t("Delete this draft?")}
        body={t("This will permanently delete “{title}”. This cannot be undone.", {
          title: deleteTarget?.title ?? "",
        })}
        confirmLabel={t("Delete")}
        onConfirm={() => deleteTarget && deleteOne.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
