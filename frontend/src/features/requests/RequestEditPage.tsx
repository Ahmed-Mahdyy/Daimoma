import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { useLanguage } from "../../app/LanguageProvider";

interface FormValues {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  equipment_item: string;
  quantity: string;
}

const DATE_CATEGORIES = new Set(["leave", "work_from_home"]);
const TIME_CATEGORIES = new Set(["early_leave"]);

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

  const {
    register,
    handleSubmit,
    reset,
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
      });
    }
  }, [req, reset]);

  const type = types?.results.find((t) => t.id === req?.type);
  const category = req?.type_category ?? type?.category;

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
    if (category && DATE_CATEGORIES.has(category)) {
      body.start_date = values.start_date || null;
      body.end_date = values.end_date || null;
    }
    if (category && TIME_CATEGORIES.has(category)) {
      body.start_date = values.start_date || null;
      body.start_time = values.start_time || null;
      body.end_time = values.end_time || null;
    }
    if (category === "equipment") {
      body.equipment_item = values.equipment_item;
      body.quantity = values.quantity ? Number(values.quantity) : null;
    }
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
    <div className="mx-auto max-w-2xl">
      <AsyncState isLoading={isLoading} error={error} emptyText="">
        {req && (
          <>
            <h1 className="text-2xl font-semibold">
              {req.status === "returned" ? t("Revise returned request") : t("Edit draft")}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {req.type_name}
              {req.status === "returned" &&
                ` — ${t("reviewer comments are on the request detail page.")}`}
            </p>

            <form
              onSubmit={handleSubmit((v) => {
                setServerError(null);
                setFieldErrors({});
                save.mutate(buildBody(v));
              })}
              className="mt-6 flex flex-col gap-4"
              noValidate
            >
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

              {category && DATE_CATEGORIES.has(category) && (
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
                      {...register("start_date", {
                        required: t("Start date is required for this type."),
                      })}
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
                        required: t("End date is required for this type."),
                      })}
                    />
                    {err("end_date")}
                  </div>
                </div>
              )}

              {category && TIME_CATEGORIES.has(category) && (
                <>
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
                        required: t("The date is required for this type."),
                      })}
                    />
                    {err("start_date")}
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
                        {...register("start_time", {
                          required: t("Start time is required for this type."),
                        })}
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
                          required: t("End time is required for this type."),
                          validate: (v, values) =>
                            !values.start_time ||
                            !v ||
                            v > values.start_time ||
                            t("End time must be after the start time."),
                        })}
                      />
                      {err("end_time")}
                    </div>
                  </div>
                </>
              )}

              {category === "equipment" && (
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
                      aria-invalid={
                        !!errors.equipment_item || !!fieldErrors.equipment_item
                      }
                      {...register("equipment_item", {
                        required: t("Item is required for equipment requests."),
                      })}
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
                        required: t("Quantity is required for equipment requests."),
                        min: { value: 1, message: t("Quantity must be at least 1.") },
                      })}
                    />
                    {err("quantity")}
                  </div>
                </div>
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
