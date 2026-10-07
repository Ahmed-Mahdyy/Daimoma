import { ApiError, apiErrorMessage } from "../../api/client";
import { useLanguage } from "../../app/LanguageProvider";

interface AsyncStateProps {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyText?: string;
  /** Render a retry button inside the error block when provided. */
  onRetry?: () => void;
  children: React.ReactNode;
}

/** Shared async-state wrapper: loading → error → empty → content.
 * Centralizes the "unavailable" handling every list/detail needs. */
export function AsyncState({
  isLoading,
  error,
  isEmpty = false,
  emptyText,
  onRetry,
  children,
}: AsyncStateProps) {
  const { t } = useLanguage();
  if (isLoading) {
    return (
      <p role="status" className="p-4 text-sm text-gray-600">
        {t("Loading…")}
      </p>
    );
  }
  if (error) {
    const message =
      error instanceof ApiError
        ? apiErrorMessage(error)
        : error instanceof Error
          ? error.message
          : t("Something went wrong.");
    return (
      <div
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200"
      >
        {message}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ms-3 font-semibold underline underline-offset-2"
          >
            {t("Try again")}
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <p className="p-4 text-sm text-gray-500">{emptyText ?? t("Nothing to show.")}</p>
    );
  }
  return <>{children}</>;
}
