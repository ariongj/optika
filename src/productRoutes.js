// Published CMS additions are rendered by the read-only Hostinger SEO endpoint.
// Legacy/non-slug identifiers retain the query URL for a safe reload.
export function reloadableProductPath(productOrId, bundledProducts = []) {
  const id = typeof productOrId === 'string' ? productOrId : productOrId?.id;
  if (!id) return '/shop';
  const bundled = bundledProducts.find(product => product.id === id);
  const current = typeof productOrId === 'object' ? productOrId : null;
  const product = ['Sunglasses', 'Prescription Glasses'].includes(current?.type) ? current : bundled || current;
  if (!product || !/^[a-z0-9][a-z0-9_-]{0,199}$/i.test(id)) return `/shop?product=${encodeURIComponent(id)}`;
  const category = product.type === 'Sunglasses' ? 'syze-dielli' : 'syze-optike';
  return `/${category}/${encodeURIComponent(id)}`;
}

export function shopProductId(pathname, search = '') {
  if (pathname !== '/shop') return null;
  const id = new URLSearchParams(search).get('product');
  return id && id.length <= 200 ? id : null;
}
