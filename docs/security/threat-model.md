# Threat Model

Companion to [SECURITY.md](../../SECURITY.md). This document tracks the per-feature security questions CLAUDE.md §57 requires be asked before implementation, and the platform-level threats being designed against from Phase 1.

## Per-feature checklist (CLAUDE.md §57)

Before implementing any feature, its design must answer:

```text
Who can access this?
Which tenant owns this?
What happens if the ID is changed?
Can this operation be replayed?
Can this request be duplicated?
Can this data leak through logs?
Can this endpoint be abused?
```

This checklist is applied and recorded (briefly, in the PR/design note for that feature) starting with the first real endpoint in Phase 3, and is a Definition-of-Done item (CLAUDE.md §60).

## Platform-level threats and primary mitigations

| Threat | Primary mitigation | Reference |
|---|---|---|
| Cross-tenant data access | Database-per-tenant; host-derived tenant context (session cross-check from Phase 4); tenant isolation test suite — **implemented and tested live**, including a session issued for one tenant being rejected against another's host | [MULTI-TENANCY.md](../../MULTI-TENANCY.md), ADR-0002, `apps/web/tests/auth-flow.integration.test.ts` |
| Tenant ID spoofing via client input | Tenant context only ever derived from the resolved host, never request body/query/header — **verified live** with a spoofed `X-Tenant-Id`/`X-Tenant-Slug` header, ignored as designed | [MULTI-TENANCY.md](../../MULTI-TENANCY.md) §2 |
| IDOR on module resources | Every resource lookup scoped by resolved tenant + explicit authorization check, not "fetch by ID" alone — **partially implemented**: the one real endpoint so far (`GET /api/identity/users`) is a list, not a per-ID lookup, so this isn't fully exercised yet; revisit once a resource-by-ID endpoint exists (Phase 8+) | [SECURITY.md](../../SECURITY.md) §3 |
| Unauthorized access to a permission-gated action | Default-deny RBAC (`packages/authorization`'s `requirePermission`), composed with tenant+session resolution via `withPermission` — **implemented and tested live**: wildcard role succeeds, empty-permission role gets 403, unauthenticated gets 401 before the permission check even runs | ADR-0007, `apps/web/tests/permission-flow.integration.test.ts` |
| Privilege escalation via role/permission changes | Not yet applicable — only two seeded, non-user-assignable system roles exist (owner/member); no role-change endpoint exists yet. Revisit once custom roles/role assignment are implemented | ADR-0007 |
| Session fixation / hijack | DB-backed revocable sessions; always freshly created on login, never reused; httpOnly/Secure/SameSite cookies — **implemented** (`packages/auth`) | ADR-0006 |
| Account enumeration via login response/timing | `verifyCredentials` returns the identical error for "no such user" and "wrong password," and performs a dummy Argon2 verify for non-existent emails to equalize timing — **implemented** | `modules/identity/src/application/verify-credentials.ts` |
| Duplicate financial operations from retries | Idempotency keys on order/payment operations | [EVENTS.md](../../EVENTS.md), [OFFLINE-POS.md](../../OFFLINE-POS.md) |
| Silent data loss on module uninstall | Uninstall never deletes business/financial data; preserved/archived, not dropped | [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) §6 |
| Secret leakage via logs/commits | Structured logger never logs secret-classed fields; `.env` gitignored; secrets manager in production | [SECURITY.md](../../SECURITY.md) §4 |
| Malicious file upload | MIME/signature/size/filename validation; storage outside app server; signed URLs | [SECURITY.md](../../SECURITY.md) §3 |
| Forged webhook/payment callbacks | Signature validation required before processing any webhook/provider callback | [SECURITY.md](../../SECURITY.md) §3 |
| Endpoint abuse / brute force | Endpoint-class rate limiting, tenant-aware where applicable | [SECURITY.md](../../SECURITY.md) §5 |

## Status

Tenant resolution (Phase 3) and authentication (Phase 4) mitigations above are implemented and covered by automated tests, including live manual verification (curl against a running dev server) for the cross-tenant and header-spoofing cases. This document will be extended with concrete findings as each further phase's endpoints are designed and reviewed, and consolidated into a full pass during Phase 18 (Security Hardening).
