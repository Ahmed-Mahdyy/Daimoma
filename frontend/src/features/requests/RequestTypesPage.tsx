import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { apiErrorMessage } from "../../api/client";
import {
  createRequestType,
  listRequestTypes,
  updateRequestType,
  type RequestType,
  type RequestTypeWriteInput,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { formatDate } from "../../lib/dates";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { UNIT_OPTIONS, UNIT_LABELS } from "./requestTypeUnits";
import { Link } from "react-router-dom";

interface TypeForm {
  name: string;
  unit: RequestTypeWriteInput["unit"];
  help_text: string;
  requires_manager: boolean;
  requires_hr: boolean;
}

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

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<TypeForm>({
      defaultValues: { unit: "none", requires_manager: true },
    });

  const create = useMutation({
    mutationFn: (input: RequestTypeWriteInput) => createRequestType(input),
    onSuccess: () => {
      setServerError(null);
      reset({ unit: "none", requires_manager: true });
      queryClient.invalidateQueries({ queryKey: ["request-types"] });
    },
    onError: (e) => setServerError(apiErrorMessage(e)),
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

  const input = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

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
      <span className="text-xs font-bold uppercase tracking-widest text-brand-700">{t("HR / WORKFLOWS")}</span><h1 className="mt-1 text-3xl font-bold">{t("Request types")}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {t("Each approval checkbox adds that stage to the review cycle — manager first, then HR. Unchecking both stages is not allowed; every request must have a reviewer. Changes apply to new submissions only — existing requests keep their original route.")}
      </p>
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

      <Card className="mt-8"><CardHeader><CardTitle>{t("Add a request type")}</CardTitle></CardHeader><CardContent><form
        onSubmit={handleSubmit((v) => create.mutate({ ...v, is_active: true }))}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        noValidate
      >
        <div>
          <label htmlFor="t-name" className="block text-sm font-medium">
            {t("Name")}
          </label>
          <input
            id="t-name"
            className={`mt-1 w-full ${input}`}
            {...register("name", { required: t("Name is required.") })}
          />
          {errors.name && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.name.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="t-unit" className="block text-sm font-medium">
            {t("Unit")}
          </label>
          <select
            id="t-unit"
            className={`mt-1 w-full ${input}`}
            {...register("unit")}
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Units and hours draw from employee allocations; the employee enters the amount on the request. Not measurable types collect no amount.")}
          </p>
        </div>
        <div>
          <label htmlFor="t-help" className="block text-sm font-medium">
            {t("Help text")}
          </label>
          <input id="t-help" className={`mt-1 w-full ${input}`} {...register("help_text")} />
        </div>
        <fieldset className="col-span-full">
          <legend className="text-sm font-medium">{t("Approval stages")}</legend>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("requires_manager")} />
              {t("Manager approval")}
            </label>
            <span className="text-gray-400 rtl:-rotate-180" aria-hidden="true">→</span>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("requires_hr")} />
              {t("HR approval")}
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t("Checked stages run in order; at least one stage is required.")}
          </p>
        </fieldset>

        <div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t("Adding…") : t("Add type")}
          </Button>
        </div>
      </form></CardContent></Card>
    </div>
  );
}
