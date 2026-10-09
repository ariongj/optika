// Small pieces of the offer landing page: countdown, discount code (copy / apply in the cart), offer card.
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, Check, Clock, Copy, ShoppingBag } from 'lucide-react';
import { Accent, Badge, Img, useCountdown } from '@/components/ui/misc';
import { useL, useLang } from '@/i18n';
import { useUi } from '@/store/ui';
import { normalizeCode } from '@/lib/discounts';
import { cn } from '@/lib/utils';
import type { Offer } from '@/lib/types';
import { daysLeft, shortDate } from './model';
import { useOT } from './i18n';

/* ------------------------------------------------------------------ */
export function Countdown({ to, tone = 'light', className }: { to: string; tone?: 'light' | 'dark'; className?: string }) {
  const t = useOT();
  const cd = useCountdown(to);
  const cells: [number, string][] = [
    [cd.days, t('days')],
    [cd.hours, t('hours')],
    [cd.minutes, t('minutes')],
    [cd.seconds, t('seconds')],
  ];
  const dark = tone === 'dark';
  return (
    <div className={className}>
      <div className={cn('text-[11px] font-bold uppercase tracking-[0.2em]', dark ? 'text-paper/50' : 'text-muted')}>{cd.done ? t('endedNow') : t('endsIn')}</div>
      <div className="mt-3 flex gap-2 sm:gap-3" role="timer" aria-live="off">
        {cells.map(([v, label]) => (
          <div key={label} className={cn('w-[66px] rounded-2xl py-3 text-center sm:w-[76px]', dark ? 'bg-white/[0.07] ring-1 ring-white/10' : 'bg-white shadow-[0_14px_30px_-24px_rgba(28,26,23,0.6)] ring-1 ring-line')}>
            <div className={cn('display text-[30px] leading-none tabular-nums sm:text-[36px]', dark ? 'text-white' : 'text-ink')}>{String(v).padStart(2, '0')}</div>
            <div className={cn('mt-1.5 text-[10px] font-bold uppercase tracking-[0.16em]', dark ? 'text-paper/45' : 'text-muted')}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Discount code: copy (toast) + "apply in the cart" (adds it to the shopper's codes). */
export function CodeBox({ code, className }: { code: string; className?: string }) {
  const t = useOT();
  const codes = useUi((s) => s.codes);
  const addCode = useUi((s) => s.addCode);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const applied = codes.includes(normalizeCode(code));

  const copy = () => {
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    toast.success(t('copied'), { description: code });
  };
  const apply = () => {
    addCode(code);
    toast.success(t('applied'), { description: code, action: { label: t('openCart'), onClick: () => setCartOpen(true) } });
  };

  return (
    <div className={cn('flex flex-col gap-2.5 sm:flex-row sm:items-center', className)}>
      <button
        type="button"
        onClick={copy}
        title={t('copy')}
        className="group inline-flex h-12 items-center justify-between gap-4 rounded-full border border-dashed border-ink/30 bg-white px-5 text-left transition-colors hover:border-ink"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{t('codeLabel')}</span>
        <span className="font-mono text-[17px] font-bold tracking-[0.12em] text-ink">{code}</span>
        <Copy className="h-4 w-4 text-muted transition-colors group-hover:text-ink" aria-label={t('copy')} />
      </button>
      {applied ? (
        <span className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-50 px-5 text-[14px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
          <Check className="h-4 w-4" /> {t('appliedShort')}
        </span>
      ) : (
        <button type="button" onClick={apply} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper transition-colors hover:bg-brand-600">
          <ShoppingBag className="h-4 w-4" /> {t('apply')}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function OfferCard({ offer, wide, className }: { offer: Offer; wide?: boolean; className?: string }) {
  const t = useOT();
  const l = useL();
  const lang = useLang();
  const left = daysLeft(offer.endsAt);
  const when = left === null ? t('ongoing') : left === 0 ? t('lastDay') : left === 1 ? t('dayLeft') : t('daysLeft', { n: left });
  return (
    <Link
      to={`/oferta/${offer.slug}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-line transition-shadow duration-500 hover:shadow-[0_30px_60px_-36px_rgba(28,26,23,0.5)]',
        wide && 'md:flex-row',
        className,
      )}
    >
      <div className={cn('relative aspect-[16/10] overflow-hidden bg-sand', wide && 'md:aspect-auto md:min-h-[300px] md:w-[52%] md:shrink-0')}>
        <Img src={offer.image} small={!wide} alt={l(offer.name)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]" />
        {l(offer.badge) && (
          <Badge tone="brand" className="absolute left-4 top-4 shadow-lg">
            {l(offer.badge)}
          </Badge>
        )}
      </div>
      <div className={cn('flex flex-1 flex-col p-6', wide && 'md:justify-center md:p-10')}>
        <h3 className={cn('display leading-[1.08] text-ink', wide ? 'text-[28px] md:text-[40px]' : 'text-[26px]')}>
          <Accent text={l(offer.landing.title) || l(offer.name)} />
        </h3>
        <p className={cn('mt-2 text-[14.5px] leading-relaxed text-muted', wide ? 'md:mt-3 md:text-[16px]' : 'line-clamp-2')}>{l(offer.landing.text)}</p>
        <div className={cn('flex items-center justify-between gap-3 text-[13px]', wide ? 'mt-6 md:mt-8 md:justify-start md:gap-8' : 'mt-auto pt-5')}>
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink-soft" title={offer.endsAt ? shortDate(offer.endsAt, lang) : undefined}>
            <Clock className="h-3.5 w-3.5 text-brand-600" />
            {when}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink transition-colors group-hover:text-brand-700">
            {t('seeOffer')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
