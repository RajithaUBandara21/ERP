# ADR-0006: Authentication & Session Architecture

- Status: Accepted (amended during Phase 4 implementation — see Update below)
- Date: 2026-08-19

## Context

CLAUDE.md §4 requires "secure session/token architecture, never insecure homemade authentication," but also mandates database-per-tenant (ADR-0002), meaning application users live inside per-tenant databases, with a separate `platform_users` table for platform-operator accounts in the control plane. Most auth frameworks (NextAuth/Auth.js, Clerk, etc.) assume a single shared `users` table reachable from one database connection. POS terminals also need an offline-capable token type distinct from web sessions (§17–19, [OFFLINE-POS.md](../../OFFLINE-POS.md)).

## Decision

Build a custom session/token layer on top of audited, maintained cryptographic primitives rather than a full auth framework:

- `jose` — JWT signing/verification, JWKS handling.
- `@node-rs/argon2` — Argon2id password hashing.
- `@oslojs/*` (`oslojs/crypto`, `oslojs/encoding`, etc.) — secure random generation, session ID generation, CSRF token utilities.

Two session/token types:

- **Web sessions**: opaque, DB-backed session IDs stored in the **control plane** (so a session resolves before any tenant database connection is selected — required by [MULTI-TENANCY.md](../../MULTI-TENANCY.md) §2), delivered via an httpOnly/Secure/SameSite cookie, instantly revocable (admin force-logout, incident response), regenerated on privilege change to prevent session fixation.
- **POS/offline tokens**: short-lived JWT access token + rotating long-lived refresh token (`jose`), carrying `tenantId`/`terminalId`/`branchId` claims, letting the offline client validate token shape/expiry without a network round trip while the server re-verifies authorization on every sync.

## Alternatives Considered

- **NextAuth/Auth.js**: rejected — its adapter model assumes one queryable users table; forcing it to route to a dynamically-selected per-tenant database per request fights the framework rather than being helped by it, and its session/JWT primitives don't map cleanly onto the separate offline-token requirement.
- **Lucia**: considered — closest fit conceptually (thin session-management library). Rejected because Lucia was deprecated by its own maintainer in 2024, with the explicit recommendation to compose the underlying primitives directly (the `oslojs` packages) — which is exactly this decision. Building on `oslojs` directly avoids depending on an unmaintained library while following the currently-recommended pattern from the same source.
- **Hosted IdP (Clerk, WorkOS, Auth0)**: rejected — per-active-user pricing at up to 2,000 users/tenant × 1,000 tenants is a significant, avoidable cost driver; and none of these map naturally onto dynamic per-tenant database routing or the POS offline-token requirement without substantial custom glue code anyway, eroding the primary benefit of adopting one.

## Consequences

- More initial engineering effort than dropping in a framework, but the session model fits the platform's two-plane data architecture natively instead of working around a framework's assumptions.
- The crypto-sensitive parts (hashing, signing, random generation) stay on maintained, audited packages — only the orchestration (where sessions live, how tenant context attaches) is custom, keeping the "never homemade crypto" principle intact.
- Establishes the pattern Phase 4 (Authentication) implements and Phase 5 (Authorization, [ADR-0007](./0007-authorization.md)) builds its permission checks on top of.

## Update (Phase 4 implementation)

`npm install` flagged `@oslojs/crypto` as fully deprecated ("Package no longer supported") — confirmed via `npm view @oslojs/crypto deprecated`, which returns that message even for its latest published version (1.0.1). This is the same maintainer as Lucia (`pilcrowonpaper`), so the irony is direct: the package this ADR adopted specifically *because* Lucia was deprecated has itself since been deprecated. `@oslojs/encoding` (used for base32-encoding the random session token) is unaffected and still actively published with no deprecation notice.

**Resolution:** `packages/auth`'s SHA-256 session-token hashing uses Node's built-in `node:crypto` (`createHash("sha256")`) instead of `@oslojs/crypto`'s `sha256()`. Node's `crypto` module is maintained as core Node.js, not a third-party package, which if anything strengthens the "audited, maintained primitives" rationale rather than weakening it. `@oslojs/encoding` remains in use. `jose` (POS/offline JWTs) is unaffected — not yet installed, deferred to Phase 12 as planned, and unrelated to this deprecation.

No other consequence: this was an internal implementation detail (which library computes a hash) with no API or architectural impact — `packages/auth`'s public shape (`Session`, `createSession`, `validateSessionToken`, etc.) is unchanged. Recorded here as a reminder to periodically re-check third-party dependency health, not just at adoption time.
