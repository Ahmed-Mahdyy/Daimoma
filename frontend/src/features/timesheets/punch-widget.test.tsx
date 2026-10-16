import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/timesheets", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../api/timesheets")>();
  return {
    ...mod,
    getPunchStatus: vi.fn(),
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    cancelCheckIn: vi.fn(),
  };
});
vi.mock("../auth/auth-context", () => {
  const auth = {
    user: {
      id: "u-1",
      email: "emp@acme.test",
      employee_code: "E1",
      roles: [] as string[],
      display_name: "Emmie",
    },
    isLoading: false,
    isAuthenticated: true,
  };
  return { useAuth: () => auth, useOptionalAuth: () => auth.user };
});

import { cancelCheckIn, checkIn, getPunchStatus } from "../../api/timesheets";
import { LanguageProvider } from "../../app/LanguageProvider";
import { PunchWidget } from "./PunchWidget";

function renderWidget() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <PunchWidget />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("PunchWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPunchStatus).mockResolvedValue({
      open: true,
      started_at: new Date(Date.now() - 65_000).toISOString(),
    });
    vi.mocked(checkIn).mockResolvedValue({ started_at: new Date().toISOString() });
    vi.mocked(cancelCheckIn).mockResolvedValue(undefined);
  });

  it("asks for confirmation before discarding an open check-in", async () => {
    renderWidget();
    const cancel = await screen.findByRole("button", { name: "Cancel check-in" });
    await userEvent.click(cancel);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/discard this check-in/i);
    expect(cancelCheckIn).not.toHaveBeenCalled();

    // Dismissing keeps the punch open without calling the API.
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(cancelCheckIn).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Check out" }),
    ).toBeInTheDocument();

    // Confirming discards the punch.
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel check-in" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Discard check-in",
      }),
    );
    await waitFor(() => expect(cancelCheckIn).toHaveBeenCalledTimes(1));
  });

  it("checks in straight away when no punch is open", async () => {
    vi.mocked(getPunchStatus).mockResolvedValue({ open: false, started_at: null });
    renderWidget();
    await userEvent.click(
      await screen.findByRole("button", { name: /check in/i }),
    );
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});