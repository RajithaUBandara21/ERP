# ADR-0001: Modular Monolith over Microservices

- Status: Accepted
- Date: 2026-08-19

## Context

The platform must support many independent business modules (POS, Inventory, Delivery, Payments, Sales, Purchasing, Accounting, Reporting, ...) that different tenants install selectively, at a target scale of ~1,000 tenants. The team must ship incrementally and keep operational complexity low during initial development, while preserving the ability to extract a module into an independent service later if a specific module's load or team ownership justifies it (CLAUDE.md §3, §55).

## Decision

Build a single deployable Next.js application (a modular monolith) composed of strictly-bounded modules under `modules/`, each with its own domain/application/infrastructure/interfaces layering (see [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md)) and a published application-layer interface. Modules communicate only through that interface or through domain events over a transactional outbox ([ADR-0004](./0004-outbox-pattern.md)) — never through direct database access to another module's tables. This makes each module a de facto service boundary in code even though it deploys as part of one process.

## Alternatives Considered

- **Microservices from the start**: rejected. At this stage it multiplies operational surface (deployment, networking, distributed transactions, observability across services) without a demonstrated need, and CLAUDE.md §55 explicitly forbids introducing microservices without justification. Cross-module transactions (e.g. POS sale touching Inventory and Payments) would require distributed-transaction machinery this scale does not need.
- **Unstructured monolith** (no enforced module boundaries): rejected — it is the fastest path to the "spaghetti dependencies" CLAUDE.md §5 explicitly warns against, and would make later extraction of any single module effectively a rewrite.

## Consequences

- Enables fast iteration and simple deployment (one app, one build, one deploy pipeline) during early phases.
- Requires discipline (lint-enforced boundaries, manifest dependency validation — see [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md)) to keep the "modular" property real rather than aspirational.
- Any module can be extracted later by replacing its in-process application-interface calls with network calls and giving it its own deployment — a mechanical change, not an architectural one, because the boundary already exists in code.
- Cross-module workflows must be designed around the outbox/event pattern from day one (not retrofitted), since that is what keeps future extraction viable.
