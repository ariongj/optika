import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';
import type { Product } from '@/lib/types';
import { defaultOptions, packsForArea, qtyUnits, regularUnitPrice, unitPrice, WASTE } from '@/lib/pricing';
import { round2 } from '@/lib/utils';

/** Default amount the pack calculator starts with (unit m2 only — not used by the optical catalogue). */
const DEFAULT_AREA = 20;

export interface Configurator {
  product: Product;
  options: Record<string, string>;
  setOption: (optionId: string, valueId: string) => void;
  /** pieces / pairs / metres / packs (m2 products) — exactly what goes into the cart */
  qty: number;
  setQty: (n: number) => void;
  maxQty: number;
  /** pack calculator (unit m2) */
  area: string;
  setArea: (v: string) => void;
  areaNum: number;
  waste: boolean;
  setWaste: (v: boolean) => void;
  /** packs the calculator recommends for the entered area */
  suggestedPacks: number;
  installation: boolean;
  setInstallation: (v: boolean) => void;
  canInstall: boolean;
  /* derived */
  unitPrice: number;
  regularUnitPrice: number;
  units: number;
  goodsTotal: number;
  installationUnit: number;
  installationTotal: number;
  total: number;
}

const parseArea = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function useConfigurator(product: Product): Configurator {
  const isArea = product.unit === 'm2' && !!product.packSize;
  const packSize = product.packSize ?? 1;
  const maxQty = product.stock > 0 && product.stock < 999 ? Math.max(1, isArea ? Math.floor(product.stock / packSize) || 1 : product.stock) : 999;

  const [options, setOptions] = useState<Record<string, string>>(() => defaultOptions(product));
  const [area, setAreaState] = useState(() => (isArea ? String(DEFAULT_AREA) : ''));
  const [waste, setWasteState] = useState(true);
  const [qty, setQtyState] = useState(() => (isArea ? Math.min(maxQty, Math.max(1, packsForArea(DEFAULT_AREA, packSize))) : 1));
  const [installation, setInstallation] = useState(false);

  const clampQty = (n: number) => Math.min(maxQty, Math.max(1, Math.round(n)));
  const recalc = (a: string, w: boolean) => {
    const n = parseArea(a);
    if (n > 0) setQtyState(clampQty(packsForArea(n, packSize, w ? WASTE : 0)));
  };

  const areaNum = parseArea(area);
  const suggestedPacks = isArea && areaNum > 0 ? packsForArea(areaNum, packSize, waste ? WASTE : 0) : 0;

  const up = unitPrice(product, options);
  const units = qtyUnits(product, qty);
  const goodsTotal = round2(up * units);
  const canInstall = !!product.installation?.available;
  const installationUnit = installation && canInstall ? product.installation!.price : 0;
  const installationTotal = round2(installationUnit * units);

  return {
    product,
    options,
    setOption: (id, v) => setOptions((o) => ({ ...o, [id]: v })),
    qty,
    setQty: (n) => setQtyState(clampQty(n)),
    maxQty,
    area,
    setArea: (v) => {
      setAreaState(v);
      recalc(v, waste);
    },
    areaNum,
    waste,
    setWaste: (w) => {
      setWasteState(w);
      recalc(area, w);
    },
    suggestedPacks,
    installation: installation && canInstall,
    setInstallation,
    canInstall,
    unitPrice: up,
    regularUnitPrice: regularUnitPrice(product, options),
    units,
    goodsTotal,
    installationUnit,
    installationTotal,
    total: round2(goodsTotal + installationTotal),
  };
}

/** Smoothly tweens a number towards `value` (used for live prices). */
export function useTweenedNumber(value: number, duration = 0.5) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    if (current.current === value) return;
    const controls = animate(current.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        current.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, duration]);
  return display;
}
