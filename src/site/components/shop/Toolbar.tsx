import type { ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, Columns3, Columns4, SlidersHorizontal, X } from 'lucide-react';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import { T } from './dict';
import { SORTS, type SortKey } from './filters';

const SORT_LABEL = { popular: 'sort_popular', new: 'sort_new', priceAsc: 'sort_priceAsc', priceDesc: 'sort_priceDesc', name: 'sort_name' } as const;

export interface Pill {
  key: string;
  label: ReactNode;
  onRemove: () => void;
  tone?: 'brand';
}

export function SortSelect({ value, onChange, className, compact }: { value: SortKey; onChange: (v: SortKey) => void; className?: string; compact?: boolean }) {
  const t = useDict(T);
  return (
    <label
      className={cn(
        'relative inline-flex h-11 min-w-0 cursor-pointer items-center rounded-full border border-line bg-white pl-4 pr-10 text-[14px] transition-colors focus-within:border-ink/40 focus-within:ring-4 focus-within:ring-ink/5 hover:border-ink/30',
        className,
      )}
    >
      <ArrowUpDown className="mr-2 h-4 w-4 shrink-0 text-muted" />
      <span className={cn('mr-1 shrink-0 text-muted', compact && 'sr-only')}>{t('sortBy')}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent font-semibold text-ink outline-none focus-visible:outline-none"
      >
        {SORTS.map((s) => (
          <option key={s.key} value={s.key}>
            {t(SORT_LABEL[s.key])}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 h-4 w-4 text-muted" />
    </label>
  );
}

export function DensityToggle({ value, onChange }: { value: 3 | 4; onChange: (v: 3 | 4) => void }) {
  const t = useDict(T);
  return (
    <div className="hidden h-11 items-center gap-0.5 rounded-full border border-line bg-white p-1 xl:flex" role="group" aria-label={t('view')}>
      {([3, 4] as const).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-pressed={value === n}
          title={t(n === 3 ? 'cols3' : 'cols4')}
          className={cn('grid h-[34px] w-[38px] place-items-center rounded-full transition-colors', value === n ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.05] hover:text-ink')}
        >
          {n === 3 ? <Columns3 className="h-4 w-4" /> : <Columns4 className="h-4 w-4" />}
          <span className="sr-only">{t(n === 3 ? 'cols3' : 'cols4')}</span>
        </button>
      ))}
    </div>
  );
}

export function FilterButton({ count, onClick, className }: { count: number; onClick: () => void; className?: string }) {
  const t = useDict(T);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper transition-colors hover:bg-ink-soft', className)}
    >
      <SlidersHorizontal className="h-4 w-4" />
      {t('filters')}
      {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">{count}</span>}
    </button>
  );
}

export function FilterPills({ pills, onClear, className }: { pills: Pill[]; onClear: () => void; className?: string }) {
  const t = useDict(T);
  if (!pills.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={p.onRemove}
          title={t('removeFilter')}
          className={cn(
            'group inline-flex h-8 animate-fade-in items-center gap-1.5 rounded-full pl-3 pr-2 text-[13px] font-semibold transition-colors',
            p.tone === 'brand' ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100' : 'bg-white text-ink ring-1 ring-inset ring-line hover:ring-ink/30',
          )}
        >
          {p.label}
          <span className={cn('grid h-5 w-5 place-items-center rounded-full transition-colors', p.tone === 'brand' ? 'group-hover:bg-brand-600 group-hover:text-white' : 'text-muted group-hover:bg-ink group-hover:text-paper')}>
            <X className="h-3 w-3" strokeWidth={2.6} />
          </span>
        </button>
      ))}
      <button type="button" onClick={onClear} className="ml-1 h-8 px-1 text-[13px] font-semibold text-ink underline decoration-ink/25 underline-offset-4 transition-colors hover:text-brand-700 hover:decoration-brand-600">
        {t('clearAll')}
      </button>
    </div>
  );
}
