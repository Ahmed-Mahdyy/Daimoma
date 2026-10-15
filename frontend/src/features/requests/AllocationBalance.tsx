import { useQuery } from "@tanstack/react-query";

import { useLanguage } from "../../app/LanguageProvider";
import {
  ALLOCATION_UNIT_LABELS,
  formatAllocationAmount,
  listMyAllocations,
} from "../../api/requests";

/** Remaining-allowance hint shown under the request-type picker (008): appears
 * the moment an allocation-required type is selected — before any amount or
 * dates — so the employee sees their balance up front. The advisory preview
 * below the form still reports per-period coverage; this is informational. */
export function AllocationBalance({
  typeId,
  requiresAllocation,
}: {
  typeId: string | undefined;
  requiresAllocation: boolean | undefined;
}) {
  const { t } = useLanguage();
  const query = useQuery({
    queryKey: ["my-allocations"],
    queryFn: listMyAllocations,
    enabled: !!typeId && !!requiresAllocation,
  });
  if (!typeId || !requiresAllocation || query.isError) return null;
  if (query.isPending) {
    return (
      <p className="mt-1 text-xs text-gray-500">{t("Checking balance…")}</p>
    );
  }
  const grants = (query.data?.results ?? []).filter(
    (g) => g.request_type === typeId && g.status === "active",
  );
  if (!grants.length) {
    return (
      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
        {t("No allocation assigned for this type.")}
      </p>
    );
  }
  const unit = grants[0].unit;
  const remaining = grants.reduce((sum, g) => sum + g.remaining, 0);
  return (
    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
      {t("Available balance: {remaining} {unit}", {
        remaining: formatAllocationAmount(remaining, unit),
        unit: t(ALLOCATION_UNIT_LABELS[unit]),
      })}
    </p>
  );
}
