import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { listAuditEvents } from "../../api/audit";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";

/** Scoped audit history (FR-006): HR sees the whole organization; managers
 * see events affecting current direct reports. Read-only — append-only on
 * the server. */
export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const [actionInput, setActionInput] = useState(params.get("action") ?? "");
  const page = Number(params.get("page") ?? 1);
  const action = params.get("action") ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["auditEvents", { page, action }],
    queryFn: () => listAuditEvents({ page, action: action || undefined }),
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Audit history</h1>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = new URLSearchParams();
          if (actionInput) next.set("action", actionInput);
          setParams(next, { replace: true });
        }}
      >
        <input
          aria-label="Filter by action"
          placeholder="Filter by action (e.g. employee_updated)"
          className="w-72 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          value={actionInput}
          onChange={(e) => setActionInput(e.target.value)}
        />
      </form>
      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={data?.results.length === 0}
        emptyText="No audit events yet."
      >
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Changes</th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((e) => (
                <tr key={e.id} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                    {new Date(e.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2">{e.actor_name ?? e.actor_email ?? "system"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.target_type}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {Object.entries(e.metadata)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && (
            <PaginationControls
              count={data.count}
              page={page}
              pageSize={25}
              onPage={(p) => {
                const next = new URLSearchParams(params);
                next.set("page", String(p));
                setParams(next, { replace: true });
              }}
            />
          )}
        </div>
      </AsyncState>
    </div>
  );
}
