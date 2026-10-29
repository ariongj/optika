import { useId, useState, type ComponentType } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, Check, Eye, FlaskConical, MonitorSmartphone, Shield, SunMedium, SunMoon, Waves, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Accent, Img, Reveal } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { Price } from '@/site/components/Price';
import { labDays } from '@/site/components/product/optical';
import { useDict, useL, useLang } from '@/i18n';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ChoiceGroup } from './ChoiceGroup';
import { LG } from './lensDict';
import { COATINGS, INDEX_ROWS, LAB_STEPS, RX_TERMS, SHORT, TYPES, coatingIn, indexOf, specIndex, type CoatingId, type RxTerm, type ZoneKind } from './lensData';

const shortName = (p: Product, l: (v: Product['name']) => string) => l(SHORT[p.id] ?? p.name);

/* ------------------------------------------------------------------ */
/* Lens types                                                           */
/* ------------------------------------------------------------------ */
export function LensTypes({ lenses }: { lenses: Product[] }) {
  const t = useDict(LG);
  const l = useL();
  const known = TYPES.map((x) => ({ ...x, product: lenses.find((p) => p.id === x.id) })).filter((x): x is (typeof TYPES)[number] & { product: Product } => !!x.product);
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-5">
      {known.map(({ product: p, zone, forWho, know }, i) => (
        <Reveal key={p.id} as="article" delay={(i % 3) * 80} className="flex w-[84%] shrink-0 snap-start flex-col rounded-[28px] bg-white p-6 ring-1 ring-line sm:w-auto sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <LensZones kind={zone} className="h-[88px] w-[88px] shrink-0" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft">
              <FlaskConical className="h-3 w-3" /> {t('labDays', { days: labDays(p) })}
            </span>
          </div>
          <h3 className="display mt-6 text-[25px] leading-[1.1] text-ink">{l(p.name)}</h3>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{l(p.short)}</p>
          <dl className="mt-5 space-y-3 border-t border-line pt-5 text-[14px] leading-snug">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">{t('forWho')}</dt>
              <dd className="mt-1 text-ink-soft">{l(forWho)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-oak">{t('goodToKnow')}</dt>
              <dd className="mt-1 text-ink-soft">{l(know)}</dd>
            </div>
          </dl>
          <div className="mt-auto flex items-end justify-between gap-3 pt-6">
            <Price product={p} size="md" />
            <Link to={`/produkt/${p.slug}`} className="group inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              <span className="link-u">{t('view')}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** Small schematic of where a lens type is sharp (illustrative). */
export function LensZones({ kind, className }: { kind: ZoneKind; className?: string }) {
  const id = useId().replace(/:/g, '');
  const ring = <circle cx="60" cy="60" r="52" fill="none" stroke="#776440" strokeOpacity="0.55" strokeWidth="1.5" />;
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <clipPath id={`${id}-c`}>
          <circle cx="60" cy="60" r="52" />
        </clipPath>
        <radialGradient id={`${id}-glass`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe7e0" />
        </radialGradient>
        <linearGradient id={`${id}-photo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.15" stopColor="#52585b" />
          <stop offset="0.85" stopColor="#eef3f0" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        {kind === 'single' && (
          <>
            <rect width="120" height="120" fill={`url(#${id}-glass)`} />
            <circle cx="60" cy="60" r="34" fill="none" stroke="#776440" strokeOpacity="0.18" strokeDasharray="2 4" />
            <path d="M54 60h12M60 54v12" stroke="#776440" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
        {kind === 'progressive' && (
          <>
            <rect width="120" height="120" fill="#cfc6b8" />
            <path
              d="M0 0H120V54C100 58 78 60 70 64C66 68 66 76 68 82C76 88 96 94 120 104V120H0V104C24 94 44 88 52 82C54 76 54 68 50 64C42 60 20 58 0 54Z"
              fill={`url(#${id}-glass)`}
              filter={`url(#${id}-blur)`}
            />
            <path d="M0 0H120V50C96 56 80 58 72 62C66 66 65 76 66 84C76 90 98 98 120 108V120H0V108C22 98 44 90 54 84C55 76 54 66 48 62C40 58 24 56 0 50Z" fill={`url(#${id}-glass)`} />
            <text x="60" y="34" textAnchor="middle" fontSize="9" fontWeight="700" fill="#776440" opacity="0.7">∞</text>
            <circle cx="60" cy="71" r="2" fill="#776440" opacity="0.55" />
            <path d="M52 100h16" stroke="#776440" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
        {kind === 'screen' && (
          <>
            <rect width="120" height="120" fill={`url(#${id}-glass)`} />
            <path d="M22 44a44 44 0 0 1 50-28" stroke="#7d8fd8" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" fill="none" filter={`url(#${id}-blur)`} />
            <rect x="40" y="52" width="40" height="26" rx="3" fill="none" stroke="#776440" strokeOpacity="0.5" strokeWidth="1.5" />
            <path d="M54 84h12" stroke="#776440" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
        {kind === 'photo' && (
          <>
            <rect width="120" height="120" fill={`url(#${id}-photo)`} />
            <circle cx="34" cy="34" r="9" fill="none" stroke="#f3d9a6" strokeWidth="1.6" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <path key={a} d="M34 19v-5" stroke="#f3d9a6" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${a} 34 34)`} />
            ))}
          </>
        )}
        {kind === 'sun' && (
          <>
            <rect width="120" height="120" fill="#3f5444" />
            {Array.from({ length: 13 }, (_, k) => (
              <path key={k} d={`M0 ${10 + k * 8}H120`} stroke="#ffffff" strokeOpacity="0.1" strokeWidth="1" />
            ))}
            <path d="M24 40a40 40 0 0 1 30-18" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        )}
        {kind === 'thin' && (
          <>
            <rect width="120" height="120" fill="#f1ede6" />
            <path d="M30 20 Q 42 60 30 100 L 46 100 Q 38 60 46 20 Z" fill="#dbe7e0" stroke="#776440" strokeOpacity="0.35" strokeWidth="1.2" />
            <path d="M74 24 Q 82 60 74 96 L 84 96 Q 79 60 84 24 Z" fill="#cbbfa9" stroke="#776440" strokeOpacity="0.7" strokeWidth="1.2" />
          </>
        )}
      </g>
      {ring}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Coatings                                                             */
/* ------------------------------------------------------------------ */
const COAT_ICON: Record<CoatingId, ComponentType<{ className?: string }>> = {
  ar: Eye,
  hard: Shield,
  uv: SunMedium,
  blue: MonitorSmartphone,
  photo: SunMoon,
  polar: Waves,
};
const COAT_POST: Partial<Record<CoatingId, string>> = {
  blue: '/keshilla/lentet-per-ekran-drita-blu',
  uv: '/keshilla/polarizim-apo-uv400',
  polar: '/keshilla/polarizim-apo-uv400',
};

export function Coatings({ lenses }: { lenses: Product[] }) {
  const t = useDict(LG);
  const l = useL();
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-5">
      {COATINGS.map((c, i) => {
        const Icon = COAT_ICON[c.id];
        const inPk = lenses.filter((p) => coatingIn(p, c));
        const post = COAT_POST[c.id];
        return (
          <Reveal key={c.id} as="article" delay={(i % 3) * 80} className="flex w-[84%] shrink-0 snap-start flex-col rounded-[28px] bg-white p-6 ring-1 ring-line sm:w-auto sm:p-7">
            <div className="flex items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="display text-[24px] leading-tight text-ink">{l(c.name)}</h3>
            </div>
            <div className="mt-5 space-y-4 text-[14.5px] leading-relaxed">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-white" aria-hidden>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <p className="text-ink-soft">
                  <span className="sr-only">{t('does')}: </span>
                  {l(c.does)}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand text-oak ring-1 ring-oak/25" aria-hidden>
                  <X className="h-3 w-3" strokeWidth={3} />
                </span>
                <p className="text-muted">
                  <span className="sr-only">{t('doesnt')}: </span>
                  {l(c.doesnt)}
                </p>
              </div>
            </div>
            <div className="mt-auto pt-6">
              {inPk.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{t('inPackages')}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {inPk.map((p) => (
                      <Link key={p.id} to={`/produkt/${p.slug}`} className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-semibold text-ink-soft ring-1 ring-line transition hover:ring-ink/30">
                        {shortName(p, l)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {post && (
                <Link to={post} className="group mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700">
                  <span className="link-u">{t('readMore')}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Materials / index table                                              */
/* ------------------------------------------------------------------ */
export function IndexTable({ lenses }: { lenses: Product[] }) {
  const t = useDict(LG);
  const l = useL();
  const lang = useLang();
  const fmt = (n: number) => money(n, lang, { decimals: n % 1 !== 0 });

  /** Packages offering an index, with the surcharge (or the package price for index-only packages). */
  const where = (n: number) =>
    lenses.flatMap((p) => {
      const opt = p.options.find((o) => o.id === 'index');
      const v = opt?.values.find((x) => indexOf(x.label) === n);
      if (v) return [{ p, extra: v.priceDelta ? `+${fmt(v.priceDelta)}` : t('included0') }];
      if (!opt && specIndex(p) === n) return [{ p, extra: fmt(p.salePrice && p.salePrice < p.price ? p.salePrice : p.price) }];
      return [];
    });

  const rows = INDEX_ROWS.map((r) => ({ ...r, where: where(r.n) }));
  const chips = (list: ReturnType<typeof where>) =>
    list.length ? (
      <span className="flex flex-wrap gap-1.5">
        {list.map(({ p, extra }) => (
          <Link key={p.id} to={`/produkt/${p.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[12.5px] font-semibold text-ink-soft ring-1 ring-line transition hover:ring-ink/30">
            {shortName(p, l)} <span className="font-medium text-muted tabular-nums">{extra}</span>
          </Link>
        ))}
      </span>
    ) : (
      <span className="text-muted">—</span>
    );

  return (
    <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-line">
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-line bg-sand/50 text-[11.5px] font-bold uppercase tracking-[0.14em] text-muted">
            <th scope="col" className="px-6 py-4">{t('colIndex')}</th>
            <th scope="col" className="px-4 py-4">{t('colThinner')}</th>
            <th scope="col" className="px-4 py-4">{t('colFor')}</th>
            <th scope="col" className="px-4 py-4">{t('colNote')}</th>
            <th scope="col" className="px-6 py-4">{t('colWhere')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-[14.5px]">
          {rows.map((r) => (
            <tr key={r.n} className="align-middle">
              <th scope="row" className="px-6 py-5">
                <span className="display text-[28px] font-normal leading-none text-ink tabular-nums">{r.n.toFixed(2)}</span>
              </th>
              <td className="px-4 py-5 font-semibold text-brand-700 tabular-nums">{l(r.thinner)}</td>
              <td className="px-4 py-5 font-semibold text-ink tabular-nums">{l(r.forRx)}</td>
              <td className="px-4 py-5 text-ink-soft">{l(r.note)}</td>
              <td className="px-6 py-5">{chips(r.where)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.n} className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="display text-[30px] leading-none text-ink tabular-nums">{r.n.toFixed(2)}</span>
              <span className="text-[13px] font-semibold text-ink tabular-nums">{l(r.forRx)}</span>
            </div>
            <p className="mt-2 text-[14px] text-ink-soft">
              {l(r.note)}
              {r.n !== 1.5 && <span className="font-semibold text-brand-700"> · {t('colThinner').toLowerCase()}: {l(r.thinner)}</span>}
            </p>
            <div className="mt-3 text-[13px]">{chips(r.where)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prescription explainer                                               */
/* ------------------------------------------------------------------ */
const RX_COLS: RxTerm[] = ['sph', 'cyl', 'axis', 'add', 'pd'];
const RX_ROWS: { eye: 'OD' | 'OS'; label: 'rxRight' | 'rxLeft'; values: Record<Exclude<RxTerm, 'eye'>, string> }[] = [
  { eye: 'OD', label: 'rxRight', values: { sph: '−2.25', cyl: '−0.50', axis: '180', add: '+1.50', pd: '32.0' } },
  { eye: 'OS', label: 'rxLeft', values: { sph: '−1.75', cyl: '−0.75', axis: '170', add: '+1.50', pd: '31.5' } },
];

export function RxExplainer() {
  const t = useDict(LG);
  const l = useL();
  const [term, setTerm] = useState<RxTerm>('sph');
  const info = RX_TERMS.find((x) => x.id === term)!;
  const hl = (col: RxTerm) => (term === col ? 'bg-brand-600 text-white' : '');

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
      <div>
        <ChoiceGroup
          ariaLabel={t('rxTitle').replace(/\*/g, '')}
          variant="pill"
          value={term}
          onChange={setTerm}
          className="flex flex-wrap gap-2"
          options={RX_TERMS.map((x) => ({ id: x.id, label: <span className="tabular-nums">{x.short}</span> }))}
        />
        <figure className="mt-5 rotate-[-0.6deg] rounded-[24px] bg-white p-5 shadow-[0_30px_60px_-40px_rgba(28,26,23,0.5)] ring-1 ring-line sm:p-7">
          <figcaption className="flex items-center justify-between gap-3 border-b border-dashed border-line pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            <span>{t('rxExample')}</span>
            <span className="font-display text-[15px] font-normal normal-case italic tracking-normal text-brand-600">Rx</span>
          </figcaption>
          <div className="no-scrollbar mt-4 overflow-x-auto">
            <table className="w-full min-w-[320px] border-separate border-spacing-x-1 border-spacing-y-1.5 text-center text-[14px] tabular-nums">
              <thead>
                <tr className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className={cn('rounded-lg px-1.5 py-1.5 text-left transition-colors motion-reduce:transition-none', hl('eye'))}>
                    <span className="sr-only">OD / OS</span>
                  </th>
                  {RX_COLS.map((c) => (
                    <th key={c} scope="col" className={cn('rounded-lg px-1.5 py-1.5 transition-colors motion-reduce:transition-none', hl(c))}>
                      {RX_TERMS.find((x) => x.id === c)!.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RX_ROWS.map((r) => (
                  <tr key={r.eye}>
                    <th scope="row" className={cn('rounded-lg px-1.5 py-2 text-left transition-colors motion-reduce:transition-none', term === 'eye' ? 'bg-brand-600 text-white' : 'text-ink')}>
                      <span className="block text-[14px] font-bold">{r.eye}</span>
                      <span className={cn('block text-[10.5px] font-semibold', term === 'eye' ? 'text-white/75' : 'text-muted')}>{t(r.label)}</span>
                    </th>
                    {RX_COLS.map((c) => (
                      <td key={c} className={cn('rounded-lg px-1.5 py-2 font-semibold transition-colors motion-reduce:transition-none', term === c ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-600/30' : 'text-ink-soft')}>
                        {r.values[c as Exclude<RxTerm, 'eye'>]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      </div>

      <div className="flex flex-col">
        <div className="rounded-[24px] bg-ink p-6 text-white sm:p-7" aria-live="polite">
          <div className="flex items-baseline gap-3">
            <span className="display text-[34px] leading-none text-brand-200">{info.short}</span>
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-paper/60">{l(info.name)}</span>
          </div>
          <p className="mt-4 text-[16px] leading-relaxed text-paper/85">{l(info.text)}</p>
        </div>
        <p className="mt-5 rounded-[24px] bg-brand-50 p-5 text-[14.5px] leading-relaxed text-ink-soft ring-1 ring-brand-600/15">{t('rxTip')}</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <ButtonLink to="/faqe/receta-dhe-pd" variant="dark" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
            {t('rxGuide')}
          </ButtonLink>
          <ButtonLink to="/keshilla/si-ta-lexoni-receten" variant="outline" size="sm" iconRight={<ArrowUpRight className="h-4 w-4" />}>
            {t('rxPost')}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Optical Lab block                                                    */
/* ------------------------------------------------------------------ */
export function LabBlock() {
  const t = useDict(LG);
  const l = useL();
  return (
    <div className="relative isolate grid gap-10 overflow-hidden rounded-[36px] bg-ink p-6 text-white sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:p-14">
      <Img src="/images/s/laboratori.webp" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-ink via-ink/90 to-ink/60" />
      <div className="bg-grain pointer-events-none absolute inset-0 -z-10" />
      <div className="flex flex-col">
        <div className="eyebrow text-brand-200">{t('labEyebrow')}</div>
        <h2 className="display mt-4 text-[34px] leading-[1.05] sm:text-[48px]">
          <Accent text={t('labTitle')} accentClassName="text-brand-200!" />
        </h2>
        <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-paper/70">{t('labText')}</p>
        <div className="mt-8">
          <ButtonLink to="/optical-lab" variant="light" iconRight={<ArrowRight className="h-4 w-4" />}>
            {t('labCta')}
          </ButtonLink>
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {LAB_STEPS.map((s, i) => (
          <li key={i} className="rounded-[22px] bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-sm">
            <span className="display text-[30px] leading-none text-brand-200">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="mt-3 text-[16px] font-bold text-white">{l(s.title)}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-paper/70">{l(s.text)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
