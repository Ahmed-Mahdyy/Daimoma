import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/ui/data-table";
import {
  applySortingUpdater,
  orderingToSorting,
  sortingToOrdering,
} from "@/lib/table-sorting";
import { FilterBar, SearchField } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";

import { listAuditEvents, type AuditEventRow } from "../../api/audit";
import { useLanguage } from "../../app/LanguageProvider";
import { formatDateTime } from "../../lib/dates";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";

const columns = (t: (key: string) => string): ColumnDef<AuditEventRow, unknown>[] => [
  {
    accessorKey: "occurred_at",
    header: t("When"),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-gray-500">
        {formatDateTime(row.original.occurred_at)}
      </span>
    ),
  },
  {
    accessorKey: "action",
    header: t("Action"),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.action}</span>
    ),
  },
  {
    id: "actor",
    header: t("By"),
    cell: ({ row }) =>
      row.original.actor_name ?? row.original.actor_email ?? t("system"),
  },
  {
    id: "target",
    header: t("Target"),
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.target_type}</span>
    ),
  },
  {
    id: "changes",
    header: t("Changes"),
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-xs text-gray-600">
        {Object.entries(row.original.metadata)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ") || "—"}
      </span>
    ),
  },
];

/** Scoped audit history (FR-006, amended 2026-10-17): HR sees the whole
 * organization; managers and employees have no audit access. Read-only —
 * append-only on the server. */
export function AuditPage() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [actionInput, setActionInput] = useState(params.get("action") ?? "");
  const page = Number(params.get("page") ?? 1);
  const action = params.get("action") ?? "";
  const ordering = params.get("ordering") ?? "-occurred_at";
  const sorting = orderingToSorting(ordering);

  const { data, isLoading, error } = useQuery({
    queryKey: ["auditEvents", { page, action, ordering }],
    queryFn: () =>
      listAuditEvents({ page, action: action || undefined, ordering }),
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <FilterBar
        header={
          <PageHeader
            crumbs={[
              { label: t("nav.workspace"), to: "/" },
              { label: t("nav.audit") },
            ]}
            title={t("Audit history")}
          />
        }
        search={
          <SearchField
            label={t("Action")}
            ariaLabel={t("Filter by action")}
            placeholder={t("e.g. employee_updated")}
            value={actionInput}
            onChange={setActionInput}
            onSearch={(v) => {
              const next = new URLSearchParams();
              if (v) next.set("action", v);
              setParams(next, { replace: true });
            }}
          />
        }
      />
      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={data?.results.length === 0}
        emptyText={t("No audit events yet.")}
      >
        <DataTable<AuditEventRow>
          columns={columns(t)}
          data={data?.results ?? []}
          manualSorting
          sorting={sorting}
          onSortingChange={(u) => {
            const next = new URLSearchParams(params);
            const value = sortingToOrdering(applySortingUpdater(u, sorting));
            if (value) next.set("ordering", value);
            else next.delete("ordering");
            next.delete("page");
            setParams(next, { replace: true });
          }}
          emptyText={t("No audit events yet.")}
          footer={
            data && (
              <PaginationControls
                count={data.count}
                page={page}
                pageSize={25}
                onPage={(p) => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(p));
                  setParams(next, { replace: true });
                }}
              />
            )
          }
        />
      </AsyncState>
    </div>
  );
}
