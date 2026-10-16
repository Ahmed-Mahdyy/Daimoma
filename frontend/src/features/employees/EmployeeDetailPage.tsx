import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useBlocker, useParams } from "react-router-dom";

import { listDepartments } from "../../api/departments";
import {
  deactivateEmployee,
  getEmployee,
  managerChoices,
  reactivateEmployee,
  resendInvitation,
  updateEmployee,
  type EmployeeDetail,
} from "../../api/employees";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { PageCrumbs } from "../../components/ui/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useLanguage } from "../../app/LanguageProvider";
import { useAuth } from "../auth/auth-context";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  contractDuration,
  EDUCATION_FIELDS,
  EGYPT_PHONE_HINT,
  EGYPT_PHONE_PATTERN,
  EMPLOYMENT_FIELDS,
  graduationYears,
  PERSONAL_FIELDS,
} from "./fields";

const input = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const ALL_ROLES = ["Manager", "HR"];

interface PendingAction {
  kind: "deactivate" | "reactivate";
}

export function EmployeeDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isHr = user?.roles.includes("HR") ?? false;

  const { data: employee, isLoading, error } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployee(id),
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => listDepartments(),
    enabled: isHr,
  });
  const { data: managers } = useQuery({
    queryKey: ["managerChoices"],
    queryFn: () => managerChoices(),
    enabled: isHr,
  });

  const [form, setForm] = useState<Partial<EmployeeDetail> | null>(null);
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
      setNotice(t("Changes saved."));
      queryClient.setQueryData(["employee", id], data);
      void invalidate();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        setFormError(t("This record changed elsewhere. Refresh and try again."));
      } else {
        setFormError(e instanceof Error ? e.message : t("Save failed."));
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
          ? t("Employee deactivated; all sessions ended.")
          : t("Employee reactivated."),
      );
      setAction(null);
      setReason("");
      void invalidate();
    },
    onError: (e) =>
      setFormError(e instanceof Error ? e.message : t("Action failed.")),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendInvitation(id),
    onSuccess: () => setNotice(t("Invitation re-issued; the previous link is dead.")),
    onError: (e) =>
      setFormError(e instanceof Error ? e.message : t("Could not resend.")),
  });

  if (isLoading || error || !employee) {
    return (
      <AsyncState isLoading={isLoading} error={error}>
        {null}
      </AsyncState>
    );
  }

  const current = { ...employee, ...form };
  const field = (key: keyof EmployeeDetail) => ({
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
    for (const key of [
      "birth_date",
      "contract_start_date",
      "contract_end_date",
      "graduation_year",
    ]) {
      if (patch[key] === "") patch[key] = null;
    }
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
    <div>
      <PageCrumbs
        className="mb-2"
        crumbs={[
          { label: t("nav.workspace"), to: "/" },
          { label: t("nav.employees"), to: "/employees" },
          { label: employee?.display_name || employee?.email || "…" },
        ]}
      />
      <div className="workspace-panel flex items-center gap-4 p-5">
        <Avatar className="size-14 ring-2 ring-brand-700/20">
          {employee.photo_url && (
            <AvatarImage src={employee.photo_url} alt="" />
          )}
          <AvatarFallback className="text-lg">
            {(employee.display_name || employee.email).slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">
            {employee.display_name || employee.email}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {employee.employee_code} · {employee.job_title || t("No title")}
            {employee.department_name ? ` · ${employee.department_name}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            employee.is_active
              ? "bg-green-100 text-green-800"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {employee.is_active ? t("Active") : t("Inactive")}
        </span>
      </div>

      {notice && <div className="mt-3"><Alert kind="success">{notice}</Alert></div>}
      {formError && <div className="mt-3"><Alert kind="error">{formError}</Alert></div>}

      <section className="workspace-panel mt-4 p-5" aria-label={t("Employee information")}>
        <Tabs defaultValue="general">
          <TabsList aria-label={t("Employee information")}>
            <TabsTrigger value="general">{t("General information")}</TabsTrigger>
            <TabsTrigger value="personal">{t("Personal information")}</TabsTrigger>
            <TabsTrigger value="education">{t("Education")}</TabsTrigger>
            {isHr && <TabsTrigger value="work">{t("Work information")}</TabsTrigger>}
          </TabsList>
          <TabsContent value="general" mobileLabel={t("General information")} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm">
              {t("Email")}
              <input type="email" className={input} {...field("email")} />
            </label>
            <label className="text-sm">
              {t("Display name")}
              <input className={input} {...field("display_name")} />
            </label>
            <label className="text-sm">
              {t("Phone")}
              <input
                type="tel"
                className={input}
                pattern={EGYPT_PHONE_PATTERN}
                title={t(EGYPT_PHONE_HINT)}
                {...field("phone")}
              />
            </label>
            <label className="text-sm">
              {t("Job title")}
              <input className={input} {...field("job_title")} />
            </label>
            {isHr && (
              <>
                <label className="text-sm">
                  {t("Department")}
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
                    <option value="">{t("None")}</option>
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
                  {t("Manager")}
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
                    <option value="">{t("None")}</option>
                    {managers?.results
                      .filter((m) => m.id !== employee.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name || m.employee_code}
                        </option>
                      ))}
                  </select>
                </label>
                <fieldset className="text-sm sm:col-span-2">
                  <legend className="mb-1">{t("Business roles")}</legend>
                  <div className="flex gap-4">
                    {ALL_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={(form?.roles ?? employee.roles).includes(role)}
                          onChange={() => toggleRole(role)}
                        />
                        {role === "HR" ? "HR" : t(role)}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t("Every account is an Employee; these add elevated roles.")}
                  </p>
                </fieldset>
              </>
            )}
          </TabsContent>
          <TabsContent value="personal" mobileLabel={t("Personal information")} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PERSONAL_FIELDS.map(([key, label, type]) => (
              <label key={key} className="text-sm">
                {t(label)}
                <input
                  type={type}
                  className={input}
                  {...(key === "emergency_contact_phone"
                    ? { pattern: EGYPT_PHONE_PATTERN, title: t(EGYPT_PHONE_HINT) }
                    : {})}
                  {...field(key)}
                />
              </label>
            ))}
          </TabsContent>
          <TabsContent value="education" mobileLabel={t("Education")} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EDUCATION_FIELDS.map(([key, label, type]) => (
              <label key={key} className="text-sm">
                {t(label)}
                <input type={type} className={input} {...field(key)} />
              </label>
            ))}
            <label className="text-sm">
              {t("Graduation year")}
              <select
                className={input}
                value={current.graduation_year ?? ""}
                disabled={!isHr}
                onChange={(e) =>
                  setForm((f) => ({
                    ...(f ?? {}),
                    graduation_year: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">{t("None")}</option>
                {graduationYears().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </TabsContent>
          {isHr && (
            <TabsContent value="work" mobileLabel={t("Work information")} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {t("Only HR can see employment and contract details.")}
              </p>
              {EMPLOYMENT_FIELDS.map(([key, label, type]) => (
                <label key={key} className="text-sm">
                  {t(label)}
                  <input type={type} className={input} {...field(key)} />
                </label>
              ))}
              <label className="text-sm">
                {t("Employment type")}
                <select className={input} {...field("employment_type")}>
                  <option value="">{t("None")}</option>
                  <option value="full_time">{t("Full time")}</option>
                  <option value="part_time">{t("Part time")}</option>
                  <option value="contract">{t("Contract")}</option>
                  <option value="internship">{t("Internship")}</option>
                </select>
              </label>
              <label className="text-sm">
                {t("Contract duration")}
                <input
                  className={input}
                  readOnly
                  disabled
                  value={contractDuration(
                    (current.contract_start_date as string) ?? null,
                    (current.contract_end_date as string) ?? null,
                    t,
                  )}
                />
              </label>
            </TabsContent>
          )}
        </Tabs>
      </section>

      {isHr && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!dirty || updateMutation.isPending}
            onClick={save}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {updateMutation.isPending ? t("Saving…") : t("Save changes")}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              {t("Discard")}
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
              {t("Resend invitation")}
            </button>
          )}
          {employee.is_active ? (
            <button
              type="button"
              onClick={() => setAction({ kind: "deactivate" })}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800/60 dark:text-red-200 dark:hover:bg-red-950/50"
            >
              {t("Deactivate")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAction({ kind: "reactivate" })}
              className="rounded-md border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 dark:border-green-800/60 dark:text-green-200 dark:hover:bg-green-950/50"
            >
              {t("Reactivate")}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={action !== null}
        danger={action?.kind === "deactivate"}
        title={
          action?.kind === "deactivate"
            ? t("Deactivate employee?")
            : t("Reactivate employee?")
        }
        body={
          action?.kind === "deactivate"
            ? t("This ends all of their sessions immediately. History is preserved.")
            : t("They will be able to sign in again; previous sessions stay dead.")
        }
        confirmLabel={action?.kind === "deactivate" ? t("Deactivate") : t("Reactivate")}
        onConfirm={() => action && actionMutation.mutate(action)}
        onCancel={() => setAction(null)}
      />
      {action && (
        <label className="mt-3 block text-sm">
          {action.kind === "deactivate" ? t("Reason") : t("Note")} {t("(optional)")}
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
          title={t("Discard unsaved changes?")}
          body={t("You have unsaved edits on this page.")}
          confirmLabel={t("Discard")}
          danger
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
    </div>
  );
}
