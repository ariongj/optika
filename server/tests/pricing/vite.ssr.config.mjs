// Vite config used only by diff.mjs: bundles the real TS pricing engine + seed for Node into .cache/ts.
// Standalone on purpose (the app's vite.config.ts and dist/ are never touched): only the `@` → src alias,
// an SSR build and a stub for the zustand UI store that src/i18n imports for its React hooks.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (p) => fileURLToPath(new URL(p, import.meta.url)).replace(/\\/g, '/');
const src = here('../../../src/');

export default defineConfig({
  root: here('../../..'),
  publicDir: false,
  logLevel: 'warn',
  resolve: {
    alias: [
      { find: /^@\/store\/ui$/, replacement: here('./stub-ui.mjs') },
      { find: /^@\//, replacement: src },
    ],
  },
  build: {
    ssr: here('./entry.ts'),
    outDir: here('./.cache/ts'),
    emptyOutDir: true,
    copyPublicDir: false,
    minify: false,
    sourcemap: false,
    target: 'node22',
    rolldownOptions: { output: { entryFileNames: '[name].mjs' } },
  },
});
