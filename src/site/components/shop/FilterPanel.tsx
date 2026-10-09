import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Glasses, Percent, ShieldPlus, Sun } from 'lucide-react';
import type { Category } from '@/lib/types';
import { useDict, useL } from '@/i18n';
import { common } from '@/i18n/common';
import { cn } from '@/lib/utils';
import { T } from './dict';
import { PriceRange } from './PriceRange';
import { AVAILS, FAMILY_SWATCH, LIGHT_FAMILIES, type FacetData, type Feature, type Filters } from './filters';

function toggle<V>(list: V[], v: V) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

const FEATURE_ICON: Record<Feature, typeof Glasses> = { rx: Glasses, polarised: Sun, care: ShieldPlus };

function Section({ title, children, defaultOpen = true, aside }: { title: string; children: ReactNode; defaultOpen?: boolean; aside?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex flex-1 items-center justify-between gap-3 text-left">
          <span className="text-[14.5px] font-bold text-ink">{title}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform duration-300', open && 'rotate-180')} />
        </button>
        {aside}
      </div>
      <div className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="-mx-1.5 min-h-0 overflow-hidden px-1.5">
          <div className="pb-1 pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ checked, onChange, label, count, icon }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; count: number; icon?: ReactNode }) {
  const disabled = count === 0 && !checked;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center gap-3 rounded-lg py-[7px] text-left text-[14.5px] disabled:cursor-default disabled:opacity-40"
    >
      <span
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors',
          checked ? 'border-ink bg-ink text-paper' : 'border-ink/25 bg-white group-hover:border-ink/60',
        )}
      >
        <Check className={cn('h-3 w-3 transition-transform duration-200', checked ? 'scale-100' : 'scale-0')} strokeWidth={3.2} />
      </span>
      {icon && <span className="-mx-0.5 text-muted">{icon}</span>}
      <span className={cn('min-w-0 flex-1 truncate transition-colors', checked ? 'font-semibold text-ink' : 'text-ink-soft group-hover:text-ink')}>{label}</span>
      <span className={cn('text-[12.5px] tabular-nums', checked ? 'font-semibold text-ink' : 'text-muted')}>{count}</span>
    </button>
  );
}

function PillToggle({ on, disabled, onClick, children, count }: { on: boolean; disabled: boolean; onClick: () => void; children: ReactNode; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-all disabled:cursor-default disabled:opacity-40',
        on ? 'border-ink bg-ink font-semibold text-paper' : 'border-line bg-white text-ink-soft enabled:hover:border-ink/35 enabled:hover:text-ink',
      )}
    >
      {children}
      <span className={cn('text-[11.5px] tabular-nums', on ? 'text-paper/60' : 'text-muted')}>{count}</span>
    </button>
  );
}

export interface FilterPanelProps {
  filters: Filters;
  setFilters: (f: Filters) => void;
  sale: boolean;
  setSale: (v: boolean) => void;
  facets: FacetData;
  categories: Category[];
  /** Category facet is only offered on the all-products view */
  showCategories: boolean;
}

/** Shape label: dictionary for the known shapes, the product's own spec value otherwise. */
export function useShapeLabel() {
  const t = useDict(T);
  const l = useL();
  return (id: string, fallback?: Parameters<typeof l>[0]) => {
    const key = `shape_${id}` as Parameters<typeof t>[0];
    const v = t(key);
    return v === key ? l(fallback) || id : v;
  };
}

export function FilterPanel({ filters, setFilters, sale, setSale, facets, categories, showCategories }: FilterPanelProps) {
  const t = useDict(T);
  const tc = useDict(common);
  const l = useL();
  const shapeLabel = useShapeLabel();
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div>
      {showCategories && (
        <Section title={t('category')}>
          <div className="flex flex-col">
            {facets.cats.map(({ id, count }) => {
              const c = catById.get(id);
              if (!c) return null;
              return <CheckRow key={id} checked={filters.cats.includes(id)} onChange={() => set({ cats: toggle(filters.cats, id) })} label={l(c.name)} count={count} />;
            })}
          </div>
        </Section>
      )}

      <Section title={t('price')}>
        <PriceRange bounds={facets.bounds} value={filters.price} onChange={(price) => set({ price })} prices={facets.prices} />
        <p className="mt-3 text-[12px] leading-snug text-muted">{t('priceNote')}</p>
      </Section>

      <Section title={t('offer')}>
        <div className="flex flex-col">
          <CheckRow checked={sale} onChange={setSale} label={t('onSale')} count={facets.sale} icon={<Percent className="h-3.5 w-3.5 text-brand-600" />} />
        </div>
      </Section>

      {facets.shapes.length > 1 && (
        <Section title={t('shape')}>
          <div className="flex flex-wrap gap-2">
            {facets.shapes.map(({ id, label, count }) => {
              const on = filters.shapes.includes(id);
              return (
                <PillToggle key={id} on={on} disabled={count === 0 && !on} onClick={() => set({ shapes: toggle(filters.shapes, id) })} count={count}>
                  {shapeLabel(id, label)}
                </PillToggle>
              );
            })}
          </div>
        </Section>
      )}

      {facets.colors.length > 1 && (
        <Section title={t('colour')}>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map(({ id, count }) => {
              const on = filters.colors.includes(id);
              const disabled = count === 0 && !on;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => set({ colors: toggle(filters.colors, id) })}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full border bg-white py-1 pl-1.5 pr-3 text-[13px] transition-all disabled:cursor-default disabled:opacity-40',
                    on ? 'border-ink font-semibold text-ink shadow-[0_0_0_1px_var(--color-ink)]' : 'border-line text-ink-soft enabled:hover:border-ink/35 enabled:hover:text-ink',
                  )}
                >
                  <span className="relative h-6 w-6 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(28_26_23/0.12)]" style={{ background: FAMILY_SWATCH[id] }}>
                    {on && (
                      <span className={cn('absolute inset-0 grid place-items-center', LIGHT_FAMILIES.includes(id) ? 'text-ink' : 'text-white')}>
                        <Check className="h-3 w-3" strokeWidth={3.2} />
                      </span>
                    )}
                  </span>
                  {t(`c_${id}`)}
                  <span className="text-[11.5px] tabular-nums text-muted">{count}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {facets.feats.length > 0 && (
        <Section title={t('features')}>
          <div className="flex flex-col">
            {facets.feats.map(({ id, count }) => {
              const Icon = FEATURE_ICON[id];
              return (
                <CheckRow
                  key={id}
                  checked={filters.feats.includes(id)}
                  onChange={() => set({ feats: toggle(filters.feats, id) })}
                  label={t(`feat_${id}`)}
                  count={count}
                  icon={<Icon className="h-3.5 w-3.5" />}
                />
              );
            })}
          </div>
        </Section>
      )}

      {facets.badges.length > 0 && (
        <Section title={t('badges')}>
          <div className="flex flex-wrap gap-2">
            {facets.badges.map(({ id, count }) => {
              const on = filters.badges.includes(id);
              return (
                <PillToggle key={id} on={on} disabled={count === 0 && !on} onClick={() => set({ badges: toggle(filters.badges, id) })} count={count}>
                  {tc(`badge_${id}`)}
                </PillToggle>
              );
            })}
          </div>
        </Section>
      )}

      <Section title={t('availability')}>
        <div className="flex flex-col">
          {AVAILS.map((a) => (
            <CheckRow
              key={a}
              checked={filters.avail.includes(a)}
              onChange={() => set({ avail: toggle(filters.avail, a) })}
              label={
                <span className="inline-flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', a === 'stock' ? 'bg-emerald-500' : 'bg-amber-500')} />
                  {t(a === 'stock' ? 'inStock' : 'toOrder')}
                </span>
              }
              count={facets.avail[a]}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
