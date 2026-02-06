import { defineConfig } from "vite";

export default defineConfig({
  server: {
    open: true,
    watch: {
      // Use polling with a reasonable interval to avoid spurious reloads
      usePolling: true,
      interval: 1000,
      // Ignore common directories that shouldn't trigger reloads
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    },
  },
});
