import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Columns2, Copy, Download, Glasses, Info, Ruler, ScanFace, RotateCcw, Trash2, X } from 'lucide-react';
import type { Category, Product, ProductOption } from '@/lib/types';
import { Img } from '@/components/ui/misc';
import { useDict, useL, useLang } from '@/i18n';
import { basePrice, isOnSale } from '@/lib/pricing';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FrameDims } from './frames';
import { TRY } from './dict';

/* ------------------------------------------------------------------ */
/* Stage overlay card (permission, fallbacks, errors, photo prompt)     */
/* ------------------------------------------------------------------ */
export function StageCard({
  icon,
  title,
  text,
  detail,
  note,
  children,
  tone = 'default',
}: {
  icon: ReactNode;
  title: string;
  text?: ReactNode;
  /** Small technical detail under the friendly message (error name / message). */
  detail?: string | null;
  /** Extra note under the actions (e.g. the in-app browser hint). */
  note?: ReactNode;
  children?: ReactNode;
  tone?: 'default' | 'alert';
}) {
  const t = useDict(TRY);
  return (
    <div className="no-scrollbar absolute inset-0 z-10 flex overflow-y-auto p-3 pb-16 pt-16 sm:p-8 sm:pt-20">
      {/* m-auto centres the card but, unlike place-items, never pushes a tall card out of reach above the top */}
      <div className="m-auto w-full max-w-[380px] motion-safe:animate-fade-up rounded-3xl bg-ink/60 p-5 text-center text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/12 backdrop-blur-xl sm:p-8">
        <span className={cn('mx-auto grid h-11 w-11 place-items-center rounded-2xl sm:h-14 sm:w-14', tone === 'alert' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-brand-200')}>{icon}</span>
        <h3 className="display mt-3 text-[22px] leading-[1.12] sm:mt-5 sm:text-[28px]">{title}</h3>
        {text && <p className="mt-2 text-[13.5px] leading-relaxed text-white/70 sm:mt-2.5 sm:text-[14px]">{text}</p>}
        {detail && (
          <p className="mt-2 break-words font-mono text-[11px] leading-snug text-white/45">
            <span className="sr-only">{t('techDetail')}: </span>
            {detail}
          </p>
        )}
        {children && <div className="mt-4 flex flex-col gap-2 sm:mt-6 sm:gap-2.5">{children}</div>}
        {note}
      </div>
    </div>
  );
}

export const stageBtn = (primary?: boolean) =>
  cn(
    'inline-flex w-full items-center justify-center gap-2 rounded-full px-5 font-semibold transition active:scale-[0.98] disabled:opacity-60',
    primary ? 'h-12 bg-white text-[15px] text-ink hover:bg-sand' : 'h-11 border border-white/25 text-[14px] text-white hover:bg-white/10 sm:h-12 sm:text-[14.5px]',
  );

/** "Open in Safari / Chrome" hint for in-app browsers (Instagram, Facebook, TikTok…), with a copy-link button. */
export function InAppNote({ onCopy }: { onCopy: () => void }) {
  const t = useDict(TRY);
  return (
    <div className="mt-3 rounded-2xl bg-amber-300/12 p-3 text-left ring-1 ring-amber-200/25">
      <p className="flex gap-2 text-[12.5px] leading-snug text-amber-50/90">
        <Info className="mt-px h-4 w-4 shrink-0 text-amber-200" />
        <span>{t('inAppNote')}</span>
      </p>
      <button type="button" onClick={onCopy} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white/12 px-4 text-[13.5px] font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
        <Copy className="h-4 w-4" /> {t('copyLink')}
      </button>
    </div>
  );
}

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
        className="mt-1 h-10 w-full cursor-pointer accent-brand-600 disabled:cursor-not-allowed"
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

/** Colour picker. `compact` (phones): 30 px dots in 40 px tap targets, legend for screen readers only. */
export function ColorSwatches({ option, value, onChange, compact }: { option: ProductOption; value: string; onChange: (id: string) => void; compact?: boolean }) {
  const l = useL();
  const lang = useLang();
  const selected = option.values.find((v) => v.id === value);
  return (
    <fieldset className="min-w-0">
      <legend className={cn(compact ? 'sr-only' : 'mb-3 flex w-full flex-wrap items-baseline gap-x-1.5 text-[13.5px]')}>
        <span className="font-semibold text-ink-soft">{l(option.name)}:</span> <span className="font-semibold text-ink">{selected ? l(selected.label) : '—'}</span>
        {!!selected?.priceDelta && <span className="text-[12.5px] font-semibold text-brand-700"> (+{money(selected.priceDelta, lang, { decimals: false })})</span>}
      </legend>
      <div className={cn('flex flex-wrap', compact ? 'gap-0.5' : 'gap-3')}>
        {option.values.map((v) => {
          const on = v.id === value;
          const dot = (
            <>
              <span className="absolute inset-0 rounded-full shadow-[inset_0_-6px_12px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,0.25)]" />
              <Check className={cn('relative transition-all duration-200', compact ? 'h-3.5 w-3.5' : 'h-4 w-4', on ? 'scale-100 opacity-100' : 'scale-50 opacity-0', isLight(v.swatch) ? 'text-ink' : 'text-white')} strokeWidth={3} />
            </>
          );
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onChange(v.id)}
              aria-label={l(v.label)}
              aria-pressed={on}
              title={l(v.label)}
              className={cn(
                'relative grid place-items-center rounded-full transition-all duration-200',
                compact ? 'h-10 w-10' : cn('h-11 w-11 ring-offset-[3px] ring-offset-white', on ? 'ring-2 ring-ink' : 'ring-1 ring-ink/15 hover:ring-ink/40'),
              )}
              style={compact ? undefined : { background: v.swatch }}
            >
              {compact ? (
                <span
                  className={cn('relative grid h-[30px] w-[30px] place-items-center rounded-full ring-offset-2 ring-offset-paper transition-all', on ? 'ring-2 ring-ink' : 'ring-1 ring-ink/15')}
                  style={{ background: v.swatch }}
                >
                  {dot}
                </span>
              ) : (
                dot
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Frame picker (desktop grid)                                         */
/* ------------------------------------------------------------------ */
interface PickerProps {
  products: Product[];
  categories: Category[];
  filter: string;
  onFilter: (id: string) => void;
  value: string | undefined;
  onChange: (p: Product) => void;
}

export function FramePicker({ products, categories, filter, onFilter, value, onChange }: PickerProps) {
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
/* Frame strip (phones / tablets): filter chips + 64 px snap thumbnails  */
/* ------------------------------------------------------------------ */
export function FrameStrip({ products, categories, filter, onFilter, value, onChange }: PickerProps) {
  const t = useDict(TRY);
  const l = useL();
  const stripRef = useRef<HTMLDivElement>(null);
  const cats = categories.filter((c) => products.some((p) => p.categoryId === c.id));
  const shown = filter === 'all' ? products : products.filter((p) => p.categoryId === filter);

  // Keep the selected frame in view — scroll the strip only, never the page.
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !el) return;
    const target = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
  }, [value, filter]);

  const chip = (on: boolean) =>
    cn('inline-flex h-10 shrink-0 items-center rounded-full px-3.5 text-[12.5px] font-semibold transition', on ? 'bg-ink text-paper' : 'bg-white text-ink-soft ring-1 ring-line hover:text-ink');
  return (
    <section aria-label={t('chooseFrame')}>
      {cats.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <button type="button" className={chip(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => onFilter('all')}>
            {t('filterAll')} <span className={cn('ml-1.5 tabular-nums', filter === 'all' ? 'text-paper/60' : 'text-muted')}>{products.length}</span>
          </button>
          {cats.map((c) => (
            <button key={c.id} type="button" className={chip(filter === c.id)} aria-pressed={filter === c.id} onClick={() => onFilter(c.id)}>
              {l(c.name)}
            </button>
          ))}
        </div>
      )}
      <div ref={stripRef} className="no-scrollbar relative -mx-4 mt-2.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-1 pt-1 sm:-mx-6 sm:scroll-px-6 sm:px-6">
        {shown.map((p) => {
          const on = p.id === value;
          const name = l(p.name);
          return (
            <button key={p.id} type="button" onClick={() => onChange(p)} aria-pressed={on} aria-label={name} title={name} className="group w-[68px] shrink-0 snap-start text-center">
              <span
                className={cn(
                  'relative mx-auto block h-16 w-16 overflow-hidden rounded-2xl bg-sand ring-offset-2 ring-offset-paper transition',
                  on ? 'ring-2 ring-ink' : 'ring-1 ring-line group-hover:ring-ink/25',
                )}
              >
                <Img src={p.images[0]} small alt="" className="h-full w-full scale-[1.18] object-cover" />
              </span>
              <span className={cn('mt-1.5 block truncate text-[12px] leading-tight', on ? 'font-bold text-ink' : 'font-medium text-ink-soft')}>{name.split(' ')[0]}</span>
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

interface CompareProps {
  captures: Capture[];
  onDownload: (c: Capture) => void;
  onCompare: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function CompareTray({ captures, onDownload, onCompare, onRemove, onClear }: CompareProps) {
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

/** Phones: one compact row — label, two thumbnails (tap to download), compare + clear. */
export function CompareStrip({ captures, onDownload, onCompare, onClear }: CompareProps) {
  const t = useDict(TRY);
  if (!captures.length) return null;
  const round = 'grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95';
  return (
    <div className="motion-safe:animate-fade-up flex items-center gap-2.5 rounded-2xl bg-white p-2 pl-3 ring-1 ring-line">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <Columns2 className="h-4 w-4 shrink-0 text-brand-600" /> <span className="truncate">{t('compareTitle')}</span>
          <span className="font-semibold tabular-nums text-muted">{captures.length}/2</span>
        </div>
        {captures.length < 2 && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">{t('compareHint')}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {captures.map((c) => (
          <button key={c.id} type="button" onClick={() => onDownload(c)} aria-label={`${t('download')}: ${c.label} · ${c.sub}`} className="h-12 w-10 overflow-hidden rounded-lg bg-ink ring-1 ring-line">
            <img src={c.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {captures.length === 2 && (
        <button type="button" onClick={onCompare} aria-label={t('compareDownload')} title={t('compareDownload')} className={cn(round, 'bg-ink text-paper')}>
          <Download className="h-4 w-4" />
        </button>
      )}
      <button type="button" onClick={onClear} aria-label={t('compareClear')} title={t('compareClear')} className={cn(round, 'text-ink-soft ring-1 ring-line hover:text-ink')}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card wrapper for the fit / view controls (desktop)                   */
/* ------------------------------------------------------------------ */
export function ControlCard({ title, onReset, resetLabel, children }: { title: string; onReset?: () => void; resetLabel?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-line sm:px-6 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{title}</span>
        {onReset && <ResetButton onClick={onReset} label={resetLabel} />}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function ResetButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="-mr-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted transition hover:bg-ink/[0.05] hover:text-ink">
      <RotateCcw className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Disclosure rows (phones: secondary controls and notes, closed)       */
/* ------------------------------------------------------------------ */
export function Disclosure({ icon, title, sub, children }: { icon: ReactNode; title: string; sub?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper text-brand-600 ring-1 ring-line">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold leading-tight text-ink">{title}</span>
          {sub && <span className="mt-0.5 block truncate text-[12px] text-muted">{sub}</span>}
        </span>
        <ChevronDown className={cn('h-[18px] w-[18px] shrink-0 text-ink-soft transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <div id={id} hidden={!open} className="pb-4">
        {open && children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Measurements + how it works (shared by the desktop panel and phones) */
/* ------------------------------------------------------------------ */
export function MeasureTiles({ dims }: { dims: FrameDims }) {
  const t = useDict(TRY);
  return (
    <dl className="grid grid-cols-4 gap-2 text-center">
      {(
        [
          ['mWidth', dims.frameWidth],
          ['mLens', dims.lensWidth],
          ['mBridge', dims.bridgeWidth],
          ['mTemple', dims.templeLength],
        ] as const
      ).map(([key, value]) => (
        <div key={key} className="rounded-2xl bg-paper px-1 py-2.5">
          <dt className="text-[11px] font-semibold text-muted">{t(key)}</dt>
          <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">
            {value}
            <span className="ml-0.5 text-[11px] font-semibold text-muted">mm</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const TRY_STEPS = [
  { icon: ScanFace, title: 'step1Title', text: 'step1' },
  { icon: Glasses, title: 'step2Title', text: 'step2' },
  { icon: Ruler, title: 'step3Title', text: 'step3' },
] as const;

/** Compact numbered steps for the phone disclosure. */
export function StepsList() {
  const t = useDict(TRY);
  return (
    <ol className="space-y-3">
      {TRY_STEPS.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="flex gap-3">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <Icon className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-paper text-[10px] font-bold text-brand-700 ring-1 ring-line">{i + 1}</span>
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-ink">{t(title)}</div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{t(text)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
