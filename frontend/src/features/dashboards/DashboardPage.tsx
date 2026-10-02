import { useQuery } from "@tanstack/react-query";

import {
  getDashboard,
  type Dashboard,
  type DashboardScope,
} from "../../api/reporting";
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

function StatusChips({ byStatus }: { byStatus: Record<string, number> }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {Object.entries(byStatus).map(([status, count]) => (
        <li
          key={status}
          className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs"
        >
          <span className="font-medium">{STATUS_LABELS[status] ?? status}</span>
          <span className="ml-1 text-gray-600">{count}</span>
        </li>
      ))}
    </ul>
  );
}

function DashboardCard({ scope }: { scope: DashboardScope }) {
  const { data, isLoading, error } = useQuery<Dashboard>({
    queryKey: ["dashboard", scope],
    queryFn: () => getDashboard(scope),
  });

  const title = {
    personal: "My dashboard",
    team: "Team dashboard",
    organization: "Organization dashboard",
  }[scope];

  return (
    <section
      aria-labelledby={`dash-${scope}`}
      className="rounded-lg border bg-white p-4 shadow-sm"
    >
      <h2 id={`dash-${scope}`} className="text-lg font-semibold">
        {title}
      </h2>
      <AsyncState isLoading={isLoading} error={error}>
        {data && (
          <>
            <p className="mt-1 text-xs text-gray-500">
              Period {data.period.from} → {data.period.to} (
              {data.period.timezone})
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Requests</h3>
                <StatusChips byStatus={data.requests.by_status} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">
                  Timesheets
                </h3>
                <StatusChips byStatus={data.timesheets.by_status} />
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-md bg-brand-50 p-3">
                  <p className="text-xs text-gray-600">Approved hours</p>
                  <p className="text-2xl font-semibold text-brand-800">
                    {formatMinutes(data.approved_minutes)}
                  </p>
                </div>
                <div className="rounded-md bg-amber-50 p-3">
                  <p className="text-xs text-gray-600">
                    Pending review items
                  </p>
                  <p className="text-2xl font-semibold text-amber-800">
                    {data.pending_review}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </AsyncState>
    </section>
  );
}

/** Role-scoped dashboard (005): everyone gets personal; managers and HR add
 * team; HR adds organization. The server enforces the scope — these flags
 * only control which cards render. */
export function DashboardPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isHr = roles.includes("HR");
  const isManager = roles.includes("Manager");

  return (
    <div className="flex flex-col gap-6">
      <DashboardCard scope="personal" />
      {(isManager || isHr) && <DashboardCard scope="team" />}
      {isHr && <DashboardCard scope="organization" />}
    </div>
  );
}
