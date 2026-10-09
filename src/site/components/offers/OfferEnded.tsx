// Draft / paused / expired / unknown offer → a friendly "this offer has ended" page with the live offers
// (PDF p.28 "Ofertë e skaduar hiqet nga vendet aktive"; p.50 "landing page joaktive trajtohen").
import { ArrowRight, Hourglass, Percent } from 'lucide-react';
import { Accent, Reveal } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHeading } from '@/site/components/SectionHeading';
import { CategoryTiles } from '@/site/components/utility/CategoryTiles';
import { useL, useLang } from '@/i18n';
import type { Offer, OfferState } from '@/lib/types';
import { OfferCard } from './parts';
import { longDate } from './model';
import { useOT } from './i18n';

export function OfferEnded({ slug, offer, state, others }: { slug?: string; offer?: Offer; state: OfferState | null; others: Offer[] }) {
  const t = useOT();
  const l = useL();
  const lang = useLang();
  const name = offer ? l(offer.name) : '';
  const soon = state === 'scheduled';
  const expired = state === 'expired' && offer?.endsAt;
  const title = soon ? t('soon_title') : t('ended_title');
  const text = soon ? t('soon_text', { name }) : expired ? t('ended_text', { name, date: longDate(offer!.endsAt!, lang) }) : t('ended_generic');

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="bg-grain absolute inset-0 -z-10" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_0%,var(--color-sand)_0%,transparent_75%)]" />
        <div className="container-x flex flex-col items-center pb-16 pt-12 text-center sm:pb-20 sm:pt-16">
          <div className="eyebrow animate-fade-up">{t('ended_eyebrow')}</div>
          <div className="relative mt-7 animate-fade-up [animation-delay:60ms]" aria-hidden>
            <span className="grid h-24 w-24 place-items-center rounded-full bg-white text-ink shadow-[0_24px_50px_-30px_rgba(28,26,23,0.55)] ring-1 ring-line sm:h-28 sm:w-28">
              <Hourglass className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={1.4} />
            </span>
            <span className="absolute -right-2 -top-1 grid h-10 w-10 rotate-[-12deg] place-items-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-paper">
              <Percent className="h-4 w-4" strokeWidth={2.6} />
            </span>
          </div>
          <h1 className="display mt-8 max-w-2xl animate-fade-up text-[38px] leading-[1.04] text-ink [animation-delay:120ms] sm:text-[56px]">
            <Accent text={title} />
          </h1>
          <p className="mt-4 max-w-xl animate-fade-up text-[16.5px] leading-relaxed text-muted [animation-delay:160ms]">{text}</p>
          {slug && (
            <div className="mt-5 inline-flex max-w-full animate-fade-up items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] text-muted ring-1 ring-line [animation-delay:180ms]">
              <span className="shrink-0 font-semibold">{t('requested')}:</span>
              <code className="truncate font-mono text-ink-soft">/oferta/{slug}</code>
            </div>
          )}
          <div className="mt-8 flex w-full animate-fade-up flex-col items-stretch justify-center gap-3 [animation-delay:220ms] sm:w-auto sm:flex-row sm:items-center">
            <ButtonLink to="/produktet?akcija=1" size="lg" icon={<Percent className="h-4 w-4" />}>
              {t('onSale')}
            </ButtonLink>
            <ButtonLink to="/produktet" size="lg" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
              {t('allProducts')}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="container-x pt-14 sm:pt-20">
        {others.length > 0 ? (
          <>
            <Reveal>
              <SectionHeading eyebrow={t('more_eyebrow')} title={t('more_title')} align="center" />
            </Reveal>
            <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
              {others.map((o, i) => (
                <Reveal key={o.id} delay={i * 90}>
                  <OfferCard offer={o} />
                </Reveal>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mb-8 text-center text-[15px] text-muted">{t('noActive')}</p>
            <CategoryTiles variant="compact" />
          </>
        )}
      </section>
    </>
  );
}
