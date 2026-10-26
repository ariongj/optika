import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowRight, ChevronRight, Clock, FileSearch, FileText, Mail, Phone, RefreshCw, Send } from 'lucide-react';
import { Markdown } from '@/components/ui/Markdown';
import { ButtonLink } from '@/components/ui/Button';
import { PageHero } from '@/site/components/SectionHeading';
import { NotFoundBlock } from '@/site/components/content/NotFoundBlock';
import { C } from '@/site/components/content/dict';
import { telHref } from '@/site/components/content/posts';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { defineDict, useDict, useL, useLang } from '@/i18n';
import { useDb } from '@/store/db';
import { useSettings } from '@/store/hooks';
import { date } from '@/lib/format';
import { leadsLive } from '@/lib/leads';
import { cn } from '@/lib/utils';

const T = defineDict({
  me: {
    eyebrow: 'Informacije za kupce',
    updated: 'Ažurirano {date}',
    pages: 'Korisne informacije',
    help_title: 'Imate pitanje?',
    help_text: 'Naš tim vam rado pomaže — pozovite nas ili pošaljite poruku, odgovaramo istog dana.',
    contact: 'Pišite nam',
    nf_eyebrow: 'Stranica nije pronađena',
    nf_title: 'Ova stranica *ne postoji*',
    nf_text: 'Možda je uklonjena ili je adresa pogrešno unesena. Evo stranica koje bi vam mogle pomoći.',
    nf_contact: 'Kontakt',
    forms_on: 'Slanje obrazaca je uključeno: ono što pošaljete putem obrazaca stiže nam e-mailom preko Web3Forms.',
    forms_off: 'Slanje obrazaca još nije uključeno: ono što unesete u obrasce ostaje samo u vašem pregledaču i ne šalje se nama niti bilo kome drugom. Pozovite nas ili nam pišite na WhatsApp ili e-mail.',
  },
  sq: {
    eyebrow: 'Informacione për klientët',
    updated: 'Përditësuar më {date}',
    pages: 'Informacione të dobishme',
    help_title: 'Keni ndonjë pyetje?',
    help_text: 'Ekipi ynë ju ndihmon me kënaqësi — na telefononi ose na shkruani, përgjigjemi të njëjtën ditë.',
    contact: 'Na shkruani',
    nf_eyebrow: 'Faqja nuk u gjet',
    nf_title: 'Kjo faqe *nuk ekziston*',
    nf_text: 'Mund të jetë hequr ose adresa është shkruar gabim. Ja disa faqe që mund t’ju ndihmojnë.',
    nf_contact: 'Kontakt',
    forms_on: 'Dërgimi i formularëve është aktiv: ajo që dërgoni përmes formularëve na arrin me e-mail përmes Web3Forms.',
    forms_off: 'Dërgimi i formularëve ende nuk është aktiv: ajo që shkruani në formularë mbetet vetëm në shfletuesin tuaj dhe nuk i dërgohet as neve, as askujt tjetër. Na telefononi ose na shkruani në WhatsApp ose me e-mail.',
  },
  en: {
    eyebrow: 'Customer information',
    updated: 'Updated {date}',
    pages: 'Useful information',
    help_title: 'Have a question?',
    help_text: 'Our team is happy to help — call us or send a message and we’ll reply the same day.',
    contact: 'Write to us',
    nf_eyebrow: 'Page not found',
    nf_title: 'This page *doesn’t exist*',
    nf_text: 'It may have been removed or the address was mistyped. Here are some pages that might help.',
    nf_contact: 'Contact',
    forms_on: 'Form sending is on: what you send through the forms reaches us by e-mail via Web3Forms.',
    forms_off: 'Form sending is not switched on yet: what you enter in the forms stays only in your browser and is not sent to us or anyone else. Call us, or write to us on WhatsApp or by e-mail.',
  },
});

const PROSE = cn(
  'text-[16.5px] sm:text-[17px]',
  '[&_p]:leading-[1.8] [&_li]:leading-[1.7] [&_ul]:space-y-2 [&_li::marker]:text-brand-600',
  '[&_h2]:mt-12 [&_h2]:border-t [&_h2]:border-line [&_h2]:pt-10 [&_h2]:text-[28px] [&_h2]:leading-tight sm:[&_h2]:text-[30px]',
  '[&>p:first-child]:mt-0 [&>p:first-child]:text-[19px] [&>p:first-child]:leading-[1.65] [&>p:first-child]:text-ink sm:[&>p:first-child]:text-[20px]',
);

export default function CmsPageView() {
  const { slug } = useParams();
  const t = useDict(T);
  const c = useDict(C);
  const l = useL();
  const lang = useLang();
  const settings = useSettings();
  const all = useDb((s) => s.pages);
  const published = useMemo(() => all.filter((p) => p.published), [all]);
  const page = published.find((p) => p.slug === slug);
  usePageTitle(page ? l(page.title) : t('nf_eyebrow'));

  const nav = (
    <nav aria-label={t('pages')} className="rounded-3xl bg-white p-3 ring-1 ring-line">
      <div className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('pages')}</div>
      <ul>
        {published.map((p) => {
          const current = p.id === page?.id;
          return (
            <li key={p.id}>
              <Link
                to={`/faqe/${p.slug}`}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl px-3 py-3 text-[14.5px] font-semibold transition-colors',
                  current ? 'bg-sand/80 text-ink' : 'text-ink-soft hover:bg-sand/50 hover:text-ink',
                )}
              >
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors', current ? 'bg-brand-600 text-white' : 'bg-paper text-muted group-hover:text-brand-700')}>
                  <FileText className="h-4 w-4" />
                </span>
                <span className="flex-1">{l(p.title)}</span>
                <ChevronRight className={cn('h-4 w-4 transition-transform group-hover:translate-x-0.5', current ? 'text-brand-600' : 'text-ink/25')} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  if (!page) {
    return (
      <NotFoundBlock
        icon={<FileSearch className="h-7 w-7" />}
        eyebrow={t('nf_eyebrow')}
        title={t('nf_title')}
        text={t('nf_text')}
        actions={
          <>
            <ButtonLink to="/" variant="dark" iconRight={<ArrowRight className="h-4 w-4" />}>
              {c('home')}
            </ButtonLink>
            <ButtonLink to="/kontakt" variant="outline">
              {t('nf_contact')}
            </ButtonLink>
          </>
        }
      >
        {published.length > 0 && <div className="mx-auto max-w-md">{nav}</div>}
      </NotFoundBlock>
    );
  }

  const title = l(page.title);

  return (
    <>
      <PageHero eyebrow={t('eyebrow')} title={title} crumbs={[{ label: title }]}>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-muted ring-1 ring-line">
          <RefreshCw className="h-3.5 w-3.5 text-brand-600" />
          <time dateTime={page.updatedAt}>{t('updated', { date: date(page.updatedAt, lang, { day: 'numeric', month: 'long', year: 'numeric' }) })}</time>
        </div>
      </PageHero>

      <section className="py-14 sm:py-20">
        <div className="container-x grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
          <article className="min-w-0 max-w-[740px] animate-fade-up">
            <Markdown source={l(page.body)} className={PROSE} />
            {/* the privacy notice says whether forms are actually delivered (a Web3Forms key in the build) */}
            {page.slug === 'privatesia' && (
              <p className="mt-12 flex gap-3 rounded-2xl bg-white p-5 text-[15px] leading-relaxed text-ink-soft ring-1 ring-line">
                <Send className="mt-1 h-4 w-4 shrink-0 text-brand-600" />
                <span>{t(leadsLive ? 'forms_on' : 'forms_off')}</span>
              </p>
            )}
          </article>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            {published.length > 1 && nav}

            <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-7">
              <div className="bg-grain pointer-events-none absolute inset-0" />
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-600/35 blur-3xl" />
              <div className="relative">
                <h2 className="display text-[28px] leading-tight">{t('help_title')}</h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-paper/65">{t('help_text')}</p>
                <ul className="mt-6 space-y-3 text-[14.5px]">
                  <li>
                    <a href={telHref(settings.phone)} className="group flex items-center gap-3 font-semibold text-white">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-brand-200 ring-1 ring-white/10 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                        <Phone className="h-4 w-4" />
                      </span>
                      {settings.phone}
                    </a>
                  </li>
                  <li>
                    <a href={`mailto:${settings.email}`} className="group flex items-center gap-3 font-semibold text-white">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-brand-200 ring-1 ring-white/10 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                        <Mail className="h-4 w-4" />
                      </span>
                      {settings.email}
                    </a>
                  </li>
                  <li className="flex items-center gap-3 text-paper/75">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-brand-200 ring-1 ring-white/10">
                      <Clock className="h-4 w-4" />
                    </span>
                    {l(settings.hours)}
                  </li>
                </ul>
                <ButtonLink to="/kontakt" variant="light" className="mt-7 w-full" iconRight={<ArrowRight className="h-4 w-4" />}>
                  {t('contact')}
                </ButtonLink>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
