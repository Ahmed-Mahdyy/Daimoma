import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { listRequests, listRequestTypes } from "../../api/requests";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { StatusBadge } from "./StatusBadge";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_hr", label: "Pending HR" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

const ORDERING_OPTIONS = [
  { value: "-created_at", label: "Newest" },
  { value: "created_at", label: "Oldest" },
  { value: "title", label: "Title" },
  { value: "-submitted_at", label: "Recently submitted" },
  { value: "status", label: "Status" },
];

/** Scoped request list (FR-008): the server scopes by role — employees see
 * their own work, managers their reports' non-draft work, HR the org's. */
export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");

  const filters = {
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    type: params.get("type") ?? "",
    ordering: params.get("ordering") ?? "-created_at",
    page: Number(params.get("page") ?? 1),
    page_size: 25,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["requests", filters],
    queryFn: () => listRequests(filters),
    placeholderData: (prev) => prev,
  });

  const { data: types } = useQuery({
    queryKey: ["request-types"],
    queryFn: listRequestTypes,
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Requests</h1>
        <Link
          to="/requests/new"
          className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          New request
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam("search", searchInput);
          }}
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title or description"
            aria-label="Search requests"
            className={input}
          />
          <button
            type="submit"
            className="ml-1 rounded-md border px-2 py-1.5 text-sm hover:bg-gray-100"
          >
            Search
          </button>
        </form>
        <select
          aria-label="Status"
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
        <select
          aria-label="Type"
          className={input}
          value={filters.type}
          onChange={(e) => setParam("type", e.target.value)}
        >
          <option value="">All types</option>
          {types?.results.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Ordering"
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
      </div>

      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={!data || data.results.length === 0}
        emptyText="No requests match your filters."
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Employee</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {data?.results.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link
                    to={`/requests/${r.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {r.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-gray-700">{r.type_name}</td>
                <td className="py-2 pr-4 text-gray-700">
                  {r.employee_name || r.employee_email}
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-2 text-gray-600">
                  {r.submitted_at
                    ? new Date(r.submitted_at).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncState>

      {data && (
        <PaginationControls
          count={data.count}
          page={filters.page}
          pageSize={filters.page_size}
          onPage={(p) => setParam("page", String(p))}
        />
      )}
    </div>
  );
}
