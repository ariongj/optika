import { useEffect, useMemo, useRef, useState } from "react";
import { serviceQueues, queueItems, isOrderReady, submissionMatches, labMarketLabel, labBusinessLabels, labInterestLabels, submissionCountryLabel } from './servicePresentation.js';
import { confirmStaffLogout } from './staffSession.js';
import {
  Activity,
  BarChart3,
  Box,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Eye,
  FileText,
  History,
  LockKeyhole,
  LogOut,
  PackagePlus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  UploadCloud,
  X,
  Users
} from "lucide-react";
import { createVirtualTryOnRenderer } from "./virtualTryOn3D.js";
import { editorialMedia, safeEditorialImage } from './editorialMedia.js';
import { divisionName } from './holdingContent.js';
import { CmsNavigation, CmsCatalogue, CmsModules } from './CmsWorkspace.jsx';
import { canCms, canOpenCmsSection, productEditorMeasurements } from './cmsWorkspace.js';

const euro = (amount) => new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(Number(amount || 0));

const portalLabels = {
  Dashboard: "Përmbledhja",
  Products: "Produktet",
  Orders: "Porositë",
  Appointments: "Kërkesat & terminet",
  Clients: "Klientët",
  Content: "Përmbajtja",
  Discounts: "Zbritjet",
  Analytics: "Analitika",
  Settings: "Cilësimet",
  Audit: "Historiku",
  Inventory: "Inventari", Collections: "Koleksionet", Rules: "Rregullat e zbritjes",
  Offers: "Ofertat", Placements: "Slideshow & bannerë", Staff: "Stafi & rolet",
  Contacts: "Kontaktet", Revisions: "Versionet", Integrations: "Integrimet",
  Pending: "Në pritje",
  Confirmed: "E konfirmuar",
  "In lab": "Në laborator",
  Ready: "Gati",
  Completed: "E përfunduar",
  "Return requested": "Kthimi u kërkua",
  Returned: "E kthyer",
  Cancelled: "E anuluar",
  "Awaiting confirmation": "Në pritje të konfirmimit",
  "Awaiting payment": "Në pritje të pagesës",
  "Partially paid": "Pjesërisht e paguar",
  Paid: "E paguar",
  Refunded: "E rimbursuar",
  Unfulfilled: "Ende pa përgatitur",
  Processing: "Në përgatitje",
  "Ready for pickup": "Gati për marrje",
  Shipped: "E dërguar",
  Delivered: "E dorëzuar",
  New: "E re",
  Contacted: "E kontaktuar",
  Closed: "E mbyllur",
  Active: "Aktiv",
  "Follow-up": "Për ndjekje",
  "Needs review": "Kërkon kontroll",
  Inactive: "Joaktiv",
  "Entire order": "E gjithë porosia",
  "Lens packages": "Paketat e lenteve",
  "Polarized sunglasses": "Syzet e polarizuara",
  Uploaded: "E ngarkuar",
  "Manual entry": "E shkruar manualisht",
  "Send later": "Dërgohet më vonë",
  None: "Nuk kërkohet",
  "Awaiting optical confirmation": "Në pritje të kontrollit optik",
  "Awaiting optical review": "Për t’u verifikuar nga optiku",
  "Confirmed by optician": "Konfirmuar nga optiku",
  "Website checkout": "Porosi nga faqja",
  Reserved: "I rezervuar",
  Released: "I liruar",
  "Confirm with store": "Konfirmohet me optikën",
  Published: "Publikuar",
  Draft: "Draft",
  Archived: "Arkivuar",
  Disabled: "Çaktivizuar"
};
const portalLabel = (value) => portalLabels[value] || value;
const publicProducts = (items = []) => items.filter((product) => (product.status || "Published") === "Published");
const publicContent = (content = {}) => ({
  ...content,
  title: content.heroTitle,
  subtitle: content.heroSubtitle,
  primaryCta: content.primaryCta,
  secondaryCta: content.secondaryCta,
  banner: content.announcement
});
const orderPrescriptionTokens = (order) => [...new Set((order?.items || [])
  .map((item) => item?.configuration?.prescriptionToken)
  .filter(Boolean))];

const blankProduct = {
  id: "",
  sku: "",
  name: "",
  type: "Sunglasses",
  collection: "Optika Miftari",
  price: "",
  salePrice: "",
  stock: "0",
  image: "",
  material: "",
  size: "",
  color: "",
  lensType: "",
  description: "",
  frameWidth: "",
  lensWidth: "",
  lensHeight: "",
  bridgeWidth: "",
  templeLength: "",
  model3d: "",
  virtualTryOnEnabled: true,
  tryOnScale: "1",
  tryOnOffsetY: "0",
  tryOnRotationX: "0",
  tryOnRotationY: "0",
  tryOnRotationZ: "0",
  prescriptionReady: true,
  status: "Published"
};

function ProductModelPreview({ product }) {
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const [view, setView] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const engine = createVirtualTryOnRenderer(hostRef.current, product || blankProduct, {
      frameColor: product?.color,
      lensColor: product?.lensColor
    });
    engineRef.current = engine;
    engine.setMode("viewer");
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.updateProduct(product || blankProduct, {
      frameColor: product?.color,
      lensColor: product?.lensColor
    });
  }, [product]);

  useEffect(() => {
    engineRef.current?.setViewerRotation(view, 0.08);
  }, [view]);

  return (
    <div className="ops-model-preview">
      <div ref={hostRef} aria-label="Parapamja 3D e kalibrimit" />
      <nav aria-label="Pamjet e modelit">
        <button type="button" className={view === 0 ? "active" : ""} onClick={() => setView(0)}>Përballë</button>
        <button type="button" className={view === -0.55 ? "active" : ""} onClick={() => setView(-0.55)}>Kënd</button>
        <button type="button" className={view === -0.72 ? "active" : ""} onClick={() => setView(-0.72)}>Profil</button>
      </nav>
    </div>
  );
}

async function parseResponse(response) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw new Error("Portali kërkon PHP aktiv në server.");
  }
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    const errors = {
      invalid_credentials: "Emaili ose fjalëkalimi nuk është i saktë.",
      permission_denied: 'Roli juaj nuk e lejon këtë veprim.',
      stock_conflict: 'Stoku ndryshoi ndërkohë. Rifreskoni dhe kontrolloni sasinë para riprovimit.',
      import_preview_stale: 'Katalogu ndryshoi pas parapamjes. Ngarkoni CSV përsëri dhe kontrolloni sasitë para importit.',
      content_conflict: 'Një koleg ka ruajtur një version më të ri. Kopjoni ndryshimet tuaja dhe rifreskoni para ruajtjes.',
      duplicate_sku: 'Ky SKU i përket një produkti tjetër.',
      invalid_sale_price: 'Çmimi në zbritje duhet të jetë pozitiv dhe më i ulët se çmimi bazë.',
      invalid_schedule: 'Kontrolloni datat; mbarimi duhet të jetë pas fillimit.',
      duplicate_discount_code: 'Ky kod zbritjeje është tashmë në përdorim.',
      invalid_local_image: 'Zgjidhni një imazh të ngarkuar në këtë website.',
      stock_reason_required: 'Shkruani sasinë e ndryshimit dhe arsyen e korrigjimit.',
      too_many_attempts: "Shumë tentativa. Provoni përsëri pas 15 minutash.",
      authentication_required: "Sesioni ka skaduar. Hyni përsëri.",
      setup_required: "Portali kërkon konfigurimin e hyrjes nga administratori teknik.",
      invalid_csrf_token: "Sesioni i sigurisë ka skaduar. Rifreskoni portalin.",
      current_password_incorrect: "Fjalëkalimi aktual nuk është i saktë.",
      password_too_short: "Fjalëkalimi i ri duhet të ketë së paku 12 karaktere.",
      password_change_required: "Ndryshoni fjalëkalimin e përkohshëm para se të përdorni portalin.",
      rate_limit_exceeded: "Kufiri i tentativave u arrit. Provoni përsëri më vonë.",
      file_too_large: "Skedari është më i madh se kufiri i lejuar.",
      unsupported_file_type: "Formati i skedarit nuk mbështetet.",
      invalid_glb: "Skedari nuk është një model GLB i vlefshëm.",
      campaign_code_required: "Shkruani kodin e zbritjes.",
      invalid_campaign_value: "Vlera duhet të jetë përqindje, p.sh. 15%, ose Free.",
      invalid_payment_link: "Lidhja e pagesës duhet të jetë një adresë e sigurt https://."
    };
    const failure = new Error(errors[payload.error] || payload.error || "Kërkesa nuk u krye.");
    failure.code = payload.error || 'request_failed';
    throw failure;
  }
  return payload;
}

async function apiGet(resource) {
  const response = await fetch(`/api/index.php?resource=${encodeURIComponent(resource)}&t=${Date.now()}`, {
    credentials: "same-origin",
    cache: "no-store"
  }).catch(() => { throw new Error('Nuk u lidhëm me shërbimin. Kontrolloni lidhjen dhe provoni përsëri.'); });
  return parseResponse(response);
}

async function apiPost(action, body, csrf = "") {
  const response = await fetch("/api/index.php", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {})
    },
    body: JSON.stringify({ action, ...body })
  }).catch(() => { throw new Error('Nuk u konfirmua ruajtja. Kontrolloni lidhjen, rifreskoni gjendjen dhe provoni përsëri.'); });
  return parseResponse(response);
}

function EmptyState({ icon: Icon = CircleAlert, title, copy }) {
  return (
    <div className="ops-empty">
      <Icon size={25} />
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

function PortalPanel({ title, copy, action, children }) {
  return (
    <section className="ops-panel">
      <header>
        <div><h2>{title}</h2>{copy && <p>{copy}</p>}</div>
        {action}
      </header>
      {children}
    </section>
  );
}

const enquiryStatusLabel = (item, value) => item.division === 'lab' && value === 'Confirmed' ? 'Kontakt i konfirmuar' : portalLabel(value);
const submissionDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nuk është regjistruar';
};

function LabApplicationDetails({ item }) {
  const facts = [
    ['Biznesi', item.organization || 'Nuk është dhënë'],
    ['Lloji i biznesit', labBusinessLabels[item.businessType] || item.businessType || 'Nuk është dhënë'],
    ['Tregu', labMarketLabel(item)],
    ['Shteti', item.country ? `${submissionCountryLabel(item.country)} (${item.country})` : 'Nuk është dhënë'],
    ['Interesi', labInterestLabels[item.interest] || item.interest || item.service || 'Bashkëpunim B2B'],
    ['Gjuha e formularit', { sq: 'Shqip', en: 'Anglisht' }[item.locale] || 'Nuk është regjistruar'],
    ['Faqja e biznesit', item.website || 'Nuk është dhënë'],
    ['Faqja burim', item.sourcePath || 'Formular i mëparshëm'],
    ['Pranuar më', submissionDate(item.createdAt)],
    ['Pëlqimi për kontakt', item.contactConsentAt ? submissionDate(item.contactConsentAt) : 'Nuk është regjistruar në formularin e mëparshëm']
  ];
  return <details className="ops-content-disclosure ops-partner-details">
    <summary>Të dhënat e aplikimit B2B<ChevronDown size={18} /></summary>
    <dl className="ops-partner-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {item.message && <div className="ops-partner-message"><strong>Mesazhi i aplikuesit</strong><p>{item.message}</p></div>}
    <p className="ops-partner-note">Ky është aplikim për kontakt. Statusi “Kontakt i konfirmuar” nuk miraton partneritetin, çmimet, dokumentacionin ose certifikimin.</p>
  </details>;
}

export default function AdminPortal({ setStoreProducts, setHomepageContent, navigate }) {
  const [session, setSession] = useState({ checked: false, authenticated: false, email: "", csrf: "", passwordChangeRequired: false });
  const [credentials, setCredentials] = useState({ email: "admin@optikamiftari.com", password: "" });
  const [data, setData] = useState(null);
  const [section, setSection] = useState("Dashboard");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState('');
  const [productEditor, setProductEditor] = useState(false);
  const [contentDirty, setContentDirty] = useState(false);
  const openSection = (nextSection, nextQueue = '', nextQuery = '') => {
    if (!canOpenCmsSection(data?.cms?.permissions || [], nextSection)) { setError('Roli juaj nuk ka qasje në këtë modul.'); return; }
    if (contentDirty && !window.confirm('Ka ndryshime të paruajtura. Dilni pa i ruajtur?')) return;
    if (contentDirty) void loadSnapshot();
    setContentDirty(false); setProductEditor(false);
    setSection(nextSection); setQueue(nextQueue); setQuery(nextQuery);
  };
  const [productDraft, setProductDraft] = useState(blankProduct);
  const closeProductEditor = () => {
    setProductDraft(blankProduct);
    setProductEditor(false);
  };
  const [campaignDraft, setCampaignDraft] = useState({ code: "", value: "", scope: "Entire order", active: true, channel: "Checkout" });
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const notify = (message) => {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 3200);
  };

  const loadSnapshot = async () => {
    // The server seeds a missing store. An intentionally empty catalogue is a
    // valid managed state and must never trigger a browser-side import.
    const next = await apiGet("snapshot");
    setData({ ...next, content: next.cms?.draft?.content || next.content });
    setContentDirty(false);
    if (Array.isArray(next.products) && canCms(next.cms?.permissions, 'catalog.read')) setStoreProducts(publicProducts(next.products));
    if (next.content && canCms(next.cms?.permissions, 'content.read')) setHomepageContent?.((current) => ({ ...current, ...publicContent(next.content) }));
    setSession((current) => ({ ...current, authenticated: true, email: next.user?.email || current.email, csrf: next.csrf || current.csrf }));
    return next;
  };

  useEffect(() => {
    if (!contentDirty) return;
    const guard = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [contentDirty]);

  useEffect(() => {
    let active = true;
    apiGet("session")
      .then(async (result) => {
        if (!active) return;
        setSession({ checked: true, authenticated: result.authenticated, email: result.email, csrf: result.csrf, passwordChangeRequired: Boolean(result.passwordChangeRequired) });
        if (result.authenticated && !result.passwordChangeRequired) await loadSnapshot();
      })
      .catch((caught) => {
        if (!active) return;
        setSession({ checked: true, authenticated: false, email: "", csrf: "", passwordChangeRequired: false });
        setError(caught.message);
      });
    return () => { active = false; };
  }, []);

  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiPost("login", credentials);
      setSession({ checked: true, authenticated: true, email: result.email, csrf: result.csrf, passwordChangeRequired: Boolean(result.passwordChangeRequired) });
      if (!result.passwordChangeRequired) await loadSnapshot();
      setCredentials((current) => ({ ...current, password: "" }));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const mutate = async (action, body, success) => {
    setBusy(true);
    setError("");
    try {
      const result = await apiPost(action, body, session.csrf);
      if (result.products) {
        setData((current) => ({ ...current, products: result.products }));
        setStoreProducts(publicProducts(result.products));
      }
      if (result.orders) setData((current) => ({ ...current, orders: result.orders }));
      if (result.customers) setData((current) => ({ ...current, customers: result.customers }));
      if (result.accounts) setData((current) => ({ ...current, accounts: result.accounts }));
      if (result.submissions) setData((current) => ({ ...current, submissions: result.submissions }));
      if (result.content) {
        setData((current) => ({ ...current, content: result.content }));
        setHomepageContent?.((current) => ({ ...current, ...publicContent(result.content) }));
      }
      if (result.campaigns) setData((current) => ({ ...current, campaigns: result.campaigns }));
      if (result.draft) {
        setData(current => ({ ...current, cms: { ...current.cms, draft: result.draft } }));
        setContentDirty(false);
      }
      if (result.content) { setContentDirty(false); await loadSnapshot(); }
      notify(success);
      return result;
    } catch (caught) {
      setError(caught.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const requestCms = async (action, body = {}, success = '', legacy = false) => {
    if (legacy) return mutate(action, body, success);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/cms.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }, body: JSON.stringify({ action, ...body }) });
      const result = await parseResponse(response);
      if (result.cms) setData(current => ({ ...current, cms: result.cms, ...(canCms(result.cms.permissions, 'catalog.read') && result.products ? { products: result.products } : {}) }));
      if (result.products && canCms(result.cms?.permissions || data?.cms?.permissions, 'catalog.read')) setStoreProducts(publicProducts(result.products));
      if (success) notify(success);
      return result;
    } catch (caught) { setError(caught.message); return null; }
    finally { setBusy(false); }
  };

  const logout = async () => {
    if (busy) return;
    setBusy(true); setError('');
    const result = await confirmStaffLogout(() => apiPost('logout', {}, session.csrf));
    if (result.confirmed) {
      setSession({ checked: true, authenticated: false, email: "", csrf: "", passwordChangeRequired: false });
      setData(null);
      setPasswordDraft({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setCredentials((current) => ({ ...current, password: '' }));
    } else setError(result.error);
    setBusy(false);
  };

  const completeInitialPasswordChange = async (event) => {
    event.preventDefault();
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setError("Konfirmimi nuk përputhet me fjalëkalimin e ri.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiPost("change_password", passwordDraft, session.csrf);
      setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSession((current) => ({ ...current, passwordChangeRequired: false }));
      await loadSnapshot();
      notify("Fjalëkalimi u ndryshua. Portali është gati për përdorim.");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session.checked) {
    return <div className="ops-auth"><div className="ops-loader"><RefreshCw className="spin" /> Duke kontrolluar sesionin…</div></div>;
  }

  if (!session.authenticated) {
    return (
      <div className="ops-auth">
        <section className="ops-login-card">
          <div className="ops-login-brand">
            <img src="/assets/brand/optika-miftari-monogram.png" alt="Optika Miftari" />
            <span>OPTIKA <strong>MIFTARI</strong><small>MENAXHIMI</small></span>
          </div>
          <div className="ops-login-copy">
            <span>PËR STAFIN E AUTORIZUAR</span>
            <h1>Hyrja e ekipit Miftari.</h1>
            <p>Stoku, porositë, terminet, klientët, përmbajtja dhe performanca e faqes ruhen në server.</p>
          </div>
          <form onSubmit={login}>
            <label>Emaili<input type="email" required autoComplete="username" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} /></label>
            <label>Fjalëkalimi<input type="password" required autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
            {error && <p className="ops-error"><CircleAlert size={16} /> {error}</p>}
            <button disabled={busy}><LockKeyhole size={17} /> {busy ? "Duke hyrë…" : "Hap portalin"}</button>
          </form>
          <small>Sesioni skadon pas 8 orësh pa aktivitet. Pesë tentativa të pasakta e bllokojnë hyrjen për 15 minuta.</small>
        </section>
      </div>
    );
  }

  if (session.passwordChangeRequired) {
    return (
      <div className="ops-auth">
        <section className="ops-login-card">
          <div className="ops-login-brand">
            <img src="/assets/brand/optika-miftari-monogram.png" alt="Optika Miftari" />
            <span>OPTIKA <strong>MIFTARI</strong><small>MENAXHIMI</small></span>
          </div>
          <div className="ops-login-copy">
            <span>HAPI I PARË I SIGURISË</span>
            <h1>Ndryshoni fjalëkalimin e përkohshëm.</h1>
            <p>Para se të hapet paneli, krijoni një fjalëkalim unik me së paku 12 karaktere.</p>
          </div>
          <form onSubmit={completeInitialPasswordChange}>
            <label>Fjalëkalimi aktual<input type="password" required autoComplete="current-password" value={passwordDraft.currentPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, currentPassword: event.target.value })} /></label>
            <label>Fjalëkalimi i ri<input type="password" required minLength="12" autoComplete="new-password" value={passwordDraft.newPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, newPassword: event.target.value })} /></label>
            <label>Konfirmo fjalëkalimin<input type="password" required minLength="12" autoComplete="new-password" value={passwordDraft.confirmPassword} onChange={(event) => setPasswordDraft({ ...passwordDraft, confirmPassword: event.target.value })} /></label>
            {error && <p className="ops-error"><CircleAlert size={16} /> {error}</p>}
            <button disabled={busy}><LockKeyhole size={17} /> {busy ? "Duke e siguruar…" : "Ruaj dhe hap portalin"}</button>
          </form>
        </section>
      </div>
    );
  }

  if (!data) return <div className="ops-auth"><div className="ops-loader"><RefreshCw className="spin" /> Duke ngarkuar të dhënat…</div></div>;

  const nav = [
    [Activity, "Dashboard"],
    [Boxes, "Products"],
    [ShoppingBag, "Orders"],
    [CalendarDays, "Appointments"],
    [Users, "Clients"],
    [FileText, "Content"],
    [Settings, "Discounts"],
    [BarChart3, "Analytics"],
    [History, "Audit"],
    [Settings, "Settings"]
  ];
  const searchable = (items, fields) => items.filter((item) => !query.trim() || fields.some((field) => [item[field], portalLabel(item[field])].some((value) => String(value || '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))));
  const products = searchable(queueItems(data.products || [], queue, 'Products'), ["name", "sku", "type", "collection"]);
  const orders = searchable(queueItems(data.orders || [], queue, 'Orders'), ["id", "customer", "email", "phone", "product", "status"]);
  const submissions = queueItems(data.submissions || [], queue, section).filter(item => section === 'Contacts' ? item.type !== 'appointment' : section === 'Appointments' ? item.type === 'appointment' : true).filter((item) => submissionMatches(item, query, (value) => enquiryStatusLabel(item, value)));
  const clients = searchable(data.customers || [], ["name", "email", "phone", "segment", "status"]);
  const customerAccounts = searchable(data.accounts || [], ["firstName", "lastName", "email", "phone", "status"]);
  const orderValueAverage = data.orders?.length
    ? (data.orders.reduce((sum, order) => sum + Number(order.total || 0), 0) / data.orders.length)
    : 0;
  const ordersInLab = (data.orders || []).filter((order) => order.status === "In lab").length;
  const ordersReady = (data.orders || []).filter(isOrderReady).length;
  const unpaidOrders = (data.orders || []).filter((order) => !["Paid", "Refunded"].includes(order.paymentStatus) && !["Cancelled", "Returned"].includes(order.status)).length;
  const followUpsDue = (data.submissions || []).filter((item) => item.type === 'appointment' && ["New", "Contacted"].includes(item.status)).length;
  const contactFollowUpsDue = (data.submissions || []).filter((item) => item.type !== 'appointment' && ["New", "Contacted"].includes(item.status)).length;
  const updateContent = (key, value) => { setContentDirty(true); setData((current) => ({
    ...current,
    content: { ...current.content, [key]: value }
  })); };
  const pageContentGroups = [
    ["Miftari Holding Group · kryefaqja", "groupTitle", "groupSubtitle", "groupSeoTitle", "groupSeoDescription"],
    ["Optical Lab", "labTitle", "labSubtitle", "labSeoTitle", "labSeoDescription"],
    ["Optical Lab · Kosovë · shqip", "labKosovoTitle", "labKosovoSubtitle", "labKosovoSeoTitle", "labKosovoSeoDescription"],
    ["Optical Lab · Bashkimi Evropian · anglisht", "labEuropeTitle", "labEuropeSubtitle", "labEuropeSeoTitle", "labEuropeSeoDescription"],
    ["Klinika Miftari", "clinicTitle", "clinicSubtitle", "clinicSeoTitle", "clinicSeoDescription"],
    ["Partnerë B2B", "partnersTitle", "partnersSubtitle", "partnersSeoTitle", "partnersSeoDescription"],
    ["Katalogu", "shopTitle", "shopSubtitle", "shopSeoTitle", "shopSeoDescription"],
    ["Ekzaminimi", "examinationTitle", "examinationSubtitle", "examinationSeoTitle", "examinationSeoDescription"],
    ["Syze me dioptri", "prescriptionTitle", "prescriptionSubtitle", "prescriptionSeoTitle", "prescriptionSeoDescription"],
    ["Syze dielli", "sunglassesTitle", "sunglassesSubtitle", "sunglassesSeoTitle", "sunglassesSeoDescription"],
    ["Rreth nesh", "aboutTitle", "aboutSubtitle", "aboutSeoTitle", "aboutSeoDescription"],
    ["Kontakti", "contactTitle", "contactSubtitle", "contactSeoTitle", "contactSeoDescription"]
  ];

  const saveProduct = async (event) => {
    event.preventDefault();
    const payload = {
      ...productDraft,
      price: Number(productDraft.price || 0),
      salePrice: productDraft.salePrice === "" ? null : Number(productDraft.salePrice),
      stock: Number(productDraft.stock || 0),
      frameWidth: Number(productDraft.frameWidth || 0),
      lensWidth: Number(productDraft.lensWidth || 0),
      lensHeight: Number(productDraft.lensHeight || 0),
      bridgeWidth: Number(productDraft.bridgeWidth || 0),
      templeLength: Number(productDraft.templeLength || 0),
      tryOnScale: Number(productDraft.tryOnScale || 1),
      tryOnOffsetY: Number(productDraft.tryOnOffsetY || 0),
      tryOnRotationX: Number(productDraft.tryOnRotationX || 0),
      tryOnRotationY: Number(productDraft.tryOnRotationY || 0),
      tryOnRotationZ: Number(productDraft.tryOnRotationZ || 0)
    };
    const result = await mutate("save_product", { product: payload, expectedStock: data.products.find(p => p.id === productDraft.id)?.stock }, productDraft.id ? "Produkti u përditësua." : "Produkti u shtua në katalog.");
    if (result) { setProductDraft(blankProduct); setProductEditor(false); }
  };

  const uploadProductImage = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload.php", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": session.csrf }, body: form });
      const result = await parseResponse(response);
      setProductDraft((current) => ({ ...current, image: result.url }));
      notify("Fotografia u ngarkua në server.");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadContentImage = async (key, file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload.php", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": session.csrf }, body: form });
      const result = await parseResponse(response);
      updateContent(key, result.url);
      notify("Fotografia u ngarkua. Publikoni ndryshimet për ta shfaqur në faqe.");
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  };

  const uploadProductModel = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload-model.php", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": session.csrf }, body: form });
      const result = await parseResponse(response);
      setProductDraft((current) => ({ ...current, model3d: result.url, virtualTryOnEnabled: true }));
      notify("Modeli GLB u ngarkua. Kontrolloni shkallën dhe ankorimin para publikimit.");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ops-shell cms-workspace">
      <CmsNavigation data={data} section={section} openSection={openSection} email={session.email} logout={logout} busy={busy} />

      <section className="ops-main">
        <header className="ops-topbar">
          <div><span>OPTIKA MIFTARI / MENAXHIMI</span><h1>{portalLabel(section)}</h1></div>
          <div className="ops-top-actions">
            {['Orders','Clients','Appointments','Contacts'].includes(section) && <label className="ops-search"><Search size={17} /><input aria-label={section === 'Appointments' ? 'Kërko klient, biznes, shtet ose interes' : 'Kërko në listë'} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section === 'Appointments' ? 'Biznes, shtet, interes…' : 'Kërko…'} /></label>}
            <button aria-label="Rifresko të dhënat" onClick={async () => { setBusy(true); setError(''); try { await loadSnapshot(); } catch (caught) { setError(caught.message); } finally { setBusy(false); } }} disabled={busy}><RefreshCw size={17} className={busy ? "spin" : ""} /> Rifresko</button>
            <button className="primary" aria-label="Shiko faqen publike" onClick={() => navigate("home")}><Eye size={17} /> Shiko faqen</button>
            <button className="ops-mobile-logout" aria-label="Dil nga portali" onClick={logout}><LogOut size={17} /> Dil</button>
          </div>
        </header>
        {notice && <div className="ops-notice" role="status"><Check size={17} /> {notice}</div>}
        {error && <div className="ops-error-banner" role="alert"><CircleAlert size={17} /> {error}</div>}
        {(['Orders', 'Appointments', 'Contacts'].includes(section) || (section === 'Products' && (queue || query))) && <div className="ops-queue-toolbar"><label>Shfaq<select aria-label="Filtro listën" value={serviceQueues[queue]?.section === section ? queue : ''} onChange={(event) => setQueue(event.target.value)}><option value="">Të gjitha</option>{Object.entries(serviceQueues).filter(([, entry]) => entry.section === section).map(([key, entry]) => <option key={key} value={key}>{entry.label}</option>)}</select></label>{(queue || query) && <button onClick={() => { setQueue(''); setQuery(''); }}><X size={15} />Pastro filtrat</button>}<span>{section === 'Orders' ? orders.length : section === 'Products' ? products.length : submissions.length} rezultate</span></div>}

        {section === "Dashboard" && <>
          <div className="ops-kpis">
            <article><span>Vlera e përfunduar</span><strong>{euro(data.metrics.revenue)}</strong><small>Vetëm porositë e përfunduara</small></article>
            <article><span>Porosi të hapura</span><strong>{data.metrics.openOrders}</strong><small>Nga kërkesa te dorëzimi</small></article>
            <article className={data.metrics.lowStock ? "attention" : ""}><span>Stok i ulët</span><strong>{data.metrics.lowStock}</strong><small>Produkte me 5 ose më pak copë</small></article>
            <article><span>Kërkesa të reja</span><strong>{data.metrics.newSubmissions}</strong><small>Termine dhe pyetje të pakontaktuara</small></article>
            <article><span>Vlera në proces</span><strong>{euro(data.metrics.requestValue)}</strong><small>Porosi aktive para përfundimit</small></article>
            <article><span>Vlera mesatare</span><strong>{euro(orderValueAverage)}</strong><small>Mesatarja e të gjitha porosive</small></article>
          </div>
          <div className="ops-dashboard-grid">
            <PortalPanel title="Porositë e fundit" copy="Hapni një porosi për të parë dhe menaxhuar vetëm atë." action={<button onClick={() => openSection('Orders')}>Të gjitha <ChevronRight size={15} /></button>}>
              <div className="ops-rows">{data.orders.slice(0, 6).map((order) => <button key={order.id} onClick={() => openSection('Orders', '', order.id)}><span><strong>{order.id}</strong><small>{order.customer}</small></span><span><strong>{euro(order.total)}</strong><small>{portalLabel(order.status)}</small></span></button>)}{!data.orders.length && <EmptyState icon={ShoppingBag} title="Ende pa porosi" copy="Porosia e parë nga faqja do të shfaqet këtu." />}</div>
            </PortalPanel>
            <PortalPanel title="Terminet dhe kërkesat" copy="Hapni kërkesën për të konfirmuar orarin dhe kontaktin." action={<button onClick={() => openSection('Appointments')}>Hap kërkesat <ChevronRight size={15} /></button>}>
              <div className="ops-rows">{data.submissions.slice(0, 6).map((item) => <button key={item.id} onClick={() => openSection(item.type === 'appointment' ? 'Appointments' : 'Contacts', '', item.id)}><span><strong>{item.organization || item.name}</strong><small>{item.division === 'lab' ? `Optical Lab · ${labMarketLabel(item)}` : item.service || item.type}</small></span><span><strong>{item.confirmedDate || item.preferredDate || 'Pa datë'}</strong><small>{enquiryStatusLabel(item, item.status)}</small></span></button>)}{!data.submissions.length && <EmptyState icon={CalendarDays} title="Nuk ka kërkesa të reja" copy="Kërkesat për termine dhe bashkëpunim do të shfaqen këtu." />}</div>
            </PortalPanel>
            <PortalPanel title="Kontrolli ditor" copy="Çfarë kërkon veprim nga ekipi sot.">
              <div className="ops-signal-list ops-daily-queue">
                <button onClick={() => openSection('Orders', 'lab')}><span>Porosi në laborator</span><strong>{ordersInLab}</strong></button>
                <button onClick={() => openSection('Orders', 'ready')}><span>Gati për dorëzim</span><strong>{ordersReady}</strong></button>
                <button onClick={() => openSection('Orders', 'unpaid')}><span>Pagesa për t’u ndjekur</span><strong>{unpaidOrders}</strong></button>
                <button onClick={() => openSection('Appointments', 'followup')}><span>Termine për kontakt</span><strong>{followUpsDue}</strong></button><button onClick={() => openSection('Contacts', 'contactFollowup')}><span>Kontakte & B2B për ndjekje</span><strong>{contactFollowUpsDue}</strong></button>
              </div>
            </PortalPanel>
            <PortalPanel title="Gjendja e katalogut" copy="Kontroll i shpejtë i publikimit dhe stokut.">
              <div className="ops-signal-list ops-daily-queue">
                <button onClick={() => openSection('Products', 'published')}><span>Produkte të publikuara</span><strong>{queueItems(data.products || [], 'published', 'Products').length}</strong></button>
                <button onClick={() => openSection('Products', 'draft')}><span>Draft / arkiv</span><strong>{queueItems(data.products || [], 'draft', 'Products').length}</strong></button>
                <button onClick={() => openSection('Products', 'empty')}><span>Pa stok</span><strong>{queueItems(data.products || [], 'empty', 'Products').length}</strong></button>
                <button onClick={() => openSection('Content')}><span>Publikimi i fundit</span><strong>{data.content?.updatedAt ? new Date(data.content.updatedAt).toLocaleDateString("sq-AL") : "Fillestar"}</strong></button>
              </div>
            </PortalPanel>
          </div>
        </>}

        {['Inventory','Collections','Rules','Offers','Placements','Staff','Revisions','Integrations'].includes(section) && <CmsModules section={section} data={data} request={requestCms} busy={busy} openSection={openSection} csrf={session.csrf} />}
        {section === 'Products' && !productEditor && <CmsCatalogue products={products} permissions={data.cms?.permissions || []} request={requestCms} busy={busy} onNew={() => { setProductDraft({ ...blankProduct, status: 'Draft' }); setProductEditor(true); }} onEdit={product => { setProductDraft({ ...blankProduct, ...product, ...productEditorMeasurements(product), salePrice: product.salePrice ?? '' }); setProductEditor(true); }} />}
        {section === "Products" && productEditor && <div className="cms-product-editor">
          <button disabled={busy} onClick={closeProductEditor}>← Kthehu te katalogu</button>
          <PortalPanel title={productDraft.id ? "Përditëso produktin" : "Shto produkt"} copy="Ruajeni si draft për kontroll ose publikojeni menjëherë në katalog.">
            <form className="ops-form" onSubmit={saveProduct}>
              <div className="ops-form-grid"><label>Emri i produktit<input required value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} /></label><label>SKU<input value={productDraft.sku} onChange={(e) => setProductDraft({ ...productDraft, sku: e.target.value })} /></label></div>
              <div className="ops-form-grid three"><label>Lloji<select value={productDraft.type} onChange={(e) => setProductDraft({ ...productDraft, type: e.target.value })}><option value="Sunglasses">Syze dielli</option><option value="Prescription Glasses">Syze me dioptri</option></select></label><label>Statusi<select value={productDraft.status || "Published"} onChange={(e) => setProductDraft({ ...productDraft, status: e.target.value })}><option value="Published">Publikuar</option><option value="Draft">Draft</option><option value="Archived">Arkivuar</option></select></label><label>Stoku<input required type="number" min="0" value={productDraft.stock} onChange={(e) => setProductDraft({ ...productDraft, stock: e.target.value })} /></label></div>
              <div className="ops-form-grid three"><label>Çmimi €<input required type="number" min="0" step="0.01" value={productDraft.price} onChange={(e) => setProductDraft({ ...productDraft, price: e.target.value })} /></label><label>Çmimi në zbritje €<input type="number" min="0" step="0.01" value={productDraft.salePrice} onChange={(e) => setProductDraft({ ...productDraft, salePrice: e.target.value })} placeholder="Opsionale" /></label><label>Koleksioni<input value={productDraft.collection} onChange={(e) => setProductDraft({ ...productDraft, collection: e.target.value })} /></label></div>
              <div className="ops-form-grid"><label>Materiali<input value={productDraft.material} onChange={(e) => setProductDraft({ ...productDraft, material: e.target.value })} /></label><label>Lloji i lentes<input value={productDraft.lensType} onChange={(e) => setProductDraft({ ...productDraft, lensType: e.target.value })} /></label></div>
              <div className="ops-form-grid"><label>Madhësia<input value={productDraft.size} onChange={(e) => setProductDraft({ ...productDraft, size: e.target.value })} /></label><label>Ngjyra<input value={productDraft.color} onChange={(e) => setProductDraft({ ...productDraft, color: e.target.value })} /></label></div>
              <label>Përshkrimi<textarea rows="4" value={productDraft.description} onChange={(e) => setProductDraft({ ...productDraft, description: e.target.value })} /></label>
              <div className="ops-form-grid"><label>Barkodi<input value={productDraft.barcode || ''} onChange={e=>setProductDraft({...productDraft,barcode:e.target.value})}/></label><label>Etiketat (të ndara me presje)<input value={productDraft.tags || ''} onChange={e=>setProductDraft({...productDraft,tags:e.target.value})}/></label></div>
              <details className="ops-content-disclosure"><summary>Përshkrimi i imazhit & SEO<ChevronDown size={16}/></summary><div className="ops-form"><label>Teksti alternativ i imazhit<input value={productDraft.imageAlt || ''} onChange={e=>setProductDraft({...productDraft,imageAlt:e.target.value})}/></label><label>Titulli SEO<input maxLength="180" value={productDraft.seoTitle || ''} onChange={e=>setProductDraft({...productDraft,seoTitle:e.target.value})}/></label><label>Përshkrimi SEO<textarea maxLength="500" value={productDraft.seoDescription ?? productDraft.metaDescription ?? ''} onChange={e=>setProductDraft({...productDraft,seoDescription:e.target.value})}/></label></div></details>
              <label className="ops-upload"><UploadCloud size={18} /> Ngarko fotografi (JPG, PNG ose WEBP, max 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadProductImage(e.target.files?.[0])} /></label>
              {productDraft.image && <div className="ops-image-preview"><img src={productDraft.image} alt="Parapamje" /><span>{productDraft.image}</span></div>}
              <section className="ops-vto-config">
                <div><Box size={19} /><span><strong>Prova virtuale 3D</strong><small>Modeli, dimensionet reale dhe kalibrimi i produktit.</small></span></div>
                <label className="ops-check"><input type="checkbox" checked={Boolean(productDraft.virtualTryOnEnabled)} onChange={(e) => setProductDraft({ ...productDraft, virtualTryOnEnabled: e.target.checked })} /> Aktivizo provën 3D për këtë produkt</label>
                <label className="ops-upload"><UploadCloud size={18} /> Ngarko model GLB të optimizuar (max 20 MB)<input type="file" accept=".glb,model/gltf-binary,application/octet-stream" onChange={(e) => uploadProductModel(e.target.files?.[0])} /></label>
                {productDraft.model3d && <div className="ops-model-path"><Check size={16} /><span>{productDraft.model3d}</span></div>}
                <ProductModelPreview product={productDraft} />
                <div className="ops-form-grid three"><label>Gjerësia e kornizës mm<input type="number" min="90" max="190" step="0.1" value={productDraft.frameWidth} onChange={(e) => setProductDraft({ ...productDraft, frameWidth: e.target.value })} /></label><label>Gjerësia e lentes mm<input type="number" min="20" max="90" step="0.1" value={productDraft.lensWidth} onChange={(e) => setProductDraft({ ...productDraft, lensWidth: e.target.value })} /></label><label>Lartësia e lentes mm<input type="number" min="20" max="80" step="0.1" value={productDraft.lensHeight} onChange={(e) => setProductDraft({ ...productDraft, lensHeight: e.target.value })} /></label></div>
                <div className="ops-form-grid"><label>Ura mm<input type="number" min="5" max="40" step="0.1" value={productDraft.bridgeWidth} onChange={(e) => setProductDraft({ ...productDraft, bridgeWidth: e.target.value })} /></label><label>Bishti mm<input type="number" min="80" max="190" step="0.1" value={productDraft.templeLength} onChange={(e) => setProductDraft({ ...productDraft, templeLength: e.target.value })} /></label></div>
                <div className="ops-form-grid three"><label>Shkalla<input type="number" min="0.2" max="4" step="0.01" value={productDraft.tryOnScale} onChange={(e) => setProductDraft({ ...productDraft, tryOnScale: e.target.value })} /></label><label>Zhvendosja Y<input type="number" min="-2" max="2" step="0.01" value={productDraft.tryOnOffsetY} onChange={(e) => setProductDraft({ ...productDraft, tryOnOffsetY: e.target.value })} /></label><label>Rrotullimi X°<input type="number" min="-180" max="180" step="1" value={productDraft.tryOnRotationX} onChange={(e) => setProductDraft({ ...productDraft, tryOnRotationX: e.target.value })} /></label></div>
                <div className="ops-form-grid"><label>Rrotullimi Y°<input type="number" min="-180" max="180" step="1" value={productDraft.tryOnRotationY} onChange={(e) => setProductDraft({ ...productDraft, tryOnRotationY: e.target.value })} /></label><label>Rrotullimi Z°<input type="number" min="-180" max="180" step="1" value={productDraft.tryOnRotationZ} onChange={(e) => setProductDraft({ ...productDraft, tryOnRotationZ: e.target.value })} /></label></div>
                <small className="ops-vto-help">Emërtoni mesh-et: frame/front, left_lens, right_lens, left_temple, right_temple, hinge dhe bridge. Kjo lejon ngjyrat dhe materialet të ndryshojnë automatikisht.</small>
              </section>
              <label className="ops-check"><input type="checkbox" checked={Boolean(productDraft.prescriptionReady)} onChange={(e) => setProductDraft({ ...productDraft, prescriptionReady: e.target.checked })} /> I përshtatshëm për thjerrëza me recetë</label>
              <div className="ops-form-actions"><button disabled={busy}><Save size={17} /> {productDraft.id ? "Ruaj ndryshimet" : "Shto në katalog"}</button><button type="button" className="quiet" disabled={busy} onClick={closeProductEditor}>Anulo</button></div>
            </form>
          </PortalPanel>
        </div>}

        {section === "Orders" && <PortalPanel title={`Porositë (${orders.length})`} copy={`Vlera e kërkesave aktive: ${euro(data.metrics.requestValue || 0)}. Çmimi dhe stoku verifikohen nga serveri; pagesa dhe dorëzimi ndiqen veçmas.`}>
          <div className="ops-order-records">
            {orders.map((order) => (
              <details className="ops-order-record" key={order.id} open={orders.length === 1 ? true : undefined}>
                <summary><strong>{order.id}<small>{order.date}</small></strong><span>{order.customer}<small>{order.product}</small></span><b>{euro(order.total)}</b><span className="ops-record-status">{portalLabel(order.status)}</span><ChevronDown size={17} /></summary>
                <div className="ops-order-body"><div className="ops-order-info">
                <span><strong>Porosia</strong><small>{portalLabel(order.source || 'Faqja')}<br />Stoku: {portalLabel(order.inventoryState || 'I mëparshëm')}</small></span>
                <span><strong>{order.customer}</strong><small>{order.email}<br />{order.phone}<br />Preferon: {order.contactPreference || "—"}</small></span>
                <span><strong>{euro(order.total)}</strong><small>{portalLabel(order.priceStatus || "Vlerë e konfirmuar")}<br />{order.product}<br />Pagesa: {portalLabel(order.paymentStatus || "Awaiting confirmation")}</small></span>
                <span><strong>{portalLabel(order.prescription)}</strong><small>{portalLabel(order.shipping)}<br />{order.deliveryAddress || "—"}<br />Dorëzimi: {portalLabel(order.fulfillmentStatus || "Unfulfilled")}{order.trackingNumber ? <><br />Gjurmimi: {order.trackingNumber}</> : null}{order.customerNote ? <><br />Shënim: {order.customerNote}</> : null}</small>{orderPrescriptionTokens(order).map((token) => <a className="ops-prescription-link" key={token} href={`/api/prescription-download.php?token=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer"><FileText size={14} /> Shkarko recetën</a>)}</span>
                </div><fieldset className="ops-order-controls" disabled={busy}><legend>Përditëso porosinë</legend>
                  <label>Porosia<select value={order.status || "Pending"} onChange={(e) => mutate("update_order", { order: { id: order.id, status: e.target.value } }, `${order.id} u përditësua.`)}>{["Pending", "Confirmed", "In lab", "Ready", "Completed", "Return requested", "Returned", "Cancelled"].map((value) => <option key={value} value={value}>{portalLabel(value)}</option>)}</select></label>
                  <label>Pagesa<select value={order.paymentStatus || "Awaiting confirmation"} onChange={(e) => mutate("update_order", { order: { id: order.id, paymentStatus: e.target.value } }, `Pagesa e ${order.id} u përditësua.`)}>{["Awaiting confirmation", "Awaiting payment", "Partially paid", "Paid", "Refunded"].map((value) => <option key={value} value={value}>{portalLabel(value)}</option>)}</select></label>
                  <label>Dorëzimi<select value={order.fulfillmentStatus || "Unfulfilled"} onChange={(e) => mutate("update_order", { order: { id: order.id, fulfillmentStatus: e.target.value } }, `Dorëzimi i ${order.id} u përditësua.`)}>{["Unfulfilled", "Processing", "Ready for pickup", "Shipped", "Delivered", "Cancelled"].map((value) => <option key={value} value={value}>{portalLabel(value)}</option>)}</select></label>
                  <label>Gjurmimi<input defaultValue={order.trackingNumber || ""} placeholder="Kodi i dërgesës" onBlur={(e) => e.target.value !== (order.trackingNumber || "") && mutate("update_order", { order: { id: order.id, trackingNumber: e.target.value } }, `Gjurmimi i ${order.id} u ruajt.`)} /></label>
                  <label className="wide">Lidhja e pagesës<input type="url" defaultValue={order.paymentLink || ""} placeholder="https://pagesa..." onBlur={(e) => e.target.value !== (order.paymentLink || "") && mutate("update_order", { order: { id: order.id, paymentLink: e.target.value } }, `Lidhja e pagesës për ${order.id} u ruajt.`)} /></label>
                  <label className="wide">Shënim i stafit<textarea rows="2" defaultValue={order.staffNote || ""} placeholder="Vetëm për ekipin" onBlur={(e) => e.target.value !== (order.staffNote || "") && mutate("update_order", { order: { id: order.id, staffNote: e.target.value } }, `Shënimi i ${order.id} u ruajt.`)} /></label>
                </fieldset></div>
              </details>
            ))}
            {!orders.length && <EmptyState icon={ShoppingBag} title={queue || query ? 'Nuk ka porosi për këtë filtër' : 'Ende pa porosi'} copy={queue || query ? 'Pastroni filtrat për të parë listën e plotë.' : 'Kërkesat e dërguara nga shporta shfaqen këtu.'} />}
          </div>
        </PortalPanel>}

        {['Appointments','Contacts'].includes(section) && <PortalPanel title={`${portalLabel(section)} (${submissions.length})`} copy="Caktoni përgjegjësin, rikontaktin dhe shënimet e brendshme; aplikimi B2B nuk është partneritet i miratuar.">
          <div className="ops-appointment-list">
            {submissions.map((item) => (
              <article key={item.id}>
                <header>
                  <div><strong>{item.division === 'lab' && item.organization ? item.organization : item.name}</strong>{item.division === 'lab' && item.organization && <span>Personi i kontaktit: {item.name}</span>}<span>{[item.phone, item.email].filter(Boolean).join(' · ') || 'Pa kontakt të regjistruar'}</span><small>{divisionName(item.division)} · {item.division === 'lab' ? labMarketLabel(item) : item.service || item.type} · {item.id}</small></div>
                  <label>Statusi i kërkesës<select aria-label={`Statusi i kërkesës ${item.id}`} disabled={busy} value={item.status || "New"} onChange={(e) => mutate("update_submission", { submission: { id: item.id, status: e.target.value } }, "Kërkesa u përditësua.")}>{["New", "Contacted", "Confirmed", "Completed", "Closed"].map((value) => <option key={value} value={value}>{enquiryStatusLabel(item, value)}</option>)}</select></label>
                </header>
                <div className="ops-appointment-request"><CalendarDays size={17} /><span><small>{item.division === 'lab' ? 'APLIKIM B2B' : item.type === 'enquiry' ? 'KËRKESË PËR KONTAKT' : 'KOHA E KËRKUAR'}</small><strong>{item.division === 'lab' ? labInterestLabels[item.interest] || item.service || 'Bashkëpunim B2B' : item.type === 'enquiry' ? divisionName(item.division) : `${item.preferredDate || 'Pa datë'} · ${item.preferredTime || 'Pa orë'}`}</strong></span><p>{item.division === 'lab' ? 'Sqaroni nevojën, dokumentacionin dhe kushtet drejtpërdrejt me biznesin.' : item.type === 'enquiry' ? item.message || 'Kontaktoni personin për të sqaruar kërkesën. Nuk është takim apo porosi e konfirmuar.' : item.message || 'Pa shënim nga klienti.'}</p></div>
                {item.division === 'lab' && <LabApplicationDetails item={item} />}
                <div className="ops-appointment-controls">
                  <label>Përgjegjësi<input maxLength="120" defaultValue={item.assignedTo || ""} placeholder="Emri i stafit" onBlur={(e) => e.target.value !== (item.assignedTo || "") && mutate("update_submission", { submission: { id: item.id, assignedTo: e.target.value } }, "Përgjegjësi u ruajt.")} /></label>
                  <label>{item.type === 'enquiry' ? 'Data e rikontaktit' : 'Data e konfirmuar'}<input type="date" defaultValue={item.confirmedDate || ""} onBlur={(e) => e.target.value !== (item.confirmedDate || "") && mutate("update_submission", { submission: { id: item.id, confirmedDate: e.target.value } }, "Data u ruajt.")} /></label>
                  <label>{item.type === 'enquiry' ? 'Ora e rikontaktit' : 'Ora e konfirmuar'}<input type="time" defaultValue={item.confirmedTime || ""} onBlur={(e) => e.target.value !== (item.confirmedTime || "") && mutate("update_submission", { submission: { id: item.id, confirmedTime: e.target.value } }, "Ora u ruajt.")} /></label>
                  <label className="wide">Shënim i brendshëm<textarea maxLength="800" rows="2" defaultValue={item.internalNote || ""} placeholder="Përgatitja, rikontakti ose udhëzimi për ekipin" onBlur={(e) => e.target.value !== (item.internalNote || "") && mutate("update_submission", { submission: { id: item.id, internalNote: e.target.value } }, "Shënimi u ruajt.")} /></label>
                </div>
              </article>
            ))}
            {!submissions.length && <EmptyState icon={CalendarDays} title={queue || query ? 'Nuk ka kërkesa për këtë filtër' : 'Ende pa kërkesa'} copy={queue || query ? 'Pastroni filtrat për të parë listën e plotë.' : 'Kërkesat nga Optical, Optical Lab dhe Klinika shfaqen këtu.'} />}
          </div>
        </PortalPanel>}

        {section === "Clients" && <div className="ops-client-sections">
          <PortalPanel title={`Llogaritë e klientëve (${customerAccounts.length})`} copy="Hyrjet e regjistruara në faqen publike. Fjalëkalimet nuk shfaqen në portal.">
            <div className="ops-client-grid">{customerAccounts.map((account) => <article key={account.id}><div className="ops-avatar">{`${account.firstName || ""} ${account.lastName || ""}`.trim().split(" ").map((part) => part[0]).join("").slice(0, 2) || "LL"}</div><div><strong>{account.firstName} {account.lastName}</strong><span>{account.email} · {account.phone || "Pa telefon"}</span><small>Llogari {account.mustChangePassword ? "testuese · kërkon ndryshim fjalëkalimi" : "e regjistruar"} · Krijuar {account.createdAt?.slice(0, 10) || "—"}</small></div><label>Hyrja<select value={account.status || "Active"} onChange={(e) => mutate("update_customer_account", { id: account.id, status: e.target.value }, "Qasja e llogarisë u përditësua.")}>{["Active", "Disabled"].map((value) => <option key={value} value={value}>{portalLabel(value)}</option>)}</select></label></article>)}{!customerAccounts.length && <EmptyState icon={LockKeyhole} title="Ende pa llogari" copy="Llogaria e parë shfaqet pasi një klient regjistrohet." />}</div>
          </PortalPanel>
          <PortalPanel title={`Regjistri i klientëve (${clients.length})`} copy="Regjistri CRM krijohet nga porositë reale; shënimet janë të brendshme.">
            <div className="ops-client-grid">{clients.map((client) => <article key={client.id}><div className="ops-avatar">{client.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><strong>{client.name}</strong><span>{client.email || "Pa email"} · {client.phone || "Pa telefon"}</span><small>{client.orders || 0} porosi · {euro(client.spend)} të përfunduara · {euro(client.requestValue || 0)} aktive · Receta: {portalLabel(client.prescription || "—")}</small></div><label>Statusi<select value={client.status || "Active"} onChange={(e) => mutate("update_customer", { customer: { id: client.id, status: e.target.value } }, "Klienti u përditësua.")}>{["Active", "Follow-up", "Needs review", "VIP", "Inactive"].map((value) => <option key={value} value={value}>{portalLabel(value)}</option>)}</select></label><button className="danger ops-client-delete" aria-label={`Anonimizo ${client.name}`} onClick={() => window.confirm(`Anonimizoni të dhënat personale të ${client.name}? Llogaria e hyrjes me të njëjtin email hiqet; vlerat financiare ruhen pa identitet.`) && mutate("delete_customer", { id: client.id }, "Të dhënat personale u anonimizuan.")}><Trash2 size={16} /></button></article>)}{!clients.length && <EmptyState icon={Users} title="Ende pa klientë" copy="Klienti i parë krijohet kur dorëzohet një porosi." />}</div>
          </PortalPanel>
        </div>}

        {section === "Content" && <PortalPanel title="Përmbajtja dhe SEO" copy={`Menaxhoni tekstet publike dhe paraqitjen në kërkim. Publikimi i fundit: ${data.content?.updatedAt ? new Date(data.content.updatedAt).toLocaleString("sq-AL") : "versioni fillestar"}.`} action={<button onClick={() => navigate("home")}><Eye size={15} /> Parapamje publike</button>}>
          <form className="ops-form content" onSubmit={(event) => { event.preventDefault(); mutate("save_content_draft", { content: data.content, revision: data.cms?.draft?.revision || '' }, "Drafti u ruajt. Faqja publike nuk ka ndryshuar."); }}>
            <details className="ops-content-disclosure"><summary>Optical · faqja /optical<ChevronDown size={18}/></summary><fieldset className="ops-content-group">
              <legend className="sr-only">Optical · faqja /optical</legend>
              <label>Titulli kryesor<input value={data.content.heroTitle || ""} onChange={(e) => updateContent("heroTitle", e.target.value)} /></label>
              <label>Përshkrimi<textarea rows="3" value={data.content.heroSubtitle || ""} onChange={(e) => updateContent("heroSubtitle", e.target.value)} /></label>
              <div className="ops-form-grid"><label>Butoni kryesor<input value={data.content.primaryCta || ""} onChange={(e) => updateContent("primaryCta", e.target.value)} /></label><label>Butoni dytësor<input value={data.content.secondaryCta || ""} onChange={(e) => updateContent("secondaryCta", e.target.value)} /></label></div>
              <label>Shiriti informues<input value={data.content.announcement || ""} onChange={(e) => updateContent("announcement", e.target.value)} /></label>
              <label>Titulli SEO<input maxLength="220" value={data.content.homeSeoTitle || ""} onChange={(e) => updateContent("homeSeoTitle", e.target.value)} /><small>{(data.content.homeSeoTitle || "").length}/220</small></label>
              <label>Përshkrimi SEO<textarea rows="3" maxLength="500" value={data.content.homeSeoDescription || ""} onChange={(e) => updateContent("homeSeoDescription", e.target.value)} /><small>{(data.content.homeSeoDescription || "").length}/500</small></label>
            </fieldset></details>
            <div className="ops-content-pages">
              {pageContentGroups.map(([label, titleKey, subtitleKey, seoTitleKey, seoDescriptionKey]) => (
                <details className="ops-content-disclosure" key={titleKey}><summary>{label}<ChevronDown size={18}/></summary><fieldset className="ops-content-group">
                  <legend className="sr-only">{label}</legend>
                  <label>Titulli<input lang={titleKey === 'labEuropeTitle' ? 'en' : 'sq'} value={data.content[titleKey] || ""} onChange={(e) => updateContent(titleKey, e.target.value)} /></label>
                  <label>Përshkrimi<textarea lang={titleKey === 'labEuropeTitle' ? 'en' : 'sq'} rows="3" value={data.content[subtitleKey] || ""} onChange={(e) => updateContent(subtitleKey, e.target.value)} /></label>
                  <label>Titulli SEO<input lang={titleKey === 'labEuropeTitle' ? 'en' : 'sq'} maxLength="220" value={data.content[seoTitleKey] || ""} onChange={(e) => updateContent(seoTitleKey, e.target.value)} /><small>{(data.content[seoTitleKey] || "").length}/220</small></label>
                  <label>Përshkrimi SEO<textarea lang={titleKey === 'labEuropeTitle' ? 'en' : 'sq'} rows="3" maxLength="500" value={data.content[seoDescriptionKey] || ""} onChange={(e) => updateContent(seoDescriptionKey, e.target.value)} /><small>{(data.content[seoDescriptionKey] || "").length}/500</small></label>
                </fieldset></details>
              ))}
            </div>
            <details className="ops-content-disclosure"><summary>Optical Lab · dokumentacioni teknik<ChevronDown size={18} /></summary><fieldset className="ops-content-group">
              <legend className="sr-only">Njoftimi për dokumentacionin teknik</legend>
              <p>Ky tekst shfaqet në faqet e tregjeve përkatëse. Publikoni emra certifikatash, standarde, organe lëshuese ose data vlefshmërie vetëm pasi dokumentet dhe fusha e tyre të jenë verifikuar. Kërkesa për dokumentacion nuk është deklaratë certifikimi.</p>
              <label>Njoftimi · shqip<textarea lang="sq" rows="3" maxLength="1400" value={data.content.labDocumentationNoteSq || ''} onChange={(event) => updateContent('labDocumentationNoteSq', event.target.value)} /></label>
              <label>Njoftimi · anglisht<textarea lang="en" rows="3" maxLength="1400" value={data.content.labDocumentationNoteEn || ''} onChange={(event) => updateContent('labDocumentationNoteEn', event.target.value)} /></label>
            </fieldset></details>
            <details className="ops-content-disclosure"><summary>Fotografitë e faqeve<ChevronDown size={18}/></summary><fieldset className="ops-content-group"><legend className="sr-only">Fotografitë · zëvendësimi i vizualeve ilustruese</legend><p>Fotografitë e fushatës janë ilustruese. Ngarkoni fotografitë tuaja për ekipin, ambientin dhe punimin real. Ngarkimi nuk publikohet pa ruajtur ndryshimet.</p><div className="ops-media-grid">{Object.entries(editorialMedia).map(([key, [title, fallback]]) => <div className="ops-media-card" key={key}><img src={safeEditorialImage(data.content[key]) || fallback} alt={title} loading="lazy" /><strong>{title}</strong><label>Fotografi e re<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { uploadContentImage(key, event.target.files?.[0]); event.target.value = ''; }} /></label><button type="button" disabled={busy || !data.content[key]} onClick={() => updateContent(key, '')}>Rikthe imazhin e fushatës</button></div>)}</div></fieldset></details>
            <div className="cms-publish-bar"><span>{contentDirty ? 'Ndryshime të paruajtura' : data.cms?.draft?.revision ? 'Draft i ruajtur · ende jo publik' : 'Po redaktoni versionin publik'}</span><button disabled={busy || !canCms(data.cms?.permissions, 'content.write')}><Save size={17} /> Ruaj draftin</button><button type="button" disabled={busy || contentDirty || !data.cms?.draft?.revision || !canCms(data.cms?.permissions, 'content.publish')} onClick={() => mutate('publish_content', { revision: data.cms.draft.revision }, 'Përmbajtja u publikua.')}>Publiko draftin</button></div>
          </form>
        </PortalPanel>}

        {section === "Discounts" && <div className="ops-split products">
          <PortalPanel title="Kodi i zbritjes" copy="Përqindja llogaritet gjithmonë nga serveri sipas fushës së zgjedhur.">
            <form className="ops-form" onSubmit={async (event) => {
              event.preventDefault();
              const result = await mutate("save_campaign", { campaign: campaignDraft }, `Kodi ${campaignDraft.code.toUpperCase()} u ruajt.`);
              if (result) setCampaignDraft({ code: "", value: "", scope: "Entire order", active: true, channel: "Checkout" });
            }}>
              <div className="ops-form-grid"><label>Kodi<input required maxLength="40" value={campaignDraft.code} onChange={(e) => setCampaignDraft({ ...campaignDraft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="MIFTARI15" /></label><label>Vlera<input required value={campaignDraft.value} onChange={(e) => setCampaignDraft({ ...campaignDraft, value: e.target.value })} placeholder="15% ose Falas" /></label></div>
              <label>Fusha<select value={campaignDraft.scope} onChange={(e) => setCampaignDraft({ ...campaignDraft, scope: e.target.value })}>{["Entire order", "Lens packages", "Polarized sunglasses"].map((value) => <option key={value} value={value}>{portalLabel(value)}</option>)}</select></label>
              <label className="ops-check"><input type="checkbox" checked={campaignDraft.active} onChange={(e) => setCampaignDraft({ ...campaignDraft, active: e.target.checked })} /> Kodi është aktiv në porosinë online</label>
              <button disabled={busy}><Save size={17} /> Ruaj kodin</button>
            </form>
          </PortalPanel>
          <PortalPanel title={`Kodet (${(data.campaigns || []).length})`} copy="Klikoni një kod për ta ndryshuar, aktivizuar ose çaktivizuar.">
            <div className="ops-product-list">{(data.campaigns || []).map((campaign) => <article key={campaign.code}><div className="ops-discount-mark">%</div><div><strong>{campaign.code}</strong><span>{campaign.value} · {portalLabel(campaign.scope)}</span><small>{campaign.active ? "Aktiv" : "Joaktiv"} · {campaign.channel === "Checkout" ? "Porosia online" : campaign.channel}</small></div><button aria-label={`Redakto ${campaign.code}`} onClick={() => setCampaignDraft({ ...campaign })}><Settings size={17} /></button></article>)}</div>
          </PortalPanel>
        </div>}

        {section === "Analytics" && <div className="ops-analytics-grid">
          <div className="ops-kpis compact"><article><span>Shikime 24h</span><strong>{data.analytics.pageviews24h}</strong><small>Ngarkime faqesh</small></article><article><span>Veprime 24h</span><strong>{data.analytics.actions24h}</strong><small>Klikime, takime, porosi</small></article><article><span>Evente 7 ditë</span><strong>{data.analytics.events7d}</strong><small>Sinjale të ruajtura</small></article></div>
          <PortalPanel title="Faqet kryesore" copy="Shtatë ditët e fundit"><div className="ops-signal-list">{Object.entries(data.analytics.topPages || {}).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}{!Object.keys(data.analytics.topPages || {}).length && <EmptyState icon={BarChart3} title="Ende pa trafik" copy="Të dhënat mblidhen pas publikimit." />}</div></PortalPanel>
          <PortalPanel title="Veprimet kryesore" copy="Shtatë ditët e fundit"><div className="ops-signal-list">{Object.entries(data.analytics.topEvents || {}).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}{!Object.keys(data.analytics.topEvents || {}).length && <EmptyState icon={Activity} title="Ende pa veprime" copy="Klikimet dhe dërgimet e formularëve shfaqen këtu." />}</div></PortalPanel>
        </div>}

        {section === "Audit" && <PortalPanel title={`Historiku i veprimeve (${(data.audit || []).length})`} copy="Gjurmë operative për hyrjet, ndryshimet e porosive, stokut, klientëve dhe përmbajtjes.">
          <div className="ops-audit-list">
            {(data.audit || []).map((entry) => (
              <article key={entry.id}>
                <History size={17} />
                <div><strong>{String(entry.action || "veprim").replaceAll("_", " ")}</strong><span>{entry.entity || "sistem"}{entry.entityId ? ` · ${entry.entityId}` : ""}</span></div>
                <div><strong>{entry.user || "sistem"}</strong><time>{entry.time ? new Date(entry.time).toLocaleString("sq-AL") : "—"}</time></div>
              </article>
            ))}
            {!(data.audit || []).length && <EmptyState icon={History} title="Ende pa veprime" copy="Veprimet e stafit dhe sistemit do të regjistrohen këtu." />}
          </div>
        </PortalPanel>}

        {section === "Settings" && <div className="ops-settings-grid">
          <PortalPanel title="Ndrysho fjalëkalimin" copy="Përdorni të paktën 12 karaktere dhe mos e ndani me persona të paautorizuar.">
            <form className="ops-form" onSubmit={async (event) => { event.preventDefault(); if (passwordDraft.newPassword !== passwordDraft.confirmPassword) { setError("Konfirmimi nuk përputhet me fjalëkalimin e ri."); return; } const result = await mutate("change_password", passwordDraft, "Fjalëkalimi u ndryshua."); if (result) setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" }); }}>
              <label>Fjalëkalimi aktual<input type="password" required autoComplete="current-password" value={passwordDraft.currentPassword} onChange={(e) => setPasswordDraft({ ...passwordDraft, currentPassword: e.target.value })} /></label>
              <label>Fjalëkalimi i ri<input type="password" required minLength="12" autoComplete="new-password" value={passwordDraft.newPassword} onChange={(e) => setPasswordDraft({ ...passwordDraft, newPassword: e.target.value })} /></label>
              <label>Konfirmo fjalëkalimin<input type="password" required minLength="12" autoComplete="new-password" value={passwordDraft.confirmPassword} onChange={(e) => setPasswordDraft({ ...passwordDraft, confirmPassword: e.target.value })} /></label>
              <button disabled={busy}><LockKeyhole size={17} /> Përditëso fjalëkalimin</button>
            </form>
          </PortalPanel>
          <PortalPanel title="Gjendja e sistemit" copy="Kontrolle operative për instalimin në Hostinger.">
            <div className="ops-system-list"><div><Check size={17} /><span><strong>Ruajtja në server</strong><small>PHP + skedarë JSON me bllokim shkrimi</small></span></div><div><Check size={17} /><span><strong>Sesioni i sigurt</strong><small>HttpOnly · SameSite Strict · CSRF</small></span></div><div><Check size={17} /><span><strong>Kërkesat publike</strong><small>Kufizim ritmi · honeypot · validim serveri</small></span></div><div><Check size={17} /><span><strong>Ngarkimi i mediave</strong><small>JPG · PNG · WEBP · maksimumi 5 MB</small></span></div></div>
          </PortalPanel>
        </div>}
      </section>
    </div>
  );
}
