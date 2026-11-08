import { AnimatePresence, motion } from '@/lib/motion';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/site/components/ProductCard';
import { cn } from '@/lib/utils';

/** Responsive ProductCard grid (2 → 3 → 4 columns). Cards fade in when they appear. */
export function ProductGrid({ products, className }: { products: Product[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-14', className)}>
      <AnimatePresence initial={false}>
        {products.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex"
          >
            <ProductCard product={p} priority={i < 4} className="w-full" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
