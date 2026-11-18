// Tiny shared state of the server-backed build (no imports from the stores, so the stores can import it).
import { create } from 'zustand';
import type { Db } from '@/lib/types';

/** Lists and values every visitor's browser gets (server: mv_public_build). The rest is staff-only. */
export const PUBLIC_KEYS = [
  'settings', 'categories', 'products', 'collections', 'discounts', 'offers', 'placements', 'pages', 'posts', 'projects', 'home', 'menus',
  'services', 'staff', 'bookings', 'seededAt',
] as const satisfies readonly (keyof Db)[];
export type PublicKey = (typeof PUBLIC_KEYS)[number];

export type DataMode = 'visitor' | 'staff';

export interface BackendState {
  mode: DataMode;
  /** Shop data has arrived from the server (public snapshot, a kept copy of it, or the staff snapshot) */
  loaded: boolean;
  /** The shop has been set up (an owner imported its catalogue); false = visitors see the maintenance page */
  ready: boolean;
  /** The last public snapshot could not be fetched (offline / server down) */
  offline: boolean;
}
export const useBackend = create<BackendState>(() => ({ mode: 'visitor', loaded: false, ready: true, offline: false }));
export const dataMode = (): DataMode => useBackend.getState().mode;
