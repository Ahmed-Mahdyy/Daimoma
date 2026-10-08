import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeaderCard } from "@/components/ui/page-header";
import { apiErrorMessage } from "../../api/client";
import {
  listRequestTypes,
  updateRequestType,
  type RequestType,
  type RequestTypeWriteInput,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { formatDate } from "../../lib/dates";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { UNIT_LABELS } from "./requestTypeUnits";
import { Link } from "react-router-dom";

/** HR request-type administration (FR-009): create typed categories and set
 * routing (requires_hr) + availability. Changes affect future submissions
 * only — historical route snapshots stay immutable. */
export function RequestTypesPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["request-types"],
    queryFn: listRequestTypes,
  });

  const patch = useMutation({
    mutationFn: (v: { id: string; body: Partial<RequestTypeWriteInput> }) =>
      updateRequestType(v.id, v.body),
    // Optimistic toggle: flip the checkbox immediately, roll back on error
    // so a rejected empty-chain PATCH snaps back instead of flickering.
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: ["request-types"] });
      const prev = queryClient.getQueryData<{ results: { id: string }[] }>(
        ["request-types"],
      );
      queryClient.setQueryData(["request-types"], (old: { results: { id: string }[] } | undefined) =>
        old
          ? {
              ...old,
              results: old.results.map((t) =>
                t.id === v.id ? { ...t, ...v.body } : t,
              ),
            }
          : old,
      );
      setServerError(null);
      return { prev };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["request-types"] }),
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["request-types"], ctx.prev);
      setServerError(apiErrorMessage(e));
    },
  });

  const columns: ColumnDef<RequestType, unknown>[] = [
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => (
        <Link
          to={`/requests/types/${row.original.id}/edit`}
          className="font-medium workspace-link-quiet"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "unit",
      header: t("Unit"),
      cell: ({ row }) => (
        <span className="text-gray-600">
          {t(UNIT_LABELS[row.original.unit] ?? row.original.unit)}
        </span>
      ),
    },
    {
      id: "approval",
      header: t("Approval stages"),
      enableSorting: false,
      cell: ({ row }) => {
        const rt = row.original;
        return (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 whitespace-nowrap">
              <input
                type="checkbox"
                checked={!!rt.requires_manager}
                aria-label={t("Manager approval for {name}", { name: rt.name })}
                onChange={(e) =>
                  patch.mutate({
                    id: rt.id,
                    body: { requires_manager: e.target.checked },
                  })
                }
              />
              {t("Manager")}
            </label>
            <span className="text-gray-400 rtl:-rotate-180" aria-hidden="true">→</span>
            <label className="flex items-center gap-1.5 whitespace-nowrap">
              <input
                type="checkbox"
                checked={!!rt.requires_hr}
                aria-label={t("HR approval for {name}", { name: rt.name })}
                onChange={(e) =>
                  patch.mutate({
                    id: rt.id,
                    body: { requires_hr: e.target.checked },
                  })
                }
              />
              HR
            </label>
          </div>
        );
      },
    },
    {
      accessorKey: "requires_allocation",
      header: t("Allocated"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.unit === "none" ? t("No") : t("Yes")}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: t("Active"),
      cell: ({ row }) => {
        const rt = row.original;
        return (
          <input
            type="checkbox"
            checked={!!rt.is_active}
            aria-label={t("Active for {name}", { name: rt.name })}
            onChange={(e) =>
              patch.mutate({
                id: rt.id,
                body: { is_active: e.target.checked },
              })
            }
          />
        );
      },
    },
    {
      accessorKey: "created_at",
      header: t("Created"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.created_at
            ? formatDate(row.original.created_at)
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeaderCard
        eyebrow={t("HR / WORKFLOWS")}
        title={t("Request types")}
        description={t("Each approval checkbox adds that stage to the review cycle — manager first, then HR. Unchecking both stages is not allowed; every request must have a reviewer. Changes apply to new submissions only — existing requests keep their original route.")}
        actions={
          <Button asChild>
            <Link to="/requests/types/new">{t("New request type")}</Link>
          </Button>
        }
      />
      {serverError && (
        <div className="mt-3">
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}

      <AsyncState isLoading={isLoading} error={error}>
        <div className="mt-4">
          <DataTable<RequestType>
            columns={columns}
            data={data?.results ?? []}
            emptyText={t("No request types yet.")}
            clientPagination
            defaultSorting={[{ id: "created_at", desc: true }]}
          />
        </div>
      </AsyncState>
    </div>
  );
}
