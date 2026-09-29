import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { listDepartments } from "../../api/departments";
import { managerChoices, provisionEmployee } from "../../api/employees";
import { Alert } from "../../components/ui/Alert";

const input = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** HR-only employee provisioning: creates an inactive account and emails the
 * single-use invitation link (server-side delivery, never the browser). */
export function ProvisionEmployeePage() {
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
    onError: (e) => setError(e instanceof Error ? e.message : "Failed."),
  });

  const set = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    required: key === "email" || key === "employee_code",
  });

  return (
    <div className="max-w-xl">
      <p className="mb-2 text-sm">
        <Link to="/employees" className="text-brand-700 underline">
          ← Back to employees
        </Link>
      </p>
      <h1 className="text-xl font-semibold">New employee</h1>
      <p className="mt-1 text-sm text-gray-600">
        An invitation link is emailed to the new account; it is inactive until
        they set a password.
      </p>
      {error && (
        <div className="mt-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      <form
        className="mt-4 grid gap-3 rounded-lg border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="text-sm">
          Email *
          <input type="email" className={input} {...set("email")} />
        </label>
        <label className="text-sm">
          Employee code *
          <input className={input} {...set("employee_code")} />
        </label>
        <label className="text-sm">
          Display name
          <input className={input} {...set("display_name")} />
        </label>
        <label className="text-sm">
          Phone
          <input className={input} {...set("phone")} />
        </label>
        <label className="text-sm">
          Job title
          <input className={input} {...set("job_title")} />
        </label>
        <label className="text-sm">
          Department
          <select className={input} {...set("department")} required={false}>
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
          <select className={input} {...set("manager")} required={false}>
            <option value="">None</option>
            {managers?.results.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.employee_code}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="mb-1">Business roles</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.managerRole}
                onChange={(e) =>
                  setForm((f) => ({ ...f, managerRole: e.target.checked }))
                }
              />
              Manager
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
        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Provisioning…" : "Provision employee"}
        </button>
      </form>
    </div>
  );
}
