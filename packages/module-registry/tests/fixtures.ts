import type { ModuleManifest } from "../src/types";

export function dummyManifest(id: string, dependsOn: string[] = []): ModuleManifest {
  return {
    id,
    name: id,
    version: "1.0.0",
    description: `Dummy manifest for ${id}`,
    dependencies: dependsOn.map((moduleId) => ({ moduleId, versionRange: "*" })),
    permissions: [],
    routes: [],
    eventsPublished: [],
    eventsConsumed: [],
    configuration: [],
  };
}
