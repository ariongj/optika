import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowRight, Home, Search } from 'lucide-react';
import { Accent, Img } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { CategoryTiles } from '@/site/components/utility/CategoryTiles';
import { defineDict, useDict } from '@/i18n';
import { useCategories } from '@/store/hooks';

const T = defineDict({
  me: {
    pageTitle: 'Stranica nije pronađena',
    eyebrow: 'Greška 404',
    title: 'Ova stranica se *ne vidi jasno*.',
    text: 'Stranica koju tražite ne postoji ili je premeštena. Ostatak optike vidi se savršeno — krenite odavde.',
    requested: 'Tražena adresa',
    home: 'Na početnu',
    products: 'Pogledajte proizvode',
    searchPh: 'Tražite okvire, naočare za sunce, sočiva…',
    searchBtn: 'Traži',
    maybeEyebrow: 'Možda tražite',
    maybeTitle: 'Krenite od *kategorije*',
  },
  sq: {
    pageTitle: 'Faqja nuk u gjet',
    eyebrow: 'Gabim 404',
    title: 'Kjo faqe *nuk shihet qartë*.',
    text: 'Faqja që kërkoni nuk ekziston ose është zhvendosur. Pjesa tjetër e optikës shihet në mënyrë të përsosur — nisni nga këtu.',
    requested: 'Adresa e kërkuar',
    home: 'Në ballinë',
    products: 'Shikoni produktet',
    searchPh: 'Kërkoni korniza, syze dielli, lente…',
    searchBtn: 'Kërko',
    maybeEyebrow: 'Ndoshta kërkoni',
    maybeTitle: 'Nisni nga një *kategori*',
  },
  en: {
    pageTitle: 'Page not found',
    eyebrow: 'Error 404',
    title: 'This page is *out of focus*.',
    text: 'The page you’re looking for doesn’t exist or has moved. The rest of the store is in perfect focus — start here.',
    requested: 'Requested address',
    home: 'Back to home',
    products: 'Browse products',
    searchPh: 'Search frames, sunglasses, lenses…',
    searchBtn: 'Search',
    maybeEyebrow: 'You might be looking for',
    maybeTitle: 'Start with a *category*',
  },
});

export default function NotFound() {
  const t = useDict(T);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cats = useCategories();
  const [q, setQ] = useState('');
  usePageTitle(t('pageTitle'));

  // The "0" is a lens: a round, slightly blurred photo of the optical category that snaps into focus on hover
  const lens = cats.find((c) => c.slug === 'syze-optike') ?? cats[0];

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="bg-grain absolute inset-0 -z-10" />
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(70%_55%_at_50%_0%,var(--color-sand)_0%,transparent_75%)]" />

        <div className="container-x flex flex-col items-center pb-16 pt-12 text-center sm:pb-20 sm:pt-16">
          <div className="eyebrow animate-fade-up">{t('eyebrow')}</div>

          <div aria-hidden className="display mt-5 flex animate-fade-up select-none items-baseline justify-center text-[148px] leading-[0.78] tracking-[-0.04em] text-ink [animation-delay:60ms] sm:text-[230px] lg:text-[280px]">
            <span>4</span>
            <span className="group relative mx-[0.06em] inline-block h-[0.66em] w-[0.66em] -translate-y-[0.02em] overflow-hidden rounded-full bg-sand shadow-[0_30px_60px_-30px_rgba(28,26,23,0.55)] ring-[0.03em] ring-ink">
              {lens && <Img src={lens.image} small eager alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-[5px] transition-[filter,transform] duration-700 group-hover:scale-100 group-hover:blur-0" />}
              <span className="absolute inset-0 bg-gradient-to-t from-ink/30 to-transparent" />
              {/* lens glare */}
              <span className="absolute left-[20%] top-[13%] h-[14%] w-[26%] -rotate-[24deg] rounded-full bg-white/25 blur-[3px]" />
            </span>
            <span>4</span>
          </div>

          <h1 className="display mt-8 max-w-2xl animate-fade-up text-[34px] leading-[1.06] text-ink [animation-delay:120ms] sm:mt-10 sm:text-[52px]">
            <Accent text={t('title')} />
          </h1>
          <p className="mt-4 max-w-xl animate-fade-up text-[16.5px] leading-relaxed text-muted [animation-delay:160ms]">{t('text')}</p>

          <div className="mt-5 inline-flex max-w-full animate-fade-up items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] text-muted ring-1 ring-line [animation-delay:180ms]">
            <span className="shrink-0 font-semibold">{t('requested')}:</span>
            <code className="truncate font-mono text-ink-soft">{pathname}</code>
          </div>

          <div className="mt-8 flex w-full animate-fade-up flex-col items-stretch justify-center gap-3 [animation-delay:220ms] sm:w-auto sm:flex-row sm:items-center">
            <ButtonLink to="/" size="lg" icon={<Home className="h-4 w-4" />}>
              {t('home')}
            </ButtonLink>
            <ButtonLink to="/produktet" size="lg" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
              {t('products')}
            </ButtonLink>
          </div>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const v = q.trim();
              navigate(v ? `/kerko?q=${encodeURIComponent(v)}` : '/kerko');
            }}
            className="mt-6 flex w-full max-w-md animate-fade-up items-center gap-2 rounded-full border border-line bg-white p-1.5 pl-5 shadow-[0_14px_40px_-28px_rgba(28,26,23,0.5)] transition-colors [animation-delay:260ms] focus-within:border-ink/30"
          >
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchPh')}
              aria-label={t('searchPh')}
              enterKeyHint="search"
              className="h-10 min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-muted/70"
            />
            <button type="submit" className="h-10 shrink-0 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-brand-600">
              {t('searchBtn')}
            </button>
          </form>
        </div>
      </section>

      <section className="container-x pt-14 sm:pt-20">
        <div className="mb-8 text-center">
          <div className="eyebrow mb-3">{t('maybeEyebrow')}</div>
          <h2 className="display text-[30px] leading-[1.05] text-ink sm:text-[40px]">
            <Accent text={t('maybeTitle')} />
          </h2>
        </div>
        <CategoryTiles variant="compact" />
      </section>
    </>
  );
}
