import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ApiError, apiErrorMessage } from "../../api/client";
import {
  ALLOCATION_UNIT_LABELS,
  createRequest,
  formatAllocationAmount,
  getAllocationPreview,
  listRequestTypes,
  type RequestDraftInput,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { AsyncState } from "../../components/ui/AsyncState";
import { RangeInput, TimeRangeInput } from "../../components/ui/range-input";
import { chargedHours, countWorkingDays } from "../../lib/dates";
import { useAuth } from "../auth/auth-context";
import { AllocationBalance } from "./AllocationBalance";

interface FormValues {
  type: string;
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

/** New-request form (FR-001/008): the selected type's unit decides the
 * measured input — a quantity for "unit" types, an hours amount for "hour"
 * types, nothing for "none". Dates/times stay optional context. */
export function RequestFormPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const candidate = params.get("date") ?? "";
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(candidate)) ? candidate : "";
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: types, isLoading, error } = useQuery({
    queryKey: ["request-types"],
    queryFn: listRequestTypes,
  });

  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { quantity: "", hours: "", start_date: selectedDate, end_date: selectedDate } });

  const typeId = useWatch({ control, name: "type" });
  const values = useWatch({ control });
  const selectedType = types?.results.find((t) => t.id === typeId);
  const unit = selectedType?.unit;

  // For dated "unit" types (e.g. leave) the quantity is the working-day count
  // of the selected range — derived, never typed by hand. The server
  // recomputes it on save; this only mirrors the value for display.
  const derivedQuantity =
    unit === "unit" &&
    !selectedType?.requires_item &&
    values.start_date &&
    values.end_date
      ? countWorkingDays(
          values.start_date,
          values.end_date,
          user?.org_working_weekdays ?? [],
        )
      : null;
  useEffect(() => {
    if (derivedQuantity !== null) setValue("quantity", String(derivedQuantity));
  }, [derivedQuantity, setValue]);

  // For "hour" types the billed amount is derived from the from/to times —
  // 15-minute blocks, 30-minute minimum — mirroring the server. The field is
  // read-only display; the server recomputes on save.
  const derivedHours =
    unit === "hour" && values.start_time && values.end_time
      ? chargedHours(values.start_time, values.end_time)
      : null;
  useEffect(() => {
    setValue("hours", derivedHours === null ? "" : String(derivedHours));
  }, [derivedHours, setValue]);

  // Advisory allocation preview (008): mirrors the server's calculation so
  // the employee sees the charged amount before submitting. The submit path
  // recalculates under locks — this estimate never reserves anything.
  const previewInput = (() => {
    if (!selectedType?.requires_allocation || !unit || !typeId) return null;
    const base: {
      type: string;
      start_date?: string;
      end_date?: string;
      start_time?: string;
      end_time?: string;
    } = { type: typeId };
    if (values.start_date) base.start_date = values.start_date;
    if (values.end_date) base.end_date = values.end_date;
    if (unit === "unit") {
      const quantity = Number(values.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return null;
      return { ...base, quantity };
    }
    if (unit === "hour") {
      if (!values.start_date || !values.start_time || !values.end_time) {
        return null;
      }
      return {
        ...base,
        start_time: values.start_time,
        end_time: values.end_time,
      };
    }
    return null;
  })();

  const preview = useQuery({
    queryKey: ["allocation-preview", previewInput],
    queryFn: () => getAllocationPreview(previewInput!),
    enabled: previewInput !== null,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (input: RequestDraftInput) => createRequest(input),
    onSuccess: (req) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      navigate(`/requests/${req.id}`);
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
      } else {
        setServerError(t("Something went wrong. Please try again."));
      }
    },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    setFieldErrors({});
    const input: RequestDraftInput = {
      type: values.type,
      title: values.title,
      description: values.description,
    };
    if (values.start_date) input.start_date = values.start_date;
    if (values.end_date || values.start_date) input.end_date = values.end_date || values.start_date;
    if (values.start_time) input.start_time = values.start_time;
    if (values.end_time) input.end_time = values.end_time;
    if (selectedType?.requires_item) {
      input.equipment_item = values.equipment_item;
    }
    if (unit === "unit") {
      input.quantity = values.quantity ? Number(values.quantity) : null;
    }
    // Hour types: the server derives the billed hours from the times —
    // the read-only field is display only.
    mutation.mutate(input);
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

  const previewUnit = preview.data?.unit ?? "unit";

  return (
    <div className="mx-auto max-w-4xl">
      <AsyncState isLoading={isLoading} error={error}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="workspace-panel flex flex-col gap-4 p-6"
          noValidate
        >
          <div>
            <h1 className="text-2xl font-semibold">{t("New request")}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {t("Saved as a draft — nothing is sent to a reviewer until you submit.")}
            </p>
          </div>
          <div>
            <label htmlFor="type" className="block text-sm font-medium">
              {t("Request type")}
            </label>
            <select
              id="type"
              className={input}
              aria-invalid={!!errors.type || !!fieldErrors.type}
              {...register("type", { required: t("Choose a request type.") })}
            >
              <option value="">{t("Select…")}</option>
              {types?.results.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                  {rt.requires_manager && rt.requires_hr
                    ? t(" (Manager → HR)")
                    : rt.requires_hr
                      ? t(" (HR)")
                      : rt.requires_manager
                        ? t(" (Manager)")
                        : ""}
                </option>
              ))}
            </select>
            {selectedType?.help_text && (
              <p className="mt-1 text-sm text-gray-500">{selectedType.help_text}</p>
            )}
            <AllocationBalance
              typeId={typeId}
              requiresAllocation={selectedType?.requires_allocation}
            />
            {err("type")}
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

          {selectedType?.requires_item && (
            <div>
              <label htmlFor="equipment_item" className="block text-sm font-medium">
                {t("Item")}
              </label>
              <input
                id="equipment_item"
                className={input}
                aria-invalid={!!errors.equipment_item || !!fieldErrors.equipment_item}
                {...register("equipment_item", {
                  required: t("Item is required for this type."),
                })}
              />
              {err("equipment_item")}
            </div>
          )}

          {(unit === "unit" || selectedType?.requires_dates) && (
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
                        selectedType?.requires_dates ||
                        (unit === "unit" && !selectedType?.requires_item)
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
                        selectedType?.requires_dates ||
                        (unit === "unit" && !selectedType?.requires_item)
                          ? unit === "unit"
                            ? t("Required to count the quantity.")
                            : t("Dates are required for this type.")
                          : false,
                      validate: (v, formValues) =>
                        !v ||
                        !formValues.start_date ||
                        v >= formValues.start_date ||
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
                    className={`${input} ${!selectedType?.requires_item ? "bg-slate-50 text-slate-500 dark:bg-white/5" : ""}`}
                    readOnly={!selectedType?.requires_item}
                    aria-invalid={!!errors.quantity || !!fieldErrors.quantity}
                    {...register("quantity", {
                      required: selectedType?.requires_item
                        ? t("Quantity is required for this type.")
                        : false,
                      min: { value: 1, message: t("Quantity must be at least 1.") },
                    })}
                  />
                  {selectedType?.requires_item ? (
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
                        validate: (v, formValues) =>
                          !v ||
                          !formValues.start_time ||
                          v > formValues.start_time ||
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

          {previewInput && (
            <div aria-live="polite">
              {preview.isPending && (
                <p className="text-sm text-gray-500">{t("Checking allocation…")}</p>
              )}
              {preview.error && (
                <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
                  {apiErrorMessage(preview.error)}
                </p>
              )}
              {preview.data?.status === "no_grant" && (
                <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
                  {t("No allocation covers this period — ask HR to assign one before submitting.")}
                </p>
              )}
              {preview.data?.status === "insufficient" && (
                <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
                  {t("This needs {amount} {unit} but only {remaining} remain.", {
                    amount: formatAllocationAmount(preview.data.amount, previewUnit),
                    unit: t(ALLOCATION_UNIT_LABELS[previewUnit]),
                    remaining: formatAllocationAmount(preview.data.remaining ?? 0, previewUnit),
                  })}
                </p>
              )}
              {preview.data?.status === "available" && (
                <p className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                  {t("Estimated charge: {amount} {unit} — {remaining} remaining.", {
                    amount: formatAllocationAmount(preview.data.amount, previewUnit),
                    unit: t(ALLOCATION_UNIT_LABELS[previewUnit]),
                    remaining: formatAllocationAmount(preview.data.remaining ?? 0, previewUnit),
                  })}
                </p>
              )}
            </div>
          )}

          {serverError && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200">
              {serverError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={
                mutation.isPending ||
                preview.data?.status === "no_grant" ||
                preview.data?.status === "insufficient"
              }
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {mutation.isPending ? t("Saving…") : t("Save draft")}
            </button>
            <Link to="/requests" className="text-sm workspace-link-quiet workspace-link-muted">
              {t("Cancel")}
            </Link>
          </div>
        </form>
      </AsyncState>
    </div>
  );
}
