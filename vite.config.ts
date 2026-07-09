import { defineConfig } from "vitest/config";
import pkg from "./package.json";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
        history: "./history.html",
        settings: "./settings.html",
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
