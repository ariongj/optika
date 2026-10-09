import { useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, FileText } from 'lucide-react';
import EditorialImage from './EditorialImage.jsx';
import LabPartnerApplication from './LabPartnerApplication.jsx';
import { holdingCopy } from './holdingContent.js';

function RouteLink({ navigate, page, href, children, className = 'ed-link', arrow = true, ...props }) {
  return <a {...props} href={href} className={className} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(page, undefined, href);
  }}>{children}{arrow && <ArrowRight size={17} aria-hidden="true" />}</a>;
}

export function LabMarketLinks({ navigate, current, english = false }) {
  return <nav className="lab-market-switch" aria-label={english ? 'Optical Lab markets' : 'Tregjet e Optical Lab'}>
    <RouteLink navigate={navigate} page="labKosovo" href="/laboratory/kosovo" arrow={false} aria-current={current === 'kosovo' ? 'page' : undefined}>Kosovë <span>SQ</span></RouteLink>
    <RouteLink navigate={navigate} page="labEurope" href="/laboratory/europe" arrow={false} aria-current={current === 'eu' ? 'page' : undefined}>European Union <span>EN</span></RouteLink>
  </nav>;
}

const marketCopy = {
  sq: {
    eyebrow: 'Optical Lab · Partnerë në Kosovë', apply: 'Aplikoni për bashkëpunim', docs: 'Dokumentacioni',
    note: 'Për optika, klinika dhe profesionistë. Aplikimi nuk krijon detyrim blerjeje.', imageAlt: 'Punim ilustrues i lenteve me recetë në një laborator optik', imageNote: 'Fotografi ilustruese e procesit',
    strip: ['Pjesë e Miftari Holding Group', 'Laborator privat · Kosovë', 'Kontakt i drejtpërdrejtë'],
    capabilitiesTitle: 'Ju kujdeseni për klientin. Ne flasim për punimin.',
    capabilities: [
      ['Lente sipas recetës', 'Diskutojmë recetën, materialin dhe përdorimin përpara se të përcaktojmë specifikimin e porosisë.'],
      ['Montim & kontroll', 'Sqarojmë matjet, kornizën dhe kontrollet që shoqërojnë punimin e porosisë suaj.'],
      ['Një rrjedhë e qartë', 'Përcaktojmë kontaktin përgjegjës, dorëzimin e punimeve dhe mënyrën e trajtimit të kërkesave.'],
    ],
    processTitle: 'Nga prezantimi, te bashkëpunimi.',
    process: [['01', 'Aplikimi', 'Na tregoni për biznesin dhe interesin tuaj.'], ['02', 'Biseda teknike', 'Sqarojmë specifikimet, mundësitë dhe dokumentet.'], ['03', 'Marrëveshja', 'Konfirmojmë kushtet përpara çdo porosie.']],
    documentsKicker: 'Dokumente, jo supozime', documentsTitle: 'Çdo kërkesë ka specifikimin e vet.',
    documentsIntro: 'Përpara bashkëpunimit, kërkoni informacionin që ju nevojitet për produktin dhe mënyrën tuaj të punës.',
    documents: [
      ['Specifikimet e produktit', 'Materiali, lloji i lentes, trajtimet dhe kufijtë e punimit sqarohen sipas porosisë.'],
      ['Kontrolli dhe gjurmueshmëria', 'Diskutohen identifikimi i porosisë, të dhënat e verifikimit dhe dokumentet që mund të ofrohen.'],
      ['Kushtet e bashkëpunimit', 'Çmimi, afati, transporti dhe trajtimi i ripunimeve konfirmohen me shkrim.'],
    ],
    documentationCta: 'Kërkoni dokumentacion', applicationKicker: 'Le ta nisim me një bisedë', applicationTitle: 'Prezantoni biznesin tuaj.',
    applicationText: 'Aplikimi i shkon ekipit të laboratorit për tregun e Kosovës. Pas regjistrimit merrni një numër reference; bashkëpunimi konfirmohet nga ekipi.',
    privacy: 'Në këtë fazë kërkojmë vetëm të dhëna biznesi dhe kontakti. Mos dërgoni receta apo të dhëna pacientësh.',
    faqTitle: 'Para se të aplikoni',
    faq: [
      ['A krijohet menjëherë një llogari B2B?', 'Jo. Formulari regjistron kërkesën tuaj. Ekipi diskuton nevojat dhe konfirmon bashkëpunimin veçmas.'],
      ['Ku i shoh çmimet dhe afatet?', 'Oferta dhe afati varen nga specifikimi dhe organizimi i porosisë. Ato konfirmohen përpara pranimit të punimit.'],
      ['Jam klient individual. Ku të drejtohem?', 'Për syze personale, përdorni Optical ose kontaktoni optikën. Kjo faqe është për bashkëpunim mes bizneseve.'],
    ],
    retail: 'Po kërkoni syze për vete?', retailLink: 'Vizitoni Optical',
  },
  en: {
    eyebrow: 'Optical Lab · European partnerships', apply: 'Apply for a partnership', docs: 'Technical documentation',
    note: 'For optical practices, clinics and professional partners. No purchase commitment.', imageAlt: 'Illustrative close-up of prescription lens inspection at an optical workbench', imageNote: 'Illustrative production photography',
    strip: ['Part of Miftari Holding Group', 'Private laboratory · Kosovo', 'Direct professional contact'],
    capabilitiesTitle: 'An optical partner. A clear working relationship.',
    capabilities: [
      ['Prescription lens work', 'Discuss lens designs, materials and prescription requirements with the laboratory before defining the scope.'],
      ['Glazing & verification', 'Agree frame measurements, fitting requirements and the checks relevant to your order.'],
      ['Market-specific planning', 'Review documentation, responsibilities and delivery arrangements for your destination country before an order is accepted.'],
    ],
    processTitle: 'A considered start. A defined process.',
    process: [['01', 'Introduce your practice', 'Tell us your country, business type and area of interest.'], ['02', 'Review the requirements', 'Discuss technical scope, documentation and commercial terms.'], ['03', 'Confirm the arrangement', 'Agree responsibilities and availability before placing an order.']],
    documentsKicker: 'Technical documentation', documentsTitle: 'The right evidence, before the first order.',
    documentsIntro: 'Ask for the documents relevant to your product and market. Availability, scope and validity must be confirmed with the laboratory; this page is not a certification statement.',
    documents: [
      ['Product & material specifications', 'Lens design, material, treatments and the technical scope of the proposed work.'],
      ['Quality & traceability information', 'Order identification, inspection information and any supporting records available for the proposed service.'],
      ['Certificates & market documentation', 'Request any applicable certificate or declaration, its issuer, product scope and validity. No certification, approval or EU market authorisation is implied.'],
      ['Cross-border arrangements', 'Agree the responsible parties, delivery terms, charges, returns and any market-specific requirements before dispatch.'],
    ],
    documentationCta: 'Request a documentation review', applicationKicker: 'Let’s talk about your practice', applicationTitle: 'Start a professional partnership.',
    applicationText: 'Your application goes to the Optical Lab team with your EU market details. You receive a submission reference; the team confirms any partnership separately.',
    privacy: 'Business and contact information only. Do not send prescriptions, patient records or other health information through this form.',
    faqTitle: 'Before you apply',
    faq: [
      ['Where is the laboratory based?', 'Optical Lab is the prescription-production division of Miftari Holding Group in Kosovo. This page serves enquiries from EU-based professional partners; it does not describe a separate EU factory.'],
      ['Is submitting an application an approval or order?', 'No. It is an introduction to the laboratory. Technical scope, documentation, availability and terms must be agreed before a partnership or order is confirmed.'],
      ['Can I view certificates here?', 'No verified certificates are currently published here. Select documentation as your area of interest to request a review of available evidence for your intended product and market.'],
    ],
    retail: 'Looking for glasses for yourself?', retailLink: 'Visit Optical',
  },
};

export function LabMarketPage({ marketSegment = 'kosovo', navigate, content = {} }) {
  const english = marketSegment === 'eu';
  const locale = english ? 'en' : 'sq';
  const copy = holdingCopy(content);
  const text = marketCopy[locale];
  const prefix = english ? 'labEurope' : 'labKosovo';
  const [interest, setInterest] = useState('partnership');
  const [interestRequestKey, setInterestRequestKey] = useState(0);
  function requestDocumentation() { setInterest('documentation'); setInterestRequestKey(value => value + 1); }
  return <div className={`lab-page lab-page-${marketSegment}`} lang={locale}>
    <div className="lab-context"><RouteLink navigate={navigate} page="brand" href="/laboratory">Optical Lab</RouteLink><LabMarketLinks navigate={navigate} current={marketSegment} english={english} /></div>
    <section className="lab-hero" aria-labelledby="lab-title">
      <div><span className="ed-kicker">{text.eyebrow}</span><h1 id="lab-title">{copy[`${prefix}Title`]}</h1><p>{copy[`${prefix}Subtitle`]}</p><div className="lab-actions"><a className="primary-button" href="#application">{text.apply}<ArrowRight size={17} /></a><a className="ed-link" href="#documentation">{text.docs}</a></div><small>{text.note}</small></div>
      <figure><EditorialImage name={`${prefix}Image`} value={content[`${prefix}Image`]} priority alt={text.imageAlt}/>{!content[`${prefix}Image`] && <figcaption>{text.imageNote}</figcaption>}</figure>
    </section>
    <div className="lab-context-strip">{text.strip.map(item => <span key={item}>{item}</span>)}</div>
    <section className="lab-capabilities"><div className="lab-section-heading"><span className="ed-kicker">{english ? 'Prescription production' : 'Punimi me recetë'}</span><h2>{text.capabilitiesTitle}</h2></div><div className="lab-capability-grid">{text.capabilities.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="lab-documentation" id="documentation"><div><span className="ed-kicker">{text.documentsKicker}</span><h2>{text.documentsTitle}</h2><p>{text.documentsIntro}</p><a className="ed-link" href="#application" onClick={requestDocumentation}>{text.documentationCta}<ArrowRight size={17}/></a></div><div><div className="lab-document-list">{text.documents.map(([title, body]) => <details key={title}><summary><FileText size={17} aria-hidden="true"/><span>{title}</span><ChevronDown size={17} aria-hidden="true"/></summary><p>{body}</p></details>)}</div><p className="lab-evidence-note">{copy[english ? 'labDocumentationNoteEn' : 'labDocumentationNoteSq']}</p></div></section>
    <section className="lab-onboarding"><h2>{text.processTitle}</h2><ol>{text.process.map(([number, title, body]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section>
    <section className="lab-enrolment" id="application"><div><span className="ed-kicker">{text.applicationKicker}</span><h2>{text.applicationTitle}</h2><p>{text.applicationText}</p><p className="lab-privacy-note">{text.privacy}</p><a className="ed-link" href="tel:+38343777667">+383 43 777 667 <ArrowUpRight size={17}/></a></div><LabPartnerApplication key={marketSegment} marketSegment={marketSegment} locale={locale} initialInterest={interest} interestRequestKey={interestRequestKey}/></section>
    <section className="lab-faq"><h2>{text.faqTitle}</h2><div>{text.faq.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={17}/></summary><p>{answer}</p></details>)}</div></section>
    <aside className="lab-retail-link"><p>{text.retail}</p><RouteLink navigate={navigate} page="optical" href="/optical">{text.retailLink}</RouteLink></aside>
  </div>;
}

export function LabPartnersHub({ navigate, content = {} }) {
  const copy = holdingCopy(content);
  const [market, setMarket] = useState('kosovo');
  return <div className="lab-page lab-partner-hub">
    <div className="mg-breadcrumb"><RouteLink navigate={navigate} page="brand" href="/laboratory">Optical Lab</RouteLink><span>/ Partnerë B2B</span></div>
    <header className="lab-hub-heading"><span className="ed-kicker">Miftari Holding Group · Optical Lab</span><h1>{copy.partnersTitle}</h1><p>{copy.partnersSubtitle}</p></header>
    <section className="lab-market-cards" aria-label="Zgjidhni tregun tuaj">
      <article><RouteLink navigate={navigate} page="labKosovo" href="/laboratory/kosovo" className="lab-market-image" arrow={false}><EditorialImage name="labKosovoImage" value={content.labKosovoImage} priority alt="Punim ilustrues në laborator optik"/><span className="sr-only">Optical Lab Kosovë</span></RouteLink><div><span className="ed-kicker">Kosovë · Shqip</span><h2>Afër optikës suaj.</h2><p>Punim me recetë dhe bashkëpunim i drejtpërdrejtë për profesionistët në Kosovë.</p><RouteLink navigate={navigate} page="labKosovo" href="/laboratory/kosovo">Zbuloni bashkëpunimin</RouteLink></div></article>
      <article lang="en"><RouteLink navigate={navigate} page="labEurope" href="/laboratory/europe" className="lab-market-image" arrow={false}><EditorialImage name="labEuropeImage" value={content.labEuropeImage} priority alt="Illustrative prescription lens inspection"/><span className="sr-only">Optical Lab European partnerships</span></RouteLink><div><span className="ed-kicker">European Union · English</span><h2>Built around your practice.</h2><p>Explore technical requirements, documentation and a direct laboratory relationship.</p><RouteLink navigate={navigate} page="labEurope" href="/laboratory/europe">Explore EU partnerships</RouteLink></div></article>
    </section>
    <p className="lab-image-note">Imazhe ilustruese. Dy tregje, i njëjti laborator në Kosovë — jo dy fabrika të veçanta.</p>
    <section className="lab-enrolment" id="partner-enquiry"><div><span className="ed-kicker">Aplikim për partneritet</span><h2>Le të njihemi.</h2><p>Zgjidhni tregun për ta drejtuar kërkesën te ekipi i duhur. Kushtet, dokumentet dhe porositë konfirmohen pas bisedës me laboratorin.</p><div className="lab-application-market" role="group" aria-label="Tregu i aplikimit"><button aria-pressed={market === 'kosovo'} onClick={() => setMarket('kosovo')}>Kosovë · SQ</button><button aria-pressed={market === 'eu'} onClick={() => setMarket('eu')}>European Union · EN</button></div><p className="lab-privacy-note">Vetëm të dhëna biznesi dhe kontakti. Pa receta ose të dhëna pacientësh.</p></div><LabPartnerApplication key={market} marketSegment={market} locale={market === 'eu' ? 'en' : 'sq'} sourcePath="/laboratory/partners"/></section>
  </div>;
}

export function LabEuropeFooter({ navigate }) {
  return <footer className="lab-europe-footer" lang="en"><div><strong>MIFTARI HOLDING GROUP</strong><p>Optical Lab · Prescription production in Kosovo.<br/>Professional partnerships for Kosovo and EU markets.</p></div><nav aria-label="Professional information"><RouteLink navigate={navigate} page="labKosovo" href="/laboratory/kosovo">Kosovo · Shqip</RouteLink><a href="#documentation">Technical documentation</a><a href="#application">Partner application</a><RouteLink navigate={navigate} page="partners" href="/laboratory/partners">All partner markets</RouteLink></nav><p>Business enquiries: <a href="tel:+38343777667">+383 43 777 667</a><br/>© 2026 Miftari Holding Group</p></footer>;
}
