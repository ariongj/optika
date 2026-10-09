// Keep only ordinary delivery details for this tab. Never store passwords,
// prescription values, uploads or customer notes in the checkout draft.
export const emptyCheckoutCustomer = () => ({ firstName: "", lastName: "", email: "", phone: "", address: "", apartment: "", city: "", postcode: "", country: "Kosovë", shipping: "insured", contactPreference: "WhatsApp", note: "" });
export const checkoutDraftKey = (owner = "guest") => `optika-checkout-draft:${owner}`;
export function readCheckoutDraft(storage, owner, profile = {}) {
  const empty = emptyCheckoutCustomer();
  // New checkouts use the signed-in customer's preferences. A saved tab draft
  // still wins, so reopening cannot overwrite an address the shopper edited.
  for (const key of ['firstName','lastName','email','phone','address','city','postcode','country','contactPreference']) {
    if (typeof profile?.[key] === 'string' && profile[key].trim()) empty[key] = profile[key].slice(0,250);
  }
  if (!["Kosovë", "Shqipëri", "Maqedoni e Veriut", "Mal i Zi"].includes(empty.country)) empty.country = 'Kosovë';
  if (!["WhatsApp", "Telefon", "Email"].includes(empty.contactPreference)) empty.contactPreference = 'WhatsApp';
  try {
    const saved = JSON.parse(storage.getItem(checkoutDraftKey(owner)) || "null");
    if (!saved || !Number.isFinite(saved.savedAt) || saved.savedAt > Date.now() || Date.now() - saved.savedAt > 86400000) return empty;
    for (const key of Object.keys(empty)) {
      if (key !== "note" && typeof saved.customer?.[key] === "string") empty[key] = saved.customer[key].slice(0, 250);
    }
    if (!["insured", "express", "pickup"].includes(empty.shipping)) empty.shipping = "insured";
    if (!["WhatsApp", "Telefon", "Email"].includes(empty.contactPreference)) empty.contactPreference = "WhatsApp";
    if (!["Kosovë", "Shqipëri", "Maqedoni e Veriut", "Mal i Zi"].includes(empty.country)) empty.country = "Kosovë";
    return empty;
  } catch { return empty; }
}
export function saveCheckoutDraft(storage, owner, customer) {
  const safe = {};
  for (const key of Object.keys(emptyCheckoutCustomer())) if (key !== "note") safe[key] = String(customer[key] || "").slice(0, 250);
  try { storage.setItem(checkoutDraftKey(owner), JSON.stringify({ customer: safe, savedAt: Date.now() })); } catch { /* Storage can be unavailable in private browsing. */ }
}
export function clearCheckoutDraft(storage, owner) {
  try { storage.removeItem(checkoutDraftKey(owner)); } catch { /* In-memory checkout remains usable. */ }
}

// Persist only a digest + random reference, not the order's personal/medical data.
// Reusing the reference lets the server return an already accepted request after
// a lost response without reserving inventory a second time.
export function createCheckoutRequestIdentity(storage, owner, cryptoProvider = globalThis.crypto) {
  let previous = null;
  const key = `optika-checkout-request:${owner}`;
  return {
    async get(payload) {
      const signature = JSON.stringify(payload);
      let fingerprint = signature;
      const canPersist = Boolean(cryptoProvider?.subtle);
      if (canPersist) {
        const digest = await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(signature));
        fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
        if (!previous) { try { previous = JSON.parse(storage.getItem(key) || "null"); } catch { /* Continue without storage. */ } }
      }
      if (previous?.fingerprint === fingerprint && /^OM-[A-Z0-9-]+$/.test(previous.id) && Number.isFinite(previous.createdAt) && previous.createdAt <= Date.now() && Date.now() - previous.createdAt < 86400000) return previous.id;
      const id = `OM-${cryptoProvider.randomUUID().toUpperCase()}`;
      previous = { fingerprint, id, createdAt: Date.now() };
      if (canPersist) { try { storage.setItem(key, JSON.stringify(previous)); } catch { /* In-memory retries still work. */ } }
      return id;
    },
    clear() { previous = null; try { storage.removeItem(key); } catch { /* Nothing to clear. */ } }
  };
}
