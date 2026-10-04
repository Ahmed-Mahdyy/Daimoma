import { useQuery } from "@tanstack/react-query";
import { arSA } from "date-fns/locale";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  getDashboard,
  type Dashboard,
  type DashboardScope,
} from "../../api/reporting";
import { useLanguage } from "../../app/LanguageProvider";
import { AsyncState } from "../../components/ui/AsyncState";
import { formatMinutes } from "../timesheets/timezone";
import { useAuth } from "../auth/auth-context";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  collecting: "Collecting",
  pending_manager: "Pending manager",
  pending_hr: "Pending HR",
  approved: "Approved",
  returned: "Returned",
  rejected: "Rejected",
};

/** Status counts rendered as links to the pre-filtered list page, so a
 * count is one click away from the rows behind it. */
function StatusChips({
  byStatus,
  basePath,
}: {
  byStatus: Record<string, number>;
  basePath: "/requests" | "/timesheets";
}) {
  const { t } = useLanguage();
  return (
    <ul className="mt-5 flex flex-wrap gap-2">
      {Object.entries(byStatus).map(([status, count]) => (
        <li key={status}>
          <Link
            to={`${basePath}?status=${status}`}
            className="group flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition hover:-translate-y-px hover:border-brand-700/50 hover:bg-white hover:shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#8bd6c2]/50 dark:hover:bg-white/10"
          >
            <span className={`h-2 w-2 rounded-full ${status === "approved" ? "bg-emerald-500" : status.startsWith("pending") ? "bg-amber-500" : status === "rejected" ? "bg-rose-500" : "bg-slate-400"}`} aria-hidden="true" />
            <span className="font-medium">{t(STATUS_LABELS[status] ?? status)}</span>
            <strong className="ms-1 rounded-full bg-slate-900/5 px-1.5 text-slate-900 group-hover:bg-brand-700/10 dark:bg-white/10 dark:text-slate-100">{count}</strong>
            <span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-700 rtl:-rotate-180 dark:group-hover:text-[#8bd6c2]" aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DashboardCard({ scope }: { scope: DashboardScope }) {
  const { t, lang } = useLanguage();
  const { data, isLoading, error } = useQuery<Dashboard>({
    queryKey: ["dashboard", scope],
    queryFn: () => getDashboard(scope),
  });

  const title = {
    personal: t("Personal overview"),
    team: t("Team dashboard"),
    organization: t("Organization dashboard"),
  }[scope];

  return (
    <section aria-labelledby={`dash-${scope}`} className="workspace-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-5 sm:px-7 dark:border-white/10">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.14em] text-brand-700">{scope === "personal" ? t("YOUR WORK") : scope === "team" ? t("YOUR TEAM") : t("COMPANY VIEW")}</span>
          <h2 id={`dash-${scope}`} className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        </div>
        {scope === "personal" && <Link to="/reports" className="text-sm font-semibold workspace-link-quiet">{t("Explore insights")} <span aria-hidden="true">↗</span></Link>}
      </div>
      <div className="p-5 sm:p-7">
        <AsyncState isLoading={isLoading} error={error}>
          {data && (
            <>
              <p className="text-xs font-medium text-slate-600">{t("Period {from} → {to} ({tz})", { from: data.period.from, to: data.period.to, tz: data.period.timezone })}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link to="/timesheets?status=approved" className="group rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#8bd6c2]/20 dark:from-[#8bd6c2]/10 dark:to-transparent">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700">{t("Approved hours")}</span>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-brand-800">{formatMinutes(data.approved_minutes, lang)}</p>
                  <span className="mt-2 block text-xs text-slate-600">{t("Time logged and approved this period")} <span className="font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100">{t("View")} →</span></span>
                </Link>
                <Link to="/requests?status=pending_manager" className="group rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-amber-300/20 dark:from-amber-300/10 dark:to-transparent">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">{t("Pending review items")}</span>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-amber-900 dark:text-amber-100">{data.pending_review}</p>
                  <span className="mt-2 block text-xs text-slate-600">{t("Items waiting for a decision")} <span className="font-semibold text-amber-800 opacity-0 transition group-hover:opacity-100 dark:text-amber-200">{t("View")} →</span></span>
                </Link>
              </div>
              <div className="mt-7 grid gap-6 lg:grid-cols-2">
                <div><h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("Requests")}</h3><StatusChips byStatus={data.requests.by_status} basePath="/requests" /></div>
                <div><h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("Timesheets")}</h3><StatusChips byStatus={data.timesheets.by_status} basePath="/timesheets" /></div>
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </section>
  );
}

/** Role-scoped dashboard (005): everyone gets personal; managers and HR add
 * team; HR adds organization. The server enforces the scope — these flags
 * only control which cards render. */
export function DashboardPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const roles = user?.roles ?? [];
  const isHr = roles.includes("HR");
  const isManager = roles.includes("Manager");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const date = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}` : "";

  return (
    <div className="flex flex-col gap-7">
      <div className="relative overflow-hidden rounded-3xl bg-[#103e3a] px-6 py-8 text-white shadow-xl shadow-brand-800/10 sm:px-10 sm:py-10">
        <img src="/brand/logo-icon.png" alt="" aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-80 w-auto opacity-[.06]" />
        <div className="pointer-events-none absolute -bottom-44 right-20 h-56 w-40 rounded-full bg-[#d8b770]/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div><span className="text-xs font-bold uppercase tracking-[.2em] text-[#b7d9cd]">{t("WELCOME TO YOUR WORKSPACE")}</span><h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("My dashboard")}</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#d2e6de]">{t("A clearer view of your requests, time and everything that needs your attention.")}</p></div>
          <div className="flex flex-wrap gap-2"><Link to="/requests/new" className="inline-flex items-center rounded-xl bg-[#e6bf71] px-4 py-2.5 text-sm font-bold text-[#223b34] hover:bg-[#f0cd87]">{t("New request")} <span className="ms-2" aria-hidden="true">↗</span></Link><Link to="/timesheets" className="inline-flex items-center rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">{t("View timesheets")}</Link></div>
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <DashboardCard scope="personal" />
        <Card className="overflow-hidden border-brand-100 shadow-sm">
          <CardHeader><CardTitle>{t("Plan your day")}</CardTitle><CardDescription>{t("Choose a day, then start a request or open your timesheet.")}</CardDescription></CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} locale={lang === "ar" ? arSA : undefined} dir={lang === "ar" ? "rtl" : "ltr"} className="rounded-lg border" />
            <div className="grid w-full grid-cols-2 gap-2">
              <Button asChild disabled={!date}><Link to={`/requests/new?date=${date}`}>{t("New request")}</Link></Button>
              <Button asChild variant="outline" disabled={!date}><Link to={`/timesheets?date=${date}`}>{t("Open timesheet")}</Link></Button>
            </div>
            <p className="w-full text-xs text-muted-foreground">{t("Selected:")} {date || t("Choose a date")}. {t("Requests stay drafts until you submit them.")}</p>
          </CardContent>
        </Card>
      </div>
      {(isManager || isHr) && <DashboardCard scope="team" />}
      {isHr && <DashboardCard scope="organization" />}
    </div>
  );
}
