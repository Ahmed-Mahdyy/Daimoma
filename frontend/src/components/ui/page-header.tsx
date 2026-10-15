import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";
import {
  PageCrumbsContext,
  usePageCrumbs,
  type PageCrumb,
} from "./page-crumbs";

export type { PageCrumb } from "./page-crumbs";

export function PageCrumbsProvider({ children }: { children: ReactNode }) {
  const [crumbs, set] = useState<PageCrumb[]>([]);
  const value = useMemo(() => ({ crumbs, set }), [crumbs]);
  return (
    <PageCrumbsContext.Provider value={value}>
      {children}
    </PageCrumbsContext.Provider>
  );
}

/** Breadcrumb row for page headers — links resolve through the router and
 * the last crumb (or any crumb without `to`) renders as the current page. */
export function PageBreadcrumbs({ crumbs }: { crumbs: PageCrumb[] }) {
  return (
    <Breadcrumb className="text-xs font-bold uppercase tracking-widest">
      <BreadcrumbList className="gap-1 text-xs">
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.to && i < crumbs.length - 1 ? (
                <BreadcrumbLink
                  asChild
                  className="text-brand-700 hover:text-brand-800 hover:underline"
                >
                  <Link to={crumb.to}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-slate-500">
                  {crumb.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Publishes the trail to the topbar (md+) and renders an inline copy on
 * small screens. Use instead of PageBreadcrumbs anywhere a page shows its
 * breadcrumb. */
export function PageCrumbs({
  crumbs,
  className,
}: {
  crumbs: PageCrumb[];
  className?: string;
}) {
  usePageCrumbs(crumbs);
  return (
    <div className={`md:hidden ${className ?? ""}`}>
      <PageBreadcrumbs crumbs={crumbs} />
    </div>
  );
}

/** Shared page header row — breadcrumb + title + description with optional
 * action controls on the end side. Renders inside a card: pass it to
 * FilterBar's `header` slot on list pages, or wrap it in a
 * `workspace-panel` on pages without filters. Crumbs without `to` render as
 * the current page (aria-current), linked ones use client-side routing. */
export function PageHeader({
  crumbs,
  title,
  description,
  actions,
}: {
  crumbs?: PageCrumb[];
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && <PageCrumbs crumbs={crumbs} />}
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
