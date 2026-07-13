import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx", "client/**/*.spec.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    testTimeout: 10_000,
    // HTTP smoke tests share global test pool/auth hooks — isolate per file to avoid teardown races.
    pool: "forks",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
