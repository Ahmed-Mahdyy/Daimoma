import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  cancelCheckIn,
  checkIn,
  checkOut,
  getPunchStatus,
} from "../../api/timesheets";
import { apiErrorMessage } from "../../api/client";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useLanguage } from "../../app/LanguageProvider";
import { useAuth } from "../auth/auth-context";

function formatElapsed(startedAtMs: number): string {
  const total = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Compact topbar punch clock: one tap to check in, then a live elapsed
 * timer with check-out / cancel. Shares the ["punch"] query key with the
 * dashboard and timesheets controls so all stay in sync. Hidden for users
 * without an employee profile. */
export function PunchWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [, setTick] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["punch"],
    queryFn: getPunchStatus,
    refetchInterval: 30_000,
    enabled: !!user?.employee_code,
  });

  const open = data?.open ?? false;
  const startedAt = data?.started_at ? Date.parse(data.started_at) : null;

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!error) return;
    const onClick = (e: MouseEvent) => {
      if (!errorRef.current?.contains(e.target as Node)) setError(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [error]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["punch"] });
    void queryClient.invalidateQueries({ queryKey: ["timesheets"] });
  };

  const action = useMutation<unknown, unknown, "in" | "out" | "cancel">({
    mutationFn: (kind) => {
      if (kind === "in") return checkIn();
      if (kind === "out") return checkOut();
      return cancelCheckIn();
    },
    onSuccess: () => {
      setError(null);
      setConfirmCancel(false);
      refresh();
    },
    onError: (e) => {
      setError(apiErrorMessage(e));
      refresh();
    },
  });

  if (!user?.employee_code) return null;

  return (
    <div className="relative" ref={errorRef}>
      {!open ? (
        <button
          type="button"
          disabled={action.isPending}
          aria-label={t("punch.checkIn")}
          title={t("punch.checkIn")}
          onClick={() => action.mutate("in")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-700/30 bg-brand-700/10 px-3 py-1.5 text-xs font-bold text-brand-800 transition-colors hover:bg-brand-700 hover:text-white disabled:opacity-60 dark:border-[#8bd6c2]/40 dark:bg-[#8bd6c2]/10 dark:text-[#8bd6c2] dark:hover:bg-[#8bd6c2] dark:hover:text-[#102b2b]"
        >
          <LogIn className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{action.isPending ? "…" : t("punch.checkIn")}</span>
        </button>
      ) : (
        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-600/40 bg-emerald-600/10 py-1 pe-1 ps-2.5 dark:border-[#8bd6c2]/40 dark:bg-[#8bd6c2]/10">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span
            className="text-xs font-bold tabular-nums text-emerald-800 dark:text-[#a8e6cf]"
            title={startedAt ? `${t("punch.checkedInSince")} ${new Date(startedAt).toLocaleTimeString()}` : t("punch.checkedIn")}
            aria-live="off"
          >
            {startedAt ? formatElapsed(startedAt) : "…"}
          </span>
          <button
            type="button"
            aria-label={t("punch.checkOut")}
            title={t("punch.checkOut")}
            disabled={action.isPending}
            onClick={() => action.mutate("out")}
            className="rounded-full bg-emerald-700 p-1.5 text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 dark:bg-[#8bd6c2] dark:text-[#102b2b] dark:hover:bg-[#a8e6cf]"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t("punch.cancel")}
            title={t("punch.cancel")}
            disabled={action.isPending}
            onClick={() => setConfirmCancel(true)}
            className="rounded-full p-1.5 text-emerald-800/70 transition-colors hover:bg-black/10 hover:text-emerald-900 disabled:opacity-60 dark:text-[#a8e6cf]/70 dark:hover:bg-white/10 dark:hover:text-[#a8e6cf]"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmCancel}
        danger
        title={t("punch.confirmTitle")}
        body={t("punch.confirmBody")}
        confirmLabel={t("punch.confirmLabel")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => action.mutate("cancel")}
        onCancel={() => setConfirmCancel(false)}
      />
      {error && (
        <div
          role="alert"
          className="absolute end-0 top-full z-40 mt-2 w-64 rounded-xl border bg-popover p-3 text-xs leading-5 text-popover-foreground shadow-lg"
        >
          {error}
        </div>
      )}
    </div>
  );
}
