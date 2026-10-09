import { useId, useMemo } from 'react';
import { ArrowUpRight, Navigation } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { buttonClass } from '@/components/ui/Button';
import { useDict } from '@/i18n';
import { useSettings } from '@/store/hooks';
import { cn, rng } from '@/lib/utils';
import { C } from './dict';

/* Stylised, dependency-free "map" of central Mitrovica: a rotated street grid, the
   Ibar running across the top with a tributary joining it, a bridge, two main roads
   crossing at the store and a pulsing brand pin. The SVG uses `slice` scaling, so its
   centre (400,320) is always the card centre — that's where the pin sits. */
const VW = 800;
const VH = 640;
const CELL = 80;

const MAIN_ROAD = 'M -40 418 C 170 372 300 336 400 320 C 520 301 650 262 840 196';
const CROSS_ROAD = 'M 366 -40 C 382 90 392 210 400 320 C 409 430 432 540 458 680';
const ROUTE = 'M 400 320 C 520 301 650 262 840 196';
/** Main river, west → east above the store */
const RIVER = 'M -40 92 C 90 70 190 128 300 116 C 420 102 520 58 640 74 C 720 84 780 110 860 100';
/** Tributary joining from the south-west */
const TRIBUTARY = 'M 40 700 C 70 560 20 470 70 380 C 112 300 92 220 150 120';
/** Riverside park along the bank */
const PARK = 'M 470 120 C 540 104 610 110 690 128 L 700 186 C 620 176 548 178 482 190 Z';

type Block = { x: number; y: number; w: number; h: number; o: number; park: boolean };

function useBlocks() {
  return useMemo(() => {
    const r = rng(11);
    const out: Block[] = [];
    for (let row = -3; row < 11; row++) {
      for (let col = -3; col < 13; col++) {
        const v = r();
        if (v < 0.07) continue; // empty lot
        const park = v > 0.93;
        const x = col * CELL + 12;
        const y = row * CELL + 12;
        const s = CELL - 24;
        const o = 0.55 + r() * 0.45;
        if (!park && r() > 0.62) {
          // two buildings in one block
          const half = (s - 6) / 2;
          out.push({ x, y, w: s, h: half, o, park });
          out.push({ x, y: y + half + 6, w: s, h: half, o: o * 0.9, park });
        } else out.push({ x, y, w: s, h: s, o, park });
      }
    }
    return out;
  }, []);
}

/** Street name for the road label: "Mbretëresha Teutë 182" → "Mbretëresha Teutë". */
const streetOf = (address: string) => address.replace(/\s+(bb|b\.b\.|\d+[a-z]?)$/i, '').trim();

export function MapCard({ className }: { className?: string }) {
  const c = useDict(C);
  const settings = useSettings();
  const blocks = useBlocks();
  const pathId = useId().replace(/:/g, '');
  const street = streetOf(settings.address);

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-line', className)}>
      <a
        href={settings.mapUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={c('map_open')}
        tabIndex={-1}
        className="group relative block min-h-[340px] flex-1 overflow-hidden bg-[#ece4d7] sm:min-h-[400px]"
      >
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full transition-transform duration-[1.6s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.035]" aria-hidden>
          <defs>
            <path id={`${pathId}-main`} d={MAIN_ROAD} />
            <path id={`${pathId}-river`} d={RIVER} />
          </defs>
          <rect width={VW} height={VH} fill="#ece4d7" />

          {/* City blocks + minor streets, slightly rotated for an organic feel */}
          <g transform={`rotate(-11 ${VW / 2} ${VH / 2})`}>
            {blocks.map((b, i) => (
              <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={5} fill={b.park ? '#d2dac2' : '#e0d3c0'} fillOpacity={b.park ? 1 : b.o} />
            ))}
            {Array.from({ length: 17 }, (_, k) => (k - 3) * CELL).map((p) => (
              <g key={p} stroke="#fbf8f3" strokeLinecap="round">
                <line x1={p} y1={-300} x2={p} y2={VH + 300} strokeWidth={(p / CELL) % 2 === 0 ? 9 : 5} />
                <line x1={-300} y1={p} x2={VW + 300} y2={p} strokeWidth={(p / CELL) % 2 === 0 ? 9 : 5} />
              </g>
            ))}
          </g>

          {/* Riverside park, rivers and a bridge */}
          <path d={PARK} fill="#d2dac2" />
          <path d={TRIBUTARY} fill="none" stroke="#b4c8c7" strokeWidth={14} strokeLinecap="round" />
          <path d={TRIBUTARY} fill="none" stroke="#c6d6d5" strokeWidth={11} strokeLinecap="round" />
          <path d={RIVER} fill="none" stroke="#b4c8c7" strokeWidth={30} strokeLinecap="round" />
          <path d={RIVER} fill="none" stroke="#c6d6d5" strokeWidth={26} strokeLinecap="round" />
          <g fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round">
            <path d="M 70 86 q 10 -6 20 0 t 20 0" />
            <path d="M 560 70 q 10 -6 20 0 t 20 0" />
            <path d="M 700 88 q 10 -6 20 0 t 20 0" />
          </g>
          <text fill="#7f9796" fontSize={11} fontWeight={700} letterSpacing={3} dy={4} style={{ fontFamily: 'var(--font-sans)', textTransform: 'uppercase' }}>
            <textPath href={`#${pathId}-river`} startOffset="14%">
              {c('map_river')}
            </textPath>
          </text>

          {/* Main roads */}
          <path d={CROSS_ROAD} fill="none" stroke="#d9cbb6" strokeWidth={19} strokeLinecap="round" />
          <path d={CROSS_ROAD} fill="none" stroke="#fffdf9" strokeWidth={14} strokeLinecap="round" />
          {/* Bridge where the cross road meets the river */}
          <g>
            <rect x={366} y={88} width={30} height={46} rx={3} fill="#fffdf9" stroke="#cbbba4" strokeWidth={2} transform="rotate(-6 381 111)" />
            <line x1={362} y1={92} x2={362} y2={130} stroke="#b7a68c" strokeWidth={2} transform="rotate(-6 381 111)" />
            <line x1={400} y1={92} x2={400} y2={130} stroke="#b7a68c" strokeWidth={2} transform="rotate(-6 381 111)" />
          </g>
          <path d={MAIN_ROAD} fill="none" stroke="#dcc49a" strokeWidth={25} strokeLinecap="round" />
          <path d={MAIN_ROAD} fill="none" stroke="#f6e6c4" strokeWidth={20} strokeLinecap="round" />
          <text fill="#8f7d62" fontSize={11} fontWeight={700} letterSpacing={2.4} dy={4} style={{ fontFamily: 'var(--font-sans)', textTransform: 'uppercase' }}>
            <textPath href={`#${pathId}-main`} startOffset="19%">
              {street}
            </textPath>
          </text>

          {/* Route to the showroom */}
          <path d={ROUTE} fill="none" className="stroke-brand-600" strokeWidth={5} strokeDasharray="0 11" strokeLinecap="round" />
        </svg>

        {/* soft vignette + grain */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(226,216,200,0.75))]" />
        <div className="bg-grain pointer-events-none absolute inset-0" />

        {/* Pin */}
        <div className="pointer-events-none absolute left-1/2 top-1/2">
          <span className="absolute -left-12 -top-12 h-24 w-24 animate-ping rounded-full bg-brand-500/25 [animation-duration:2.4s]" />
          <span className="absolute -left-7 -top-7 h-14 w-14 rounded-full bg-brand-500/15 ring-1 ring-brand-600/20" />
          <span className="absolute -left-[5px] -top-[5px] h-2.5 w-2.5 rounded-full bg-brand-800 ring-[3px] ring-white" />
          <svg viewBox="0 0 40 52" className="absolute bottom-[3px] left-0 h-[54px] w-[42px] -translate-x-1/2 drop-shadow-[0_12px_14px_rgba(28,48,38,0.35)] transition-transform duration-500 group-hover:-translate-y-1.5">
            <path d="M20 0C9 0 0 8.7 0 19.5 0 34 20 52 20 52s20-18 20-32.5C40 8.7 31 0 20 0Z" className="fill-brand-600" />
            <circle cx="20" cy="19.5" r="11" fill="#fff" />
            {/* a pair of glasses */}
            <circle cx="15.2" cy="20" r="3.7" fill="none" className="stroke-brand-600" strokeWidth={2.2} />
            <circle cx="24.8" cy="20" r="3.7" fill="none" className="stroke-brand-600" strokeWidth={2.2} />
            <path d="M18.6 19.2 Q20 17.9 21.4 19.2" fill="none" stroke="#1c1a17" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
          <div className="absolute bottom-[68px] left-0 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white py-1.5 pl-2 pr-3.5 text-[12.5px] font-bold text-ink shadow-[0_14px_30px_-14px_rgba(28,26,23,0.5)] ring-1 ring-line">
            <LogoMark className="h-[14px]" />
            {settings.companyName}
          </div>
        </div>

        {/* Compass + scale */}
        <div className="absolute right-4 top-4 flex w-10 flex-col items-center gap-0.5 rounded-full bg-white/90 pb-2 pt-1.5 shadow-sm ring-1 ring-line backdrop-blur">
          <span className="text-[10px] font-extrabold tracking-[0.08em] text-ink">{c('map_north')}</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path d="M12 2 16 12 12 10.4 8 12Z" className="fill-brand-600" />
            <path d="M12 22 8 12 12 13.6 16 12Z" fill="#c9bba6" />
          </svg>
        </div>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-ink-soft ring-1 ring-line backdrop-blur">
          <span className="h-1.5 w-12 border-x-2 border-b-2 border-ink/45" />
          {c('map_scale')}
        </div>
      </a>

      <div className="flex flex-col gap-5 border-t border-line p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div className="min-w-0">
          <div className="eyebrow">{c('map_eyebrow')}</div>
          <div className="display mt-2 text-[34px] leading-none text-ink sm:text-[38px]">{settings.city}</div>
          <div className="mt-2.5 text-[14.5px] text-muted">
            {settings.companyName} · {settings.address}
          </div>
        </div>
        <a href={settings.mapUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'dark', className: 'self-start sm:self-auto' })}>
          <Navigation className="h-4 w-4" />
          {c('map_open')}
          <ArrowUpRight className="h-4 w-4 opacity-60" />
        </a>
      </div>
    </div>
  );
}
