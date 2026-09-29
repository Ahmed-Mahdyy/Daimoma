import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "../../api/client";
import {
  createRequest,
  listRequestTypes,
  type RequestDraftInput,
} from "../../api/requests";
import { AsyncState } from "../../components/ui/AsyncState";

interface FormValues {
  type: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  equipment_item: string;
  quantity: string;
}

const DATE_CATEGORIES = new Set(["leave", "work_from_home"]);

/** New-request form (FR-001): typed fields adapt to the selected type's
 * category — date ranges for leave/WFH, item+quantity for equipment. */
export function RequestFormPage() {
  const navigate = useNavigate();
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
  } = useForm<FormValues>({ defaultValues: { quantity: "" } });

  const typeId = useWatch({ control, name: "type" });
  const selectedType = types?.results.find((t) => t.id === typeId);
  const category = selectedType?.category;

  const mutation = useMutation({
    mutationFn: (input: RequestDraftInput) => createRequest(input),
    onSuccess: (req) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      navigate(`/requests/${req.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setServerError(e.message);
        if (e.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(e.fieldErrors)) {
            mapped[k] = Array.isArray(v) ? String(v[0]) : String(v);
          }
          setFieldErrors(mapped);
        }
      } else {
        setServerError("Something went wrong. Please try again.");
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
    if (category && DATE_CATEGORIES.has(category)) {
      input.start_date = values.start_date || null;
      input.end_date = values.end_date || null;
    }
    if (category === "equipment") {
      input.equipment_item = values.equipment_item;
      input.quantity = values.quantity ? Number(values.quantity) : null;
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">New request</h1>
      <p className="mt-1 text-sm text-gray-600">
        Saved as a draft — nothing is sent to a reviewer until you submit.
      </p>
      <AsyncState isLoading={isLoading} error={error}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          <div>
            <label htmlFor="type" className="block text-sm font-medium">
              Request type
            </label>
            <select
              id="type"
              className={input}
              aria-invalid={!!errors.type || !!fieldErrors.type}
              {...register("type", { required: "Choose a request type." })}
            >
              <option value="">Select…</option>
              {types?.results.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.requires_hr ? " (manager + HR review)" : ""}
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
                  aria-invalid={!!errors.equipment_item || !!fieldErrors.equipment_item}
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
            <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {mutation.isPending ? "Saving…" : "Save draft"}
            </button>
            <Link to="/requests" className="text-sm text-gray-600 hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </AsyncState>
    </div>
  );
}
