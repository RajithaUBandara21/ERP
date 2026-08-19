/**
 * Deliberately minimal — supports only "*" (any version) and exact
 * equality. Full semver range support (^, ~, etc.) is not implemented: no
 * scenario in this codebase yet has more than one version of a module in
 * play at once, so building a real range parser now would be speculative
 * (CLAUDE.md §55). Add a `semver`-backed implementation when a concrete
 * multi-version scenario exists, not before.
 */
export function satisfiesVersionRange(version: string, range: string): boolean {
  if (range === "*") return true;
  return version === range;
}
