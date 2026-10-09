// Presentation uses catalogue identity, never image identity or invented colour combinations.
export const modelId = (product) => product.baseId || product.id;

export const frameSwatches = {
  "Black gold": "#080808", "Chrome black": "#2f3438", Graphite: "#50575b",
  "Chrome clear": "#d9dee0", "Titanium smoke": "#8e9798", "Black titanium": "#111111",
  Tortoise: "#6b3f24", "Rose gold": "#c89177", Champagne: "#d7b477", Amber: "#a45b22",
  "Mirror silver": "#bec8cf", Smoke: "#202629", Green: "#284637", Clear: "#edf2f2",
  "Blue-reflect": "#75a7cc", "Gradient smoke": "#4e5558", "Pearl chrome": "#c9c9c2",
  "Black chrome": "#282a29", "Matte graphite": "#545751", "Amber tortoise": "#915621",
  "Brushed silver": "#a7aba6", "Matte black": "#171917", "Translucent caramel": "#bb8b51",
  "Carbon black": "#181a1a", Silver: "#c5c8c7", "Black pearl": "#353a3b", Gunmetal: "#596260",
  "Navy graphite": "#2c3843", Caramel: "#9c632d", "Dark tortoise": "#4e3020", Gold: "#c3a058",
  Burgundy: "#70343b", "Dark havana": "#604229", "Forest black": "#294235", "Translucent ruby": "#914247",
  "Crystal smoke": "#adb1ac", "Olive titanium": "#6e7458", "Champagne pearl": "#cfb995", Obsidian: "#222626"
};

export function prescriptionSummary(cart) {
  const modes = cart.map((item) => item.configuration?.rxMode);
  if (modes.some((mode) => ["Upload prescription", "Ngarko recetën"].includes(mode))) return "Uploaded";
  if (modes.some((mode) => ["Enter manually", "Shkruaje manualisht"].includes(mode))) return "Manual entry";
  if (modes.some((mode) => ["Send later", "Dërgo më vonë", "Dërgoje më vonë"].includes(mode))) return "Send later";
  return cart.some((item) => item.configuration?.purchaseMode === "prescription") ? "Awaiting optical review" : "None";
}

export function upsertCartLine(items, incoming, editLineId = null) {
  if (editLineId && !items.some((item) => item.lineId === editLineId)) return { error: "missing_line" };
  const remaining = items.filter((item) => item.lineId !== editLineId);
  const existing = remaining.find((item) => item.signature === incoming.signature);
  if (!existing && remaining.length >= 25) return { error: "cart_line_limit" };
  const quantity = (existing?.quantity || 0) + incoming.quantity;
  const productQuantity = remaining.filter((item) => item.productId === incoming.productId).reduce((sum, item) => sum + item.quantity, 0) + incoming.quantity;
  if (quantity > 10 || productQuantity > incoming.availableStock) return { error: "insufficient_stock" };
  const line = { ...incoming, lineId: existing?.lineId || editLineId || incoming.lineId, quantity };
  if (existing) return { items: remaining.map((item) => item.lineId === existing.lineId ? line : item) };
  if (editLineId) return { items: items.map((item) => item.lineId === editLineId ? line : item) };
  return { items: [...items, line] };
}

export const catalogDefaults = { search: "", type: "All", audience: "All", collection: "All", frameShape: "All", color: "All", lensColor: "All", material: "All", size: "All", width: "All", lens: "All", uv: "All", price: "All", rx: false, polarized: false, blueLight: false, inStock: false };
const catalogSorts = ["featured", "newest", "price-low", "price-high"];
export const readCatalogQuery = (search) => {
  const query = new URLSearchParams(search);
  const filters = { ...catalogDefaults };
  for (const [key, fallback] of Object.entries(filters)) {
    const value = query.get(`f_${key}`);
    if (value !== null) filters[key] = typeof fallback === "boolean" ? value === "1" : value.slice(0, 160) || fallback;
  }
  return { filters, sort: catalogSorts.includes(query.get("sort")) ? query.get("sort") : "featured" };
};
export const writeCatalogQuery = (search, filters, sort) => {
  const query = new URLSearchParams(search);
  for (const [key, fallback] of Object.entries(catalogDefaults)) {
    query.delete(`f_${key}`);
    if (filters[key] !== fallback) query.set(`f_${key}`, typeof fallback === "boolean" ? "1" : filters[key]);
  }
  query.delete("sort");
  if (catalogSorts.includes(sort) && sort !== "featured") query.set("sort", sort);
  return query.toString();
};
export const matchesFrameWidth = (product, width) => {
  const mm = Number(product.frameWidth);
  if (width === "All") return true;
  if (!Number.isFinite(mm) || mm <= 0) return false;
  return width === "narrow" ? mm <= 134 : width === "medium" ? mm >= 135 && mm <= 141 : width === "wide" ? mm >= 142 : false;
};
export const modelVariants = (products, product) => products.filter((item) => modelId(item) === modelId(product));
export function uniqueModels(products) {
  const seen = new Set();
  return products.filter((product) => {
    const id = modelId(product);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export const heroDestinations = [
  ["shop", "Të gjitha kornizat"], ["prescription", "Syze me dioptri"],
  ["sunglasses", "Syze dielli"], ["contact", "Rezervimi"],
  ["examination", "Ekzaminimi"], ["guides", "Lens Focus"], ["brand", "Laboratori"]
];

export function heroDestination(content, slot) {
  const action = content[`${slot}Action`];
  if (heroDestinations.some(([id]) => id === action)) return action;
  // Preserve the meaning of legacy CMS labels without rewriting saved client copy.
  const label = String(content[`${slot}Cta`] || "").toLocaleLowerCase("sq");
  if (/rezervo|takim|konsult/.test(label)) return "contact";
  if (/ekzamin/.test(label)) return "examination";
  if (/korniz|koleksion|bli |syze/.test(label)) return "shop";
  return slot === "primary" ? "shop" : "contact";
}

export function productDescription(product, label) {
  const generatedSuffix = `Ky variant vjen në kombinimin ${product.color} me thjerrëza ${product.lensColor}.`;
  return String(product.description || '').replace(generatedSuffix, `Ky variant vjen në ngjyrën ${label(product.color).toLowerCase()}, me lente ${label(product.lensColor).toLowerCase()}.`);
}
