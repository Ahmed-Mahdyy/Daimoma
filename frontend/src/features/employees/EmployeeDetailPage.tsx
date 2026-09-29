import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";

import { listDepartments } from "../../api/departments";
import {
  deactivateEmployee,
  getEmployee,
  managerChoices,
  reactivateEmployee,
  resendInvitation,
  updateEmployee,
  type EmployeeSummary,
} from "../../api/employees";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useAuth } from "../auth/auth-context";

const input = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const ALL_ROLES = ["Manager", "HR"];

interface PendingAction {
  kind: "deactivate" | "reactivate";
}

export function EmployeeDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isHr = user?.roles.includes("HR") ?? false;

  const { data: employee, isLoading, error } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployee(id),
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
    enabled: isHr,
  });
  const { data: managers } = useQuery({
    queryKey: ["managerChoices"],
    queryFn: () => managerChoices(),
    enabled: isHr,
  });

  const [form, setForm] = useState<Partial<EmployeeSummary> | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const dirty = form !== null && isHr;
  const blocker = useBlocker(dirty);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["employee", id] });

  const updateMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateEmployee(id, patch),
    onSuccess: (data) => {
      setForm(null);
      setFormError(null);
      setNotice("Changes saved.");
      queryClient.setQueryData(["employee", id], data);
      void invalidate();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        setFormError("This record changed elsewhere. Refresh and try again.");
      } else {
        setFormError(e instanceof Error ? e.message : "Save failed.");
      }
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (a: PendingAction) =>
      a.kind === "deactivate"
        ? deactivateEmployee(id, reason)
        : reactivateEmployee(id, reason),
    onSuccess: () => {
      setNotice(
        action?.kind === "deactivate"
          ? "Employee deactivated; all sessions ended."
          : "Employee reactivated.",
      );
      setAction(null);
      setReason("");
      void invalidate();
    },
    onError: (e) =>
      setFormError(e instanceof Error ? e.message : "Action failed."),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendInvitation(id),
    onSuccess: () => setNotice("Invitation re-issued; the previous link is dead."),
    onError: (e) =>
      setFormError(e instanceof Error ? e.message : "Could not resend."),
  });

  if (isLoading || error || !employee) {
    return (
      <AsyncState isLoading={isLoading} error={error}>
        {null}
      </AsyncState>
    );
  }

  const current = { ...employee, ...form };
  const field = (key: keyof EmployeeSummary) => ({
    value: (current[key] as string) ?? "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
      setNotice(null);
      setForm((f) => ({ ...(f ?? {}), [key]: e.target.value }));
    },
    disabled: !isHr,
  });

  const save = () => {
    if (!form) return;
    const patch: Record<string, unknown> = { ...form, version: employee.version };
    delete patch.id;
    delete patch.is_active;
    delete patch.department_name;
    delete patch.manager_name;
    delete patch.roles;
    updateMutation.mutate(patch);
  };

  const toggleRole = (role: string) => {
    setNotice(null);
    setForm((f) => {
      const roles = new Set(f?.roles ?? employee.roles);
      if (roles.has(role)) roles.delete(role);
      else roles.add(role);
      return { ...(f ?? {}), roles: [...roles] };
    });
  };

  return (
    <div className="max-w-2xl">
      <p className="mb-2 text-sm">
        <Link to="/employees" className="text-brand-700 underline">
          ← Back to employees
        </Link>
      </p>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {employee.display_name || employee.email}
        </h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            employee.is_active
              ? "bg-green-100 text-green-800"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {employee.is_active ? "Active" : "Inactive"}
        </span>
      </div>
      <p className="text-sm text-gray-500">
        {employee.employee_code} · {employee.job_title || "No title"}
      </p>

      {notice && <div className="mt-3"><Alert kind="success">{notice}</Alert></div>}
      {formError && <div className="mt-3"><Alert kind="error">{formError}</Alert></div>}

      <section className="mt-4 grid gap-3 rounded-lg border bg-white p-4">
        <label className="text-sm">
          Email
          <input type="email" className={input} {...field("email")} />
        </label>
        <label className="text-sm">
          Display name
          <input className={input} {...field("display_name")} />
        </label>
        <label className="text-sm">
          Phone
          <input className={input} {...field("phone")} />
        </label>
        <label className="text-sm">
          Job title
          <input className={input} {...field("job_title")} />
        </label>
        {isHr && (
          <>
            <label className="text-sm">
              Department
              <select
                className={input}
                value={(current.department as string) ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...(f ?? {}),
                    department: e.target.value || null,
                  }))
                }
              >
                <option value="">None</option>
                {departments?.results
                  .filter((d) => d.is_active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Manager
              <select
                className={input}
                value={(current.manager as string) ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...(f ?? {}),
                    manager: e.target.value || null,
                  }))
                }
              >
                <option value="">None</option>
                {managers?.results
                  .filter((m) => m.id !== employee.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name || m.employee_code}
                    </option>
                  ))}
              </select>
            </label>
            <fieldset className="text-sm">
              <legend className="mb-1">Business roles</legend>
              <div className="flex gap-4">
                {ALL_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={(form?.roles ?? employee.roles).includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    {role}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Every account is an Employee; these add elevated roles.
              </p>
            </fieldset>
          </>
        )}
      </section>

      {isHr && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!dirty || updateMutation.isPending}
            onClick={save}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              Discard
            </button>
          )}
          <span className="flex-1" />
          {!employee.is_active && (
            <button
              type="button"
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100"
            >
              Resend invitation
            </button>
          )}
          {employee.is_active ? (
            <button
              type="button"
              onClick={() => setAction({ kind: "deactivate" })}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAction({ kind: "reactivate" })}
              className="rounded-md border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
            >
              Reactivate
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={action !== null}
        danger={action?.kind === "deactivate"}
        title={
          action?.kind === "deactivate"
            ? "Deactivate employee?"
            : "Reactivate employee?"
        }
        body={
          action?.kind === "deactivate"
            ? "This ends all of their sessions immediately. History is preserved."
            : "They will be able to sign in again; previous sessions stay dead."
        }
        confirmLabel={action?.kind === "deactivate" ? "Deactivate" : "Reactivate"}
        onConfirm={() => action && actionMutation.mutate(action)}
        onCancel={() => setAction(null)}
      />
      {action && (
        <label className="mt-3 block text-sm">
          {action.kind === "deactivate" ? "Reason" : "Note"} (optional)
          <input
            className={input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}

      {blocker.state === "blocked" && (
        <ConfirmDialog
          open
          title="Discard unsaved changes?"
          body="You have unsaved edits on this page."
          confirmLabel="Discard"
          danger
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
    </div>
  );
}
