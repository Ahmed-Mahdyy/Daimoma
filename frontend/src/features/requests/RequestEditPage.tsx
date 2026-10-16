import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import {
  getRequest,
  listRequestTypes,
  submitRequest,
  updateRequest,
  type RequestDraftInput,
} from "../../api/requests";
import { AsyncState } from "../../components/ui/AsyncState";
import { RangeInput, TimeRangeInput } from "../../components/ui/range-input";
import { useLanguage } from "../../app/LanguageProvider";
import { chargedHours, countWorkingDays } from "../../lib/dates";
import { useAuth } from "../auth/auth-context";
import { AllocationBalance } from "./AllocationBalance";

interface FormValues {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  equipment_item: string;
  quantity: string;
  hours: string;
}

/** Edit a draft or returned request (FR-002/FR-005): saves send the current
 * version; a 409 refreshes the loaded data instead of silently losing work. */
export function RequestEditPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: req, isLoading, error } = useQuery({
    queryKey: ["request", id],
    queryFn: () => getRequest(id!),
    enabled: !!id,
  });
  const { data: types } = useQuery({
    queryKey: ["request-types"],
    queryFn: listRequestTypes,
  });

  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (req) {
      reset({
        title: req.title,
        description: req.description,
        start_date: req.start_date ?? "",
        end_date: req.end_date ?? "",
        start_time: req.start_time?.slice(0, 5) ?? "",
        end_time: req.end_time?.slice(0, 5) ?? "",
        equipment_item: req.equipment_item,
        quantity: req.quantity != null ? String(req.quantity) : "",
        hours: req.hours != null ? String(req.hours) : "",
      });
    }
  }, [req, reset]);

  const type = types?.results.find((t) => t.id === req?.type);
  const unit = req?.type_unit ?? type?.unit;
  const startDate = useWatch({ control, name: "start_date" });
  const endDate = useWatch({ control, name: "end_date" });
  // Dated "unit" requests derive quantity from the range's working-day count;
  // the server recomputes it on save — this mirrors the value for display.
  const derivedQuantity =
    unit === "unit" && !type?.requires_item && startDate && endDate
      ? countWorkingDays(startDate, endDate, user?.org_working_weekdays ?? [])
      : null;
  useEffect(() => {
    if (derivedQuantity !== null) setValue("quantity", String(derivedQuantity));
  }, [derivedQuantity, setValue]);

  // Hour types: billed hours derive from the from/to times (15-minute
  // blocks, 30-minute minimum); the field is read-only display and the
  // server recomputes on save.
  const startTime = useWatch({ control, name: "start_time" });
  const endTime = useWatch({ control, name: "end_time" });
  const derivedHours =
    unit === "hour" && startTime && endTime
      ? chargedHours(startTime, endTime)
      : null;
  useEffect(() => {
    setValue("hours", derivedHours === null ? "" : String(derivedHours));
  }, [derivedHours, setValue]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["request", id] });
    queryClient.invalidateQueries({ queryKey: ["requests"] });
  };

  const onError = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 409) {
        setServerError(
          t("This request changed since you loaded it — the latest data has been reloaded."),
        );
        refresh();
      } else {
        setServerError(e.message);
        if (e.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(e.fieldErrors)) {
            mapped[k] = Array.isArray(v) ? String(v[0]) : String(v);
          }
          setFieldErrors(mapped);
        }
      }
    } else {
      setServerError(t("Something went wrong. Please try again."));
    }
  };

  const save = useMutation({
    mutationFn: (body: Partial<RequestDraftInput>) => updateRequest(id!, body),
    onSuccess: () => {
      setServerError(null);
      refresh();
      navigate(`/requests/${id}`);
    },
    onError,
  });

  const saveAndSubmit = useMutation({
    mutationFn: async (body: Partial<RequestDraftInput>) => {
      const updated = await updateRequest(id!, body);
      return submitRequest(id!, updated.version);
    },
    onSuccess: () => {
      setServerError(null);
      refresh();
      navigate(`/requests/${id}`);
    },
    onError,
  });

  const buildBody = (values: FormValues): Partial<RequestDraftInput> => {
    const body: Partial<RequestDraftInput> = {
      title: values.title,
      description: values.description,
      version: req?.version,
    };
    body.start_date = values.start_date || null;
    // "hour" types cover a single day — pin end_date to the chosen date so a
    // stale stored/hidden value can't violate the server's end == start rule.
    body.end_date =
      unit === "hour" ? values.start_date || null : values.end_date || (values.start_date || null);
    body.start_time = values.start_time || null;
    body.end_time = values.end_time || null;
    body.equipment_item = values.equipment_item;
    body.quantity = values.quantity ? Number(values.quantity) : null;
    // Hour types: the server derives billed hours from the times — the
    // read-only field is display only.
    return body;
  };

  const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
  const err = (name: keyof FormValues) => (
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

  const busy = save.isPending || saveAndSubmit.isPending;

  return (
    <div className="mx-auto max-w-4xl">
      <AsyncState isLoading={isLoading} error={error} emptyText="">
        {req && (
          <>
            <form
              onSubmit={handleSubmit((v) => {
                setServerError(null);
                setFieldErrors({});
                save.mutate(buildBody(v));
              })}
              className="workspace-panel flex flex-col gap-4 p-6"
              noValidate
            >
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {req.status === "returned" ? t("Revise returned request") : t("Edit draft")}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  {req.type_name}
                  {req.status === "returned" &&
                    ` — ${t("reviewer comments are on the request detail page.")}`}
                </p>
                <AllocationBalance
                  typeId={req.type}
                  requiresAllocation={unit === "unit" || unit === "hour"}
                />
              </div>
              <div>
                <label htmlFor="title" className="block text-sm font-medium">
                  {t("Title")}
                </label>
                <input
                  id="title"
                  className={input}
                  aria-invalid={!!errors.title || !!fieldErrors.title}
                  {...register("title", { required: t("Title is required.") })}
                />
                {err("title")}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium">
                  {t("Details")}
                </label>
                <textarea
                  id="description"
                  rows={4}
                  className={input}
                  aria-invalid={!!errors.description || !!fieldErrors.description}
                  {...register("description")}
                />
                {err("description")}
              </div>

              {type?.requires_item && (
                <div>
                  <label
                    htmlFor="equipment_item"
                    className="block text-sm font-medium"
                  >
                    {t("Item")}
                  </label>
                  <input
                    id="equipment_item"
                    className={input}
                    aria-invalid={
                      !!errors.equipment_item || !!fieldErrors.equipment_item
                    }
                    {...register("equipment_item")}
                  />
                  {err("equipment_item")}
                </div>
              )}

              {(unit === "unit" || type?.requires_dates) && (
                <>
                  <div className="sm:max-w-md">
                    <span className="block text-sm font-medium">
                      {t("Start – End date")}
                    </span>
                    <RangeInput
                      fromLabel={t("Start date")}
                      toLabel={t("End date")}
                      invalid={
                        !!(
                          errors.start_date ||
                          errors.end_date ||
                          fieldErrors.start_date ||
                          fieldErrors.end_date
                        )
                      }
                      from={{
                        id: "start_date",
                        ...register("start_date", {
                          required:
                            type?.requires_dates ||
                            (unit === "unit" && !type?.requires_item)
                              ? unit === "unit"
                                ? t("Required to count the quantity.")
                                : t("Dates are required for this type.")
                              : false,
                        }),
                      }}
                      to={{
                        id: "end_date",
                        ...register("end_date", {
                          required:
                            type?.requires_dates ||
                            (unit === "unit" && !type?.requires_item)
                              ? unit === "unit"
                                ? t("Required to count the quantity.")
                                : t("Dates are required for this type.")
                              : false,
                          validate: (v, values) =>
                            !v ||
                            !values.start_date ||
                            v >= values.start_date ||
                            t("End date must not be before the start date."),
                        }),
                      }}
                    />
                    {err("start_date")}
                    {err("end_date")}
                  </div>
                </>
              )}

              {unit === "unit" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="quantity" className="block text-sm font-medium">
                        {t("Quantity")}
                      </label>
                      <input
                        id="quantity"
                        type="number"
                        min={1}
                        className={`${input} ${!type?.requires_item ? "bg-slate-50 text-slate-500 dark:bg-white/5" : ""}`}
                        readOnly={!type?.requires_item}
                        aria-invalid={!!errors.quantity || !!fieldErrors.quantity}
                        {...register("quantity", {
                          required: type?.requires_item
                            ? t("Quantity is required for this type.")
                            : false,
                          min: { value: 1, message: t("Quantity must be at least 1.") },
                        })}
                      />
                      {type?.requires_item ? (
                        err("quantity")
                      ) : derivedQuantity !== null ? (
                        <p
                          className={`mt-1 text-xs ${
                            derivedQuantity === 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {derivedQuantity === 0
                            ? t("The selected dates contain no working days.")
                            : t("Counted automatically from the selected dates.")}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t("Choose the dates above to count the quantity.")}
                        </p>
                      )}
                    </div>
                  </div>
              )}

              {unit === "hour" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="start_date" className="block text-sm font-medium">
                        {t("Date")}
                      </label>
                      <input
                        id="start_date"
                        type="date"
                        className={input}
                        aria-invalid={!!errors.start_date || !!fieldErrors.start_date}
                        {...register("start_date", {
                          required: t("Dates are required for this type."),
                        })}
                      />
                      {err("start_date")}
                    </div>
                    <div>
                      <span className="block text-sm font-medium">
                        {t("From – To")}
                      </span>
                      <TimeRangeInput
                        fromLabel={t("From")}
                        toLabel={t("To")}
                        invalid={
                          !!(
                            errors.start_time ||
                            errors.end_time ||
                            fieldErrors.start_time ||
                            fieldErrors.end_time
                          )
                        }
                        from={{
                          id: "start_time",
                          ...register("start_time", {
                            required: t("Times are required for this type."),
                          }),
                        }}
                        to={{
                          id: "end_time",
                          ...register("end_time", {
                            required: t("Times are required for this type."),
                            validate: (v, values) =>
                              !v ||
                              !values.start_time ||
                              v > values.start_time ||
                              t("End time must be after the start time."),
                          }),
                        }}
                      />
                      {err("start_time")}
                      {err("end_time")}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="hours" className="block text-sm font-medium">
                      {t("Hours")}
                    </label>
                    <input
                      id="hours"
                      type="number"
                      readOnly
                      className={input}
                      aria-invalid={!!errors.hours || !!fieldErrors.hours}
                      {...register("hours")}
                    />
                    {derivedHours === null ? (
                      <p className="mt-1 text-xs text-gray-500">
                        {t("Choose the times above to count the hours.")}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500">
                        {t("Billed in 15-minute blocks (30 minutes minimum).")}
                      </p>
                    )}
                    {err("hours")}
                  </div>
                </>
              )}

              {serverError && (
                <p
                  role="alert"
                  className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200"
                >
                  {serverError}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy ? t("Saving…") : t("Save changes")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSubmit((v) => {
                    setServerError(null);
                    setFieldErrors({});
                    saveAndSubmit.mutate(buildBody(v));
                  })}
                  className="rounded-md border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 disabled:opacity-60"
                >
                  {busy ? t("Working…") : req.cycle === 0 ? t("Save & submit") : t("Save & resubmit")}
                </button>
                <Link
                  to={`/requests/${req.id}`}
                  className="text-sm workspace-link-quiet workspace-link-muted"
                >
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
