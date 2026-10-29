import { Link } from 'react-router';
import { ArrowDown, ArrowUpRight, CalendarCheck, Clock, ScanFace, UserRoundCheck } from 'lucide-react';
import { Accent, Img, Reveal } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Breadcrumbs, SectionHeading } from '@/site/components/SectionHeading';
import { CtaBand } from '@/site/components/company/Blocks';
import { scrollToId } from '@/site/components/company/data';
import { openBooking } from '@/site/components/utility/Booking';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { FrameQuiz } from '@/site/components/guides/FrameQuiz';
import { FaceGlyph, FrameGlyph } from '@/site/components/guides/FinderVisuals';
import { FF } from '@/site/components/guides/finderDict';
import { FACES, FACE_GUIDE, SHAPE_NAME } from '@/site/components/guides/finderData';
import { useDict, useL } from '@/i18n';
import { site } from '@/i18n/site';

const FACTS = [
  { icon: Clock, key: 'fact1' },
  { icon: UserRoundCheck, key: 'fact2' },
  { icon: ScanFace, key: 'fact3' },
] as const;

/** /gjej-kornizen — frame finder quiz (face shape, style, material, width → top 3 frames). */
export default function FrameFinder() {
  const t = useDict(FF);
  const ts = useDict(site);
  const l = useL();
  usePageTitle(t('title'));

  return (
    <>
      {/* Header */}
      <section className="bg-paper">
        <div className="container-x pb-8 pt-6 sm:pb-10 sm:pt-8">
          <Breadcrumbs items={[{ label: t('title') }]} />
          <div className="mt-6 grid items-center gap-8 sm:mt-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <div className="eyebrow mb-3">{t('eyebrow')}</div>
              <h1 className="display max-w-2xl text-[38px] leading-[1.03] text-ink sm:text-[58px]">
                <Accent text={t('heroTitle')} />
              </h1>
              <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted sm:mt-5 sm:text-[17px]">{t('heroText')}</p>
              <ul className="mt-5 flex flex-wrap gap-2 sm:mt-6">
                {FACTS.map(({ icon: Icon, key }) => (
                  <li key={key} className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft ring-1 ring-line">
                    <Icon className="h-3.5 w-3.5 text-brand-600" /> {t(key)}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-7" onClick={() => scrollToId('kuizi')} iconRight={<ArrowDown className="h-4 w-4" />}>
                {t('start')}
              </Button>
            </div>
            <div className="relative hidden h-[360px] lg:block" aria-hidden>
              <div className="absolute right-[34%] top-0 h-[310px] w-[60%] overflow-hidden rounded-[32px] bg-sand-2 shadow-[0_30px_60px_-40px_rgba(28,26,23,0.6)]">
                <Img src="/images/lookbook/editorial.webp" eager alt="" className="h-full w-full object-cover" />
              </div>
              <div className="absolute bottom-0 right-0 h-[260px] w-[44%] overflow-hidden rounded-[28px] bg-sand-2 ring-[6px] ring-paper">
                <Img src="/images/lookbook/sun-portrait.webp" eager alt="" className="h-full w-full object-cover" />
              </div>
              <div className="absolute bottom-10 left-0 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lg ring-1 ring-line backdrop-blur">
                <FrameGlyph shape="round" build="metal" className="h-7 w-[70px] text-ink" />
                <span className="text-[13px] font-semibold text-ink">{l(FACES[0].label)} · {l(SHAPE_NAME.round)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quiz */}
      <section id="kuizi" className="scroll-mt-24 pb-20 pt-4 sm:pb-28 sm:pt-6">
        <div className="container-x">
          <FrameQuiz />
        </div>
      </section>

      {/* Face-shape guide */}
      <section className="border-y border-line bg-white/50 py-20 sm:py-28">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              eyebrow={t('guideEyebrow')}
              title={t('guideTitle')}
              subtitle={t('guideText')}
              action={
                <ButtonLink to="/keshilla/korniza-sipas-fytyres" variant="outline" size="sm" iconRight={<ArrowUpRight className="h-4 w-4" />}>
                  {t('guidePost')}
                </ButtonLink>
              }
            />
          </Reveal>
          <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {FACE_GUIDE.map((g, i) => {
              const face = FACES.find((f) => f.id === g.face)!;
              return (
                <Reveal key={g.face} delay={i * 70} as="article" className="flex w-[72%] shrink-0 snap-start flex-col rounded-[26px] bg-paper p-5 ring-1 ring-line sm:w-auto sm:p-6">
                  <FaceGlyph face={g.face} className="h-24 w-20 text-ink" />
                  <h3 className="display mt-4 text-[24px] leading-tight text-ink">{l(face.label)}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{l(face.hint)}</p>
                  <div className="mt-auto pt-5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">{t('tryShapes')}</div>
                    <ul className="mt-2.5 space-y-2">
                      {g.shapes.map((s) => (
                        <li key={s} className="flex items-center gap-3 text-[13.5px] font-semibold text-ink-soft">
                          <FrameGlyph shape={s} build={s === 'aviator' || s === 'round' ? 'metal' : 'acetate'} className="h-5 w-12 shrink-0 text-ink" />
                          {l(SHAPE_NAME[s])}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Frame size */}
      <section className="py-20 sm:py-28">
        <div className="container-x grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <Reveal>
            <SectionHeading eyebrow={t('sizeEyebrow')} title={t('sizeTitle')} subtitle={t('sizeText')} />
            <dl className="mt-8 space-y-4">
              {(
                [
                  ['52', 'sizeLens', 'sizeLensText'],
                  ['18', 'sizeBridge', 'sizeBridgeText'],
                  ['145', 'sizeTemple', 'sizeTempleText'],
                ] as const
              ).map(([n, k, d]) => (
                <div key={k} className="flex gap-4">
                  <dt className="display w-14 shrink-0 text-[28px] leading-none text-brand-600 tabular-nums">{n}</dt>
                  <dd>
                    <div className="text-[15px] font-bold text-ink">{t(k)}</div>
                    <p className="mt-0.5 text-[14.5px] leading-relaxed text-muted">{t(d)}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-[32px] bg-white p-6 ring-1 ring-line sm:p-10">
              <SizeDiagram />
              <p className="mt-6 rounded-2xl bg-paper px-4 py-3 text-center text-[13.5px] font-semibold text-ink-soft ring-1 ring-line">{t('sizeTotal')}</p>
              <div className="mt-6 flex flex-col items-center gap-3 text-center">
                <p className="text-[14px] text-muted">{t('measureCta')}</p>
                <Button variant="dark" onClick={() => openBooking('fitting')} icon={<CalendarCheck className="h-4 w-4" />}>
                  {ts('bookMeasure')}
                </Button>
                <Link to="/provo-virtualisht" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:underline">
                  <ScanFace className="h-4 w-4" /> {ts('nav_tryon')}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand image="/images/s/pershtatja.webp" className="pt-0! pb-8" />
    </>
  );
}

/** Front view with lens/bridge dimensions + the temple with its printed size. Numbers only — labels are in HTML. */
function SizeDiagram() {
  const ink = '#1c1a17';
  const brand = '#776440';
  const oak = '#a4774c';
  return (
    <svg viewBox="0 0 360 230" className="h-auto w-full" role="img" aria-label="52□18 145">
      {/* dimension: lens width */}
      <path d="M40 30H160M40 24v12M160 24v12" stroke={brand} strokeWidth="1.4" />
      <text x="100" y="20" textAnchor="middle" fontSize="15" fontWeight="700" fill={brand}>52</text>
      {/* dimension: bridge */}
      <path d="M160 50H200M160 44v12M200 44v12" stroke={oak} strokeWidth="1.4" />
      <text x="180" y="40" textAnchor="middle" fontSize="15" fontWeight="700" fill={oak}>18</text>
      {/* front */}
      <path d="M40 66C40 60 44 58 50 58H150C156 58 160 61 160 66V104C160 116 152 122 140 122H62C50 122 40 116 40 104Z" fill="#eef4f0" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
      <path d="M200 66C200 61 204 58 210 58H310C316 58 320 60 320 66V104C320 116 310 122 298 122H220C208 122 200 116 200 104Z" fill="#eef4f0" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
      <path d="M160 72C170 64 190 64 200 72" stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M40 66L26 62M320 66L334 62" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M58 72C64 68 72 67 80 67" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      {/* temple */}
      <path d="M30 170H300C316 170 326 176 334 190" stroke={ink} strokeWidth="14" strokeLinecap="round" fill="none" />
      <text x="140" y="170" dominantBaseline="central" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.2" fill="#f7f3ee">52□18 145</text>
      <path d="M30 202H334M30 196v12M334 196v12" stroke={brand} strokeWidth="1.4" />
      <text x="182" y="222" textAnchor="middle" fontSize="15" fontWeight="700" fill={brand}>145</text>
    </svg>
  );
}
