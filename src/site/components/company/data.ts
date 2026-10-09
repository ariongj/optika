import { useMemo } from 'react';
import type { HomeSection, HomeSectionType } from '@/lib/types';
import { useDb } from '@/store/db';

export type SectionData<T extends HomeSectionType> = Extract<HomeSection, { type: T }>['data'];

/**
 * Content of a homepage section, looked up by type. The company pages reuse
 * the CMS-managed homepage blocks (services, process, stats, faq…) so the
 * client edits that content in one place. Visibility on the homepage does not
 * matter here — the data is used even when the block is hidden on "/".
 */
export function useHomeData<T extends HomeSectionType>(type: T): SectionData<T> | undefined {
  const home = useDb((s) => s.home);
  return useMemo(() => home.find((h) => h.type === type)?.data as SectionData<T> | undefined, [home, type]);
}

/** Smooth-scroll to an in-page anchor without touching the URL. */
export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export const waHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;
