import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "../../api/client";
import {
  createRequestType,
  type RequestTypeWriteInput,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";
import { PageCrumbs } from "../../components/ui/page-header";
import { UNIT_OPTIONS } from "./requestTypeUnits";

interface TypeForm {
  name: string;
  unit: RequestTypeWriteInput["unit"];
  requires_item: boolean;
  requires_dates: boolean;
  requires_allocation: boolean;
  help_text: string;
  requires_manager: boolean;
  requires_hr: boolean;
}

const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** HR request-type creation on its own page — routing (requires_hr) applies
 * to future submissions only; historical route snapshots stay immutable. */
export function RequestTypeNewPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, control, formState: { errors } } =
    useForm<TypeForm>({
      defaultValues: { unit: "none", requires_manager: true },
    });
  const unit = useWatch({ control, name: "unit" });
  // Measured units default to drawing from allocations; HR can still opt out
  // by unchecking after picking a unit.
  useEffect(() => {
    setValue("requires_allocation", unit !== "none", { shouldDirty: true });
  }, [unit, setValue]);

  const create = useMutation({
    mutationFn: (input: RequestTypeWriteInput) => createRequestType(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["request-types"] });
      navigate("/requests/types");
    },
    onError: (e) => setServerError(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-4xl">
      {serverError && (
        <div className="mb-3">
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}

      <form
        onSubmit={handleSubmit((v) =>
          create.mutate({
            ...v,
            // "none" types can never draw from an allocation balance.
            requires_allocation: v.unit === "none" ? false : v.requires_allocation,
            is_active: true,
          }),
        )}
        className="workspace-panel grid grid-cols-1 gap-4 p-6 sm:grid-cols-2"
        noValidate
      >
        <div className="sm:col-span-2">
          <PageCrumbs
            crumbs={[
              { label: t("nav.requests"), to: "/requests" },
              { label: t("nav.requestTypes"), to: "/requests/types" },
              { label: t("New request type") },
            ]}
          />
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("New request type")}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("Each approval checkbox adds that stage to the review cycle — manager first, then HR. Changes apply to new submissions only — existing requests keep their original route.")}
          </p>
        </div>
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
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("requires_item")} />
            {t("Ask for an item name (e.g. equipment or assets)")}
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={unit === "hour"}
              {...register("requires_dates")}
            />
            {t("Ask for a date range (e.g. leave, work from home)")}
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={unit === "none"}
              {...register("requires_allocation")}
            />
            {t("Draws from an allocation balance")}
          </label>
          {unit === "none" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Allocations need a measured unit (units or hours).")}
            </p>
          )}
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

        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t("Adding…") : t("Add type")}
          </Button>
          <Link
            to="/requests/types"
            className="text-sm workspace-link-quiet workspace-link-muted"
          >
            {t("Cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
