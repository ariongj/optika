import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Deployment base. Root deployments (Vercel, Netlify, dev server) use "/"; the GitHub Pages workflow builds
 * with BASE_PATH=/optika/. Always normalised to "/x/".
 */
function basePath(): string {
  const raw = (process.env.BASE_PATH ?? '/').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}
const base = basePath();

/**
 * Seeded data and JSX reference bundled pictures as absolute "/images/…" strings. Under a sub-path those
 * would 404, so at build time every string literal in src/**\/*.ts(x) that starts with "/images/" is
 * prefixed with the base ('/images/a.webp' → '/optika/images/a.webp'). Checks like
 * `src.startsWith('/images/')` are rewritten the same way, so they keep matching. No-op for base "/".
 */
function baseImages(prefix: string): Plugin {
  const SRC = /[\\/]src[\\/].*\.tsx?$/;
  const LITERAL = /(['"`])\/images\//g;
  return {
    name: 'optika-base-images',
    enforce: 'pre',
    transform(code, id) {
      if (prefix === '/' || !SRC.test(id.split('?')[0]) || !code.includes('/images/')) return null;
      return { code: code.replace(LITERAL, `$1${prefix}images/`), map: null };
    },
  };
}

export default defineConfig({
  base,
  plugins: [baseImages(base), react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { chunkSizeWarningLimit: 1500 },
});
