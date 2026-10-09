import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Accent, Reveal } from '@/components/ui/misc';
import { ProductCard } from '@/site/components/ProductCard';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import { PD } from './dict';

/** Section heading + horizontally scrolling row of product cards. */
export function ProductRail({ eyebrow, title, products, action, className }: { eyebrow: string; title: string; products: Product[]; action?: ReactNode; className?: string }) {
  const t = useDict(PD);
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useEffect(update, [products.length]);

  const by = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  if (!products.length) return null;

  return (
    <section className={className}>
      <div className="container-x">
        <Reveal>
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="eyebrow mb-3">{eyebrow}</div>
              <h2 className="display text-[32px] leading-[1.05] text-ink sm:text-[44px]">
                <Accent text={title} />
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {action}
              <div className={cn('hidden gap-2 lg:flex', edges.start && edges.end && 'lg:hidden')}>
                <button type="button" onClick={() => by(-1)} disabled={edges.start} aria-label={t('prev')} className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-white transition hover:border-ink hover:bg-ink hover:text-white disabled:opacity-35">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => by(1)} disabled={edges.end} aria-label={t('next')} className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-white transition hover:border-ink hover:bg-ink hover:text-white disabled:opacity-35">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </Reveal>
        <div
          ref={ref}
          onScroll={update}
          className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:mt-10 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:gap-6 lg:px-0"
        >
          {products.map((p) => (
            <div key={p.id} className="w-[64%] shrink-0 snap-start sm:w-[40%] md:w-[31%] lg:w-[calc((100%-72px)/4)]">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
