import { normalizeSearch } from './catalogSearch.js';

export const isOrderClosed = (order) => ['Completed', 'Cancelled', 'Returned'].includes(order.status);
export const isOrderReady = (order) => !isOrderClosed(order) && (order.status === 'Ready' || order.fulfillmentStatus === 'Ready for pickup');
export const isAppointmentOpen = (item) => !['Completed', 'Closed', 'Cancelled'].includes(item.status);
export const labBusinessLabels = {
  optical: 'Optikë', clinic: 'Klinikë', distributor: 'Distributor', other: 'Biznes tjetër'
};
export const labInterestLabels = {
  prescription: 'Lente me recetë', mounting: 'Montim dhe përfundim',
  documentation: 'Dokumentacion teknik', partnership: 'Bashkëpunim B2B'
};
export const labMarketSegment = (item) => item.division === 'lab' && ['kosovo', 'eu'].includes(item.marketSegment) ? item.marketSegment : '';
export const labMarketLabel = (item) => ({ kosovo: 'Kosovë', eu: 'Bashkimi Evropian · EU' }[labMarketSegment(item)] || item.market || 'Pa segment të përcaktuar');
export function submissionCountryLabel(code, locale = 'sq') {
  if (!code) return 'Nuk është dhënë';
  if (String(code).toUpperCase() === 'XK') return locale === 'en' ? 'Kosovo' : 'Kosovë';
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(String(code).toUpperCase()) || code; }
  catch { return String(code); }
}
export function submissionMatches(item, query = '', statusLabel = (value) => value) {
  const fields = ['id', 'name', 'email', 'phone', 'service', 'status', 'division', 'organization', 'market',
    'marketSegment', 'country', 'businessType', 'interest', 'sourcePath', 'locale', 'website', 'assignedTo', 'applicationRequestId'];
  const text = normalizeSearch([
    ...fields.map((field) => item[field]), statusLabel(item.status),
    item.division === 'lab' ? labMarketLabel(item) : '',
    item.division === 'lab' ? 'Optical Lab laborator B2B' : '',
    labBusinessLabels[item.businessType], labInterestLabels[item.interest],
    item.country ? submissionCountryLabel(item.country) : '',
    item.country ? submissionCountryLabel(item.country, 'en') : '',
    labMarketSegment(item) === 'eu' ? 'BE EU Europe Evropë European' : ''
  ].join(' '));
  return normalizeSearch(query).split(' ').filter(Boolean).every((word) => text.includes(word));
}
export const accountOrderMatches = (order, filter, query = '') => {
  const statusMatches = filter === 'active' ? !isOrderClosed(order) : filter === 'ready' ? isOrderReady(order) : filter === 'history' ? isOrderClosed(order) : true;
  const text = normalizeSearch([order.id, order.product, ...(order.items || []).flatMap((item) => [item.name, item.sku])].join(' '));
  return statusMatches && normalizeSearch(query).split(' ').every((word) => text.includes(word));
};

// Each dashboard count uses exactly the same predicate as its destination list.
export const serviceQueues = {
  lab: { section: 'Orders', label: 'Në laborator', test: (item) => item.status === 'In lab' },
  ready: { section: 'Orders', label: 'Gati për dorëzim', test: isOrderReady },
  unpaid: { section: 'Orders', label: 'Pagesa për t’u ndjekur', test: (item) => !['Paid', 'Refunded'].includes(item.paymentStatus) && !['Cancelled', 'Returned'].includes(item.status) },
  pending: { section: 'Orders', label: 'Për t’u konfirmuar', test: (item) => item.status === 'Pending' },
  followup: { section: 'Appointments', label: 'Për kontakt', test: (item) => ['New', 'Contacted'].includes(item.status) },
  contactFollowup: { section: 'Contacts', label: 'Për kontakt', test: (item) => ['New', 'Contacted'].includes(item.status) },
  confirmed: { section: 'Appointments', label: 'Termine / kontakte të konfirmuara', test: (item) => item.status === 'Confirmed' },
  opticalEnquiries: { section: 'Contacts', label: 'Optical · kërkesat', test: (item) => !item.division || item.division === 'optical' },
  labEnquiries: { section: 'Contacts', label: 'Optical Lab · B2B', test: (item) => item.division === 'lab' },
  labKosovoEnquiries: { section: 'Contacts', label: 'Optical Lab · Kosovë', test: (item) => labMarketSegment(item) === 'kosovo' },
  labEuropeEnquiries: { section: 'Contacts', label: 'Optical Lab · Bashkimi Evropian', test: (item) => labMarketSegment(item) === 'eu' },
  labLegacyEnquiries: { section: 'Contacts', label: 'Optical Lab · pa segment', test: (item) => item.division === 'lab' && !labMarketSegment(item) },
  clinicEnquiries: { section: 'Contacts', label: 'Klinika Miftari · kontaktet', test: (item) => item.division === 'clinic' },
  published: { section: 'Products', label: 'Të publikuara', test: (item) => (item.status || 'Published') === 'Published' },
  draft: { section: 'Products', label: 'Draft / arkiv', test: (item) => (item.status || 'Published') !== 'Published' },
  empty: { section: 'Products', label: 'Pa stok', test: (item) => Number(item.stock || 0) === 0 },
  low: { section: 'Products', label: 'Stok i ulët', test: (item) => Number(item.stock || 0) <= 5 }
};
export const queueItems = (items, queue, section) => serviceQueues[queue]?.section === section ? items.filter(serviceQueues[queue].test) : items;

export function orderNextStep(order) {
  if (order.status === 'Cancelled') return 'Kjo porosi është anuluar. Për sqarime, kontaktoni optikën me kodin e porosisë.';
  if (order.status === 'Returned') return 'Kthimi është regjistruar. Gjendja e pagesës shfaqet veçmas më poshtë.';
  if (order.status === 'Return requested') return 'Kërkesa për kthim po shqyrtohet nga ekipi. Prisni konfirmimin për hapat e radhës.';
  if (order.status === 'Completed' || order.fulfillmentStatus === 'Delivered') return 'Porosia është përfunduar. Na kontaktoni nëse ju duhet përshtatje ose ndihmë.';
  if (order.fulfillmentStatus === 'Shipped') return 'Porosia është dërguar. Kodi i gjurmimit shfaqet sapo shtohet nga ekipi.';
  if (isOrderReady(order)) return 'Porosia është gati. Koordinoni marrjen ose dorëzimin me optikën.';
  if (order.status === 'In lab' || order.fulfillmentStatus === 'Processing') return 'Porosia po përgatitet. Ekipi përditëson statusin pas kontrollit përfundimtar.';
  if (order.status === 'Confirmed') return 'Porosia është konfirmuar. Punimi me recetë vijon pas verifikimit optik.';
  return 'Kërkesa është marrë. Ekipi do të verifikojë stokun, konfigurimin dhe mënyrën e dorëzimit.';
}
