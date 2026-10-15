import type { InputHTMLAttributes } from "react";

const WRAPPER: Record<string, string> = {
  form: "mt-1 flex items-center rounded-md border border-gray-300 bg-white px-2 dark:border-[#587679] dark:bg-[#294649] focus-within:ring-1 focus-within:ring-brand-700/40",
  filter:
    "flex h-10 w-full items-center rounded-xl border bg-background/60 px-3 text-sm shadow-sm transition-colors hover:border-brand-700/40 focus-within:border-brand-700 focus-within:ring-2 focus-within:ring-brand-700/25",
};

/** Two same-line inputs rendered as one bordered control — the usual
 * "from → to" pair for date or time ranges. Each input keeps its own
 * aria-label so forms stay accessible and queryable by the same names. */
export function RangeInput({
  type = "date",
  from,
  to,
  fromLabel,
  toLabel,
  invalid,
  variant = "form",
}: {
  type?: "date" | "time" | "datetime-local";
  from: InputHTMLAttributes<HTMLInputElement>;
  to: InputHTMLAttributes<HTMLInputElement>;
  fromLabel: string;
  toLabel: string;
  invalid?: boolean;
  variant?: "form" | "filter";
}) {
  const inputClass =
    "min-w-0 w-full border-0 bg-transparent text-sm focus:outline-none dark:text-[#f1faf6] " +
    (variant === "filter" ? "h-full" : "py-1.5");
  return (
    <div
      className={`${WRAPPER[variant]} ${invalid ? "border-red-400" : ""}`}
    >
      <input
        type={type}
        aria-label={fromLabel}
        aria-invalid={invalid}
        className={inputClass}
        {...from}
      />
      <span
        aria-hidden="true"
        className="mx-1 inline-block shrink-0 text-gray-400 rtl:-scale-x-100"
      >
        →
      </span>
      <input
        type={type}
        aria-label={toLabel}
        aria-invalid={invalid}
        className={inputClass}
        {...to}
      />
    </div>
  );
}

/** Same range control specialized for same-day HH:MM pairs. */
export function TimeRangeInput(
  props: Omit<Parameters<typeof RangeInput>[0], "type">,
) {
  return <RangeInput type="time" {...props} />;
}
