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

/**
 * Phase 12 discovery: only sets the hint if the request doesn't already
 * carry one. apps/pos proxies its API calls to apps/web via a same-origin
 * Next.js rewrite (see apps/pos/next.config.ts) — the Host header on the
 * resulting internal request is apps/web's own dev-server host, not the
 * tenant's, so apps/pos's client explicitly sets this header itself with
 * the real tenant host it already knows (captured at terminal setup).
 * Unconditionally overwriting it (the original behavior) silently broke
 * that: every proxied request resolved "no tenant for this host" even
 * though the client had supplied the right one.
 *
 * This is not a trust-model change: MULTI-TENANCY.md §6 already documents
 * this hint as non-authoritative pre-auth-only signal ("only ever used to
 * pick which login/session cookie scope to present — the authoritative
 * tenant_id still comes from the verified session once authenticated"),
 * and the Host header it's normally derived from is exactly as
 * client-controllable in a raw request as this header now is when
 * already present — trusting an already-set hint grants a client no
 * capability it didn't already have via a spoofed Host header.
 */
export function proxy(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  if (!requestHeaders.has(TENANT_HOST_HINT_HEADER)) {
    const hostname = normalizeHost(request.headers.get("host") ?? "");
    requestHeaders.set(TENANT_HOST_HINT_HEADER, hostname);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
