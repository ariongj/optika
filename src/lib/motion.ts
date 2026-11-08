/**
 * Motion for the storefront: the small `m` components, with the animation features loaded once in App.tsx, under the usual
 * name. Import from here, not from 'motion/react'. The full `motion` also brings layout projection, which gives every
 * animated element a node that measures the page: on a phone, that was more start-up time than React itself. A file that
 * needs it (`layout`, `layoutId`, `drag`) imports `* as motion from 'motion/react-client'`, as the wishlist does, so that it
 * loads for that page only.
 */
export { animate, AnimatePresence, domAnimation, LazyMotion, m as motion, useReducedMotion } from 'motion/react';
