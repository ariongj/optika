export const euro = (value) => new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(Number(value) || 0);

export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// A saved basket is an estimate. Display every line from the same authoritative
// quote as the subtotal, without mutating configurations or retry identities.
export function quotedCartLines(cart, quote) {
  return cart.map((line, index) => {
    const priced = quote?.items?.[index];
    return priced?.productId === line.productId && priced.quantity === line.quantity && Number.isFinite(priced.unitPrice)
      ? { ...line, price: priced.unitPrice } : line;
  });
}

export function checkoutDeliveryErrors(customer = {}) {
  const value = (key) => String(customer[key] || '').trim();
  const errors = {};
  if (!value('firstName')) errors.firstName = 'Shkruani emrin.';
  if (!value('lastName')) errors.lastName = 'Shkruani mbiemrin.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email'))) errors.email = 'Shkruani një adresë emaili të vlefshme.';
  const phoneDigits = value('phone').replace(/\D/g, '');
  if (!/^[+\d\s().-]+$/.test(value('phone')) || phoneDigits.length < 7 || phoneDigits.length > 15) errors.phone = 'Shkruani një numër telefoni të vlefshëm, me prefiks.';
  if (!['insured', 'express', 'pickup'].includes(customer.shipping)) errors.shipping = 'Zgjidhni mënyrën e dërgesës.';
  if (customer.shipping !== 'pickup') {
    if (!value('address')) errors.address = 'Shkruani adresën e dërgesës.';
    if (!value('city')) errors.city = 'Shkruani qytetin.';
    if (!/^[\p{L}\d -]{3,12}$/u.test(value('postcode'))) errors.postcode = 'Shkruani kodin postar të vlefshëm.';
    if (!['Kosovë', 'Shqipëri', 'Maqedoni e Veriut', 'Mal i Zi'].includes(customer.country)) errors.country = 'Zgjidhni shtetin e dërgesës.';
  }
  return errors;
}

// A successful HTTP response alone is not evidence of a saved order.
export function confirmedCheckoutOrder(result, expectedId) {
  const order = result?.order;
  return result?.accepted === true && order?.id === expectedId &&
    typeof order.total === 'number' && Number.isFinite(order.total) && order.total >= 0
    ? order : null;
}

// A timeout means "unknown", not "cancelled". The same reference must be retried.
export async function checkoutWithDeadline(operation, timeoutMs = 30000) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('checkout_timeout'), { code: 'checkout_timeout' })), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

// Availability is advisory here; the server rechecks the complete order atomically.
export function cartLineLimit(items, line, products) {
  const product = products.find((entry) => entry.id === line.productId);
  const others = items.filter((entry) => entry.productId === line.productId && entry.lineId !== line.lineId)
    .reduce((sum, entry) => sum + Number(entry.quantity || 1), 0);
  return Math.min(10, Math.max(0, Math.floor(Number(product?.stock) || 0) - others));
}

export function cartAvailability(items, products) {
  return items.filter((line) => Number(line.quantity || 1) > cartLineLimit(items, line, products));
}

export function removeSubmittedLines(current, submitted) {
  return current.flatMap((line) => {
    const sent = submitted.find((entry) => entry.lineId === line.lineId && entry.signature === line.signature);
    if (!sent) return [line];
    const remaining = Number(line.quantity || 1) - Number(sent.quantity || 1);
    return remaining > 0 ? [{ ...line, quantity: remaining }] : [];
  });
}

export function polarizedDiscountBase(cart, products) {
  return cart.reduce((sum, line) => {
    const product = products.find((entry) => entry.id === line.productId);
    const basePrice = Number(product?.salePrice) > 0 ? Number(product.salePrice) : Number(product?.price || 0);
    return sum + (product?.polarized ? basePrice * Number(line.quantity || 1) : 0);
  }, 0);
}

export function trackingReference(search = '') {
  const id = (new URLSearchParams(search).get('order') || '').trim().toUpperCase();
  return /^OM-[A-Z0-9-]{1,96}$/.test(id) ? id : '';
}

export const trackingError = (code) => ({
  order_not_found: 'Nuk u gjet një porosi me këto të dhëna. Kontrolloni kodin dhe kontaktin e përdorur në porosi.',
  order_and_contact_required: 'Plotësoni kodin e porosisë dhe emailin ose telefonin.',
  rate_limit_exceeded: 'Keni bërë disa kontrolle radhazi. Provoni përsëri më vonë.'
}[code] || 'Nuk u lidhëm me shërbimin e porosive. Të dhënat tuaja janë ruajtur në formular; provoni përsëri.');

export function trackingStage(order) {
  if (['Cancelled', 'Returned', 'Return requested'].includes(order.status)) return -1;
  if (order.status === 'Completed' || order.fulfillmentStatus === 'Delivered') return 4;
  if (order.status === 'Ready' || ['Ready for pickup', 'Shipped'].includes(order.fulfillmentStatus)) return 3;
  if (order.status === 'In lab' || order.fulfillmentStatus === 'Processing') return 2;
  if (order.status === 'Confirmed') return 1;
  return 0;
}

export function displayOrderDate(value, locale = 'sq') {
  if (!value) return 'Ende pa përditësim';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data nuk është e disponueshme';
  if (locale === 'en') return new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(date);
  const months = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gush', 'sht', 'tet', 'nën', 'dhj'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
