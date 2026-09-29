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

interface FormValues {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  equipment_item: string;
  quantity: string;
}

const DATE_CATEGORIES = new Set(["leave", "work_from_home"]);

/** Edit a draft or returned request (FR-002/FR-005): saves send the current
 * version; a 409 refreshes the loaded data instead of silently losing work. */
export function RequestEditPage() {
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
          "This request changed since you loaded it — the latest data has been reloaded.",
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
      setServerError("Something went wrong. Please try again.");
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
              {req.status === "returned" ? "Revise returned request" : "Edit draft"}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {req.type_name}
              {req.status === "returned" &&
                " — reviewer comments are on the request detail page."}
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
                  Title
                </label>
                <input
                  id="title"
                  className={input}
                  aria-invalid={!!errors.title || !!fieldErrors.title}
                  {...register("title", { required: "Title is required." })}
                />
                {err("title")}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium">
                  Details
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
                      Start date
                    </label>
                    <input
                      id="start_date"
                      type="date"
                      className={input}
                      aria-invalid={!!errors.start_date || !!fieldErrors.start_date}
                      {...register("start_date", {
                        required: "Start date is required for this type.",
                      })}
                    />
                    {err("start_date")}
                  </div>
                  <div>
                    <label htmlFor="end_date" className="block text-sm font-medium">
                      End date
                    </label>
                    <input
                      id="end_date"
                      type="date"
                      className={input}
                      aria-invalid={!!errors.end_date || !!fieldErrors.end_date}
                      {...register("end_date", {
                        required: "End date is required for this type.",
                      })}
                    />
                    {err("end_date")}
                  </div>
                </div>
              )}

              {category === "equipment" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="equipment_item"
                      className="block text-sm font-medium"
                    >
                      Item
                    </label>
                    <input
                      id="equipment_item"
                      className={input}
                      aria-invalid={
                        !!errors.equipment_item || !!fieldErrors.equipment_item
                      }
                      {...register("equipment_item", {
                        required: "Item is required for equipment requests.",
                      })}
                    />
                    {err("equipment_item")}
                  </div>
                  <div>
                    <label htmlFor="quantity" className="block text-sm font-medium">
                      Quantity
                    </label>
                    <input
                      id="quantity"
                      type="number"
                      min={1}
                      className={input}
                      aria-invalid={!!errors.quantity || !!fieldErrors.quantity}
                      {...register("quantity", {
                        required: "Quantity is required for equipment requests.",
                        min: { value: 1, message: "Quantity must be at least 1." },
                      })}
                    />
                    {err("quantity")}
                  </div>
                </div>
              )}

              {serverError && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-2 text-sm text-red-700"
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
                  {busy ? "Saving…" : "Save changes"}
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
                  {busy ? "Working…" : req.cycle === 0 ? "Save & submit" : "Save & resubmit"}
                </button>
                <Link
                  to={`/requests/${req.id}`}
                  className="text-sm text-gray-600 hover:underline"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </>
        )}
      </AsyncState>
    </div>
  );
}
