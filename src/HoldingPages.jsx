import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Phone } from 'lucide-react';
import EditorialImage from './EditorialImage.jsx';
import { holdingCopy, enquiryTopics, enquiryError } from './holdingContent.js';

function PageLink({ navigate, page, path, children, className = 'ed-link' }) {
  return <a className={className} href={path} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(page, undefined, path);
  }}>{children}<ArrowRight size={18} aria-hidden="true" /></a>;
}

export { default as GroupHome } from './AtelierHome.jsx';
export { LabPartnersHub as LabPartnersPage } from './LabMarketPages.jsx';

const clinicServices = [
  { number: '01', title: 'Konsulta me specialistin', text: 'Një bisedë me mjekun e syve për vlerësimin dhe hapat e mëtejshëm të kujdesit.', topic: 'Konsultë me specialistin e syve', action: 'Kërko konsultë' },
  { number: '02', title: 'Kontrolle të syve', text: 'Kontakti për një vizitë kontrolli ose për vazhdimin e kujdesit sipas udhëzimit të ekipit klinik.', topic: 'Informacion për vizitë kontrolli', action: 'Pyet për kontroll' },
  { number: '03', title: 'Kujdesi kirurgjikal', text: 'Informacion për konsultën paraprake. Çdo procedurë dhe përshtatshmëria e saj diskutohen me specialistin.', topic: 'Informacion për vlerësim kirurgjikal', action: 'Pyet për vlerësim' },
];

const clinicQuestions = [
  ['A konfirmohet takimi kur dërgoj formularin?', 'Jo. Formulari regjistron kërkesën për kontakt. Ekipi ju kontakton për të sqaruar shërbimin, specialistin, vendin dhe orarin; takimi konfirmohet vetëm pas kësaj bisede.'],
  ['A mund të marr informacion për ndërhyrje kirurgjikale?', 'Po, zgjidhni interesin për vlerësim kirurgjikal. Lloji i ndërhyrjes, mundësitë dhe hapat përkatës sqarohen nga ekipi klinik pas konsultës. Ky formular nuk rezervon ndërhyrje.'],
  ['Ku zhvillohet vizita?', 'Klinika Miftari operon në Kosovë si departamenti klinik i Miftari Holding Group. Ekipi konfirmon vendndodhjen e saktë dhe udhëzimet për vizitën gjatë kontaktit.'],
  ['A duhet të dërgoj receta ose dokumente këtu?', 'Jo. Këtu kërkohen vetëm emri, kontakti dhe lloji i interesit. Mos dërgoni diagnoza, receta apo dokumente mjekësore. Nëse duhen dokumente, mënyra e dorëzimit sqarohet drejtpërdrejt me ekipin.'],
];

export function ClinicPage({ navigate, content = {} }) {
  const copy = holdingCopy(content);
  const [selectedTopic, setSelectedTopic] = useState(enquiryTopics.clinic[0]);
  return <div className="mg-page mg-clinic">
    <nav className="mg-breadcrumb" aria-label="Vendndodhja në faqe"><PageLink navigate={navigate} page="home" path="/">Miftari Holding Group</PageLink><span aria-hidden="true">/</span><span aria-current="page">Klinika Miftari</span></nav>
    <section className="mg-clinic-hero" aria-labelledby="clinic-title">
      <div>
        <span className="ed-kicker">Klinika Miftari · Kosovë</span>
        <h1 id="clinic-title">{copy.clinicTitle}</h1>
        <p>{copy.clinicSubtitle}</p>
        <div className="clinic-hero-actions"><a href="#clinic-enquiry" className="primary-button">Kërko një takim <ArrowRight size={17} aria-hidden="true" /></a><a href="#clinic-services" className="ed-link">Shih shërbimet <ArrowRight size={17} aria-hidden="true" /></a></div>
        <small>Kërkesa juaj i kalon ekipit. Takimi konfirmohet pas kontaktit.</small>
      </div>
      <figure><EditorialImage name="clinicImage" value={content.clinicImage} priority alt="Vizual ilustrues i pajisjes së ekzaminimit të syrit në një ambient të qetë" /><figcaption>Vizual ilustrues · jo ambientet reale të klinikës</figcaption></figure>
    </section>
    <div className="clinic-identity"><span>Departamenti klinik i <strong>Miftari Holding Group</strong></span><span>Konsulta · Kontrolle · Kujdes kirurgjikal</span></div>

    <section className="clinic-services" id="clinic-services" aria-labelledby="clinic-scope-title">
      <header><span className="ed-kicker">Kujdesi klinik</span><h2 id="clinic-scope-title">Filloni me shërbimin që ju duhet.</h2><p>Një kontakt i drejtpërdrejtë me ekipin për të organizuar vizitën tuaj.</p></header>
      <div className="clinic-service-grid">{clinicServices.map(({ number, title, text, topic, action }) => <article key={number}><span className="ed-kicker">{number}</span><h3>{title}</h3><p>{text}</p><a href="#clinic-enquiry" className="ed-link" onClick={() => setSelectedTopic(topic)}>{action}<ArrowRight size={17} aria-hidden="true" /></a></article>)}</div>
    </section>

    <section className="clinic-visit" aria-labelledby="clinic-visit-title">
      <figure><EditorialImage name="examinationImage" value={content.examinationImage} sizes="(max-width: 680px) 100vw, 36vw" alt="Ilustrim i një kontrolli të syrit me pajisje ekzaminimi" /><figcaption>Skenë ilustruese · jo pacientë ose staf i klinikës</figcaption></figure>
      <div><span className="ed-kicker">Vizita juaj, hap pas hapi</span><h2 id="clinic-visit-title">Më pak paqartësi.<br />Më shumë vëmendje.</h2><ol>{[
        ['Na kontaktoni', 'Zgjidhni interesin dhe lini numrin tuaj. Nuk nevojiten dokumente mjekësore në formular.'],
        ['Sqarojmë detajet', 'Ekipi konfirmon shërbimin, specialistin, vendin, orarin dhe informacionin e nevojshëm për vizitën.'],
        ['Takoheni me ekipin klinik', 'Vlerësimi dhe hapat e mëtejshëm diskutohen personalisht. Çdo trajtim kërkon vlerësim të veçantë.'],
      ].map(([title, text], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div>
    </section>

    <section className="mg-enquiry-section" id="clinic-enquiry" aria-labelledby="clinic-enquiry-title"><div><span className="ed-kicker">Kontakti me klinikën</span><h2 id="clinic-enquiry-title">Le të organizojmë<br />vizitën tuaj.</h2><p>Lini të dhënat e kontaktit. Ekipi sqaron disponueshmërinë dhe detajet përpara se të konfirmojë takimin.</p><div className="clinic-contact-facts"><div><span>Departamenti</span><strong>Klinika Miftari</strong></div><div><span>Vendndodhja</span><strong>Kosovë · adresa konfirmohet me ekipin</strong></div></div><p className="mg-safety-note" id="clinic-privacy-note">Mos dërgoni diagnoza, receta apo dokumente mjekësore. Ky formular është vetëm për kontakt dhe nuk shërben për urgjenca.</p></div><DivisionEnquiry division="clinic" navigate={navigate} selectedTopic={selectedTopic} onTopicChange={setSelectedTopic} /></section>

    <section className="clinic-faq" aria-labelledby="clinic-faq-title"><div><span className="ed-kicker">Përpara kontaktit</span><h2 id="clinic-faq-title">Pyetje të shpeshta.</h2></div><div>{clinicQuestions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>

    <section className="mg-related clinic-related"><div><span className="ed-kicker">I njëjti grup. Departamente të veçanta.</span><h2>Po kërkoni syze ose lente?</h2><p>Optical për korniza dhe syze dielli. Optical Lab për lentet me recetë dhe punimin optik.</p></div><div><PageLink navigate={navigate} page="optical" path="/optical">Shih Optical</PageLink><PageLink navigate={navigate} page="brand" path="/laboratory">Shih Optical Lab</PageLink></div></section>
  </div>;
}

export function DivisionEnquiry({ division, navigate, selectedTopic, onTopicChange }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const pending = useRef(false);
  const controller = useRef(null);
  const successRef = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (status === 'sent') successRef.current?.focus(); }, [status]);
  if (status === 'sent') return <div className="mg-enquiry-success" role="status" tabIndex={-1} ref={successRef}><Check size={28} /><h3>Kërkesa u regjistrua.</h3><p>Referenca juaj: <strong>{reference}</strong></p><p>{division === 'clinic' ? 'Ky nuk është konfirmim takimi. Ekipi duhet të konfirmojë shërbimin, specialistin dhe orarin.' : 'Kërkesa është në inbox-in e Optical Lab. Kushtet e bashkëpunimit diskutohen me ekipin.'}</p><button className="secondary-button" onClick={() => { setStatus('idle'); setReference(''); }}>Dërgo kërkesë tjetër</button></div>;
  return <form className="mg-enquiry-form" aria-label={division === 'clinic' ? 'Kërkesë për kontakt me Klinikën Miftari' : 'Kërkesë bashkëpunimi me Optical Lab'} aria-describedby={division === 'clinic' ? 'clinic-privacy-note' : undefined} aria-busy={status === 'pending'} onSubmit={async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const data = new FormData(event.currentTarget);
    setStatus('pending'); setError('');
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch('/api/submit.php', { method: 'POST', credentials: 'same-origin', signal: abort.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        type: 'enquiry', division, name: data.get('name'), phone: data.get('phone'), email: data.get('email'),
        service: data.get('service'), organization: data.get('organization') || '', market: data.get('market') || '',
        consent: data.get('consent') === 'on', company: data.get('company') || '',
      }) });
      const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
      if (!response.ok || !payload?.accepted || !payload.id) throw new Error(payload?.error || 'unavailable');
      setReference(payload.id); setStatus('sent');
    } catch (failure) { setError(enquiryError(failure.message)); setStatus('error'); }
    finally { clearTimeout(timer); pending.current = false; }
  }}>
    <div className="mg-form-grid"><label>Emri dhe mbiemri<input name="name" autoComplete="name" required maxLength={140} disabled={status === 'pending'} /></label><label>Telefoni<input name="phone" type="tel" autoComplete="tel" required maxLength={80} disabled={status === 'pending'} /></label></div>
    <label>Emaili <span>(opsional)</span><input name="email" type="email" autoComplete="email" maxLength={180} disabled={status === 'pending'} /></label>
    {division === 'lab' && <div className="mg-form-grid"><label>Biznesi / organizata<input name="organization" autoComplete="organization" required maxLength={160} disabled={status === 'pending'} /></label><label>Vendi ku operoni<input name="market" autoComplete="country-name" required maxLength={100} disabled={status === 'pending'} /></label></div>}
    <label>{division === 'clinic' ? 'Për çfarë kërkoni informacion?' : 'Interesi juaj'}<select name="service" disabled={status === 'pending'} value={selectedTopic} onChange={onTopicChange ? (event) => onTopicChange(event.target.value) : undefined}>{enquiryTopics[division].map(topic => <option key={topic}>{topic}</option>)}</select></label>
    <label className="mg-honeypot" aria-hidden="true">Lëreni bosh<input name="company" tabIndex={-1} autoComplete="off" /></label>
    <label className="mg-consent"><input name="consent" type="checkbox" required disabled={status === 'pending'} /><span>Pranoj që ekipi të përdorë kontaktin tim vetëm për këtë kërkesë. <a href="/policies#privacy" target="_blank" rel="noopener noreferrer">Privatësia</a></span></label>
    {error && <p className="mg-form-error" role="alert">{error}</p>}
    <button type="submit" className="primary-button" disabled={status === 'pending'}>{status === 'pending' ? 'Duke dërguar…' : 'Dërgo kërkesën'}<ArrowRight size={17} aria-hidden="true" /></button>
    {division === 'clinic' && <p className="clinic-form-note">Dërgimi nuk konfirmon takim ose trajtim. Ekipi do t’ju kontaktojë për detajet.</p>}
    <p className="mg-direct-contact"><Phone size={14} /> Ose kontaktoni ekipin Miftari: <a href="tel:+38343777667">+383 43 777 667</a></p>
  </form>;
}
