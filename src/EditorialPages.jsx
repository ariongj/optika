import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import EditorialImage from './EditorialImage.jsx';
import { ArrowRight, Check, ChevronDown, Eye, Heart, Layers3, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { uniqueModels, modelId, modelVariants, heroDestination, frameSwatches, catalogDefaults, readCatalogQuery, writeCatalogQuery, matchesFrameWidth } from "./commercePresentation.js";
import useDialogFocus from "./useDialogFocus.js";
import { searchProducts } from './catalogSearch.js';
import { holdingCopy } from './holdingContent.js';
import { reloadableProductPath } from './productRoutes.js';
import { products as bundledProducts } from './data/catalog.js';

const currency = (value) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)} €`;
const routes = { shop: "/shop", prescription: "/prescription-glasses", sunglasses: "/sunglasses", examination: "/ekzaminimi", guides: "/lens-focus", brand: "/laboratory", labKosovo: "/laboratory/kosovo", labEurope: "/laboratory/europe", partners: "/laboratory/partners", optical: "/optical", clinic: "/clinic", about: "/about", fit: "/virtual-try-on", contact: "/contact#booking" };
const go = (navigate, page) => navigate(page, undefined, routes[page]);

function EditorialPageLink({ navigate, page, children, className = 'ed-link' }) {
  return <a href={routes[page]} className={className} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); go(navigate, page);
  }}>{children}<ArrowRight size={17} aria-hidden="true" /></a>;
}

function EditorialFaq({ items, title = 'Mirë ta dini.' }) {
  return <section className="ed-faq"><h2>{title}</h2><div>{items.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={17} /></summary><p>{answer}</p></details>)}</div></section>;
}

export function EditorialHome({ products, homepageContent = {}, navigate, openQuickView, toggleWishlist, wishlist, label = value => value }) {
  const [selection, setSelection] = useState('all');
  const models = uniqueModels(products);
  const configuredFeatured = String(homepageContent.featuredProducts || "").replaceAll(" ", "");
  const featuredIds = (!configuredFeatured || configuredFeatured === "vtx-x1,prm-m2,ecl-e05" ? "prm-m2,nov-n04,sol-s7,vtx-x1" : configuredFeatured).split(",");
  const featured = uniqueModels([...featuredIds.map((id) => models.find((p) => p.id === id)).filter(Boolean), ...models]).filter(product => selection === 'all' || product.type === selection).slice(0, 8);
  const campaignTitle = !homepageContent.title || homepageContent.title === "Syzet tuaja. Nga duart tona." ? "Shihni mirë. Jini vetvetja." : homepageContent.title;
  const campaignSubtitle = !homepageContent.subtitle || homepageContent.subtitle === "Zgjidhni online. Ne kujdesemi për recetën, punimin në laboratorin tonë dhe dorëzimin — pa ndërmjetësues." ? "Korniza që ju shkojnë. Lente të punuara për ju, në laboratorin tonë." : homepageContent.subtitle;
  return <div className="ed-home ed-campaign-home optical-retail">
    <section className="campaign-hero">
      <figure className="campaign-photo"><EditorialImage name="heroImage" value={homepageContent.heroImage} priority sizes="100vw" alt="Portret ilustrues i fushatës: grua me syze optike dhe lente të tejdukshme" /></figure>
      <div className="campaign-copy">
        <span className="ed-kicker">Optical · Pjesë e Miftari Holding Group</span>
        <h1>{campaignTitle}</h1>
        <p>{campaignSubtitle}</p>
        <div className="ed-actions"><button className="primary-button" onClick={() => go(navigate, heroDestination(homepageContent, "primary"))}>{homepageContent.primaryCta || "Shiko kornizat"} <ArrowRight size={17} /></button><button className="ed-link" onClick={() => go(navigate, heroDestination(homepageContent, "secondary"))}>{homepageContent.secondaryCta || "Rezervo ekzaminimin"} <ArrowRight size={16} /></button></div>
      </div>
    </section>
    <nav className="campaign-shortcuts" aria-label="Gjeni atë që kërkoni"><button onClick={() => go(navigate, "prescription")}>Syze me dioptri <ArrowRight size={18} /></button><button onClick={() => go(navigate, "sunglasses")}>Syze dielli <ArrowRight size={18} /></button><button onClick={() => go(navigate, "guides")}>Gjeni lentet tuaja <ArrowRight size={18} /></button></nav>
    <section className="ed-featured" aria-labelledby="optical-selection-title">
      <div className="ed-section-head"><div><span className="ed-kicker">Kornizat, nga afër</span><h2 id="optical-selection-title">Për stilin tuaj. Jo për rregullat.</h2></div><EditorialPageLink navigate={navigate} page="shop">Të gjitha modelet</EditorialPageLink></div>
      <div className="optical-selection-tools"><div role="group" aria-label="Përzgjedhja në Optical">{[['all', 'Përzgjedhja jonë'], ['Sunglasses', 'Syze dielli'], ['Prescription Glasses', 'Me dioptri']].map(([value, text]) => <button key={value} type="button" aria-pressed={selection === value} onClick={() => setSelection(value)}>{text}</button>)}</div><span>Hapni modelin, zgjidhni variantin, vazhdoni këtu.</span></div>
      <div className="ed-product-grid" aria-live="polite">{featured.map((product) => <EditorialProductCard key={`${selection}-${product.id}`} product={product} variants={modelVariants(products, product)} label={label} openQuickView={openQuickView} navigate={navigate} toggleWishlist={toggleWishlist} wishlist={wishlist} />)}{featured.length === 0 && <p className="optical-selection-empty">Nuk ka modele në këtë përzgjedhje për momentin. <button className="ed-link" onClick={() => setSelection('all')}>Shikoni të gjitha</button></p>}</div>
      <div className="optical-selection-footer"><p>{models.length} modele në katalog · Variantet dhe çmimi shfaqen për çdo kornizë.</p><EditorialPageLink navigate={navigate} page="fit">Provojini virtualisht</EditorialPageLink></div>
    </section>
    <section className="ed-collection-story">
      <figure><EditorialImage name="opticalLifestyleImage" value={homepageContent.opticalLifestyleImage} alt="Dy miq me syze dielli në qytet — fotografi ilustruese e fushatës Optical" sizes="(max-width: 600px) 100vw, 50vw" />{!homepageContent.opticalLifestyleImage && <figcaption>Fushatë ilustruese · Optical</figcaption>}</figure>
      <div><span className="ed-kicker">Përditshmëria, në stilin tuaj</span><h2>Një detaj.<br />Krejt tjetër ndjesi.</h2><p>Forma e butë, vija të theksuara ose një kornizë që mezi ndihet në pamje. Niseni me atë që ju pëlqen; pastaj shohim bashkë masën dhe lentet.</p><div className="ed-actions"><EditorialPageLink navigate={navigate} page="sunglasses" className="primary-button">Gjeni syzet e diellit</EditorialPageLink><EditorialPageLink navigate={navigate} page="prescription">Korniza me dioptri</EditorialPageLink></div></div>
    </section>
    <section className="campaign-lab">
      <figure><img src="/assets/brand/optika-miftari-lens-verification.webp" width="1536" height="1024" loading="lazy" alt="Ilustrim i kontrollit të lentes në laborator optik" /></figure>
      <div><span className="ed-kicker">Optical + Optical Lab</span><h2>Stili është i juaji.<br />Punimi është i yni.</h2><p>Optical ju ndihmon të zgjidhni kornizën. Optical Lab, laboratori privat i grupit, kujdeset për lentet me recetë, montimin dhe kontrollin. Një proces i koordinuar, pa ndërmjetësues.</p><EditorialPageLink navigate={navigate} page="brand" className="primary-button">Njihuni me laboratorin</EditorialPageLink></div>
    </section>
    <section className="campaign-care">
      <div><span className="ed-kicker">Kujdesi fillon me ju.</span><h2>Le të flasim për shikimin tuaj.</h2><p>Vizitoni optikën për ekzaminim, këshillim dhe përshtatjen e syzeve.</p></div><div><button className="primary-button" onClick={() => go(navigate, "contact")}>Rezervo një takim <ArrowRight size={17} /></button><button className="ed-link" onClick={() => go(navigate, "examination")}>Si bëhet ekzaminimi <ArrowRight size={16} /></button></div>
    </section>
    <p className="optical-image-note">Imazhet e fushatës dhe të modeleve janë ilustruese. Variantet, përshtatja dhe detajet e porosisë konfirmohen me optikën.</p>
  </div>;
}

export function EditorialProductCard({ product: initialProduct, variants = [initialProduct], label = (value) => value, navigate, openQuickView, wishlist, toggleWishlist, compare, toggleCompare }) {
  const [selectedId, setSelectedId] = useState(initialProduct.id);
  const product = variants.find((variant) => variant.id === selectedId) || initialProduct;
  const price = product.salePrice || product.price;
  const open = () => openQuickView ? openQuickView(product) : navigate("product", product.id);
  const href = reloadableProductPath(product, bundledProducts);
  const openLink = event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); open();
  };
  const viewProduct = event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate('product', product.id);
  };
  return <article className="ed-product-card">
    <div className="ed-product-visual"><a href={href} className="ed-product-image" data-testid={`product-open-${product.id}`} onClick={openLink}><img src={product.image} alt={`${product.name}, ${product.type === "Sunglasses" ? "syze dielli" : "kornizë optike"} — imazh ilustrues i modelit`} width="600" height="400" loading="lazy" /><span>Shiko shpejt</span></a><button className={`ed-save ${wishlist?.has(product.id) ? "is-saved" : ""}`} aria-label={`${wishlist?.has(product.id) ? "Hiq" : "Ruaj"} ${product.name}`} aria-pressed={Boolean(wishlist?.has(product.id))} onClick={() => toggleWishlist(product.id)}><Heart size={19} /></button>{Number(product.stock) <= 0 && <span className="ed-stock-label">Jashtë stokut</span>}</div>
    <div className="ed-product-summary"><a href={href} onClick={viewProduct}>{product.name}</a><strong>{product.salePrice > 0 && product.salePrice < product.price && <del>{currency(product.price)}</del>}{currency(price)}</strong></div>
    {variants.length > 1 && <div className="ed-card-variants"><span aria-live="polite">{label(product.color)}</span><div role="group" aria-label={`Variantet e ${initialProduct.name}`}>{variants.map((variant) => <button key={variant.id} title={`${label(variant.color)} · ${label(variant.lensColor)} · ${currency(variant.salePrice || variant.price)}`} aria-label={`${variant.name}: ${label(variant.color)}, ${label(variant.lensColor)}`} aria-pressed={variant.id === product.id} onClick={() => setSelectedId(variant.id)}><i style={{ background: frameSwatches[variant.color] || "#777777" }} /></button>)}</div></div>}
    <div className="ed-product-detail"><span>{product.type === "Sunglasses" ? "Syze dielli" : "Kornizë me dioptri"} · {product.frameWidth ? `${product.frameWidth} mm` : product.size}</span>{toggleCompare && <button aria-pressed={Boolean(compare?.has(product.id))} onClick={() => toggleCompare(product.id)}>{compare?.has(product.id) ? <Check size={13} /> : null}Krahaso</button>}</div>
  </article>;
}

const blankFilters = catalogDefaults;

export function EditorialCatalog({ kind = "shop", products, content = {}, navigate, openQuickView, wishlist, toggleWishlist, compare, toggleCompare, label = (value) => value }) {
  const requiredType = kind === "sunglasses" ? "Sunglasses" : kind === "prescription" ? "Prescription Glasses" : "All";
  const [browsing, setBrowsing] = useState(() => ({ kind, ...readCatalogQuery(window.location.search) }));
  const { filters, sort } = browsing;
  const setFilters = (next) => setBrowsing((current) => ({ ...current, filters: typeof next === "function" ? next(current.filters) : next }));
  const setSort = (next) => setBrowsing((current) => ({ ...current, sort: next }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const comparisonRef = useRef(null);
  useDialogFocus(comparisonOpen, comparisonRef, () => setComparisonOpen(false));
  const filterRef = useRef(null);
  const closeRef = useRef(null);
  useDialogFocus(filtersOpen, filterRef, () => setFiltersOpen(false));
  useEffect(() => {
    setBrowsing({ kind, ...readCatalogQuery(window.location.search) });
    setFiltersOpen(false);
    const restore = () => setBrowsing({ kind, ...readCatalogQuery(window.location.search) });
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [kind]);
  useEffect(() => {
    if (browsing.kind !== kind) return;
    const query = writeCatalogQuery(window.location.search, filters, sort);
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [filters, sort, kind, browsing.kind]);
  const available = products.filter((p) => requiredType === "All" || p.type === requiredType);
  const filtered = useMemo(() => {
    const result = searchProducts(products, filters.search, label).filter((p) => {
      if (requiredType !== "All" && p.type !== requiredType) return false;
      for (const [key, value] of Object.entries(filters)) {
        if (["search", "price", "rx", "polarized", "blueLight", "inStock", "width"].includes(key) || value === "All") continue;
        if (p[key === "lens" ? "lensType" : key] !== value) return false;
      }
      if (filters.rx && !p.prescriptionReady || filters.polarized && !p.polarized || filters.blueLight && !p.blueLight) return false;
      if (filters.inStock && Number(p.stock) <= 0 || !matchesFrameWidth(p, filters.width)) return false;
      const price = p.salePrice || p.price;
      return !(filters.price === "under400" && price >= 400 || filters.price === "over400" && price < 400);
    });
    result.sort((a, b) => sort === "price-low" ? (a.salePrice || a.price) - (b.salePrice || b.price) : sort === "price-high" ? (b.salePrice || b.price) - (a.salePrice || a.price) : sort === "newest" ? new Date(b.createdAt || 0) - new Date(a.createdAt || 0) : 0);
    return result;
  }, [products, filters, sort, requiredType, label]);
  const models = uniqueModels(filtered);
  const count = Object.entries(filters).filter(([key, value]) => key !== "search" && value !== "All" && value !== false).length;
  const selectedComparison = products.filter((p) => compare?.has(p.id));
  const titleKey = kind === "shop" ? "shopTitle" : kind === "sunglasses" ? "sunglassesTitle" : "prescriptionTitle";
  const subtitleKey = titleKey.replace("Title", "Subtitle");
  const defaultTitle = kind === "shop" ? "Të gjitha kornizat." : kind === "sunglasses" ? "Syze dielli." : "Syze me dioptri.";
  const defaults = kind === "sunglasses" ? "Për ditët me dritë. Zgjidhni formën, filtrin dhe, kur është e mundur, lentet me recetë." : kind === "prescription" ? "Gjeni formën tuaj. Lentet i përshtatim sipas recetës, matjeve dhe rutinës suaj." : "Korniza optike dhe syze dielli. Zgjidhni online; për lentet dhe punimin kujdeset laboratori ynë.";
  const fieldNames = { type: "Lloji", audience: "Për kë", collection: "Koleksioni", frameShape: "Forma", color: "Ngjyra e kornizës", lensColor: "Ngjyra e lentes", material: "Materiali", size: "Masa", lens: "Lentja", uv: "Mbrojtja UV" };
  const options = (key) => [...new Set(available.map((p) => p[key === "lens" ? "lensType" : key]).filter(Boolean))];
  const widthOptions = [["narrow", "Deri 134 mm"], ["medium", "135–141 mm"], ["wide", "142 mm e lart"]];
  const activeFilters = Object.entries(filters).filter(([key, value]) => value !== blankFilters[key]);
  const filterLabel = (key, value) => key === "search" ? `Kërkimi: ${value}` : key === "width" ? `Gjerësia: ${widthOptions.find(([id]) => id === value)?.[1] || value}` : key === "price" ? (value === "under400" ? "Nën 400 €" : "400 € e lart") : ({ rx: "Me recetë", polarized: "Të polarizuara", blueLight: "Dritë blu", inStock: "Në stok" }[key] || `${fieldNames[key]}: ${label(value)}`);
  return <div className={`ed-catalog ed-catalog-${kind}`}>
    <header className="ed-page-heading catalog-editorial-heading"><div><span className="ed-kicker">Optical / {kind === "shop" ? "Koleksioni" : kind === "sunglasses" ? "Syze dielli" : "Me recetë"}</span><h1>{content[titleKey] || defaultTitle}</h1><p>{content[subtitleKey] || defaults}</p></div><figure><EditorialImage name={kind === 'sunglasses' ? 'sunglassesImage' : kind === 'prescription' ? 'prescriptionImage' : 'homeCollectionImage'} value={content[kind === 'sunglasses' ? 'sunglassesImage' : kind === 'prescription' ? 'prescriptionImage' : 'homeCollectionImage']} priority sizes="(max-width: 600px) 32vw, 280px" alt={kind === 'sunglasses' ? 'Fushatë ilustruese e koleksionit të diellit' : kind === 'prescription' ? 'Fushatë ilustruese e kornizave optike' : 'Kompozim ilustrues i koleksioneve optike'} /></figure></header>
    <nav className="ed-category-tabs" aria-label="Koleksionet">{[["shop", "Të gjitha"], ["prescription", "Me dioptri"], ["sunglasses", "Syze dielli"]].map(([page, text]) => <a key={page} href={routes[page]} aria-current={kind === page ? "page" : undefined} onClick={event => { if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); go(navigate, page); }}>{text}</a>)}<EditorialPageLink className="ed-try-link" navigate={navigate} page="fit">Provo virtualisht</EditorialPageLink></nav>
    <div className="ed-catalog-tools">
      <button className="ed-filter-toggle" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen} aria-controls="catalog-filters"><SlidersHorizontal size={17} /> Filtrat{count > 0 && <b>{count}</b>}</button>
      <div className="ed-quick-filters">{[["frameShape", "Forma"], ["width", "Gjerësia"], ["color", "Ngjyra"]].map(([key, name]) => <label key={key}><span className="sr-only">{name}</span><select aria-label={name} value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}><option value="All">{name}</option>{(key === "width" ? widthOptions : options(key).map((value) => [value, label(value)])).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div>
      <label className="ed-catalog-search"><Search size={17} /><input aria-label="Kërko në koleksion" placeholder="Kërko modelin" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label>
      <label className="ed-sort"><span>Rendit sipas</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Përzgjedhja jonë</option><option value="newest">Më të rejat</option><option value="price-low">Çmimi: më i ulët</option><option value="price-high">Çmimi: më i lartë</option></select></label>
    </div>
    {activeFilters.length > 0 && <div className="ed-filter-chips" aria-label="Filtrat aktivë">{activeFilters.map(([key, value]) => <button key={key} onClick={() => setFilters({ ...filters, [key]: blankFilters[key] })} aria-label={`Hiq filtrin ${filterLabel(key, value)}`}>{filterLabel(key, value)}<X size={13} /></button>)}</div>}
    <div className="ed-results-meta"><span role="status">{`${models.length} modele${filtered.length !== models.length ? ` · ${filtered.length} variante` : ''}`}</span><label className="ed-stock-filter"><input type="checkbox" checked={filters.inStock} onChange={(event) => setFilters({ ...filters, inStock: event.target.checked })} />Vetëm në stok</label><span>Çmimi i lenteve me recetë llogaritet veçmas.</span>{(count > 0 || filters.search) && <button className="ed-link" onClick={() => setFilters(blankFilters)}>Pastro filtrat <X size={13} /></button>}</div>
    {models.length ? <div className="ed-product-grid">{models.map((product, index) => <Fragment key={modelId(product)}><EditorialProductCard variants={modelVariants(filtered, product)} {...{ product, label, navigate, openQuickView, wishlist, toggleWishlist, compare, toggleCompare }} /></Fragment>)}</div> : <div className="ed-empty"><Search size={28} /><h2>{available.length ? 'Nuk gjetëm një model.' : 'Ende pa modele të publikuara.'}</h2><p>{available.length ? 'Provoni një emër tjetër ose hiqni disa filtra.' : 'Kontaktoni optikën për modelet dhe disponueshmërinë.'}</p><button className="secondary-button" onClick={() => available.length ? setFilters(blankFilters) : go(navigate, 'contact')}>{available.length ? 'Shfaq të gjitha' : 'Kontakto optikën'}</button></div>}
    <p className="ed-catalog-image-note">Imazhet ilustrojnë modelet; ngjyra e variantit konfirmohet me optikën para porosisë.</p>
    <EditorialFaq title="Zgjedhja, pa paqartësi." items={[
      ['A përfshihen lentet në çmim?', 'Për syzet e diellit, shikoni konfigurimin e modelit. Për syzet optike, çmimi fillestar është për kornizën; lentet me recetë shtohen veçmas. Hapni “Shiko shpejt” për variantet ose “Konfiguro lentet” për porosinë me recetë.'],
      ['Nuk e kam recetën me vete. A mund të vazhdoj?', 'Po. Në konfigurim mund të zgjidhni ta dërgoni recetën më vonë. Lentet nuk përgatiten pa kontrollin e recetës dhe matjeve nga optiku.'],
      ['Si ta zgjedh masën?', 'Krahasoni gjerësinë, urën dhe gjatësinë e bishtit me një palë që ju rri mirë. Prova virtuale ndihmon për pamjen; përshtatja reale dhe matjet optike kontrollohen në optikë.'],
    ]} />
    {selectedComparison.length > 0 && <aside className="ed-compare-tray" aria-label="Modelet për krahasim"><div className="ed-compare-preview">{selectedComparison.slice(0,4).map((p) => <img key={p.id} src={p.image} alt={p.name} />)}</div><span>{selectedComparison.length} të zgjedhura</span><button className="primary-button" disabled={selectedComparison.length < 2} onClick={() => setComparisonOpen(true)}>Krahaso {selectedComparison.length > 1 ? `(${selectedComparison.length})` : "· zgjidh edhe një"}</button><button className="ed-compare-clear" onClick={() => selectedComparison.forEach((p) => toggleCompare(p.id))} aria-label="Pastro krahasimin"><X size={19} /></button></aside>}
    {comparisonOpen && <div className="ed-comparison-overlay"><button className="ed-filter-backdrop" onClick={() => setComparisonOpen(false)} aria-label="Mbyll krahasimin" /><section className="ed-comparison-dialog" ref={comparisonRef} role="dialog" aria-modal="true" aria-labelledby="comparison-title"><header><div><span className="ed-kicker">Pranë njëra-tjetrës</span><h2 id="comparison-title">Cila ju përshtatet?</h2></div><button onClick={() => setComparisonOpen(false)} aria-label="Mbyll"><X size={22} /></button></header><div className="ed-comparison-scroll"><table><thead><tr><th scope="col">Korniza</th>{selectedComparison.map((p) => <th scope="col" key={p.id}><img src={p.image} alt="" /><button onClick={() => { setComparisonOpen(false); openQuickView(p); }}>{p.name} <ArrowRight size={14} /></button></th>)}</tr></thead><tbody>{[["Çmimi", (p) => currency(p.salePrice || p.price)], ["Gjerësia", (p) => p.frameWidth ? `${p.frameWidth} mm` : "—"], ["Materiali", (p) => label(p.material)], ["Masa", (p) => p.size], ["Lentja", (p) => label(p.lensType)], ["Me recetë", (p) => p.prescriptionReady ? "Po" : "Jo"]].map(([title, value]) => <tr key={title}><th scope="row">{title}</th>{selectedComparison.map((p) => <td key={p.id}>{value(p)}</td>)}</tr>)}</tbody></table></div><footer>Masat ju ndihmojnë të krahasoni. Përshtatja përfundimtare kontrollohet në optikë.</footer></section></div>}
    <div className="ed-catalog-assurance"><div><h2>Ju zgjidhni. Ne kujdesemi për punimin.</h2><p>Receta, matjet dhe porosia kontrollohen nga ekipi ynë. Punimi kryhet në laboratorin tonë privat.</p></div><button className="ed-link" onClick={() => go(navigate, "brand")}>Si punojmë <ArrowRight size={16} /></button></div>
    {filtersOpen && <div className="ed-filter-overlay"><button className="ed-filter-backdrop" aria-label="Mbyll filtrat" onClick={() => setFiltersOpen(false)} /><section className="ed-filter-panel" id="catalog-filters" role="dialog" aria-modal="true" aria-labelledby="filter-title" ref={filterRef}><header><h2 id="filter-title">Gjeni kornizën tuaj</h2><button ref={closeRef} onClick={() => setFiltersOpen(false)} aria-label="Mbyll"><X size={22} /></button></header><div className="ed-filter-fields">{Object.entries(fieldNames).filter(([key]) => !(key === "type" && requiredType !== "All")).map(([key, name]) => <label key={key}>{name}<select value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}><option value="All">Të gjitha</option>{options(key).map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>)}<label>Çmimi<select value={filters.price} onChange={(e) => setFilters({ ...filters, price: e.target.value })}><option value="All">Të gjitha</option><option value="under400">Nën 400 €</option><option value="over400">400 € e lart</option></select></label><fieldset><legend>Preferencat</legend>{[["rx", "Të përshtatshme për recetë"], ["polarized", "Të polarizuara"], ["blueLight", "Për dritën blu"]].map(([key, name]) => <label key={key}><input type="checkbox" checked={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.checked })} />{name}</label>)}</fieldset></div><footer><button className="ed-link" onClick={() => setFilters(blankFilters)}>Pastro</button><button className="primary-button" onClick={() => setFiltersOpen(false)}>Shfaq {models.length} modele <ArrowRight size={16} /></button></footer></section></div>}
  </div>;
}

export function EditorialLaboratory({ navigate, assets, homepageContent = {} }) {
  const copy = holdingCopy(homepageContent);
  return <div className="ed-story ed-laboratory">
    <section className="ed-story-hero"><div><span className="ed-kicker">Miftari Holding Group · Optical Lab</span><h1>{copy.labTitle}</h1><p>{copy.labSubtitle}</p><div className="ed-actions"><EditorialPageLink navigate={navigate} page="guides" className="primary-button">Zbuloni lentet</EditorialPageLink><EditorialPageLink navigate={navigate} page="partners">Bëhuni partner B2B</EditorialPageLink></div></div><figure><EditorialImage name="laboratoryImage" value={homepageContent.laboratoryImage} priority alt="Ilustrim i punimit me dorë dhe rregullimit të kornizës optike" /><figcaption>Imazh ilustrues i procesit</figcaption></figure></section>
    <section className="lab-market-entry" aria-labelledby="lab-market-title"><header><span className="ed-kicker">Për optika dhe profesionistë</span><h2 id="lab-market-title">Zgjidhni tregun tuaj.</h2><p>Një laborator. Bashkëpunim sipas nevojave të biznesit tuaj.</p></header><div className="lab-market-grid"><article><span className="ed-kicker">Kosovë · SQ</span><h3>Pranë partnerëve tanë.</h3><p>Porositë me recetë, montimi dhe komunikimi me laboratorin për optikat në Kosovë.</p><EditorialPageLink navigate={navigate} page="labKosovo">Optical Lab Kosovë</EditorialPageLink></article><article lang="en"><span className="ed-kicker">European market · EN</span><h3>A direct laboratory partnership.</h3><p>Discuss prescription-lens orders, technical documentation and market-specific requirements.</p><EditorialPageLink navigate={navigate} page="labEurope">Optical Lab Europe</EditorialPageLink></article></div></section>
    <section className="ed-story-section"><div className="ed-section-head"><h2>Laborator privat. Kujdes i drejtpërdrejtë.</h2></div><div className="ed-value-grid">{[["Një kontakt", "Nga pyetja e parë deri te dorëzimi, flisni drejtpërdrejt me optikën."], ["Punim i koordinuar", "Korniza, receta dhe matjet trajtohen së bashku, jo si porosi të ndara."], ["Kontroll para dorëzimit", "Ekipi verifikon montimin dhe përgatit palën për përshtatjen përfundimtare."]].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="ed-process-section"><div><span className="ed-kicker">Si përgatitet porosia</span><h2>Nga zgjedhja, te dorëzimi.</h2><p>Për lentet me recetë, punimi fillon pas konfirmimit të detajeve optike.</p></div><ol>{[["Zgjedhja", "Zgjidhni kornizën dhe kërkoni lentet që ju nevojiten."], ["Konfirmimi", "Optiku kontrollon recetën, matjet, stokun dhe çmimin përfundimtar me ju."], ["Laboratori", "Përgatisim, centrojmë dhe montojmë lentet në kornizën tuaj."], ["Dorëzimi", "Kontrollojmë palën dhe ju udhëzojmë për përshtatjen e kujdesin."]].map(([title, copy], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol></section>
    <EditorialFaq items={[
      ['Kur fillon punimi?', 'Pasi të kemi konfirmuar bashkë recetën, matjet, kornizën, disponueshmërinë dhe çmimin. Kërkesa online nuk nis automatikisht prodhimin e lenteve.'],
      ['Sa kohë merr porosia?', 'Afati varet nga receta, lloji i lentes dhe disponueshmëria. Ekipi ju jep një afat pasi kontrollon konfigurimin tuaj; nuk premtojmë të njëjtin afat për çdo palë.'],
      ['Çfarë ndodh nëse korniza ka nevojë për rregullim?', 'Na kontaktoni ose vizitoni optikën. Kontrollojmë uljen e kornizës, urën dhe bishtat, pastaj ju shpjegojmë rregullimin e përshtatshëm.'],
    ]} />
  </div>;
}

export function EditorialAbout({ navigate, content = {} }) {
  return <div className="ed-story ed-about">
    <section className="ed-story-hero"><div><span className="ed-kicker">Miftari Holding Group · 30 vjet</span><h1>{content.aboutTitle || "30 vjet. Një emër familjar."}</h1><p>{content.aboutSubtitle || "Miftari Holding Group zotëron Optical, Optical Lab dhe Klinikën Miftari. Tri specializime me role të veçanta, të bashkuara nga 30 vjet përvojë familjare."}</p><button className="primary-button" onClick={() => go(navigate, "contact")}>Ejani të njihemi <ArrowRight size={17} /></button></div><figure><EditorialImage name="aboutImage" value={content.aboutImage} priority alt="Imazh ilustrues i kujdesit optik ndër breza" /><figcaption>Imazh ilustrues · jo portret i ekipit</figcaption></figure></section>
    <section className="ed-story-section"><span className="ed-kicker">Struktura e grupit</span><h2>Secili ka fokusin e vet. Ju jeni në qendër.</h2><div className="ed-value-grid"><article><h3>Optical</h3><p>Departamenti i shitjes: korniza optike, syze dielli, stil dhe përzgjedhje personale — online dhe në optikë.</p><EditorialPageLink navigate={navigate} page="optical">Zbuloni Optical</EditorialPageLink></article><article><h3>Optical Lab</h3><p>Departamenti i punimit: lente me recetë, montim dhe kontroll. Bashkëpunim B2B me optika në Kosovë dhe tregun evropian.</p><EditorialPageLink navigate={navigate} page="brand">Zbuloni laboratorin</EditorialPageLink></article><article><h3>Klinika Miftari</h3><p>Departamenti klinik në Kosovë: konsultim me specialistin e syve, kontrolle dhe vlerësim për trajtim.</p><EditorialPageLink navigate={navigate} page="clinic">Zbuloni klinikën</EditorialPageLink></article></div></section>
    <section className="ed-story-section ed-about-values"><span className="ed-kicker">Marrëdhënia vazhdon edhe pas blerjes</span><h2>Pala juaj është personale. Edhe kujdesi ynë.</h2><p>Si punoni, si lexoni, sa kohë kaloni para ekranit. Këto detaje na ndihmojnë ta lidhim recetën me jetën tuaj, pastaj me kornizën dhe lentet e duhura.</p><div className="ed-value-grid">{[["Përvojë familjare", "Kujdes personal dhe marrëdhënie që vazhdojnë me kohë."], ["Laboratori ynë", "Punimi dhe kontrolli i porosisë drejtpërdrejt nga ekipi ynë."], ["Pranë edhe më pas", "Na kontaktoni për rregullimin, përshtatjen dhe mirëmbajtjen e syzeve."]].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div><button className="ed-link" onClick={() => go(navigate, "brand")}>Shihni si punojmë <ArrowRight size={16} /></button></section>
    <section className="ed-story-banner"><div><span className="ed-kicker">Na vizitoni</span><h2>Një vizitë. Ekipi i duhur.</h2><p>Optika · Mitrovicë · Mbretëresha Teutë 182<br />Për laboratorin ose klinikën, konfirmoni vendin dhe orarin e takimit me ekipin.</p></div><button className="secondary-button" onClick={() => go(navigate, "contact")}>Kontakt dhe rezervime <ArrowRight size={16} /></button></section>
  </div>;
}

export function EditorialExamination({ navigate, content = {} }) {
  return <div className="ed-story ed-examination">
    <section className="ed-story-hero"><div><span className="ed-kicker">Ekzaminimi i shikimit</span><h1>{content.examinationTitle || "Së pari, si shihni ju?"}</h1><p>{content.examinationSubtitle || "Flasim për shikimin tuaj, bëjmë matjet dhe ju këshillojmë për recetën e lentet. Një fillim i qartë për palën tuaj të ardhshme."}</p><button className="primary-button" onClick={() => go(navigate, "contact")}>Kërko një takim <ArrowRight size={17} /></button><small>Orari konfirmohet nga ekipi pas kërkesës suaj.</small></div><figure><EditorialImage name="examinationImage" value={content.examinationImage} priority alt="Skenë ilustruese e ekzaminimit me pajisje optike" /><figcaption>Skenë ilustruese e ekzaminimit</figcaption></figure></section>
    <section className="ed-process-section"><div><span className="ed-kicker">Çfarë të prisni</span><h2>Çfarë ndodh në takim?</h2></div><ol>{[["Bisedojmë", "Shqetësimet, receta e mëparshme dhe mënyra si e përdorni shikimin çdo ditë."], ["Kontrollojmë shikimin", "Matjet dhe vlerësimi udhëheqin rekomandimin optik."], ["Zgjedhim zgjidhjen", "Diskutojmë lentet, kornizën dhe matjet e nevojshme para punimit."]].map(([title, copy], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol></section>
    <section className="exam-preparation" aria-labelledby="exam-preparation-title">
      <div><span className="ed-kicker">Gati për vizitën</span><h2 id="exam-preparation-title">Merrni me vete palën aktuale.</h2><p>Për kërkesa të veçanta, flisni me ekipin paraprakisht.</p><button className="primary-button" onClick={() => go(navigate, "contact")}>Kontaktoni optikën <ArrowRight size={16} /></button></div>
      <ul>{["Syzet që përdorni tani.", "Recetën e fundit, nëse e keni.", "Shënoni kur shikimi ju pengon."].map(text => <li key={text}><Check size={22} aria-hidden="true" /><span>{text}</span></li>)}</ul>
    </section>
    <EditorialFaq items={[
      ['A është konfirmuar takimi sapo e dërgoj kërkesën?', 'Jo ende. Ju zgjidhni shërbimin, ditën dhe orën e preferuar. Ekipi kontrollon disponueshmërinë dhe ju kontakton për konfirmim.'],
      ['A mund të vij vetëm për këshillim?', 'Po. Zgjidhni këshillimin për recetën ose përshtatjen e kornizës në formular. Mund të na telefononi nëse nuk jeni të sigurt për shërbimin.'],
      ['A e zëvendëson prova virtuale ekzaminimin?', 'Jo. Fotografia dhe kamera ndihmojnë vetëm për pamjen dhe një vlerësim orientues të përmasave. Receta dhe matjet e montimit verifikohen nga profesionisti.'],
    ]} />
  </div>;
}
