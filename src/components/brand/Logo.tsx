import { useId } from 'react';
import { cn } from '@/lib/utils';

/*
 * Miftari Vision identity (2026 rebrand). The mark: two lens arcs under one arch whose halves meet in a V — measured
 * from the brand artwork (viewBox 0 0 256 251). The wordmark is Montserrat Bold (OFL), tracking 0.03 em, converted to
 * outlines so no extra font is loaded. The lock-up stacks MIFTARI / VISION beside the mark (as on the business card);
 * the text block is exactly as tall as the mark. Everything is one SVG, so it scales with its height class.
 */
const LENS_L = 'M0 49.04A102.3 102.3 0 0 1 0 250.96L0 230.63A82.3 82.3 0 0 0 0 69.37Z';
const LENS_R = 'M256 49.04A102.3 102.3 0 0 0 256 250.96L256 230.63A82.3 82.3 0 0 1 256 69.37Z';
const ARCH = 'M0 -0.07A152.5 152.5 0 0 1 128 90.39A152.5 152.5 0 0 1 256 -0.07L256 19.5A133 133 0 0 0 143.33 104.34L128 147.4L112.67 104.34A133 133 0 0 0 0 19.5Z';
const MIFTARI = 'M15.2 0L0 0L0 -70L13.4 -70L39.6 -26.5L65.4 -70L78.7 -70L78.9 0L63.7 0L63.6 -42L43 -7.4L35.7 -7.4L15.2 -41.1L15.2 0M114.7 0L98.5 0L98.5 -70L114.7 -70L114.7 0M150.5 0L134.3 0L134.3 -70L187.2 -70L187.2 -57L150.5 -57L150.5 -38.5L182.9 -38.5L182.9 -25.5L150.5 -25.5L150.5 0M231.9 0L215.7 0L215.7 -56.8L193.3 -56.8L193.3 -70L254.3 -70L254.3 -56.8L231.9 -56.8L231.9 0M273.4 0L256.8 0L288 -70L304 -70L335.3 0L318.3 0L312.1 -15L279.6 -15L273.4 0M284.8 -27.3L307 -27.3L295.9 -54.1L284.8 -27.3M361.8 0L345.6 0L345.6 -70L375.5 -70Q390.1 -70 398.2 -63.25Q406.3 -56.5 406.3 -44.6L406.3 -44.6Q406.3 -36.8 402.6 -31.15Q398.9 -25.5 392.1 -22.5L392.1 -22.5Q392 -22.5 392 -22.4L392 -22.4L407.6 0L390.1 0L376.7 -19.5Q376.3 -19.5 375.9 -19.5L375.9 -19.5L361.8 -19.5L361.8 0M361.8 -56.8L361.8 -32.4L375 -32.4Q382.5 -32.4 386.2 -35.65Q389.9 -38.9 389.9 -44.6L389.9 -44.6Q389.9 -50.4 386.2 -53.6Q382.5 -56.8 375 -56.8L375 -56.8L361.8 -56.8M438.3 0L422.1 0L422.1 -70L438.3 -70L438.3 0';
const VISION = 'M46.2 0L30.2 0L0 -70L17.5 -70L38.8 -20L60.4 -70L76.5 -70L46.2 0M103 0L86.8 0L86.8 -70L103 -70L103 0M145.6 1.2L145.6 1.2Q137.2 1.2 129.5 -1.05Q121.8 -3.3 117.1 -6.9L117.1 -6.9L122.6 -19.1Q127.1 -15.9 133.25 -13.85Q139.4 -11.8 145.7 -11.8L145.7 -11.8Q150.5 -11.8 153.45 -12.75Q156.4 -13.7 157.8 -15.4Q159.2 -17.1 159.2 -19.3L159.2 -19.3Q159.2 -22.1 157 -23.75Q154.8 -25.4 151.2 -26.45Q147.6 -27.5 143.25 -28.45Q138.9 -29.4 134.55 -30.8Q130.2 -32.2 126.6 -34.4Q123 -36.6 120.75 -40.2Q118.5 -43.8 118.5 -49.4L118.5 -49.4Q118.5 -55.4 121.75 -60.35Q125 -65.3 131.55 -68.25Q138.1 -71.2 148 -71.2L148 -71.2Q154.6 -71.2 161 -69.65Q167.4 -68.1 172.3 -65L172.3 -65L167.3 -52.7Q162.4 -55.5 157.5 -56.85Q152.6 -58.2 147.9 -58.2L147.9 -58.2Q143.2 -58.2 140.2 -57.1Q137.2 -56 135.9 -54.25Q134.6 -52.5 134.6 -50.2L134.6 -50.2Q134.6 -47.5 136.8 -45.85Q139 -44.2 142.6 -43.2Q146.2 -42.2 150.55 -41.2Q154.9 -40.2 159.25 -38.9Q163.6 -37.6 167.2 -35.4Q170.8 -33.2 173.05 -29.6Q175.3 -26 175.3 -20.5L175.3 -20.5Q175.3 -14.6 172 -9.7Q168.7 -4.8 162.15 -1.8Q155.6 1.2 145.6 1.2M205.6 0L189.4 0L189.4 -70L205.6 -70L205.6 0M259.2 1.2L259.2 1.2Q250.9 1.2 243.85 -1.5Q236.8 -4.2 231.65 -9.1Q226.5 -14 223.65 -20.6Q220.8 -27.2 220.8 -35L220.8 -35Q220.8 -42.8 223.65 -49.4Q226.5 -56 231.7 -60.9Q236.9 -65.8 243.9 -68.5Q250.9 -71.2 259.1 -71.2L259.1 -71.2Q267.4 -71.2 274.35 -68.5Q281.3 -65.8 286.45 -60.9Q291.6 -56 294.5 -49.45Q297.4 -42.9 297.4 -35L297.4 -35Q297.4 -27.2 294.5 -20.55Q291.6 -13.9 286.45 -9.05Q281.3 -4.2 274.35 -1.5Q267.4 1.2 259.2 1.2M259.1 -12.6L259.1 -12.6Q263.8 -12.6 267.75 -14.2Q271.7 -15.8 274.7 -18.8Q277.7 -21.8 279.35 -25.9Q281 -30 281 -35L281 -35Q281 -40 279.35 -44.1Q277.7 -48.2 274.75 -51.2Q271.8 -54.2 267.8 -55.8Q263.8 -57.4 259.1 -57.4L259.1 -57.4Q254.4 -57.4 250.45 -55.8Q246.5 -54.2 243.5 -51.2Q240.5 -48.2 238.85 -44.1Q237.2 -40 237.2 -35L237.2 -35Q237.2 -30.1 238.85 -25.95Q240.5 -21.8 243.45 -18.8Q246.4 -15.8 250.4 -14.2Q254.4 -12.6 259.1 -12.6M328.6 0L312.6 0L312.6 -70L326 -70L360.8 -27.5L360.8 -70L376.8 -70L376.8 0L363.5 0L328.6 -42.5L328.6 0';

/** Text block: cap height 103.7 (two lines + gap = the mark's 251), MIFTARI on top, VISION on the mark's baseline. */
const TEXT_X = 328;
const TEXT_SCALE = 1.4814;

type Tone = 'dark' | 'light';

function Mark({ tone, accent }: { tone: Tone; accent?: boolean }) {
  const id = useId().replace(/:/g, '');
  const ink = tone === 'dark' ? 'var(--color-ink)' : accent ? '#f7f3e7' : '#ffffff';
  return (
    <>
      {accent && (
        // the identity's gold arch (cream lenses beneath it on dark grounds)
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6c194" />
          <stop offset="0.55" stopColor="#b39c71" />
          <stop offset="1" stopColor="#937e58" />
        </linearGradient>
      )}
      <path d={ARCH} fill={accent ? `url(#g${id})` : ink} />
      <path d={LENS_L} fill={ink} />
      <path d={LENS_R} fill={ink} />
    </>
  );
}

/** Mark + MIFTARI / VISION. `accent`: gold arch and cream lettering, for dark grounds. */
export function Logo({ className, tone = 'dark', accent }: { className?: string; tone?: Tone; accent?: boolean }) {
  const ink = tone === 'dark' ? 'var(--color-ink)' : accent ? '#f7f3e7' : '#ffffff';
  return (
    <svg viewBox="0 -1 978 253" className={cn('h-11 w-auto', className)} role="img" aria-label="Miftari Vision">
      <Mark tone={tone} accent={accent} />
      <g fill={ink}>
        <path d={MIFTARI} transform={`translate(${TEXT_X} 103.7) scale(${TEXT_SCALE})`} />
        <path d={VISION} transform={`translate(${TEXT_X} 251) scale(${TEXT_SCALE})`} />
      </g>
    </svg>
  );
}

export function LogoMark({ className, tone = 'dark', accent }: { className?: string; tone?: Tone; accent?: boolean }) {
  return (
    <svg viewBox="0 -1 256 253" className={cn('h-8 w-auto', className)} aria-hidden>
      <Mark tone={tone} accent={accent} />
    </svg>
  );
}
