export class ModuleAlreadyInstalledError extends Error {
  constructor(moduleId: string) {
    super(`Module already installed and active: ${moduleId}`);
    this.name = "ModuleAlreadyInstalledError";
  }
}

export class ModuleNotInstalledError extends Error {
  constructor(moduleId: string) {
    super(`Module is not installed/active: ${moduleId}`);
    this.name = "ModuleNotInstalledError";
  }
}

export class DependencyNotInstalledError extends Error {
  constructor(
    public readonly moduleId: string,
    public readonly dependencyId: string,
  ) {
    super(`Cannot install '${moduleId}': its dependency '${dependencyId}' is not installed/active for this tenant`);
    this.name = "DependencyNotInstalledError";
  }
}

export class IncompatibleDependencyVersionError extends Error {
  constructor(moduleId: string, dependencyId: string, installedVersion: string, requiredRange: string) {
    super(
      `Cannot install '${moduleId}': installed '${dependencyId}' version ${installedVersion} does not satisfy required range ${requiredRange}`,
    );
    this.name = "IncompatibleDependencyVersionError";
  }
}

export class ModuleHasDependentsError extends Error {
  constructor(
    public readonly moduleId: string,
    public readonly dependentIds: string[],
  ) {
    super(`Cannot uninstall '${moduleId}': still depended on by active module(s) ${dependentIds.join(", ")}`);
    this.name = "ModuleHasDependentsError";
  }
}
