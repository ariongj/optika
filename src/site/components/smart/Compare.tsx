import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Check, Minus } from 'lucide-react';
import type { Product } from '@/lib/types';
import { useDict, useL } from '@/i18n';
import { cn } from '@/lib/utils';
import { SG, type SGKey } from './dict';
import { KINDS, POSTER, POSTER_M, kindOf, type Kind } from './data';
import { Stage } from './Stage';
import { KindSwitch, kindLabels } from './Hero';
import { Backdrop, Headline, Kicker } from './ui';

/** A cell: yes / no / depends on the model / a short value. */
type Cell = boolean | 'model' | SGKey;
const ROWS: { key: SGKey; cells: Record<Kind, Cell> }[] = [
  { key: 'row_camera', cells: { camera: true, audio: false, display: 'model' } },
  { key: 'row_audio', cells: { camera: true, audio: true, display: 'model' } },
  { key: 'row_assistant', cells: { camera: true, audio: true, display: true } },
  { key: 'row_display', cells: { camera: false, audio: false, display: true } },
  { key: 'row_rx', cells: { camera: 'model', audio: true, display: 'model' } },
  { key: 'row_battery', cells: { camera: 'b_9', audio: 'b_12', display: 'model' } },
];
const NAME: Record<Kind, SGKey> = { camera: 'type1Name', audio: 'type2Name', display: 'type3Name' };
const TEXT: Record<Kind, SGKey> = { camera: 'type1Text', audio: 'type2Text', display: 'type3Text' };

function CellValue({ v, on }: { v: Cell; on: boolean }) {
  const t = useDict(SG);
  if (v === true)
    return (
      <span className="inline-flex items-center gap-2">
        <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full', on ? 'bg-[#6fd3a5] text-[#06110c]' : 'bg-[#6fd3a5]/15 text-[#6fd3a5]')}>
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="hidden text-[13px] font-semibold text-white/85 xl:inline">{t('v_yes')}</span>
        <span className="sr-only xl:hidden">{t('v_yes')}</span>
      </span>
    );
  if (v === false)
    return (
      <span className="inline-flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/35">
          <Minus className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="hidden text-[13px] font-medium text-white/55 xl:inline">{t('v_no')}</span>
        <span className="sr-only xl:hidden">{t('v_no')}</span>
      </span>
    );
  if (v === 'model')
    return (
      <span className="inline-flex items-center gap-2" title={t('v_model')}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-white/25">
          <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
        </span>
        <span className="hidden text-[12.5px] font-medium text-white/55 xl:inline">{t('v_model')}</span>
        <span className="sr-only xl:hidden">{t('v_model')}</span>
      </span>
    );
  return <span className={cn('sg-mono text-[11.5px] sm:text-[12.5px]', on ? 'text-[#6fd3a5]' : 'text-white/70')}>{t(v)}</span>;
}

/* ------------------------------------------------------------------ */
/* 4 — Three types: live 3D variant + comparison matrix                */
/* ------------------------------------------------------------------ */
export function SmartCompare({ products }: { products: Product[] }) {
  const t = useDict(SG);
  const l = useL();
  const [kind, setKind] = useState<Kind>('camera');
  const labels = kindLabels(t);
  const models = products.filter((p) => kindOf(p) === kind);

  return (
    <section id="llojet" className="relative isolate overflow-hidden bg-[#07090a] py-20 text-white sm:py-28">
      <Backdrop glow="left" grid={false} />
      <div className="container-x relative">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Kicker n="03">{t('typesEyebrow')}</Kicker>
            <Headline text={t('typesTitle')} className="mt-5 text-[36px] leading-[1.04] sm:text-[52px] lg:text-[58px]" />
            <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/55 sm:text-[16.5px]">{t('typesText')}</p>
          </div>
          <KindSwitch id="compare" value={kind} onChange={setKind} labels={labels} className="self-start lg:self-end" />
        </div>

        <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-12 lg:gap-6">
          {/* the model in the chosen variant */}
          <div className="sg-card relative overflow-hidden rounded-[28px] lg:col-span-5">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgb(111 211 165 / 0.14), transparent 70%)' }} />
            <Stage
              poster={POSTER}
              posterMobile={POSTER_M}
              posterClassName="object-right"
              variant={kind}
              showDisplayHud={kind === 'display'}
              autoRotate
              interactive
              margin="15% 0px"
              className="aspect-[4/3] w-full touch-pan-y"
            />
            <div className="relative border-t border-white/[0.08] p-6 sm:p-7">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={kind} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                  <div className="sg-mono text-[11px] text-[#6fd3a5]">0{KINDS.indexOf(kind) + 1}</div>
                  <h3 className="mt-2 text-[26px] font-semibold tracking-[-0.03em]">{t(NAME[kind])}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">{t(TEXT[kind])}</p>
                  {models.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {models.map((p) => (
                        <Link
                          key={p.id}
                          to={`/produkt/${p.slug}`}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/12 transition-colors hover:bg-white/[0.1] hover:ring-[#6fd3a5]/40"
                        >
                          {l(p.name).replace(/\s*\(Gen 3\)$/, '')}
                          <ArrowUpRight className="h-3.5 w-3.5 text-white/45" />
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* the matrix */}
          <div className="sg-card overflow-hidden rounded-[28px] lg:col-span-7">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">{t('typesTitle').replace(/\*/g, '')}</caption>
              <colgroup>
                <col className="w-[34%] sm:w-[31%]" />
                {KINDS.map((k) => (
                  <col key={k} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="p-0" />
                  {KINDS.map((k) => (
                    <th key={k} scope="col" className="p-0 align-bottom">
                      <button
                        type="button"
                        onClick={() => setKind(k)}
                        aria-pressed={k === kind}
                        className={cn(
                          'relative flex min-h-[72px] w-full flex-col justify-end gap-1 border-t-2 px-2 pb-4 pt-5 text-left transition-colors sm:px-4',
                          k === kind ? 'border-[#6fd3a5] bg-white/[0.05]' : 'border-transparent hover:bg-white/[0.03]',
                        )}
                      >
                        <span className={cn('sg-mono text-[10px]', k === kind ? 'text-[#6fd3a5]' : 'text-white/55')}>0{KINDS.indexOf(k) + 1}</span>
                        <span className={cn('text-[13px] font-semibold leading-tight sm:text-[15px]', k === kind ? 'text-white' : 'text-white/60')}>{t(NAME[k])}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.key} className="border-t border-white/[0.07]">
                    <th scope="row" className="px-4 py-4 text-[13px] font-medium leading-snug text-white/65 sm:px-6 sm:text-[14px]">
                      {t(row.key)}
                    </th>
                    {KINDS.map((k) => (
                      <td key={k} className={cn('px-2 py-4 transition-colors sm:px-4', k === kind && 'bg-white/[0.05]')}>
                        <CellValue v={row.cells[k]} on={k === kind} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {/* legend (phones/tablets show icons only) */}
            <div className="sg-mono flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.07] px-4 py-4 text-[10px] text-white/55 sm:px-6 xl:hidden">
              <span className="inline-flex items-center gap-2">
                <Check className="h-3 w-3 text-[#6fd3a5]" strokeWidth={3} /> {t('v_yes')}
              </span>
              <span className="inline-flex items-center gap-2">
                <Minus className="h-3 w-3" strokeWidth={3} /> {t('v_no')}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/60 ring-2 ring-white/20" /> {t('v_model')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
