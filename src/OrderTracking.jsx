import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ClipboardCopy, PackageCheck, Phone, Search, ShieldCheck } from 'lucide-react';
import { displayOrderDate, euro, trackingError, trackingReference, trackingStage } from './checkoutExperience.js';
import { orderNextStep } from './servicePresentation.js';
import { useLanguage } from './i18n/LanguageSwitch.jsx';

export default function OrderTracking({ navigate, label }) {
  const language = useLanguage();
  const [lookup, setLookup] = useState(() => ({ orderId: trackingReference(window.location.search), contact: '' }));
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const request = useRef(null);
  const heading = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const checkOrder = async (event) => {
    event.preventDefault();
    if (checking) return;
    setChecking(true); setError(''); setOrder(null); setCopied(false); setCopyError('');
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/order-status.php', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: lookup.orderId.trim().toUpperCase(), contact: lookup.contact.trim() })
      });
      const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
      if (!response.ok || !payload.ok || !payload.order) throw new Error(payload.error || 'service_unavailable');
      setOrder(payload.order);
    } catch (failure) { setError(trackingError(failure.message)); }
    finally { clearTimeout(timeout); setChecking(false); }
  };
  useEffect(() => {
    if (!order) return;
    heading.current?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 760px)').matches) heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [order]);
  const stage = order ? trackingStage(order) : -1;
  const paymentUrl = (() => { try { const url = new URL(order?.paymentLink || ''); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } })();
  const copy = async () => { try { await navigator.clipboard.writeText(order.id); setCopied(true); setCopyError(''); } catch { setCopied(false); setCopyError('Kopjimi nuk u lejua. Zgjidhni kodin më sipër dhe kopjojeni manualisht.'); } };
  return <section className="tracking-page">
    <header className="tracking-heading"><span className="ed-kicker">PAS POROSISË</span><h1>Porosia juaj, hap pas hapi.</h1><p>Shihni statusin e përgatitjes, pagesës dhe dorëzimit — pa telefonata të panevojshme.</p></header>
    <div className="tracking-layout">
      <form className="tracking-lookup" onSubmit={checkOrder} aria-busy={checking}>
        <h2>Gjeni porosinë</h2><p>Përdorni kodin e kërkesës dhe të njëjtin kontakt që vendosët në porosi.</p>
        <label htmlFor="track-order">Kodi i porosisë<input id="track-order" required maxLength={100} autoCapitalize="characters" spellCheck={false} autoComplete="off" value={lookup.orderId} onChange={(e) => setLookup({ ...lookup, orderId: e.target.value.toUpperCase() })} placeholder="OM-…" /></label>
        <label htmlFor="track-contact">Emaili ose telefoni<input id="track-contact" required maxLength={180} autoComplete="email" value={lookup.contact} onChange={(e) => setLookup({ ...lookup, contact: e.target.value })} placeholder="Kontakti i përdorur në porosi" /></label>
        {error && <p className="tracking-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={checking}><Search size={17}/>{checking ? 'Duke kontrolluar…' : 'Kontrollo porosinë'}</button>
        <small className="tracking-privacy"><ShieldCheck size={17}/> Të dhënat e porosisë shfaqen vetëm kur kodi dhe kontakti përputhen.</small>
        <div className="tracking-help"><span>Keni një llogari?</span><button type="button" onClick={() => navigate('account')}>Shihni historikun tuaj <ArrowRight size={15}/></button><a href="tel:+38343777667"><Phone size={15}/> +383 43 777 667</a></div>
      </form>
      <div className="tracking-result" aria-live="polite" aria-busy={checking}>
        {!order ? <div className="tracking-empty"><PackageCheck size={34}/><h2>{checking ? 'Po verifikojmë kërkesën.' : 'Çdo hap, në një vend.'}</h2><p>Pas verifikimit do të shihni produktet, totalin dhe përditësimin e fundit nga optika.</p><ul><li>Konfirmimi i kërkesës</li><li>Përgatitja në laborator</li><li>Marrja ose dorëzimi</li></ul></div> : <>
          <header className="tracking-result-head"><div><span className="ed-kicker">POROSIA JUAJ</span><h2 ref={heading} tabIndex={-1}>{label(order.status)}</h2><p>Përditësuar më {displayOrderDate(order.updatedAt || order.date, language)}</p></div><PackageCheck size={30}/></header>
          <div className="tracking-reference"><code>{order.id}</code><button type="button" onClick={copy} aria-label="Kopjo kodin e porosisë">{copied ? <Check size={17}/> : <ClipboardCopy size={17}/>} {copied ? 'U kopjua' : 'Kopjo'}</button></div>
          {copyError && <p className="tracking-footnote" role="status">{copyError}</p>}
          <p className="tracking-next-step">{orderNextStep(order)}</p>
          {stage >= 0 && <ol className="tracking-progress" aria-label="Ecuria e porosisë">{['Kërkesa', 'Konfirmimi', 'Përgatitja', 'Dorëzimi', 'Përfundimi'].map((name, index) => <li key={name} className={index <= stage ? 'reached' : ''} aria-current={index === stage ? 'step' : undefined}><span className="tracking-step-number">{index < stage ? <Check size={13}/> : index + 1}</span><span className="tracking-step-label">{name}</span></li>)}</ol>}
          <dl className="tracking-facts"><div><dt>Pagesa</dt><dd>{label(order.paymentStatus)}</dd></div><div><dt>Dorëzimi</dt><dd>{label(order.fulfillmentStatus)}</dd></div><div><dt>Mënyra</dt><dd>{label(order.shipping)}</dd></div><div><dt>Kodi i dërgesës</dt><dd>{order.trackingNumber || (stage < 0 ? '—' : /pickup|marrje/i.test(order.shipping || '') ? 'Marrje në optikë — pa kod dërgese' : 'Shtohet nga ekipi pas nisjes')}</dd></div></dl>
          <div className="tracking-items"><h3>Artikujt</h3>{order.items?.length ? order.items.map((item, index) => <div key={`${item.productId}-${index}`}><span><strong>{item.name}</strong><small>Sasia: {item.quantity}{item.configuration?.lensPackage ? ` · ${item.configuration.lensPackage}` : ''}</small></span><b>{euro(item.lineTotal)}</b></div>) : <p>{order.product}</p>}<footer><span>Totali i porosisë</span><strong>{euro(order.total)}</strong></footer></div>
          {paymentUrl && !['Paid', 'Refunded'].includes(order.paymentStatus) && stage >= 0 && <a className="primary-button" href={paymentUrl} target="_blank" rel="noopener noreferrer">Hap lidhjen e pagesës <ArrowRight size={17}/></a>}
          <p className="tracking-footnote">Statusi i pagesës dhe dorëzimit shfaqen veçmas. Për sqarime, përmendni kodin e porosisë kur kontaktoni optikën.</p>
        </>}
      </div>
    </div>
  </section>;
}
