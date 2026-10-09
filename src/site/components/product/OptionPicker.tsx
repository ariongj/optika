import { Check, Eye, Glasses, Layers, MonitorSmartphone, Sparkles, Sun, SunMedium, type LucideIcon } from 'lucide-react';
import type { ProductOption } from '@/lib/types';
import { useDict, useL, useLang } from '@/i18n';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PD } from './dict';
import { LENS_INFO, RX_LENS_VALUES } from './optical';

const delta = (v: number | undefined, lang: Parameters<typeof money>[1]) => {
  if (!v) return null;
  return `${v > 0 ? '+' : '−'}${money(Math.abs(v), lang, { decimals: v % 1 !== 0 })}`;
};

const LENS_ICON: Record<string, LucideIcon> = { frame: Glasses, single: Eye, screen: MonitorSmartphone, progressive: Layers, original: Sun, rx: SunMedium };

/** Swatch circles / button pills for every product option; the `lenses` option renders as lens cards. The selection drives the price. */
export function OptionPicker({ options, value, onChange }: { options: ProductOption[]; value: Record<string, string>; onChange: (optionId: string, valueId: string) => void }) {
  const l = useL();
  const lang = useLang();
  if (!options.length) return null;
  return (
    <div className="space-y-7">
      {options.map((o) => {
        const selected = o.values.find((v) => v.id === value[o.id]);
        const d = delta(selected?.priceDelta, lang);
        return (
          <fieldset key={o.id}>
            <legend className="mb-3 flex w-full flex-wrap items-baseline gap-x-1.5 text-[13.5px]">
              <span className="font-semibold text-ink-soft">{l(o.name)}:</span>
              <span className="font-semibold text-ink">{selected ? l(selected.label) : '—'}</span>
              {d && <span className={cn('text-[12.5px] font-semibold', (selected?.priceDelta ?? 0) > 0 ? 'text-brand-700' : 'text-emerald-700')}>({d})</span>}
            </legend>
            {o.id === 'lenses' ? (
              <LensCards option={o} value={value[o.id]} onChange={(v) => onChange(o.id, v)} />
            ) : o.type === 'swatch' ? (
              <div className="flex flex-wrap gap-x-3 gap-y-2">
                {o.values.map((v) => {
                  const on = v.id === value[o.id];
                  const vd = delta(v.priceDelta, lang);
                  const light = isLight(v.swatch);
                  return (
                    <div key={v.id} className="flex w-12 flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onChange(o.id, v.id)}
                        title={vd ? `${l(v.label)} · ${vd}` : l(v.label)}
                        aria-label={l(v.label)}
                        aria-pressed={on}
                        className={cn(
                          'relative grid h-11 w-11 place-items-center rounded-full ring-offset-[3px] ring-offset-paper transition-all duration-200',
                          on ? 'ring-2 ring-ink' : 'ring-1 ring-ink/15 hover:ring-ink/40',
                        )}
                        style={{ background: v.swatch }}
                      >
                        <span className="absolute inset-0 rounded-full shadow-[inset_0_-6px_12px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,0.25)]" />
                        <Check className={cn('relative h-4 w-4 transition-all duration-200', on ? 'scale-100 opacity-100' : 'scale-50 opacity-0', light ? 'text-ink' : 'text-white')} strokeWidth={3} />
                      </button>
                      {vd && <span className="text-[10.5px] font-semibold tabular-nums text-muted">{vd}</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {o.values.map((v) => {
                  const on = v.id === value[o.id];
                  const vd = delta(v.priceDelta, lang);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onChange(o.id, v.id)}
                      aria-pressed={on}
                      className={cn(
                        'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[13.5px] font-semibold transition-all duration-200',
                        on ? 'border-ink bg-ink text-paper shadow-[0_8px_18px_-10px_rgba(28,26,23,0.7)]' : 'border-line bg-white text-ink-soft hover:border-ink/35 hover:text-ink',
                      )}
                    >
                      {l(v.label)}
                      {vd && <span className={cn('text-[11.5px] font-semibold tabular-nums', on ? 'text-paper/65' : 'text-muted')}>{vd}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

/** The key upsell: one card per lens choice with its price difference and a one-line explanation. */
function LensCards({ option, value, onChange }: { option: ProductOption; value: string | undefined; onChange: (valueId: string) => void }) {
  const t = useDict(PD);
  const l = useL();
  const lang = useLang();
  const hasRx = option.values.some((v) => RX_LENS_VALUES.includes(v.id));
  return (
    <div>
      <div role="radiogroup" aria-label={l(option.name)} className="grid gap-2">
        {option.values.map((v) => {
          const on = v.id === value;
          const Icon = LENS_ICON[v.id] ?? Sparkles;
          const info = LENS_INFO[v.id];
          const vd = delta(v.priceDelta, lang);
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(v.id)}
              className={cn(
                'group relative flex items-center gap-3.5 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 sm:px-4',
                on ? 'border-ink bg-white shadow-[0_0_0_1px_var(--color-ink),0_14px_30px_-20px_rgba(28,26,23,0.55)]' : 'border-line bg-white/70 hover:border-ink/30 hover:bg-white',
              )}
            >
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors', on ? 'bg-ink text-paper' : 'bg-sand text-ink-soft group-hover:text-ink')}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-snug text-ink">{l(v.label)}</span>
                {info && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{l(info)}</span>}
              </span>
              <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', vd ? 'text-ink' : 'text-emerald-700')}>{vd ?? t('lensIncluded')}</span>
              <span
                aria-hidden
                className={cn(
                  'absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white shadow transition-all duration-200',
                  on ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3.2} />
              </span>
            </button>
          );
        })}
      </div>
      {hasRx && <p className="mt-2.5 text-[12.5px] leading-snug text-muted">{t('lensesHint')}</p>}
    </div>
  );
}

/** Rough luminance check so the tick on a swatch stays visible. */
function isLight(color?: string) {
  if (!color || !color.startsWith('#') || (color.length !== 7 && color.length !== 4)) return false;
  const hex = color.length === 4 ? color.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
