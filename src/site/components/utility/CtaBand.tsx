import type { ReactNode } from 'react';
import { Accent, Img } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

/** Dark, photo-backed call-to-action band used at the bottom of utility pages. */
export function CtaBand({
  eyebrow,
  title,
  text,
  image,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  image?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid overflow-hidden rounded-[28px] bg-ink md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]', className)}>
      {image && (
        <div className="relative min-h-[180px] overflow-hidden md:min-h-[300px]">
          <Img src={image} small alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent md:bg-gradient-to-r md:from-transparent md:to-ink/25" />
        </div>
      )}
      <div className={cn('bg-grain flex flex-col justify-center p-7 sm:p-10 lg:p-14', !image && 'md:col-span-2')}>
        {eyebrow && <div className="eyebrow text-brand-200">{eyebrow}</div>}
        <h2 className="display mt-3 max-w-xl text-[30px] leading-[1.06] text-white sm:text-[40px]">
          <Accent text={title} accentClassName="text-brand-200!" />
        </h2>
        {text && <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed text-paper/70">{text}</p>}
        {actions && <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{actions}</div>}
      </div>
    </div>
  );
}
