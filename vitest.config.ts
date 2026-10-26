import { defineConfig } from "vitest/config";
import path from "path";

/** Testes da central: `pnpm test` (os de SQL precisam do container de tests/support/sqlserver.ts). */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
