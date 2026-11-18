import { toast } from 'sonner';
import { useDict } from '@/i18n';
import { common } from '@/i18n/common';
import { useUi } from '@/store/ui';

/**
 * "Add to cart" adds nothing once the whole stock of a product is already in the cart (stock is per product, so
 * other options count too). This says so instead of showing "Added". Returns true when nothing was added.
 */
export function useCartFull() {
  const tc = useDict(common);
  const setCartOpen = useUi((s) => s.setCartOpen);
  return (added: number, viewCart: string) => {
    if (added > 0) return false;
    toast.info(tc('cartFull'), { action: { label: viewCart, onClick: () => setCartOpen(true) } });
    return true;
  };
}
