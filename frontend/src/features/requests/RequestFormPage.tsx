import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { quantity: "", hours: "", start_date: selectedDate, end_date: selectedDate } });

  const typeId = useWatch({ control, name: "type" });
  const values = useWatch({ control });
  const selectedType = types?.results.find((t) => t.id === typeId);
  const unit = selectedType?.unit;

  // Advisory allocation preview (008): mirrors the server's calculation so
  // the employee sees the charged amount before submitting. The submit path
  // recalculates under locks — this estimate never reserves anything.
  const previewInput = (() => {
    if (!selectedType?.requires_allocation || !unit || !typeId) return null;
    const base: { type: string; start_date?: string; end_date?: string } = { type: typeId };
    if (values.start_date) base.start_date = values.start_date;
    if (values.end_date) base.end_date = values.end_date;
    if (unit === "unit") {
      const quantity = Number(values.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return null;
      return { ...base, quantity };
    }
    if (unit === "hour") {
      const hours = Number(values.hours);
      if (!Number.isFinite(hours) || hours <= 0) return null;
      // The server stores whole minutes; send hours as entered.
      return { ...base, hours };
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
    if (unit === "unit") {
      input.equipment_item = values.equipment_item;
      input.quantity = values.quantity ? Number(values.quantity) : null;
    }
    if (unit === "hour") {
      input.hours = values.hours ? Number(values.hours) : null;
    }
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
    <div className="mx-auto max-w-2xl">
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
                  {rt.requires_hr ? t(" (manager + HR review)") : ""}
                </option>
              ))}
            </select>
            {selectedType?.help_text && (
              <p className="mt-1 text-sm text-gray-500">{selectedType.help_text}</p>
            )}
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

          {unit === "unit" && (
            <>
              <div className="grid grid-cols-2 gap-4">
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
                    aria-invalid={!!errors.equipment_item || !!fieldErrors.equipment_item}
                    {...register("equipment_item")}
                  />
                  {err("equipment_item")}
                </div>
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium">
                    {t("Quantity")}
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    min={1}
                    className={input}
                    aria-invalid={!!errors.quantity || !!fieldErrors.quantity}
                    {...register("quantity", {
                      required: t("Quantity is required for this type."),
                      min: { value: 1, message: t("Quantity must be at least 1.") },
                    })}
                  />
                  {err("quantity")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium">
                    {t("Start date")}
                  </label>
                  <input
                    id="start_date"
                    type="date"
                    className={input}
                    aria-invalid={!!errors.start_date || !!fieldErrors.start_date}
                    {...register("start_date")}
                  />
                  {err("start_date")}
                </div>
                <div>
                  <label htmlFor="end_date" className="block text-sm font-medium">
                    {t("End date")}
                  </label>
                  <input
                    id="end_date"
                    type="date"
                    className={input}
                    aria-invalid={!!errors.end_date || !!fieldErrors.end_date}
                    {...register("end_date", {
                      validate: (v, formValues) =>
                        !v ||
                        !formValues.start_date ||
                        v >= formValues.start_date ||
                        t("End date must not be before the start date."),
                    })}
                  />
                  {err("end_date")}
                </div>
              </div>
            </>
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
                    {...register("start_date")}
                  />
                  {err("start_date")}
                </div>
                <div>
                  <label htmlFor="hours" className="block text-sm font-medium">
                    {t("Hours")}
                  </label>
                  <input
                    id="hours"
                    type="number"
                    min={0.25}
                    step={0.25}
                    className={input}
                    aria-invalid={!!errors.hours || !!fieldErrors.hours}
                    {...register("hours", {
                      required: t("Hours are required for this type."),
                      min: { value: 0.25, message: t("Use quarter-hour steps (0.25, 0.5, ...).") },
                    })}
                  />
                  {err("hours")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_time" className="block text-sm font-medium">
                    {t("From")}
                  </label>
                  <input
                    id="start_time"
                    type="time"
                    className={input}
                    aria-invalid={!!errors.start_time || !!fieldErrors.start_time}
                    {...register("start_time")}
                  />
                  {err("start_time")}
                </div>
                <div>
                  <label htmlFor="end_time" className="block text-sm font-medium">
                    {t("To")}
                  </label>
                  <input
                    id="end_time"
                    type="time"
                    className={input}
                    aria-invalid={!!errors.end_time || !!fieldErrors.end_time}
                    {...register("end_time", {
                      validate: (v, formValues) =>
                        !v ||
                        !formValues.start_time ||
                        v > formValues.start_time ||
                        t("End time must be after the start time."),
                    })}
                  />
                  {err("end_time")}
                </div>
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
              disabled={mutation.isPending}
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
