interface AlertProps {
  kind?: "error" | "success" | "info" | "warning";
  children: React.ReactNode;
}

/** Accessible status/error banner, themed for light and dark modes.
 * `role=alert` announces errors to AT; non-errors use `role=status`. */
export function Alert({ kind = "info", children }: AlertProps) {
  const styles = {
    error:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200",
    success:
      "border-green-300 bg-green-50 text-green-800 dark:border-green-800/60 dark:bg-green-950/50 dark:text-green-200",
    warning:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
    info:
      "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-600/50 dark:bg-brand-900/30 dark:text-brand-200",
  }[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}
