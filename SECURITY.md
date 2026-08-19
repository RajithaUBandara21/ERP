# Security

Status: Authentication (§1) implemented as of Phase 4. Authorization (§2) implemented as of Phase 5 (`packages/authorization`, `modules/identity`'s Role/Permission, `apps/web`'s `withPermission`) — with branch/warehouse scoping and manifest-driven permission registration explicitly deferred; see [ADR-0007](./docs/adr/0007-authorization.md)'s Update section. Must stay consistent with [ADR-0006](./docs/adr/0006-authentication.md) (authentication) and [ADR-0007](./docs/adr/0007-authorization.md) (authorization), and with [docs/security/threat-model.md](./docs/security/threat-model.md).

## 1. Authentication

Custom session/token layer built on audited primitives (`@node-rs/argon2`, `@oslojs/encoding`, Node's built-in `crypto`) rather than a framework assuming a single shared users table — see [ADR-0006](./docs/adr/0006-authentication.md) for the full rationale, including NextAuth/Clerk considered-and-rejected, and its Update section for a mid-implementation dependency-health correction.

- **Web sessions** (implemented): DB-backed — an opaque token (`packages/auth`'s `generateSessionToken`) delivered via an httpOnly, `Secure` (in production), `SameSite=Lax` cookie (`erp_session`); only the token's SHA-256 hash is persisted, in the control-plane `sessions` table, so a session resolves before a tenant database connection is even selected, and can be instantly revoked (`revokeSession`, or an admin force-logout via `revokeAllForUser` — both implemented). 30-day expiry (`SESSION_DURATION_MS`). A session is always freshly created on login, never reused/extended, which is what satisfies "regenerated on privilege change" without extra bookkeeping. Every session/token lookup failure mode (not found, expired, revoked, **wrong tenant**) throws the same generic error — see `validateSessionToken`'s doc comment — so a caller cannot use response differences to probe which case applies.
- **POS/offline tokens** (not yet implemented — Phase 12): short-lived JWT access token + long-lived rotating refresh token (`jose`, not yet installed), carrying `tenantId`/`terminalId`/`branchId` claims, allowing the offline client to validate token shape/expiry locally while the server re-verifies authorization on every sync (see [OFFLINE-POS.md](./OFFLINE-POS.md)).
- Passwords hashed with Argon2id (`packages/auth`'s `hashPassword`/`verifyPassword`); never logged, never included in audit records. `verifyCredentials` (`modules/identity`) always performs an Argon2 verify — even for a non-existent email, against a cached dummy hash — so response timing cannot be used to enumerate registered accounts, and returns the identical `InvalidCredentialsError` for both "no such user" and "wrong password."

## 2. Authorization

```text
User → Tenant → Role → Permissions
```

(The full target model is `User → Tenant → Organization → Role → Permissions → Resource/Branch/Warehouse scope` — "Organization" and the scope dimension are not implemented yet; see below.)

- RBAC with fine-grained, module-namespaced permission strings — currently only `modules/identity`'s own catalog exists: `IDENTITY.USER.LIST`, `IDENTITY.ROLE.MANAGE` (`IDENTITY_PERMISSIONS`). Other modules (POS, Inventory, ...) will declare their own catalogs the same way once implemented.
- Two seeded system roles per tenant (`packages/identity`'s `seedDefaultRoles`): **owner** (wildcard `*` — every permission) and **member** (empty set — default-deny). Custom roles are not yet supported.
- Branch/warehouse scoping is **not implemented yet** — deferred until `Branch`/`Warehouse` entities exist (still not built as of Phase 6); `requirePermission()`'s signature is deliberately scope-ready (a scope parameter can be added later without breaking existing callers). See [ADR-0007](./docs/adr/0007-authorization.md)'s Update.
- **Always enforced server-side.** A hidden or disabled frontend button is never treated as an authorization control (CLAUDE.md §14) — there is no frontend yet to even have this temptation.
- Enforced through `packages/authorization`'s `requirePermission(grantedPermissions, required)`, composed by `apps/web`'s `withPermission()` — which loads the session (via `withAuth`), then the user's role and its permissions (`modules/identity`'s `getUserPermissions`), before calling it. Evaluated only after tenant context resolution and session validation (see [MULTI-TENANCY.md](./MULTI-TENANCY.md) §2), so a permission check never runs against the wrong tenant's role assignments — **verified live**: a session with no permissions gets 403 `PERMISSION_DENIED`, one with the wildcard gets 200, and an unauthenticated request never reaches the permission check at all (401 first).

Full model recorded in [ADR-0007](./docs/adr/0007-authorization.md).

## 3. OWASP-aligned controls

| Threat | Control |
|---|---|
| SQL injection | Parameterized queries only, via Drizzle's query builder — no raw string-interpolated SQL |
| XSS | React's default escaping; CSP (see below); no `dangerouslySetInnerHTML` without explicit sanitization |
| CSRF | `SameSite` session cookies + explicit CSRF token on state-changing requests from non-JSON form posts |
| SSRF | Outbound requests (webhooks, integrations) validate/allowlist destinations; no user-supplied URLs fetched server-side without validation |
| IDOR | Every resource lookup is scoped by the resolved tenant *and* an explicit ownership/authorization check — never "fetch by ID" alone |
| Broken access control | Centralized `requirePermission()` guard (§2); default-deny — **implemented, tested live** |
| Authentication attacks | Rate limiting on `/api/auth/*` (§5), Argon2id hashing, account lockout/backoff on repeated failures |
| Session fixation | Session ID regenerated on privilege change (login, role change) |
| Privilege escalation | Only two seeded, non-assignable-by-users system roles exist so far (owner/member) — no role-change endpoint exists yet for this control to apply to; revisit once custom roles/role assignment are implemented |
| Insecure file upload | MIME type, content signature, size, and filename validated; files stored outside the app server; signed URLs for private access (CLAUDE.md §50) |
| Insecure deserialization | All external input validated through Zod schemas at the boundary before use |
| Rate abuse | Endpoint-class-specific rate limits (§5) |
| Replay attacks | Idempotency keys on financial/order operations (see [EVENTS.md](./EVENTS.md) and [OFFLINE-POS.md](./OFFLINE-POS.md)) |

Additional baseline: HTTPS enforced in production, secure cookie flags, security headers (including CSP where practical), webhook signature validation, payment provider callback validation, least-privilege service credentials, no secrets in logs or commits (see [docs/security/threat-model.md](./docs/security/threat-model.md) for the full checklist and per-feature threat questions from CLAUDE.md §57).

## 4. Secrets

Never hardcoded: API keys, passwords, database credentials, JWT signing keys, payment secrets, encryption keys. Local development uses `.env` (gitignored) seeded from `.env.example`; production uses a secrets manager (AWS Secrets Manager or equivalent). Credentials are rotatable without an application code change.

## 5. Rate limiting (CLAUDE.md §49)

Applied per endpoint class, tenant-aware where the endpoint is tenant-scoped:

| Class | Example | Status |
| --- | --- | --- |
| Authentication | `/api/auth/login` (10 attempts / 5 min, keyed by IP+tenant) | Implemented — `packages/auth`'s `checkRateLimit`, an in-memory fixed-window limiter. **Known limitation**: single-process only; a multi-instance production deployment needs a shared (Redis) backend — not wired up yet, since Redis isn't justified/attached anywhere else either (DATABASE.md §8). Not solved speculatively ahead of that deployment shape existing. |
| Password reset | `/api/auth/reset-password` | Not yet implemented (no password-reset flow yet) |
| Public APIs | Unauthenticated read endpoints | Not yet implemented |
| Payment APIs | Checkout/capture/refund endpoints | Not yet implemented (Phase 10) |
| Webhook endpoints | Payment/delivery provider callbacks | Not yet implemented |
| Admin APIs | Platform-operator endpoints | Not yet implemented |
| Exports | Report/data export triggers | Not yet implemented |
| Search | Product/order search | Not yet implemented |

## 6. Audit logging (CLAUDE.md §37)

Every sensitive business action records: actor, tenant, timestamp, action, resource, resource_id, before/after state, IP (where appropriate), request_id, correlation_id. Never recorded: passwords, tokens, card data, or other secrets.

**Implementation (Phase 4, relocated Phase 6):** `@erp/logging`'s `recordAuditEvent` (`packages/logging/src/audit.ts`) emits this full field set as a structured log line (`audit: true` marker) — wired into login/login-failure/logout (Phase 4) and module install/uninstall (Phase 6). Originally lived in `apps/web`; moved into `packages/logging` once `modules/core` needed the identical pattern, rather than duplicating it. This is a legitimate audit trail on its own (a structured log stream), not a placeholder — but it is not yet a persisted, queryable `audit_log` table. A tenant-side table (owned by `core`) for admin-UI audit browsing was explicitly considered and deferred again during Phase 6 (confirmed with the user — see [docs/modules/core.md](./docs/modules/core.md)) rather than building a second tenant-schema/migration mechanism ahead of Phase 7's general one.

## 7. Security testing

Automated coverage (introduced progressively from Phase 3 onward, consolidated in Phase 18 per the roadmap): unauthorized access, horizontal/vertical privilege escalation, IDOR, tenant isolation (see [MULTI-TENANCY.md](./MULTI-TENANCY.md) §5), expired sessions, invalid tokens, CSRF, rate limits, file upload validation, webhook signature validation. Full detail in [TESTING.md](./TESTING.md) §5–6.
