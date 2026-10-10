import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Choice<T extends string> {
  id: T;
  label: ReactNode;
  hint?: ReactNode;
  /** Illustration / icon shown above (tile) or beside (row) the label. */
  visual?: ReactNode;
  className?: string;
}

/**
 * Accessible single-choice group (WAI-ARIA radio group): one tab stop, arrow keys / Home / End move the
 * selection, Space / Enter (or a click) "pick" an option — the quizzes use `onPick` to advance a step,
 * while arrow keys only change the selection.
 */
export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  onPick,
  labelledBy,
  ariaLabel,
  describedBy,
  variant = 'tile',
  tone = 'light',
  indicator = true,
  className,
}: {
  options: Choice<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  onPick?: (v: T) => void;
  labelledBy?: string;
  ariaLabel?: string;
  describedBy?: string;
  variant?: 'tile' | 'row' | 'pill';
  tone?: 'light' | 'dark';
  /** show the round check mark on tiles / rows */
  indicator?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((o) => o.id === value);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = options.length;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].id);
    refs.current[next]?.focus();
  };

  const dark = tone === 'dark';
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-label={ariaLabel} aria-describedby={describedBy} className={className}>
      {options.map((o, i) => {
        const checked = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (current < 0 && i === 0) ? 0 : -1}
            onClick={() => {
              onChange(o.id);
              onPick?.(o.id);
            }}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'group/choice relative text-left outline-none transition-[background,box-shadow,color,transform] duration-200 focus-visible:ring-4 motion-reduce:transition-none',
              dark ? 'focus-visible:ring-brand-200/40' : 'focus-visible:ring-brand-600/25',
              variant === 'pill'
                ? cn(
                    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-semibold ring-1',
                    checked
                      ? dark
                        ? 'bg-white text-ink ring-white'
                        : 'bg-ink text-paper ring-ink'
                      : dark
                        ? 'bg-white/5 text-white/85 ring-white/20 hover:bg-white/10'
                        : 'bg-white text-ink-soft ring-line hover:ring-ink/30',
                  )
                : cn(
                    'flex rounded-2xl ring-1 active:scale-[0.99]',
                    variant === 'tile' ? 'flex-col items-start gap-3 p-4 sm:p-5' : cn('items-center gap-4 p-3.5 sm:p-4', indicator && 'pr-11 sm:pr-12'),
                    checked ? 'bg-brand-50 ring-2 ring-brand-600' : 'bg-white ring-line hover:ring-ink/25 hover:shadow-[0_14px_30px_-22px_rgba(28,26,23,0.45)]',
                  ),
              o.className,
            )}
          >
            {variant !== 'pill' && indicator && (
              <span
                aria-hidden
                className={cn(
                  'absolute grid h-6 w-6 place-items-center rounded-full border transition-colors motion-reduce:transition-none',
                  variant === 'row' ? 'right-3.5 top-1/2 -translate-y-1/2' : 'right-3 top-3',
                  checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-transparent',
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            )}
            {o.visual && <span className={cn('shrink-0', variant === 'pill' && 'inline-flex')}>{o.visual}</span>}
            {variant === 'pill' ? (
              <span>{o.label}</span>
            ) : (
              <span className={cn('min-w-0', variant === 'tile' && indicator && 'pr-6')}>
                <span className="block text-[15px] font-semibold leading-snug text-ink">{o.label}</span>
                {o.hint && <span className="mt-1 block text-[13px] leading-snug text-muted">{o.hint}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
