import { useRef, type ReactNode } from 'react';
import { AudioLines, Camera, MonitorSmartphone, Sparkles, type LucideIcon } from 'lucide-react';
import { Img } from '@/components/ui/misc';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import { SG } from './dict';
import { Backdrop, CountUp, Headline, Kicker, glowMove, useInView } from './ui';

/** Glass card with the pointer-follow glow. */
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div onPointerMove={glowMove} className={cn('sg-card overflow-hidden rounded-[28px] p-6 sm:p-7', className)}>
      {children}
    </div>
  );
}

function Big({ children, unit }: { children: ReactNode; unit?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[58px] font-semibold leading-none tracking-[-0.05em] text-white sm:text-[68px]">{children}</span>
      {unit && <span className="sg-mono text-[12px] text-[#6fd3a5]">{unit}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2 — Spec bento grid                                                  */
/* ------------------------------------------------------------------ */
export function SmartSpecs() {
  const t = useDict(SG);
  const battRef = useRef<HTMLDivElement>(null);
  const battIn = useInView(battRef);
  const features: { icon: LucideIcon; title: string; text: string; badge?: string }[] = [
    { icon: Camera, title: t('can1Title'), text: t('can1Text') },
    { icon: AudioLines, title: t('can2Title'), text: t('can2Text') },
    { icon: Sparkles, title: t('can3Title'), text: t('can3Text') },
    { icon: MonitorSmartphone, title: t('can4Title'), text: t('can4Text'), badge: t('can4Badge') },
  ];

  return (
    <section id="specs" className="relative isolate scroll-mt-16 overflow-hidden bg-[#07090a] py-20 text-white sm:py-28">
      <Backdrop glow="left" grid={false} />
      <div className="container-x relative">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Kicker n="01">{t('specEyebrow')}</Kicker>
            <Headline text={t('specTitle')} className="mt-5 text-[36px] leading-[1.04] sm:text-[52px] lg:text-[58px]" />
          </div>
          <p className="max-w-md text-[15.5px] leading-relaxed text-white/55 lg:col-span-5 lg:justify-self-end">{t('specText')}</p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-16 lg:grid-cols-4">
          {/* camera — a viewfinder over a photo */}
          <div onPointerMove={glowMove} className="sg-card group relative col-span-2 min-h-[340px] overflow-hidden rounded-[28px] lg:row-span-2 lg:min-h-[460px]">
            <Img src="/images/lookbook/riviera.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 saturate-[0.8] transition-transform duration-[1.6s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07090a] via-[#07090a]/35 to-[#07090a]/50" />
            {/* viewfinder corners + crosshair */}
            <div aria-hidden className="absolute inset-5 sm:inset-7">
              {['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((c) => (
                <span key={c} className={cn('absolute h-7 w-7 border-white/70', c)} />
              ))}
              <span className="absolute left-1/2 top-[42%] h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-white/50" />
              <span className="absolute left-1/2 top-[42%] h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-white/50" />
            </div>
            <div className="sg-mono absolute left-9 top-9 flex items-center gap-2 text-[11px] text-white/85 sm:left-11 sm:top-11">
              <span className="sg-led h-2 w-2 rounded-full bg-white" /> Rec
            </div>
            <div className="sg-mono absolute right-9 top-9 text-[11px] text-white/85 sm:right-11 sm:top-11">3K</div>
            <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10">
              <div className="sg-mono text-[11px] text-white/55">{t('s_cam_label')}</div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-[88px] font-semibold leading-[0.9] tracking-[-0.055em] sm:text-[120px]">
                  <CountUp to={12} />
                </span>
                <span className="sg-mono text-[14px] text-[#6fd3a5]">MP</span>
              </div>
              <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/65">{t('s_cam_text')}</p>
            </div>
          </div>

          {/* 3K video */}
          <Card className="max-lg:order-1">
            <div className="sg-mono text-[11px] text-white/50">{t('s_video_label')}</div>
            <div className="mt-6">
              <Big unit="video">
                <CountUp to={3} />K
              </Big>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-white/55">{t('s_video_text')}</p>
          </Card>

          {/* battery */}
          <Card className="col-span-2 max-lg:order-3 lg:col-span-1">
            <div className="sg-mono text-[11px] text-white/50">{t('s_batt_label')}</div>
            <div className="mt-6">
              <Big unit={t('s_batt_unit')}>
                ~<CountUp to={9} />
              </Big>
            </div>
            <div ref={battRef} aria-hidden className="mt-4 flex h-3.5 items-center gap-1">
              <span className="relative h-full flex-1 overflow-hidden rounded-[4px] ring-1 ring-inset ring-white/25">
                <span className={cn('sg-fill absolute inset-y-[3px] left-[3px] right-[3px] rounded-[2px] bg-gradient-to-r from-[#2c4a3a] to-[#6fd3a5]', battIn ? 'scale-x-[0.86]' : 'scale-x-0')} />
              </span>
              <span className="h-1.5 w-[3px] rounded-r-sm bg-white/30" />
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-white/55">{t('s_batt_text')}</p>
          </Card>

          {/* microphones — six level bars */}
          <Card className="col-span-2 max-lg:order-4 lg:col-span-1">
            <div className="sg-mono text-[11px] text-white/50">{t('s_mic_label')}</div>
            <div className="mt-6 flex items-end justify-between gap-4">
              <Big unit={t('s_mic_unit')}>
                <CountUp to={6} />
              </Big>
              <span aria-hidden className="mb-1 flex h-9 items-end gap-[3px]">
                {[0.5, 0.9, 0.65, 1, 0.7, 0.45].map((h, i) => (
                  <span key={i} className="w-[3px] origin-bottom animate-[sg-eq_1.1s_ease-in-out_infinite] rounded-full bg-[#6fd3a5]" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.12}s` }} />
                ))}
              </span>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-white/55">{t('s_mic_text')}</p>
          </Card>

          {/* Audio: weight */}
          <Card className="max-lg:order-2">
            <div className="sg-mono text-[11px] text-white/50">{t('s_g_label')}</div>
            <div className="mt-6">
              <Big unit="g">
                ~<CountUp to={43} />
              </Big>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-white/55">{t('s_g_text')}</p>
          </Card>

          {/* what you can do */}
          {features.map(({ icon: Icon, title, text, badge }) => (
            <Card key={title} className="col-span-2 max-lg:order-5 sm:col-span-1">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#6fd3a5]/10 text-[#6fd3a5] ring-1 ring-inset ring-[#6fd3a5]/20">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                {badge && <span className="sg-mono rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/70 ring-1 ring-inset ring-white/10">{badge}</span>}
              </div>
              <h3 className="mt-6 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-white">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/55">{text}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
