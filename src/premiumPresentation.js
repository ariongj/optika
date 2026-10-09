import { uniqueModels, modelVariants } from './commercePresentation.js';

// Preview only: product IDs, prices, stock and variants always come from the catalogue.
export function homepageSelection(products, kind = 'all', configured = '') {
  const filtered = products.filter(product => kind === 'all' || product.type === kind);
  const models = uniqueModels(filtered);
  const ids = (configured.trim() || 'prm-m2,nov-n04,sol-s7,vtx-x1').split(',').map(id => id.trim());
  return uniqueModels([...ids.map(id => filtered.find(product => product.id === id)).filter(Boolean), ...models])
    .slice(0, 4).map(product => ({ product, variants: modelVariants(filtered, product) }));
}
