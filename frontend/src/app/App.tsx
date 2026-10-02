import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import { AppLayout } from "./AppLayout";
import { LanguageProvider, useLanguage } from "./LanguageProvider";
import { ThemeProvider } from "./ThemeProvider";
import { AuditPage } from "../features/audit/AuditPage";
import { AuthProvider } from "../features/auth/AuthProvider";
import { useAuth } from "../features/auth/auth-context";
import { LoginPage } from "../features/auth/LoginPage";
import { RequestResetPage } from "../features/auth/RequestResetPage";
import { SetPasswordPage } from "../features/auth/SetPasswordPage";
import { DepartmentDetailPage } from "../features/departments/DepartmentDetailPage";
import { DepartmentsPage } from "../features/departments/DepartmentsPage";
import { EmployeeDetailPage } from "../features/employees/EmployeeDetailPage";
import { EmployeesPage } from "../features/employees/EmployeesPage";
import { ProvisionEmployeePage } from "../features/employees/ProvisionEmployeePage";
import { RequestDetailPage } from "../features/requests/RequestDetailPage";
import { RequestEditPage } from "../features/requests/RequestEditPage";
import { RequestFormPage } from "../features/requests/RequestFormPage";
import { RequestsPage } from "../features/requests/RequestsPage";
import { RequestTypesPage } from "../features/requests/RequestTypesPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { OrgSettingsPage } from "../features/settings/OrgSettingsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TimesheetDetailPage } from "../features/timesheets/TimesheetDetailPage";
import { TimesheetsPage } from "../features/timesheets/TimesheetsPage";

const DashboardPage = lazy(() => import("../features/dashboards/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const queryClient = new QueryClient();

function RequireHr({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.roles.includes("HR") ? children : <Navigate to="/" replace />;
}

function LoadingStatus({ label }: { label: string }) {
  const { t } = useLanguage();
  return <p role="status">{t(label)}</p>;
}

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status">{t("Loading…")}</p>
      </main>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/reset-password", element: <RequestResetPage /> },
  {
    path: "/reset-password/confirm",
    element: <SetPasswordPage mode="reset" />,
  },
  {
    path: "/accept-invitation",
    element: <SetPasswordPage mode="invitation" />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Suspense fallback={<LoadingStatus label="Loading…" />}><DashboardPage /></Suspense> },
          { path: "/reports", element: <Suspense fallback={<LoadingStatus label="Loading…" />}><ReportsPage /></Suspense> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/employees", element: <EmployeesPage /> },
          { path: "/employees/new", element: <ProvisionEmployeePage /> },
          { path: "/employees/:id", element: <EmployeeDetailPage /> },
          { path: "/requests", element: <RequestsPage /> },
          { path: "/requests/new", element: <RequestFormPage /> },
          { path: "/requests/types", element: <RequestTypesPage /> },
          { path: "/requests/:id", element: <RequestDetailPage /> },
          { path: "/requests/:id/edit", element: <RequestEditPage /> },
          { path: "/timesheets", element: <TimesheetsPage /> },
          { path: "/timesheets/:id", element: <TimesheetDetailPage /> },
          { path: "/departments", element: <RequireHr><DepartmentsPage /></RequireHr> },
          { path: "/departments/:id", element: <RequireHr><DepartmentDetailPage /></RequireHr> },
          { path: "/audit", element: <AuditPage /> },
          { path: "/profile", element: <SettingsPage /> },
          { path: "/settings", element: <RequireHr><SettingsPage /></RequireHr> },
          { path: "/settings/organization", element: <RequireHr><OrgSettingsPage /></RequireHr> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
