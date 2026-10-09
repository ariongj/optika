import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Img } from '@/components/ui/misc';
import { defineDict, useDict, useL, useLang } from '@/i18n';
import { useActiveProducts, useCategories } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { pluralOne } from './shared';

const T = defineDict({
  me: { one: '{n} proizvod', many: '{n} proizvoda' },
  sq: { one: '{n} produkt', many: '{n} produkte' },
  en: { one: '{n} product', many: '{n} products' },
});

/**
 * Category links with photos.
 * - `tile`: tall photo cards with a serif name (search "no results" / start state)
 * - `compact`: white cards with a thumbnail, name and tagline (404 page)
 */
export function CategoryTiles({ variant = 'tile', limit, className }: { variant?: 'tile' | 'compact'; limit?: number; className?: string }) {
  const t = useDict(T);
  const l = useL();
  const lang = useLang();
  const cats = useCategories();
  const products = useActiveProducts();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1);
    return m;
  }, [products]);
  const list = limit ? cats.slice(0, limit) : cats;
  const count = (id: string) => {
    const n = counts.get(id) ?? 0;
    return t(pluralOne(n, lang) ? 'one' : 'many', { n });
  };

  if (variant === 'compact') {
    return (
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {list.map((c) => (
          <Link
            key={c.id}
            to={`/produktet/${c.slug}`}
            className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-2.5 pr-4 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_18px_40px_-24px_rgba(28,26,23,0.35)]"
          >
            <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-sand">
              <Img src={c.image} small alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-bold text-ink">{l(c.name)}</span>
              <span className="mt-0.5 block truncate text-[13px] text-muted">{l(c.tagline)}</span>
              <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted/80">{count(c.id)}</span>
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink-soft transition-colors duration-300 group-hover:border-ink group-hover:bg-ink group-hover:text-white">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6', className)}>
      {list.map((c) => (
        <Link key={c.id} to={`/produktet/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-ink sm:rounded-3xl">
          <Img src={c.image} small alt={l(c.name)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.07]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
          <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow-sm transition-all duration-300 group-hover:opacity-100 max-md:hidden">
            <ArrowUpRight className="h-4 w-4" />
          </span>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <h3 className="display text-[24px] leading-none text-white sm:text-[28px]">{l(c.name)}</h3>
            <p className="mt-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/65">{count(c.id)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
