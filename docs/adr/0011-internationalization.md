# ADR-0011: Internationalization (i18n) Strategy

- Status: Accepted (planning only — no code yet; see Consequences)
- Date: 2026-08-19

## Context

The user has added multi-language support as a platform requirement, not present in the original CLAUDE.md specification. This must be planned now, while the surface area is still small (Phase 4, almost no UI exists yet — `apps/web` has one placeholder page and JSON API routes), so that later UI-heavy phases (POS Foundation, Sales, Reporting, ...) are built i18n-ready from the start rather than needing a retrofit. Per explicit user decision, this ADR is planning-only: it records the strategy and where it fits in the roadmap, without scaffolding any i18n library or code in Phase 4 itself.

Three distinct translation concerns exist in a system like this, and they need different answers:

1. **UI strings** — button labels, form labels, static page text, validation messages.
2. **API error messages** — the `message` field in the `{code, message, requestId}` error shape (ARCHITECTURE.md §6).
3. **Business content** — tenant-entered data that could itself be multilingual (e.g. a product name in English and Arabic for the same tenant).

## Decision

**1. UI strings — `next-intl`.** Chosen over `react-i18next`/`next-i18next` (older, built around the Pages Router, weaker App Router/Server Component support) and `react-intl`/Format.js (lower-level, more boilerplate for the routing integration this platform needs). `next-intl` has first-class Next.js App Router support (Server Components, the `proxy.ts` convention this platform already uses) and integrates cleanly with route-based locale prefixes. Message catalogs are JSON files per locale, colocated per app (`apps/web/messages/<locale>.json`) and, once modules have their own UI, per module.

**2. Locale resolution — combines with existing tenant resolution.** URL shape becomes `{tenant-host}/{locale}/...` (e.g. `acme.platform.example.com/en/...`). Locale is resolved in the same request-hint layer that already resolves the tenant hint (`apps/web/src/proxy.ts`, per [ADR-0005](./0005-nextjs-app-shell.md)) — extended, not replaced, when this is implemented. Precedence: explicit URL locale prefix → authenticated user's saved preference (once `identity`'s `User` entity gains a `locale` field, Phase 4+) → tenant's configured default locale (once `tenant` gains this field) → `Accept-Language` header → platform default (`en`). This mirrors the tenant-resolution trust model: locale is a presentation concern, never an authorization one, so it is safe to derive from client-supplied hints (`Accept-Language`, URL) unlike tenant identity.

**3. API error messages stay in English (or code-only) — clients localize by `code`.** The `{code, message, requestId}` shape's `code` is already the stable, machine-readable identifier (ARCHITECTURE.md §6, e.g. `INVENTORY_INSUFFICIENT_STOCK`); `message` remains a fixed English fallback/log-friendly string, never localized server-side. Web/POS UIs map `code` to a localized message via their own `next-intl` catalog. This means **no backend work is required for this decision** — the existing error contract already supports it, as long as every domain error keeps a stable `code` (already the plan — CLAUDE.md §39).

**4. Business content translation — explicitly deferred, not decided here.** Whether/how tenant-entered data (product names, descriptions, etc.) supports multiple locales is a schema design question that belongs to the module that owns that data (`sales`/`inventory`'s product catalog, whenever that is designed) — options range from a simple `translations jsonb` column to dedicated translation tables. Deciding this now, before any product/catalog schema exists, would be speculative design (CLAUDE.md §55). This ADR explicitly flags it as a follow-up decision to make when that module is designed, not as scope creep to solve today.

## Alternatives Considered

- **`react-i18next`/`next-i18next`**: rejected — built for the Pages Router; App Router support is a bolt-on, not a first-class design, and this platform is already committed to the App Router (ADR-0005).
- **Deciding business-content translation now**: rejected for this ADR — no product/content schema exists yet to design against; premature.
- **Localizing API error messages server-side**: rejected — would require request-scoped locale threading into every domain error constructor across every module, for a UI-facing concern the client is better positioned to own (the client already knows the active locale from routing).

## Consequences

- **No code changes in Phase 4.** This ADR is recorded now so the roadmap and future UI work start i18n-aware; `next-intl` is not installed until real UI work begins.
- Every domain error must keep a stable `code` (already required by CLAUDE.md §39) — this is the one thing later i18n work depends on that earlier phases must not skip.
- When UI work begins (Phase 8, POS Foundation, is the first realistic candidate — see [ARCHITECTURE.md](../../ARCHITECTURE.md) §9), that phase's scope grows to include: installing `next-intl`, an initial message catalog (starting with `en`), and extending `proxy.ts`'s request-hint logic to also resolve locale.
- `identity`'s `User` entity and `tenant`'s `Tenant` entity will each need a `locale` field when implemented (Phase 4 for `User`, already-implemented `Tenant` needs a migration) — noted here so those phases don't need to retrofit it.
- Business-content translation remains an open decision, to be made when a content-bearing module (`sales`/`inventory` catalog) is actually designed.
