import { useState } from 'react';
import { ArrowRight, FileText, FlaskConical, Globe2, Info, MapPin, Route, ShieldCheck, Workflow } from 'lucide-react';
import { Accent, Reveal } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { SectionHeading } from '@/site/components/SectionHeading';
import { pad2, scrollToId } from '@/site/components/company/data';
import { LB } from '@/site/components/group/labDict';
import { PartnerForm, type Interest, type Market } from '@/site/components/group/PartnerForm';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';

type Key = keyof typeof LB.sq;

/** Per-market copy keys (Kosovo first — the home market; EU = cross-border partners). */
const MARKETS: Record<
  Market,
  { tab: Key; code: string; title: Key; text: Key; caps: { t: Key; d: Key }[]; steps: { t: Key; d: Key }[]; docs: { t: Key; d: Key }[] }
> = {
  xk: {
    tab: 'tabXk',
    code: 'XK',
    title: 'xkTitle',
    text: 'xkText',
    caps: [
      { t: 'xk1t', d: 'xk1' },
      { t: 'xk2t', d: 'xk2' },
      { t: 'xk3t', d: 'xk3' },
    ],
    steps: [
      { t: 'xkS1t', d: 'xkS1' },
      { t: 'xkS2t', d: 'xkS2' },
      { t: 'xkS3t', d: 'xkS3' },
    ],
    docs: [
      { t: 'xkD1t', d: 'xkD1' },
      { t: 'xkD2t', d: 'xkD2' },
      { t: 'xkD3t', d: 'xkD3' },
    ],
  },
  eu: {
    tab: 'tabEu',
    code: 'EU',
    title: 'euTitle',
    text: 'euText',
    caps: [
      { t: 'eu1t', d: 'eu1' },
      { t: 'eu2t', d: 'eu2' },
      { t: 'eu3t', d: 'eu3' },
    ],
    steps: [
      { t: 'euS1t', d: 'euS1' },
      { t: 'euS2t', d: 'euS2' },
      { t: 'euS3t', d: 'euS3' },
    ],
    docs: [
      { t: 'euD1t', d: 'euD1' },
      { t: 'euD2t', d: 'euD2' },
      { t: 'euD3t', d: 'euD3' },
      { t: 'euD4t', d: 'euD4' },
    ],
  },
};

const CAP_ICONS = { xk: [FlaskConical, ShieldCheck, Workflow], eu: [FlaskConical, ShieldCheck, Route] } as const;

/** Anchor of the partner application (`/optical-lab#partneritet`). */
export const PARTNER_ID = 'partneritet';

/** "For opticians (B2B)": market tabs (Kosovo / EU), how the partnership starts, documents and the application form. */
export function LabPartners() {
  const t = useDict(LB);
  const [market, setMarket] = useState<Market>('xk');
  const [interests, setInterests] = useState<Interest[]>([]);
  const m = MARKETS[market];
  const formId = `${PARTNER_ID}-form`;

  const requestDocs = () => {
    if (!interests.includes('docs')) setInterests([...interests, 'docs']);
    scrollToId(formId);
  };

  return (
    <section id={PARTNER_ID} className="relative isolate scroll-mt-20 overflow-hidden bg-ink py-24 text-white sm:py-32">
      <div className="bg-grain pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(560px circle at 100% 0%, rgb(173 148 102 / 0.32), transparent 70%)' }} />
      <div className="container-x">
        <Reveal>
          <SectionHeading tone="light" eyebrow={t('b2bEyebrow')} title={t('b2bTitle')} subtitle={t('b2bText')} />
        </Reveal>

        {/* Market tabs */}
        <Reveal delay={80}>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-paper/55">{t('market')}</span>
            <div role="tablist" aria-label={t('market')} className="inline-flex rounded-full bg-white/[0.06] p-1 ring-1 ring-white/12">
              {(Object.keys(MARKETS) as Market[]).map((k) => {
                const on = market === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    id={`treg-${k}`}
                    aria-selected={on}
                    aria-controls="treg-panel"
                    onClick={() => setMarket(k)}
                    className={cn('inline-flex h-11 items-center gap-2.5 rounded-full px-4 text-[14px] font-semibold transition-colors sm:px-5', on ? 'bg-white text-ink shadow-sm' : 'text-paper/75 hover:text-white')}
                  >
                    <span className={cn('rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tracking-wider', on ? 'bg-brand-600 text-white' : 'bg-white/10 text-paper/80')}>{MARKETS[k].code}</span>
                    {t(MARKETS[k].tab)}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        <div id="treg-panel" role="tabpanel" aria-labelledby={`treg-${market}`} className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.08fr] lg:gap-14">
          <div key={market} className="animate-fade-in">
            <div className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-brand-200">
              {market === 'xk' ? <MapPin className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />} {t(m.tab)}
            </div>
            <h3 className="display mt-3 text-[32px] leading-[1.06] sm:text-[42px]">
              <Accent text={t(m.title)} accentClassName="text-brand-200!" />
            </h3>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-paper/70">{t(m.text)}</p>

            <ul className="mt-8 grid gap-3">
              {m.caps.map((c, i) => {
                const Icon = CAP_ICONS[market][i];
                return (
                  <li key={c.t} className="flex gap-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:p-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-brand-200 ring-1 ring-white/15">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15.5px] font-semibold text-white">{t(c.t)}</span>
                      <span className="mt-1 block text-[14px] leading-relaxed text-paper/65">{t(c.d)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-10 text-[12px] font-semibold uppercase tracking-[0.16em] text-paper/55">{t('howItStarts')}</div>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {m.steps.map((s, i) => (
                <li key={s.t} className="border-t border-white/15 pt-4">
                  <span className="display text-[30px] leading-none text-brand-200">{pad2(i + 1)}</span>
                  <span className="mt-3 block text-[15px] font-semibold text-white">{t(s.t)}</span>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-paper/60">{t(s.d)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div id={formId} className="scroll-mt-24">
            <PartnerForm market={market} marketLabel={t(m.tab)} interests={interests} onInterests={setInterests} />
          </div>
        </div>

        {/* Documentation — honest about what is (not) published */}
        <Reveal>
          <div className="mt-16 grid gap-8 rounded-[32px] p-6 ring-1 ring-white/12 sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <div>
              <div className="eyebrow text-brand-200">{t('docsEyebrow')}</div>
              <h3 className="display mt-3 text-[30px] leading-[1.06] sm:text-[38px]">
                <Accent text={t('docsTitle')} accentClassName="text-brand-200!" />
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-paper/70">{t('docsText')}</p>
              <Button variant="light" className="mt-7" onClick={requestDocs} icon={<FileText className="h-4 w-4" />} iconRight={<ArrowRight className="h-4 w-4" />}>
                {t('requestDocs')}
              </Button>
            </div>
            <div key={market} className="animate-fade-in">
              <ul className="divide-y divide-white/10 border-y border-white/10">
                {m.docs.map((d) => (
                  <li key={d.t} className="flex gap-4 py-4">
                    <FileText className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-200" />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-white">{t(d.t)}</span>
                      <span className="mt-1 block text-[14px] leading-relaxed text-paper/65">{t(d.d)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 flex items-start gap-3 rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[13.5px] leading-relaxed text-paper/80 ring-1 ring-white/10">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
                {t('docNote')}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
