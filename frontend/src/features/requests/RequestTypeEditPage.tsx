import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError, apiErrorMessage } from "../../api/client";
import {
  getRequestType,
  updateRequestType,
  type RequestTypeWriteInput,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { Button } from "@/components/ui/button";
import { UNIT_OPTIONS } from "./requestTypeUnits";

interface TypeForm {
  name: string;
  unit: RequestTypeWriteInput["unit"];
  help_text: string;
  requires_manager: boolean;
  requires_hr: boolean;
  is_active: boolean;
}

/** HR request-type edit (FR-009/008): full configuration of one type —
 * name, unit, approval stages, availability. The unit decides whether the
 * type draws from allocations and which amount the employee enters.
 * The server enforces the unit-lock after allocation use. */
export function RequestTypeEditPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: type, isLoading, error, refetch } = useQuery({
    queryKey: ["request-type", id],
    queryFn: () => getRequestType(id!),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TypeForm>();

  useEffect(() => {
    if (type) {
      reset({
        name: type.name,
        unit: type.unit,
        help_text: type.help_text ?? "",
        requires_manager: !!type.requires_manager,
        requires_hr: !!type.requires_hr,
        is_active: type.is_active !== false,
      });
    }
  }, [type, reset]);

  const save = useMutation({
    mutationFn: (body: Partial<RequestTypeWriteInput>) => updateRequestType(id!, body),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ["request-types"] });
      queryClient.invalidateQueries({ queryKey: ["request-type", id] });
      navigate("/requests/types");
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setServerError(apiErrorMessage(e));
        if (e.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(e.fieldErrors)) {
            mapped[k] = Array.isArray(v) ? String(v[0]) : String(v);
          }
          setFieldErrors(mapped);
        }
        if (e.status === 409) void refetch();
      } else {
        setServerError(t("Something went wrong. Please try again."));
      }
    },
  });

  const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
  const err = (name: keyof TypeForm) => (
    <>
      {errors[name] && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {errors[name]?.message}
        </p>
      )}
      {fieldErrors[name] && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {fieldErrors[name]}
        </p>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <AsyncState isLoading={isLoading} error={error}>
        {type && (
          <>
            <h1 className="text-2xl font-semibold">{t("Edit request type")}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {t("Changes apply to new submissions — existing requests keep their original route.")}
            </p>
            {serverError && (
              <div className="mt-3">
                <Alert kind="error">{serverError}</Alert>
              </div>
            )}
            <form
              className="mt-6 flex flex-col gap-4"
              noValidate
              onSubmit={handleSubmit((v) => {
                setServerError(null);
                setFieldErrors({});
                save.mutate(v);
              })}
            >
              <div>
                <label htmlFor="name" className="block text-sm font-medium">
                  {t("Name")}
                </label>
                <input
                  id="name"
                  className={input}
                  aria-invalid={!!errors.name || !!fieldErrors.name}
                  {...register("name", { required: t("Name is required.") })}
                />
                {err("name")}
              </div>

              <div>
                <label htmlFor="unit" className="block text-sm font-medium">
                  {t("Unit")}
                </label>
                <select
                  id="unit"
                  className={input}
                  aria-invalid={!!fieldErrors.unit}
                  {...register("unit")}
                >
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.label)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Units and hours draw from employee allocations; the employee enters the amount on the request. Not measurable types collect no amount. The unit cannot change after the type has allocations or requests.")}
                </p>
                {err("unit")}
              </div>

              <div>
                <label htmlFor="help_text" className="block text-sm font-medium">
                  {t("Help text")}
                </label>
                <input
                  id="help_text"
                  className={input}
                  {...register("help_text")}
                />
                {err("help_text")}
              </div>

              <fieldset>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Checked stages run in order; at least one stage is required.")}
                </p>
                {fieldErrors.requires_hr && (
                  <p role="alert" className="mt-1 text-sm text-red-700">
                    {fieldErrors.requires_hr}
                  </p>
                )}
              </fieldset>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("is_active")} />
                {t("Active")}
              </label>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? t("Saving…") : t("Save changes")}
                </Button>
                <Link to="/requests/types" className="text-sm workspace-link-quiet workspace-link-muted">
                  {t("Cancel")}
                </Link>
              </div>
            </form>
          </>
        )}
      </AsyncState>
    </div>
  );
}
