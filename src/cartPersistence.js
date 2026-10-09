// Keep the shopping choices, never persistent copies of medical values/files.
const shoppingKeys = new Set(['purchaseMode', 'lensPackage', 'coating', 'rxMode', 'frameVariant', 'lensTint', 'sunTreatment', 'lifestyle', 'quantity', 'total', 'prescriptionNeedsReentry']);
export function persistableCart(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(line => line && typeof line.productId === 'string' && typeof line.lineId === 'string')
    .filter(line => Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0 && Number.isFinite(Number(line.price)) && Number(line.price) >= 0)
    .map(line => {
      const config = line.configuration && typeof line.configuration === 'object' ? line.configuration : {};
      const hasPrivateData = Boolean(config.prescriptionToken || config.manualPrescription ||
        (config.manualRx && Object.values(config.manualRx).some(value => String(value ?? '').trim())));
      const configuration = Object.fromEntries(Object.entries(config).filter(([key]) => shoppingKeys.has(key)));
      if (hasPrivateData || config.prescriptionNeedsReentry) configuration.prescriptionNeedsReentry = true;
      return {
        lineId: line.lineId, productId: line.productId, name: line.name, image: line.image,
        price: Number(line.price), quantity: Math.min(10, Math.floor(Number(line.quantity))),
        availableStock: line.availableStock,
        // The previous signature included the entire prescription JSON.
        signature: `restored:${line.lineId}`, configuration,
      };
    });
}

export function selectedCatalogProduct(products, id) {
  return Array.isArray(products) ? products.find(product => product.id === id) || null : null;
}

// A late response from an earlier upload must never label a newer selected file.
export function createLatestUpload() {
  let sequence = 0;
  let controller = null;
  return {
    begin() {
      controller?.abort();
      controller = new AbortController();
      const ticket = ++sequence;
      return { signal: controller.signal, current: () => ticket === sequence && !controller.signal.aborted };
    },
    cancel() { ++sequence; controller?.abort(); controller = null; },
  };
}
