import { CORE_PERMISSIONS, DrizzleModuleRegistryRepository, listModules } from "@erp/core";
import { NextResponse } from "next/server";
import { getModuleRegistry } from "@/lib/module-registry";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleModuleRegistryRepository();

export const GET = withPermission(CORE_PERMISSIONS.MODULE_LIST, async (_request, { tenant }) => {
  const listing = await listModules(getModuleRegistry(), repository, tenant.id);

  return NextResponse.json({
    modules: listing.map((entry) => ({
      id: entry.manifest.id,
      name: entry.manifest.name,
      description: entry.manifest.description,
      manifestVersion: entry.manifest.version,
      status: entry.status,
      installedVersion: entry.version,
    })),
  });
});
