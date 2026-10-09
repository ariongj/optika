import { Link } from 'react-router';
import { ArrowRight, Clock } from 'lucide-react';
import type { Post } from '@/lib/types';
import { Img, plain } from '@/components/ui/misc';
import { LogoMark } from '@/components/brand/Logo';
import { useDict, useL, useLang } from '@/i18n';
import { date } from '@/lib/format';
import { cn, initials } from '@/lib/utils';
import { C } from './dict';
import { postHref } from './posts';

/** Round author avatar — the Miftari monogram for in-house authors (store, lab, clinic), initials otherwise. */
export function AuthorAvatar({ name, className }: { name: string; className?: string }) {
  const team = /optika|miftari|optical lab|klinika|ekipi|team/i.test(name);
  return (
    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1', team ? 'bg-white ring-line' : 'bg-ink text-paper ring-ink', className)} aria-hidden>
      {team ? <LogoMark className="h-[80%] w-auto" /> : <span className="text-[11px] font-bold tracking-wider">{initials(name)}</span>}
    </span>
  );
}

/** "12. sep 2026. · 4 min čitanja" */
export function PostMeta({ post, className, long }: { post: Post; className?: string; long?: boolean }) {
  const lang = useLang();
  const c = useDict(C);
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] font-semibold text-muted', className)}>
      <time dateTime={post.publishedAt}>{date(post.publishedAt, lang, long ? { day: 'numeric', month: 'long', year: 'numeric' } : undefined)}</time>
      <span className="h-1 w-1 rounded-full bg-current opacity-40" />
      <span className="inline-flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        {c('minRead', { n: post.readMinutes })}
      </span>
    </div>
  );
}

function TagChip({ children, className }: { children: string; className?: string }) {
  return <span className={cn('rounded-full bg-white/92 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-sm backdrop-blur', className)}>{children}</span>;
}

/** Blog card. `horizontal` puts the cover beside the text from `sm` up. */
export function PostCard({ post, layout = 'vertical', className, priority }: { post: Post; layout?: 'vertical' | 'horizontal'; className?: string; priority?: boolean }) {
  const l = useL();
  const c = useDict(C);
  const title = plain(l(post.title));

  const cover = (
    <div className={cn('relative overflow-hidden rounded-3xl bg-sand', layout === 'horizontal' ? 'aspect-[4/3] sm:aspect-[5/4]' : 'aspect-[4/3]')}>
      <Img src={post.cover} small eager={priority} alt={title} className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <TagChip className="absolute left-4 top-4">{l(post.tag)}</TagChip>
    </div>
  );

  const body = (
    <div className={cn('flex flex-1 flex-col', layout === 'vertical' && 'pt-5')}>
      <PostMeta post={post} />
      <h3 className={cn('display mt-2.5 leading-[1.12] text-ink transition-colors group-hover:text-brand-700', layout === 'horizontal' ? 'text-[24px] sm:text-[26px]' : 'text-[25px] sm:text-[27px]')}>{title}</h3>
      <p className="mt-2.5 line-clamp-3 text-[15px] leading-relaxed text-muted">{l(post.excerpt)}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-ink">
        <span className="link-u">{c('readArticle')}</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </div>
  );

  if (layout === 'horizontal') {
    return (
      <Link to={postHref(post)} className={cn('group grid items-center gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] sm:gap-7', className)}>
        {cover}
        {body}
      </Link>
    );
  }
  return (
    <Link to={postHref(post)} className={cn('group flex h-full flex-col', className)}>
      {cover}
      {body}
    </Link>
  );
}
