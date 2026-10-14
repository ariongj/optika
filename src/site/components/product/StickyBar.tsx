import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';
import { FileText, ScanFace, Send, ShoppingBag } from 'lucide-react';
import { Img } from '@/components/ui/misc';
import { useDict, useL, useLang } from '@/i18n';
import { basePrice, optionsLabel, priceOnRequest } from '@/lib/pricing';
import { money, num, unitLabel } from '@/lib/format';
import { common } from '@/i18n/common';
import { PD, eur, packWord } from './dict';
import { useTweenedNumber, type Configurator } from './useConfigurator';
import { WishButton } from './BuyBox';
import { isFrame, tryOnPath } from './optical';

/** Bottom add-to-cart bar: always handy on mobile, on desktop once the buy box is out of view. */
export function StickyBar({ cfg, visible, onAdd, onQuote }: { cfg: Configurator; visible: boolean; onAdd: () => void; onQuote: () => void }) {
  const t = useDict(PD);
  const tc = useDict(common);
  const l = useL();
  const lang = useLang();
  const p = cfg.product;
  const total = useTweenedNumber(cfg.total);
  const opts = optionsLabel(p, cfg.options, lang);
  const onReq = priceOnRequest(p);
  const fromPrice = onReq ? tc('priceOnRequest') : `${tc('from')} ${money(basePrice(p), lang, { decimals: false })}`;
  const qtyText =
    p.unit === 'm2' && p.packSize
      ? `${cfg.qty} ${packWord(cfg.qty, lang, t('pack_one'), t('pack_many'))} · ${num(cfg.units, lang)} ${unitLabel('m2', lang)}`
      : `${num(cfg.qty, lang)} ${unitLabel(p.unit, lang)}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.45 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-20px_40px_-24px_rgba(28,26,23,0.35)] backdrop-blur-xl"
        >
          <div className="container-x flex h-[76px] items-center gap-3 sm:gap-4">
            <div className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-sand sm:block">
              <Img src={p.images[0]} small alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="hidden truncate text-[14.5px] font-semibold text-ink sm:block">{l(p.name)}</div>
              {onReq ? (
                <>
                  <div className="truncate text-[15px] font-bold leading-tight text-ink sm:hidden">{l(p.name)}</div>
                  <div className="truncate text-[12.5px] font-semibold text-oak">{fromPrice}</div>
                </>
              ) : p.quoteOnly ? (
                <>
                  <div className="text-[18px] font-bold leading-tight tabular-nums text-ink sm:hidden">{fromPrice}</div>
                  <div className="truncate text-[12.5px] text-muted">
                    <span className="font-semibold text-oak">{t('quoteOnly')}</span>
                    <span className="hidden sm:inline"> · {fromPrice}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[18px] font-bold leading-tight tabular-nums text-ink sm:hidden">{eur(total, lang, cfg.total)}</div>
                  <div className="truncate text-[12.5px] text-muted">
                    {qtyText}
                    {opts && <span className="hidden md:inline"> · {opts}</span>}
                    {cfg.installation && ` · ${t('installation')}`}
                  </div>
                </>
              )}
            </div>
            {!p.quoteOnly && <div className="hidden shrink-0 text-right text-[22px] font-bold tabular-nums text-ink sm:block">{eur(total, lang, cfg.total)}</div>}
            {isFrame(p) && (
              <Link
                to={tryOnPath(p.slug)}
                aria-label={t('tryOn')}
                title={t('tryOn')}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-white text-ink transition-colors hover:border-ink/30 max-md:hidden"
              >
                <ScanFace className="h-5 w-5" />
              </Link>
            )}
            <WishButton productId={p.id} tone="light" className="h-12! w-12! max-md:hidden!" />
            <button
              type="button"
              onClick={p.quoteOnly ? onQuote : onAdd}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-[14.5px] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_10px_24px_-14px_var(--color-brand-700)] transition-[background,transform] hover:bg-brand-700 active:scale-[0.98] sm:px-7"
            >
              {onReq ? <Send className="h-[18px] w-[18px]" /> : p.quoteOnly ? <FileText className="h-[18px] w-[18px]" /> : <ShoppingBag className="h-[18px] w-[18px]" />}
              {onReq ? (
                <>
                  <span className="sm:hidden">{t('sg_requestShort')}</span>
                  <span className="max-sm:hidden">{t('sg_request')}</span>
                </>
              ) : p.quoteOnly ? (
                t('requestQuote')
              ) : (
                t('addToCart')
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
