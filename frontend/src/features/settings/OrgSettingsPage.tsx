import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { managerChoices } from "../../api/employees";
import { getOrgSettings, updateOrgSettings } from "../../api/organization";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";

const input = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const TIMEZONES = ["UTC", "Africa/Cairo", "Asia/Dubai", "Europe/London"];

/** HR-only organization settings: display name, IANA timezone, week start,
 * and the fallback reviewer (must be an active HR member). */
export function OrgSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["orgSettings"],
    queryFn: getOrgSettings,
  });
  const { data: choices } = useQuery({
    queryKey: ["managerChoices"],
    queryFn: () => managerChoices(),
  });

  const [form, setForm] = useState<{
    name?: string;
    timezone?: string;
    week_start?: number;
    fallback_reviewer?: string | null;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateOrgSettings,
    onSuccess: (updated) => {
      setForm(null);
      setNotice("Settings saved.");
      queryClient.setQueryData(["orgSettings"], updated);
    },
    onError: (e) => setSaveError(e instanceof Error ? e.message : "Failed."),
  });

  const hrChoices = (choices?.results ?? []).filter((c) =>
    c.roles.includes("HR"),
  );

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold">Organization settings</h1>
      <AsyncState isLoading={isLoading} error={error}>
        {data && (
          <>
            {notice && (
              <div className="mt-3">
                <Alert kind="success">{notice}</Alert>
              </div>
            )}
            {saveError && (
              <div className="mt-3">
                <Alert kind="error">{saveError}</Alert>
              </div>
            )}
            <form
              className="mt-4 grid gap-3 rounded-lg border bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (form) mutation.mutate(form);
              }}
            >
              <label className="text-sm">
                Organization name
                <input
                  className={input}
                  value={form?.name ?? data.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f ?? {}), name: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                Timezone
                <select
                  className={input}
                  value={form?.timezone ?? data.timezone}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f ?? {}), timezone: e.target.value }))
                  }
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Week starts on
                <select
                  className={input}
                  value={form?.week_start ?? data.week_start}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f ?? {}),
                      week_start: Number(e.target.value),
                    }))
                  }
                >
                  {WEEK_DAYS.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Fallback reviewer (active HR member)
                <select
                  className={input}
                  value={form?.fallback_reviewer ?? data.fallback_reviewer ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...(f ?? {}),
                      fallback_reviewer: e.target.value || null,
                    }))
                  }
                >
                  <option value="">None</option>
                  {hrChoices.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.display_name || c.employee_code}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">
                  Used when a request has no eligible manager.
                </span>
              </label>
              <button
                type="submit"
                disabled={!form || mutation.isPending}
                className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {mutation.isPending ? "Saving…" : "Save settings"}
              </button>
            </form>
          </>
        )}
      </AsyncState>
    </div>
  );
}
