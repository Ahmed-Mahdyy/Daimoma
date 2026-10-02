/**
 * Typed, credentialed transport for the /api/v1/ contract (contracts/api.md).
 * Same-origin session cookies; unsafe methods send X-CSRFToken.
 * Auth tokens are never stored in localStorage.
 */

export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiErrorBody {
  code: string;
  detail: string;
  field_errors?: Record<string, unknown>;
  request_id?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.field_errors;
    this.requestId = body.request_id;
  }
}

/** The error envelope puts real messages in field_errors when detail is the
 * generic "Validation failed." — surface the first one for inline display. */
export function apiErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  const first = e.fieldErrors ? Object.values(e.fieldErrors).flat()[0] : null;
  return typeof first === "string" ? first : e.message;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrf(): Promise<void> {
  if (!getCookie("csrftoken")) {
    await fetch("/api/v1/auth/csrf/", { credentials: "same-origin" });
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };

  if (method !== "GET") {
    await ensureCsrf();
    const token = getCookie("csrftoken");
    if (token) headers["X-CSRFToken"] = token;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function throwApiError(response: Response): Promise<never> {
  let body: ApiErrorBody = {
    code: "error",
    detail: `Request failed with status ${response.status}`,
  };
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error response (proxy/infra error) — keep generic detail.
  }
  // A dead session must clear cached auth so RequireAuth redirects —
  // otherwise the SPA keeps showing authenticated chrome until reload.
  // Only authentication_required triggers this; permission_denied (403 on
  // an authorized route) must NOT sign the user out.
  if (body.code === "authentication_required" || response.status === 401) {
    window.dispatchEvent(new Event("daimoma:unauthenticated"));
  }
  throw new ApiError(response.status, body);
}

/** Multipart upload — the browser sets the multipart boundary itself, so no
 * Content-Type header is sent. CSRF + auth handling matches apiFetch. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  await ensureCsrf();
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getCookie("csrftoken");
  if (token) headers["X-CSRFToken"] = token;

  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: form,
  });

  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as T;
}
