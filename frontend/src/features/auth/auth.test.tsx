import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../api/auth")>();
  return { ...mod, login: vi.fn(), fetchMe: vi.fn() };
});

import { login } from "../../api/auth";
import { LanguageProvider } from "../../app/LanguageProvider";
import { ThemeProvider } from "../../app/ThemeProvider";
import { AuthProvider } from "./AuthProvider";
import { LoginPage } from "./LoginPage";

function renderLogin() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders email and password fields with a submit button", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("signs in directly with the seed password for a chosen demo role", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Use Manager demo account" }));
    expect(login).toHaveBeenCalledWith("manager-e2e@acme.test", "E2ePassw0rd1");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("manager-e2e@acme.test");
  });

  it("shows validation errors on empty submit", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(login).not.toHaveBeenCalled();
  });

  it("shows a generic error on rejected credentials", async () => {
    const { ApiError } = await import("../../api/client");
    vi.mocked(login).mockRejectedValue(
      new ApiError(403, { code: "invalid_credentials", detail: "nope" }),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.test");
    await userEvent.type(screen.getByLabelText(/password/i), "whatever");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /email or password is incorrect/i,
      ),
    );
  });
});
