import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem, Lang, RoleId } from '@/lib/types';
import { safeStorage } from './storage';
import { BACKEND } from '@/lib/backend/api';

export function cartKey(productId: string, options: Record<string, string>, installation: boolean) {
  const opts = Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join('&');
  return `${productId}|${opts}|${installation ? 'i' : ''}`;
}

/** Codes are stored trimmed, without spaces, uppercase (same as the discount engine). */
const norm = (code: string) => code.trim().replace(/\s+/g, '').toUpperCase();

interface UiState {
  lang: Lang;
  /** The visitor picked a language themselves (otherwise the shop's default language applies) */
  langChosen: boolean;
  adminLang: Lang;
  cart: CartItem[];
  wishlist: string[];
  /** Entered discount codes, in entry order */
  codes: string[];
  /** Legacy alias of codes[0] — kept in sync by every code action */
  coupon: string | null;
  recentlyViewed: string[];
  adminAuthed: boolean;
  /** Role the demo admin acts as (Roles & permissions, PDF p.42) */
  adminRole: RoleId;
  cartOpen: boolean;
  searchOpen: boolean;

  setLang: (lang: Lang) => void;
  setAdminLang: (lang: Lang) => void;
  /** max: the most this product may have in the bag (maxOrderQty) — adding again never goes past it */
  /** Returns how many were actually added (0 when the stock is already all in the cart). */
  addToCart: (item: Omit<CartItem, 'key'>, max?: number) => number;
  /** Drops lines whose product is gone or no longer on sale and trims quantities to what can be ordered. */
  tidyCart: (allowed: Map<string, number>) => void;
  setQty: (key: string, qty: number) => void;
  setInstallation: (key: string, on: boolean) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  toggleWishlist: (productId: string) => void;
  addCode: (code: string) => void;
  removeCode: (code: string) => void;
  clearCodes: () => void;
  /** Legacy: replace the first code (null removes it) */
  setCoupon: (code: string | null) => void;
  pushViewed: (productId: string) => void;
  login: () => void;
  logout: () => void;
  setAdminRole: (role: RoleId) => void;
}

const withCodes = (codes: string[]) => ({ codes, coupon: codes[0] ?? null });

export const UI_VERSION = 3;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      lang: 'sq',
      langChosen: false,
      adminLang: 'sq',
      cart: [],
      wishlist: [],
      codes: [],
      coupon: null,
      recentlyViewed: [],
      adminAuthed: false,
      adminRole: 'owner',
      cartOpen: false,
      searchOpen: false,

      setLang: (lang) => set({ lang, langChosen: true }),
      setAdminLang: (adminLang) => set({ adminLang }),
      addToCart: (item, max = Infinity) => {
        let added = 0;
        set((s) => {
          const key = cartKey(item.productId, item.options, item.installation);
          // the same product with other options counts too: stock is per product
          const others = s.cart.filter((c) => c.productId === item.productId && c.key !== key).reduce((n, c) => n + c.qty, 0);
          const room = Math.max(0, max - others);
          const existing = s.cart.find((c) => c.key === key);
          if (existing) {
            const qty = Math.max(1, Math.min(room, existing.qty + item.qty));
            added = Math.max(0, qty - existing.qty);
            return qty === existing.qty ? {} : { cart: s.cart.map((c) => (c.key === key ? { ...c, qty } : c)) };
          }
          if (room < 1) return {};
          added = Math.min(room, item.qty);
          return { cart: [...s.cart, { ...item, qty: added, key }] };
        });
        return added;
      },
      tidyCart: (allowed) =>
        set((s) => {
          const used = new Map<string, number>();
          let changed = false;
          const cart: CartItem[] = [];
          for (const c of s.cart) {
            const max = allowed.get(c.productId);
            if (max === undefined) {
              changed = true;
              continue;
            }
            const room = max - (used.get(c.productId) ?? 0);
            if (room < 1) {
              changed = true;
              continue;
            }
            const qty = Math.min(c.qty, room);
            if (qty !== c.qty) changed = true;
            used.set(c.productId, (used.get(c.productId) ?? 0) + qty);
            cart.push(qty === c.qty ? c : { ...c, qty });
          }
          return changed ? { cart } : {};
        }),
      setQty: (key, qty) =>
        set((s) => ({
          cart: qty <= 0 ? s.cart.filter((c) => c.key !== key) : s.cart.map((c) => (c.key === key ? { ...c, qty } : c)),
        })),
      setInstallation: (key, on) =>
        set((s) => {
          const line = s.cart.find((c) => c.key === key);
          if (!line) return {};
          const newKey = cartKey(line.productId, line.options, on);
          const clash = s.cart.find((c) => c.key === newKey);
          if (clash) {
            return {
              cart: s.cart
                .filter((c) => c.key !== key)
                .map((c) => (c.key === newKey ? { ...c, qty: c.qty + line.qty } : c)),
            };
          }
          return { cart: s.cart.map((c) => (c.key === key ? { ...c, installation: on, key: newKey } : c)) };
        }),
      removeFromCart: (key) => set((s) => ({ cart: s.cart.filter((c) => c.key !== key) })),
      clearCart: () => set({ cart: [], ...withCodes([]) }),
      setCartOpen: (cartOpen) => set({ cartOpen }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      toggleWishlist: (id) =>
        set((s) => ({ wishlist: s.wishlist.includes(id) ? s.wishlist.filter((w) => w !== id) : [...s.wishlist, id] })),
      addCode: (code) =>
        set((s) => {
          const c = norm(code);
          return c && !s.codes.includes(c) ? withCodes([...s.codes, c]) : {};
        }),
      removeCode: (code) => set((s) => withCodes(s.codes.filter((c) => c !== norm(code)))),
      clearCodes: () => set(withCodes([])),
      setCoupon: (code) =>
        set((s) => {
          const c = code ? norm(code) : '';
          const rest = s.codes.slice(1).filter((x) => x !== c);
          return withCodes(c ? [c, ...rest] : rest);
        }),
      pushViewed: (id) => set((s) => ({ recentlyViewed: [id, ...s.recentlyViewed.filter((v) => v !== id)].slice(0, 12) })),
      login: () => set({ adminAuthed: true }),
      logout: () => set({ adminAuthed: false }),
      setAdminRole: (adminRole) => set({ adminRole }),
    }),
    {
      name: 'optika-ui',
      version: UI_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        lang: s.lang,
        langChosen: s.langChosen,
        adminLang: s.adminLang,
        cart: s.cart,
        wishlist: s.wishlist,
        codes: s.codes,
        coupon: s.coupon,
        recentlyViewed: s.recentlyViewed,
        // server-backed build: who is signed in comes from the session cookie, never from this browser's storage
        ...(BACKEND ? {} : { adminAuthed: s.adminAuthed, adminRole: s.adminRole }),
      }),
      // v1 → v2: keep the shopper's cart, wishlist, history, language and login; the CMS now opens in
      // Albanian (sq) as owner; the single coupon becomes the first entry of `codes`.
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as Partial<UiState>;
        if (version >= UI_VERSION) return old as UiState;
        // v2 → v3: a language other than the old fixed default was the visitor's own choice — keep it
        if (version === 2) return { ...old, langChosen: !!old.lang && old.lang !== 'sq' } as UiState;
        const codes = old.coupon ? [norm(old.coupon)] : [];
        return {
          lang: old.lang ?? 'sq',
          langChosen: !!old.lang && old.lang !== 'sq',
          adminLang: 'sq',
          cart: Array.isArray(old.cart) ? old.cart : [],
          wishlist: Array.isArray(old.wishlist) ? old.wishlist : [],
          recentlyViewed: Array.isArray(old.recentlyViewed) ? old.recentlyViewed : [],
          adminAuthed: !!old.adminAuthed,
          adminRole: 'owner',
          ...withCodes(codes),
        } as UiState;
      },
    },
  ),
);
