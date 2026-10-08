import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Children, useId, useState, type ReactNode } from "react";

import { useLanguage } from "../../app/LanguageProvider";

const labelClass =
  "mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground";
const controlClass =
  "h-10 w-full rounded-xl border bg-background/60 text-sm shadow-sm transition-colors hover:border-brand-700/40 focus-visible:border-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/25";

/** "Filters" toggle — shows the count of active filters and reveals the
 * collapsed filter controls. Used at every breakpoint. */
export function FiltersToggle({
  open,
  activeFilters = 0,
  onToggle,
  className,
}: {
  open: boolean;
  activeFilters?: number;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={`inline-flex h-10 items-center gap-2 rounded-xl border bg-background/60 px-3.5 text-sm font-semibold shadow-sm transition-colors hover:border-brand-700/40 ${className ?? ""}`}
    >
      <SlidersHorizontal className="size-4" aria-hidden="true" />
      {t("Filters")}
      {activeFilters > 0 && (
        <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-white">
          {activeFilters}
        </span>
      )}
      <ChevronDown
        className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
}

/** Shared list-toolbar: pill-panel containing a search field and labeled
 * selects. Keeps every list page's filters visually consistent.
 * `children` collapse behind a "Filters" toggle at every breakpoint while
 * `search` stays visible. */
export function FilterBar({
  children,
  search,
  activeFilters = 0,
  header,
}: {
  children?: ReactNode;
  /** Always-visible control, typically a <SearchField>. */
  search?: ReactNode;
  /** Non-default filter count — badge on the toggle; the panel starts
   * open when filters arrive preset (e.g. via URL params). */
  activeFilters?: number;
  /** Optional <PageHeader> rendered inside the same panel above the
   * filter row, so the page title shares the carded surface. */
  header?: ReactNode;
}) {
  const [open, setOpen] = useState(activeFilters > 0);
  const hasFilters = Children.count(children) > 0;
  return (
    <div className="workspace-panel mb-5 p-4">
      {header && <div className="mb-4">{header}</div>}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {search}
        {hasFilters && (
          <FiltersToggle
            open={open}
            activeFilters={activeFilters}
            onToggle={() => setOpen((v) => !v)}
          />
        )}
        <div
          className={`${
            open ? "flex" : "hidden"
          } w-full flex-wrap items-end gap-x-4 gap-y-3 max-md:[&>*]:w-full`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SearchField({
  label,
  ariaLabel,
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  label?: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  /** Called with the value to apply — "" when the field is cleared, so the
   * caller never reads stale input state. */
  onSearch: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useLanguage();
  const id = useId();
  const clear = () => {
    onChange("");
    onSearch("");
  };
  return (
    <form
      className="min-w-52 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value);
      }}
    >
      <label htmlFor={id} className={labelClass}>
        {label ?? t("Search")}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`${controlClass} pe-9 ps-10`}
        />
        {value && (
          <button
            type="button"
            aria-label={t("Clear search")}
            onClick={clear}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}

/** Labeled free-form input (dates, etc.) matching the filter controls. */
export function FilterInput({
  label,
  className,
  ...props
}: { label: string } & React.ComponentProps<"input">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} className={`${controlClass} px-3.5 ${className ?? ""}`} {...props} />
    </div>
  );
}

export function FilterSelect({
  label,
  ariaLabel,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className ?? "min-w-40"}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-label={ariaLabel ?? label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlClass} appearance-none pe-9 ps-3.5`}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}
