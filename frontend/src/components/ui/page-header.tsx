import type { ReactNode } from "react";

/** Shared page header row — eyebrow + title + description with optional
 * action controls on the end side. Renders inside a card: pass it to
 * FilterBar's `header` slot on list pages, or wrap it in a
 * `workspace-panel` on pages without filters. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && (
          <span className="text-xs font-bold uppercase tracking-widest text-brand-700">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Standalone carded page header for pages that have no FilterBar. */
export function PageHeaderCard(props: Parameters<typeof PageHeader>[0]) {
  return (
    <div className="workspace-panel mb-5 p-4 sm:p-5">
      <PageHeader {...props} />
    </div>
  );
}
