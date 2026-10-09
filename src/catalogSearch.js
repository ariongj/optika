import { translate } from './i18n/locale.js';
// Index both languages, independently of the selected display language.
export const normalizeSearch = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ignoredWords = new Set(['te', 'me', 'e', 'i', 'per', 'dhe', 'the', 'with']);
const tokens = (query) => normalizeSearch(query).split(' ').filter((word) => word && !ignoredWords.has(word));

export function productSearchText(product, label = (value) => value) {
  const fields = ['name', 'id', 'sku', 'type', 'collection', 'color', 'lensColor', 'frameShape', 'material', 'lensType', 'size', 'audience'];
  const aliases = [
    product.type === 'Sunglasses' ? 'syze dielli sunglasses' : 'syze optike dioptri receta prescription optical',
    product.polarized ? 'polarizuara polarizuar polarized polarizim' : '',
    product.blueLight ? 'drite blu ekran blue light' : '',
    product.prescriptionReady ? 'recete dioptri' : '',
    product.frameWidth ? `${product.frameWidth} mm` : ''
  ];
  return normalizeSearch([...fields.flatMap((key) => [product[key], label(product[key]), translate(label(product[key]), 'en')]), ...aliases].join(' '));
}

export function searchProducts(products, query, label) {
  const terms = tokens(query);
  if (!terms.length) return products;
  return products.map((product, index) => {
    const text = productSearchText(product, label);
    if (!terms.every((term) => text.includes(term))) return null;
    const name = normalizeSearch(product.name), sku = normalizeSearch(product.sku);
    const normalized = normalizeSearch(query);
    const score = (name === normalized || sku === normalized ? 100 : 0) + terms.reduce((sum, term) => sum + (name.includes(term) ? 5 : 0) + (sku.includes(term) ? 3 : 0), 0);
    return { product, index, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.index - b.index).map(({ product }) => product);
}
