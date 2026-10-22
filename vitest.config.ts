import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    // Las pruebas de base de datos arrancan PostgreSQL en WASM; dar margen.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
