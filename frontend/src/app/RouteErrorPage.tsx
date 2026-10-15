import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLanguage } from "./LanguageProvider";

function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported|loading chunk|failed to fetch/i.test(error.message)
  );
}

function ErrorView({
  error,
  notFound = false,
  embedded = false,
}: {
  error?: unknown;
  notFound?: boolean;
  embedded?: boolean;
}) {
  const { t } = useLanguage();
  const is404 =
    notFound || (isRouteErrorResponse(error) && error.status === 404);
  const chunkFailed = !is404 && isChunkLoadError(error);
  const title = is404
    ? t("Page not found")
    : t("Something went wrong");
  const body = is404
    ? t("The page you are looking for does not exist or was moved.")
    : chunkFailed
      ? t("This page failed to load — the app may have been updated. Reload to get the latest version.")
      : t("This page hit an unexpected error. You can go back home or reload and try again.");

  return (
    <main
      className={
        embedded
          ? "grid min-h-[50vh] place-items-center px-4 py-10"
          : "grid min-h-screen place-items-center p-6"
      }
    >
      <div className="workspace-panel w-full max-w-md p-8 text-center">
        <img
          src="/brand/logo-icon.png"
          alt=""
          className="mx-auto h-12 w-12 dark:hidden"
        />
        <img
          src="/brand/logo-icon-dark.png"
          alt=""
          className="mx-auto hidden h-12 w-12 dark:block"
        />
        {is404 && (
          <p className="mt-4 text-4xl font-bold tracking-tight text-brand-700 dark:text-[#8bd6c2]">
            404
          </p>
        )}
        <h1 className={`${is404 ? "mt-1" : "mt-4"} text-xl font-semibold`}>
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild>
            <Link to="/">{t("Back to home")}</Link>
          </Button>
          {!is404 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              {t("Reload page")}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

/** Router errorElement — catches route errors, lazy chunk failures and 404s
 * thrown outside the authed shell. */
export function RouteErrorPage() {
  const error = useRouteError();
  return <ErrorView error={error} />;
}

/** In-shell error view — rendered by the ErrorBoundary around <Outlet/> so the
 * sidebar and topbar stay up when a page crashes. */
export function RouteErrorInline({ error }: { error: unknown }) {
  return <ErrorView error={error} embedded />;
}

/** Catch-all for unmatched routes inside the authed layout. */
export function NotFoundPage() {
  return <ErrorView notFound embedded />;
}
