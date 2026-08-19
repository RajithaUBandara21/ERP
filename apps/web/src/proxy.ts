import { normalizeHost } from "@erp/tenant";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on the Node.js runtime (Next.js 16's "proxy" convention — the
 * renamed, no-longer-Edge-only successor to "middleware"; see
 * https://nextjs.org/docs/messages/middleware-to-proxy). It still does
 * hostname inspection ONLY, by architectural choice rather than a runtime
 * constraint now: not every route needs tenant context (e.g. future
 * platform-level admin routes), so resolution stays centralized in
 * withTenantContext (called per-route) instead of running unconditionally
 * here for every request. Never trusted as the source of truth for tenant
 * identity — see MULTI-TENANCY.md §2 and ADR-0005.
 */

export const TENANT_HOST_HINT_HEADER = "x-tenant-host-hint";

export function proxy(request: NextRequest): NextResponse {
  const hostname = normalizeHost(request.headers.get("host") ?? "");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TENANT_HOST_HINT_HEADER, hostname);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
