import { Link, useNavigate } from 'react-router';
import { ShoppingBag, Trash2, Truck, ShieldPlus, ArrowRight, FileText } from 'lucide-react';
import { Drawer } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { EmptyState, Img, QtyStepper } from '@/components/ui/misc';
import { Switch } from '@/components/ui/Field';
import { defineDict, useDict, useL, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { common } from '@/i18n/common';
import { useUi } from '@/store/ui';
import { useCart, useSettings } from '@/store/hooks';
import { money, num, unitLabel } from '@/lib/format';
import type { PricedLine } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { LineDiscounts } from '@/site/components/checkout/parts';
import { needsRx } from '@/site/components/product/optical';

const D = defineDict({
  me: { carePer: '/ okvir', careHint: '12 meseci zaštite od loma i besplatna podešavanja', rxNote: 'Recept potvrđujemo nakon narudžbe' },
  sq: { carePer: '/ kornizë', careHint: '12 muaj mbrojtje nga thyerja dhe rregullime falas', rxNote: 'Recetën e konfirmojmë pas porosisë' },
  en: { carePer: '/ frame', careHint: '12-month breakage cover and free adjustments', rxNote: 'We confirm your prescription after you order' },
});

export function FreeShippingBar({ remaining, threshold, reason, className }: { remaining: number; threshold: number; reason: string | null; className?: string }) {
  const t = useDict(site);
  const lang = useLang();
  const pct = reason ? 100 : Math.min(100, ((threshold - remaining) / threshold) * 100);
  // Care+ also makes delivery free — but once the threshold is met that is the clearer message
  const text = reason === 'installation' && remaining > 0 ? t('freeWithInstallation') : reason ? t('freeShippingReached') : t('freeShippingLeft', { amount: money(remaining, lang) });
  return (
    <div className={cn('rounded-2xl bg-white p-4 ring-1 ring-line', className)}>
      <div className="flex items-center gap-2.5 text-[13px] font-semibold text-ink">
        <Truck className="h-4 w-4 text-brand-600" />
        {text}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartLine({ line, compact }: { line: PricedLine; compact?: boolean }) {
  const t = useDict(site);
  const td = useDict(D);
  const tc = useDict(common);
  const l = useL();
  const lang = useLang();
  const setQty = useUi((s) => s.setQty);
  const remove = useUi((s) => s.removeFromCart);
  const setInstallation = useUi((s) => s.setInstallation);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const p = line.product;
  const isPack = p.unit === 'm2' && p.packSize;
  const rx = needsRx(p, line.item.options);
  return (
    <div className="flex gap-4 py-5">
      <Link to={`/produkt/${p.slug}`} onClick={() => setCartOpen(false)} className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-sand sm:h-28 sm:w-24">
        <Img src={p.images[0]} small alt="" className="h-full w-full object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/produkt/${p.slug}`} onClick={() => setCartOpen(false)} className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink hover:text-brand-700">
              {l(p.name)}
            </Link>
            {line.optionsLabel && <p className="mt-1 text-[12.5px] leading-snug text-muted">{line.optionsLabel}</p>}
            {rx && (
              <p className="mt-1 flex items-start gap-1.5 text-[12px] font-medium leading-snug text-oak">
                <FileText className="mt-0.5 h-3 w-3 shrink-0" /> {td('rxNote')}
              </p>
            )}
          </div>
          <button onClick={() => remove(line.item.key)} className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink" aria-label={tc('remove')}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <QtyStepper size="sm" value={line.item.qty} onChange={(v) => setQty(line.item.key, v)} />
            <span className="text-[12px] text-muted">{isPack ? `${tc('packs')} · ${num(line.units, lang)} ${unitLabel('m2', lang)}` : unitLabel(p.unit, lang)}</span>
          </div>
          <span className="text-[15px] font-bold tabular-nums text-ink">{money(line.lineTotal, lang)}</span>
        </div>
        <LineDiscounts line={line} className="mt-2" />
        {p.installation?.available && !compact && (
          <div className={cn('mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2', line.item.installation ? 'bg-brand-50' : 'bg-sand/60')} title={td('careHint')}>
            <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-ink-soft">
              <ShieldPlus className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="truncate">
                {t('withInstallation')}
                <span className="text-muted max-sm:hidden">
                  {' '}
                  ({money(p.installation.price, lang, { decimals: p.installation.price % 1 !== 0 })} {p.unit === 'm2' ? `/ ${unitLabel('m2', lang)}` : td('carePer')})
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {line.item.installation && <span className="text-[12.5px] font-semibold tabular-nums">{money(line.installationTotal, lang)}</span>}
              <Switch size="sm" checked={line.item.installation} onChange={(v) => setInstallation(line.item.key, v)} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CartDrawer() {
  const t = useDict(site);
  const tc = useDict(common);
  const lang = useLang();
  const open = useUi((s) => s.cartOpen);
  const setOpen = useUi((s) => s.setCartOpen);
  const totals = useCart();
  const settings = useSettings();
  const navigate = useNavigate();
  const empty = totals.lines.length === 0;

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      title={
        <span className="flex items-center gap-2.5">
          {t('cart')} <span className="grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1.5 text-xs text-paper">{totals.lines.length}</span>
        </span>
      }
      footer={
        !empty && (
          <div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>{tc('subtotal')}</span>
                <span className="tabular-nums text-ink">{money(totals.subtotal, lang)}</span>
              </div>
              {totals.installationTotal > 0 && (
                <div className="flex justify-between text-muted">
                  <span>{tc('installation')}</span>
                  <span className="tabular-nums text-ink">{money(totals.installationTotal, lang)}</span>
                </div>
              )}
              {totals.discount > 0 && (
                <div className="flex justify-between text-muted">
                  <span>{tc('discount')}</span>
                  <span className="tabular-nums text-emerald-700">−{money(totals.discount, lang)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <span>{tc('shipping')}</span>
                <span className="tabular-nums text-ink">{totals.shipping === 0 ? tc('free') : `${totals.shippingEstimate ? tc('from') + ' ' : ''}${money(totals.shipping, lang)}`}</span>
              </div>
              <div className="flex items-baseline justify-between pt-2 text-base font-bold">
                <span>{tc('total')}</span>
                <span className="text-xl tabular-nums">{money(totals.total, lang)}</span>
              </div>
              <p className="text-right text-[11.5px] text-muted">{tc('vatIncluded', { rate: settings.vatRate })}</p>
            </div>
            <div className="mt-4 grid gap-2">
              <Button
                size="lg"
                className="w-full"
                iconRight={<ArrowRight className="h-4 w-4" />}
                onClick={() => {
                  setOpen(false);
                  navigate('/pagesa');
                }}
              >
                {t('checkout')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  navigate('/shporta');
                }}
              >
                {t('viewCart')}
              </Button>
            </div>
          </div>
        )
      }
    >
      {empty ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title={t('cartEmpty')}
          text={t('cartEmptyText')}
          action={
            <Button
              variant="dark"
              onClick={() => {
                setOpen(false);
                navigate('/produktet');
              }}
            >
              {t('continueShopping')}
            </Button>
          }
          className="py-24"
        />
      ) : (
        <div className="px-5 pb-4 pt-5 sm:px-6">
          <FreeShippingBar remaining={totals.freeShippingRemaining} threshold={totals.freeShippingThreshold ?? settings.freeShippingThreshold} reason={totals.freeShippingReason} />
          <div className="divide-y divide-line">
            {totals.lines.map((line) => (
              <CartLine key={line.item.key} line={line} />
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}
