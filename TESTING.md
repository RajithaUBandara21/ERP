# Testing Strategy

Status: Phase 1 (architecture only). Real test suites are introduced module-by-module starting Phase 2; this document defines the strategy every phase must follow.

## 1. Test types per module (CLAUDE.md §40)

Every business module's `tests/` directory contains, as applicable to that module's maturity:

| Type | Scope |
|---|---|
| Unit | Domain rules — entities, value objects, domain services, in isolation from the database |
| Integration | Application use cases against a real (test) database instance |
| Contract | Module/API contracts — the shape of a module's published application interface and events, so a change that breaks a consumer is caught before it ships |
| E2E | Critical user workflows spanning multiple modules through real HTTP |
| Security | Authorization and tenant isolation for this module's endpoints |
| Performance | This module's critical-path queries/operations |

## 2. Minimum critical E2E workflows (CLAUDE.md §40)

```text
Create tenant → Login → Install module → Create product → Create inventory →
Create POS sale → Process payment → Update inventory → Create delivery →
Assign driver → Complete delivery → Generate report
```

These are built up incrementally as each phase makes the next step possible — not written as one giant test up front. Phase 3 can already exercise "create tenant"; the full chain is only complete once Phase 14 (Reporting) exists.

## 3. Tooling (selected when Phase 2 introduces the first real code, documented here for consistency)

- Unit/integration: Vitest (fast, native ESM/TS support, works well in a Turborepo monorepo).
- E2E: Playwright (covers both `apps/web` and, later, offline scenarios in `apps/pos` via browser storage emulation).
- Contract: lightweight schema-snapshot tests on each module's exported Zod schemas / manifest, run in CI.

This is a default, not yet an ADR-level decision — revisit only if a concrete limitation is hit.

## 4. What "done" requires from tests (CLAUDE.md §60)

A feature is not complete because its UI works. Per the Definition of Done, every feature's tests must cover: domain logic, authorization, validation, error handling, and (for tenant-facing features) tenant isolation — in addition to the happy path.

## 5. Tenant isolation tests (CLAUDE.md §41) — mandatory, non-negotiable

Automated tests proving **Tenant A cannot access Tenant B's data**, across:

```text
API · database access · cache · background jobs · files · events · reports · exports
```

Method: deliberately substitute Tenant B's identifiers into Tenant A's authenticated context/requests and assert rejection (not merely "empty result" — an isolation test that returns 200 with an empty list when it should 403/404 is a false pass and must be treated as a bug in the test itself). These tests must fail loudly if isolation is ever broken; they are treated as release-blocking, not advisory.

## 6. Security testing (CLAUDE.md §42)

Automated coverage: unauthorized access, horizontal privilege escalation, vertical privilege escalation, IDOR, tenant isolation (§5 above), expired sessions, invalid tokens, CSRF, rate limits, file upload validation, webhook validation.

## 7. CI/CD gating (CLAUDE.md §43)

```text
Pull request: install → typecheck → lint → unit → integration → build → security checks → migration validation
Main branch, additionally: E2E → performance smoke tests → container build
```

No code that fails a required check is merged or deployed. See `.github/workflows/ci.yml` for the current (Phase 1) skeleton — only install/typecheck/lint/test/build exist so far, since there is no application code or database yet to run integration/security/migration checks against; those jobs are added as their prerequisites (Phase 2 database, Phase 4 auth, etc.) land.

## 8. Performance testing

Introduced against real critical paths once they exist (POS checkout, inventory adjustment, report generation), following the measurement discipline in [ARCHITECTURE.md](./ARCHITECTURE.md) and CLAUDE.md §56: measure → identify bottleneck → hypothesis → change → benchmark → compare → keep/revert. No performance claim is made without a benchmark backing it.
