import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion';
import { CalendarCheck, ChevronDown, EyeOff, Glasses, Minus, Move3d, Plus, ShoppingBag, SlidersHorizontal, Waypoints } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/misc';
import { openBooking } from '@/site/components/utility/Booking';
import { lightMode } from '@/site/components/smart/data';
import { useDict, useL, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { money } from '@/lib/format';
import { asset } from '@/lib/paths';
import { optionsLabel, unitPrice } from '@/lib/pricing';
import { clamp, cn } from '@/lib/utils';
import { useSettings } from '@/store/hooks';
import { useUi } from '@/store/ui';
import type { FrameShape } from '@/site/tryon/frames';
import { ChoiceGroup } from '../ChoiceGroup';
import { IDEAL_INDEX, indexOf, SHORT, specIndex, STRENGTH_POWER, THIN_ID, TYPES, type KnownStrength, type Strength } from '../lensData';
import { LG } from '../lensDict';
import { ThicknessCompare } from '../ThicknessCompare';
import { SIM } from './dict';
import type { LabelId, LabelMap, LensKind, ProgressiveLevel, Simulator, SimState } from './engine';
import { bandOf, crossSection, lensStats, MATERIALS, materialOf, rightEye, solveLens, strongestPower, type LensFit } from './lensMath';
import type { SceneId } from './plates';

const KINDS: { id: string; kind: LensKind }[] = [
  { id: 'p-lens-single', kind: 'single' },
  { id: 'p-lens-progressive', kind: 'progressive' },
  { id: 'p-lens-screen', kind: 'screen' },
  { id: 'p-lens-photochromic', kind: 'photo' },
  { id: 'p-lens-sun-rx', kind: 'sun' },
];

const SHAPES: { id: FrameShape; key: 'rectangle' | 'square' | 'round' | 'panto' | 'aviator' | 'catEye'; height: number }[] = [
  { id: 'rectangle', key: 'rectangle', height: 0.7 },
  { id: 'square', key: 'square', height: 0.82 },
  { id: 'round', key: 'round', height: 0.95 },
  { id: 'panto', key: 'panto', height: 0.9 },
  { id: 'aviator', key: 'aviator', height: 0.88 },
  { id: 'cat-eye', key: 'catEye', height: 0.74 },
];

const SIZES: Record<string, { width: number; bridge: number }> = {
  '48': { width: 48, bridge: 18 },
  '52': { width: 52, bridge: 18 },
  '55': { width: 55, bridge: 17 },
};

/** Typical near addition and accommodation left per age group (D). */
const AGES = {
  young: { add: 0.75, acc: 3.5 },
  mid: { add: 1.5, acc: 1.25 },
  old: { add: 2.25, acc: 0.5 },
} as const;
type Age = keyof typeof AGES;

const SCENES: SceneId[] = ['street', 'drive', 'desk'];

const SPH_MIN = -10;
const SPH_MAX = 6;
/** Minus-cylinder form, as most prescriptions here are written. */
const CYL_MIN = -4;
/** A value along a slider: the thumb's centre stops half a thumb short of each end. */
const trackAt = (v: number, min: number, max: number) => `calc(12px + (100% - 24px) * ${(v - min) / (max - min)})`;
const sliderAt = (v: number) => trackAt(v, SPH_MIN, SPH_MAX);
/** The slider track, lit between two points along it. */
const trackFill = (from: string, to: string) =>
  ({ '--sim-track': `linear-gradient(to right, rgb(255 255 255 / 0.15) ${from}, var(--color-brand-200) ${from} ${to}, rgb(255 255 255 / 0.15) ${to})` }) as CSSProperties;
const RANGE =
  'h-11 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand-200 [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:[background:var(--sim-track)] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:[background:var(--sim-track)] [&::-webkit-slider-thumb]:-mt-[9px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-200 [&::-webkit-slider-thumb]:shadow-[0_0_0_5px_rgba(224,219,209,0.14)]';

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

const known = (s: Strength | undefined): KnownStrength => (s && s !== 'unknown' ? s : 'mid');

export function LensSimulator({ strength, onStrength, lenses }: { strength: Strength | undefined; onStrength: (s: KnownStrength) => void; lenses: Product[] }) {
  const t = useDict(SIM);
  const tl = useDict(LG);
  const ts = useDict(site);
  const settings = useSettings();
  const l = useL();
  const lang = useLang();
  const reduce = useReducedMotion();
  const addToCart = useUi((s) => s.addToCart);
  const setCartOpen = useUi((s) => s.setCartOpen);

  const [mode, setMode] = useState<'lens' | 'view'>('view');
  const [sph, setSph] = useState(() => -STRENGTH_POWER[known(strength)]);
  const [cylOpen, setCylOpen] = useState(false);
  const [cyl, setCyl] = useState(0);
  const [axis, setAxis] = useState(180);
  const [picked, setPicked] = useState<number | null>(null);
  const [packageId, setPackageId] = useState('p-lens-single');
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [shape, setShape] = useState<FrameShape>('rectangle');
  const [size, setSize] = useState('52');
  const [pd, setPd] = useState(63);
  const [heat, setHeat] = useState(false);
  const [scene, setScene] = useState<SceneId>('street');
  const [age, setAge] = useState<Age>('mid');
  const [withLens, setWithLens] = useState(true);
  const [zones, setZones] = useState(true);
  const [status, setStatus] = useState<'idle' | 'ready' | 'fallback'>('idle');
  const [painted, setPainted] = useState(false);
  const [askToStart, setAskToStart] = useState(false);
  const [touched, setTouched] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);

  // the hint goes on the first drag or after a few seconds; each view has its own
  useEffect(() => {
    setTouched(false);
    if (!painted) return;
    const id = window.setTimeout(() => setTouched(true), 7000);
    return () => clearTimeout(id);
  }, [mode, painted]);

  // The chooser below and these sliders speak about the same prescription. Its strength is the stronger meridian's, the
  // number that decides the index, so both recommend the same lens.
  const cylRef = useRef(cyl);
  cylRef.current = cyl;
  useEffect(() => {
    if (!strength || strength === 'unknown') return;
    setSph((cur) => {
      const c = cylRef.current;
      if (bandOf(strongestPower(cur, c)) === strength) return cur;
      const p = STRENGTH_POWER[strength];
      // on the minus side a cylinder adds to the sphere, so the sphere takes what is left of the band's power
      return cur > 0 ? p : clamp(-p - c, SPH_MIN, 0);
    });
  }, [strength]);
  const changeRx = (nextSph: number, nextCyl: number) => {
    setSph(nextSph);
    setCyl(nextCyl);
    const band = bandOf(strongestPower(nextSph, nextCyl));
    if (band !== strength) onStrength(band);
  };
  const changeSph = (v: number) => changeRx(clamp(Math.round(v * 4) / 4, SPH_MIN, SPH_MAX), cyl);
  // the comparison below redraws when the power crosses into another band: a dragged slider doesn't wait for that
  const shownStrength = useDeferredValue(strength);

  // the control that was pressed goes away with the panel, so the keyboard moves on to what took its place
  const cylSlider = useRef<HTMLInputElement>(null);
  const cylAdd = useRef<HTMLButtonElement>(null);
  const cylPressed = useRef(false);
  useEffect(() => {
    if (!cylPressed.current) return;
    cylPressed.current = false;
    (cylOpen ? cylSlider : cylAdd).current?.focus({ preventScroll: true });
  }, [cylOpen]);
  const reveal = {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: reduce ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] as const },
    // room for the ring around the panel and the focus ring, which the clipping would cut
    className: '-mx-1 -mb-1 overflow-hidden px-1 pb-1',
  };

  const packages = useMemo(() => KINDS.flatMap((k) => lenses.filter((p) => p.id === k.id).map((product) => ({ ...k, product }))), [lenses]);
  const pack = packages.find((p) => p.id === packageId) ?? packages[0];
  const product = pack?.product;
  const kind: LensKind = pack?.kind ?? 'single';
  const thin = useMemo(() => lenses.find((p) => p.id === THIN_ID), [lenses]);

  const extras = useMemo(() => (product ? product.options.filter((o) => o.id !== 'index') : []), [product]);
  const baseOptions = useMemo(() => {
    const out: Record<string, string> = {};
    for (const o of extras) out[o.id] = choices[`${product!.id}:${o.id}`] ?? o.values[0]?.id;
    return out;
  }, [extras, choices, product]);

  const indexOption = product?.options.find((o) => o.id === 'index');
  /** The product and options that buy a material in this package; null if it doesn't offer it. */
  const offerFor = (n: number) => {
    if (!product || !indexOption) return null;
    const value = indexOption.values.find((v) => indexOf(v.label) === n);
    if (value) return { product, options: { ...baseOptions, index: value.id } };
    if (product.id === 'p-lens-single' && thin && specIndex(thin) === n) return { product: thin, options: {} as Record<string, string> };
    return null;
  };

  // the stronger meridian decides: -3.00 with a -2.00 cylinder is a -5.00 lens one way
  const recommended = IDEAL_INDEX[bandOf(strongestPower(sph, cyl))];
  const wanted = picked ?? recommended;
  const offered = MATERIALS.filter((m) => offerFor(m.n));
  const selectedN = !indexOption || offerFor(wanted) ? wanted : (offered.filter((m) => m.n <= wanted).pop() ?? offered[0] ?? MATERIALS[0]).n;
  const offer = indexOption ? offerFor(selectedN) : product ? { product, options: baseOptions } : null;

  const sizeSpec = SIZES[size];
  const fit: LensFit = useMemo(() => {
    const height = SHAPES.find((s) => s.id === shape)?.height ?? 0.72;
    return { shape, lensWidth: sizeSpec.width, lensHeight: Math.round(sizeSpec.width * height), bridge: sizeSpec.bridge, pd };
  }, [shape, sizeSpec, pd]);

  // the right eye's lens: the 3D view puts its readings on that one
  const rows = useMemo(() => MATERIALS.map((m) => ({ m, stats: lensStats(rightEye(solveLens(sph, m.n, m.centre, fit, cyl, axis)), m.density) })), [sph, cyl, axis, fit]);
  const selected = rows.find((r) => Math.abs(r.m.n - selectedN) < 1e-6) ?? rows[0];
  const stats = selected.stats;
  const baseMax = rows[0].stats.max;

  const num = (v: number, digits = 1) => (lang === 'en' ? v.toFixed(digits) : v.toFixed(digits).replace('.', ','));
  const fmt = (n: number) => money(n, lang, { decimals: n % 1 !== 0 });
  const signed = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${num(Math.abs(v), 2)}`;
  const powerLabel = `${signed(sph)} D`;
  /** The whole prescription, for the order line and screen readers. */
  const rxLabel = cyl ? `${powerLabel} · CYL ${signed(cyl)} × ${axis}°` : powerLabel;

  // ---------------------------------------------------------------- the headline and a still come first, then the engine
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Simulator | null>(null);
  const labelsRef = useRef<LabelMap>({});
  const startRef = useRef(() => {});
  const tintValue = extras.find((o) => o.id === 'tint')?.values.find((v) => v.id === baseOptions.tint);
  const simState: SimState = useMemo(
    () => ({
      mode,
      sph,
      cyl,
      axis,
      n: selectedN,
      shape,
      lensWidth: fit.lensWidth,
      lensHeight: fit.lensHeight,
      bridge: fit.bridge,
      pd,
      heat,
      scene,
      kind,
      level: (baseOptions.level as ProgressiveLevel) ?? 'standard',
      add: AGES[age].add,
      acc: AGES[age].acc,
      tint: tintValue?.swatch ?? null,
      polar: baseOptions.polar === 'yes',
      withLens,
      zones,
    }),
    [mode, sph, cyl, axis, selectedN, shape, fit, pd, heat, scene, kind, baseOptions, age, tintValue, withLens, zones],
  );
  const stateRef = useRef(simState);
  stateRef.current = simState;
  const reduceRef = useRef(!!reduce);
  reduceRef.current = !!reduce;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;
    let sim: Simulator | null = null;
    const hasIdle = typeof requestIdleCallback === 'function';
    let idle = 0;
    let started = false;
    const start = () => {
      if (started || cancelled) return;
      started = true;
      if (!hasWebGL2()) {
        setStatus('fallback');
        return;
      }
      import('./engine')
        .then(({ createSimulator }) => {
          if (cancelled) return;
          sim = createSimulator(el, labelsRef.current, reduceRef.current, { onPainted: () => setPainted(true), onSceneFailed: () => setSceneFailed(true) });
          engineRef.current = sim;
          sim.update(stateRef.current);
          setStatus('ready');
        })
        .catch(() => setStatus('fallback'));
    };
    startRef.current = start;
    const begin = () => {
      // on Save-Data or 2G the engine waits to be asked for
      if (lightMode()) setAskToStart(true);
      else if (hasIdle) idle = requestIdleCallback(start, { timeout: 1200 });
      else idle = window.setTimeout(start, 200);
    };
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(
          ([e]) => {
            if (!e.isIntersecting) return;
            io?.disconnect();
            begin();
          },
          { rootMargin: '500px' },
        )
      : null;
    if (io) io.observe(el);
    else begin();
    return () => {
      cancelled = true;
      io?.disconnect();
      if (hasIdle) cancelIdleCallback(idle);
      else clearTimeout(idle);
      sim?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.update(simState);
  }, [simState]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: [-26, 0], ArrowRight: [26, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[e.key];
    if (!step) return;
    e.preventDefault();
    setTouched(true);
    engineRef.current?.nudge(step[0], step[1]);
  };

  const setLabel = (id: LabelId) => (el: HTMLElement | null) => {
    labelsRef.current[id] = el;
  };

  const add = () => {
    if (!offer) return;
    addToCart({ productId: offer.product.id, qty: 1, options: offer.options, installation: false });
    const opts = optionsLabel(offer.product, offer.options, lang);
    toast.success(tl('added'), {
      description: `${l(offer.product.name)}${opts ? ` · ${opts}` : ''} · ${fmt(unitPrice(offer.product, offer.options))}`,
      action: { label: tl('viewCart'), onClick: () => setCartOpen(true) },
    });
  };

  if (status === 'fallback') {
    return (
      <Reveal className="mt-10 sm:mt-12">
        <ThicknessCompare strength={shownStrength} onStrength={onStrength} />
      </Reveal>
    );
  }

  const know = TYPES.find((x) => x.id === product?.id)?.know;
  const showZones = mode === 'view' && withLens && kind === 'progressive' && zones;
  const ariaStage = mode === 'lens' ? t('aria3d', { power: rxLabel, index: selected.m.label, mm: num(stats.max) }) : t('ariaView', { power: rxLabel, scene: t(scene) });

  const orderBar = offer && (
    <div className="flex min-w-0 flex-col gap-x-5 gap-y-4 rounded-[28px] bg-white/[0.045] p-5 ring-1 ring-white/10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:px-6 lg:py-4">
      <div className="min-w-0 sm:min-w-[240px] sm:flex-1">
        <div className="text-[15px] font-bold leading-snug text-white">
          {l(offer.product.name)}
          {!l(offer.product.name).includes(materialOf(selectedN).label) && <span className="font-medium text-paper/60"> · {indexOption || specIndex(offer.product) ? materialOf(selectedN).label : t('askIndex')}</span>}
        </div>
        <div className="mt-1 text-[13px] font-medium text-paper/65">
          {rxLabel} · {num(stats.max)} mm · {num(stats.pairWeight, 0)} g
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div>
          <div className="text-[11.5px] font-medium text-paper/55">{t('pairPrice')}</div>
          <div className="display text-[30px] leading-none tabular-nums text-white">{fmt(unitPrice(offer.product, offer.options))}</div>
        </div>
        <Button onClick={add} icon={<ShoppingBag className="h-4 w-4" />}>
          {tl('addToCart')}
        </Button>
        <Button variant="outlineLight" onClick={() => openBooking('exam')} icon={<CalendarCheck className="h-4 w-4" />}>
          {tl('bookExam')}
        </Button>
      </div>
      {settings.demoBanner && <div className="basis-full text-[12px] font-medium text-paper/60">{ts('demoBanner')}</div>}
    </div>
  );

  return (
    <div className="mt-6 sm:mt-7">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6">
        {/* Stage */}
        <div className="min-w-0 space-y-3 lg:sticky lg:top-24">
          <div className="relative">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 sm:pointer-events-none sm:absolute sm:inset-x-3 sm:top-3 sm:z-10 sm:mb-0 [&>*]:pointer-events-auto">
              <div className="inline-flex rounded-full bg-black/50 p-1 backdrop-blur-md">
                <ChoiceGroup
                  ariaLabel={t('modesLabel')}
                  variant="pill"
                  tone="dark"
                  value={mode}
                  onChange={setMode}
                  className="flex gap-1"
                  options={[
                    { id: 'view' as const, label: t('modeView') },
                    { id: 'lens' as const, label: t('modeLens') },
                  ]}
                />
              </div>
              {mode === 'lens' ? (
                <Toggle on={heat} onClick={() => setHeat((v) => !v)} icon={<SlidersHorizontal className="h-4 w-4" />}>
                  {t('heat')}
                </Toggle>
              ) : (
                kind === 'progressive' && (
                  <Toggle on={zones} onClick={() => setZones((v) => !v)} icon={<Waypoints className="h-4 w-4" />}>
                    {t('zones')}
                  </Toggle>
                )
              )}
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[28px] bg-[#0a0a0b] ring-1 ring-white/10 sm:aspect-[3/2] lg:aspect-auto lg:h-[calc(100svh-22.5rem)] lg:max-h-[min(760px,56vw)] lg:min-h-[440px]">
              <div ref={hostRef} role="img" aria-label={ariaStage} tabIndex={0} onKeyDown={onKey} onPointerDown={() => setTouched(true)} className="absolute inset-0 rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-200" />
              {/* the same scene the engine opens on, without the lens: it fades into the live picture */}
              <img src={asset('/images/sim/street-poster.webp')} alt="" fetchPriority="high" className={cn('pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none', painted ? 'opacity-0' : 'opacity-100')} />
              {askToStart && !painted && status === 'idle' ? (
                <div className="absolute inset-0 grid place-items-center p-6 text-center">
                  <div>
                    <Button
                      onClick={() => {
                        setAskToStart(false);
                        startRef.current();
                      }}
                    >
                      {t('start')}
                    </Button>
                    <p className="mt-3 text-[12.5px] font-medium text-paper/85">{t('startNote')}</p>
                  </div>
                </div>
              ) : (
                !painted && !sceneFailed && <div className="late-in pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-[12px] font-medium text-paper/85 backdrop-blur-md">{t('loading')}</div>
              )}
              {sceneFailed && mode === 'view' && (
                <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-black/70 py-1.5 pl-4 pr-1.5 text-[13px] font-medium text-paper backdrop-blur-md" role="status">
                  {t('sceneFailed')}
                  <button
                    type="button"
                    onClick={() => {
                      setSceneFailed(false);
                      engineRef.current?.retryScenes();
                    }}
                    className="min-h-9 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                  >
                    {t('retry')}
                  </button>
                </div>
              )}
              <div ref={setLabel('busy')} style={{ opacity: 0 }} className={cn(!painted && 'hidden', 'pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-[12px] font-medium text-paper/85 backdrop-blur-md sm:top-20')} aria-hidden>
                {t('loading')}
              </div>

              {status === 'ready' && mode === 'lens' && (
                <>
                  <Marker bind={setLabel('centre')} label={t('centre')} value={`${num(stats.centre)} mm`} className="left-3 top-3" />
                  <Marker bind={setLabel('temporal')} label={t('temporal')} value={`${num(stats.temporal)} mm`} className="left-3 -top-12" />
                  <Marker bind={setLabel('nasal')} label={t('nasal')} value={`${num(stats.nasal)} mm`} className="-top-12 left-3" rootClassName="max-sm:hidden" />
                </>
              )}
              {status === 'ready' && showZones && (
                <>
                  <ZoneTag bind={setLabel('far')} label={t('zoneFar')} />
                  <ZoneTag bind={setLabel('mid')} label={t('zoneMid')} />
                  <ZoneTag bind={setLabel('near')} label={t('zoneNear')} />
                </>
              )}

              {mode === 'view' ? (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center gap-2 sm:bottom-4">
                  <div className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-medium text-paper/80 backdrop-blur-md transition-opacity duration-500 motion-reduce:transition-none', touched || !painted ? 'opacity-0' : 'opacity-100')}>
                    <Move3d className="h-3.5 w-3.5" aria-hidden /> {t('dragView')}
                  </div>
                  <div className="pointer-events-auto inline-flex rounded-full bg-black/55 p-1 ring-1 ring-white/15 backdrop-blur-md">
                    <ChoiceGroup
                      ariaLabel={t('compare')}
                      variant="pill"
                      tone="dark"
                      value={withLens ? 'with' : 'without'}
                      onChange={(v) => setWithLens(v === 'with')}
                      className="flex gap-1"
                      options={[
                        { id: 'without' as const, label: t('withoutLens'), className: 'min-h-12! whitespace-nowrap text-[14.5px]! max-sm:px-3! sm:px-5! sm:text-[15px]!', visual: <EyeOff className="h-4 w-4 max-[359px]:hidden" aria-hidden /> },
                        { id: 'with' as const, label: t('withLens'), className: 'min-h-12! whitespace-nowrap text-[14.5px]! max-sm:px-3! sm:px-5! sm:text-[15px]!', visual: <Glasses className="h-4 w-4 max-[359px]:hidden" aria-hidden /> },
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 sm:inset-x-4 sm:bottom-4">
                  <div className="min-w-0 space-y-2 sm:max-w-[58%]">
                    {heat && (
                      <div className="rounded-xl bg-black/55 px-3 py-2 backdrop-blur-md">
                        <div className="text-[11px] font-semibold text-paper/75">{t('legend')}</div>
                        <div className="mt-1.5 h-1.5 w-36 rounded-full bg-gradient-to-r from-[#3b2d16] via-[#ad9466] to-[#fff1cf]" />
                        <div className="mt-1 flex w-36 justify-between text-[11px] font-semibold tabular-nums text-paper">
                          <span>{num(stats.min)}</span>
                          <span>{num(stats.max)} mm</span>
                        </div>
                      </div>
                    )}
                    <div className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-medium text-paper/75 backdrop-blur-md transition-opacity duration-500 motion-reduce:transition-none', touched ? 'opacity-0' : 'opacity-100')}>
                      <Move3d className="h-3.5 w-3.5" aria-hidden /> {t('drag')}
                    </div>
                  </div>
                  <Profile fit={fit} sph={sph} cyl={cyl} axis={axis} n={selectedN} label={t('profile')} nose={t('nose')} temple={t('temple')} />
                </div>
              )}
            </div>
          </div>

          {mode === 'view' && (
            <ChoiceGroup
              ariaLabel={t('scene')}
              variant="pill"
              tone="dark"
              value={scene}
              onChange={(id) => {
                setSceneFailed(false);
                setScene(id);
              }}
              className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
              options={SCENES.map((id) => ({
                id,
                label: t(id),
                className: 'flex-col! gap-1! rounded-2xl! p-1! pb-1.5! text-center! text-[13px]! leading-tight sm:flex-row! sm:gap-2.5! sm:rounded-full! sm:p-1! sm:pr-4! sm:text-[14px]!',
                visual: <img src={asset(`/images/sim/${id}-t.webp`)} alt="" width={160} height={100} className="h-12 w-20 rounded-xl object-cover sm:h-9 sm:w-14 sm:rounded-full" />,
              }))}
            />
          )}
          {showZones && <p className="text-[12.5px] font-medium leading-snug text-paper/70">{t('zoneLegend')}</p>}
          <div className="max-lg:hidden">{orderBar}</div>
        </div>

        {/* Controls: three steps, in the order a visitor decides */}
        <div className="space-y-7 rounded-[28px] bg-white/[0.045] p-5 ring-1 ring-white/10 sm:p-6">
          <Step n={1} title={t('rx')} htmlFor="sim-sph">
            <div className="flex items-center justify-between gap-3">
              <StepButton label={t('less')} onClick={() => changeSph(sph - 0.25)} disabled={sph <= SPH_MIN}>
                <Minus className="h-4 w-4" />
              </StepButton>
              <output htmlFor="sim-sph" className="display whitespace-nowrap text-center text-[34px] leading-none tabular-nums text-white min-[360px]:text-[42px] sm:text-[46px]">
                {powerLabel}
              </output>
              <StepButton label={t('more')} onClick={() => changeSph(sph + 0.25)} disabled={sph >= SPH_MAX}>
                <Plus className="h-4 w-4" />
              </StepButton>
            </div>
            <input
              id="sim-sph"
              type="range"
              min={SPH_MIN}
              max={SPH_MAX}
              step={0.25}
              value={sph}
              onChange={(e) => changeSph(Number(e.target.value))}
              aria-valuetext={powerLabel}
              style={trackFill(sliderAt(Math.min(sph, 0)), sliderAt(Math.max(sph, 0)))}
              className={cn('mt-3', RANGE)}
            />
            <div className="relative h-4 text-[11.5px] font-semibold tabular-nums text-paper/55" aria-hidden>
              <span className="absolute left-0">−10</span>
              <span className="absolute -translate-x-1/2" style={{ left: sliderAt(0) }}>
                0
              </span>
              <span className="absolute right-0">+6</span>
            </div>
            <p className="mt-1.5 text-center text-[12.5px] font-medium text-paper/70">{sph < 0 ? t('rxMinus') : sph > 0 ? t('rxPlus') : t('rxZero')}</p>
            <AnimatePresence initial={false}>
            {cylOpen ? (
              <motion.div key="cyl" {...reveal}>
              <div className="mt-4 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-bold text-white">{t('astig')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      cylPressed.current = true;
                      setCylOpen(false);
                      changeRx(sph, 0);
                    }}
                    className="-my-2 min-h-11 rounded px-1 text-[12.5px] font-semibold text-brand-200 underline underline-offset-2 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-brand-200"
                  >
                    {t('cylRemove')}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <label htmlFor="sim-cyl" className="text-[12.5px] font-semibold text-paper/75">
                    {t('cyl')}
                  </label>
                  <output htmlFor="sim-cyl" className="text-[17px] font-bold tabular-nums text-white">
                    {signed(cyl)}
                  </output>
                </div>
                <input
                  ref={cylSlider}
                  id="sim-cyl"
                  type="range"
                  min={CYL_MIN}
                  max={0}
                  step={0.25}
                  value={cyl}
                  onChange={(e) => changeRx(sph, clamp(Math.round(Number(e.target.value) * 4) / 4, CYL_MIN, 0))}
                  aria-valuetext={`${signed(cyl)} D`}
                  style={trackFill(trackAt(cyl, CYL_MIN, 0), trackAt(0, CYL_MIN, 0))}
                  className={RANGE}
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <label htmlFor="sim-axis" className="text-[12.5px] font-semibold text-paper/75">
                    {t('axis')}
                  </label>
                  <span className="inline-flex items-center gap-2">
                    <AxisDial axis={axis} />
                    <output htmlFor="sim-axis" className="text-[17px] font-bold tabular-nums text-white">
                      {axis}°
                    </output>
                  </span>
                </div>
                <input
                  id="sim-axis"
                  type="range"
                  min={1}
                  max={180}
                  step={1}
                  value={axis}
                  onChange={(e) => setAxis(clamp(Math.round(Number(e.target.value)), 1, 180))}
                  aria-valuetext={`${axis}°`}
                  style={trackFill('0%', '0%')}
                  className={RANGE}
                />
                <p className="mt-1 text-[12px] font-medium leading-snug text-paper/60">{t('cylHint')}</p>
              </div>
              </motion.div>
            ) : (
              <motion.div key="add" {...reveal}>
              <div className="mt-3 text-center">
                <button
                  ref={cylAdd}
                  type="button"
                  onClick={() => {
                    cylPressed.current = true;
                    setCylOpen(true);
                    // a common cylinder to start from, so the change shows at once; the visitor then sets their own
                    changeRx(sph, -0.75);
                    setAxis(180);
                  }}
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-[22px] bg-white/5 px-4 py-2 text-left text-[13px] font-semibold leading-snug text-white/85 ring-1 ring-white/20 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-200 motion-reduce:transition-none"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden /> {t('cylAdd')}
                </button>
              </div>
              </motion.div>
            )}
            </AnimatePresence>
            <p className="mt-3 text-center text-[13px] font-medium text-paper/70">
              {t('noRx')}{' '}
              <button type="button" onClick={() => openBooking('exam')} className="rounded font-semibold text-brand-200 underline underline-offset-2 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-brand-200">
                {tl('bookExam')}
              </button>
            </p>
            {mode === 'view' && (
              <div className="mt-5">
                <Field label={t('age')}>
                  <ChoiceGroup
                    ariaLabel={t('age')}
                    variant="pill"
                    tone="dark"
                    value={age}
                    onChange={setAge}
                    className="flex flex-wrap gap-2"
                    options={[
                      { id: 'young' as const, label: t('ageYoung') },
                      { id: 'mid' as const, label: t('ageMid') },
                      { id: 'old' as const, label: t('ageOld') },
                    ]}
                  />
                </Field>
              </div>
            )}
          </Step>

          {packages.length > 0 && (
            <Step n={2} title={t('stepType')}>
              <div className="space-y-5">
                <ChoiceGroup
                  ariaLabel={t('stepType')}
                  variant="pill"
                  tone="dark"
                  value={pack?.id}
                  onChange={setPackageId}
                  className="flex flex-wrap gap-2"
                  options={packages.map((p) => ({ id: p.id, label: SHORT[p.id] ? l(SHORT[p.id]) : l(p.product.name) }))}
                />
                {extras.map((o) => (
                  <Field key={o.id} label={l(o.name)}>
                    <ChoiceGroup
                      ariaLabel={l(o.name)}
                      variant="pill"
                      tone="dark"
                      value={baseOptions[o.id]}
                      onChange={(id) => setChoices((c) => ({ ...c, [`${product!.id}:${o.id}`]: id }))}
                      className="flex flex-wrap gap-2"
                      options={o.values.map((v) => ({
                        id: v.id,
                        label: (
                          <span className="inline-flex items-center gap-2">
                            {v.swatch && <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/30" style={{ background: v.swatch }} aria-hidden />}
                            {l(v.label)}
                            {v.priceDelta ? <span className="font-medium opacity-70">+{fmt(v.priceDelta)}</span> : null}
                          </span>
                        ),
                      }))}
                    />
                  </Field>
                ))}
                {know && <p className="text-[13px] leading-relaxed text-paper/70">{l(know)}</p>}
              </div>
            </Step>
          )}

          <Step n={packages.length > 0 ? 3 : 2} title={t('material')}>
            <p className="mb-3.5 text-[12.5px] font-medium text-paper/65">{t('cardsNote')}</p>
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-3.5">
              {rows.map(({ m, stats: s }) => {
                const on = m.n === selected.m.n;
                const buy = offerFor(m.n);
                const unavailable = !!indexOption && !buy;
                const pct = Math.round((1 - s.max / baseMax) * 100);
                return (
                  <button
                    key={m.label}
                    type="button"
                    aria-pressed={on}
                    disabled={unavailable}
                    onClick={() => setPicked(m.n)}
                    className={cn(
                      'relative flex min-w-0 flex-col rounded-2xl p-3.5 text-left outline-none ring-1 transition-[background,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-brand-200 motion-reduce:transition-none',
                      on ? 'bg-white/[0.11] ring-2 ring-brand-300' : 'bg-white/[0.045] ring-white/10 enabled:hover:bg-white/[0.08]',
                      unavailable && 'opacity-55',
                    )}
                  >
                    <span className="display text-[26px] leading-none tabular-nums text-white">{m.label}</span>
                    {m.n === recommended && <span className="absolute -top-2 right-2.5 whitespace-nowrap rounded-full bg-brand-300 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink">{tl('recommended')}</span>}
                    <span className="mt-1 text-[12px] font-semibold text-paper/70">{l(m.name)}</span>
                    <span className="mt-2.5 text-[19px] font-bold tabular-nums text-white">
                      {num(s.max)} <span className="text-[12.5px] font-semibold text-paper/65">mm</span>
                    </span>
                    <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
                      <span className="block h-full origin-left rounded-full bg-brand-300 transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${clamp(s.max / baseMax, 0.04, 1)})` }} />
                    </span>
                    <span className="mb-auto mt-1.5 text-[11.5px] font-medium text-paper/70">{pct > 0 ? t('thinner', { pct }) : t('reference')}</span>
                    <span className="mt-2 flex items-baseline justify-between gap-2 border-t border-white/10 pt-2">
                      <span className="text-[12px] font-medium tabular-nums text-paper/65">{num(s.pairWeight, 0)} g</span>
                      <span className="text-[14px] font-bold tabular-nums text-brand-200">{buy ? fmt(unitPrice(buy.product, buy.options)) : ''}</span>
                    </span>
                    {unavailable && <span className="mt-1 text-[11.5px] font-semibold text-paper/75">{t('notOffered')}</span>}
                  </button>
                );
              })}
            </div>
            {stats.max > 9.5 && <p className="mt-3 text-[13px] font-semibold leading-snug text-brand-200">{t('tooThick')}</p>}
            {mode === 'lens' && (
              <details className="group mt-3.5 rounded-2xl bg-white/[0.035] ring-1 ring-white/10">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-[13.5px] font-semibold text-paper/85 outline-none focus-visible:ring-2 focus-visible:ring-brand-200 [&::-webkit-details-marker]:hidden">
                  {t('moreOptions')}
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="space-y-5 px-4 pb-4 pt-2">
                  <Field label={t('shape')}>
                    <ChoiceGroup ariaLabel={t('shape')} variant="pill" tone="dark" value={shape} onChange={setShape} className="flex flex-wrap gap-2" options={SHAPES.map((s) => ({ id: s.id, label: t(s.key) }))} />
                  </Field>
                  <Field label={t('size')}>
                    <ChoiceGroup ariaLabel={t('size')} variant="pill" tone="dark" value={size} onChange={setSize} className="flex gap-2" options={Object.keys(SIZES).map((id) => ({ id, label: <span className="tabular-nums">{id}</span> }))} />
                  </Field>
                  <Field label={t('pd')}>
                    <div className="flex items-center gap-2">
                      <StepButton label={t('pdLess')} onClick={() => setPd((v) => clamp(v - 1, 54, 74))} disabled={pd <= 54}>
                        <Minus className="h-4 w-4" />
                      </StepButton>
                      <span className="w-16 text-center text-[16px] font-bold tabular-nums text-white">{pd} mm</span>
                      <StepButton label={t('pdMore')} onClick={() => setPd((v) => clamp(v + 1, 54, 74))} disabled={pd >= 74}>
                        <Plus className="h-4 w-4" />
                      </StepButton>
                    </div>
                  </Field>
                </div>
              </details>
            )}
          </Step>
        </div>
        <div className="lg:hidden">{orderBar}</div>
      </div>

      <p className="mt-5 max-w-4xl text-[13px] leading-relaxed text-paper/60">{mode === 'lens' ? t('noteLens') : t('noteView')}</p>
    </div>
  );
}

function Step({ n, title, htmlFor, children }: { n: number; title: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="flex items-center gap-2.5 text-[15.5px] font-bold text-white">
        <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-300 text-[12.5px] font-bold text-ink">
          {n}
        </span>
        {htmlFor ? <label htmlFor={htmlFor}>{title}</label> : title}
      </h2>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-paper/60">{label}</div>
      {children}
    </div>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white ring-1 ring-white/15 transition enabled:hover:bg-white/15 disabled:opacity-35 motion-reduce:transition-none">
      {children}
    </button>
  );
}

function Toggle({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ring-1 transition-colors motion-reduce:transition-none', on ? 'bg-brand-300 text-ink ring-brand-300' : 'bg-white/5 text-white/85 ring-white/20 hover:bg-white/10')}
    >
      {icon}
      {children}
    </button>
  );
}

/** A point on the 3D lens; the engine moves it, this only draws the dot and the reading. */
function Marker({ bind, label, value, className, rootClassName }: { bind: (el: HTMLElement | null) => void; label: string; value: string; className: string; rootClassName?: string }) {
  return (
    <div ref={bind} style={{ visibility: 'hidden' }} className={cn('pointer-events-none absolute left-0 top-0 h-0 w-0 will-change-transform', rootClassName)} aria-hidden>
      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-white shadow-[0_0_0_1.5px_rgba(20,18,15,0.55),0_0_0_4px_rgba(255,255,255,0.22)]" />
      <span className={cn('absolute whitespace-nowrap rounded-lg bg-black/60 px-2 py-1 text-[11px] leading-tight text-paper/75 backdrop-blur-md', className)}>
        {label} <b className="block text-[13.5px] font-bold tabular-nums text-white">{value}</b>
      </span>
    </div>
  );
}

function ZoneTag({ bind, label }: { bind: (el: HTMLElement | null) => void; label: string }) {
  return (
    <div ref={bind} style={{ opacity: 0 }} className="pointer-events-none absolute left-0 top-0 h-0 w-0" aria-hidden>
      <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/55 px-2.5 py-0.5 text-[11.5px] font-bold text-paper backdrop-blur-md">{label}</span>
    </div>
  );
}

/** The axis as a prescription chart draws it, facing the wearer: 0° and 180° across, 90° upright. */
function AxisDial({ axis }: { axis: number }) {
  const a = (axis * Math.PI) / 180;
  const x = 9 * Math.cos(a);
  const y = 9 * Math.sin(a);
  return (
    <svg viewBox="-12 -12 24 24" className="h-6 w-6 text-brand-200" aria-hidden>
      <circle r="11" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
      <line x1={-x} y1={y} x2={x} y2={-y} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** True-to-scale horizontal section through the optical centre. */
function Profile({ fit, sph, cyl, axis, n, label, nose, temple }: { fit: LensFit; sph: number; cyl: number; axis: number; n: number; label: string; nose: string; temple: string }) {
  const gid = useId().replace(/:/g, '');
  const m = materialOf(n);
  const points = crossSection(solveLens(sph, n, m.centre, fit, cyl, axis));
  const scale = 3.2;
  const zTop = Math.max(...points.map((p) => p.front));
  const zBottom = Math.min(...points.map((p) => p.back));
  const x0 = points[0].x;
  const X = (x: number) => (x - x0) * scale + 2;
  const Y = (z: number) => (zTop - z) * scale + 2;
  const width = X(points[points.length - 1].x) + 2;
  const height = Y(zBottom) + 2;
  const d = `M ${points.map((p) => `${X(p.x).toFixed(1)} ${Y(p.front).toFixed(1)}`).join(' L ')} L ${[...points]
    .reverse()
    .map((p) => `${X(p.x).toFixed(1)} ${Y(p.back).toFixed(1)}`)
    .join(' L ')} Z`;
  return (
    <div className="hidden shrink-0 rounded-xl bg-black/55 px-3 py-2 backdrop-blur-md sm:block">
      <div className="text-[11px] font-semibold text-paper/75">{label}</div>
      <svg viewBox={`0 0 ${width.toFixed(1)} ${height.toFixed(1)}`} width={width} height={height} className="mt-1.5 block max-h-[92px] w-auto" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1cf" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ad9466" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <path d={d} fill={`url(#${gid})`} stroke="#fff1cf" strokeWidth="0.8" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between gap-6 text-[10.5px] font-medium text-paper/60">
        <span>{nose}</span>
        <span>{temple}</span>
      </div>
    </div>
  );
}
