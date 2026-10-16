import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "../../app/LanguageProvider";

/** Shared sortable data table on TanStack Table: column headers toggle
 * ascending/descending order with an arrow indicator and aria-sort. Rows
 * style via the workspace-list tokens (padding, hover, dark theme).
 *
 * By default rows are sorted client-side. Pass `manualSorting` with a
 * controlled `sorting`/`onSortingChange` pair when the server owns the
 * ordering (paginated API lists); column ids map to allowlisted
 * `?ordering=` fields.
 *
 * `clientPagination` adds getPaginationRowModel + footer controls for
 * in-memory lists that are not server-paginated. */
export function DataTable<T>({
  columns,
  data,
  emptyText,
  sorting: controlledSorting,
  onSortingChange,
  manualSorting = false,
  footer,
  bare = false,
  clientPagination = false,
  pageSize = 10,
  defaultSorting,
  rowSelection,
  onRowSelectionChange,
  enableRowSelection,
  getRowId,
  onRowClick,
  rowClassName,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  emptyText?: string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  /** Rendered inside the panel below the table (e.g. PaginationControls). */
  footer?: React.ReactNode;
  /** Drop the workspace-panel wrapper (table already inside a Card). */
  bare?: boolean;
  /** Client-side paging for fully-loaded lists (server lists use footer). */
  clientPagination?: boolean;
  pageSize?: number;
  /** Initial client-side sort (ignored when `sorting` is controlled). */
  defaultSorting?: SortingState;
  /** Controlled row selection — pair with a checkbox column. */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /** Restrict which rows may be selected (e.g. only deletable drafts). */
  enableRowSelection?: boolean | ((row: Row<T>) => boolean);
  /** Stable row ids keep selection intact across server pagination. */
  getRowId?: (row: T) => string;
  /** Whole-row click/Enter/Space action (e.g. navigate to the record).
   * Clicks that land on links/buttons/inputs inside the row are ignored. */
  onRowClick?: (row: T) => void;
  /** Extra classes per body row (e.g. highlight the viewer's own rows). */
  rowClassName?: (row: T) => string;
}) {
  const { t } = useLanguage();
  const [internalSorting, setInternalSorting] = useState<SortingState>(
    defaultSorting ?? [],
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const sorting = controlledSorting ?? internalSorting;
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unmemoizable helpers; React Compiler skips this component.
  const table = useReactTable({
    columns,
    data,
    state: {
      sorting,
      ...(clientPagination ? { pagination } : {}),
      ...(rowSelection !== undefined ? { rowSelection } : {}),
    },
    onSortingChange: onSortingChange ?? setInternalSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange,
    enableRowSelection,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    ...(manualSorting ? { manualSorting: true } : { getSortedRowModel: getSortedRowModel() }),
    ...(clientPagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  });

  const pageCount = table.getPageCount();
  const showPager = clientPagination && pageCount > 1;

  return (
    <div className={bare ? "workspace-list" : "workspace-panel workspace-list"}>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    aria-sort={
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-gray-600 transition-colors hover:text-foreground dark:text-muted-foreground"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUpDown
                            className="size-3.5 opacity-40"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center text-muted-foreground"
              >
                {emptyText ?? t("Nothing to show.")}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={
                  onRowClick
                    ? (e) => {
                        if (
                          (e.target as HTMLElement).closest(
                            "a,button,input,select,textarea,label,[data-no-row-click]",
                          )
                        )
                          return;
                        onRowClick(row.original);
                      }
                    : undefined
                }
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row.original);
                        }
                      }
                    : undefined
                }
                className={`border-t transition-colors hover:bg-accent/40 ${
                  row.getIsSelected() ? "bg-brand-50/70 dark:bg-white/10" : ""
                } ${onRowClick ? "cursor-pointer" : ""} ${
                  rowClassName ? rowClassName(row.original) : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {showPager && (
        <nav
          aria-label={t("Pagination")}
          className="flex items-center justify-between gap-2 border-t border-border p-2 text-sm"
        >
          <button
            type="button"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            className="rounded-md border border-border px-3 py-1 transition-colors hover:bg-accent disabled:opacity-40"
          >
            {t("Previous")}
          </button>
          <span aria-live="polite" className="text-muted-foreground">
            {t("Page {page} of {pages} · {count} rows", {
              page: pagination.pageIndex + 1,
              pages: pageCount,
              count: data.length,
            })}
          </span>
          <button
            type="button"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            className="rounded-md border border-border px-3 py-1 transition-colors hover:bg-accent disabled:opacity-40"
          >
            {t("Next")}
          </button>
        </nav>
      )}
      {footer}
    </div>
  );
}
