/**
 * Thin fetch wrapper around apps/web's API, proxied same-origin via
 * next.config.ts's rewrite (see that file's doc comment). Every call
 * attaches `x-tenant-host-hint` — the same header used throughout this
 * codebase's own integration tests and manual verification — since
 * apps/pos has no hostname-based tenant routing of its own; the session
 * cookie (once established) is what actually authorizes each request.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown for genuine network failures (offline, DNS, connection refused) — distinct from a server-returned error response. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Network request failed");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

async function request<T>(tenantHost: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { ...init?.headers, "x-tenant-host-hint": tenantHost, "content-type": "application/json" },
    });
  } catch (error) {
    throw new NetworkError(error);
  }

  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(response.status, body?.code ?? "UNKNOWN_ERROR", body?.message ?? `Request failed with status ${response.status}`);
  }
  return body as T;
}

export interface LoginResult {
  id: string;
  email: string;
  name: string;
}

export function login(tenantHost: string, email: string, password: string): Promise<LoginResult> {
  return request<LoginResult>(tenantHost, "/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export interface TerminalResult {
  id: string;
  name: string;
}

export function registerTerminal(tenantHost: string, name: string): Promise<TerminalResult> {
  return request<TerminalResult>(tenantHost, "/api/pos/terminals", { method: "POST", body: JSON.stringify({ name }) });
}

export interface CartResult {
  id: string;
}

export function createCart(tenantHost: string, terminalId: string): Promise<CartResult> {
  return request<CartResult>(tenantHost, "/api/pos/carts", { method: "POST", body: JSON.stringify({ terminalId }) });
}

export function addCartLine(
  tenantHost: string,
  cartId: string,
  line: { sku: string; name: string; quantity: number; unitPriceCents: number },
): Promise<unknown> {
  return request(tenantHost, `/api/pos/carts/${cartId}/lines`, { method: "POST", body: JSON.stringify(line) });
}

export interface CheckoutResult {
  id: string;
  status: string;
  totalCents: number;
}

export function checkout(
  tenantHost: string,
  cartId: string,
  input: { idempotencyKey: string; paymentMethod: string; paymentMethodToken?: string; taxCents?: number },
): Promise<CheckoutResult> {
  return request<CheckoutResult>(tenantHost, `/api/pos/carts/${cartId}/checkout`, { method: "POST", body: JSON.stringify(input) });
}
