import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "../../api/client";
import {
  createRequestType,
  listRequestTypes,
  updateRequestType,
  type RequestTypeWriteInput,
} from "../../api/requests";
import { AsyncState } from "../../components/ui/AsyncState";

const CATEGORY_OPTIONS: { value: RequestTypeWriteInput["category"]; label: string }[] = [
  { value: "leave", label: "Leave (dates)" },
  { value: "equipment", label: "Equipment (item + quantity)" },
  { value: "hr_service", label: "HR service (title/details)" },
  { value: "work_from_home", label: "Work from home (dates)" },
  { value: "general", label: "General (title/details)" },
];

interface TypeForm {
  code: string;
  name: string;
  category: RequestTypeWriteInput["category"];
  help_text: string;
  requires_hr: boolean;
}

/** HR request-type administration (FR-009): create typed categories and set
 * routing (requires_hr) + availability. Changes affect future submissions
 * only — historical route snapshots stay immutable. */
export function RequestTypesPage() {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["request-types"],
    queryFn: listRequestTypes,
  });

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<TypeForm>({ defaultValues: { category: "general" } });

  const create = useMutation({
    mutationFn: (input: RequestTypeWriteInput) => createRequestType(input),
    onSuccess: () => {
      setServerError(null);
      reset({ category: "general" });
      queryClient.invalidateQueries({ queryKey: ["request-types"] });
    },
    onError: (e) =>
      setServerError(e instanceof ApiError ? e.message : "Something went wrong."),
  });

  const patch = useMutation({
    mutationFn: (v: { id: string; body: Partial<RequestTypeWriteInput> }) =>
      updateRequestType(v.id, v.body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["request-types"] }),
    onError: (e) =>
      setServerError(e instanceof ApiError ? e.message : "Something went wrong."),
  });

  const input = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Request types</h1>
      <p className="mt-1 text-sm text-gray-600">
        Types marked “HR review” route to HR after manager approval. Changes
        apply to new submissions only — existing requests keep their original
        route.
      </p>

      <AsyncState isLoading={isLoading} error={error}>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Code</th>
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium">HR review</th>
              <th className="py-2 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {data?.results.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{t.name}</td>
                <td className="py-2 pr-4 text-gray-600">{t.code}</td>
                <td className="py-2 pr-4 text-gray-600">{t.category}</td>
                <td className="py-2 pr-4">
                  <input
                    type="checkbox"
                    checked={!!t.requires_hr}
                    aria-label={`HR review for ${t.name}`}
                    onChange={(e) =>
                      patch.mutate({
                        id: t.id,
                        body: { requires_hr: e.target.checked },
                      })
                    }
                  />
                </td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={!!t.is_active}
                    aria-label={`Active for ${t.name}`}
                    onChange={(e) =>
                      patch.mutate({
                        id: t.id,
                        body: { is_active: e.target.checked },
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncState>

      <h2 className="mt-8 text-lg font-semibold">Add a type</h2>
      <form
        onSubmit={handleSubmit((v) => create.mutate({ ...v, is_active: true }))}
        className="mt-3 grid grid-cols-2 gap-3 rounded-md border bg-white p-4"
        noValidate
      >
        <div>
          <label htmlFor="t-code" className="block text-sm font-medium">
            Code
          </label>
          <input
            id="t-code"
            className={`mt-1 w-full ${input}`}
            {...register("code", { required: "Code is required." })}
          />
          {errors.code && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.code.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="t-name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="t-name"
            className={`mt-1 w-full ${input}`}
            {...register("name", { required: "Name is required." })}
          />
          {errors.name && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {errors.name.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="t-category" className="block text-sm font-medium">
            Category
          </label>
          <select
            id="t-category"
            className={`mt-1 w-full ${input}`}
            {...register("category")}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="t-help" className="block text-sm font-medium">
            Help text
          </label>
          <input id="t-help" className={`mt-1 w-full ${input}`} {...register("help_text")} />
        </div>
        <label className="col-span-full flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("requires_hr")} />
          Requires HR review after manager approval
        </label>
        {serverError && (
          <p role="alert" className="col-span-full text-sm text-red-700">
            {serverError}
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {create.isPending ? "Adding…" : "Add type"}
          </button>
        </div>
      </form>
    </div>
  );
}
