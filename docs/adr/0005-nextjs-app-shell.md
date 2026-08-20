# ADR-0005: Next.js App Router as Application Shell, with a Thin Request-Hint Layer

- Status: Accepted (amended during Phase 3, Phase 8, and Phase 12 implementation — see Updates below)
- Date: 2026-08-19

## Context

CLAUDE.md §4 mandates Next.js with Server Actions/Route Handlers and a strict domain/application/infrastructure separation, and §12 requires tenant context to always come from a trusted, server-verified source — never from the browser or from an easily-spoofed request field. At the time this ADR was written, Next.js's request-interception layer ("Middleware") ran on an Edge runtime that could not hold a raw Postgres connection.

## Decision

Use the Next.js App Router as the application shell, with an explicit split:

- **The request-hint layer** (`apps/web/src/proxy.ts`): hostname/subdomain/custom-domain inspection only, producing a tenant *hint* header (`x-tenant-host-hint`). No authorization decision; never trusted as the source of truth for tenant identity.
- **Route Handlers / Server Actions**: the only place tenant context is authoritatively resolved and the only place a tenant database connection is opened. All business logic is invoked from here through the application layer — Route Handlers/Server Actions stay thin and delegate immediately into `application/` use cases; they never contain business rules themselves (CLAUDE.md §4, §63).
- React Server/Client Components render UI only; they never embed business logic or authorization decisions (CLAUDE.md §63) — a hidden button is never an authorization control.

A shared `withTenantContext()` helper (`apps/web/src/lib/with-tenant-context.ts`) implements the resolve-tenant → attach-context sequence exactly once, used by every tenant-scoped Route Handler. Once Phase 4 adds sessions, this helper is extended to additionally cross-check the resolved tenant against `session.tenantId` and reject on mismatch — it is not replaced.

## Alternatives Considered

- **Resolve and trust tenant identity in the request-hint layer**: rejected regardless of its runtime — CLAUDE.md §12 forbids trusting anything not derived from authenticated, server-verified context, and (pre-Phase-4) there is no session yet to verify against. Hostname-based resolution is legitimate for *anonymous* pre-auth resolution (see `resolveTenantContext`'s doc comment) but is never treated as an authorization decision.
- **A separate backend framework (Express/Fastify) behind Next.js purely for the API layer**: rejected — adds a second server runtime/deployment unit for no benefit Next.js Route Handlers don't already provide, and complicates the "stay simple, don't overengineer" goal (CLAUDE.md §55).

## Consequences

- Every tenant-scoped endpoint must go through `withTenantContext()` (or an equivalent shared composition) rather than reimplementing tenant resolution — a discipline enforced by code review and, where practical, a lint rule flagging direct database-registry access outside that helper.
- The hint layer stays simple and fast (no I/O), keeping request latency low regardless of which runtime it executes on.
- Establishes the pattern every later phase (auth, authorization, module routes) builds on, rather than each module inventing its own request-handling convention.

## Update (Phase 3 implementation)

Next.js 16 renamed the "Middleware" file convention to "Proxy" (`middleware.ts` → `proxy.ts`, `export function middleware` → `export function proxy`) and changed it to **always run on the Node.js runtime**, not Edge-only (see <https://nextjs.org/docs/messages/middleware-to-proxy>, discovered when `next build` flagged the old convention as deprecated). This removes the original technical constraint motivating the edge/node split described above — `proxy.ts` *could* now hold a Postgres connection directly.

The implementation deliberately keeps `proxy.ts` hint-only anyway, now as an **architectural choice rather than a runtime necessity**: not every route needs tenant context (e.g. future platform-level admin routes), so resolution stays centralized in `withTenantContext()`, called per-route, instead of running unconditionally for every request. The request flow, trust boundary, and `withTenantContext()` contract described above are otherwise unchanged — see [MULTI-TENANCY.md](../../MULTI-TENANCY.md) §2, updated to match.

## Update (Phase 8 implementation — Turbopack and non-JS filesystem assets)

Route Handlers that need a real filesystem path at runtime (not just an import) hit a Turbopack-specific constraint: `modules/identity/src/apply-migrations.ts` and `modules/pos/src/apply-migrations.ts` need the absolute path to their own module's `migrations/` folder (a directory of `.sql` files, not importable JS) to call `runTenantMigrations`. Two natural approaches both failed when actually exercised through a live `next dev` request (not just `next build` or `vitest`, which don't run the same bundler path — a live curl-driven check caught this, matching CLAUDE.md §56's rule against unverified claims):

- `import.meta.dirname` — a Node ESM convenience property — is `undefined` at runtime inside Turbopack's bundled Route Handler output, causing `runTenantMigrations` to fail with `path argument must be of type string. Received undefined`.
- `fileURLToPath(new URL("../migrations", import.meta.url))` — the standard portable ESM pattern — fails differently: Turbopack statically recognizes the two-argument `new URL(relative-literal, import.meta.url)` shape as an asset-bundling directive and tries to resolve `"../migrations"` as an importable module, erroring with "Module not found" since a directory of `.sql` files isn't one.

The working fix resolves `fileURLToPath(import.meta.url)` as a **standalone expression** (not the special two-argument `new URL()` form Turbopack pattern-matches on), then does the `"../migrations"` relative-directory math afterward with plain `path.join` — outside anything the bundler treats specially:

```ts
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(currentDir, "..", "migrations");
```

This is verified against a live `next dev` server (fresh restart, curl through `POST /api/modules/{identity,pos}/install`), not just `next build`/tests. It is still a **dev-mode-only fix**: a `next build` production bundle does not automatically copy non-imported files like `*.sql` into its output directory, so this same code would still fail once actually deployed. That gap is not solved here — it's tracked as a known follow-up (proper migration-asset packaging, e.g. embedding migration SQL as generated TS constants, or excluding `apply-migrations.ts` from the Next.js bundle and invoking it out-of-process) for whichever phase first needs a real production deployment (Phase 19, or sooner if it blocks something earlier).

## Update (Phase 12 implementation — a second app, and the hint header's real trust boundary)

Phase 12 added `apps/pos`, this codebase's second Next.js app (see [ADR-0003](./0003-offline-pos.md)'s Update) — the first time two apps needed to talk to each other. `apps/pos` has no database access of its own; it proxies its API calls to apps/web same-origin via a Next.js rewrite (not CORS — see `apps/pos/next.config.ts`'s doc comment: the session cookie is `SameSite=Lax`, which a genuinely cross-origin fetch would never carry, so CORS-with-credentials wouldn't actually authenticate anything without also loosening the cookie's SameSite policy).

This surfaced a real bug, found via live verification against both apps' running dev servers: `proxy.ts` unconditionally overwrote the `x-tenant-host-hint` header with a value derived from *its own* Host header, on every request. That's correct for a real browser hitting apps/web directly, but wrong for a request arriving via apps/pos's rewrite — the Host header on that internal request is apps/web's own dev-server host, not the tenant's, so it silently clobbered the correct hint `apps/pos`'s client had already set, and every proxied request resolved "no tenant for this host."

Fixed by only setting the hint from Host when the request doesn't already carry one (`proxy.ts`). This is not a weakening of the trust model: MULTI-TENANCY.md §6 already documents this header as non-authoritative, pre-auth-only ("only ever used to pick which login/session cookie scope to present — the authoritative tenant_id still comes from the verified session once authenticated"), and the Host header it's normally derived from is exactly as attacker-controllable in a raw request as this header now is once already present — trusting an already-set hint grants no capability a spoofed Host header didn't already grant for this same narrow, non-authorizing purpose.
