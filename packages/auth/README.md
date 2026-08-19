# packages/auth

Session/token layer on audited primitives (Argon2id via `@node-rs/argon2`, `@oslojs/encoding` + Node's built-in `crypto` for session tokens — see [ADR-0006](../../docs/adr/0006-authentication.md), including its Update section on the `@oslojs/crypto` deprecation found during Phase 4).

- `password.ts` — `hashPassword`/`verifyPassword` (Argon2id).
- `session-token.ts` — `generateSessionToken`/`hashSessionToken` (opaque tokens, not JWTs; only the hash is ever persisted).
- `application/` — `createSession`, `validateSessionToken` (the tenant cross-check — see its doc comment), `revokeSession`.
- `infrastructure/drizzle-session-repository.ts` — control-plane-backed `SessionRepository`.
- `rate-limit.ts` — in-memory fixed-window limiter (`checkRateLimit`); see its doc comment for the single-process limitation.

POS/offline JWT tokens (`jose`) are deferred to Phase 12 — not installed here yet.
