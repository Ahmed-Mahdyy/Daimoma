import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import { AppLayout } from "./AppLayout";
import { AuditPage } from "../features/audit/AuditPage";
import { AuthProvider } from "../features/auth/AuthProvider";
import { useAuth } from "../features/auth/auth-context";
import { LoginPage } from "../features/auth/LoginPage";
import { RequestResetPage } from "../features/auth/RequestResetPage";
import { SetPasswordPage } from "../features/auth/SetPasswordPage";
import { DepartmentsPage } from "../features/departments/DepartmentsPage";
import { EmployeeDetailPage } from "../features/employees/EmployeeDetailPage";
import { EmployeesPage } from "../features/employees/EmployeesPage";
import { ProvisionEmployeePage } from "../features/employees/ProvisionEmployeePage";
import { RequestDetailPage } from "../features/requests/RequestDetailPage";
import { RequestEditPage } from "../features/requests/RequestEditPage";
import { RequestFormPage } from "../features/requests/RequestFormPage";
import { RequestsPage } from "../features/requests/RequestsPage";
import { RequestTypesPage } from "../features/requests/RequestTypesPage";
import { OrgSettingsPage } from "../features/settings/OrgSettingsPage";
import { SettingsPage } from "../features/settings/SettingsPage";

const queryClient = new QueryClient();

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status">Loading…</p>
      </main>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function HomePage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Welcome, {user?.display_name || user?.email}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Use the navigation above to manage employees, review your team, or
        update your settings.
      </p>
    </div>
  );
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
          { path: "/", element: <HomePage /> },
          { path: "/employees", element: <EmployeesPage /> },
          { path: "/employees/new", element: <ProvisionEmployeePage /> },
          { path: "/employees/:id", element: <EmployeeDetailPage /> },
          { path: "/requests", element: <RequestsPage /> },
          { path: "/requests/new", element: <RequestFormPage /> },
          { path: "/requests/types", element: <RequestTypesPage /> },
          { path: "/requests/:id", element: <RequestDetailPage /> },
          { path: "/requests/:id/edit", element: <RequestEditPage /> },
          { path: "/departments", element: <DepartmentsPage /> },
          { path: "/audit", element: <AuditPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "/settings/organization", element: <OrgSettingsPage /> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
