import { build } from 'esbuild';
const entry = process.argv[2] || 'src/pano.js';
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: 'bundle.js', target: 'es2022', logLevel: 'error', sourcemap: false });
