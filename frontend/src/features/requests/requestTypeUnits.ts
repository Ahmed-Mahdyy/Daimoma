import type { AllocationUnit } from "../../api/requests";

/** Allocation-unit options for the HR type create/edit forms. A measurable
 * unit makes the type draw from allocations; "none" collects no amount. */
export const UNIT_OPTIONS: { value: AllocationUnit; label: string }[] = [
  { value: "none", label: "Not measurable" },
  { value: "unit", label: "Units" },
  { value: "hour", label: "Hours" },
];

export const UNIT_LABELS: Record<AllocationUnit, string> = {
  none: "Not measurable",
  unit: "Units",
  hour: "Hours",
};
