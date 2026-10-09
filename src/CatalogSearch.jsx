import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { searchProducts } from './catalogSearch.js';
import { uniqueModels } from './commercePresentation.js';
import useDialogFocus from './useDialogFocus.js';
import { translate } from './i18n/locale.js';

export default function CatalogSearch({ open, setOpen, products, navigate, openQuickView, label, money }) {
  const [query, setQuery] = useState('');
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  useDialogFocus(open, panelRef, () => setOpen(false));
  const matches = useMemo(() => searchProducts(products, query, label), [products, query, label]);
  const models = uniqueModels(matches);
  const results = models.slice(0, 6);
  const browse = (page = 'shop', path = `/shop?f_search=${encodeURIComponent(query.trim())}`) => { setOpen(false); navigate(page, undefined, path); };
  if (!open) return null;
  return <aside className="search-overlay discovery-search" role="dialog" aria-modal="true" aria-labelledby="catalog-search-title">
    <div className="search-backdrop" onClick={() => setOpen(false)} />
    <div className="search-panel" ref={panelRef}>
      <header className="discovery-head"><div><span className="ed-kicker">Gjeni palën tuaj</span><h2 id="catalog-search-title">Çfarë po kërkoni?</h2></div><button className="icon-button" aria-label="Mbyll kërkimin" onClick={() => setOpen(false)}><X size={21} /></button></header>
      <form className="discovery-form" onSubmit={(event) => { event.preventDefault(); browse(); }}><label className="search-field"><Search size={20} /><input ref={inputRef} data-autofocus type="search" aria-label="Kërko modele, ngjyra ose materiale" placeholder="Emër, ngjyrë, material…" value={query} maxLength={160} onChange={(event) => setQuery(event.target.value)} /></label><button aria-label="Shfaq rezultatet në katalog" className="discovery-submit"><ArrowRight size={20} /></button></form>
      <div className="discovery-suggestions" aria-label="Sugjerime kërkimi">{['Të polarizuara', 'Titan', 'Dritë blu'].map((term) => <button key={term} onClick={() => { setQuery(translate(term)); inputRef.current?.focus(); }}>{term}</button>)}</div>
      <div className="discovery-count" role="status">{query.trim() ? `${models.length} modele · ${matches.length} variante` : 'Për të filluar'}{query && <button onClick={() => { setQuery(''); inputRef.current?.focus(); }}>Pastro</button>}</div>
      <div className="search-results">{results.map((product) => <button key={product.id} className="discovery-result" onClick={() => { setOpen(false); openQuickView(product); }}><img src={product.image} alt="" width="110" height="82" /><span><strong>{product.name}</strong><small>{label(product.color)} · {label(product.type)}</small><small>{product.frameWidth ? `${product.frameWidth} mm · ` : ''}{Number(product.stock) > 0 ? 'Në stok' : 'Jashtë stokut'}</small></span><b>{money(product.salePrice || product.price)}<ArrowRight size={16} /></b></button>)}</div>
      {!results.length && <div className="discovery-empty"><Search size={27} /><h3>Nuk gjetëm një përputhje.</h3><p>Provoni emrin e modelit, një ngjyrë ose një fjalë si “titan”. Mund të shfletoni edhe sipas kategorisë.</p></div>}
      {results.length > 0 && query.trim() && <button className="primary-button discovery-all" onClick={() => browse()}>Shiko të gjitha rezultatet <ArrowRight size={17} /></button>}
      <nav className="discovery-categories" aria-label="Shfleto kategoritë"><button onClick={() => browse('prescription', '/prescription-glasses')}>Syze optike <ArrowRight size={15} /></button><button onClick={() => browse('sunglasses', '/sunglasses')}>Syze dielli <ArrowRight size={15} /></button></nav>
    </div>
  </aside>;
}
