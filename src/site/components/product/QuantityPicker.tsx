import { AlertTriangle, Calculator } from 'lucide-react';
import { Checkbox } from '@/components/ui/Field';
import { QtyStepper } from '@/components/ui/misc';
import { useDict, useLang } from '@/i18n';
import { num, unitLabel } from '@/lib/format';
import { round2 } from '@/lib/utils';
import { PD, packWord } from './dict';
import type { Configurator } from './useConfigurator';

/** Pieces / pairs / metres stepper. The pack calculator only serves unit `m2` (not used by the optical catalogue). */
export function QuantityPicker({ cfg }: { cfg: Configurator }) {
  const t = useDict(PD);
  const lang = useLang();
  const p = cfg.product;

  if (p.unit === 'm2' && p.packSize) return <AreaCalculator cfg={cfg} />;

  const isMetre = p.unit === 'm';
  return (
    <div>
      <div className="mb-3 text-[13.5px] font-semibold text-ink-soft">{isMetre ? t('length') : p.unit === 'set' ? t('quantityPairs') : t('quantity')}</div>
      <div className="flex items-center gap-3">
        <QtyStepper value={cfg.qty} onChange={cfg.setQty} max={cfg.maxQty} label={isMetre ? t('length') : p.unit === 'set' ? t('quantityPairs') : t('quantity')} />
        <span className="text-[14px] font-medium text-muted">{unitLabel(p.unit, lang)}</span>
        {isMetre && <span className="ml-1 text-[12.5px] text-muted">{t('lengthHint')}</span>}
      </div>
    </div>
  );
}

function AreaCalculator({ cfg }: { cfg: Configurator }) {
  const t = useDict(PD);
  const lang = useLang();
  const unit = unitLabel('m2', lang);
  const size = cfg.product.packSize ?? 1;
  const covered = round2(cfg.qty * size);
  const manual = cfg.areaNum > 0 && cfg.qty !== cfg.suggestedPacks;
  const short = cfg.areaNum > 0 && covered < cfg.areaNum;
  const word = packWord(cfg.qty, lang, t('pack_one'), t('pack_many'));
  const area = num(cfg.areaNum, lang);

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-ink">
          <Calculator className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-ink">{t('calcTitle')}</div>
          <div className="text-[12.5px] leading-snug text-muted">{t('calcText')}</div>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">{t('area')}</span>
          <span className="relative block">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={cfg.area}
              placeholder={t('areaPh')}
              onChange={(e) => cfg.setArea(e.target.value)}
              className="h-11 w-full rounded-full border border-line bg-white pl-4 pr-12 text-[15px] font-semibold tabular-nums text-ink outline-none transition focus:border-ink/40 focus:ring-4 focus:ring-ink/5"
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted">{unit}</span>
          </span>
        </label>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">{t('packsLabel')}</span>
          <QtyStepper value={cfg.qty} onChange={cfg.setQty} max={cfg.maxQty} label={t('packsLabel')} className="w-full justify-between" />
        </div>
        <Checkbox checked={cfg.waste} onChange={cfg.setWaste} label={t('waste')} description={t('wasteHint')} className="sm:col-span-2" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-sand/60 px-4 py-3 sm:px-5">
        <div className="text-[15px] font-bold tabular-nums text-ink">
          {cfg.qty} {word} = {num(covered, lang)} {unit}
        </div>
        <div className="text-[12.5px] font-medium text-muted">
          {short ? (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('tooFew', { area, unit })}
            </span>
          ) : cfg.areaNum > 0 ? (
            <>
              {cfg.waste ? t('covers', { area, unit }) : t('coversNoWaste', { area, unit })}
              {manual && <span className="text-ink-soft"> · {t('manual')}</span>}
            </>
          ) : (
            `${num(size, lang)} ${unit} / ${t('pack_one')}`
          )}
        </div>
      </div>
    </div>
  );
}
