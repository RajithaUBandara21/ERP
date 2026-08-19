/**
 * Pure hostname parsing — no I/O. Deliberately duplicated in
 * apps/web/src/middleware.ts (see the comment there) rather than imported,
 * because middleware runs on the Edge runtime and must not pull in this
 * package's transitive Node-only dependencies (@erp/database -> postgres).
 */

export function normalizeHost(rawHost: string): string {
  return rawHost.split(":")[0]!.toLowerCase();
}

/**
 * Returns the tenant subdomain label, or undefined for an apex/platform
 * host with no tenant subdomain. Handles the local dev convention of
 * "<slug>.localhost" alongside real "<slug>.platform.example.com" hosts.
 */
export function extractSubdomainLabel(hostname: string): string | undefined {
  if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;

  if (hostname.endsWith(".localhost")) {
    const label = hostname.slice(0, -".localhost".length);
    return label || undefined;
  }

  const labels = hostname.split(".");
  // A bare platform apex (e.g. "platform.example.com") has no tenant subdomain label.
  if (labels.length < 3) return undefined;

  return labels[0];
}
