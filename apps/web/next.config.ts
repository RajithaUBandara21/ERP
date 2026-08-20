import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TS source (no build step) — see DATABASE.md §5
  // and packages/*/package.json "main". Next must compile them itself.
  transpilePackages: [
    "@erp/database",
    "@erp/logging",
    "@erp/configuration",
    "@erp/validation",
    "@erp/tenant",
    "@erp/auth",
    "@erp/authorization",
    "@erp/identity",
    "@erp/module-registry",
    "@erp/core",
    "@erp/inventory",
    "@erp/payments",
    "@erp/pos",
    "@erp/delivery",
    "@erp/events",
  ],
  // Avoid Next auto-generating its own AGENTS.md/CLAUDE.md here — the
  // repository already has a governing root CLAUDE.md (see ARCHITECTURE.md).
  agentRules: false,
};

export default nextConfig;
