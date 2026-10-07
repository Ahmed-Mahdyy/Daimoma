import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    createRequest: vi.fn(),
    updateRequest: vi.fn(),
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
    user: { email: "emp@acme.test", roles: [], display_name: "Emmie" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

import {
  approveRequest,
  createRequest,
  getRequest,
  getRequestHistory,
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
    fireEvent.change(screen.getByLabelText(/quantity/i), {
      target: { value: "10" },
    });
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
});
