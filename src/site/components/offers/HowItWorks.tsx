// Offer landing — "Si funksionon": three steps that depend on the linked discount (code / automatic / editorial
// offer without a discount, PDF p.28) and the offer terms read from the discount rule itself (never copied).
import type { ComponentType } from 'react';
import { CalendarDays, Eye, Layers, Receipt, ShoppingBag, Sparkles, UserCheck, Hash, Ticket } from 'lucide-react';
import { Reveal } from '@/components/ui/misc';
import { SectionHeading } from '@/site/components/SectionHeading';
import { useLang } from '@/i18n';
import { money } from '@/lib/format';
import type { Discount, Offer } from '@/lib/types';
import { CodeBox } from './parts';
import { longDate } from './model';
import { useOT, type OTKey } from './i18n';

type Icon = ComponentType<{ className?: string }>;

export function HowItWorks({ offer, discount, value, wholeRange }: { offer: Offer; discount?: Discount; value: string | null; wholeRange: boolean }) {
  const t = useOT();
  const lang = useLang();
  const code = discount?.method === 'code' ? discount.code : undefined;
  const v = value ?? '';

  const steps: { t: string; x: string }[] = !discount
    ? [
        { t: t('e1_t'), x: t('e1_x') },
        { t: t('e2_t'), x: t('e2_x') },
        { t: t('e3_t'), x: t('e3_x') },
      ]
    : code
      ? [
          { t: t('a1_t'), x: wholeRange ? t('c1_x') : t('a1_x') },
          { t: t('c2_t'), x: t('c2_x') },
          { t: t('c3_t', { value: v }), x: t('c3_x') },
        ]
      : [
          { t: t('a1_t'), x: t('a1_x') },
          { t: t('a2_t'), x: t('a2_x') },
          { t: t('a3_t'), x: t('a3_x', { value: v }) },
        ];

  /* ---------------- terms, read from the rule ---------------- */
  const terms: { icon: Icon; text: string }[] = [];
  const from = longDate(offer.startsAt, lang);
  terms.push({ icon: CalendarDays, text: offer.endsAt ? t('t_valid', { from, to: longDate(offer.endsAt, lang) }) : t('t_validOpen', { from }) });
  if (discount) {
    if (discount.minimum.type === 'amount' && discount.minimum.value > 0) {
      const sum = money(discount.minimum.value, lang, { decimals: false });
      terms.push({ icon: Receipt, text: t(discount.kind === 'order' ? 't_minAfter' : 't_min', { sum }) });
    }
    if (discount.minimum.type === 'qty' && discount.minimum.value > 0) terms.push({ icon: Receipt, text: t('t_minQty', { n: discount.minimum.value }) });
    const allowed = (['products', 'order', 'shipping'] as const).filter((c) => discount.combines[c]);
    terms.push({ icon: Layers, text: allowed.length ? t('t_combines', { list: allowed.map((c) => t(`cl_${c}` as OTKey)).join(', ') }) : t('t_noCombine') });
    if (discount.oncePerCustomer) terms.push({ icon: UserCheck, text: t('t_once') });
    if (discount.usageLimit) terms.push({ icon: Hash, text: t('t_limited') });
    terms.push(code ? { icon: Ticket, text: t('t_code', { code }) } : { icon: Sparkles, text: t('t_auto') });
  } else {
    terms.push({ icon: ShoppingBag, text: t('t_editorial') });
  }
  terms.push({ icon: Eye, text: t('t_measure') });

  return (
    <section className="bg-sand/60 py-20 sm:py-24">
      <div className="container-x grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0">
          <Reveal>
            <SectionHeading eyebrow={t('how_eyebrow')} title={t(discount ? 'how_title' : 'how_title_ed')} />
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={i} as="li" delay={i * 90} className="flex gap-4 rounded-3xl bg-white p-5 ring-1 ring-line sm:flex-col sm:gap-0 sm:p-6">
                <div className="shrink-0">
                  <span className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-muted sm:block">
                    {t('step')} {i + 1}
                  </span>
                  <span className="display block text-[40px] leading-none text-brand-600 sm:mt-2 sm:text-[46px]" aria-hidden>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="min-w-0 sm:mt-4">
                  <h3 className="text-[17px] font-bold leading-snug text-ink">{s.t}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.x}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          {code && (
            <Reveal delay={200}>
              <CodeBox code={code} className="mt-6" />
            </Reveal>
          )}
        </div>

        <Reveal delay={120} className="self-start">
          <aside className="rounded-3xl bg-white p-7 ring-1 ring-line sm:p-8">
            <div className="eyebrow">{t('terms')}</div>
            <ul className="mt-5 space-y-3.5">
              {terms.map(({ icon: I, text }, i) => (
                <li key={i} className="flex items-start gap-3 text-[14.5px] leading-snug text-ink-soft">
                  <span className="mt-px grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <I className="h-3.5 w-3.5" />
                  </span>
                  <span className="pt-1">{text}</span>
                </li>
              ))}
            </ul>
          </aside>
        </Reveal>
      </div>
    </section>
  );
}
