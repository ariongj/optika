import { useId } from 'react';
import { asset } from '@/lib/paths';
import { cn } from '@/lib/utils';

/**
 * Optika Miftari mark: the script "M" monogram in a fine ring, beside the spaced OPTIKA / MIFTARI wordmark.
 * The monogram is a black-on-transparent PNG; a colour-matrix filter repaints it for the light tone.
 * One SVG, so the whole lock-up scales with the height class it is given (h-6 … h-14).
 */
function Monogram({ x, y, size, tone }: { x: number; y: number; size: number; tone: 'dark' | 'light' }) {
  const id = useId().replace(/:/g, '');
  const ink = tone === 'dark' ? 'var(--color-ink)' : '#ffffff';
  return (
    <>
      {tone === 'light' && (
        <filter id={`w${id}`}>
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
        </filter>
      )}
      <circle cx={x + size / 2} cy={y + size / 2} r={size / 2 - 0.75} fill="none" stroke={ink} strokeOpacity={tone === 'dark' ? 0.22 : 0.5} strokeWidth="1.2" />
      <image
        href={asset('/images/brand/monogram.png')}
        x={x + size * 0.17}
        y={y + size * 0.17}
        width={size * 0.66}
        height={size * 0.66}
        filter={tone === 'light' ? `url(#w${id})` : undefined}
      />
    </>
  );
}

export function Logo({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  const ink = tone === 'dark' ? 'var(--color-ink)' : '#ffffff';
  return (
    <svg viewBox="0 0 168 48" className={cn('h-11 w-auto', className)} role="img" aria-label="Optika Miftari">
      <Monogram x={0} y={0} size={48} tone={tone} />
      <text x="60" y="20" fill={ink} fillOpacity={0.78} style={{ font: '700 9.5px var(--font-sans)', letterSpacing: '4.2px' }}>
        OPTIKA
      </text>
      <text x="59" y="38" fill={ink} style={{ font: '800 17.5px var(--font-sans)', letterSpacing: '3.6px' }}>
        MIFTARI
      </text>
    </svg>
  );
}

export function LogoMark({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-8 w-auto', className)} aria-hidden>
      <Monogram x={0} y={0} size={48} tone={tone} />
    </svg>
  );
}
