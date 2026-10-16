import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/requests", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../api/requests")>();
  return {
    ...mod,
    listRequests: vi.fn(),
    getRequest: vi.fn(),
    getRequestHistory: vi.fn(),
    listRequestTypes: vi.fn(),
    listMyAllocations: vi.fn(),
    createRequest: vi.fn(),
    updateRequest: vi.fn(),
    deleteRequest: vi.fn(),
    bulkDeleteRequests: vi.fn(),
    submitRequest: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
    returnRequest: vi.fn(),
    createRequestType: vi.fn(),
    updateRequestType: vi.fn(),
  };
});
vi.mock("../auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      email: "emp@acme.test",
      roles: [],
      display_name: "Emmie",
      org_working_weekdays: [0, 1, 2, 3, 4],
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

import {
  approveRequest,
  bulkDeleteRequests,
  createRequest,
  deleteRequest,
  getRequest,
  getRequestHistory,
  listMyAllocations,
  listRequests,
  listRequestTypes,
  submitRequest,
} from "../../api/requests";
import { RequestDetailPage } from "./RequestDetailPage";
import { RequestFormPage } from "./RequestFormPage";
import { RequestsPage } from "./RequestsPage";

const LEAVE_TYPE = {
  id: "t1",
  code: "annual_leave",
  name: "Annual leave",
  unit: "unit" as const,
  help_text: "",
  requires_hr: false,
  is_active: true,
};

const HOUR_TYPE = {
  id: "t2",
  code: "early_leave",
  name: "Early leave",
  unit: "hour" as const,
  help_text: "",
  requires_hr: true,
  is_active: true,
};

const DRAFT = {
  id: "r1",
  employee: "p1",
  employee_name: "Emmie",
  employee_email: "emp@acme.test",
  employee_code: "E1",
  type: "t1",
  type_name: "Annual leave",
  type_unit: "unit" as const,
  title: "Summer leave",
  description: "Two weeks off",
  start_date: "2026-07-01",
  end_date: "2026-07-14",
  start_time: null,
  end_time: null,
  equipment_item: "",
  quantity: 10,
  hours: null,
  status: "draft" as const,
  cycle: 0,
  version: 1,
  submitted_at: null,
  current_step: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PENDING_REVIEW = {
  ...DRAFT,
  id: "r2",
  status: "pending_manager" as const,
  cycle: 1,
  version: 3,
  submitted_at: "2026-01-02T00:00:00Z",
  current_step: {
    cycle: 1,
    sequence: 1,
    required_role: "manager" as const,
    reviewer: "m1",
    reviewer_name: "Manny",
    reviewer_email: "emp@acme.test",
    status: "pending" as const,
    reason: "",
    decided_at: null,
  },
};

function wrap(element: React.ReactElement, path = "/", route = "*") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RequestsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders request rows with status badges and filters", async () => {
    vi.mocked(listRequests).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [DRAFT],
    });
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [LEAVE_TYPE],
    });
    wrap(<RequestsPage />, "/requests", "/requests");
    expect(await screen.findByText("Summer leave")).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Draft" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/search requests/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^status$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^type$/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new request/i })).toBeInTheDocument();
  });

  it("lets only draft rows be selected for bulk delete", async () => {
    vi.mocked(listRequests).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [DRAFT, PENDING_REVIEW],
    });
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 0, next: null, previous: null, results: [],
    });
    wrap(<RequestsPage />, "/requests", "/requests");
    await screen.findAllByText("Summer leave");

    const boxes = screen.getAllByRole("checkbox", { name: /select request/i });
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBeEnabled(); // draft row
    expect(boxes[1]).toBeDisabled(); // submitted row — not deletable

    // The non-draft row exposes a per-row delete action only on drafts.
    expect(screen.getAllByRole("button", { name: /delete draft/i })).toHaveLength(1);
  });

  it("bulk-deletes selected drafts after confirmation", async () => {
    vi.mocked(listRequests).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [DRAFT, PENDING_REVIEW],
    });
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 0, next: null, previous: null, results: [],
    });
    vi.mocked(bulkDeleteRequests).mockResolvedValue({ deleted: 1, skipped: [] });
    wrap(<RequestsPage />, "/requests", "/requests");
    await screen.findAllByText("Summer leave");

    fireEvent.click(
      screen.getAllByRole("checkbox", { name: /select request/i })[0],
    );
    expect(await screen.findByText("1 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete selected/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^delete$/i }),
    );
    await waitFor(() =>
      expect(bulkDeleteRequests).toHaveBeenCalledWith(
        ["r1"],
        expect.anything(),
      ),
    );
    expect(await screen.findByText("Deleted 1 drafts.")).toBeInTheDocument();
  });

  it("deletes a single draft from its row action", async () => {
    vi.mocked(listRequests).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [DRAFT],
    });
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 0, next: null, previous: null, results: [],
    });
    vi.mocked(deleteRequest).mockResolvedValue(undefined);
    wrap(<RequestsPage />, "/requests", "/requests");
    await screen.findByText("Summer leave");

    fireEvent.click(screen.getByRole("button", { name: /delete draft/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^delete$/i }),
    );
    await waitFor(() =>
      expect(deleteRequest).toHaveBeenCalledWith("r1", expect.anything()),
    );
  });
});

describe("RequestFormPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the amount input matching the type's unit", async () => {
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [LEAVE_TYPE, HOUR_TYPE],
    });
    wrap(<RequestFormPage />, "/requests/new", "/requests/new");
    const typeSelect = await screen.findByLabelText(/request type/i);
    fireEvent.change(typeSelect, { target: { value: "t1" } });
    expect(await screen.findByLabelText(/quantity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    fireEvent.change(typeSelect, { target: { value: "t2" } });
    expect(await screen.findByLabelText(/^hours$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^date$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
  });

  it("creates a draft with typed fields", async () => {
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [LEAVE_TYPE],
    });
    vi.mocked(createRequest).mockResolvedValue(DRAFT);
    wrap(<RequestFormPage />, "/requests/new", "/requests/new");
    fireEvent.change(await screen.findByLabelText(/request type/i), {
      target: { value: "t1" },
    });
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Summer leave" },
    });
    fireEvent.change(screen.getByLabelText(/details/i), {
      target: { value: "Two weeks" },
    });
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: "2026-07-14" },
    });
    // Jul 1–14 2026 spans 10 Mon–Fri working days — quantity is derived, not typed.
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "t1",
          title: "Summer leave",
          start_date: "2026-07-01",
          end_date: "2026-07-14",
          quantity: 10,
        }),
      ),
    );
  });

  it("derives a read-only quantity from the leave date range", async () => {
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [LEAVE_TYPE],
    });
    wrap(<RequestFormPage />, "/requests/new", "/requests/new");
    fireEvent.change(await screen.findByLabelText(/request type/i), {
      target: { value: "t1" },
    });
    const quantity = await screen.findByLabelText(/quantity/i);
    // Non-item unit types are read-only even before dates are picked.
    expect(quantity).toHaveAttribute("readonly");
    expect(quantity).toHaveValue(null);
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: "2026-07-14" },
    });
    await waitFor(() => expect(quantity).toHaveValue(10));
    expect(quantity).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: "2026-07-03" },
    });
    await waitFor(() => expect(quantity).toHaveValue(3));
  });

  it("shows the available balance for allocation-required types", async () => {
    const allocatedLeave = { ...LEAVE_TYPE, id: "t3", requires_allocation: true };
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [LEAVE_TYPE, allocatedLeave],
    });
    vi.mocked(listMyAllocations).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "g1",
          employee: "p1",
          employee_name: "Emmie",
          request_type: "t3",
          type_name: "Annual leave",
          unit: "unit",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          initial_amount: 10,
          status: "active",
          version: 1,
          granted: 10,
          reserved: 0,
          used: 2,
          remaining: 8,
          created_at: "2026-01-01T00:00:00Z",
          voided_at: null,
        },
      ],
    });
    wrap(<RequestFormPage />, "/requests/new", "/requests/new");
    const typeSelect = await screen.findByLabelText(/request type/i);
    expect(screen.queryByText(/available balance/i)).not.toBeInTheDocument();
    fireEvent.change(typeSelect, { target: { value: "t3" } });
    expect(
      await screen.findByText(/available balance: 8 units/i),
    ).toBeInTheDocument();
    // Switching to a non-allocation type hides the balance again.
    fireEvent.change(typeSelect, { target: { value: "t1" } });
    await waitFor(() =>
      expect(screen.queryByText(/available balance/i)).not.toBeInTheDocument(),
    );
  });

  it("keeps the quantity editable for item (equipment) types", async () => {
    const countedItem = { ...LEAVE_TYPE, id: "t4", requires_item: true };
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [countedItem],
    });
    wrap(<RequestFormPage />, "/requests/new", "/requests/new");
    fireEvent.change(await screen.findByLabelText(/request type/i), {
      target: { value: "t4" },
    });
    const quantity = await screen.findByLabelText(/quantity/i);
    expect(quantity).not.toHaveAttribute("readonly");
    expect(
      screen.queryByText(/counted automatically/i),
    ).not.toBeInTheDocument();
  });

  it("shows required date fields for requires_dates types", async () => {
    const wfh = {
      ...LEAVE_TYPE,
      id: "t5",
      unit: "none" as const,
      requires_dates: true,
    };
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [wfh],
    });
    wrap(<RequestFormPage />, "/requests/new", "/requests/new");
    fireEvent.change(await screen.findByLabelText(/request type/i), {
      target: { value: "t5" },
    });
    // RHF validates `required` on submit, not via the native attribute.
    const start = await screen.findByLabelText(/start date/i);
    const end = screen.getByLabelText(/end date/i);
    expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(
      await screen.findAllByText(/dates are required for this type/i),
    ).not.toHaveLength(0);
    expect(createRequest).not.toHaveBeenCalled();
    // Filling the dates clears the gate and lets the draft save.
    fireEvent.change(start, { target: { value: "2026-10-05" } });
    fireEvent.change(end, { target: { value: "2026-10-09" } });
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Remote week" },
    });
    fireEvent.change(screen.getByLabelText(/details/i), {
      target: { value: "Working from home" },
    });
    vi.mocked(createRequest).mockResolvedValue({ id: "r2" } as never);
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "t5",
          start_date: "2026-10-05",
          end_date: "2026-10-09",
        }),
      ),
    );
  });

  it("derives read-only hours from the from/to times on hour types", async () => {
    vi.mocked(listRequestTypes).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [HOUR_TYPE],
    });
    vi.mocked(createRequest).mockResolvedValue({ id: "r9" } as never);
    wrap(<RequestFormPage />, "/requests/new", "/requests/new");
    fireEvent.change(await screen.findByLabelText(/request type/i), {
      target: { value: "t2" },
    });
    const hours = await screen.findByLabelText(/^hours$/i);
    expect(hours).toHaveAttribute("readonly");
    // 15:00 → 17:00 bills exactly 2 hours; the field is never typed by hand.
    fireEvent.change(screen.getByLabelText(/^from$/i), {
      target: { value: "15:00" },
    });
    fireEvent.change(screen.getByLabelText(/^to$/i), {
      target: { value: "17:00" },
    });
    await waitFor(() => expect(hours).toHaveValue(2));
    // A 20-minute gap bills the 30-minute minimum.
    fireEvent.change(screen.getByLabelText(/^to$/i), {
      target: { value: "15:20" },
    });
    await waitFor(() => expect(hours).toHaveValue(0.5));
    // The submitted body carries the times, not the typed hours.
    fireEvent.change(screen.getByLabelText(/^date$/i), {
      target: { value: "2026-10-05" },
    });
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Doctor visit" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "t2",
          start_time: "15:00",
          end_time: "15:20",
        }),
      ),
    );
    expect(
      vi.mocked(createRequest).mock.calls[0][0],
    ).not.toHaveProperty("hours");
  });
});

describe("RequestDetailPage", () => {
  beforeEach(() => vi.clearAllMocks());

  const renderDetail = (req: import("../../api/requests").EmployeeRequest) => {
    vi.mocked(getRequest).mockResolvedValue(req);
    vi.mocked(getRequestHistory).mockResolvedValue({ events: [], steps: [] });
    return wrap(
      <RequestDetailPage />,
      `/requests/${req.id}`,
      "/requests/:id",
    );
  };

  it("owner of a draft sees edit + submit and can submit", async () => {
    vi.mocked(submitRequest).mockResolvedValue({
      ...DRAFT,
      status: "pending_manager",
    });
    renderDetail(DRAFT);
    expect(
      await screen.findByRole("button", { name: /submit for review/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit draft/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    await waitFor(() =>
      expect(submitRequest).toHaveBeenCalledWith("r1", 1),
    );
  });

  it("reviewer sees decision buttons; reject requires a reason", async () => {
    renderDetail(PENDING_REVIEW);
    expect(
      await screen.findByText(/awaits your decision/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      dialog.querySelector('button:not([type="button"])') ??
        dialog.querySelector("button:last-child")!,
    );
    expect(
      await screen.findByText(/reason is required/i),
    ).toBeInTheDocument();
  });

  it("reviewer can approve after confirmation", async () => {
    vi.mocked(approveRequest).mockResolvedValue({
      ...PENDING_REVIEW,
      status: "approved",
    });
    renderDetail(PENDING_REVIEW);
    fireEvent.click(
      await screen.findByRole("button", { name: /^approve$/i }),
    );
    const dialog = await screen.findByRole("dialog");
    const confirmButton = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "Approve",
    )!;
    fireEvent.click(confirmButton);
    await waitFor(() =>
      expect(approveRequest).toHaveBeenCalledWith("r2", 3),
    );
  });

  it("owner can delete a draft after confirmation", async () => {
    vi.mocked(deleteRequest).mockResolvedValue(undefined);
    renderDetail(DRAFT);
    fireEvent.click(
      await screen.findByRole("button", { name: /delete draft/i }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^delete$/i }),
    );
    await waitFor(() => expect(deleteRequest).toHaveBeenCalledWith("r1"));
  });

  it("hides the delete action on non-draft requests", async () => {
    renderDetail(PENDING_REVIEW);
    await screen.findByText(/awaits your decision/i);
    expect(
      screen.queryByRole("button", { name: /delete draft/i }),
    ).not.toBeInTheDocument();
  });
});
