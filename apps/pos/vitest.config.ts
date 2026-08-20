import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // fake-indexeddb/auto installs a real IndexedDB implementation onto
    // globalThis — Node has no native IndexedDB, and jsdom doesn't
    // implement one either. This lets db.ts/sync-queue.ts be tested
    // against real (if in-memory) IndexedDB semantics, not a hand-rolled
    // mock that could drift from the real API's behavior.
    setupFiles: ["fake-indexeddb/auto"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
