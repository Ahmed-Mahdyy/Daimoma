import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { listDepartments } from "../../api/departments";
import { managerChoices, provisionEmployee } from "../../api/employees";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";

const input = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** HR-only employee provisioning: creates an inactive account and emails the
 * single-use invitation link (server-side delivery, never the browser). */
export function ProvisionEmployeePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    employee_code: "",
    display_name: "",
    phone: "",
    job_title: "",
    department: "",
    manager: "",
    managerRole: false,
    hrRole: false,
  });
  const [error, setError] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });
  const { data: managers } = useQuery({
    queryKey: ["managerChoices"],
    queryFn: () => managerChoices(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      provisionEmployee({
        email: form.email,
        employee_code: form.employee_code,
        display_name: form.display_name,
        phone: form.phone,
        job_title: form.job_title,
        department: form.department || null,
        manager: form.manager || null,
        roles: [
          ...(form.managerRole ? ["Manager"] : []),
          ...(form.hrRole ? ["HR"] : []),
        ],
      }),
    onSuccess: (created) => navigate(`/employees/${created.id}`),
    onError: (e) => setError(e instanceof Error ? e.message : t("Failed.")),
  });

  const set = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    required: key === "email" || key === "employee_code",
  });

  return (
    <div>
      <p className="mb-3 text-sm">
        <Link to="/employees" className="workspace-backlink">
          ← {t("Back to employees")}
        </Link>
      </p>
      <h1 className="text-xl font-semibold">{t("New employee")}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {t("An invitation link is emailed to the new account; it is inactive until they set a password.")}
      </p>
      {error && (
        <div className="mt-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      <form
        className="workspace-panel mt-4 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="block text-sm font-medium">
          {t("Email")} *
          <input type="email" className={`mt-1 ${input}`} {...set("email")} />
        </label>
        <label className="block text-sm font-medium">
          {t("Employee code")} *
          <input className={`mt-1 ${input}`} {...set("employee_code")} />
        </label>
        <label className="block text-sm font-medium">
          {t("Display name")}
          <input className={`mt-1 ${input}`} {...set("display_name")} />
        </label>
        <label className="block text-sm font-medium">
          {t("Phone")}
          <input className={`mt-1 ${input}`} {...set("phone")} />
        </label>
        <label className="block text-sm font-medium">
          {t("Job title")}
          <input className={`mt-1 ${input}`} {...set("job_title")} />
        </label>
        <label className="block text-sm font-medium">
          {t("Department")}
          <select className={`mt-1 ${input}`} {...set("department")} required={false}>
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
        <label className="block text-sm font-medium">
          {t("Manager")}
          <select className={`mt-1 ${input}`} {...set("manager")} required={false}>
            <option value="">{t("None")}</option>
            {managers?.results.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.employee_code}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm sm:col-span-2">
          <legend className="mb-1 font-medium">{t("Business roles")}</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.managerRole}
                onChange={(e) =>
                  setForm((f) => ({ ...f, managerRole: e.target.checked }))
                }
              />
              {t("Manager")}
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.hrRole}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hrRole: e.target.checked }))
                }
              />
              HR
            </label>
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending ? t("Provisioning…") : t("Provision employee")}
          </button>
        </div>
      </form>
    </div>
  );
}
