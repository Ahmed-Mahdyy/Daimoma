interface PaginationControlsProps {
  count: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}

export function PaginationControls({
  count,
  page,
  pageSize,
  onPage,
}: PaginationControlsProps) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-2 p-2 text-sm"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-md border px-3 py-1 disabled:opacity-40"
      >
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="rounded-md border px-3 py-1 disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
