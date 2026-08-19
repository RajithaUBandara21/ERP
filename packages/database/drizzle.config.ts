import { defineConfig } from "drizzle-kit";

const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;
if (!connectionString) {
  throw new Error("CONTROL_PLANE_DATABASE_URL must be set to run drizzle-kit against the control plane");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/control-plane/schema.ts",
  out: "./migrations/control-plane",
  dbCredentials: { url: connectionString },
});
