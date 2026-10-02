import { type SortingState } from "@tanstack/react-table";

/** Maps a TanStack SortingState to the API `ordering` value ("-field" for
 * descending, "" to clear). Column ids must match allowlisted fields. */
export function sortingToOrdering(sorting: SortingState): string {
  const s = sorting[0];
  return s ? (s.desc ? `-${s.id}` : s.id) : "";
}

/** Maps an API `ordering` value back to SortingState for controlled
 * (manualSorting) tables; unrecognized values yield no indicator. */
export function orderingToSorting(ordering: string): SortingState {
  if (!ordering) return [];
  return ordering.startsWith("-")
    ? [{ id: ordering.slice(1), desc: true }]
    : [{ id: ordering, desc: false }];
}

/** Resolves a TanStack OnChangeFn updater against current sorting — use in
 * manualSorting pages: `setParam("ordering", sortingToOrdering(next))`. */
export function applySortingUpdater(
  updater: SortingState | ((old: SortingState) => SortingState),
  current: SortingState,
): SortingState {
  return typeof updater === "function" ? updater(current) : updater;
}
