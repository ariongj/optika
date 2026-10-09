import { Check, Eye, Phone } from 'lucide-react';
import { Accent, Img } from '@/components/ui/misc';
import { Button, buttonClass } from '@/components/ui/Button';
import { openBooking } from '@/site/components/utility/Booking';
import { useDict } from '@/i18n';
import { useSettings } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { C } from './dict';
import { telHref } from './posts';

/** Dark call-to-action box: book an eye exam (opens the booking modal). */
export function MeasureCta({ image, className }: { image?: string; className?: string }) {
  const c = useDict(C);
  const settings = useSettings();
  return (
    <div className={cn('relative isolate grid overflow-hidden rounded-[32px] bg-ink text-white lg:grid-cols-[1.12fr_1fr]', className)}>
      <div className="bg-grain pointer-events-none absolute inset-0 -z-10" />
      <div className="relative z-10 order-last p-7 sm:p-12 lg:order-first lg:p-14">
        <div className="eyebrow text-brand-200">{c('cta_eyebrow')}</div>
        <h2 className="display mt-4 text-[34px] leading-[1.04] sm:text-[46px]">
          <Accent text={c('cta_title')} accentClassName="text-brand-200!" />
        </h2>
        <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-paper/70">{c('cta_text')}</p>
        <ul className="mt-7 space-y-3">
          {[c('cta_b1'), c('cta_b2'), c('cta_b3')].map((b) => (
            <li key={b} className="flex items-center gap-3 text-[15px] font-medium text-white/90">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600">
                <Check className="h-3.5 w-3.5" />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => openBooking('exam')} icon={<Eye className="h-4 w-4" />}>
            {c('cta_button')}
          </Button>
          <a href={telHref(settings.phone)} className={buttonClass({ variant: 'outlineLight', size: 'lg' })}>
            <Phone className="h-4 w-4" />
            {settings.phone}
          </a>
        </div>
      </div>
      {image && (
        <div className="relative min-h-[220px] sm:min-h-[300px]">
          <Img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent lg:bg-gradient-to-r lg:from-ink lg:via-ink/25 lg:to-transparent" />
        </div>
      )}
    </div>
  );
}
