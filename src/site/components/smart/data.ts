import { useMemo } from 'react';
import type { Product } from '@/lib/types';
import { useActiveProducts, useCategories } from '@/store/hooks';
import type { SmartPart, SmartVariant } from './three/SmartGlasses3D';

/** The storefront category that holds the smart glasses (by id, with a slug fallback for CMS-made copies). */
export const SMART_CATEGORY = 'cat-smart';
export const SMART_PATH = '/syze-inteligjente';
export const BOOK_SMART = '/rezervo?sherbimi=sv-smart';

/** Posters (dark renders by `smart3d`) shown until WebGL is ready, or instead of it. */
export const POSTER = '/images/smart/hero.webp';
export const POSTER_M = '/images/smart/hero-m.webp';

/** The three kinds on the page (the 3D model also has a 'sport' variant we don't sell separately). */
export type Kind = Extract<SmartVariant, 'camera' | 'audio' | 'display'>;
export const KINDS: Kind[] = ['camera', 'audio', 'display'];

/** Which kind each store product is (anything unknown in the category counts as a camera model). */
const KIND_OF: Record<string, Kind> = {
  'p-rayban-meta-wayfarer': 'camera',
  'p-rayban-meta-aviator': 'camera',
  'p-rayban-meta-zena': 'camera',
  'p-oakley-meta-hstn': 'camera',
  'p-rayban-meta-audio': 'audio',
  'p-meta-rayban-display': 'display',
};
export const kindOf = (p: Product): Kind => KIND_OF[p.id] ?? 'camera';

/** Story order (scroll-driven exploded view). */
export const STORY_PARTS: SmartPart[] = ['camera', 'led', 'speaker', 'mics', 'touch', 'battery', 'display'];

/** Products in the smart-glasses category, featured first. */
export function useSmartProducts() {
  const categories = useCategories();
  const all = useActiveProducts();
  const category = categories.find((c) => c.id === SMART_CATEGORY) ?? categories.find((c) => c.slug === 'syze-inteligjente');
  const products = useMemo(
    () => (category ? all.filter((p) => p.categoryId === category.id) : []).sort((a, b) => Number(b.featured) - Number(a.featured)),
    [all, category],
  );
  return { category, products };
}

/**
 * Whether the browser has WebGL at all — lets the page skip the 3D chunk where it can't run. Deliberately not a real
 * context probe (creating one costs as much as a frame on a slow phone); if the renderer later fails to start, the
 * poster stays.
 */
export function canWebGL() {
  return typeof window !== 'undefined' && ('WebGL2RenderingContext' in window || 'WebGLRenderingContext' in window);
}

/** Visitors on Save-Data / 2G get the posters instead of the 3D model. */
export function lightMode() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '');
}

/** Phones: the model fills more of its (smaller) stage. */
export const PHONE_FRAMING = { fill: 0.82, fillHeight: 0.76 };
