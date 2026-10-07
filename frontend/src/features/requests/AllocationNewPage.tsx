import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ApiError, apiErrorMessage } from "../../api/client";
import { listEmployees } from "../../api/employees";
import {
  ALLOCATION_UNIT_LABELS,
  createAllocation,
  hoursToAmount,
  listRequestTypes,
} from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";

const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** HR grant creation (008): its own page — pick an employee and a measurable
 * request type, then award an amount in that type's unit over a dated period.
 * Hour types store the award as whole minutes on the server. */
export function AllocationNewPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    employee: "",
    request_type: "",
    start_date: "",
    end_date: "",
    amount: "",
  });

  const { data: employees, isLoading: loadingEmployees, error: employeesError } = useQuery({
    queryKey: ["employees", "allocation-pick"],
    queryFn: () => listEmployees({ is_active: "true", page_size: 100, ordering: "display_name" }),
  });
  const { data: types, isLoading: loadingTypes, error: typesError } = useQuery({
    queryKey: ["request-types"],
    queryFn: listRequestTypes,
  });

  const allocatedTypes = (types?.results ?? []).filter(
    (rt) => rt.unit !== "none" && rt.is_active,
  );
  const selectedType = allocatedTypes.find((rt) => rt.id === form.request_type);

  const create = useMutation({
    mutationFn: createAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      navigate("/settings/allocations");
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

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});
    if (!form.employee || !form.request_type || !form.start_date || !form.end_date) {
      setFormError(t("Employee, type and both dates are required."));
      return;
    }
    if (form.end_date < form.start_date) {
      setFormError(t("End date cannot be before the start date."));
      return;
    }
    const entered = Number(form.amount);
    const initial_amount = selectedType?.unit === "hour" ? hoursToAmount(entered) : entered;
    if (!Number.isInteger(initial_amount) || initial_amount < 1) {
      setFormError(
        selectedType?.unit === "hour"
          ? t("Amount must be a positive number of hours.")
          : t("Amount must be a positive whole number."),
      );
      return;
    }
    setFormError(null);
    create.mutate({
      employee: form.employee,
      request_type: form.request_type,
      start_date: form.start_date,
      end_date: form.end_date,
      initial_amount,
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <span className="text-xs font-bold uppercase tracking-widest text-brand-700">
        {t("HR / WORKFLOWS")}
      </span>
      <h1 className="mt-1 text-3xl font-bold">{t("Add allocation")}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {t("Award a dated allowance in the request type's unit. Requests draw from it while they fit inside the period; overlapping allocations for the same employee and type are not allowed.")}
      </p>

      {serverError && (
        <div className="mt-3">
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}

      <AsyncState isLoading={loadingEmployees || loadingTypes} error={employeesError ?? typesError}>
        <form className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
          <label className="block text-sm font-medium">
            {t("Employee")}
            <select
              required
              className={input}
              value={form.employee}
              onChange={set("employee")}
              aria-invalid={!!fieldErrors.employee}
            >
              <option value="">{t("Select…")}</option>
              {(employees?.results ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.display_name || emp.employee_code}
                </option>
              ))}
            </select>
            {fieldErrors.employee && (
              <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.employee}</p>
            )}
          </label>

          <label className="block text-sm font-medium">
            {t("Request type")}
            <select
              required
              className={input}
              value={form.request_type}
              onChange={set("request_type")}
              aria-invalid={!!fieldErrors.request_type}
            >
              <option value="">{t("Select…")}</option>
              {allocatedTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </select>
            {fieldErrors.request_type && (
              <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.request_type}</p>
            )}
          </label>

          {allocatedTypes.length === 0 && (
            <p className="sm:col-span-2 text-sm text-muted-foreground">
              {t("No measurable request type yet — set a type's unit to Units or Hours on the Request types page first.")}
            </p>
          )}

          <label className="block text-sm font-medium">
            {selectedType
              ? t("Amount ({unit})", { unit: t(ALLOCATION_UNIT_LABELS[selectedType.unit as "unit" | "hour"]) })
              : t("Amount")}
            <input
              required
              type="number"
              min={selectedType?.unit === "hour" ? 0.25 : 1}
              step={selectedType?.unit === "hour" ? 0.25 : 1}
              className={input}
              value={form.amount}
              onChange={set("amount")}
              aria-invalid={!!fieldErrors.initial_amount}
            />
            {selectedType && (
              <span className="text-xs text-muted-foreground">
                {selectedType.unit === "hour"
                  ? t("Entered in hours; quarter-hour steps.")
                  : t("Entered in whole units.")}
              </span>
            )}
            {fieldErrors.initial_amount && (
              <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.initial_amount}</p>
            )}
          </label>

          <label className="block text-sm font-medium">
            {t("Start date")}
            <input
              required
              type="date"
              className={input}
              value={form.start_date}
              onChange={set("start_date")}
              aria-invalid={!!fieldErrors.start_date}
            />
            {fieldErrors.start_date && (
              <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.start_date}</p>
            )}
          </label>

          <label className="block text-sm font-medium">
            {t("End date")}
            <input
              required
              type="date"
              className={input}
              value={form.end_date}
              onChange={set("end_date")}
              aria-invalid={!!fieldErrors.end_date}
            />
            {fieldErrors.end_date && (
              <p role="alert" className="mt-1 text-sm text-red-700">{fieldErrors.end_date}</p>
            )}
          </label>

          {formError && (
            <p role="alert" className="sm:col-span-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={create.isPending || allocatedTypes.length === 0}>
              {create.isPending ? t("Saving…") : t("Add allocation")}
            </Button>
            <Link
              to="/settings/allocations"
              className="text-sm workspace-link-quiet workspace-link-muted"
            >
              {t("Cancel")}
            </Link>
          </div>
        </form>
      </AsyncState>
    </div>
  );
}
