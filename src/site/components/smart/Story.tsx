import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import type { SmartPart } from './three/SmartGlasses3D';
import { SG, type SGKey } from './dict';
import { PHONE_FRAMING, POSTER, POSTER_M, STORY_PARTS } from './data';
import { Stage } from './Stage';
import { Hud, type HudHandle, type PartPoints } from './Hud';
import { Headline, Kicker, useMedia } from './ui';

const TITLE: Record<string, SGKey> = {
  camera: 'hs_camera', led: 'hs_led', speaker: 'hs_speaker', mics: 'hs_mics', touch: 'hs_touch', battery: 'hs_battery', display: 'hs_display',
};
const TEXT: Record<string, SGKey> = {
  camera: 'hs_cameraText', led: 'hs_ledText', speaker: 'hs_speakerText', mics: 'hs_micsText', touch: 'hs_touchText', battery: 'hs_batteryText', display: 'hs_displayText',
};
/** Mono tag per part (technical, the same in every language). */
const TAG: Partial<Record<SmartPart, string>> = { camera: '12 MP · 3K', mics: '×6', display: 'HUD' };
/** The HUD label that follows the active part on the model. */
const HUD: Partial<Record<SmartPart, SGKey>> = { camera: 'hud_cam', speaker: 'hud_ear', mics: 'hud_mic', touch: 'hud_touch', battery: 'hud_batt9', display: 'hud_display' };

/** Track progress (0 = its top at the top of the screen, 1 = its bottom at the bottom) → how far the parts are apart. */
function explodeAt(p: number) {
  if (p <= 0.1) return p / 0.1;
  if (p <= 0.9) return 1;
  return 1 - ((p - 0.9) / 0.1) * 0.6;
}

/** The view each step turns to (radians): front three-quarter for the front parts, side-on for the temple. */
const YAW: Record<string, number> = { camera: -0.55, led: 0.55, speaker: -1.25, mics: -0.25, touch: -1.4, battery: -1.15, display: 0.2 };

/* ------------------------------------------------------------------ */
/* 3 — Scroll story: the model stays pinned (CSS sticky — no JS        */
/* pinning) and opens up as you scroll, one part at a time.            */
/* ------------------------------------------------------------------ */
export function SmartStory() {
  const t = useDict(SG);
  const track = useRef<HTMLDivElement>(null);
  const steps = useRef<(HTMLLIElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [exploded, setExploded] = useState(0);
  const hud = useRef<HudHandle>(null);
  const desktop = useMedia('(min-width: 1024px)');
  const onParts = useCallback((pts: PartPoints) => hud.current?.update(pts), []);

  // scroll → exploded: opens over the first step, closes a little at the end (each step turns the model to its part).
  // Measured only on scroll/resize (a motion `useScroll` target re-measured offsets every frame, forcing a layout
  // each time the HUD moved).
  const n = STORY_PARTS.length;
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : r.top <= 0 ? 1 : 0;
      setExploded(Math.round(explodeAt(p) * 50) / 50);
      // back above the steps (scrolling up past the heading): start again from the first part
      if (p <= 0.02) setActive(0);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  // the step crossing the reading line is the active one (a band near the middle of what's visible)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: desktop ? '-48% 0px -48% 0px' : '-68% 0px -30% 0px' },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [desktop]);

  const part = STORY_PARTS[active];
  // the engine eases between the views itself
  const rotation = useMemo(() => ({ yaw: YAW[part] ?? -0.5, pitch: 0.12 }), [part]);
  const callouts = useMemo(
    () => [{ part, label: HUD[part] ? t(HUD[part]) : 'LED', corner: 'tl' as const, tag: String(active + 1).padStart(2, '0') }],
    [part, active, t],
  );

  return (
    <section id="brenda" className="relative isolate bg-[#07090a] text-white">
      {/* desktop: the heading sits in the left column, so the pinned model is already beside it (no empty screen) */}
      <div ref={track} className="container-x relative lg:grid lg:grid-cols-12 lg:gap-x-10">
        <div className="max-w-3xl pb-6 pt-6 sm:pt-10 lg:col-start-1 lg:col-end-6 lg:row-start-1 lg:pb-0 lg:pt-[18svh]">
          <Kicker n="02">{t('storyEyebrow')}</Kicker>
          <Headline text={t('storyTitle')} className="mt-5 text-[36px] leading-[1.04] sm:text-[52px] lg:text-[54px] xl:text-[58px]" />
          <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/55 sm:text-[16.5px]">{t('storyText')}</p>
          <div aria-hidden className="sg-mono mt-10 hidden items-center gap-3 text-[10.5px] text-white/50 lg:flex">
            <span className="relative block h-10 w-px overflow-hidden bg-white/10">
              <span className="sg-cue absolute inset-0 bg-[#6fd3a5]" />
            </span>
            {t('scroll')}
          </div>
        </div>

        {/* the pinned model */}
        <div className="sticky top-[76px] z-20 -mx-4 bg-[#07090a] sm:-mx-6 lg:col-start-6 lg:col-end-13 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:h-[100svh] lg:self-start lg:bg-transparent lg:top-0">
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block" style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 52%, rgb(111 211 165 / 0.13), transparent 70%)' }} />
          <Stage
            poster={POSTER}
            posterMobile={POSTER_M}
            posterClassName="object-[84%_50%] max-lg:object-center"
            variant={part === 'display' ? 'display' : 'camera'}
            showDisplayHud={part === 'display'}
            exploded={exploded}
            activePart={part}
            rotation={rotation}
            onParts={onParts}
            margin="10% 0px"
            framing={desktop ? undefined : PHONE_FRAMING}
            className="h-[40svh] w-full sm:h-[46svh] lg:h-full"
          >
            <Hud ref={hud} callouts={callouts} />
          </Stage>
          {/* progress readout */}
          <div className="sg-mono pointer-events-none absolute bottom-3 left-4 right-4 flex items-center gap-3 text-[10.5px] text-white/50 sm:left-6 sm:right-6 lg:bottom-10 lg:left-0 lg:right-0">
            <span className="text-[#6fd3a5]">{String(active + 1).padStart(2, '0')}</span>
            <span className="relative h-px flex-1 bg-white/10">
              <span className="absolute inset-y-0 left-0 bg-[#6fd3a5] transition-[width] duration-500" style={{ width: `${((active + 1) / n) * 100}%` }} />
            </span>
            <span>{String(n).padStart(2, '0')}</span>
          </div>
          {/* phones: the steps slide under the pinned model */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-10 bg-gradient-to-b from-[#07090a] to-transparent lg:hidden" />
        </div>

        {/* the steps */}
        <ol className="relative z-10 pb-[18svh] lg:col-start-1 lg:col-end-6 lg:row-start-2 lg:pb-[30svh] lg:pt-[8svh]">
          {STORY_PARTS.map((p, i) => (
            <li
              key={p}
              ref={(el) => {
                steps.current[i] = el;
              }}
              data-i={i}
              className="flex min-h-[54svh] items-end pb-6 lg:min-h-[78svh] lg:items-center lg:pb-0"
            >
              {/* inactive steps recede by colour, not opacity, so their text stays readable (contrast ≥ 4.5:1) */}
              <div
                className={cn(
                  'w-full rounded-[24px] border p-6 transition-[border-color,background-color] duration-500 sm:p-7 lg:border-0 lg:bg-transparent lg:p-0',
                  i === active ? 'border-[#6fd3a5]/30 bg-white/[0.045]' : 'border-white/[0.07] bg-white/[0.02]',
                )}
              >
                <div className="sg-mono flex items-center gap-3 text-[11px] text-white/50">
                  <span className={i === active ? 'text-[#6fd3a5]' : ''}>{String(i + 1).padStart(2, '0')}</span>
                  <span aria-hidden className={cn('h-px transition-[width,background-color] duration-500', i === active ? 'w-10 bg-[#6fd3a5]' : 'w-5 bg-white/20')} />
                  {TAG[p] && <span>{TAG[p]}</span>}
                </div>
                <h3 className={cn('mt-4 text-[24px] font-semibold leading-tight tracking-[-0.025em] transition-colors duration-500 sm:text-[30px] lg:text-[34px]', i === active ? 'text-white' : 'text-white/50')}>
                  {t(TITLE[p])}
                </h3>
                <p className={cn('mt-3 max-w-md text-[15px] leading-relaxed transition-colors duration-500 sm:text-[16px]', i === active ? 'text-white/70' : 'text-white/50')}>{t(TEXT[p])}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="container-x sg-mono pb-16 text-[10.5px] text-white/50 sm:pb-20">{t('storyNote')}</p>
    </section>
  );
}
