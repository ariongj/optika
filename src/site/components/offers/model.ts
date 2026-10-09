// Offer landing page — data: the offer by slug, its state (lib/offers.ts), linked discount + collection,
// participating products and the other live offers. Also the visit / CTA counters the offers centre reports (PDF p.29).
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { offerState } from '@/lib/offers';
import { collectionProducts } from '@/lib/collections';
import { discountState, discountValueLabel } from '@/lib/discounts';
import { date, money } from '@/lib/format';
import type { Discount, Lang, Offer, OfferState, Product } from '@/lib/types';

export type ProductScope = 'offer' | 'all' | 'collection';

export interface OfferLanding {
  offer?: Offer;
  state: OfferState | null;
  /** /oferta/x?preview=1 opened by a signed-in CMS user — renders a non-live offer with a notice */
  preview: boolean;
  /** render the landing page (live, or authorised preview) */
  visible: boolean;
  discount?: Discount;
  /** published collection to link "view all" to */
  collectionSlug?: string;
  products: Product[];
  scope: ProductScope;
  others: Offer[];
}

const bestsellers = (list: Product[]) => [...list].sort((a, b) => b.sold - a.sold);

export function useOfferLanding(slug: string | undefined): OfferLanding {
  const offers = useDb((s) => s.offers);
  const discounts = useDb((s) => s.discounts);
  const collections = useDb((s) => s.collections);
  const products = useDb((s) => s.products);
  const authed = useUi((s) => s.adminAuthed);
  const [params] = useSearchParams();
  const wantsPreview = params.get('preview') === '1';

  return useMemo(() => {
    const offer = offers.find((o) => o.slug === slug);
    const state = offer ? offerState(offer) : null;
    const preview = !!offer && state !== 'active' && wantsPreview && authed;
    const visible = !!offer && (state === 'active' || preview);
    // a paused / expired rule gives no discount, so the page must not promise one (the rule is the source of truth)
    const linked = offer?.discountId ? discounts.find((d) => d.id === offer.discountId) : undefined;
    // (a preview shows the rule as prepared, unless it has already expired)
    const ls = linked ? discountState(linked) : null;
    const discount = linked && (ls === 'active' || (preview && ls !== 'expired')) ? linked : undefined;
    const live = products.filter((p) => p.status === 'active');
    const others = offers.filter((o) => o.id !== offer?.id && offerState(o) === 'active');

    // participating products: the offer's collection + hand-picked products, else what the discount targets
    const picked = new Map<string, Product>();
    const collection = offer?.collectionId ? collections.find((c) => c.id === offer.collectionId) : undefined;
    if (collection) for (const p of collectionProducts(collection, products, { publicOnly: true })) picked.set(p.id, p);
    for (const id of offer?.productIds ?? []) {
      const p = live.find((x) => x.id === id);
      if (p) picked.set(p.id, p);
    }
    if (!picked.size && discount && discount.appliesTo.scope !== 'all') {
      const ids = discount.appliesTo.ids;
      if (discount.appliesTo.scope === 'products') for (const p of live.filter((x) => ids.includes(x.id))) picked.set(p.id, p);
      else for (const c of collections.filter((x) => ids.includes(x.id))) for (const p of collectionProducts(c, products, { publicOnly: true })) picked.set(p.id, p);
    }
    const scope: ProductScope = picked.size ? (discount ? 'offer' : 'collection') : 'all';
    const list = picked.size ? [...picked.values()] : bestsellers(live);

    return {
      offer,
      state,
      preview,
      visible,
      discount,
      collectionSlug: collection?.published ? collection.slug : undefined,
      products: list,
      scope,
      others,
    };
  }, [offers, discounts, collections, products, slug, wantsPreview, authed]);
}

/** "−15%", "−25,00 €", "free shipping", "a free item" — the big number of the offer. */
export function valueText(d: Discount | undefined, lang: Lang, words: { free: string; bxgy: string }): string | null {
  if (!d) return null;
  const v = discountValueLabel(d);
  if (v.type === 'percent') return `−${v.value}%`;
  if (v.type === 'fixed') return `−${money(v.value, lang, { decimals: v.value % 1 !== 0 })}`;
  if (v.type === 'free') return words.free;
  return words.bxgy;
}

/* ------------------------------------------------------------------ */
/* Dates — Chrome ships without Albanian Intl data, so month names are  */
/* spelled out here for SQ                                              */
/* ------------------------------------------------------------------ */
const SQ_MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
const SQ_NATIVE = (() => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(['sq']).length > 0;
  } catch {
    return false;
  }
})();

export function longDate(iso: string, lang: Lang) {
  const d = new Date(iso);
  if (lang === 'sq' && !SQ_NATIVE) return `${d.getDate()} ${SQ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return date(d, lang, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function shortDate(iso: string, lang: Lang) {
  const d = new Date(iso);
  if (lang === 'sq' && !SQ_NATIVE) return `${d.getDate()} ${SQ_MONTHS[d.getMonth()]}`;
  return date(d, lang, { day: 'numeric', month: 'long' });
}

/** Whole days left (0 = last day), or null without an end date. */
export function daysLeft(endsAt: string | undefined, now = Date.now()) {
  if (!endsAt) return null;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 86400000));
}

/* ------------------------------------------------------------------ */
/* Campaign counters (offers centre → "vizita në ofertë, klikime në CTA")  */
/* ------------------------------------------------------------------ */
export function bumpOfferMetric(id: string, key: 'visits' | 'ctaClicks') {
  useDb.setState((s) => ({ offers: s.offers.map((o) => (o.id === id ? { ...o, metrics: { ...o.metrics, [key]: o.metrics[key] + 1 } } : o)) }));
}

/** One visit per offer per browser session; previews are never counted. */
export function useCountVisit(offer: Offer | undefined, live: boolean) {
  const id = offer?.id;
  useEffect(() => {
    if (!id || !live) return;
    const key = `optika-offer-visit:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      return;
    }
    bumpOfferMetric(id, 'visits');
  }, [id, live]);
}
