import { z } from "@erp/validation";

/**
 * Full env contract for the platform (see .env.example). Only
 * CONTROL_PLANE_DATABASE_URL / TENANT_DATABASE_ADMIN_URL are required in
 * Phase 2 — everything else becomes required once the feature that consumes
 * it (auth, storage, cache) actually lands, so config loading doesn't break
 * before those features exist.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  CONTROL_PLANE_DATABASE_URL: z.string().min(1, "CONTROL_PLANE_DATABASE_URL is required"),
  TENANT_DATABASE_ADMIN_URL: z.string().min(1, "TENANT_DATABASE_ADMIN_URL is required"),

  SESSION_COOKIE_SECRET: z.string().optional(),
  JWT_SIGNING_KEY: z.string().optional(),
  PASSWORD_HASH_PEPPER: z.string().optional(),

  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),

  REDIS_URL: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

/**
 * Parses and validates process.env once per process. Throws with the list of
 * invalid/missing keys (never their values — see SECURITY.md §4) on failure.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;

  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }

  cached = result.data;
  return cached;
}

/** Test-only: clears the memoized config so a test can reload with different env vars. */
export function resetConfigCache(): void {
  cached = undefined;
}
