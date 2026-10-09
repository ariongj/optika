// Account records belong to an authenticated identity, not to the mounted page.
// A session change must never expose the previous customer's cached records.
export const emptyAccountData = (accountId = '') => ({ accountId, orders: [], appointments: [], loaded: false });

export const accountIdentity = (session) => session?.authenticated ? String(session.profile?.id || '') : '';

export function accountDataForSession(data, session) {
  const id = accountIdentity(session);
  return id && data?.accountId === id ? data : emptyAccountData(id);
}

export function mergeAccountData(previous, result) {
  const id = accountIdentity(result);
  if (!id) return emptyAccountData();
  const current = previous?.accountId === id ? previous : emptyAccountData(id);
  return {
    accountId: id,
    orders: Array.isArray(result.orders) ? result.orders : current.orders,
    appointments: Array.isArray(result.appointments) ? result.appointments : current.appointments,
    // Login confirms the session, not an empty order history. Only the complete
    // profile response (or its already-loaded successor) confirms these lists.
    loaded: current.loaded || (Array.isArray(result.orders) && Array.isArray(result.appointments))
  };
}

export function accountPaymentUrl(order) {
  if (['Paid', 'Refunded'].includes(order?.paymentStatus) || ['Cancelled', 'Returned', 'Return requested'].includes(order?.status)) return '';
  try {
    const url = new URL(order?.paymentLink || '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
