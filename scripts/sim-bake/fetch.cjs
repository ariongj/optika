// Downloads the CC0 sources the user approved (and nothing else) into a separate folder. Keeps Poly Haven's file layout.
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
const HDRIS = ['urban_street_04', 'leibstadt', 'poly_haven_studio'];
const PROPS = ['tea_set_01', 'potted_plant_02', 'classic_laptop', 'stationery_supplies', 'clipboard', 'desk_lamp_arm_01', 'binder_notebook', 'oak_veneer_01', 'marble_01', 'black_walnut_veneer_01'];
const UA = { 'User-Agent': 'miftari-sim-bake' };

async function get(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return 0;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file + '.part', buf);
  fs.renameSync(file + '.part', file);
  return buf.length;
}

(async () => {
  let total = 0;
  for (const k of HDRIS) {
    const j = await (await fetch(`https://api.polyhaven.com/files/${k}`, { headers: UA })).json();
    for (const res of ['2k', '8k']) {
      const e = j.hdri[res].hdr;
      total += await get(e.url, path.join(out, 'hdri', `${k}_${res}.hdr`));
      console.log('ok', k, res, (total / 1e6).toFixed(0) + ' MB so far');
    }
  }
  for (const k of PROPS) {
    const j = await (await fetch(`https://api.polyhaven.com/files/${k}`, { headers: UA })).json();
    const g = (j.gltf['2k'] || j.gltf['1k']).gltf;
    const dir = path.join(out, 'props', k);
    total += await get(g.url, path.join(dir, path.basename(new URL(g.url).pathname)));
    for (const [rel, v] of Object.entries(g.include || {})) total += await get(v.url, path.join(dir, rel));
    console.log('ok', k, (total / 1e6).toFixed(0) + ' MB so far');
  }
  console.log('done', (total / 1e6).toFixed(0) + ' MB');
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
