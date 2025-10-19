import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    threads: false
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src", "shared")
    }
  }
});
