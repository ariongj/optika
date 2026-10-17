import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowDown, CalendarCheck, Move3d } from 'lucide-react';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import { scrollToId } from '@/site/components/company/data';
import { SG, type SGT } from './dict';
import { BOOK_SMART, KINDS, PHONE_FRAMING, POSTER, POSTER_M, type Kind } from './data';
import { Stage, preload3D } from './Stage';
import { Hud, type Callout, type HudHandle, type PartPoints } from './Hud';
import { Backdrop, LiveDot, useMedia } from './ui';

type T = SGT;

/** Segmented "Kamerë · Audio · Ekran" switch (sliding white pill). */
export function KindSwitch({ value, onChange, id, labels, className }: { value: Kind; onChange: (k: Kind) => void; id: string; labels: Record<Kind, string>; className?: string }) {
  const t = useDict(SG);
  return (
    <div role="radiogroup" aria-label={t('typeLabel')} className={cn('relative inline-flex rounded-full bg-white/[0.06] p-1 ring-1 ring-inset ring-white/12 backdrop-blur-md', className)}>
      {KINDS.map((k) => {
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(k)}
            className={cn('relative isolate h-10 rounded-full px-4 text-[13px] font-semibold transition-colors sm:px-5', on ? 'text-[#06110c]' : 'text-white/70 hover:text-white')}
          >
            {on && <motion.span layoutId={`sg-kind-${id}`} transition={{ type: 'spring', stiffness: 420, damping: 36 }} className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_0_24px_-4px_rgb(111_211_165/0.55)]" />}
            {labels[k]}
          </button>
        );
      })}
    </div>
  );
}

export const kindLabels = (t: T): Record<Kind, string> => ({ camera: t('v_camera'), audio: t('v_audio'), display: t('v_display') });

/** HUD callouts per kind (facts as in the catalogue: Gen 3 camera, Audio battery & weight, Display in-lens screen). */
function calloutsFor(kind: Kind, t: T): Callout[] {
  if (kind === 'audio')
    return [
      { part: 'hinge', label: t('hud_weight'), corner: 'tl' },
      { part: 'touch', label: t('hud_touch'), corner: 'tr' },
      { part: 'battery', label: t('hud_batt12'), corner: 'bl' },
      { part: 'speaker', label: t('hud_ear'), corner: 'br' },
    ];
  if (kind === 'display')
    return [
      { part: 'display', label: t('hud_display'), corner: 'tl' },
      { part: 'mics', label: t('hud_voice'), corner: 'tr' },
      { part: 'speaker', label: t('hud_ear'), corner: 'br' },
    ];
  return [
    { part: 'camera', label: t('hud_cam'), corner: 'tl' },
    { part: 'mics', label: t('hud_mic'), corner: 'tr' },
    { part: 'battery', label: t('hud_batt9'), corner: 'bl' },
    { part: 'speaker', label: t('hud_ear'), corner: 'br' },
  ];
}

/* ------------------------------------------------------------------ */
/* 1 — Hero: the 3D glasses, HUD callouts, headline, CTAs              */
/* ------------------------------------------------------------------ */
export function SmartHero() {
  const t = useDict(SG);
  const [kind, setKind] = useState<Kind>('camera');
  const hud = useRef<HudHandle>(null);
  const onParts = useCallback((pts: PartPoints) => hud.current?.update(pts), []);
  const callouts = useMemo(() => calloutsFor(kind, t), [kind, t]);
  const labels = kindLabels(t);
  const desktop = useMedia('(min-width: 1024px)');

  // fetch three.js early — the hero is the first thing on screen
  useEffect(() => {
    void preload3D();
  }, []);

  return (
    <section className="relative isolate overflow-hidden bg-[#07090a] text-white">
      <Backdrop glow="right" />
      {/* fade into the next (dark) section */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#07090a]" />

      <div className="container-x grid min-h-[100svh] content-center gap-y-7 pb-14 pt-[104px] sm:pt-[116px] lg:grid-cols-12 lg:gap-y-0 lg:pb-24 lg:pt-[96px]">
        {/* kicker + headline */}
        <div className="relative z-10 lg:col-span-6">
          <div className="sg-mono inline-flex animate-fade-up items-center gap-2.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] text-white/75 ring-1 ring-inset ring-white/10">
            <LiveDot /> {t('kicker')}
          </div>
          <h1 className="mt-6 animate-fade-up font-sans text-[44px] font-semibold leading-[1] tracking-[-0.045em] text-white [animation-delay:80ms] sm:text-[64px] lg:text-[68px] xl:text-[84px]">
            <HeadlineWords text={t('title')} />
          </h1>
        </div>

        {/* the 3D stage: in the flow on phones, the right half of the hero from lg */}
        <div className="relative -mx-4 sm:mx-auto sm:w-full sm:max-w-[560px] lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:w-[54%] lg:max-w-none xl:w-[56%]">
          <Stage
            poster={POSTER}
            posterMobile={POSTER_M}
            posterClassName="object-[84%_50%] max-lg:object-center"
            variant={kind}
            showDisplayHud={kind === 'display'}
            autoRotate
            interactive
            onParts={onParts}
            eager
            margin="20% 0px"
            framing={desktop ? undefined : PHONE_FRAMING}
            className="aspect-[5/4] w-full touch-pan-y lg:aspect-auto lg:h-full"
          >
            <Hud ref={hud} callouts={callouts} />
          </Stage>
          {/* switch + drag hint, under the model */}
          <div className="relative z-10 mt-1 flex flex-col items-center gap-3 px-4 lg:absolute lg:inset-x-0 lg:bottom-24 lg:mt-0">
            <KindSwitch id="hero" value={kind} onChange={setKind} labels={labels} />
            <span className="sg-mono hidden items-center gap-2 text-[10.5px] text-white/50 sm:inline-flex">
              <Move3d className="h-3.5 w-3.5" /> {t('drag')}
            </span>
          </div>
        </div>

        {/* copy + CTAs */}
        <div className="relative z-10 lg:col-start-1 lg:col-end-7 lg:mt-7 xl:col-end-6">
          <p className="max-w-[520px] animate-fade-up text-[16px] leading-relaxed text-white/65 [animation-delay:160ms] sm:text-[17.5px]">{t('text')}</p>
          <div className="mt-8 flex animate-fade-up flex-wrap items-center gap-3 [animation-delay:240ms]">
            <button
              type="button"
              onClick={() => scrollToId('modelet')}
              className="inline-flex h-13 items-center gap-2.5 rounded-full bg-[#6fd3a5] px-7 text-[15px] font-semibold text-[#06110c] shadow-[0_0_44px_-10px_rgb(111_211_165/0.75)] transition-[background,transform,box-shadow] duration-200 hover:bg-[#8fe2bd] hover:shadow-[0_0_54px_-8px_rgb(111_211_165/0.9)] active:scale-[0.98] max-sm:w-full max-sm:justify-center"
            >
              {t('ctaModels')} <ArrowDown className="h-4 w-4" />
            </button>
            <Link
              to={BOOK_SMART}
              className="inline-flex h-13 items-center gap-2.5 rounded-full bg-white/[0.06] px-7 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur-md transition-colors hover:bg-white/[0.11] max-sm:w-full max-sm:justify-center"
            >
              <CalendarCheck className="h-4 w-4 text-[#6fd3a5]" /> {t('ctaBook')}
            </Link>
          </div>
          {/* below xl: compact spec chips instead of the HUD labels */}
          <ul className="mt-7 flex flex-wrap gap-2 xl:hidden">
            {callouts.map((c) => (
              <li key={c.label} className="sg-mono rounded-md bg-white/[0.05] px-2.5 py-1.5 text-[10.5px] text-white/75 ring-1 ring-inset ring-white/10">
                {c.label}
              </li>
            ))}
          </ul>
          <p className="sg-mono mt-10 hidden text-[10.5px] leading-relaxed text-white/50 xl:block">Ray-Ban Meta · Oakley Meta · Meta Ray-Ban Display</p>
        </div>
      </div>

      {/* scroll cue */}
      <button
        type="button"
        onClick={() => scrollToId('specs')}
        className="sg-mono absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2.5 text-[10px] text-white/50 transition-colors hover:text-white/70 lg:flex"
      >
        {t('scroll')}
        <span className="relative block h-10 w-px overflow-hidden bg-white/10">
          <span className="sg-cue absolute inset-0 bg-[#6fd3a5]" />
        </span>
      </button>
    </section>
  );
}

/** The h1 with its accent word (kept inline so the line breaks naturally). */
function HeadlineWords({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*[^*]+\*)/g)
        .filter(Boolean)
        .map((p, i) =>
          p.startsWith('*') ? (
            <em key={i} className="sg-accent font-normal">
              {p.slice(1, -1)}
            </em>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
    </>
  );
}
