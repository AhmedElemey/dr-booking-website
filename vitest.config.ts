import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // next-intl imports extensionless `next/*` ESM paths; let Vite resolve them.
    server: { deps: { inline: ["next-intl"] } },
  },
});
