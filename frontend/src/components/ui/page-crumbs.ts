import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";

export type PageCrumb = { label: ReactNode; to?: string };

/** The shell's topbar owns breadcrumb rendering on md+ screens; pages register
 * their trail here and unmount cleans it up. Below md the page keeps an
 * inline copy (PageCrumbs) since the topbar space is needed for the menu. */
export const PageCrumbsContext = createContext<{
  crumbs: PageCrumb[];
  set: (crumbs: PageCrumb[]) => void;
} | null>(null);

/** Crumbs registered by the current page — consumed by the topbar. */
export function useRegisteredPageCrumbs() {
  return useContext(PageCrumbsContext)?.crumbs ?? [];
}

/** Pages call this to describe their trail; the serialized form keys the
 * effect so inline array literals don't loop. */
export function usePageCrumbs(crumbs: PageCrumb[]) {
  const ctx = useContext(PageCrumbsContext);
  const key = JSON.stringify(
    crumbs.map((c) => [String(c.label ?? ""), c.to ?? ""]),
  );
  useEffect(() => {
    ctx?.set(crumbs);
    return () => ctx?.set([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is the serialized crumbs
  }, [ctx, key]);
}
