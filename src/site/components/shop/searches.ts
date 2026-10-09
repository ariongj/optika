import type { Lang } from '@/lib/types';

/** Popular eyewear searches per storefront language (search overlay + /kerko). Terms without hits are hidden. */
export const EYEWEAR_SEARCHES: Record<Lang, string[]> = {
  me: ['titan', 'avijator', 'polarizovana', 'progresivna', 'za ekran', 'cat-eye', 'fotohromatska', 'panto'],
  sq: ['titan', 'aviator', 'të polarizuara', 'progresive', 'për ekran', 'cat-eye', 'fotokromatike', 'panto'],
  en: ['titanium', 'aviator', 'polarised', 'progressive', 'screen', 'cat-eye', 'photochromic', 'panto'],
};
