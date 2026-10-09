// A failed network request does not prove the server session has ended.
export async function confirmStaffLogout(request) {
  try {
    const result = await request();
    if (result?.ok !== true) throw new Error('Serveri nuk e konfirmoi daljen.');
    return { confirmed: true, error: '' };
  } catch (failure) {
    if (failure?.code === 'authentication_required') return { confirmed: true, error: '' };
    return { confirmed: false, error: `Dalja nuk u konfirmua. Provoni përsëri para se ta lini këtë pajisje. ${failure?.message || ''}`.trim() };
  }
}
