import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  getOrCreateTimesheet,
  listTimesheets,
} from "../../api/timesheets";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { formatMinutes } from "./timezone";
import { TimesheetStatusBadge } from "./TimesheetStatusBadge";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "collecting", label: "Collecting" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_hr", label: "Pending HR" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

const ORDERING_OPTIONS = [
  { value: "-period_start", label: "Newest week" },
  { value: "period_start", label: "Oldest week" },
  { value: "status", label: "Status" },
  { value: "-status", label: "Status (desc)" },
];

/** Scoped timesheet list — the server scopes by role: employees see their
 * own sheets, managers direct reports' submitted sheets, HR the org's. */
export function TimesheetsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const filters = {
    status: params.get("status") ?? "",
    ordering: params.get("ordering") ?? "-period_start",
    page: Number(params.get("page") ?? 1),
    page_size: 25,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["timesheets", filters],
    queryFn: () => listTimesheets(filters),
    placeholderData: (prev) => prev,
  });

  const [anchorDate, setAnchorDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const openWeek = useMutation({
    mutationFn: (date: string) => getOrCreateTimesheet(date),
    onSuccess: (sheet) => {
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      navigate(`/timesheets/${sheet.id}`);
    },
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const input = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Timesheets</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            <span className="sr-only">Week containing date</span>
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => openWeek.mutate(anchorDate)}
            disabled={openWeek.isPending}
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Open week
          </button>
        </div>
      </div>
      {openWeek.isError && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          Could not open that week. Please try again.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm">
          <span className="sr-only">Status</span>
          <select
            className={input}
            value={filters.status}
            onChange={(e) => setParam("status", e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Ordering</span>
          <select
            className={input}
            value={filters.ordering}
            onChange={(e) => setParam("ordering", e.target.value)}
          >
            {ORDERING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <AsyncState isLoading={isLoading} error={error}>
        {data && data.results.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
            No timesheets found.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">Week</th>
                  <th className="px-4 py-2 text-start font-medium">Employee</th>
                  <th className="px-4 py-2 text-start font-medium">Status</th>
                  <th className="px-4 py-2 text-start font-medium">Total</th>
                  <th className="px-4 py-2 text-start font-medium">Reviewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.results.map((sheet) => (
                  <tr key={sheet.id}>
                    <td className="px-4 py-2">
                      <Link
                        to={`/timesheets/${sheet.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {sheet.period_start} – {sheet.period_end}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {sheet.employee_name || sheet.employee_email}
                    </td>
                    <td className="px-4 py-2">
                      <TimesheetStatusBadge status={sheet.status} />
                      {sheet.cycle > 1 && (
                        <span className="ms-1 text-xs text-gray-500">
                          cycle {sheet.cycle}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {formatMinutes(sheet.total_minutes)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {sheet.reviewer_name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncState>

      {data && (
        <PaginationControls
          page={filters.page}
          count={data.count}
          pageSize={filters.page_size}
          onPage={(p) => setParam("page", String(p))}
        />
      )}
    </div>
  );
}
