export class DuplicateModuleError extends Error {
  constructor(moduleId: string) {
    super(`Module already registered: ${moduleId}`);
    this.name = "DuplicateModuleError";
  }
}

export class ModuleNotRegisteredError extends Error {
  constructor(moduleId: string) {
    super(`Module not registered: ${moduleId}`);
    this.name = "ModuleNotRegisteredError";
  }
}

export class CircularDependencyError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular module dependency detected: ${cycle.join(" → ")}`);
    this.name = "CircularDependencyError";
  }
}

export class UnknownDependencyError extends Error {
  constructor(moduleId: string, missingDependencyId: string) {
    super(`Module '${moduleId}' declares a dependency on unregistered module '${missingDependencyId}'`);
    this.name = "UnknownDependencyError";
  }
}
