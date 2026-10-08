import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "../../api/client";
import { createDepartment } from "../../api/departments";
import { managerChoices } from "../../api/employees";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";

const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** HR department creation on its own page — the list page only lists.
 * Manager pickers only offer employees holding the Manager role. */
export function DepartmentNewPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [manager, setManager] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: managers, isLoading, error } = useQuery({
    queryKey: ["managerChoices"],
    queryFn: () => managerChoices(),
  });

  const create = useMutation({
    mutationFn: () => createDepartment(name.trim(), manager || null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
      navigate("/departments");
    },
    onError: (e) => setServerError(apiErrorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (name.trim()) create.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl">
      {serverError && (
        <div className="mb-3">
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}

      <AsyncState isLoading={isLoading} error={error}>
        <form className="workspace-panel grid grid-cols-1 gap-4 p-6" noValidate onSubmit={submit}>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-700">
              {t("HR / ORGANIZATION")}
            </span>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("New department")}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {t("Departments group employees for reporting lines and statistics. Deactivated departments keep their history; members become unassigned.")}
            </p>
          </div>
          <label className="block text-sm font-medium">
            {t("Name")}
            <Input
              required
              className="mt-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("New department name")}
            />
          </label>

          <label className="block text-sm font-medium">
            {t("Manager")}
            <select
              className={input}
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">{t("None")}</option>
              {managers?.results
                .filter((m) => m.roles.includes("Manager"))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.employee_code}
                  </option>
                ))}
            </select>
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? t("Saving…") : t("Add department")}
            </Button>
            <Link
              to="/departments"
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
