import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../api/client";
import { fetchMe, logout as apiLogout } from "../../api/auth";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    // An unauthenticated probe returns 403/authentication_required —
    // that is a state (signed out), not an error worth retrying.
    queryFn: async () => {
      try {
        return await fetchMe();
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === "authentication_required"
        ) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Any API call that hits a dead session clears cached auth — RequireAuth
  // then routes to /login instead of leaving stale authenticated UI.
  useEffect(() => {
    const onDead = () => queryClient.setQueryData(["me"], null);
    window.addEventListener("daimoma:unauthenticated", onDead);
    return () => window.removeEventListener("daimoma:unauthenticated", onDead);
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Clear all scoped query data, then hard-navigate to /login — a full
      // reload guarantees no stale client state survives sign-out
      // (contracts/api.md).
      queryClient.clear();
      window.location.assign("/login");
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading,
      isAuthenticated: data != null,
      refresh,
      signOut,
    }),
    [data, isLoading, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
