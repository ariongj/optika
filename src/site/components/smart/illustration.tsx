import { PenLine } from 'lucide-react';
import { useDict } from '@/i18n';
import { common } from '@/i18n/common';
import { cn } from '@/lib/utils';

/**
 * Bundled line-art drawings (the smart-glasses section shows illustrations, not brand photography —
 * we have no rights to those). Matches with or without the deploy base ("/optika/images/smart/…").
 */
export const isIllustration = (src?: string | null) => !!src && /\/images\/(?:smart\/|cat\/smart)/.test(src);

/** Small "Illustration" label laid over an illustrated image. */
export function IllustrationChip({ className }: { className?: string }) {
  const tc = useDict(common);
  return (
    <span
      className={cn(
        'pointer-events-none inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-soft shadow-sm ring-1 ring-ink/10 backdrop-blur',
        className,
      )}
    >
      <PenLine className="h-3 w-3" />
      {tc('illustration')}
    </span>
  );
}
