import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowRight, CalendarDays, Clock, FileQuestion } from 'lucide-react';
import type { HomeSection } from '@/lib/types';
import { Img, Reveal, plain } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';
import { Breadcrumbs, SectionHeading } from '@/site/components/SectionHeading';
import { AuthorAvatar, PostCard, PostMeta } from '@/site/components/content/PostCard';
import { ShareButtons } from '@/site/components/content/ShareButtons';
import { MeasureCta } from '@/site/components/content/MeasureCta';
import { NotFoundBlock } from '@/site/components/content/NotFoundBlock';
import { C } from '@/site/components/content/dict';
import { headingsOf, postHref, tagKey, usePublishedPosts } from '@/site/components/content/posts';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { defineDict, useDict, useL, useLang } from '@/i18n';
import { useDb } from '@/store/db';
import { date } from '@/lib/format';
import { cn } from '@/lib/utils';

const T = defineDict({
  me: {
    blog: 'Saveti',
    by: 'Autor',
    toc: 'U ovom članku',
    related_eyebrow: 'Nastavite čitanje',
    related_title: 'Još *korisnih saveta*',
    allPosts: 'Svi saveti',
    nf_eyebrow: 'Članak nije pronađen',
    nf_title: 'Ovaj članak je *van fokusa*',
    nf_text: 'Članak je možda uklonjen ili mu je promenjena adresa. Pogledajte ostale savete naših optičara.',
    nf_suggest: 'Možda vas zanima',
    authorNote: 'Saveti iz prakse — iz naše optike i laboratorije u Mitrovici.',
  },
  sq: {
    blog: 'Këshilla',
    by: 'Autori',
    toc: 'Në këtë artikull',
    related_eyebrow: 'Vazhdoni leximin',
    related_title: 'Më shumë *këshilla të dobishme*',
    allPosts: 'Të gjitha këshillat',
    nf_eyebrow: 'Artikulli nuk u gjet',
    nf_title: 'Ky artikull *ka dalë nga fokusi*',
    nf_text: 'Artikulli mund të jetë hequr ose adresa i është ndryshuar. Shikoni këshillat e tjera të optikëve tanë.',
    nf_suggest: 'Mund t’ju interesojë',
    authorNote: 'Këshilla nga praktika — nga optika dhe laboratori ynë në Mitrovicë.',
  },
  en: {
    blog: 'Advice',
    by: 'Written by',
    toc: 'In this article',
    related_eyebrow: 'Keep reading',
    related_title: 'More *useful advice*',
    allPosts: 'All advice',
    nf_eyebrow: 'Article not found',
    nf_title: 'This article is *out of focus*',
    nf_text: 'It may have been removed or its address changed. Have a look at the other guides from our opticians.',
    nf_suggest: 'You might like',
    authorNote: 'Advice from practice — from our store and lab in Mitrovica.',
  },
});

/** Editorial typography on top of `.prose-cms`: lead paragraph with drop cap, larger headings, tip-style quotes. */
const ARTICLE = cn(
  'text-[17px] sm:text-[18px]',
  '[&_p]:leading-[1.8] [&_li]:leading-[1.7] [&_ul]:space-y-2 [&_li::marker]:text-brand-600',
  '[&_h2]:mt-12 [&_h2]:scroll-mt-28 [&_h2]:text-[28px] [&_h2]:leading-tight sm:[&_h2]:text-[32px]',
  '[&>p:first-child]:mt-0 [&>p:first-child]:text-[19px] [&>p:first-child]:text-ink sm:[&>p:first-child]:text-[21px] [&>p:first-child]:leading-[1.7]',
  '[&>p:first-child::first-letter]:float-left [&>p:first-child::first-letter]:mr-3 [&>p:first-child::first-letter]:mt-[6px] [&>p:first-child::first-letter]:font-display [&>p:first-child::first-letter]:text-[74px] [&>p:first-child::first-letter]:leading-[0.8] [&>p:first-child::first-letter]:text-brand-600',
  '[&_blockquote]:my-10 [&_blockquote]:rounded-r-2xl [&_blockquote]:border-l-[3px] [&_blockquote]:bg-sand/70 [&_blockquote]:py-6 [&_blockquote]:pl-6 [&_blockquote]:pr-6 [&_blockquote]:text-[21px] [&_blockquote]:leading-snug sm:[&_blockquote]:pl-8 sm:[&_blockquote]:text-[23px]',
);

type CtaData = Extract<HomeSection, { type: 'cta' }>;

/** Thin brand-colour bar at the very top showing how far through the article the reader is. */
function ReadingProgress({ target }: { target: RefObject<HTMLElement | null> }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = target.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const end = top + el.offsetHeight - window.innerHeight * 0.75;
        const v = (window.scrollY - top + 120) / Math.max(1, end - top + 120);
        setP(Math.min(1, Math.max(0, v)));
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [target]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]" aria-hidden>
      <div className="h-full origin-left bg-brand-600 transition-transform duration-150 ease-out" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}

/** Sticky table of contents with scroll-spy (headings are matched by order). */
function Toc({ items, bodyRef, label }: { items: string[]; bodyRef: RefObject<HTMLElement | null>; label: string }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const update = () => {
      const hs = bodyRef.current?.querySelectorAll('h2');
      if (!hs) return;
      let idx = 0;
      hs.forEach((h, i) => {
        if (h.getBoundingClientRect().top < window.innerHeight * 0.35) idx = i;
      });
      setActive(idx);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [bodyRef, items]);
  const go = (i: number) => bodyRef.current?.querySelectorAll('h2')[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav aria-label={label}>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{label}</div>
      <ol className="mt-4 border-l border-line">
        {items.map((h, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => go(i)}
              className={cn(
                '-ml-px block w-full border-l-2 py-2 pl-4 text-left text-[13.5px] leading-snug transition-colors',
                active === i ? 'border-brand-600 font-semibold text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {h}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function PostPage() {
  const { slug } = useParams();
  const t = useDict(T);
  const c = useDict(C);
  const l = useL();
  const lang = useLang();
  const posts = usePublishedPosts();
  const ctaImage = useDb((s) => s.home.find((h): h is CtaData => h.type === 'cta')?.data.image);
  const post = posts.find((p) => p.slug === slug);
  const articleRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const title = post ? plain(l(post.title)) : '';
  usePageTitle(post ? title : t('nf_eyebrow'));

  const body = post ? l(post.body) : '';
  const toc = useMemo(() => headingsOf(body), [body]);
  const related = useMemo(() => {
    if (!post) return [];
    const key = tagKey(post);
    return posts
      .filter((p) => p.id !== post.id)
      .map((p, i) => ({ p, score: (tagKey(p) === key ? 100 : 0) - i }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.p);
  }, [posts, post]);

  if (!post) {
    return (
      <NotFoundBlock
        icon={<FileQuestion className="h-7 w-7" />}
        eyebrow={t('nf_eyebrow')}
        title={t('nf_title')}
        text={t('nf_text')}
        actions={
          <>
            <ButtonLink to="/keshilla" variant="dark" iconRight={<ArrowRight className="h-4 w-4" />}>
              {t('allPosts')}
            </ButtonLink>
            <ButtonLink to="/" variant="outline">
              {c('home')}
            </ButtonLink>
          </>
        }
      >
        {posts.length > 0 && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('nf_suggest')}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {posts.slice(0, 3).map((p) => (
                <Link key={p.id} to={postHref(p)} className="group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-sand/60 sm:flex-col sm:items-start">
                  <div className="aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl bg-sand sm:w-full">
                    <Img src={p.cover} small alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </div>
                  <div className="min-w-0 sm:px-1 sm:pb-1">
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">{l(p.tag)}</div>
                    <div className="mt-1 line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink group-hover:text-brand-700">{plain(l(p.title))}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </NotFoundBlock>
    );
  }

  return (
    <>
      <ReadingProgress target={articleRef} />
      <article ref={articleRef}>
        {/* Cover hero */}
        <header className="pt-10 sm:pt-14">
          <div className="container-x">
            <div className="mx-auto max-w-[880px] text-center">
              <div className="flex justify-center">
                <Breadcrumbs items={[{ label: t('blog'), to: '/keshilla' }, { label: l(post.tag) }]} />
              </div>
              <h1 className="display mt-8 animate-fade-up text-[38px] leading-[1.05] text-ink sm:text-[56px] lg:text-[64px]">{title}</h1>
              <p className="mx-auto mt-5 max-w-2xl animate-fade-up text-[17px] leading-relaxed text-muted [animation-delay:80ms] sm:text-[19px]">{l(post.excerpt)}</p>
              <div className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-x-4 gap-y-3 text-[13.5px] font-semibold text-muted [animation-delay:160ms]">
                <Link to={`/keshilla?tag=${tagKey(post)}`} className="rounded-full bg-brand-50 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-700 transition-colors hover:bg-brand-100">
                  {l(post.tag)}
                </Link>
                <span className="h-1 w-1 rounded-full bg-muted/40" />
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  <time dateTime={post.publishedAt}>{date(post.publishedAt, lang, { day: 'numeric', month: 'long', year: 'numeric' })}</time>
                </span>
                <span className="h-1 w-1 rounded-full bg-muted/40" />
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {c('minRead', { n: post.readMinutes })}
                </span>
                <span className="h-1 w-1 rounded-full bg-muted/40" />
                <span className="inline-flex items-center gap-2 text-ink">
                  <AuthorAvatar name={post.author} className="h-8 w-8" />
                  {post.author}
                </span>
                <ShareButtons title={title} variant="pill" className="lg:hidden" />
              </div>
            </div>
            <div className="relative mt-10 aspect-[4/3] animate-fade-in overflow-hidden rounded-[28px] bg-sand sm:mt-12 sm:aspect-[2/1] sm:rounded-[36px] lg:aspect-[21/9]">
              <Img src={post.cover} eager alt={title} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/20 via-transparent to-transparent" />
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="container-x pb-20 pt-12 sm:pb-24 sm:pt-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,700px)_minmax(0,1fr)] lg:gap-12">
            <aside className="hidden lg:block">
              <div className="sticky top-28 flex justify-end pr-4">
                <ShareButtons title={title} variant="rail" />
              </div>
            </aside>

            <div className="min-w-0">
              <div ref={bodyRef}>
                <Markdown source={body} className={ARTICLE} />
              </div>

              <div className="mt-14 flex flex-col gap-6 border-y border-line py-7 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <AuthorAvatar name={post.author} className="h-14 w-14" />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('by')}</div>
                    <div className="mt-0.5 text-[16px] font-bold text-ink">{post.author}</div>
                    <div className="mt-0.5 max-w-[34ch] text-[13px] leading-snug text-muted">{t('authorNote')}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 sm:items-end">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{c('shareArticle')}</span>
                  <ShareButtons title={title} variant="row" />
                </div>
              </div>
            </div>

            <aside className="hidden lg:block">
              {toc.length > 1 && (
                <div className="sticky top-28 pl-4">
                  <Toc items={toc} bodyRef={bodyRef} label={t('toc')} />
                  <div className="mt-8 rounded-2xl bg-white p-4 ring-1 ring-line">
                    <PostMeta post={post} />
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </article>

      <section className="pb-20 sm:pb-24">
        <div className="container-x">
          <Reveal>
            <MeasureCta image={ctaImage || post.cover} />
          </Reveal>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-sand/60 py-20 sm:py-24">
          <div className="container-x">
            <Reveal>
              <SectionHeading
                eyebrow={t('related_eyebrow')}
                title={t('related_title')}
                action={
                  <ButtonLink to="/keshilla" variant="outline" iconRight={<ArrowRight className="h-4 w-4" />}>
                    {t('allPosts')}
                  </ButtonLink>
                }
              />
            </Reveal>
            <div className={cn('mt-12 grid gap-x-8 gap-y-12', related.length >= 3 ? 'md:grid-cols-3' : 'lg:grid-cols-2')}>
              {related.map((p, i) => (
                <Reveal key={p.id} delay={i * 90} className="h-full">
                  <PostCard post={p} layout={related.length >= 3 ? 'vertical' : 'horizontal'} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
