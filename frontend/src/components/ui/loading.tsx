import { useLanguage } from "../../app/LanguageProvider";

/** Brand spinner — a teal ring arc. Always paired with role="status" and an
 * accessible label by the wrappers below. */
export function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-[3px] border-brand-700/20 border-t-brand-700 dark:border-[#8bd6c2]/20 dark:border-t-[#8bd6c2] ${className}`}
    />
  );
}

/** Centered spinner + label for in-content loading (lists, panels, Suspense). */
export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground"
    >
      <Spinner className="h-6 w-6" />
      <span>{label ?? t("Loading…")}</span>
    </div>
  );
}

/** Full-screen loading — used by the auth gates and lazy page fallbacks. */
export function FullScreenLoading() {
  const { t } = useLanguage();
  return (
    <main
      role="status"
      className="grid min-h-screen place-items-center p-6"
      aria-label={t("Loading…")}
    >
      <div className="flex flex-col items-center gap-4">
        <img
          src="/brand/logo-icon.png"
          alt=""
          className="h-12 w-12 animate-pulse dark:hidden"
        />
        <img
          src="/brand/logo-icon-dark.png"
          alt=""
          className="hidden h-12 w-12 animate-pulse dark:block"
        />
        <Spinner />
        <span className="text-sm text-muted-foreground">{t("Loading…")}</span>
      </div>
    </main>
  );
}
