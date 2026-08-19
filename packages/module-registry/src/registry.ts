import { CircularDependencyError, DuplicateModuleError, ModuleNotRegisteredError, UnknownDependencyError } from "./errors";
import type { ModuleManifest } from "./types";

/**
 * Holds the set of manifests the application knows about and validates the
 * *static* dependency graph across all of them (cycles, unknown
 * dependencies) — see MODULE-SYSTEM.md §4. This is distinct from the
 * *per-tenant* check ("is this tenant's copy of the dependency actually
 * installed and active") which modules/core's install/uninstall use cases
 * perform against a tenant's control-plane records, not against this
 * in-memory registry.
 */
export class ModuleRegistry {
  private readonly manifests = new Map<string, ModuleManifest>();

  register(manifest: ModuleManifest): void {
    if (this.manifests.has(manifest.id)) {
      throw new DuplicateModuleError(manifest.id);
    }
    this.manifests.set(manifest.id, manifest);
  }

  get(moduleId: string): ModuleManifest {
    const manifest = this.manifests.get(moduleId);
    if (!manifest) throw new ModuleNotRegisteredError(moduleId);
    return manifest;
  }

  has(moduleId: string): boolean {
    return this.manifests.has(moduleId);
  }

  getAll(): ModuleManifest[] {
    return [...this.manifests.values()];
  }

  /**
   * Validates every registered manifest's dependencies resolve to another
   * registered manifest, and that the resulting graph is acyclic. Intended
   * to run once, at registry construction/boot — not per-request.
   */
  validateGraph(): void {
    for (const manifest of this.manifests.values()) {
      for (const dependency of manifest.dependencies) {
        if (!this.manifests.has(dependency.moduleId)) {
          throw new UnknownDependencyError(manifest.id, dependency.moduleId);
        }
      }
    }

    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, 0 | 1 | 2>();
    for (const id of this.manifests.keys()) color.set(id, WHITE);

    const path: string[] = [];

    const visit = (moduleId: string): void => {
      color.set(moduleId, GRAY);
      path.push(moduleId);

      const manifest = this.manifests.get(moduleId)!;
      for (const dependency of manifest.dependencies) {
        const depColor = color.get(dependency.moduleId);
        if (depColor === GRAY) {
          const cycleStart = path.indexOf(dependency.moduleId);
          throw new CircularDependencyError([...path.slice(cycleStart), dependency.moduleId]);
        }
        if (depColor === WHITE) {
          visit(dependency.moduleId);
        }
      }

      path.pop();
      color.set(moduleId, BLACK);
    };

    for (const id of this.manifests.keys()) {
      if (color.get(id) === WHITE) visit(id);
    }
  }
}
