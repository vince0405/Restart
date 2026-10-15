import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Match the "@/*" alias from tsconfig.json so tests import the same way.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure logic only for now — no browser or database needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
