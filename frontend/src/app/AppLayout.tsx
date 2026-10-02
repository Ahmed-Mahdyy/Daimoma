import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../features/auth/auth-context";
import { NotificationBell } from "../features/notifications/NotificationBell";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm ${
    isActive ? "bg-brand-700 text-white" : "text-gray-700 hover:bg-brand-50"
  }`;

/** Authenticated shell: brand, role-aware nav, notification bell, sign out. */
export function AppLayout() {
  const { user, signOut } = useAuth();
  const roles = user?.roles ?? [];
  const isHr = roles.includes("HR");
  const canSeeAudit = isHr || roles.includes("Manager");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
          <img src="/brand/logo-icon.png" alt="" className="h-8 w-8" />
          <span className="text-lg font-semibold text-brand-800">Daimoma</span>
          <nav className="flex flex-1 items-center gap-1" aria-label="Main">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <NavLink to="/timesheets" className={linkClass}>
              Timesheets
            </NavLink>
            <NavLink to="/requests" className={linkClass}>
              Requests
            </NavLink>
            <NavLink to="/employees" className={linkClass}>
              Employees
            </NavLink>
            {isHr && (
              <NavLink to="/requests/types" className={linkClass}>
                Request types
              </NavLink>
            )}
            {canSeeAudit && (
              <NavLink to="/audit" className={linkClass}>
                Audit
              </NavLink>
            )}
            {isHr && (
              <NavLink to="/departments" className={linkClass}>
                Departments
              </NavLink>
            )}
            <NavLink to="/settings" className={linkClass}>
              Settings
            </NavLink>
          </nav>
          <NotificationBell />
          <span className="hidden text-sm text-gray-600 sm:inline">
            {user?.display_name || user?.email}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
