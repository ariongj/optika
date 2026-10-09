// Shared by the initial HTML and client navigation. No fabricated ratings,
// delivery promises, publication dates or certification claims belong here.
export const privateSeoPaths = ['/account', '/staff', '/operations', '/login', '/register', '/wishlist', '/order-status'];

export function canonicalUrl(site, path = '/') {
  const url = new URL(path, `${site.replace(/\/$/, '')}/`);
  url.hash = '';
  if (!/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  // Filter/sort parameters do not create new indexable catalogue pages.
  const product = url.searchParams.get('product');
  url.search = product ? `?product=${encodeURIComponent(product)}` : '';
  return url.href;
}

export function socialImagePath(image = '/og.png') {
  return image.replace(/^\/assets\/products\/([^/]+)\.webp$/, '/assets/social/$1.jpg');
}

export function productSeoTitle(product) {
  const title = product.seoTitle || `${product.name} · ${product.type === 'Sunglasses' ? 'Syze dielli' : 'Syze me dioptri'}`;
  return title.includes('Optika Miftari') ? title : `${title} | Optika Miftari`;
}

export function articleSeoTitle(article) {
  return `${article.title} | Lens Focus · Optika Miftari`;
}

export function seoGraph({ site, path, title, description, image = '/og.png', product, article, productPath, language = 'sq' }) {
  const absolute = value => new URL(value, `${site}/`).href;
  const url = canonicalUrl(site, path);
  const groupId = `${site}/#holding-group`;
  const opticalId = `${site}/optical/#organization`;
  const labId = `${site}/laboratory/#organization`;
  const clinicId = `${site}/clinic/#organization`;
  const graph = [
    { '@type': 'Organization', '@id': groupId, name: 'Miftari Holding Group', url: `${site}/`, logo: absolute('/assets/brand/optika-miftari-monogram.png') },
    { '@type': 'WebSite', '@id': `${site}/#website`, name: 'Miftari Holding Group', url: `${site}/`, publisher: { '@id': groupId }, inLanguage: ['sq', 'en'] },
  ];
  let organization = groupId;
  if (path.startsWith('/laboratory') || path.startsWith('/lens-focus')) {
    organization = labId;
    graph.push({ '@type': 'Organization', '@id': labId, name: 'Optical Lab', url: `${site}/laboratory/`, parentOrganization: { '@id': groupId }, telephone: '+38343777667', location: { '@type': 'Place', name: 'Kosovo' } });
  } else if (path.startsWith('/clinic')) {
    organization = clinicId;
    graph.push({ '@type': 'Organization', '@id': clinicId, name: 'Klinika Miftari', url: `${site}/clinic/`, parentOrganization: { '@id': groupId }, location: { '@type': 'Place', name: 'Kosovo' } });
  } else if (path !== '/' && !privateSeoPaths.includes(path.replace(/\/$/, ''))) {
    organization = opticalId;
    graph.push({ '@type': 'Optician', '@id': opticalId, name: 'Optika Miftari', url: `${site}/optical/`, parentOrganization: { '@id': groupId }, telephone: '+38343777667', image: absolute('/assets/brand/optika-editorial-campaign-2026.webp'), address: { '@type': 'PostalAddress', streetAddress: 'Mbretëresha Teutë 182', addressLocality: 'Mitrovicë', postalCode: '40000', addressCountry: 'XK' }, sameAs: ['https://www.instagram.com/optikamiftari/'] });
  }
  const page = { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: language, isPartOf: { '@id': `${site}/#website` }, about: { '@id': organization }, primaryImageOfPage: { '@type': 'ImageObject', url: absolute(image) } };
  graph.push(page);
  const crumbs = [{ '@type': 'ListItem', position: 1, name: language === 'en' ? 'Home' : 'Ballina', item: `${site}/` }];
  if (product?.id) {
    const category = product.type === 'Sunglasses' ? '/sunglasses' : '/prescription-glasses';
    crumbs.push({ '@type': 'ListItem', position: 2, name: product.type === 'Sunglasses' ? 'Syze dielli' : 'Syze me dioptri', item: canonicalUrl(site, category) });
    const entity = { '@type': 'Product', '@id': `${url}#product`, name: product.name, description: product.metaDescription || product.description, sku: product.sku || product.id, image: (product.gallery?.length ? product.gallery : [product.image]).filter(Boolean).map(absolute), color: product.color, material: product.material, category: product.type === 'Sunglasses' ? 'Syze dielli' : 'Syze me dioptri', offers: { '@type': 'Offer', url, price: Number(product.salePrice || product.price), priceCurrency: 'EUR', availability: Number(product.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@id': opticalId } } };
    if (product.brand) entity.brand = { '@type': 'Brand', name: product.brand };
    // Only a supplied manufacturer is a brand; the retailer is the seller.
    graph.push(entity);
    page.mainEntity = { '@id': entity['@id'] };
  } else if (article) {
    crumbs.push({ '@type': 'ListItem', position: 2, name: 'Lens Focus', item: canonicalUrl(site, '/lens-focus') });
    const entity = { '@type': 'Article', '@id': `${url}#article`, headline: article.title, description: article.excerpt, articleSection: article.category, inLanguage: language, mainEntityOfPage: { '@id': page['@id'] }, image: absolute(image), author: { '@type': 'Organization', name: 'Optika Miftari', url: `${site}/about/` }, publisher: { '@id': groupId } };
    for (const key of ['datePublished', 'dateModified']) if (article[key] && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(article[key])) entity[key] = article[key];
    graph.push(entity);
    page.mainEntity = { '@id': entity['@id'] };
  }
  if (path !== '/') {
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: product?.name || article?.title || title.split('|')[0].trim(), item: url });
    const breadcrumb = { '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs };
    graph.push(breadcrumb);
    page.breadcrumb = { '@id': breadcrumb['@id'] };
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
