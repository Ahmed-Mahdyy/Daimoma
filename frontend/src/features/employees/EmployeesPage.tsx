import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { listDepartments } from "../../api/departments";
import { listEmployees } from "../../api/employees";
import { AsyncState } from "../../components/ui/AsyncState";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { useAuth } from "../auth/auth-context";

const ORDERING_OPTIONS = [
  { value: "employee_code", label: "Code" },
  { value: "display_name", label: "Name" },
  { value: "-display_name", label: "Name (Z–A)" },
  { value: "email", label: "Email" },
  { value: "job_title", label: "Job title" },
];

/** Scoped employee directory (FR-009): filters, ordering, pagination.
 * The server scopes by role — employees see only themselves here. */
export function EmployeesPage() {
  const { user } = useAuth();
  const isHr = user?.roles.includes("HR") ?? false;
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");

  const filters = {
    search: params.get("search") ?? "",
    is_active: params.get("is_active") ?? "",
    department: params.get("department") ?? "",
    role: params.get("role") ?? "",
    ordering: params.get("ordering") ?? "employee_code",
    page: Number(params.get("page") ?? 1),
    page_size: 25,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["employees", filters],
    queryFn: () => listEmployees(filters),
    placeholderData: (prev) => prev,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
    enabled: isHr,
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
        <h1 className="text-xl font-semibold">Employees</h1>
        {isHr && (
          <Link
            to="/employees/new"
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
          >
            New employee
          </Link>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam("search", searchInput);
          }}
        >
          <input
            aria-label="Search employees"
            placeholder="Search name, code, email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${input} w-56`}
          />
        </form>
        <select
          aria-label="Filter by status"
          value={filters.is_active}
          onChange={(e) => setParam("is_active", e.target.value)}
          className={input}
        >
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select
          aria-label="Filter by role"
          value={filters.role}
          onChange={(e) => setParam("role", e.target.value)}
          className={input}
        >
          <option value="">Any role</option>
          <option value="Employee">Employee</option>
          <option value="Manager">Manager</option>
          <option value="HR">HR</option>
        </select>
        {departments && (
          <select
            aria-label="Filter by department"
            value={filters.department}
            onChange={(e) => setParam("department", e.target.value)}
            className={input}
          >
            <option value="">Any department</option>
            {departments.results.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Order by"
          value={filters.ordering}
          onChange={(e) => setParam("ordering", e.target.value)}
          className={input}
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
        isEmpty={data?.results.length === 0}
        emptyText="No employees match these filters."
      >
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Roles</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.employee_code}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/employees/${e.id}`}
                      className="text-brand-700 underline"
                    >
                      {e.display_name || e.email}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{e.email}</td>
                  <td className="px-3 py-2">{e.department_name ?? "—"}</td>
                  <td className="px-3 py-2">{e.roles.join(", ") || "Employee"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        e.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {e.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && (
            <PaginationControls
              count={data.count}
              page={filters.page}
              pageSize={filters.page_size}
              onPage={(p) => setParam("page", String(p))}
            />
          )}
        </div>
      </AsyncState>
    </div>
  );
}
