# ADR-0008: ORM Selection — Drizzle over Prisma

- Status: Accepted
- Date: 2026-08-19

## Context

CLAUDE.md §4 requires evaluating Prisma vs Drizzle against: PostgreSQL support, migrations, transaction support, performance, type safety, multi-database tenancy, serverless compatibility, and operational simplicity — and documenting the decision. The decisive constraint is database-per-tenant (ADR-0002): the application must construct and discard many per-tenant database clients dynamically, from a bounded, lazily-populated connection registry ([MULTI-TENANCY.md](../../MULTI-TENANCY.md) §3), often within serverless functions with limited connection budgets ([DATABASE.md](../../DATABASE.md) §4).

## Decision

Use **Drizzle** (`drizzle-orm` + `drizzle-kit`) for both the control-plane schema and every tenant database schema.

| Criterion | Assessment |
|---|---|
| PostgreSQL support | Both mature and fully featured for this use case. |
| Migrations | Drizzle Kit generates plain, reviewable SQL migration files — directly satisfies CLAUDE.md §44 ("versioned, deterministic, reviewable"). Prisma Migrate is capable but its migration history format is more opaque. |
| Transaction support | Both support standard Postgres transactions adequately. |
| Type safety | Drizzle infers types directly from schema definitions, no code-generation step. Prisma requires running `prisma generate`, an extra build step that multiplies awkwardly across a monorepo with a schema shared/replicated across every tenant database context. |
| Multi-database tenancy | **Decisive.** A Drizzle client is a thin wrapper over a driver connection/pool — cheap to construct and discard, which is what makes the dynamic tenant-connection registry practical. A `PrismaClient` instantiates its own query-engine process per client; holding many of these concurrently (one per active tenant) is heavy and not what Prisma's client lifecycle is designed for. |
| Serverless compatibility | Drizzle has first-class support for serverless-native drivers (e.g. Neon's HTTP/WebSocket driver) without a native query-engine binary, fitting Vercel/edge-adjacent deployment better out of the box. Prisma's serverless story (Accelerate, driver adapters) has improved but adds either a managed-service dependency or extra configuration to avoid engine overhead. |
| Operational simplicity | One schema module per module (colocated in that module's `infrastructure/persistence/`), applied identically via Drizzle Kit migrations to every tenant database — a natural fit for "same schema, many physical databases" (ADR-0002). |

## Alternatives Considered

- **Prisma**: rejected primarily on the multi-database-tenancy and serverless-client-weight criteria above. Prisma's stronger relational query API and larger ecosystem (Prisma Studio, broader community content) are real advantages, but do not outweigh the operational cost of its client model in an architecture that fundamentally requires many concurrent, cheaply-constructed database connections.
- **Raw SQL / query builder with no ORM (e.g. `postgres.js` alone, Kysely)**: considered — Kysely in particular is a reasonable lighter-weight alternative to Drizzle. Not chosen because Drizzle already provides Kysely's core benefit (SQL-like, type-safe query building with no codegen) while also bundling first-party migration tooling (`drizzle-kit`), avoiding a separate migration tool decision.

## Consequences

- `packages/database` owns the Drizzle setup, connection registry, and control-plane schema; each module owns its own tenant-schema migrations under its `infrastructure/persistence/`.
- The team takes on writing more explicit query code in places Prisma's relational API would auto-generate joins — an accepted tradeoff for connection-model fit.
- If a future measured need arises for Prisma-specific tooling (e.g. Prisma Studio for support/ops tooling), it can be evaluated as a narrowly-scoped addition without revisiting the core ORM decision.
