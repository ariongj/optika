// Stand-in for '@/store/ui' (zustand + localStorage) in the test bundle: src/i18n/index.ts imports useUi only for
// its React hooks; priceCart reaches nothing but the pure lt().
export function useUi() {
  throw new Error('useUi is not available in the pricing test bundle');
}
