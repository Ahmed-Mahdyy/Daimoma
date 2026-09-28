import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import { AuthProvider } from "../features/auth/AuthProvider";
import { useAuth } from "../features/auth/auth-context";
import { LoginPage } from "../features/auth/LoginPage";
import { RequestResetPage } from "../features/auth/RequestResetPage";
import { SetPasswordPage } from "../features/auth/SetPasswordPage";
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
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Daimoma</h1>
      <p className="mt-2">Welcome, {user?.display_name || user?.email}.</p>
      <a href="/settings" className="mt-4 inline-block text-blue-700 underline">
        Settings
      </a>
    </main>
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
      { path: "/", element: <HomePage /> },
      { path: "/settings", element: <SettingsPage /> },
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
