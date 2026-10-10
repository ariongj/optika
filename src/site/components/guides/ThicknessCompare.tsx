import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { useDict, useL, useLang } from '@/i18n';
import { cn } from '@/lib/utils';
import { ChoiceGroup } from './ChoiceGroup';
import { LG } from './lensDict';
import { IDEAL_INDEX, INDICES, STRENGTHS, STRENGTH_POWER, type KnownStrength, type Strength } from './lensData';

/** px per mm — the drawing is to scale: a 50 mm lens is 380 px wide. */
const S = 7.6;
const HALF = 25; // half lens diameter (mm)
const FRONT_SAG = 1.6; // front-surface curve (mm), shape only
const X0 = 10;
const X1 = X0 + 2 * HALF * S;
const XM = (X0 + X1) / 2;
const TOP = 6;
const MIN_EDGE = 1.0; // plus lenses: thinnest edge (mm)

/** Lens thickness for a power at an index (thin-lens sag approximation, mm). */
function thickness(power: number, n: number, centre: number, sign: 'minus' | 'plus') {
  const sag = (HALF * HALF * Math.abs(power)) / (2000 * (n - 1));
  return sign === 'minus' ? { centre, edge: centre + sag, max: centre + sag } : { centre: MIN_EDGE + sag, edge: MIN_EDGE, max: MIN_EDGE + sag };
}

/** Cross-section path: front surface (convex), back surface parabola from centre to edge thickness. */
function lensPath(centre: number, edge: number) {
  const yE = TOP + FRONT_SAG * S;
  const yEdgeBack = yE + edge * S;
  const yCentreBack = TOP + centre * S;
  const f = (v: number) => v.toFixed(2);
  return `M ${f(X0)} ${f(yE)} Q ${f(XM)} ${f(2 * TOP - yE)} ${f(X1)} ${f(yE)} L ${f(X1)} ${f(yEdgeBack)} Q ${f(XM)} ${f(2 * yCentreBack - yEdgeBack)} ${f(X0)} ${f(yEdgeBack)} Z`;
}

/** Dimension marker at the thickest point (edge for minus, centre for plus). */
function markerPath(centre: number, edge: number, sign: 'minus' | 'plus') {
  const yE = TOP + FRONT_SAG * S;
  const f = (v: number) => v.toFixed(2);
  if (sign === 'minus') {
    const x = X1 + 9;
    const y1 = yE + edge * S;
    return `M ${f(x - 3)} ${f(yE)} L ${f(x + 3)} ${f(yE)} M ${f(x)} ${f(yE)} L ${f(x)} ${f(y1)} M ${f(x - 3)} ${f(y1)} L ${f(x + 3)} ${f(y1)}`;
  }
  const y1 = TOP + centre * S;
  return `M ${f(XM - 4)} ${f(TOP)} L ${f(XM + 4)} ${f(TOP)} M ${f(XM)} ${f(TOP)} L ${f(XM)} ${f(y1)} M ${f(XM - 4)} ${f(y1)} L ${f(XM + 4)} ${f(y1)}`;
}

export function ThicknessCompare({ strength, onStrength }: { strength: Strength | undefined; onStrength: (s: KnownStrength) => void }) {
  const t = useDict(LG);
  const l = useL();
  const lang = useLang();
  const reduce = useReducedMotion();
  const gid = useId().replace(/:/g, '');
  const [sign, setSign] = useState<'minus' | 'plus'>('minus');
  const band: KnownStrength = strength && strength !== 'unknown' ? strength : 'mid';
  const power = STRENGTH_POWER[band];
  const powerLabel = `${sign === 'minus' ? '−' : '+'}${lang === 'en' ? power.toFixed(2) : power.toFixed(2).replace('.', ',')} D`;
  const ideal = IDEAL_INDEX[band];
  const rows = INDICES.map((ix) => ({ ...ix, th: thickness(power, ix.n, ix.centre, sign) }));
  const base = rows[0].th.max;
  const mm1 = (v: number) => (lang === 'en' ? v.toFixed(1) : v.toFixed(1).replace('.', ','));
  const transition = { duration: reduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="rounded-[32px] bg-white p-5 ring-1 ring-line sm:p-8 lg:p-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div id="lg-power" className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
            {t('power')}
          </div>
          <ChoiceGroup
            labelledBy="lg-power"
            variant="pill"
            value={band}
            onChange={(v) => onStrength(v)}
            className="mt-3 flex flex-wrap gap-2"
            options={STRENGTHS.filter((s) => s.id !== 'unknown').map((s) => ({ id: s.id as KnownStrength, label: <span className="tabular-nums">{l(s.label)}</span> }))}
          />
        </div>
        <ChoiceGroup
          ariaLabel={`${t('minus')} / ${t('plus')}`}
          variant="pill"
          value={sign}
          onChange={setSign}
          className="flex flex-wrap gap-2"
          options={[
            { id: 'minus' as const, label: t('minus') },
            { id: 'plus' as const, label: t('plus') },
          ]}
        />
      </div>

      <div className="mt-8 flex items-baseline justify-between gap-4 border-b border-line pb-3 text-[12px] font-bold uppercase tracking-[0.16em] text-muted">
        <span>
          {t('power')}: <span className="tabular-nums text-ink">{powerLabel}</span>
        </span>
        <span>{sign === 'minus' ? t('edge') : t('centre')}</span>
      </div>

      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const rec = Math.abs(r.n - ideal) < 1e-6;
          const pct = Math.round((1 - r.th.max / base) * 100);
          return (
            <li key={r.label} className={cn('grid grid-cols-[64px_minmax(0,1fr)_76px] items-center gap-3 py-3.5 sm:grid-cols-[132px_minmax(0,1fr)_170px] sm:gap-6 sm:py-4', rec && 'relative')}>
              {rec && <span className="pointer-events-none absolute -inset-x-3 inset-y-1 -z-0 rounded-2xl bg-brand-100/60 ring-1 ring-brand-600/15 sm:-inset-x-4" aria-hidden />}
              <div className="relative">
                <div className="display text-[26px] leading-none text-ink tabular-nums sm:text-[32px]">{r.label}</div>
                <div className="mt-1 text-[11.5px] font-semibold leading-tight text-muted sm:text-[12.5px]">{l(r.name)}</div>
                {rec && (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-600 px-1 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white sm:px-2 sm:py-0.5">
                    <Check className="h-3 w-3 sm:hidden" strokeWidth={3} aria-hidden />
                    <span className="max-sm:sr-only">{t('recommended')}</span>
                  </div>
                )}
              </div>
              <svg viewBox={`0 0 ${X1 + 20} 76`} className="relative h-[52px] w-full overflow-visible sm:h-[84px]" role="img" aria-label={`${r.label}: ${mm1(r.th.max)} mm`}>
                <defs>
                  <linearGradient id={`${gid}-${r.label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#eef4f0" />
                    <stop offset="1" stopColor={rec ? '#acc8b9' : '#cfddd5'} />
                  </linearGradient>
                </defs>
                <motion.path
                  initial={false}
                  animate={{ d: lensPath(r.th.centre, r.th.edge) }}
                  transition={transition}
                  fill={`url(#${gid}-${r.label})`}
                  stroke="#2c4a3a"
                  strokeOpacity={rec ? 0.85 : 0.45}
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <motion.path initial={false} animate={{ d: markerPath(r.th.centre, r.th.edge, sign) }} transition={transition} stroke="#a4774c" strokeWidth="1.4" fill="none" />
              </svg>
              <div className="relative text-right">
                <div className="text-[18px] font-bold tabular-nums text-ink sm:text-[22px]">
                  {mm1(r.th.max)} <span className="text-[13px] font-semibold text-muted">mm</span>
                </div>
                <div className={cn('mt-0.5 text-[11.5px] font-semibold leading-tight sm:text-[12.5px]', pct > 0 ? 'text-brand-700' : 'text-muted')}>{pct > 0 ? t('vs150', { pct }) : '—'}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-muted">{t('thickNote', { power: powerLabel })}</p>
    </div>
  );
}
