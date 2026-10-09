import { defineDict } from '@/i18n';
import type { Lang } from '@/lib/types';

/** Storefront collection page (/koleksioni/:slug) — SR (`me` slot) / SQ / EN. */
export const CT = defineDict({
  me: {
    eyebrow: 'Kolekcija',
    countOne: '{n} proizvod',
    countMany: '{n} proizvoda',
    fromPrice: 'Već od {price}',
    install: 'Nega+ za svaki okvir',
    upTo: 'Do −{pct}%',
    autoPct: '−{pct}% automatski u korpi',
    autoFixed: '−{amount} automatski u korpi',
    browse: 'Pogledajte proizvode',
    inCollection: 'u kolekciji',
    sortBy: 'Sortiraj',
    sort_featured: 'Preporučeno',
    sort_bestselling: 'Najprodavanije',
    'sort_price-asc': 'Cena: rastuće',
    'sort_price-desc': 'Cena: opadajuće',
    sort_newest: 'Najnovije',
    emptyTitle: 'Kolekcija se uskoro puni',
    emptyText: 'Modeli za ovu kolekciju stižu uskoro — do tada pogledajte ceo katalog.',
    otherEyebrow: 'Još inspiracije',
    otherTitle: 'Druge *kolekcije*',
    notFoundTitle: 'Ova kolekcija *nije dostupna*',
    notFoundText: 'Možda je akcija završena ili je link promenjen. Pogledajte druge kolekcije ili ceo katalog.',
    notFoundPageTitle: 'Kolekcija nije pronađena',
    previewBanner: 'Pregled — kolekcija nije objavljena i kupci je ne vide.',
    editInCms: 'Uredi u CMS-u',
  },
  sq: {
    eyebrow: 'Koleksion',
    countOne: '{n} produkt',
    countMany: '{n} produkte',
    fromPrice: 'Që nga {price}',
    install: 'Kujdes+ për çdo kornizë',
    upTo: 'Deri −{pct}%',
    autoPct: '−{pct}% automatikisht në shportë',
    autoFixed: '−{amount} automatikisht në shportë',
    browse: 'Shikoni produktet',
    inCollection: 'në koleksion',
    sortBy: 'Rendit',
    sort_featured: 'Të rekomanduara',
    sort_bestselling: 'Më të shiturat',
    'sort_price-asc': 'Çmimi: në rritje',
    'sort_price-desc': 'Çmimi: në zbritje',
    sort_newest: 'Më të rejat',
    emptyTitle: 'Koleksioni po mbushet së shpejti',
    emptyText: 'Modelet për këtë koleksion vijnë së shpejti — deri atëherë shikoni të gjithë katalogun.',
    otherEyebrow: 'Më shumë frymëzim',
    otherTitle: 'Koleksione *të tjera*',
    notFoundTitle: 'Ky koleksion *nuk është i disponueshëm*',
    notFoundText: 'Ndoshta oferta ka përfunduar ose lidhja ka ndryshuar. Shikoni koleksionet e tjera ose të gjithë katalogun.',
    notFoundPageTitle: 'Koleksioni nuk u gjet',
    previewBanner: 'Parapamje — koleksioni nuk është publikuar dhe klientët nuk e shohin.',
    editInCms: 'Ndrysho në CMS',
  },
  en: {
    eyebrow: 'Collection',
    countOne: '{n} product',
    countMany: '{n} products',
    fromPrice: 'From {price}',
    install: 'Care+ for every frame',
    upTo: 'Up to −{pct}%',
    autoPct: '−{pct}% off, applied in the cart',
    autoFixed: '−{amount} off, applied in the cart',
    browse: 'Browse the products',
    inCollection: 'in this collection',
    sortBy: 'Sort',
    sort_featured: 'Featured',
    sort_bestselling: 'Best selling',
    'sort_price-asc': 'Price: low to high',
    'sort_price-desc': 'Price: high to low',
    sort_newest: 'Newest',
    emptyTitle: 'This collection is filling up soon',
    emptyText: 'Models for this collection are on their way — meanwhile, browse the full catalogue.',
    otherEyebrow: 'More inspiration',
    otherTitle: 'Other *collections*',
    notFoundTitle: 'This collection is *not available*',
    notFoundText: 'The sale may have ended or the link has changed. Browse other collections or the full catalogue.',
    notFoundPageTitle: 'Collection not found',
    previewBanner: 'Preview — this collection is not published and customers cannot see it.',
    editInCms: 'Edit in the CMS',
  },
});

export type CtT = (key: keyof typeof CT.me, vars?: Record<string, string | number>) => string;

/** "1 proizvod" / "5 proizvoda" (SR: 1, 21, 31… are singular). */
export function countLabel(t: CtT, lang: Lang, n: number) {
  const one = lang === 'me' ? n % 10 === 1 && n % 100 !== 11 : n === 1;
  return t(one ? 'countOne' : 'countMany', { n });
}

/** Accent the last word of a plain title ("Syze dielli në *ofertë*") unless it already has *markers*. */
export const accentTitle = (title: string) => {
  if (title.includes('*')) return title;
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return `*${title.trim()}*`;
  return `${words.slice(0, -1).join(' ')} *${words[words.length - 1]}*`;
};
