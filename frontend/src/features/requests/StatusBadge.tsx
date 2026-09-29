import type { RequestStatus, StepStatus } from "../../api/requests";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  pending_manager: { label: "Pending manager", className: "bg-amber-100 text-amber-800" },
  pending_hr: { label: "Pending HR", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  returned: { label: "Returned", className: "bg-blue-100 text-blue-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  waiting: { label: "Waiting", className: "bg-gray-100 text-gray-500" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
};

export function StatusBadge({ status }: { status: RequestStatus | StepStatus }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
