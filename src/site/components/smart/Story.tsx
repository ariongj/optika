import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useDict } from '@/i18n';
import type { SmartPart } from './three/SmartGlasses3D';
import { SG, type SGKey } from './dict';
import { POSTER, POSTER_M, STORY_PARTS } from './data';
import { Stage } from './Stage';
import { Hud, type HudHandle, type PartPoints } from './Hud';
import { Headline, Kicker, useMedia } from './ui';

const TITLE: Record<string, SGKey> = {
  camera: 'hs_camera',
  led: 'hs_led',
  speaker: 'hs_speaker',
  mics: 'hs_mics',
  touch: 'hs_touch',
  battery: 'hs_battery',
  display: 'hs_display',
};
const TEXT: Record<string, SGKey> = {
  camera: 'hs_cameraText',
  led: 'hs_ledText',
  speaker: 'hs_speakerText',
  mics: 'hs_micsText',
  touch: 'hs_touchText',
  battery: 'hs_batteryText',
  display: 'hs_displayText',
};
/** Mono tag per part (technical, the same in every language). */
const TAG: Partial<Record<SmartPart, string>> = {
  camera: '12 MP · 3K',
  mics: '×6',
  display: 'HUD',
};
/** The HUD label that follows the active part on the model. */
const HUD: Partial<Record<SmartPart, SGKey>> = {
  camera: 'hud_cam',
  speaker: 'hud_ear',
  mics: 'hud_mic',
  touch: 'hud_touch',
  battery: 'hud_batt9',
  display: 'hud_display',
};

/** The view each step turns to (radians): front three-quarter for the front parts, side-on for the temple. */
const YAW: Record<string, number> = {
  camera: -0.55,
  led: 0.55,
  speaker: -1.25,
  mics: -0.25,
  touch: -1.4,
  battery: -1.15,
  display: 0.2,
};

/** Scroll lengths, in screens: the opening (headline → the glasses open up), then one per part. */
const INTRO = 0.75;
const STEP = 0.95;

/** The model's place on the pinned screen: a little right of centre and above the step text (phones: higher). */
const DESKTOP_FRAMING = {
  fill: 0.58,
  fillHeight: 0.5,
  offsetX: 0.17,
  offsetY: 0.07,
};
const PHONE_FRAMING = {
  fill: 0.86,
  fillHeight: 0.42,
  offsetX: 0,
  offsetY: 0.16,
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ */
/* 3 — Scroll story, the way Apple stages a product: one pinned full-  */
/* screen scene, the scroll itself drives everything. The glasses open */
/* up, the camera flies in to each part and turns with the scroll, and  */
/* each part's text fades and sharpens in the same place.              */
/* ------------------------------------------------------------------ */
export function SmartStory() {
  const t = useDict(SG);
  const n = STORY_PARTS.length;
  const track = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const model = useRef<HTMLDivElement>(null);
  const texts = useRef<(HTMLLIElement | null)[]>([]);
  const rail = useRef<HTMLSpanElement>(null);
  const hud = useRef<HudHandle>(null);
  const desktop = useMedia('(min-width: 1024px)');
  const reduce = useReducedMotion();
  const onParts = useCallback((pts: PartPoints) => hud.current?.update(pts), []);
  /** what drives the 3D (rounded so React only re-renders on real changes): step k, progress u in it, intro s */
  const [view, setView] = useState({ k: 0, u: 0, s: 0 });

  useEffect(() => {
    let raf = 0;
    // "reduce motion": plain fades — no sliding, scaling or blur
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const update = () => {
      raf = 0;
      const el = track.current;
      const vh = screen.current?.clientHeight || window.innerHeight;
      if (!el) return;
      // s: screens scrolled since the scene pinned (0 … INTRO + n·STEP)
      const s = Math.min(INTRO + n * STEP, Math.max(0, -el.getBoundingClientRect().top / vh));
      const k = Math.min(n - 1, Math.max(0, Math.floor((s - INTRO) / STEP)));
      const u = s < INTRO ? 0 : clamp01((s - INTRO - k * STEP) / STEP);

      // Text is scrubbed straight from the scroll position (DOM writes, no React render per frame).
      // the product rises into place as the headline leaves (Apple-style), so the line is never over the glasses
      if (model.current) {
        const r = smooth(0, INTRO * 0.85, s);
        model.current.style.opacity = String(0.3 + 0.7 * r);
        if (!still) model.current.style.transform = `translate3d(0, ${(1 - r) * 22}%, 0) scale(${0.9 + 0.1 * r})`;
        else model.current.style.transform = 'none';
      }
      if (intro.current) {
        const o = 1 - smooth(0.12, INTRO * 0.8, s);
        intro.current.style.opacity = String(o);
        intro.current.style.transform = still ? 'none' : `translate3d(0, ${-s * 70}px, 0) scale(${1 - s * 0.05})`;
        intro.current.style.filter = !still && o < 0.98 ? `blur(${(1 - o) * 8}px)` : '';
      }
      texts.current.forEach((node, i) => {
        if (!node) return;
        const local = (s - INTRO - i * STEP) / STEP; // < 0 before its turn, 0 → 1 during it
        const last = i === n - 1;
        const fadeIn = smooth(-0.02, 0.22, local);
        const fadeOut = last ? 1 : 1 - smooth(0.76, 0.98, local);
        const o = fadeIn * fadeOut;
        const y = (1 - smooth(-0.02, 0.3, local)) * 56 - (last ? 0 : smooth(0.74, 1, local) * 40);
        node.style.opacity = String(o);
        node.style.transform = still ? 'none' : `translate3d(0, ${y}px, 0)`;
        node.style.filter = !still && o > 0.01 && o < 0.98 ? `blur(${(1 - o) * 10}px)` : '';
      });
      if (rail.current) rail.current.style.transform = `scaleX(${clamp01((s - INTRO) / (n * STEP))})`;

      setView((cur) => {
        const next = {
          k,
          u: Math.round(u * 40) / 40,
          s: Math.round(Math.min(s, INTRO) * 40) / 40,
        };
        return next.k === cur.k && next.u === cur.u && next.s === cur.s ? cur : next;
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    schedule(); // first measure in the next frame (no forced layout while the page mounts)
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [n]);

  // The 3D, from the scroll: assembled under the headline, opening as it fades; then per part the camera flies in
  // (closest mid-step), the model turns with the scroll, and at the very end the glasses close up a little.
  const { k, u, s } = view;
  const inIntro = s < INTRO;
  const part = STORY_PARTS[k];
  const last = k === n - 1;
  const drift = reduce ? 0 : u - 0.5;
  const exploded = inIntro ? smooth(0.2, INTRO, s) : last ? 1 - 0.55 * smooth(0.55, 1, u) : 1;
  const zoom = inIntro ? 0 : (0.26 + 0.52 * Math.sin(Math.PI * u)) * (last ? 1 - smooth(0.6, 1, u) : 1);
  const introYaw = reduce ? YAW[STORY_PARTS[0]] : -1.05 + (YAW[STORY_PARTS[0]] + 1.05) * smooth(0, INTRO, s);
  const rotation = useMemo(
    () =>
      inIntro
        ? { yaw: introYaw, pitch: 0.1 }
        : {
            yaw: (YAW[part] ?? -0.5) + drift * 0.8,
            pitch: 0.12 - drift * 0.18,
          },
    [inIntro, introYaw, part, drift],
  );
  const activePart = inIntro && s < INTRO * 0.6 ? null : part;
  const callouts = useMemo(
    () =>
      activePart
        ? [
            {
              part: activePart,
              label: HUD[activePart] ? t(HUD[activePart]) : 'LED',
              corner: 'tl' as const,
              tag: String(k + 1).padStart(2, '0'),
            },
          ]
        : [],
    [activePart, k, t],
  );

  return (
    <section id="brenda" className="relative bg-[#07090a] text-white">
      <div ref={track} className="relative" style={{ height: `${(INTRO + n * STEP + 1) * 100}svh` }}>
        <div ref={screen} className="sticky top-0 h-[100svh] overflow-hidden">
          {/* the glow builds as the camera moves in */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-[opacity,transform] duration-700 ease-out"
            style={{
              background: 'radial-gradient(ellipse 50% 45% at 55% 46%, rgb(111 211 165 / 0.2), transparent 70%)',
              opacity: 0.4 + zoom * 0.9,
              transform: `scale(${1 + zoom * 0.3})`,
            }}
          />
          <div
            ref={model}
            className="absolute inset-0 will-change-transform"
            style={{
              opacity: 0.3,
              transform: 'translate3d(0, 22%, 0) scale(0.9)',
            }}
          >
            <Stage
              poster={POSTER}
              posterMobile={POSTER_M}
              posterClassName="object-[70%_42%] max-lg:object-[50%_30%]"
              variant={part === 'display' && !inIntro ? 'display' : 'camera'}
              showDisplayHud={part === 'display' && !inIntro}
              exploded={exploded}
              spread={desktop ? 1.7 : 1.45}
              zoom={zoom}
              activePart={activePart}
              rotation={rotation}
              onParts={onParts}
              margin="10% 0px"
              framing={desktop ? DESKTOP_FRAMING : PHONE_FRAMING}
              className="absolute inset-0 h-full w-full"
            >
              <Hud ref={hud} callouts={callouts} />
              {/* a scan sweeps the model each time a new part comes up */}
              {!reduce && !inIntro && (
                <div key={k} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="sg-scan absolute inset-y-[10%] left-0 w-1/3">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#6fd3a5]/[0.06] to-[#6fd3a5]/[0.13]" />
                    <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#b5f0d3] to-transparent shadow-[0_0_18px_2px_rgb(111_211_165/0.6)]" />
                  </div>
                </div>
              )}
            </Stage>
          </div>

          {/* legibility: the text sits on a soft fade, never on bright metal */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#07090a] via-[#07090a]/75 to-transparent lg:h-[46%]"
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#07090a] to-transparent" />

          {/* opening: a big centred line over the assembled glasses */}
          <div ref={intro} className="container-x pointer-events-none absolute inset-x-0 top-[13svh] text-center will-change-transform lg:top-[11svh]">
            <Kicker n="02" className="justify-center">
              {t('storyEyebrow')}
            </Kicker>
            <Headline text={t('storyTitle')} className="mx-auto mt-5 max-w-4xl text-[40px] leading-[1.02] sm:text-[60px] lg:text-[80px] xl:text-[92px]" />
            <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/60 sm:text-[17px]">{t('storyText')}</p>
          </div>

          {/* the parts: stacked in one place, each scrubbed in and out by the scroll */}
          <div className="container-x absolute inset-x-0 bottom-[12svh] lg:bottom-[13svh]">
            <ol className="relative h-[200px] max-w-xl sm:h-[210px] lg:h-[250px]">
              {STORY_PARTS.map((sp, i) => {
                const num = String(i + 1).padStart(2, '0');
                return (
                  <li
                    key={sp}
                    ref={(el) => {
                      texts.current[i] = el;
                    }}
                    className="pointer-events-none absolute inset-x-0 bottom-0 will-change-transform"
                    style={{ opacity: 0 }}
                  >
                    {/* the step number, huge and outlined (decorative SVG) */}
                    <svg
                      aria-hidden
                      viewBox="0 0 320 170"
                      className="pointer-events-none -mb-3 -ml-2 h-[96px] w-[180px] select-none sm:h-[120px] sm:w-[226px] lg:h-[150px] lg:w-[282px]"
                    >
                      <text
                        x="0"
                        y="150"
                        fill="none"
                        stroke="#6fd3a5"
                        strokeOpacity="0.5"
                        strokeWidth="1.2"
                        fontSize="176"
                        fontWeight="600"
                        letterSpacing="-8"
                        style={{ fontFamily: 'var(--font-sans)' }}
                      >
                        {num}
                      </text>
                    </svg>
                    <div className="sg-mono flex items-center gap-3 text-[11px] text-white/55">
                      <span className="text-[#6fd3a5]">{num}</span>
                      <span aria-hidden className="h-px w-12 bg-[#6fd3a5]" />
                      {TAG[sp] && <span>{TAG[sp]}</span>}
                    </div>
                    <h3 className="mt-3 text-[30px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[40px] lg:text-[56px]">{t(TITLE[sp])}</h3>
                    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70 sm:text-[17px]">{t(TEXT[sp])}</p>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* progress (desktop: the right half, clear of the corner badge) */}
          <div className="container-x pointer-events-none absolute inset-x-0 bottom-[4svh]">
            <div className="sg-mono ml-auto flex items-center gap-3 text-[10.5px] text-white/55 lg:w-1/2">
              <span className="text-[#6fd3a5]">{String(k + 1).padStart(2, '0')}</span>
              <span className="relative h-px flex-1 bg-white/10">
                <span ref={rail} className="absolute inset-0 origin-left scale-x-0 bg-[#6fd3a5]" />
              </span>
              <span>{String(n).padStart(2, '0')}</span>
            </div>
          </div>

          {/* scroll cue during the opening */}
          <div
            aria-hidden
            className="sg-mono pointer-events-none absolute inset-x-0 bottom-[11svh] flex flex-col items-center gap-2.5 text-[10px] text-white/55 transition-opacity duration-500"
            style={{ opacity: s < 0.08 ? 1 : 0 }}
          >
            {t('scroll')}
            <span className="relative block h-10 w-px overflow-hidden bg-white/10">
              <span className="sg-cue absolute inset-0 bg-[#6fd3a5]" />
            </span>
          </div>
        </div>
      </div>
      <p className="container-x sg-mono pb-16 pt-4 text-[10.5px] text-white/50 sm:pb-20">{t('storyNote')}</p>
    </section>
  );
}
