import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from 'node:url';
import exactRuleDeduplication from './scripts/css-deduplicate.mjs';

export default defineConfig({
  base: "/",
  plugins: [react({ jsxImportSource: '@miftari/i18n' })],
  resolve: { alias: { '@miftari/i18n': fileURLToPath(new URL('./src/i18n', import.meta.url)) } },
  optimizeDeps: { entries: ['index.html'] },
  css: { postcss: { plugins: [exactRuleDeduplication()] } },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@mediapipe")) return "mediapipe";
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules")) return "vendor";
          return undefined;
        }
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  }
});
