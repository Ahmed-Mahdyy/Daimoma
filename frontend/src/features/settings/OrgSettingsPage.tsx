import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { managerChoices } from "../../api/employees";
import {
  getOrgSettings,
  testOrgEmail,
  updateOrgSettings,
  type OrgEmailSettings,
} from "../../api/organization";
import { apiErrorMessage } from "../../api/client";
import { useLanguage } from "../../app/LanguageProvider";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { Button } from "@/components/ui/button";
import { PageHeaderCard } from "@/components/ui/page-header";

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
  const { t } = useLanguage();
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
  const [emailForm, setEmailForm] = useState<Partial<OrgEmailSettings> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: updateOrgSettings,
    onSuccess: (updated) => {
      setForm(null);
      setEmailForm(null);
      setNotice(t("Settings saved."));
      queryClient.setQueryData(["orgSettings"], updated);
    },
    onError: (e) => setSaveError(e instanceof Error ? e.message : t("Failed.")),
  });

  const emailTest = useMutation({
    mutationFn: testOrgEmail,
    onSuccess: (res) => setEmailResult({ ok: true, text: res.detail }),
    onError: (e) => setEmailResult({ ok: false, text: apiErrorMessage(e) }),
  });

  const hrChoices = (choices?.results ?? []).filter((c) =>
    c.roles.includes("HR"),
  );

  return (
    <div>
      <PageHeaderCard
        eyebrow={t("HR / ORGANIZATION")}
        title={t("Organization settings")}
      />
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
              className="workspace-panel mt-4 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (form) mutation.mutate(form);
              }}
            >
              <label className="text-sm">
                {t("Organization name")}
                <input
                  className={input}
                  value={form?.name ?? data.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...(f ?? {}), name: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                {t("Timezone")}
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
                {t("Week starts on")}
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
                      {t(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {t("Fallback reviewer (active HR member)")}
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
                  <option value="">{t("None")}</option>
                  {hrChoices.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.display_name || c.employee_code}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">
                  {t("Used when a request has no eligible manager.")}
                </span>
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={!form || mutation.isPending}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-40"
                >
                  {mutation.isPending ? t("Saving…") : t("Save settings")}
                </button>
              </div>
            </form>

            <form
              className="workspace-panel mt-5 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                setEmailResult(null);
                if (emailForm) mutation.mutate(emailForm);
              }}
            >
              <h2 className="text-sm font-semibold sm:col-span-2">{t("Email delivery")}</h2>
              <label className="text-sm sm:col-span-2">
                {t("Sending method")}
                <select
                  className={input}
                  value={emailForm?.email_mode ?? data.email_mode}
                  onChange={(e) =>
                    setEmailForm((f) => ({
                      ...(f ?? {}),
                      email_mode: e.target.value as "env" | "smtp",
                    }))
                  }
                >
                  <option value="env">{t("Environment default")}</option>
                  <option value="smtp">{t("Custom SMTP server")}</option>
                </select>
              </label>
              {(emailForm?.email_mode ?? data.email_mode) === "smtp" && (
                <>
                  <label className="text-sm">
                    {t("Mail server host")}
                    <input
                      className={input}
                      value={emailForm?.email_host ?? data.email_host}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...(f ?? {}), email_host: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    {t("Port")}
                    <input
                      className={input}
                      type="number"
                      min={1}
                      max={65535}
                      value={emailForm?.email_port ?? data.email_port}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...(f ?? {}), email_port: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    {t("Username")}
                    <input
                      className={input}
                      autoComplete="off"
                      value={emailForm?.email_host_user ?? data.email_host_user}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...(f ?? {}), email_host_user: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    {t("Password")}
                    <input
                      className={input}
                      type="password"
                      autoComplete="new-password"
                      placeholder={
                        data.email_password_set
                          ? t("Leave blank to keep the stored password")
                          : ""
                      }
                      value={emailForm?.email_host_password ?? ""}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...(f ?? {}), email_host_password: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    {t("From address")}
                    <input
                      className={input}
                      placeholder={t("no-reply@yourdomain.tld")}
                      value={emailForm?.email_from ?? data.email_from}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...(f ?? {}), email_from: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    {t("Connection timeout (seconds)")}
                    <input
                      className={input}
                      type="number"
                      min={1}
                      max={300}
                      value={emailForm?.email_timeout ?? data.email_timeout}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...(f ?? {}), email_timeout: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <div className="flex items-center gap-6 text-sm sm:col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={emailForm?.email_use_tls ?? data.email_use_tls}
                        onChange={(e) =>
                          setEmailForm((f) => ({
                            ...(f ?? {}),
                            email_use_tls: e.target.checked,
                            ...(e.target.checked ? { email_use_ssl: false } : {}),
                          }))
                        }
                      />
                      {t("Use TLS (STARTTLS, port 587)")}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={emailForm?.email_use_ssl ?? data.email_use_ssl}
                        onChange={(e) =>
                          setEmailForm((f) => ({
                            ...(f ?? {}),
                            email_use_ssl: e.target.checked,
                            ...(e.target.checked ? { email_use_tls: false } : {}),
                          }))
                        }
                      />
                      {t("Use SSL (implicit TLS, port 465)")}
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={emailTest.isPending}
                      onClick={() => {
                        setEmailResult(null);
                        emailTest.mutate({
                          email_host: emailForm?.email_host ?? data.email_host,
                          email_port: emailForm?.email_port ?? data.email_port,
                          email_host_user: emailForm?.email_host_user ?? data.email_host_user,
                          email_host_password: emailForm?.email_host_password ?? "",
                          email_use_tls: emailForm?.email_use_tls ?? data.email_use_tls,
                          email_use_ssl: emailForm?.email_use_ssl ?? data.email_use_ssl,
                          email_timeout: emailForm?.email_timeout ?? data.email_timeout,
                          email_from: emailForm?.email_from ?? data.email_from,
                        });
                      }}
                    >
                      {emailTest.isPending ? t("Testing…") : t("Test connection")}
                    </Button>
                    <span className="ms-3 text-xs text-gray-500">
                      {t("Sends a test email to your own address.")}
                    </span>
                  </div>
                  {emailResult && (
                    <div className="sm:col-span-2">
                      <Alert kind={emailResult.ok ? "success" : "error"}>
                        {emailResult.text}
                      </Alert>
                    </div>
                  )}
                </>
              )}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={!emailForm || mutation.isPending}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-40"
                >
                  {mutation.isPending ? t("Saving…") : t("Save email settings")}
                </button>
              </div>
            </form>
          </>
        )}
      </AsyncState>
    </div>
  );
}
