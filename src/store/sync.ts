import { useDb } from './db';
import { useUi } from './ui';
import { BACKEND } from '@/lib/backend/api';
import { dataMode } from '@/lib/backend/mode';

/**
 * Keep every open tab (storefront, admin, live-preview iframe) in sync:
 * when one tab writes to localStorage, the others rehydrate instantly.
 * This is what makes "place an order in one tab → it pops up in the CMS" work.
 */
export function startCrossTabSync() {
  const onStorage = (e: StorageEvent) => {
    if (!BACKEND && e.key === 'optika-db') void useDb.persist.rehydrate();
    // server-backed build: only visitors' tabs follow the kept catalogue (staff tabs sync with the server)
    if (BACKEND && e.key === 'mv-db' && dataMode() === 'visitor') void useDb.persist.rehydrate();
    if (e.key === 'optika-ui') void useUi.persist.rehydrate();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
