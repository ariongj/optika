// One information architecture for desktop panels and mobile accordions.
// Every destination is an existing page, not an article or a section jump.
export function megaNavigation(items, english = false) {
  const t = (sq, en) => english ? en : sq;
  const link = (target, path, sq, en) => ({ target, path, label: t(sq, en) });
  const extra = {
    fit: link('fit', '/virtual-try-on', 'Prova virtuale 3D', 'Virtual try-on'),
    wishlist: link('wishlist', '/wishlist', 'Të preferuarat', 'Saved frames'),
    account: link('account', '/account', 'Llogaria ime', 'My account'),
    orderStatus: link('orderStatus', '/order-status', 'Ndiq porosinë', 'Track an order'),
    contact: link('contact', '/contact', 'Na vizitoni', 'Visit us'),
  };
  const destinations = Object.fromEntries(items.flatMap(item => [item, ...item.children]).map(item => [item.target, item]));
  const column = (sq, en, links) => ({ title: t(sq, en), links });
  const feature = (item, image, sq, en, kind = 'photo') => ({ ...item, image, caption: t(sq, en), kind });
  return items.map(item => {
    if (!item.children.length) return item;
    const overview = { target: item.target, path: item.path, label: t(`Zbuloni ${item.label}`, `Explore ${item.label}`) };
    let columns, features;
    if (item.target === 'optical') {
      columns = [
        column('Zbuloni', 'Explore', [overview, destinations.shop, destinations.examination]),
        column('Zgjedhja juaj', 'Find your pair', [extra.fit, extra.wishlist]),
        column('Për porosinë', 'Your order', [extra.account, extra.orderStatus, destinations.policies]),
      ];
      features = [
        feature(destinations.prescription, '/assets/products/prism-m2-studio.webp', 'Për çdo ditë', 'For every day', 'product'),
        feature(destinations.sunglasses, '/assets/products/solstice-s7-studio.jpg', 'Në dritë tjetër', 'A sunnier outlook', 'product'),
      ];
    } else if (item.target === 'brand') {
      columns = [
        column('Laboratori', 'The laboratory', [overview, destinations.guides]),
        column('Për profesionistët', 'For professionals', [destinations.partners, extra.contact]),
      ];
      features = [
        feature(destinations.labKosovo, '/assets/brand/optika-craftsmanship-2026-small.webp', 'Partneritet lokal · Kosovë', 'Local partnerships · Kosovo'),
        feature(destinations.labEurope, '/assets/brand/miftari-lab-partnership-small.webp', 'Partneritete evropiane · English', 'European partnerships · English'),
      ];
    } else {
      overview.label = t('Rreth grupit', 'About the group');
      columns = [
        column('Grupi Miftari', 'Miftari Group', [overview, destinations.home]),
        column('Tri specializime', 'Three specialisms', [destinations.optical, destinations.brand, destinations.clinic]),
        column('Pranë jush', 'Here to help', [extra.contact, destinations.policies, extra.orderStatus]),
      ];
      features = [
        feature(destinations.examination, '/assets/brand/optika-examination-2026-small.webp', 'Kujdes personal', 'Personal care'),
        feature(extra.fit, '/assets/brand/optika-home-category-2026-small.webp', 'Gjeni formën tuaj', 'Find your shape'),
      ];
    }
    return { ...item, columns, features, children: [...columns.flatMap(col => col.links), ...features] };
  });
}

export function navigationIndex(key, current, length) {
  if (!length) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowUp') return current <= 0 ? length - 1 : current - 1;
  return (current + 1) % length;
}
