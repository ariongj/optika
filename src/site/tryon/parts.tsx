import type { ReactNode } from 'react';
import { Check, Columns2, Download, RotateCcw, Trash2, X } from 'lucide-react';
import type { Category, Product, ProductOption } from '@/lib/types';
import { Img } from '@/components/ui/misc';
import { useDict, useL, useLang } from '@/i18n';
import { basePrice, isOnSale } from '@/lib/pricing';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TRY } from './dict';

/* ------------------------------------------------------------------ */
/* Stage overlay card (permission, fallbacks, errors, photo prompt)     */
/* ------------------------------------------------------------------ */
export function StageCard({ icon, title, text, children, tone = 'default' }: { icon: ReactNode; title: string; text?: ReactNode; children?: ReactNode; tone?: 'default' | 'alert' }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center p-4 pt-16 sm:p-8 sm:pt-20">
      <div className="w-full max-w-[380px] motion-safe:animate-fade-up rounded-3xl bg-ink/55 p-6 text-center text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/12 backdrop-blur-xl sm:p-8">
        <span className={cn('mx-auto grid h-14 w-14 place-items-center rounded-2xl', tone === 'alert' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-brand-200')}>{icon}</span>
        <h3 className="display mt-5 text-[25px] leading-[1.1] sm:text-[28px]">{title}</h3>
        {text && <p className="mt-2.5 text-[14px] leading-relaxed text-white/70">{text}</p>}
        {children && <div className="mt-6 flex flex-col gap-2.5">{children}</div>}
      </div>
    </div>
  );
}

export const stageBtn = (primary?: boolean) =>
  cn(
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[14.5px] font-semibold transition active:scale-[0.98] disabled:opacity-60',
    primary ? 'bg-white text-ink hover:bg-sand' : 'border border-white/25 text-white hover:bg-white/10',
  );

/** Round translucent icon button for the stage's bottom bar. */
export function StageIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-md transition hover:bg-black/60 active:scale-95"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Range field                                                         */
/* ------------------------------------------------------------------ */
export function RangeField({ label, value, display, min, max, step = 1, onChange, disabled }: { label: string; value: number; display: string; min: number; max: number; step?: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={cn('block min-w-0', disabled && 'opacity-45')}>
      <span className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-semibold text-ink-soft">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-9 w-full cursor-pointer accent-brand-600 disabled:cursor-not-allowed"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Colour swatches                                                     */
/* ------------------------------------------------------------------ */
const isLight = (hex?: string) => {
  const m = /^#?([\da-f]{6})$/i.exec(hex ?? '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 170;
};

export function ColorSwatches({ option, value, onChange }: { option: ProductOption; value: string; onChange: (id: string) => void }) {
  const l = useL();
  const lang = useLang();
  const selected = option.values.find((v) => v.id === value);
  return (
    <fieldset>
      <legend className="mb-3 flex w-full flex-wrap items-baseline gap-x-1.5 text-[13.5px]">
        <span className="font-semibold text-ink-soft">{l(option.name)}:</span>
        <span className="font-semibold text-ink">{selected ? l(selected.label) : '—'}</span>
        {!!selected?.priceDelta && <span className="text-[12.5px] font-semibold text-brand-700">(+{money(selected.priceDelta, lang, { decimals: false })})</span>}
      </legend>
      <div className="flex flex-wrap gap-3">
        {option.values.map((v) => {
          const on = v.id === value;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onChange(v.id)}
              aria-label={l(v.label)}
              aria-pressed={on}
              title={l(v.label)}
              className={cn('relative grid h-11 w-11 place-items-center rounded-full ring-offset-[3px] ring-offset-white transition-all duration-200', on ? 'ring-2 ring-ink' : 'ring-1 ring-ink/15 hover:ring-ink/40')}
              style={{ background: v.swatch }}
            >
              <span className="absolute inset-0 rounded-full shadow-[inset_0_-6px_12px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,0.25)]" />
              <Check className={cn('relative h-4 w-4 transition-all duration-200', on ? 'scale-100 opacity-100' : 'scale-50 opacity-0', isLight(v.swatch) ? 'text-ink' : 'text-white')} strokeWidth={3} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Frame picker                                                        */
/* ------------------------------------------------------------------ */
export function FramePicker({
  products,
  categories,
  filter,
  onFilter,
  value,
  onChange,
}: {
  products: Product[];
  categories: Category[];
  filter: string;
  onFilter: (id: string) => void;
  value: string | undefined;
  onChange: (p: Product) => void;
}) {
  const t = useDict(TRY);
  const l = useL();
  const lang = useLang();
  const cats = categories.filter((c) => products.some((p) => p.categoryId === c.id));
  const shown = filter === 'all' ? products : products.filter((p) => p.categoryId === filter);
  const pill = (on: boolean) =>
    cn('inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold transition', on ? 'bg-ink text-paper' : 'border border-line bg-white text-ink-soft hover:border-ink/30 hover:text-ink');
  return (
    <section aria-labelledby="tryon-frames">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="eyebrow">{t('framesCount', { n: products.length })}</div>
          <h2 id="tryon-frames" className="display mt-1.5 text-[28px] leading-tight text-ink sm:text-[32px]">
            {t('chooseFrame')}
          </h2>
        </div>
        {cats.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <button type="button" className={pill(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => onFilter('all')}>
              {t('filterAll')}
            </button>
            {cats.map((c) => (
              <button key={c.id} type="button" className={pill(filter === c.id)} aria-pressed={filter === c.id} onClick={() => onFilter(c.id)}>
                {l(c.name)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0 md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-6">
        {shown.map((p) => {
          const on = p.id === value;
          const price = basePrice(p);
          return (
            <button key={p.id} type="button" onClick={() => onChange(p)} aria-pressed={on} className="group w-[128px] shrink-0 snap-start text-left md:w-auto">
              <span className={cn('relative block aspect-square overflow-hidden rounded-2xl bg-sand ring-2 ring-offset-2 ring-offset-paper transition', on ? 'ring-ink' : 'ring-transparent group-hover:ring-ink/15')}>
                <Img src={p.images[0]} small alt="" className="h-full w-full scale-[1.12] object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.18]" />
                {on && (
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-paper">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="mt-2 block truncate text-[13.5px] font-semibold text-ink">{l(p.name)}</span>
              <span className="flex items-baseline gap-1.5 text-[12.5px] tabular-nums">
                <span className={cn('font-semibold', isOnSale(p) ? 'text-brand-700' : 'text-muted')}>{money(price, lang, { decimals: price % 1 !== 0 })}</span>
                {isOnSale(p) && <span className="text-muted/80 line-through">{money(p.price, lang, { decimals: false })}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compare tray (last two captures)                                     */
/* ------------------------------------------------------------------ */
export interface Capture {
  id: string;
  url: string;
  label: string;
  sub: string;
  width: number;
  height: number;
}

export function CompareTray({ captures, onDownload, onCompare, onRemove, onClear }: { captures: Capture[]; onDownload: (c: Capture) => void; onCompare: () => void; onRemove: (id: string) => void; onClear: () => void }) {
  const t = useDict(TRY);
  if (!captures.length) return null;
  return (
    <div className="motion-safe:animate-fade-up rounded-3xl bg-white p-4 ring-1 ring-line sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-brand-700">
            <Columns2 className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-bold text-ink">{t('compareTitle')}</span>
          <span className="text-[13px] font-semibold tabular-nums text-muted">{captures.length}/2</span>
        </div>
        <div className="flex gap-2">
          {captures.length === 2 && (
            <button type="button" onClick={onCompare} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-paper transition hover:bg-ink-soft">
              <Download className="h-3.5 w-3.5" /> {t('compareDownload')}
            </button>
          )}
          <button type="button" onClick={onClear} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-ink-soft transition hover:border-ink/30 hover:text-ink">
            <Trash2 className="h-3.5 w-3.5" /> {t('compareClear')}
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 items-start gap-3">
        {[0, 1].map((i) => {
          const c = captures[i];
          const ratio = `${captures[0].width} / ${captures[0].height}`;
          if (!c)
            return (
              <div key={i} style={{ aspectRatio: ratio }} className="grid place-items-center rounded-2xl border border-dashed border-line bg-paper p-4 text-center text-[12.5px] leading-snug text-muted">
                {t('compareHint')}
              </div>
            );
          // The product + colour caption is baked into the PNG itself.
          return (
            <figure key={c.id} className="group relative overflow-hidden rounded-2xl bg-ink">
              <img src={c.url} alt={`${c.label} · ${c.sub}`} style={{ aspectRatio: `${c.width} / ${c.height}` }} className="block h-auto w-full" />
              <div className="absolute right-2 top-2 flex gap-1.5">
                <button type="button" onClick={() => onDownload(c)} aria-label={t('download')} title={t('download')} className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70">
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onRemove(c.id)} aria-label={t('compareClear')} title={t('compareClear')} className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card wrapper for the fit / view controls                             */
/* ------------------------------------------------------------------ */
export function ControlCard({ title, onReset, resetLabel, children }: { title: string; onReset?: () => void; resetLabel?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-line sm:px-6 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{title}</span>
        {onReset && (
          <button type="button" onClick={onReset} className="-mr-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted transition hover:bg-ink/[0.05] hover:text-ink">
            <RotateCcw className="h-3.5 w-3.5" /> {resetLabel}
          </button>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
