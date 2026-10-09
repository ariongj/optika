import { useEffect, useState, type ComponentType } from 'react';
import { toast } from 'sonner';
import { Check, Link2, Share2 } from 'lucide-react';
import { FacebookIcon, ViberIcon, WhatsAppIcon } from '@/components/brand/Social';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import { C } from './dict';
import { copyText } from './posts';

type Net = { id: string; label: string; href: string; Icon: ComponentType<{ className?: string }> };

function networks(title: string, url: string): Net[] {
  const text = encodeURIComponent(`${title} — ${url}`);
  return [
    { id: 'wa', label: 'WhatsApp', href: `https://wa.me/?text=${text}`, Icon: WhatsAppIcon },
    { id: 'vb', label: 'Viber', href: `viber://forward?text=${text}`, Icon: ViberIcon },
    { id: 'fb', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, Icon: FacebookIcon },
  ];
}

function useCopyLink() {
  const c = useDict(C);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2200);
    return () => clearTimeout(t);
  }, [done]);
  const copy = async () => {
    const ok = await copyText(window.location.href);
    if (ok) {
      setDone(true);
      toast.success(c('copied'), { description: c('copiedText') });
    } else toast.error(c('copyFailed'));
  };
  return { done, copy };
}

/**
 * Share controls for an article.
 * - `pill`: one compact "Share" button (copies the link)
 * - `row`: copy-link button + network icons
 * - `rail`: vertical icon stack for a sticky side column
 */
export function ShareButtons({ title, variant = 'row', className }: { title: string; variant?: 'pill' | 'row' | 'rail'; className?: string }) {
  const c = useDict(C);
  const { done, copy } = useCopyLink();
  const url = typeof window === 'undefined' ? '' : window.location.href;

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={copy}
        className={cn('inline-flex h-9 items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[13px] font-semibold text-ink transition hover:border-ink/35', className)}
      >
        {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
        {done ? c('copied') : c('share')}
      </button>
    );
  }

  const iconBtn = 'grid h-11 w-11 place-items-center rounded-full border border-ink/12 bg-white text-ink-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-white';

  if (variant === 'rail') {
    return (
      <div className={cn('flex flex-col items-start gap-2.5', className)}>
        <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{c('share')}</span>
        <button type="button" onClick={copy} className={cn(iconBtn, done && 'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-600 hover:bg-emerald-600')} aria-label={c('copyLink')} title={c('copyLink')}>
          {done ? <Check className="h-[18px] w-[18px]" /> : <Link2 className="h-[18px] w-[18px]" />}
        </button>
        {networks(title, url).map(({ id, label, href, Icon }) => (
          <a key={id} href={href} target="_blank" rel="noreferrer" className={iconBtn} aria-label={label} title={label}>
            <Icon className="h-[18px] w-[18px]" />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        onClick={copy}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
          done ? 'bg-emerald-600 text-white' : 'bg-ink text-paper hover:bg-ink-soft',
        )}
      >
        {done ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {done ? c('copied') : c('copyLink')}
      </button>
      {networks(title, url).map(({ id, label, href, Icon }) => (
        <a key={id} href={href} target="_blank" rel="noreferrer" className={iconBtn} aria-label={label} title={label}>
          <Icon className="h-[18px] w-[18px]" />
        </a>
      ))}
    </div>
  );
}
