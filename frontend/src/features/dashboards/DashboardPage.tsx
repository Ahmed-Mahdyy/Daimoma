import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  getDashboard,
  type Dashboard,
  type DashboardScope,
} from "../../api/reporting";
import { ALLOCATION_UNIT_LABELS, formatAllocationAmount } from "../../api/requests";
import { useLanguage } from "../../app/LanguageProvider";
import { AsyncState } from "../../components/ui/AsyncState";
import { formatDate } from "../../lib/dates";
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
  if (!Object.values(byStatus).some((count) => count > 0)) {
    return <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t("No activity yet.")}</p>;
  }
  return (
    <ul className="mt-5 flex flex-wrap gap-2">
      {Object.entries(byStatus).filter(([, count]) => count > 0).map(([status, count]) => (
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

/** Personal allocation balances (008): each card leads with the current
 * remaining balance — 0 still renders. The whole section is hidden when HR
 * assigned no allocations; expired grants are labeled history and cannot
 * fund new requests. */
function AllocationCards({ allocations }: { allocations: NonNullable<Dashboard["allocations"]> }) {
  const { t } = useLanguage();
  if (allocations.length === 0) return null;
  return (
    <div className="mt-7">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("Allocation balance")}</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allocations.map((a) => (
          <li
            key={a.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{a.type_name}</p>
              {a.expired && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                  {t("Expired")}
                </span>
              )}
            </div>
            <p
              className={`mt-2 text-3xl font-bold tracking-tight ${
                a.remaining <= 0
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-slate-900 dark:text-slate-50"
              }`}
            >
              {formatAllocationAmount(a.remaining, a.unit)}
              <span className="ms-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {t(ALLOCATION_UNIT_LABELS[a.unit])}
              </span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("Current balance")}</p>
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              <div className="flex gap-1">
                <dt>{t("Granted")}</dt>
                <dd className="font-semibold text-slate-700 dark:text-slate-200">{formatAllocationAmount(a.granted, a.unit)}</dd>
              </div>
              <div className="flex gap-1">
                <dt>{t("Reserved")}</dt>
                <dd className="font-semibold text-slate-700 dark:text-slate-200">{formatAllocationAmount(a.reserved, a.unit)}</dd>
              </div>
              <div className="flex gap-1">
                <dt>{t("Used")}</dt>
                <dd className="font-semibold text-slate-700 dark:text-slate-200">{formatAllocationAmount(a.used, a.unit)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {formatDate(a.start_date)} → {formatDate(a.end_date)}
            </p>
            {a.expired && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {a.reserved > 0
                  ? t("Expired — pending requests keep their reservation; it cannot fund new requests.")
                  : t("Expired — it cannot fund new requests.")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardCard({ scope, canReview }: { scope: DashboardScope; canReview: boolean }) {
  const { t, lang } = useLanguage();
  const { data, isLoading, error, refetch } = useQuery<Dashboard>({
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
        {scope !== "personal" && <Link to="/reports" className="text-sm font-semibold workspace-link-quiet">{t("Explore insights")} <span aria-hidden="true">↗</span></Link>}
      </div>
      <div className="space-y-6 p-5 sm:p-7">
        <AsyncState isLoading={isLoading} error={error} onRetry={() => void refetch()}>
          {data && (
            <>
              {scope === "personal" && canReview && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-300/20 dark:bg-amber-300/10">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t("Pending review items")}</h3>
                    <p className="mt-1 text-2xl font-bold text-amber-950 dark:text-amber-50">{data.pending_review}</p>
                    <p className="text-xs text-amber-900/80 dark:text-amber-100/80">{t("Items waiting for your decision")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm font-medium">
                    <Link to="/requests" className="rounded-lg border border-amber-300 px-3 py-2 text-amber-950 hover:bg-amber-100 dark:border-amber-200/30 dark:text-amber-100 dark:hover:bg-white/10">{t("Review requests")}</Link>
                    <Link to="/timesheets" className="rounded-lg border border-amber-300 px-3 py-2 text-amber-950 hover:bg-amber-100 dark:border-amber-200/30 dark:text-amber-100 dark:hover:bg-white/10">{t("Review timesheets")}</Link>
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 dark:border-[#8bd6c2]/20 dark:bg-[#8bd6c2]/10">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-[#8bd6c2]">{t("Approved hours")}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-brand-800 dark:text-slate-100">{formatMinutes(data.approved_minutes, lang)}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t("Period {from} → {to} ({tz})", { from: data.period.from, to: data.period.to, tz: data.period.timezone })}</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div><h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("Requests")}</h3><StatusChips byStatus={data.requests.by_status} basePath="/requests" /></div>
                <div><h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("Timesheets")}</h3><StatusChips byStatus={data.timesheets.by_status} basePath="/timesheets" /></div>
              </div>
              {scope === "personal" && data.allocations && (
                <AllocationCards allocations={data.allocations} />
              )}
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
  const { t } = useLanguage();
  const roles = user?.roles ?? [];
  const isHr = roles.includes("HR");
  const canReview = isHr || roles.includes("Manager");

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-[#103e3a] px-6 py-6 text-white sm:px-8">
        <img src="/brand/logo-icon-dark.png" alt="" aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-64 w-auto opacity-[.08] rtl:-left-12 rtl:right-auto" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div><span className="text-xs font-bold uppercase tracking-[.14em] text-[#b7d9cd]">{t("WELCOME TO YOUR WORKSPACE")}</span><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("My dashboard")}</h1><p className="mt-2 max-w-lg text-sm text-[#d2e6de]">{t("A clearer view of your requests, time and everything that needs your attention.")}</p></div>
          <div className="flex flex-wrap gap-2"><Link to="/requests/new" className="inline-flex items-center rounded-lg bg-[#e6bf71] px-4 py-2.5 text-sm font-bold text-[#223b34] hover:bg-[#f0cd87]">{t("New request")}</Link><Link to="/timesheets" className="inline-flex items-center rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">{t("View timesheets")}</Link></div>
        </div>
      </div>
      {canReview ? (
        <Tabs defaultValue="personal" className="min-w-0">
          <TabsList aria-label={t("Dashboard views")}>
            <TabsTrigger value="personal">{t("Personal overview")}</TabsTrigger>
            <TabsTrigger value="team">{t("Team dashboard")}</TabsTrigger>
            {isHr && <TabsTrigger value="organization">{t("Organization dashboard")}</TabsTrigger>}
          </TabsList>
          <TabsContent value="personal"><DashboardCard scope="personal" canReview /></TabsContent>
          <TabsContent value="team"><DashboardCard scope="team" canReview /></TabsContent>
          {isHr && <TabsContent value="organization"><DashboardCard scope="organization" canReview /></TabsContent>}
        </Tabs>
      ) : (
        <DashboardCard scope="personal" canReview={false} />
      )}
    </div>
  );
}
