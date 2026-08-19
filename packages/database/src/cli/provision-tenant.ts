#!/usr/bin/env node
import { createLogger } from "@erp/logging";
import { closeControlPlaneDb } from "../control-plane/client";
import { provisionTenant } from "../tenant/provisioning";

function parseArgs(argv: string[]): { slug: string; name: string } {
  const args = Object.fromEntries(
    argv
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, ...rest] = arg.replace(/^--/, "").split("=");
        return [key, rest.join("=")];
      }),
  );

  const slug = args["slug"];
  if (!slug) {
    throw new Error("Usage: provision-tenant --slug=<slug> [--name=<display name>]");
  }
  return { slug, name: args["name"] ?? slug };
}

async function main(): Promise<void> {
  const logger = createLogger({ bindings: { module: "tenant", operation: "provision-tenant-cli" } });
  const { slug, name } = parseArgs(process.argv.slice(2));

  try {
    const result = await provisionTenant({ slug, name }, logger);
    logger.info("done", { tenantId: result.tenantId, status: "ok" });
    // eslint-disable-next-line no-console -- CLI output, not a log line
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeControlPlaneDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
