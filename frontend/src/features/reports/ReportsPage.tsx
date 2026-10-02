import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { listEmployees } from "../../api/employees";
import { listRequestTypes } from "../../api/requests";
import {
  downloadReportCsv,
  getHoursReport,
  getRequestsReport,
  type HoursReportParams,
  type RequestsReportParams,
} from "../../api/reporting";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { formatMinutes } from "../timesheets/timezone";
import { useAuth } from "../auth/auth-context";

const HOURS_STATUSES = [
  { value: "approved", label: "Approved" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_hr", label: "Pending HR" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

const REQUEST_STATUSES = [
  { value: "", label: "All statuses" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_hr", label: "Pending HR" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

const inputClass = "rounded-md border px-2 py-1.5 text-sm";

function useScopedEmployees() {
  return useQuery({
    queryKey: ["employees", "report-filter"],
    queryFn: () => listEmployees({ is_active: "true", page_size: 100 }),
  });
}

function TypeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["request-types", "report-filter"],
    queryFn: () => listRequestTypes(),
  });
  return (
    <select
      aria-label="Request type"
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All types</option>
      {(data?.results ?? []).map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

function EmployeeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { data } = useScopedEmployees();
  return (
    <select
      aria-label="Employee"
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All employees</option>
      {(data?.results ?? []).map((e) => (
        <option key={e.id} value={e.id}>
          {e.display_name} ({e.employee_code})
        </option>
      ))}
    </select>
  );
}

function ExportButton({
  kind,
  params,
}: {
  kind: "working-hours" | "requests";
  params: HoursReportParams | RequestsReportParams;
}) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const exportMutation = useMutation({
    mutationFn: () => downloadReportCsv(kind, params),
  });
  if (!roles.includes("Manager") && !roles.includes("HR")) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
        disabled={exportMutation.isPending}
        onClick={() => exportMutation.mutate()}
      >
        {exportMutation.isPending ? "Exporting…" : "Export CSV"}
      </button>
      {exportMutation.error && (
        <span role="alert" className="text-xs text-red-700">
          {exportMutation.error.message}
        </span>
      )}
    </span>
  );
}

function HoursReport({
  params,
  onPage,
}: {
  params: HoursReportParams;
  onPage: (p: number) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["report", "hours", params],
    queryFn: () => getHoursReport(params),
    placeholderData: (prev) => prev,
  });
  return (
    <AsyncState
      isLoading={isLoading}
      error={error}
      isEmpty={!!data && data.results.length === 0}
      emptyText="No working hours in this period."
    >
      {data && (
        <>
          <p className="mb-2 text-sm text-gray-600">
            {data.meta.period.from} → {data.meta.period.to} ({data.meta.timezone}
            ) — grouped by {data.meta.grouping} — total{" "}
            <strong>{formatMinutes(data.totals.minutes)}</strong>
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Employee</th>
                <th className="py-2 pr-2">Department</th>
                <th className="py-2 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr
                  key={`${r.work_date}-${r.employee_id}`}
                  className="border-b"
                >
                  <td className="py-2 pr-2">{r.work_date}</td>
                  <td className="py-2 pr-2">
                    {r.employee_name}{" "}
                    <span className="text-gray-500">({r.employee_code})</span>
                  </td>
                  <td className="py-2 pr-2">{r.department ?? "—"}</td>
                  <td className="py-2 text-right">
                    {formatMinutes(r.minutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            count={data.count}
            page={params.page ?? 1}
            pageSize={25}
            onPage={onPage}
          />
        </>
      )}
    </AsyncState>
  );
}

function RequestsReport({
  params,
  onPage,
}: {
  params: RequestsReportParams;
  onPage: (p: number) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["report", "requests", params],
    queryFn: () => getRequestsReport(params),
    placeholderData: (prev) => prev,
  });
  return (
    <AsyncState
      isLoading={isLoading}
      error={error}
      isEmpty={!!data && data.results.length === 0}
      emptyText="No submitted requests in this period."
    >
      {data && (
        <>
          <p className="mb-2 text-sm text-gray-600">
            {data.meta.period.from} → {data.meta.period.to} by submitted date (
            {data.meta.timezone}) — <strong>{data.totals.count}</strong>{" "}
            requests
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-2">Title</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Employee</th>
                <th className="py-2 pr-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-2">{r.title}</td>
                  <td className="py-2 pr-2">{r.type}</td>
                  <td className="py-2 pr-2">{r.status}</td>
                  <td className="py-2 pr-2">
                    {r.employee_name}{" "}
                    <span className="text-gray-500">({r.employee_code})</span>
                  </td>
                  <td className="py-2 pr-2">
                    {r.submitted_at
                      ? new Date(r.submitted_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            count={data.count}
            page={params.page ?? 1}
            pageSize={25}
            onPage={onPage}
          />
        </>
      )}
    </AsyncState>
  );
}

/** Scoped reports (005): drafts are never included (submitted-date basis,
 * D-009); filters narrow within the caller's server-side scope. */
export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"hours" | "requests">("hours");

  const filters = {
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    status: params.get("status") ?? "",
    employee: params.get("employee") ?? "",
    type: params.get("type") ?? "",
    ordering: params.get("ordering") ?? "",
    page: Number(params.get("page") ?? 1),
  };

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  };

  const hoursParams: HoursReportParams = {
    from: filters.from || undefined,
    to: filters.to || undefined,
    status: filters.status || undefined,
    employee: filters.employee || undefined,
    ordering: filters.ordering || undefined,
    page: filters.page,
  };
  const requestsParams: RequestsReportParams = {
    ...hoursParams,
    type: filters.type || undefined,
  };

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Reports</h1>
        <div role="tablist" aria-label="Report type" className="flex gap-1">
          {(
            [
              ["hours", "Working hours"],
              ["requests", "Requests"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === key
                  ? "bg-brand-700 text-white"
                  : "text-gray-700 hover:bg-brand-50"
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-gray-600">From</span>
          <input
            type="date"
            className={inputClass}
            value={filters.from}
            onChange={(e) => setFilter("from", e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-gray-600">To</span>
          <input
            type="date"
            className={inputClass}
            value={filters.to}
            onChange={(e) => setFilter("to", e.target.value)}
          />
        </label>
        {tab === "requests" ? (
          <select
            aria-label="Status"
            className={inputClass}
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            {REQUEST_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <select
            aria-label="Status"
            className={inputClass}
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="">Approved only (default)</option>
            {HOURS_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <EmployeeFilter
          value={filters.employee}
          onChange={(v) => setFilter("employee", v)}
        />
        {tab === "requests" && (
          <TypeFilter
            value={filters.type}
            onChange={(v) => setFilter("type", v)}
          />
        )}
        <select
          aria-label="Ordering"
          className={inputClass}
          value={filters.ordering}
          onChange={(e) => setFilter("ordering", e.target.value)}
        >
          <option value="">Default order</option>
          {tab === "hours" ? (
            <>
              <option value="work_date">Oldest first</option>
              <option value="-work_date">Newest first</option>
              <option value="-minutes">Most hours</option>
              <option value="employee_code">Employee code</option>
            </>
          ) : (
            <>
              <option value="-submitted_at">Recently submitted</option>
              <option value="submitted_at">Oldest submitted</option>
              <option value="title">Title A–Z</option>
              <option value="status">Status</option>
            </>
          )}
        </select>
        <ExportButton
          kind={tab === "hours" ? "working-hours" : "requests"}
          params={tab === "hours" ? hoursParams : requestsParams}
        />
      </div>

      <div className="mt-4">
        {tab === "hours" ? (
          <HoursReport
            params={hoursParams}
            onPage={(p) => {
              const next = new URLSearchParams(params);
              next.set("page", String(p));
              setParams(next);
            }}
          />
        ) : (
          <RequestsReport
            params={requestsParams}
            onPage={(p) => {
              const next = new URLSearchParams(params);
              next.set("page", String(p));
              setParams(next);
            }}
          />
        )}
      </div>
    </div>
  );
}
