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

/**
 * Preload the two fonts every page paints with first (Manrope text, Fraunces display — Latin subsets), so they
 * download in parallel with the JavaScript instead of after it. Phones on slow networks see the real type sooner.
 */
function preloadFonts(prefix: string): Plugin {
  const CRITICAL = /assets\/(?:manrope-latin-wght-normal|fraunces-latin-opsz-normal)-[\w-]+\.woff2$/;
  return {
    name: 'optika-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        return Object.keys(ctx.bundle ?? {})
          .filter((f) => CRITICAL.test(f))
          .map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `${prefix}${f}`, crossorigin: '' }, injectTo: 'head-prepend' as const }));
      },
    },
  };
}

/**
 * The app stylesheet (~45 KB gzipped, storefront + CMS) must not hold back the first paint: every page ships a
 * static first screen with inline styles (scripts/prerender-meta.mjs), so the sheet loads as a high-priority
 * preload and applies when it lands; main.tsx mounts React only once it has (no unstyled flash).
 */
function asyncCss(): Plugin {
  return {
    name: 'optika-async-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g, (_m, href: string) =>
          [
            `<link rel="preload" as="style" crossorigin href="${href}">`,
            `<link rel="stylesheet" crossorigin href="${href}" media="print" onload="this.media='all'" data-app-css>`,
            `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`,
            // until the sheet is in: no default body margin and the page colour (main.tsx removes it — unlayered, it
            // would otherwise beat the sheet's layered base styles)
            '<style id="shell-css">body{margin:0;background:#f7f3ee}</style>',
          ].join('\n    '),
        );
      },
    },
  };
}

export default defineConfig({
  base,
  plugins: [baseImages(base), preloadFonts(base), asyncCss(), react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { chunkSizeWarningLimit: 1500 },
});
