interface AsyncStateProps {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}

/** Shared async-state wrapper: loading → error → empty → content.
 * Centralizes the "unavailable" handling every list/detail needs. */
export function AsyncState({
  isLoading,
  error,
  isEmpty = false,
  emptyText = "Nothing to show.",
  children,
}: AsyncStateProps) {
  if (isLoading) {
    return (
      <p role="status" className="p-4 text-sm text-gray-600">
        Loading…
      </p>
    );
  }
  if (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return (
      <div
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800"
      >
        {message}
      </div>
    );
  }
  if (isEmpty) {
    return <p className="p-4 text-sm text-gray-500">{emptyText}</p>;
  }
  return <>{children}</>;
}
