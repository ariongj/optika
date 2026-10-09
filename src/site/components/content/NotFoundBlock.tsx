import type { ReactNode } from 'react';
import { Accent } from '@/components/ui/misc';

/** Friendly "not found" panel for unknown post / page slugs (renders inside the site layout). */
export function NotFoundBlock({ icon, eyebrow, title, text, actions, children }: { icon: ReactNode; eyebrow: string; title: string; text: string; actions: ReactNode; children?: ReactNode }) {
  return (
    <section className="container-x py-16 sm:py-24">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[36px] bg-white px-6 pb-12 pt-16 text-center ring-1 ring-line sm:px-14 sm:pb-16 sm:pt-24">
        <div className="bg-grain pointer-events-none absolute inset-0" />
        <div aria-hidden className="display pointer-events-none absolute inset-x-0 -top-8 select-none text-center text-[170px] leading-none text-sand/80 sm:-top-14 sm:text-[260px]">
          404
        </div>
        <div className="relative">
          <span className="mx-auto grid h-16 w-16 animate-pop place-items-center rounded-full bg-brand-600 text-white shadow-[0_18px_40px_-18px_var(--color-brand-700)]">{icon}</span>
          <div className="eyebrow mt-7">{eyebrow}</div>
          <h1 className="display mt-3 text-[36px] leading-[1.05] text-ink sm:text-[52px]">
            <Accent text={title} />
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-muted">{text}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
        </div>
        {children && <div className="relative mt-14 border-t border-line pt-10 text-left">{children}</div>}
      </div>
    </section>
  );
}
