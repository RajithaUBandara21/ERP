import { coreManifest } from "@erp/core";
import { ModuleRegistry } from "@erp/module-registry";

/**
 * The application's registered manifests. validateGraph() runs once here,
 * at module load, not per-request.
 */
const registry = new ModuleRegistry();
registry.register(coreManifest);
registry.validateGraph();

export function getModuleRegistry(): ModuleRegistry {
  return registry;
}
