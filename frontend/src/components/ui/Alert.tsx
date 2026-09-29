interface AlertProps {
  kind?: "error" | "success" | "info";
  children: React.ReactNode;
}

/** Accessible status/error banner. `role=alert` announces errors to AT. */
export function Alert({ kind = "info", children }: AlertProps) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-800",
    success: "border-green-300 bg-green-50 text-green-800",
    info: "border-brand-300 bg-brand-50 text-brand-800",
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
