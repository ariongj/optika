import { useMemo } from 'react';
import { useDb } from '@/store/db';
import type { Post } from '@/lib/types';
import { slugify } from '@/lib/utils';

/** Language-independent key for a post's tag (used in ?tag= filters). */
export const tagKey = (p: Post) => slugify(p.tag.me);

export const postHref = (p: Post) => `/keshilla/${p.slug}`;

/** Published posts, newest first. */
export function usePublishedPosts() {
  const posts = useDb((s) => s.posts);
  return useMemo(() => posts.filter((p) => p.published).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), [posts]);
}

/** `## Heading` lines of a markdown body — used for the article table of contents. */
export function headingsOf(md: string) {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).replace(/\*\*?|\[|\]\([^)]*\)/g, '').trim());
}

/** "tel:" href from a human-formatted phone number. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Copy text to the clipboard with a fallback for older / non-secure contexts. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
