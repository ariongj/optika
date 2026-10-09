import { useMemo, useState } from 'react';
import { useDict, useLang } from '@/i18n';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { T } from './dict';
import { nicePrice, priceScale } from './filters';

const STEPS = 1000;
const BINS = 28;
const SIGMA = 0.85;

/* Two native range inputs stacked on one track. The inputs ignore pointer
   events; only their thumbs catch them, so both handles stay draggable. */
const THUMB = cn(
  'pointer-events-none absolute inset-0 m-0 h-6 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none',
  '[&::-webkit-slider-runnable-track]:h-6 [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[2px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-[0_1px_2px_rgb(0_0_0/0.18),0_0_0_1px_rgb(28_26_23/0.18),0_4px_10px_-2px_rgb(28_26_23/0.3)] [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:cursor-grabbing active:[&::-webkit-slider-thumb]:scale-110',
  'focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgb(28_26_23/0.25),0_0_0_6px_rgb(154_46_46/0.18)]',
  '[&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-[10px] [&::-moz-range-thumb]:w-[10px] [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[5px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-ink [&::-moz-range-thumb]:shadow-[0_0_0_1px_rgb(28_26_23/0.18),0_4px_10px_-2px_rgb(28_26_23/0.3)]',
);

/** Price filter: distribution histogram, dual-thumb slider and min/max inputs. */
export function PriceRange({
  bounds,
  value,
  onChange,
  prices,
}: {
  bounds: [number, number];
  value: [number, number] | null;
  onChange: (v: [number, number] | null) => void;
  prices: number[];
}) {
  const t = useDict(T);
  const lang = useLang();
  const [lo, hi] = bounds;
  const scale = useMemo(() => priceScale(lo, hi), [lo, hi]);
  const a = Math.min(Math.max(value?.[0] ?? lo, lo), hi);
  const b = Math.max(Math.min(value?.[1] ?? hi, hi), lo);
  const posA = Math.round(scale.toPos(a) * STEPS);
  const posB = Math.round(scale.toPos(b) * STEPS);

  const commit = (na: number, nb: number) => {
    const x = Math.max(lo, Math.min(na, nb));
    const y = Math.min(hi, Math.max(na, nb));
    onChange(x <= lo && y >= hi ? null : [x, y]);
  };

  const fromPos = (pos: number) => (pos <= 0 ? lo : pos >= STEPS ? hi : Math.min(hi, Math.max(lo, nicePrice(scale.toValue(pos / STEPS)))));

  // Smoothed distribution (each product spreads over neighbouring bars) so
  // a handful of products reads as soft hills rather than a barcode.
  const bins = useMemo(() => {
    const out = new Array<number>(BINS).fill(0);
    for (const p of prices) {
      const x = scale.toPos(p) * BINS;
      for (let i = 0; i < BINS; i++) {
        const d = i + 0.5 - x;
        out[i] += Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
      }
    }
    return out;
  }, [prices, scale]);
  const peak = Math.max(0.0001, ...bins);

  return (
    <div>
      {/* Histogram — bars inside the selection are dark, outside faded */}
      <div className="flex h-14 items-end gap-[2px] px-[10px]" aria-hidden>
        {bins.map((n, i) => {
          const mid = ((i + 0.5) / BINS) * STEPS;
          const inside = mid >= posA && mid <= posB;
          const r = n / peak;
          const empty = r < 0.04;
          return (
            <span
              key={i}
              className={cn('flex-1 rounded-t-[2px] transition-[background-color,height] duration-300', empty ? 'bg-ink/[0.07]' : inside ? 'bg-ink/65' : 'bg-ink/15')}
              style={{ height: empty ? '4%' : `${8 + r * 92}%` }}
            />
          );
        })}
      </div>

      {/* Track + thumbs */}
      <div className="relative h-6">
        <div className="absolute inset-x-[10px] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/12" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `calc(10px + (100% - 20px) * ${posA / STEPS})`, width: `calc((100% - 20px) * ${(posB - posA) / STEPS})` }}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={posA}
          aria-label={t('priceMin')}
          aria-valuetext={money(a, lang, { decimals: false })}
          onChange={(e) => commit(Math.min(fromPos(+e.target.value), b), b)}
          className={THUMB}
          style={{ zIndex: posA > STEPS - 40 ? 4 : 3 }}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={posB}
          aria-label={t('priceMax')}
          aria-valuetext={money(b, lang, { decimals: false })}
          onChange={(e) => commit(a, Math.max(fromPos(+e.target.value), a))}
          className={THUMB}
          style={{ zIndex: 3 }}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <PriceBox label={t('priceMin')} value={a} onCommit={(v) => commit(Math.min(v, b), b)} />
        <span className="h-px w-3 shrink-0 bg-ink/30" />
        <PriceBox label={t('priceMax')} value={b} onCommit={(v) => commit(a, Math.max(v, a))} />
      </div>
    </div>
  );
}

function PriceBox({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const done = () => {
    if (draft !== null) {
      const n = parseInt(draft, 10);
      if (!Number.isNaN(n)) onCommit(n);
    }
    setDraft(null);
  };
  return (
    <label className="min-w-0 flex-1 cursor-text rounded-xl border border-line bg-white px-3 py-1.5 transition-colors focus-within:border-ink/40 focus-within:ring-4 focus-within:ring-ink/5 hover:border-ink/25">
      <span className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <input
          inputMode="numeric"
          value={draft ?? String(Math.round(value))}
          onFocus={(e) => {
            setDraft(String(Math.round(value)));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
          onBlur={done}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-full min-w-0 bg-transparent text-[15px] font-semibold tabular-nums text-ink outline-none focus-visible:outline-none"
        />
        <span className="text-[13px] font-medium text-muted">€</span>
      </span>
    </label>
  );
}
