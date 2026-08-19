# ADR-0010: Monorepo Tooling & Enforced Module Boundaries

- Status: Accepted
- Date: 2026-08-19

## Context

CLAUDE.md §5 prescribes an `apps/`, `modules/`, `packages/` monorepo structure and explicitly warns against modules becoming "mutually dependent spaghetti" (§5) or having circular dependencies (§9). The repository needs a package manager and task runner that scale to many workspace packages, and a mechanism that makes the module-boundary rule (ADR-0001) enforceable by tooling rather than only by code review.

## Decision

- **Package manager: pnpm.** Content-addressable store (efficient across many workspace packages), strict `node_modules` resolution (no phantom dependencies — a module cannot accidentally resolve another module's undeclared transitive dependency, which directly supports keeping module boundaries real), native workspace protocol.
- **Task runner: Turborepo.** Runs typecheck/lint/test/build across all workspace packages with dependency-aware caching, and integrates natively with Vercel (the target demo deployment platform) for zero-config remote caching.
- **Boundary enforcement: `eslint-plugin-boundaries`** (or an equivalent custom ESLint rule), configured so a module may only import another module through its public interface (never its `domain`/`infrastructure` internals — [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) §1) and only along dependencies declared in its manifest ([MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) §2), matching the dependency graph in [DOMAIN-MODEL.md](../../DOMAIN-MODEL.md) §3. A lint failure, not just a design-doc rule, is what actually stops a forbidden cross-module import from merging.

## Alternatives Considered

- **Nx**: seriously considered — Nx's built-in module-boundary enforcement (`enforce-module-boundaries` with tags) is a close match for this exact requirement, arguably a better out-of-the-box fit than configuring `eslint-plugin-boundaries` by hand. Rejected for this phase because Nx's generator/plugin ecosystem is more machinery than currently needed (CLAUDE.md §55, do not overengineer) and Turborepo's simpler model integrates more directly with the target Vercel deployment. Revisit if the boundary-lint approach proves insufficient to enforce module isolation in practice.
- **npm/yarn workspaces with no dedicated task runner**: rejected — loses dependency-aware task caching/orchestration across a growing number of packages, which becomes a real CI cost as more modules land.
- **No automated boundary enforcement (convention + code review only)**: rejected — CLAUDE.md §59, §63 list cross-module database access and circular dependencies as things to actively avoid; relying purely on review discipline across a growing codebase is how "spaghetti dependencies" (§5) happen in practice.

## Consequences

- Every new module/package must be registered in `pnpm-workspace.yaml` and given appropriate boundary-lint tags/config — a small but mandatory step when scaffolding a new module.
- CI's lint stage becomes the actual enforcement point for the module-boundary architecture rule, not just documentation — a lint failure blocks merge (see `.github/workflows/ci.yml` and [TESTING.md](../../TESTING.md) §7).
- If Nx's stronger built-in enforcement is ever needed, migrating from Turborepo is a tooling-layer change, not an architecture change — the module boundaries themselves (manifests, directory structure) do not depend on which task runner enforces them.
