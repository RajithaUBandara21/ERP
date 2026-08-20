# apps/pos

The offline-first point-of-sale terminal application (see [OFFLINE-POS.md](../../OFFLINE-POS.md) and [ADR-0003](../../docs/adr/0003-offline-pos.md)).

Implemented (Phase 12, "true foundation" scope): a durable, IndexedDB-backed local cart + sync queue proving the full offline-write → reconnect → sync-to-server path for one golden flow. Every "Complete Sale" writes locally first and returns instantly regardless of connectivity; syncing to `apps/web`'s real POS API happens as a separate, best-effort, idempotent background step. Manual SKU/name/price/quantity entry (no product catalog module exists server-side yet to search against).

- `src/lib/db.ts` — IndexedDB schema (`idb`), the `terminal` identity record and the `pendingSales` durable queue.
- `src/lib/idempotency.ts` — client-side idempotency key generation (`POS-{terminalIdShort}-{YYYYMMDD}-{sequence}`), generated once at sale completion, never at sync time.
- `src/lib/complete-sale.ts` — the offline-first "complete sale" write.
- `src/lib/sync-queue.ts` — drains the queue serially, in creation order; a network failure schedules a backoff+jitter retry, a definitive server rejection (e.g. oversell — no backorder allowance exists server-side) is marked `"conflict"` and never auto-retried.
- `src/lib/api-client.ts` — the only thing that talks to `apps/web`.
- `next.config.ts` — proxies `/api/*` to `apps/web` same-origin (not CORS — see its doc comment: the session cookie's `SameSite=Lax` wouldn't survive a genuinely cross-origin fetch).

Has no database access of its own — every write ultimately goes through `apps/web`'s existing `pos` module API (ARCHITECTURE.md §4: the offline queue is a client-side durability/retry layer in front of one server-side code path, not a parallel one).

```bash
# apps/web must already be running (pnpm --filter @erp/web dev) with pos/inventory/payments installed for the tenant
pnpm --filter @erp/pos-terminal dev   # http://localhost:3001

# first launch: the Setup screen asks for tenant host, terminal name, and owner credentials —
# this is the one online-only step (CLAUDE.md §18); everything after works offline.
```

Verification note: this was live-tested via curl against both apps' running dev servers (proving the proxy, tenant resolution, session cookie, and the exact API sequence the sync queue performs) and via `pnpm --filter @erp/pos-terminal test` (17 tests covering IndexedDB persistence, idempotency key generation, and sync-queue retry/conflict behavior against real IndexedDB semantics via `fake-indexeddb`). The React UI itself was not visually verified in a browser — no browser-automation tool was available in this environment; say so rather than claiming otherwise (CLAUDE.md §56).
