// Offer landing — hero: badge, serif title with *accent*, text, countdown to endsAt, CTA + code, photo with the
// offer value disc and a note on how the discount is applied.
import { ArrowDown, CalendarCheck, CalendarDays, Eye, Percent, Sparkles, Ticket } from 'lucide-react';
import { Accent, Badge, Img } from '@/components/ui/misc';
import { Button, buttonClass } from '@/components/ui/Button';
import { openBooking } from '@/site/components/utility/Booking';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { useL, useLang } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Discount, Offer } from '@/lib/types';
import { Countdown, CodeBox } from './parts';
import { longDate } from './model';
import { useOT } from './i18n';

export function OfferHero({ offer, discount, value, onCta }: { offer: Offer; discount?: Discount; value: string | null; onCta: () => void }) {
  const t = useOT();
  const l = useL();
  const lang = useLang();
  const title = l(offer.landing.title) || l(offer.name);
  const badge = l(offer.badge);
  const code = discount?.method === 'code' ? discount.code : undefined;
  const auto = discount?.method === 'auto';
  const NoteIcon = code ? Ticket : auto ? Sparkles : Eye;
  const noteTitle = code ? `${t('codeLabel')} ${code}` : auto ? t('auto_t') : t('freeMeasure');
  const noteText = code ? t('c2_x') : auto ? t('auto_x') : t('e2_x');

  const toProducts = (e: React.MouseEvent) => {
    e.preventDefault();
    onCta();
    document.getElementById('produktet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <div aria-hidden className="bg-grain absolute inset-0 -z-10" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_12%_0%,var(--color-sand)_0%,transparent_72%)]" />
      <div className="container-x grid items-center gap-10 pb-14 pt-8 sm:pt-10 lg:grid-cols-[1fr_1.02fr] lg:gap-16 lg:pb-20 lg:pt-12">
        <div className="min-w-0 animate-fade-up">
          <Breadcrumbs items={[{ label: t('crumb'), to: '/produktet?akcija=1' }, { label: l(offer.name) }]} />
          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2">
            {badge && (
              <Badge tone="brand" className="text-[12px]">
                {discount ? <Percent className="h-3 w-3" strokeWidth={3} /> : <Sparkles className="h-3 w-3" strokeWidth={2.6} />}
                {badge}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
              <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
              {offer.endsAt ? t('activeUntil', { date: longDate(offer.endsAt, lang) }) : t('noEnd')}
            </span>
          </div>
          <h1 className="display mt-5 text-[44px] leading-[1.0] text-ink sm:text-[62px] xl:text-[70px]">
            <Accent text={title} />
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">{l(offer.landing.text)}</p>

          {offer.endsAt && <Countdown to={offer.endsAt} className="mt-8" />}

          {code ? (
            // a code offer: the code is the main action, the products follow
            <div className="mt-8 space-y-5">
              <CodeBox code={code} />
              <a href="#produktet" onClick={toProducts} className="link-u inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
                {t('seeProducts')}
                <ArrowDown className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a href="#produktet" onClick={toProducts} className={buttonClass({ size: 'lg' })}>
                {t('seeProducts')}
                <ArrowDown className="h-4 w-4" />
              </a>
              <Button variant="outline" size="lg" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => openBooking('exam')}>
                {t('freeMeasure')}
              </Button>
            </div>
          )}
        </div>

        <div className="relative min-w-0 animate-fade-up [animation-delay:120ms]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-sand shadow-[0_40px_80px_-50px_rgba(28,26,23,0.7)] lg:aspect-square">
            <Img src={offer.image} eager alt={l(offer.name)} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent" />
          </div>
          {value && (
            <div className="absolute -top-4 left-4 grid h-28 w-28 rotate-[-10deg] place-items-center rounded-full bg-brand-600 p-3 text-center text-white shadow-2xl ring-8 ring-paper sm:-left-6 sm:-top-6 sm:h-36 sm:w-36">
              <span className={cn('display leading-[0.95]', value.length > 5 ? 'text-[19px] sm:text-[24px]' : 'text-[36px] sm:text-[46px]')}>{value}</span>
            </div>
          )}
          <div className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-2xl bg-white/95 p-4 pr-5 shadow-xl backdrop-blur sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-[320px]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
              <NoteIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-bold text-ink">{noteTitle}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted">{noteText}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
