import { useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CreditCard, Eye, LockKeyhole, LogOut, MapPin, PackageCheck, RefreshCw, Search, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import { accountOrderMatches, isOrderClosed, isOrderReady, isAppointmentOpen, orderNextStep } from './servicePresentation.js';
import { accountIdentity, emptyAccountData, accountDataForSession, mergeAccountData, accountPaymentUrl } from './accountState.js';
import { getLanguage } from './i18n/locale.js';
import EditorialImage from './EditorialImage.jsx';

const initialLogin = { email: "", password: "" };
const initialRegister = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  termsAccepted: false,
  marketingConsent: false
};

const accountError = (code) => ({
  invalid_credentials: "Emaili ose fjalëkalimi nuk është i saktë.",
  too_many_attempts: "Ka pasur shumë tentativa. Provoni përsëri pas pak minutash.",
  invalid_email: "Shkruani një adresë emaili të vlefshme.",
  profile_fields_required: "Plotësoni emrin, mbiemrin dhe telefonin.",
  terms_required: "Duhet të pranoni politikat e privatësisë dhe kushtet.",
  weak_password: "Përdorni të paktën 12 karaktere, me shkronjë të madhe, të vogël, numër dhe simbol.",
  email_already_registered: "Ky email ka një llogari. Kaloni te hyrja.",
  current_password_incorrect: "Fjalëkalimi aktual nuk është i saktë.",
  password_unchanged: "Fjalëkalimi i ri duhet të jetë ndryshe.",
  authentication_required: "Sesioni ka përfunduar. Hyni përsëri.",
  invalid_csrf_token: "Sesioni i sigurisë skadoi. Rifreskoni faqen dhe provoni përsëri.",
  invalid_contact_preference: "Zgjidhni WhatsApp, telefon ose email si kontakt të preferuar."
}[code] || "Veprimi nuk u përfundua. Provoni përsëri.");

const requestAccount = async ({ method = "GET", resource = "session", payload, csrf = "", signal } = {}) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(`/api/account.php?resource=${encodeURIComponent(resource)}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: payload ? { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) } : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    });
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json") ? await response.json() : { ok: false, error: "service_unavailable" };
    if (!response.ok || !result.ok) {
      const error = new Error(accountError(result.error));
      error.code = result.error || "service_unavailable";
      throw error;
    }
    return result;
  } catch (failure) {
    if (signal?.aborted) throw failure;
    if (controller.signal.aborted) throw new Error('Shërbimi nuk u përgjigj në kohë. Provoni përsëri; të dhënat e formularit nuk janë fshirë.');
    if (failure instanceof TypeError || failure instanceof SyntaxError) throw new Error('Nuk u lidhëm me shërbimin. Kontrolloni internetin dhe provoni përsëri. Të dhënat e formularit nuk janë fshirë.');
    throw failure;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
};

const money = (amount) => new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(Number(amount || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && getLanguage() === 'en') return new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(date);
  const months = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gush', 'sht', 'tet', 'nën', 'dhj'];
  return Number.isNaN(date.getTime()) ? value : `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

const profileToForm = (profile = {}) => ({
  firstName: profile.firstName || "",
  lastName: profile.lastName || "",
  phone: profile.phone || "",
  address: profile.address || "",
  city: profile.city || "",
  postcode: profile.postcode || "",
  country: profile.country || "Kosovë",
  contactPreference: profile.contactPreference || "WhatsApp",
  marketingConsent: Boolean(profile.marketingConsent)
});

const statusLabel = (value) => ({
  Pending: "Në pritje",
  Confirmed: "E konfirmuar",
  "In lab": "Në laborator",
  Ready: "Gati",
  Completed: "E përfunduar",
  Cancelled: "E anuluar",
  Returned: "E kthyer",
  "Return requested": "Kthimi në shqyrtim",
  "Awaiting confirmation": "Në verifikim",
  "Awaiting payment": "Në pritje të pagesës",
  "Partially paid": "Pjesërisht e paguar",
  Paid: "E paguar",
  Refunded: "E rimbursuar",
  Uploaded: "E ngarkuar",
  "Manual entry": "E shkruar manualisht",
  "Send later": "Dërgohet më vonë",
  "Awaiting optical review": "Për t’u verifikuar nga optiku",
  None: "Nuk kërkohet",
  Unfulfilled: "Për t’u përgatitur",
  Processing: "Në përgatitje",
  "Ready for pickup": "Gati për marrje",
  Shipped: "E dërguar",
  Delivered: "E dorëzuar",
  New: "E re",
  Contacted: "E kontaktuar",
  Closed: "E mbyllur"
}[value] || value || "—");

const orderProgress = (order) => {
  if (["Cancelled", "Returned"].includes(order.status)) return 0;
  if (order.status === "Completed" || order.fulfillmentStatus === "Delivered") return 4;
  if (["Ready", "Shipped"].includes(order.status) || ["Ready for pickup", "Shipped"].includes(order.fulfillmentStatus)) return 3;
  if (["In lab", "Processing"].includes(order.status) || order.fulfillmentStatus === "Processing") return 2;
  if (order.status === "Confirmed") return 1;
  return 0;
};

export default function AccountPage({ navigate, session, onSessionChange, content = {} }) {
  const [mode, setMode] = useState(() => typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/register' ? 'register' : 'login');
  const [login, setLogin] = useState(initialLogin);
  const [registration, setRegistration] = useState(initialRegister);
  const profile = session?.profile || null;
  const [accountData, setAccountData] = useState(() => emptyAccountData(accountIdentity(session)));
  const [profileForm, setProfileForm] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState('orders');
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderQuery, setOrderQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const profileRequest = useRef(null);
  const currentIdentity = useRef(accountIdentity(session));
  currentIdentity.current = accountIdentity(session);
  const { orders, appointments, loaded } = accountDataForSession(accountData, session);

  const clearPrivateState = () => {
    profileRequest.current?.abort();
    setAccountData(emptyAccountData());
    setProfileForm(null);
    setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setOrderQuery('');
    setOrderFilter('all');
    setRefreshing(false);
  };

  const handleFailure = (requestError) => {
    setError(requestError.message);
    if (requestError.code === 'authentication_required') {
      clearPrivateState();
      onSessionChange({ authenticated: false, profile: null, csrf: '' });
    }
  };

  const applySession = (result, preserveForm = false) => {
    const next = {
      authenticated: Boolean(result.authenticated),
      profile: result.profile || null,
      csrf: result.csrf || ""
    };
    onSessionChange(next);
    if (next.profile && !preserveForm) {
      setProfileForm(profileToForm(next.profile));
    }
    setAccountData((previous) => mergeAccountData(previous, next.authenticated ? { ...result, ...next } : next));
  };

  const loadProfile = async () => {
    const accountId = accountIdentity(session);
    if (!accountId) return;
    profileRequest.current?.abort();
    const controller = new AbortController();
    profileRequest.current = controller;
    setRefreshing(true); setError('');
    try {
      const result = await requestAccount({ resource: "profile", signal: controller.signal });
      if (controller.signal.aborted || currentIdentity.current !== accountId) return;
      applySession(result, true);
    } catch (requestError) {
      if (controller.signal.aborted || currentIdentity.current !== accountId) return;
      handleFailure(requestError);
    } finally { if (profileRequest.current === controller) setRefreshing(false); }
  };

  useEffect(() => {
    if (session?.profile) {
      setProfileForm(profileToForm(session.profile));
    }
    setAccountData(emptyAccountData(accountIdentity(session)));
    setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setOrderQuery(''); setOrderFilter('all');
    if (session?.authenticated) loadProfile();
    else clearPrivateState();
    return () => profileRequest.current?.abort();
  }, [session?.authenticated, session?.profile?.id]);

  const submitLogin = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await requestAccount({ method: "POST", payload: { action: "login", ...login } });
      applySession(result);
      setLogin(initialLogin);
      setMessage(result.profile?.mustChangePassword ? "Hyrja u krye. Ndryshoni fjalëkalimin e përkohshëm." : "Mirë se erdhët në llogarinë tuaj.");
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (requestError) {
      handleFailure(requestError);
    } finally { setBusy(false); }
  };

  const submitRegistration = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await requestAccount({ method: "POST", payload: { action: "register", ...registration } });
      applySession(result);
      setRegistration(initialRegister);
      setMessage("Llogaria u krijua dhe jeni kyçur.");
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (requestError) {
      handleFailure(requestError);
    } finally { setBusy(false); }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    profileRequest.current?.abort(); setRefreshing(false);
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await requestAccount({ method: "POST", csrf: session.csrf, payload: { action: "update_profile", ...profileForm } });
      applySession({ ...result, authenticated: true });
      setMessage("Të dhënat u ruajtën.");
      if (!loaded) loadProfile();
    } catch (requestError) { handleFailure(requestError); }
    finally { setBusy(false); }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("Fjalëkalimet e reja nuk përputhen.");
      return;
    }
    profileRequest.current?.abort(); setRefreshing(false);
    setBusy(true);
    try {
      const result = await requestAccount({
        method: "POST",
        csrf: session.csrf,
        payload: { action: "change_password", currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }
      });
      applySession({ ...result, authenticated: true }, true);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Fjalëkalimi u ndryshua me sukses.");
      if (!loaded) loadProfile();
    } catch (requestError) { handleFailure(requestError); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    profileRequest.current?.abort();
    setRefreshing(false);
    setBusy(true); setError("");
    try {
      await requestAccount({ method: "POST", csrf: session.csrf, payload: { action: "logout" } });
      onSessionChange({ authenticated: false, profile: null, csrf: "" });
      clearPrivateState(); setMode("login"); setMessage("Dolët nga llogaria.");
    } catch (requestError) { handleFailure(requestError); }
    finally { setBusy(false); }
  };

  if (!session?.authenticated || !profile) {
    return (
      <section className="account-page account-auth-page">
        <div className="account-auth-intro">
          <span className="eyebrow"><UserRound size={15} /> LLOGARIA IME</span>
          <h1>Mirë se vini në llogarinë tuaj.</h1>
          <p>Ndiqni porositë, shihni kërkesat për takime dhe mbani të përditësuar kontaktin tuaj.</p>
          <ul>
            <li><CheckCircle2 size={17} /> Historiku privat i porosive</li>
            <li><CheckCircle2 size={17} /> Kontakti gati për porosinë</li>
            <li><CheckCircle2 size={17} /> Statusi i përditësuar nga optika</li>
          </ul>
          <figure className="account-editorial-photo"><EditorialImage name="groupSunImage" value={content.groupSunImage} alt="Fushatë ilustruese me syze dielli" /><figcaption>Imazh ilustrues</figcaption></figure>
        </div>
        <div className="account-auth-card">
          <div className="account-mode-tabs" role="group" aria-label="Hyrje ose regjistrim">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }} aria-pressed={mode === "login"}>Hyr</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }} aria-pressed={mode === "register"}>Krijo llogari</button>
          </div>
          {message && <div className="account-message success" role="status">{message}</div>}
          {error && <div className="account-message error" role="alert">{error}</div>}
          {mode === "login" ? (
            <form className="account-form" onSubmit={submitLogin}>
              <div><h2>Mirë se u kthyet</h2><p>Përdorni emailin dhe fjalëkalimin tuaj.</p></div>
              <label>Emaili<input type="email" autoComplete="email" required value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></label>
              <label>Fjalëkalimi<input type="password" autoComplete="current-password" required value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>
              <button className="primary-button" disabled={busy}>{busy ? "Duke hyrë…" : <>Hyr në llogari <ChevronRight size={17} /></>}</button>
              <p className="account-form-note"><ShieldCheck size={15} /> Për të porositur nuk është e nevojshme të krijoni llogari.</p><div className="account-access-help"><span>Nuk mund të hyni?</span><a href="tel:+38343777667">Kontaktoni optikën për ndihmë</a><button type="button" onClick={() => navigate("orderStatus")}>Gjurmo porosinë pa llogari <ChevronRight size={15}/></button></div>
            </form>
          ) : (
            <form className="account-form" onSubmit={submitRegistration}>
              <div><h2>Krijoni llogarinë</h2><p>Plotësoni të dhënat që përdorni për porositë.</p></div>
              <div className="account-field-row">
                <label>Emri<input autoComplete="given-name" required value={registration.firstName} onChange={(event) => setRegistration({ ...registration, firstName: event.target.value })} /></label>
                <label>Mbiemri<input autoComplete="family-name" required value={registration.lastName} onChange={(event) => setRegistration({ ...registration, lastName: event.target.value })} /></label>
              </div>
              <label>Emaili<input type="email" autoComplete="email" required value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} /></label>
              <label>Telefoni<input type="tel" autoComplete="tel" required value={registration.phone} onChange={(event) => setRegistration({ ...registration, phone: event.target.value })} /></label>
              <label>Fjalëkalimi<input type="password" autoComplete="new-password" minLength="12" required value={registration.password} onChange={(event) => setRegistration({ ...registration, password: event.target.value })} /><small>12+ karaktere, me shkronjë të madhe, të vogël, numër dhe simbol.</small></label>
              <label className="account-check"><input type="checkbox" required checked={registration.termsAccepted} onChange={(event) => setRegistration({ ...registration, termsAccepted: event.target.checked })} /><span>Pranoj <a href="/policies" target="_blank" rel="noopener noreferrer">privatësinë dhe kushtet (hapet veçmas)</a>.</span></label>
              <label className="account-check"><input type="checkbox" checked={registration.marketingConsent} onChange={(event) => setRegistration({ ...registration, marketingConsent: event.target.checked })} /><span>Dua të marr njoftime dhe këshilla optike. Opsionale.</span></label>
              <button className="primary-button" disabled={busy}>{busy ? "Duke krijuar…" : <>Krijo llogarinë <ChevronRight size={17} /></>}</button>
            </form>
          )}
        </div>
      </section>
    );
  }

  const activeOrders = orders.filter((order) => !isOrderClosed(order)).length;
  const readyOrders = orders.filter(isOrderReady).length;
  const openAppointments = appointments.filter(isAppointmentOpen).length;
  const visibleOrders = orders.filter((order) => accountOrderMatches(order, orderFilter, orderQuery));

  return (
    <section className="account-page account-dashboard">
      <header className="account-dashboard-head">
        <div><span className="eyebrow">LLOGARIA IME</span><h1>Përshëndetje, {profile.firstName}.</h1><p>Porositë, kërkesat për takime dhe profili juaj. Zgjidhni çfarë dëshironi të shihni.</p></div>
        <div className="account-head-actions"><button className="secondary-button" onClick={loadProfile} disabled={busy || refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} />{refreshing ? 'Po rifreskohet…' : 'Rifresko'}</button><button className="secondary-button" onClick={logout} disabled={busy}><LogOut size={16} /> Dil</button></div>
      </header>
      {profile.mustChangePassword && <div className="account-security-alert"><LockKeyhole size={20} /><div><strong>Ndryshoni fjalëkalimin e përkohshëm.</strong><span>Zgjidhni një fjalëkalim personal përpara se të vazhdoni.</span></div><button onClick={() => setSection('security')}>Ndrysho tani</button></div>}
      {message && <div className="account-message success" role="status">{message}</div>}
      {error && <div className="account-message error" role="alert">{error}</div>}
      <div className="account-summary-grid" aria-label="Përmbledhja e llogarisë">
        <button onClick={() => { setSection('orders'); setOrderFilter('active'); setOrderQuery(''); }}><ShoppingBag size={19} /><span><small>POROSI AKTIVE</small><strong>{loaded ? activeOrders : '—'}</strong></span><ChevronRight size={16} /></button>
        <button onClick={() => { setSection('orders'); setOrderFilter('ready'); setOrderQuery(''); }}><PackageCheck size={19} /><span><small>GATI PËR DORËZIM</small><strong>{loaded ? readyOrders : '—'}</strong></span><ChevronRight size={16} /></button>
        <button onClick={() => setSection('appointments')}><CalendarDays size={19} /><span><small>KËRKESA TË HAPURA</small><strong>{loaded ? openAppointments : '—'}</strong></span><ChevronRight size={16} /></button>
      </div>
      <nav className="account-workspace-nav" aria-label="Menaxho llogarinë">{[['orders', ShoppingBag, 'Porositë'], ['appointments', CalendarDays, 'Terminet'], ['profile', UserRound, 'Profili'], ['security', LockKeyhole, 'Siguria']].map(([id, Icon, title]) => <button key={id} aria-pressed={section === id} onClick={() => setSection(id)}><Icon size={17} />{title}</button>)}</nav>
      <div className="account-workspace">
        <div className="account-main-column" hidden={!['orders', 'appointments'].includes(section)}>
          <section className="account-panel" hidden={section !== 'orders'} aria-busy={refreshing}>
            <div className="account-panel-head"><div><span>POROSITË</span><h2>Historiku juaj</h2></div><b>{orders.length}</b></div>
            <div className="account-order-tools"><label><Search size={16} /><input type="search" aria-label="Kërko porosinë ose produktin" placeholder="Kodi i porosisë ose modeli" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} /></label><select aria-label="Filtro porositë" value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="all">Të gjitha</option><option value="active">Aktive</option><option value="ready">Gati</option><option value="history">Të mbyllura</option></select></div>
            <div className="account-orders">
              {visibleOrders.map((order) => (
                <details className="account-order" key={order.id}>
                  <summary><div><span>{order.id}</span><strong>{order.product || 'Porosi optike'}</strong><small>{formatDate(order.createdAt || order.date)}</small></div><div><b>{money(order.total)}</b><span className={`account-status status-${String(order.status || 'pending').toLowerCase().replaceAll(' ', '-')}`}>{statusLabel(order.status || 'Pending')}</span></div><ChevronDown size={18} /></summary>
                  <p className="account-next-step">{orderNextStep(order)}</p>
                  {!['Cancelled', 'Returned', 'Return requested'].includes(order.status) && <div className="account-order-progress" aria-label={`Progresi i ${order.id}`}>
                    {["Kërkesa", "Konfirmuar", "Punim", "Gati", "Dorëzuar"].map((label, index) => <span key={label} className={index <= orderProgress(order) ? "complete" : ""}><i />{label}</span>)}
                  </div>}
                  {order.items?.length > 0 && <ul className="account-order-lines">{order.items.map((item, index) => <li key={`${item.productId}-${index}`}><span><strong>{item.name}</strong><small>{item.sku} · {item.quantity} × {money(item.unitPrice)}</small>{item.configuration?.lensPackage && <small>{item.configuration.lensPackage}</small>}</span><b>{money(item.lineTotal)}</b></li>)}</ul>}
                  <div className="account-order-costs"><span>Dërgesa: {money(order.shippingFee)}</span>{Number(order.discount) > 0 && <span>Zbritja: −{money(order.discount)}</span>}<strong>Gjithsej: {money(order.total)}</strong></div>
                  <dl className="account-order-details">
                    <div><dt><CreditCard size={14} /> Pagesa</dt><dd>{statusLabel(order.paymentStatus || "Awaiting confirmation")}</dd></div>
                    <div><dt><PackageCheck size={14} /> Dorëzimi</dt><dd>{statusLabel(order.fulfillmentStatus || "Unfulfilled")}</dd></div>
                    <div><dt><Eye size={14} /> Receta</dt><dd>{statusLabel(order.prescription || "None")}</dd></div>
                    <div><dt><MapPin size={14} /> Gjurmimi</dt><dd>{order.trackingNumber || "Shtohet kur dërgohet"}</dd></div>
                  </dl>
                  {accountPaymentUrl(order) && <a className="account-payment-link" href={accountPaymentUrl(order)} target="_blank" rel="noopener noreferrer"><CreditCard size={16} /> Hap lidhjen e pagesës <ChevronRight size={15} /></a>}
                  <a className="ed-link" href="tel:+38343777667">Ndihmë për këtë porosi · +383 43 777 667</a>
                </details>
              ))}
              {!loaded && <p role="status">{refreshing ? 'Po ngarkohen porositë…' : 'Të dhënat nuk u ngarkuan. Përdorni Rifresko për të provuar përsëri.'}</p>}
              {loaded && !orders.length && <div className="account-empty"><PackageCheck size={28} /><strong>Nuk ka ende porosi në këtë llogari.</strong><p>Porosia e ardhshme do të shfaqet këtu kur përfundoni porosinë pasi keni hyrë në llogari.</p><button className="primary-button" onClick={() => navigate("shop")}>Shiko kornizat</button></div>}
              {loaded && orders.length > 0 && !visibleOrders.length && <div className="account-empty compact"><strong>Nuk ka porosi për këtë kërkim.</strong><button className="secondary-button" onClick={() => { setOrderFilter('all'); setOrderQuery(''); }}>Pastro filtrat</button></div>}
            </div>
          </section>
          <section className="account-panel" hidden={section !== 'appointments'}>
            <div className="account-panel-head"><div><span>KUJDESI OPTIK</span><h2>Terminet dhe kërkesat</h2></div><b>{appointments.length}</b></div>
            <div className="account-appointments">
              {!loaded && <p role="status">{refreshing ? 'Po ngarkohen kërkesat për takime…' : 'Të dhënat nuk u ngarkuan. Përdorni Rifresko për të provuar përsëri.'}</p>}
              {appointments.map((item) => (
                <article key={item.id}>
                  <CalendarDays size={19} />
                  <div><strong>{item.service || "Kontroll optik"}</strong><span>{item.confirmedDate || item.preferredDate ? formatDate(item.confirmedDate || item.preferredDate) : 'Data konfirmohet nga ekipi'} · {item.confirmedTime || item.preferredTime || 'Ora në pritje'}</span><small>{item.status === 'Confirmed' ? 'Termin i konfirmuar' : isAppointmentOpen(item) ? 'Orari i kërkuar; pret konfirmimin e ekipit' : statusLabel(item.status)} · {item.id}</small></div>
                  <span className={`account-status status-${String(item.status || "new").toLowerCase()}`}>{statusLabel(item.status || "New")}</span>
                </article>
              ))}
              {loaded && !appointments.length && <div className="account-empty compact"><CalendarDays size={26} /><strong>Nuk keni ende kërkesë për termin.</strong><p>Rezervoni kontrollin ose përshtatjen; statusi shfaqet këtu pasi ekipi ta marrë kërkesën.</p><button className="primary-button" onClick={() => navigate("contact", undefined, "/contact#booking")}>Rezervo një kontroll</button></div>}
            </div>
          </section>
          <nav className="account-quick-actions" aria-label="Veprime të shpejta">
            <button onClick={() => navigate("shop")}><ShoppingBag size={18} /><span><strong>Bli korniza</strong><small>Katalogu i plotë</small></span><ChevronRight size={16} /></button>
            <button onClick={() => navigate("contact", undefined, "/contact#booking")}><CalendarDays size={18} /><span><strong>Rezervo kontroll</strong><small>Kërkesë për termin</small></span><ChevronRight size={16} /></button>
            <button onClick={() => navigate("fit")}><Eye size={18} /><span><strong>Provo në 3D</strong><small>Kamerë ose model</small></span><ChevronRight size={16} /></button>
            <button onClick={() => navigate("orderStatus")}><PackageCheck size={18} /><span><strong>Gjurmo porosinë</strong><small>Me kodin e porosisë</small></span><ChevronRight size={16} /></button>
          </nav>
        </div>
        <div className="account-settings-column" hidden={!['profile', 'security'].includes(section)}>
          <form className="account-panel account-form" hidden={section !== 'profile'} onSubmit={saveProfile}>
            <div><span className="account-section-label">PROFILI</span><h2>Të dhënat e kontaktit</h2><p>Emaili i llogarisë: <strong>{profile.email}</strong></p></div>
            <div className="account-field-row">
              <label>Emri<input required value={profileForm?.firstName || ""} onChange={(event) => setProfileForm({ ...profileForm, firstName: event.target.value })} /></label>
              <label>Mbiemri<input required value={profileForm?.lastName || ""} onChange={(event) => setProfileForm({ ...profileForm, lastName: event.target.value })} /></label>
            </div>
            <label>Telefoni<input type="tel" required value={profileForm?.phone || ""} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} /></label>
            <label>Adresa e preferuar<input autoComplete="street-address" value={profileForm?.address || ""} onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })} placeholder="Rruga dhe numri" /></label>
            <div className="account-field-row">
              <label>Qyteti<input autoComplete="address-level2" value={profileForm?.city || ""} onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })} /></label>
              <label>Kodi postar<input autoComplete="postal-code" value={profileForm?.postcode || ""} onChange={(event) => setProfileForm({ ...profileForm, postcode: event.target.value })} /></label>
            </div>
            <div className="account-field-row">
              <label>Shteti<input autoComplete="country-name" value={profileForm?.country || "Kosovë"} onChange={(event) => setProfileForm({ ...profileForm, country: event.target.value })} /></label>
              <label>Kontakti i preferuar<select value={profileForm?.contactPreference || "WhatsApp"} onChange={(event) => setProfileForm({ ...profileForm, contactPreference: event.target.value })}><option>WhatsApp</option><option>Telefon</option><option>Email</option></select></label>
            </div>
            <label className="account-check"><input type="checkbox" checked={Boolean(profileForm?.marketingConsent)} onChange={(event) => setProfileForm({ ...profileForm, marketingConsent: event.target.checked })} /><span>Pranoj njoftimet dhe këshillat optike.</span></label>
            <button className="primary-button" disabled={busy}>Ruaj profilin</button>
          </form>
          <form className="account-panel account-form" hidden={section !== 'security'} onSubmit={changePassword}>
            <div><span className="account-section-label">SIGURIA</span><h2>Ndrysho fjalëkalimin</h2></div>
            <label>Fjalëkalimi aktual<input type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label>
            <label>Fjalëkalimi i ri<input type="password" autoComplete="new-password" minLength="12" required value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label>
            <label>Konfirmoni fjalëkalimin<input type="password" autoComplete="new-password" minLength="12" required value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} /></label>
            <button className="secondary-button" disabled={busy}><LockKeyhole size={16} /> Ndrysho fjalëkalimin</button>
          </form>
        </div>
      </div>
    </section>
  );
}
