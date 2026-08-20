import type { NextConfig } from "next";

/**
 * apps/pos is a pure client of apps/web's API — it has no database access
 * and no server-side business logic of its own (ARCHITECTURE.md §4: the
 * offline queue calls the same pos module application-layer use cases as
 * an online request, through the same HTTP API, not a parallel code path).
 *
 * Session cookies are httpOnly and scoped by origin (see
 * apps/web/src/lib/session-cookie.ts) — for them to work from a
 * browser-side fetch, the browser must only ever talk to ONE origin.
 * Rather than CORS (a real but more complex option — credentialed
 * cross-origin requests, preflight handling, cookie SameSite
 * implications), this app proxies /api/* to apps/web's origin via a
 * same-origin rewrite: the browser only ever sees apps/pos's own origin,
 * and Next.js forwards the request (and the Set-Cookie response header)
 * transparently. In production this same effect would typically come from
 * a reverse proxy/gateway routing both apps under one domain
 * (path-based), not this rewrite — see DEPLOYMENT.md.
 */
const webApiOrigin = process.env.WEB_API_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@erp/validation"],
  agentRules: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${webApiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
