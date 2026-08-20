# ADR-0003: Offline-First POS Architecture

- Status: Accepted (implemented, Phase 12 — see Update below)
- Date: 2026-08-19

## Context

POS terminals must keep selling during network outages (CLAUDE.md §17) — a POS that stops working offline is a non-starter for retail use. This requires local durability, a sync mechanism, idempotent server-side application of synced actions, and explicit conflict handling, without corrupting inventory/payment state when connectivity returns.

## Decision

`apps/pos` maintains local application state backed by IndexedDB, with a durable, ordered sync queue per terminal. Every financial/order action generated offline carries a client-generated idempotency key (`POS-TERM-{terminal}-{date}-{seq}`) so server-side replay of a retried sync is a no-op returning the original result, never a duplicate. Sync ultimately invokes the same `pos` module application-layer use cases as an online request — offline is a client-side durability/retry layer in front of one server-side code path, not a separate one. Conflict classes (price changed, stock changed, customer changed, already-refunded, already-processed) each have an explicit, documented resolution policy — see [OFFLINE-POS.md](../../OFFLINE-POS.md) §5 — rather than "last write wins."

## Alternatives Considered

- **Online-only POS with a "can't sell right now" fallback during outages**: rejected — directly contradicts the product requirement (CLAUDE.md §17) and is commercially unacceptable for a retail POS.
- **Optimistic last-write-wins sync with no idempotency keys**: rejected — CLAUDE.md §19–20 explicitly forbid duplicate orders/payments from retries and silent conflict overwrites; this is a financial-correctness requirement, not a nice-to-have.
- **CRDVs / operational-transform-based sync**: rejected as overkill — POS actions (create order, add line, apply payment) are naturally expressed as idempotent commands with deterministic conflict policies; general-purpose CRDT merge semantics are not needed for this domain and would add significant complexity (CLAUDE.md §55, do not overengineer).

## Consequences

- Every POS-originated write path must be designed idempotent from the start (Phase 8, POS Foundation) even before offline support itself is implemented (Phase 12) — retrofitting idempotency later would be far more invasive.
- Requires terminal identity (`terminal_id`/`device_id`/`branch_id`) to exist before offline sync can be built (CLAUDE.md §18), since idempotency keys and conflict scoping depend on it.
- Conflict policies must be documented and reviewed per class (§20) rather than left to implicit merge behavior — increases upfront design work but eliminates a whole class of "silently wrong inventory/financial state" bugs.

## Update (Phase 12 implementation — "true foundation" scope)

Confirmed with the user before implementation: this phase builds a real, working offline-write → durable-queue → reconnect → sync path for one golden flow, not full production polish. Implemented in `apps/pos` (a new Next.js app, `idb` for IndexedDB — see `apps/pos/src/lib/db.ts`'s doc comment for why that dependency over hand-rolled IndexedDB or a heavier framework):

- **Local persistence**: a `terminal` record (identity, established once online per CLAUDE.md §18) and a `pendingSales` store (the durable sync queue), not yet the full CLAUDE.md §2 list (products/prices/tax/customers) — no catalog module exists server-side to sync from yet, so line items are entered manually (sku/name/price/quantity), matching what `pos`'s real API already accepts.
- **Idempotency**: keys are generated client-side at sale-completion time (`POS-{terminalIdShort}-{YYYYMMDD}-{sequence}`, a persisted monotonic per-terminal counter), never at sync time — exactly this ADR's original decision.
- **Sync**: processes the queue serially, in creation order (causal consistency per terminal). A retry after a *network* failure re-creates the cart and re-adds every line rather than resuming precisely where it left off — safe, not wasteful-in-a-harmful-way, because checkout()'s own idempotency check runs before it touches the cart at all, so a duplicate cart from a retried attempt is simply abandoned once the real checkout call succeeds via the original idempotency key. A documented, accepted gap: no garbage-collection job cleans up those abandoned open carts yet.
- **Conflicts**: a definitive server rejection (anything that isn't a network failure) is marked `"conflict"` and never auto-retried — this is where the "stock changed online (oversold while offline)" policy from §5's table currently lands. §5 says such a sale should still complete with a backorder event for `inventory` to reconcile; that backorder/negative-inventory allowance does not exist server-side (Phase 9's inventory enforcement is strict, no opt-out), so this phase surfaces it as a manual-review conflict instead — an honest, narrower version of §5's own fallback ("any conflict not covered by a deterministic policy is queued for manual resolution"), not a silent policy violation.
- **A real bug found via live cross-app verification** (curl against both apps' running dev servers, not just automated tests — the same rigor that caught Phase 8's Turbopack bug and Phase 9's migration-table bug): apps/web's `proxy.ts` unconditionally overwrote the `x-tenant-host-hint` header from its own Host header on every request. Since `apps/pos` has no database access of its own and instead proxies API calls to apps/web same-origin (a Next.js rewrite — see `apps/pos/next.config.ts`'s doc comment for why this over CORS: session cookies are `SameSite=Lax`, which a cross-origin fetch would never carry), the internal rewritten request's Host header is apps/web's own dev-server host, not the tenant's — so every proxied request resolved "no tenant for this host" even though `apps/pos`'s client had explicitly set the correct hint. Fixed by only setting the hint when not already present (see `proxy.ts`'s updated doc comment for why this doesn't weaken the documented trust model: the hint was already only as trustworthy as the equally-spoofable Host header it's derived from, for the same pre-auth-only purpose).
