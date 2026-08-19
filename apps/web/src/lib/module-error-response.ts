import {
  DependencyNotInstalledError,
  IncompatibleDependencyVersionError,
  ModuleAlreadyInstalledError,
  ModuleHasDependentsError,
  ModuleNotInstalledError,
} from "@erp/core";
import { ModuleNotRegisteredError } from "@erp/module-registry";
import { NextResponse } from "next/server";

/** Maps modules/core's domain errors to HTTP responses; returns undefined for anything else so the caller falls through to a generic 500. */
export function moduleErrorResponse(error: unknown, requestId: string): NextResponse | undefined {
  if (error instanceof ModuleNotRegisteredError) {
    return NextResponse.json({ code: "MODULE_NOT_FOUND", message: error.message, requestId }, { status: 404 });
  }
  if (error instanceof ModuleAlreadyInstalledError) {
    return NextResponse.json({ code: "MODULE_ALREADY_INSTALLED", message: error.message, requestId }, { status: 409 });
  }
  if (error instanceof ModuleNotInstalledError) {
    return NextResponse.json({ code: "MODULE_NOT_INSTALLED", message: error.message, requestId }, { status: 409 });
  }
  if (error instanceof DependencyNotInstalledError || error instanceof IncompatibleDependencyVersionError) {
    return NextResponse.json({ code: "MODULE_DEPENDENCY_UNSATISFIED", message: error.message, requestId }, { status: 422 });
  }
  if (error instanceof ModuleHasDependentsError) {
    return NextResponse.json({ code: "MODULE_HAS_DEPENDENTS", message: error.message, requestId }, { status: 409 });
  }
  return undefined;
}
