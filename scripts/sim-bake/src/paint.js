// Printed and on-screen content for the near objects. Text stays real text: reading it is the whole point of the view.
import * as THREE from 'three';

const SANS = '"Manrope Bake", sans-serif';
const SERIF = '"Fraunces Bake", serif';

export async function loadFonts() {
  const faces = [
    new FontFace('Manrope Bake', 'url(/fonts/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2)', { weight: '200 800' }),
    new FontFace('Manrope Bake', 'url(/fonts/@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2)', { weight: '200 800', unicodeRange: 'U+0100-02BA,U+1E00-1EFF' }),
    new FontFace('Fraunces Bake', 'url(/fonts/@fontsource-variable/fraunces/files/fraunces-latin-standard-normal.woff2)', { weight: '100 900' }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
}

function tex(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.textBaseline = 'alphabetic';
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

const PARAGRAPH = [
  'Sytë tanë kalojnë çdo ditë nga larg në afër',
  'qindra herë, shpesh pa e vënë re. Rruga,',
  'ekrani, telefoni dhe libri kërkojnë secili',
  'një fuqi tjetër nga lentja që mbani.',
  '',
  'Një lente e mirë ju lë të shikoni natyrshëm:',
  'pa e ngritur kokën, pa i shtrënguar sytë',
  'dhe pa e larguar telefonin nga vetja.',
  '',
  'Merrni kohë për kontrollin e syve dhe bëni',
  'pushime të shkurtra gjatë punës në ekran.',
];

/** A printed A5-ish page. */
export function printedPage(title) {
  return tex(1520, 2080, (g, w, h) => {
    g.fillStyle = '#f7f4ee';
    g.fillRect(0, 0, w, h);
    g.scale(2, 2);
    g.fillStyle = '#776440';
    g.font = `700 22px ${SANS}`;
    g.fillText('MIFTARI VISION · KËSHILLA', 56, 74);
    g.fillStyle = '#1c1a17';
    g.font = `500 62px ${SERIF}`;
    g.fillText(title, 56, 158);
    g.fillStyle = '#ad9466';
    g.fillRect(56, 184, 96, 4);
    g.fillStyle = '#2b2824';
    g.font = `500 29px ${SANS}`;
    PARAGRAPH.forEach((line, i) => g.fillText(line, 56, 250 + i * 44));
    g.font = `500 21px ${SANS}`;
    g.fillStyle = '#5b554d';
    PARAGRAPH.slice(0, 8).forEach((line, i) => g.fillText(line, 56, 780 + i * 30));
  });
}

/** A phone's calendar. */
export function phoneScreen() {
  return tex(780, 1600, (g, w, h) => {
    g.fillStyle = '#0f1113';
    g.fillRect(0, 0, w, h);
    g.scale(2, 2);
    g.fillStyle = '#f2efe9';
    g.font = `700 25px ${SANS}`;
    g.fillText('09:41', 28, 50);
    g.font = `500 54px ${SERIF}`;
    g.fillText('Sot', 28, 128);
    const rows = [
      ['Takim te optika', '10:30', '#ad9466'],
      ['Kafe me Arbërin', '12:15', '#6f7f69'],
      ['Syzet janë gati', '14:00', '#a4774c'],
      ['Stërvitje', '18:45', '#7f8fa3'],
      ['Darkë', '20:00', '#c79a7b'],
    ];
    rows.forEach(([label, time, color], i) => {
      const y = 168 + i * 112;
      g.fillStyle = '#1e2124';
      g.fillRect(24, y, 390 - 48, 94);
      g.fillStyle = color;
      g.fillRect(24, y, 8, 94);
      g.fillStyle = '#f2efe9';
      g.font = `600 25px ${SANS}`;
      g.fillText(label, 50, y + 42);
      g.fillStyle = '#a7a39b';
      g.font = `500 21px ${SANS}`;
      g.fillText(time, 50, y + 74);
    });
  });
}

/** A monthly report on the desk monitor. */
export function monitorScreen() {
  return tex(2048, 1152, (g, w, h) => {
    g.scale(1.6, 1.6);
    g.fillStyle = '#fbfaf7';
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle = '#1c1a17';
    g.fillRect(0, 0, 1280, 66);
    g.fillStyle = '#f7f3ee';
    g.font = `600 26px ${SANS}`;
    g.fillText('Raporti mujor · Tetor', 28, 42);
    g.fillStyle = '#1c1a17';
    g.font = `500 56px ${SERIF}`;
    g.fillText('Përmbledhje e muajit', 48, 150);
    g.font = `500 25px ${SANS}`;
    g.fillStyle = '#4b463f';
    ['Kontrolle të syve në tre pikat tona, sipas javës.', 'Numrat përfshijnë takimet e rezervuara në internet.'].forEach((t, i) => g.fillText(t, 48, 200 + i * 36));
    const heads = ['Java', 'Kontrolle', 'Syze', 'Lente', 'Kthime'];
    const rows = [
      ['1', '148', '92', '61', '2'],
      ['2', '163', '101', '74', '1'],
      ['3', '137', '88', '59', '3'],
      ['4', '176', '117', '83', '0'],
    ];
    g.font = `700 24px ${SANS}`;
    g.fillStyle = '#776440';
    heads.forEach((t, i) => g.fillText(t, 48 + i * 140, 322));
    g.font = `500 24px ${SANS}`;
    rows.forEach((row, k) => {
      g.fillStyle = '#e3d9cc';
      g.fillRect(48, 340 + k * 56, 680, 2);
      g.fillStyle = '#1c1a17';
      row.forEach((t, i) => g.fillText(t, 48 + i * 140, 376 + k * 56));
    });
    g.fillStyle = '#f3efe6';
    g.fillRect(780, 110, 450, 480);
    g.fillStyle = '#776440';
    g.font = `700 22px ${SANS}`;
    g.fillText('KONTROLLE PËR JAVË', 806, 152);
    [148, 163, 137, 176].forEach((v, i) => {
      const bar = (v / 176) * 330;
      g.fillStyle = '#ad9466';
      g.fillRect(820 + i * 96, 560 - bar, 60, bar);
      g.fillStyle = '#1c1a17';
      g.font = `600 22px ${SANS}`;
      g.fillText(String(v), 826 + i * 96, 552 - bar);
    });
  });
}

/** The driver's digital cluster. */
export function clusterScreen() {
  return tex(1800, 640, (g, w, h) => {
    g.scale(2, 2);
    g.fillStyle = '#05070a';
    g.fillRect(0, 0, 900, 320);
    const dial = (cx, value, unit) => {
      g.strokeStyle = '#2a2f33';
      g.lineWidth = 8;
      g.beginPath();
      g.arc(cx, 165, 128, Math.PI * 0.8, Math.PI * 2.2);
      g.stroke();
      g.strokeStyle = '#d7b673';
      g.beginPath();
      g.arc(cx, 165, 128, Math.PI * 0.8, Math.PI * 1.55);
      g.stroke();
      g.fillStyle = '#f4f2ec';
      g.font = `700 96px ${SANS}`;
      g.textAlign = 'center';
      g.fillText(value, cx, 185);
      g.fillStyle = '#9b978e';
      g.font = `600 30px ${SANS}`;
      g.fillText(unit, cx, 232);
    };
    dial(170, '78', 'km/h');
    dial(900 - 170, '2.1', 'x1000 rpm');
    g.fillStyle = '#d7d4cc';
    g.font = `600 34px ${SANS}`;
    g.textAlign = 'center';
    g.fillText('34 km', 450, 112);
    g.fillStyle = '#9b978e';
    g.font = `500 27px ${SANS}`;
    g.fillText('Prishtinë', 450, 154);
    g.fillText('21°', 450, 232);
  });
}

/** The navigation screen in the centre console. */
export function navScreen() {
  return tex(1600, 960, (g, w, h) => {
    g.scale(2, 2);
    g.fillStyle = '#10161b';
    g.fillRect(0, 0, 800, 480);
    g.strokeStyle = '#2e3a44';
    g.lineWidth = 8;
    for (let i = 0; i < 9; i += 1) {
      g.beginPath();
      g.moveTo(0, i * 62 + 20);
      g.lineTo(800, i * 40 + 60);
      g.moveTo(i * 110, 0);
      g.lineTo(i * 80 + 60, 480);
      g.stroke();
    }
    g.strokeStyle = '#d7b673';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(240, 480);
    g.quadraticCurveTo(280, 240, 560, 110);
    g.stroke();
    g.fillStyle = 'rgba(10,14,18,0.9)';
    g.fillRect(0, 0, 360, 130);
    g.fillStyle = '#f4f2ec';
    g.font = `700 44px ${SANS}`;
    g.fillText('800 m', 24, 58);
    g.font = `500 28px ${SANS}`;
    g.fillStyle = '#b9b5ac';
    g.fillText('Dalja për Prishtinë', 24, 104);
  });
}

/** A direction sign, for reading at a distance. */
export function directionSign() {
  return tex(1024, 512, (g, w, h) => {
    g.fillStyle = '#1d4a7a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 12;
    g.strokeRect(20, 20, w - 40, h - 40);
    g.fillStyle = '#ffffff';
    g.font = `700 118px ${SANS}`;
    g.fillText('QENDRA', 66, 170);
    g.font = `600 92px ${SANS}`;
    g.fillText('Stacioni  1.2 km', 66, 300);
    g.fillText('Spitali  2.4 km', 66, 420);
  });
}

/** A motorway gantry sign. */
export function gantrySign() {
  return tex(1400, 420, (g, w, h) => {
    g.fillStyle = '#0d5c3d';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 10;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#ffffff';
    g.font = `700 128px ${SANS}`;
    g.fillText('PRISHTINË', 60, 170);
    g.font = `700 110px ${SANS}`;
    g.fillText('34 km', 1000, 165);
    g.font = `600 112px ${SANS}`;
    g.fillText('PEJË', 60, 340);
    g.fillText('68 km', 1000, 340);
  });
}

/** Fine grain for soft-touch plastics and leather. */
export function grainNormal(seed = 1, size = 512, amount = 0.5) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i += 1) h[i] = r();
  for (let pass = 0; pass < 2; pass += 1) {
    const b = h.slice();
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        h[y * size + x] = (b[y * size + x] * 2 + b[y * size + ((x + 1) % size)] + b[((y + 1) % size) * size + x] + b[y * size + ((x + size - 1) % size)] + b[((y + size - 1) % size) * size + x]) / 6;
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (h[y * size + ((x + 1) % size)] - h[y * size + ((x + size - 1) % size)]) * amount * 8;
      const dy = (h[((y + 1) % size) * size + x] - h[((y + size - 1) % size) * size + x]) * amount * 8;
      const k = (y * size + x) * 4;
      data[k] = 128 + Math.max(-127, Math.min(127, dx * 127));
      data[k + 1] = 128 + Math.max(-127, Math.min(127, dy * 127));
      data[k + 2] = 255;
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}
