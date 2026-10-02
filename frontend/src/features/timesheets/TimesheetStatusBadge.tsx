import type { TimesheetStatus, WorkDayStatus } from "../../api/timesheets";

const SHEET_STYLES: Record<TimesheetStatus, string> = {
  collecting: "bg-gray-100 text-gray-700",
  pending_manager: "bg-brand-50 text-brand-800",
  pending_hr: "bg-brand-50 text-brand-800",
  approved: "bg-green-100 text-green-800",
  returned: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
};

const SHEET_LABELS: Record<TimesheetStatus, string> = {
  collecting: "Collecting",
  pending_manager: "Pending manager",
  pending_hr: "Pending HR",
  approved: "Approved",
  returned: "Returned",
  rejected: "Rejected",
};

const DAY_STYLES: Record<WorkDayStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-brand-50 text-brand-800",
  returned: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
};

const DAY_LABELS: Record<WorkDayStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  returned: "Returned",
  approved: "Approved",
};

export function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SHEET_STYLES[status]}`}
    >
      {SHEET_LABELS[status]}
    </span>
  );
}

export function DayStatusBadge({ status }: { status: WorkDayStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DAY_STYLES[status]}`}
    >
      {DAY_LABELS[status]}
    </span>
  );
}
