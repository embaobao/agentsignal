import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    host: true,
    port: 5173,
    // 开发期把这些前缀转发给后端；生产由 @fastify/static 同域托管（deployment.md §1）。
    // 前后端统一用「无 /api 前缀的同域相对路径」，避免两套 baseURL。
    proxy: {
      "^/(topics|signals|agents|skills|stats|validate|healthz|readyz|docs)(/|\\?|$)": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: { outDir: "dist", sourcemap: false },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
