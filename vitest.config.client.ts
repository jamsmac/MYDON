/**
 * Vitest configuration for client-side tests
 *
 * Run with: pnpm test:client
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  plugins: [react()],
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["client/**/*.test.ts", "client/**/*.test.tsx"],
    exclude: ["node_modules/**"],
    setupFiles: ["./client/src/test/setup.ts"],
  },
});
