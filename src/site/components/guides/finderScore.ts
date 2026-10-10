import type { L10n, Product, ProductOptionValue } from '@/lib/types';
import { resolveTryOnFrame, type TryOnFrame } from '@/site/tryon/frames';
import { isFrame, rxReady } from '@/site/components/product/optical';
import {
  BEST_WHY,
  COLOUR_WHY,
  FACE_FIT,
  FACE_WHY,
  FIT_RANGE,
  FIT_SIZE,
  FIT_WHY,
  METAL_WHY,
  MINIMAL_LIGHT,
  POLAR_WHY,
  RX_WHY,
  SHAPE_NAME,
  STEPS,
  STYLE_SHAPE,
  STYLE_WHY,
  SUN_RX_WHY,
  WEIGHTS,
  type Answers,
  type Material,
} from './finderData';

export interface FrameMatch {
  product: Product;
  /** 0–100 */
  pct: number;
  reasons: L10n[];
  /** colour value id that matched the material/colour answer (shown first on the card) */
  colourId?: string;
}

/** Interpolate {vars} in every language of a localized template. */
function fill(tpl: L10n, vars: Record<string, L10n | string>): L10n {
  const one = (lang: keyof L10n) => tpl[lang].replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? `{${k}}` : typeof v === 'string' ? v : v[lang] || v.sq;
  });
  return { me: one('me'), sq: one('sq'), en: one('en') };
}

const specOf = (p: Product, re: RegExp) => p.specs.find((s) => re.test(s.label.en) || re.test(s.label.sq));

function luminance(hex: string) {
  const m = hex.replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!m) return 0.5;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How well one colour of a frame answers the material/colour preference (0–1). */
function colourScore(frame: TryOnFrame, v: ProductOptionValue, pref: Exclude<Material, 'metal'>) {
  const text = `${v.id} ${v.label.en}`.toLowerCase();
  const look = frame.colors[v.id];
  const finish = look?.finish;
  const hex = look?.frame ?? v.swatch ?? '#777777';
  if (pref === 'dark') {
    if (/black|graphite|matte|navy|forest|gunmetal|charcoal/.test(text) && !/tortoise|havana/.test(text)) return 1;
    return finish !== 'metal' && finish !== 'crystal' && finish !== 'tortoise' && luminance(hex) < 0.22 ? 0.9 : 0;
  }
  if (pref === 'warm') {
    if (finish === 'tortoise' || /tortoise|havana|amber|caramel|honey/.test(text)) return 1;
    if (/champagne|gold|bronze|rose|ruby|brown/.test(text)) return 0.7;
    return 0;
  }
  // clear / translucent
  if (finish === 'crystal' || /crystal|transparent|translucent/.test(text)) return 1;
  if (/\bice\b|pearl/.test(text) && finish !== 'metal') return 0.5;
  return 0;
}

const BUILD = {
  metal: { metal: 1, mixed: 0.65, acetate: 0.1 },
  dark: { acetate: 1, mixed: 0.6, metal: 0.2 },
  warm: { acetate: 1, mixed: 0.8, metal: 0.5 },
  clear: { acetate: 1, mixed: 0.8, metal: 0.3 },
} as const;
const COLOUR_SHARE = { dark: 0.55, warm: 0.8, clear: 0.85 } as const;

/** Whether a product is in scope for the "what are you looking for" answer. */
export function inKind(p: Product, kind: Answers['kind']) {
  if (!isFrame(p)) return false;
  if (kind === 'optical') return p.categoryId === 'cat-optike';
  if (kind === 'sun') return p.categoryId === 'cat-dielli';
  return true;
}

/** Score every frame against the answers; best first. */
export function scoreFrames(products: Product[], a: Answers): FrameMatch[] {
  const out: (FrameMatch & { raw: number })[] = [];
  for (const p of products) {
    if (!inKind(p, a.kind)) continue;
    const frame = resolveTryOnFrame(p);
    if (!frame) continue;
    const colours = p.options.find((o) => o.id === 'color')?.values ?? p.options.find((o) => o.type === 'swatch')?.values ?? [];
    const shapeSpec = specOf(p, /^shape$|^forma$/i);
    const shapeName: L10n = shapeSpec?.value ?? SHAPE_NAME[frame.shape];
    const material = specOf(p, /^material|^materiali/i)?.value;
    const weight = specOf(p, /^weight$|^pesha$/i)?.value.en;
    const lensType = specOf(p, /^lenses$|^lentet$/i)?.value.en ?? '';
    const polarised = /polari/i.test(lensType);

    const parts: { w: number; s: number; why?: L10n; min?: number }[] = [];

    // Face shape
    if (a.face && a.face !== 'unknown') {
      let s = FACE_FIT[a.face][frame.shape];
      if (a.face === 'long') s = s * 0.75 + (frame.lensHeight >= 44 ? 1 : frame.lensHeight >= 41 ? 0.6 : 0.3) * 0.25;
      if (a.face === 'heart' && frame.build === 'metal') s = Math.min(1, s + 0.1);
      parts.push({ w: WEIGHTS.face, s, why: fill({ me: '{shape}: {why}', sq: '{shape}: {why}', en: '{shape}: {why}' }, { shape: shapeName, why: FACE_WHY[a.face] }), min: 0.8 });
    }

    // Style
    if (a.style) {
      let s = STYLE_SHAPE[a.style][frame.shape];
      if (a.style === 'minimal') s = s * 0.3 + { metal: 1, mixed: 0.85, acetate: 0.4 }[frame.build] * 0.7;
      if (a.style === 'bold') s = s * 0.5 + { acetate: 1, mixed: 0.6, metal: 0.3 }[frame.build] * 0.5 + (Object.values(frame.colors).some((c) => c.lens.mirror) ? 0.1 : 0);
      if (a.style === 'classic' && p.badges.includes('bestseller')) s += 0.05;
      if (a.style === 'sport' && polarised) s += 0.05;
      s = Math.min(1, s);
      const light = a.style === 'minimal' && weight && frame.build !== 'acetate';
      parts.push({ w: WEIGHTS.style, s, why: light ? fill(MINIMAL_LIGHT, { weight }) : STYLE_WHY[a.style], min: 0.75 });
    }

    // Material / colour
    let colourId: string | undefined;
    if (a.material) {
      if (a.material === 'metal') {
        const s = BUILD.metal[frame.build];
        parts.push({ w: WEIGHTS.material, s, why: material ? fill(METAL_WHY, { material }) : undefined, min: 0.6 });
      } else {
        const pref = a.material;
        const scored = colours.map((v) => ({ v, s: colourScore(frame, v, pref) })).sort((x, y) => y.s - x.s);
        const best = scored[0];
        const share = COLOUR_SHARE[pref];
        const s = (best?.s ?? 0) * share + BUILD[pref][frame.build] * (1 - share);
        if (best && best.s > 0) colourId = best.v.id;
        parts.push({ w: WEIGHTS.material, s, why: best && best.s >= 0.7 ? fill(COLOUR_WHY[pref], { colour: best.v.label }) : undefined, min: 0.6 });
      }
    }

    // Fit (frame width)
    if (a.fit && a.fit !== 'unknown') {
      const [lo, hi] = FIT_RANGE[a.fit];
      const w = frame.frameWidth;
      const d = w < lo ? lo - w : w > hi ? w - hi : 0;
      const s = Math.max(0, 1 - d / 6);
      parts.push({ w: WEIGHTS.fit, s, why: d === 0 ? fill(FIT_WHY, { width: String(w), size: FIT_SIZE[a.fit] }) : undefined, min: 1 });
    }

    const wSum = parts.reduce((n, x) => n + x.w, 0) || 1;
    let raw = (parts.reduce((n, x) => n + x.w * x.s, 0) / wSum) * 100;
    if (p.badges.includes('bestseller')) raw += 2;
    if (p.featured) raw += 1;
    const pct = Math.round(Math.max(30, Math.min(98, raw)));

    // Reasons: strongest answered criteria first, then product facts.
    const reasons = parts
      .filter((x) => x.why && x.s >= (x.min ?? 0.7))
      .sort((x, y) => y.w * y.s - x.w * x.s)
      .map((x) => x.why!) as L10n[];
    const extras: L10n[] = [];
    if (p.categoryId === 'cat-dielli') {
      if (polarised) extras.push(POLAR_WHY);
      if (rxReady(p)) extras.push(SUN_RX_WHY);
    } else if (rxReady(p)) extras.push(RX_WHY);
    if (p.badges.includes('bestseller')) extras.push(BEST_WHY);
    for (const e of extras) if (reasons.length < 3) reasons.push(e);

    out.push({ product: p, pct, reasons: reasons.slice(0, 3), colourId, raw });
  }
  return out.sort((x, y) => y.raw - x.raw || y.product.sold - x.product.sold).map(({ raw: _raw, ...m }) => m);
}

/* ------------------------------------------------------------------ */
/* Answers <-> storage / query string                                   */
/* ------------------------------------------------------------------ */
export const STORAGE_KEY = 'optika-frame-finder';

const VALID: Record<keyof Answers, readonly string[]> = {
  kind: ['optical', 'sun', 'both'],
  face: ['oval', 'round', 'square', 'heart', 'long', 'unknown'],
  style: ['classic', 'minimal', 'bold', 'sport'],
  material: ['metal', 'dark', 'warm', 'clear'],
  fit: ['narrow', 'medium', 'wide', 'unknown'],
};

/** Keep only known answer values (storage and URLs are user-editable). */
export function cleanAnswers(raw: Record<string, unknown> | null | undefined): Answers {
  const a: Record<string, string> = {};
  if (!raw) return a;
  for (const k of Object.keys(VALID) as (keyof Answers)[]) {
    const v = raw[k];
    if (typeof v === 'string' && VALID[k].includes(v)) a[k] = v;
  }
  return a as Answers;
}

export const isComplete = (a: Answers) => STEPS.every((s) => !!a[s.key]);

export function answersFromParams(params: URLSearchParams): Answers {
  const raw: Record<string, string> = {};
  for (const s of STEPS) {
    const v = params.get(s.param);
    if (v) raw[s.key] = v;
  }
  return cleanAnswers(raw);
}

export function answersToQuery(a: Answers) {
  const q = new URLSearchParams();
  for (const s of STEPS) if (a[s.key]) q.set(s.param, a[s.key]!);
  return q.toString();
}

export function loadSaved(): { answers: Answers; step: number; done: boolean } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { answers?: Record<string, unknown>; step?: unknown; done?: unknown };
    const answers = cleanAnswers(v.answers);
    const step = typeof v.step === 'number' && v.step >= 0 && v.step < STEPS.length ? Math.floor(v.step) : 0;
    return { answers, step, done: v.done === true && isComplete(answers) };
  } catch {
    return null;
  }
}

export function save(state: { answers: Answers; step: number; done: boolean }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / storage disabled — the quiz still works */
  }
}

export function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
