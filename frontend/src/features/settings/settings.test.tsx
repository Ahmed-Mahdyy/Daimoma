import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/organization", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../api/organization")>();
  return {
    ...mod,
    getOrgSettings: vi.fn(),
    updateOrgSettings: vi.fn(),
    testOrgEmail: vi.fn(),
  };
});
vi.mock("../../api/employees", () => ({
  managerChoices: vi.fn().mockResolvedValue({ results: [], count: 0 }),
}));

import { getOrgSettings, testOrgEmail } from "../../api/organization";
import { OrgSettingsPage } from "./OrgSettingsPage";

const SETTINGS = {
  id: "o1",
  name: "Acme",
  timezone: "UTC",
  week_start: 0,
  working_weekdays: [],
  fallback_reviewer: null,
  email_mode: "env" as const,
  email_host: "",
  email_port: 587,
  email_host_user: "",
  email_password_set: false,
  email_use_tls: false,
  email_use_ssl: false,
  email_timeout: 30,
  email_from: "",
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OrgSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OrgSettingsPage email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrgSettings).mockResolvedValue(SETTINGS);
  });

  it("hides SMTP fields under environment mode and reveals them for custom SMTP", async () => {
    renderPage();
    await screen.findByText("Email delivery");
    expect(screen.queryByLabelText(/Mail server host/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText("Sending method"),
      "smtp",
    );
    expect(screen.getByLabelText("Mail server host")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Test connection" }),
    ).toBeInTheDocument();
  });

  it("tests the connection with current form values", async () => {
    vi.mocked(getOrgSettings).mockResolvedValue({
      ...SETTINGS,
      email_mode: "smtp" as const,
      email_host: "smtp.saved.test",
      email_password_set: true,
    });
    vi.mocked(testOrgEmail).mockResolvedValue({
      detail: "Connection verified — test email sent to your address.",
    });
    renderPage();
    await screen.findByText("Email delivery");

    const host = screen.getByLabelText("Mail server host");
    await userEvent.clear(host);
    await userEvent.type(host, "smtp.edited.test");
    await userEvent.click(
      screen.getByRole("button", { name: "Test connection" }),
    );
    await waitFor(() => expect(testOrgEmail).toHaveBeenCalled());
    expect(vi.mocked(testOrgEmail).mock.calls[0][0]).toMatchObject({
      email_host: "smtp.edited.test",
      email_host_password: "",
    });
    expect(
      await screen.findByText(/Connection verified/),
    ).toBeInTheDocument();
  });
});
