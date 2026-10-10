import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Crosshair, Gauge, Layers, Scissors } from 'lucide-react';
import { Img, Reveal } from '@/components/ui/misc';
import { SectionHeading } from '@/site/components/SectionHeading';
import { pad2 } from '@/site/components/company/data';
import { LB } from '@/site/components/group/labDict';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';

const STEPS = [
  { title: 'p1t', text: 'p1', key: 'p1k', icon: ClipboardList, image: '/images/s/b2b.webp' },
  { title: 'p2t', text: 'p2', key: 'p2k', icon: Layers, image: '/images/s/lab-polish.webp' },
  { title: 'p3t', text: 'p3', key: 'p3k', icon: Crosshair, image: '/images/s/lab-blank.webp' },
  { title: 'p4t', text: 'p4', key: 'p4k', icon: Scissors, image: '/images/s/lab-laser.webp' },
  { title: 'p5t', text: 'p5', key: 'p5k', icon: Gauge, image: '/images/s/laboratori.webp' },
] as const;

/**
 * The lab process as a numbered timeline. On desktop a sticky photo follows the step in the middle of the
 * viewport; on mobile every step carries its own photo.
 */
export function LabProcess({ id }: { id?: string }) {
  const t = useDict(LB);
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const step = STEPS[active];
  const ActiveIcon = step.icon;

  return (
    <section id={id} className="scroll-mt-24 py-24 sm:py-32">
      <div className="container-x">
        <Reveal>
          <SectionHeading eyebrow={t('procEyebrow')} title={t('procTitle')} subtitle={t('procText')} />
        </Reveal>
        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          {/* Sticky photo (desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <div className="relative aspect-[4/5] max-h-[calc(100vh-9rem)] w-full overflow-hidden rounded-[32px] bg-ink">
                {STEPS.map((s, i) => (
                  <Img key={s.image} src={s.image} alt="" className={cn('absolute inset-0 h-full w-full object-cover duration-[900ms]!', i === active ? 'scale-100' : 'scale-[1.04] opacity-0!')} />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-7">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur">
                      <ActiveIcon className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-paper/75">{t('stepOf', { n: active + 1, total: STEPS.length })}</span>
                  </div>
                  <div className="display mt-3 text-[30px] leading-tight text-white">{t(step.title)}</div>
                  <div className="mt-5 grid grid-cols-5 gap-1.5">
                    {STEPS.map((s, i) => (
                      <span key={s.title} className={cn('h-1 rounded-full transition-colors duration-500', i <= active ? 'bg-brand-200' : 'bg-white/20')} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <ol className="relative">
            <span aria-hidden className="absolute bottom-6 left-[27px] top-6 w-px bg-line" />
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const on = i <= active;
              return (
                <li
                  key={s.title}
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  data-step={i}
                  className="relative grid grid-cols-[56px_minmax(0,1fr)] gap-5 pb-12 last:pb-0 sm:gap-7 lg:min-h-[300px] lg:pb-0"
                >
                  <span
                    className={cn(
                      'display relative z-10 grid h-14 w-14 place-items-center rounded-full text-[19px] ring-1 transition-colors duration-500',
                      on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink ring-line',
                    )}
                  >
                    {pad2(i + 1)}
                  </span>
                  <Reveal className="pt-1.5">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
                      <Icon className="h-3.5 w-3.5 text-brand-600" /> {t(s.key)}
                    </div>
                    <h3 className={cn('display mt-2.5 text-[28px] leading-[1.08] transition-colors duration-500 sm:text-[34px]', on ? 'text-ink' : 'text-ink lg:text-ink/40')}>{t(s.title)}</h3>
                    <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-muted">{t(s.text)}</p>
                    <div className="mt-6 aspect-[16/10] overflow-hidden rounded-2xl bg-sand lg:hidden">
                      <Img src={s.image} small alt="" className="h-full w-full object-cover" />
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
