# Lens simulator plates

Bakes `public/images/sim/` for the "look through the lens" view. Offline only: nothing here ships with the site.

Each scene is a Poly Haven panorama (CC0: `urban_street_04`, `leibstadt`, `poly_haven_studio`) with near objects
path-traced into it under the panorama's own light, so they sit in the photo. Output per scene:

- `<id>.webp`, `<id>-sm.webp`: colour, rectilinear, half-extent tangents 0.9 × 0.7
- `<id>-d.webp`: data. R vergence (0–6 D), G highlights above white (log2 / 5), B what a polariser removes

```bash
npm install
node fetch.cjs assets      # about 380 MB of CC0 sources
node server.cjs            # keep running, port 4400
node build.mjs src/bake.js
bash bake-all.sh street drive desk
node encode.mjs street street && node encode.mjs drive drive && node encode.mjs desk desk
```

Needs Chrome and a real GPU (`run.mjs` has the Chrome path). Leave the GPU alone while it runs: another WebGL page can make
a bake come back black, which `bake-all.sh` detects and retries.
