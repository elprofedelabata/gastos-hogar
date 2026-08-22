import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  // Relative assets work both at username.github.io and at /repository/ URLs.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
  },
});
