import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import {
  EU_PARTNER_COUNTRIES, LAB_BUSINESS_TYPES, LAB_INTERESTS, LAB_SOURCE_PATHS,
  initialLabPartnerFields, applyLabInitialInterest, validateLabPartnerFields, createLabApplicationRequestId,
  labPartnerFingerprint, buildLabPartnerPayload, submitLabPartnerApplication, labPartnerErrorKey,
} from './labPartnerForm.js';
import './styles/lab-application.css';
import { useLanguage } from './i18n/LanguageSwitch.jsx';

const COPY = {
  en: {
    title: 'Let’s talk about your business.', intro: 'Tell us where you work and what you need. The Optical Lab team will review your enquiry with you.',
    required: 'Fields marked * are required.', name: 'Full name', organization: 'Business / organisation', email: 'Business email', phone: 'Phone',
    optional: 'optional', country: 'Country of operation', chooseCountry: 'Choose an EU country', businessType: 'Business type',
    interest: 'What would you like to discuss?', website: 'Business website', websiteHint: 'Include https://',
    types: { optical: 'Optical practice / eyewear store', clinic: 'Eye clinic', distributor: 'Distributor', other: 'Other business' },
    interests: { prescription: 'Prescription-lens production', mounting: 'Lens mounting & finishing', documentation: 'Technical documentation', partnership: 'A laboratory partnership' },
    consent: 'I agree to be contacted by Optical Lab about this enquiry.', privacy: 'Privacy information',
    privacyTitle: 'How this business enquiry is used',
    privacyDetails: 'The enquiry records the contact name, business name, email, optional phone and website, country, business type and selected topic, together with its reference and market context.',
    privacyPurpose: 'Authorised Miftari staff use these details to evaluate your partnership enquiry and follow up with you. Sending this form does not automatically subscribe you to marketing.',
    privacyRequest: 'To request a correction or removal of your details, contact the team and quote your enquiry reference where available. The team will review your request.',
    privacyContact: 'Contact the Miftari team', fullPrivacy: 'Full privacy policy',
    safety: 'Business contact details only. Do not include patient information or prescriptions.',
    submit: 'Send partnership enquiry', pending: 'Sending your enquiry…', retry: 'Retry the same enquiry',
    summary: 'Please check the highlighted fields.', success: 'Your enquiry has been received.', reference: 'Your reference',
    next: 'The laboratory team will review your business enquiry. This is not partner approval, an order confirmation or confirmation that specific certificates are available.',
    new: 'Start a new enquiry', editAttempt: 'Use edited details as a new enquiry',
    changed: 'These details differ from your previous attempt. Retry with the original details, or explicitly start a new enquiry with your changes.',
    newWarning: 'If your earlier attempt reached the team, sending new details may create a second enquiry. Keep the original reference if one was shown.',
    errors: { name: 'Enter your full name (2–140 characters).', organization: 'Enter your business name (2–160 characters).', email: 'Enter a valid email address.', phone: 'Enter a valid phone number, or leave this blank.', country: 'Select a country for this market.', businessType: 'Choose your business type.', interest: 'Choose a topic.', website: 'Use a full https:// website address without login details.', consent: 'Please agree to be contacted about your enquiry.', configuration: 'This form is not configured for the selected market.' },
    failures: { conflict: 'This request reference was already used with different details. Check your earlier enquiry before starting a new one.', timeout: 'The server did not confirm in time. Your details are still here. Retry the same enquiry to check its status without creating a duplicate.', rate: 'Too many requests were sent. Please wait a few minutes, then retry.', validation: 'The server could not accept these details. Check the form. If you change a previous attempt, use “Use edited details as a new enquiry”.', unconfirmed: 'We did not receive a confirmed reference. Your enquiry is not confirmed. You can retry with the same details.', unavailable: 'We could not confirm your enquiry. Your details have been kept here; please retry. Do not assume the request was received until a reference is shown.' },
  },
  sq: {
    title: 'Le të flasim për biznesin tuaj.', intro: 'Na tregoni ku operoni dhe çfarë ju nevojitet. Ekipi i Optical Lab do ta shqyrtojë kërkesën me ju.',
    required: 'Fushat me * janë të detyrueshme.', name: 'Emri dhe mbiemri', organization: 'Biznesi / organizata', email: 'Emaili i biznesit', phone: 'Telefoni',
    optional: 'opsional', country: 'Vendi ku operoni', chooseCountry: 'Zgjidhni vendin në BE', businessType: 'Lloji i biznesit',
    interest: 'Për çfarë dëshironi të flisni?', website: 'Faqja e biznesit', websiteHint: 'Përfshini https://',
    types: { optical: 'Optikë / dyqan syzesh', clinic: 'Klinikë e syve', distributor: 'Distributor', other: 'Biznes tjetër' },
    interests: { prescription: 'Prodhim i lenteve me recetë', mounting: 'Montim dhe përfundim i lenteve', documentation: 'Dokumentacion teknik', partnership: 'Bashkëpunim me laboratorin' },
    consent: 'Pranoj të kontaktohem nga Optical Lab lidhur me këtë kërkesë.', privacy: 'Informacioni për privatësinë',
    privacyTitle: 'Si përdoret kjo kërkesë e biznesit',
    privacyDetails: 'Kërkesa regjistron emrin e kontaktit, biznesin, emailin, telefonin dhe faqen opsionale, vendin, llojin e biznesit dhe temën e zgjedhur, bashkë me referencën dhe tregun përkatës.',
    privacyPurpose: 'Stafi i autorizuar i Miftarit i përdor këto të dhëna për të shqyrtuar kërkesën për bashkëpunim dhe për t’ju kontaktuar. Dërgimi i formularit nuk ju regjistron automatikisht për mesazhe marketingu.',
    privacyRequest: 'Për të kërkuar korrigjimin ose heqjen e të dhënave, kontaktoni ekipin dhe jepni referencën e kërkesës, nëse e keni. Ekipi do ta shqyrtojë kërkesën tuaj.',
    privacyContact: 'Kontaktoni ekipin Miftari', fullPrivacy: 'Politika e plotë e privatësisë (shqip)',
    safety: 'Vetëm të dhëna kontakti të biznesit. Mos përfshini të dhëna pacientësh apo receta.',
    submit: 'Dërgo kërkesën për bashkëpunim', pending: 'Duke dërguar kërkesën…', retry: 'Provo përsëri të njëjtën kërkesë',
    summary: 'Ju lutemi kontrolloni fushat e shënuara.', success: 'Kërkesa juaj u pranua.', reference: 'Referenca juaj',
    next: 'Ekipi i laboratorit do ta shqyrtojë kërkesën. Ky nuk është miratim partneriteti, konfirmim porosie apo konfirmim i disponueshmërisë së certifikatave të caktuara.',
    new: 'Nis një kërkesë të re', editAttempt: 'Përdor të dhënat si kërkesë të re',
    changed: 'Të dhënat ndryshojnë nga përpjekja e mëparshme. Provoni me të dhënat fillestare ose nisni shprehimisht një kërkesë të re me ndryshimet.',
    newWarning: 'Nëse përpjekja e mëparshme ka arritur te ekipi, dërgimi i të dhënave të reja mund të krijojë një kërkesë të dytë. Ruani referencën fillestare nëse është shfaqur.',
    errors: { name: 'Shkruani emrin dhe mbiemrin (2–140 karaktere).', organization: 'Shkruani emrin e biznesit (2–160 karaktere).', email: 'Shkruani një adresë emaili të vlefshme.', phone: 'Shkruani një numër telefoni të vlefshëm ose lëreni bosh.', country: 'Zgjidhni një vend për këtë treg.', businessType: 'Zgjidhni llojin e biznesit.', interest: 'Zgjidhni temën.', website: 'Përdorni adresën e plotë https://, pa të dhëna hyrjeje.', consent: 'Ju lutemi pranoni kontaktin lidhur me këtë kërkesë.', configuration: 'Formulari nuk është konfiguruar për tregun e zgjedhur.' },
    failures: { conflict: 'Kjo referencë është përdorur me të dhëna të tjera. Kontrolloni kërkesën e mëparshme para se të nisni një të re.', timeout: 'Serveri nuk e konfirmoi kërkesën në kohë. Të dhënat tuaja janë ruajtur këtu. Provoni të njëjtën kërkesë përsëri pa krijuar dublikatë.', rate: 'Janë dërguar shumë kërkesa. Prisni disa minuta dhe provoni përsëri.', validation: 'Serveri nuk i pranoi këto të dhëna. Kontrolloni formularin. Nëse ndryshoni përpjekjen e mëparshme, përdorni “Përdor të dhënat si kërkesë të re”.', unconfirmed: 'Nuk morëm një referencë të konfirmuar. Kërkesa nuk është konfirmuar. Mund të provoni përsëri me të njëjtat të dhëna.', unavailable: 'Nuk mundëm ta konfirmonim kërkesën. Të dhënat tuaja mbeten këtu; provoni përsëri. Kërkesa konsiderohet e pranuar vetëm kur shfaqet referenca.' },
  },
};

export default function LabPartnerApplication({ marketSegment = 'kosovo', locale = marketSegment === 'eu' ? 'en' : 'sq', sourcePath, initialInterest = 'partnership', interestRequestKey = 0 }) {
  const selectedLanguage = useLanguage();
  const language = selectedLanguage === 'en' || locale === 'en' ? 'en' : 'sq';
  const path = sourcePath || (marketSegment === 'eu' ? '/laboratory/europe' : '/laboratory/kosovo');
  if (!['kosovo', 'eu'].includes(marketSegment) || !LAB_SOURCE_PATHS.includes(path)) return <p className="lab-application-error" role="alert">{COPY[language].errors.configuration}</p>;
  return <PartnerForm key={`${marketSegment}-${path}`} marketSegment={marketSegment} locale={language} sourcePath={path} initialInterest={initialInterest} interestRequestKey={interestRequestKey} />;
}

function PartnerForm({ marketSegment, locale, sourcePath, initialInterest, interestRequestKey }) {
  const copy = COPY[locale];
  const id = useId();
  const [fields, setFields] = useState(() => initialLabPartnerFields(marketSegment, initialInterest));
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: 'idle', message: '', reference: '' });
  const [changedAttempt, setChangedAttempt] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const formRef = useRef(null); const statusRef = useRef(null); const nameRef = useRef(null);
  const privacySummaryRef = useRef(null);
  const attempt = useRef(null); const pending = useRef(false); const controller = useRef(null); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (['success', 'error'].includes(state.status)) statusRef.current?.focus(); }, [state]);
  useEffect(() => {
    // A page CTA may select documentation after the visitor has entered contact details.
    // Never mutate a sent/uncertain attempt: retry must retain the original payload.
    setFields(current => applyLabInitialInterest(current, initialInterest, { pending: pending.current, hasAttempt: Boolean(attempt.current), submitted: state.status === 'success' }));
  }, [initialInterest, interestRequestKey]);
  const fieldId = name => `${id}-${name}`;
  const pendingState = state.status === 'pending';
  function change(event) {
    const { name, type, value, checked } = event.target;
    setFields(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setErrors(current => ({ ...current, [name]: undefined }));
  }
  function showPrivacy(event) {
    event.preventDefault(); setPrivacyOpen(true);
    requestAnimationFrame(() => {
      privacySummaryRef.current?.focus({ preventScroll: true });
      privacySummaryRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
  }
  function startNew(resetFields) {
    attempt.current = null; setChangedAttempt(false); setErrors({});
    setState({ status: 'idle', message: '', reference: '' });
    if (resetFields) setFields(initialLabPartnerFields(marketSegment, initialInterest));
    requestAnimationFrame(() => nameRef.current?.focus());
  }
  async function submit(event) {
    event.preventDefault(); if (pending.current) return;
    const validation = validateLabPartnerFields(fields, marketSegment);
    if (Object.keys(validation).length) {
      setErrors(validation); setState({ status: 'invalid', message: copy.summary, reference: '' });
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    const fingerprint = labPartnerFingerprint(fields, marketSegment, locale, sourcePath);
    if (attempt.current && attempt.current.fingerprint !== fingerprint) {
      setChangedAttempt(true); setState({ status: 'error', message: copy.changed, reference: '' }); return;
    }
    pending.current = true; setErrors({}); setChangedAttempt(false);
    setState({ status: 'pending', message: '', reference: '' });
    controller.current = new AbortController();
    try {
      if (!attempt.current) attempt.current = { fingerprint, payload: buildLabPartnerPayload(fields, { marketSegment, locale, sourcePath, applicationRequestId: createLabApplicationRequestId() }) };
      const result = await submitLabPartnerApplication(attempt.current.payload, { signal: controller.current.signal });
      if (mounted.current) { setState({ status: 'success', message: '', reference: result.id }); attempt.current = null; }
    } catch (error) {
      if (mounted.current) {
        const serverFields = Object.fromEntries(Object.keys(error.fieldErrors || {}).filter(name => copy.errors[name]).map(name => [name, name]));
        setErrors(serverFields); setChangedAttempt(error.code === 'application_request_conflict');
        setState({ status: 'error', message: copy.failures[labPartnerErrorKey(error)], reference: '' });
      }
    } finally { pending.current = false; controller.current = null; }
  }
  function inputProps(name) {
    return { id: fieldId(name), name, value: fields[name], onChange: change, 'aria-invalid': errors[name] ? true : undefined, 'aria-describedby': errors[name] ? `${fieldId(name)}-error` : name === 'website' ? `${id}-website-hint` : undefined };
  }
  const fieldError = name => errors[name] ? <span className="lab-application-field-error" id={`${fieldId(name)}-error`}>{copy.errors[errors[name]] || copy.errors[name]}</span> : null;
  if (state.status === 'success') return <section className="lab-application lab-application-success" lang={locale} ref={statusRef} role="status" tabIndex={-1}>
    <span className="lab-application-success-mark"><Check size={24} aria-hidden="true" /></span><h3>{copy.success}</h3>
    <p className="lab-application-reference">{copy.reference}<strong>{state.reference}</strong></p><p>{copy.next}</p>
    <button type="button" className="lab-application-secondary" onClick={() => startNew(true)}>{copy.new}<ArrowRight size={16} aria-hidden="true" /></button>
  </section>;
  return <form className="lab-application" lang={locale} ref={formRef} onSubmit={submit} noValidate aria-labelledby={`${id}-title`} aria-busy={pendingState}>
    <header className="lab-application-heading"><span>Optical Lab · {marketSegment === 'eu' ? 'EU' : 'Kosovë'} · B2B</span><h3 id={`${id}-title`}>{copy.title}</h3><p>{copy.intro}</p><small>{copy.required}</small></header>
    <fieldset disabled={pendingState} className="lab-application-fields"><legend className="lab-application-sr-only">{copy.title}</legend>
      <div className="lab-application-grid">
        <label htmlFor={fieldId('name')}>{copy.name} *<input {...inputProps('name')} ref={nameRef} autoComplete="name" required minLength={2} maxLength={140} />{fieldError('name')}</label>
        <label htmlFor={fieldId('organization')}>{copy.organization} *<input {...inputProps('organization')} autoComplete="organization" required minLength={2} maxLength={160} />{fieldError('organization')}</label>
        <label htmlFor={fieldId('email')}>{copy.email} *<input {...inputProps('email')} type="email" autoComplete="email" inputMode="email" required maxLength={180} autoCapitalize="none" spellCheck={false} />{fieldError('email')}</label>
        <label htmlFor={fieldId('phone')}>{copy.phone} <span className="lab-application-optional">({copy.optional})</span><input {...inputProps('phone')} type="tel" autoComplete="tel" maxLength={80} />{fieldError('phone')}</label>
        <label htmlFor={fieldId('country')}>{copy.country} *<select {...inputProps('country')} autoComplete="country" required>{marketSegment === 'kosovo' ? <option value="XK">{locale === 'en' ? 'Kosovo' : 'Kosovë'}</option> : <><option value="">{copy.chooseCountry}</option>{EU_PARTNER_COUNTRIES.map(([code, en, sq]) => <option value={code} key={code}>{locale === 'en' ? en : sq}</option>)}</>}</select>{fieldError('country')}</label>
        <label htmlFor={fieldId('businessType')}>{copy.businessType} *<select {...inputProps('businessType')} required>{LAB_BUSINESS_TYPES.map(value => <option value={value} key={value}>{copy.types[value]}</option>)}</select>{fieldError('businessType')}</label>
      </div>
      <label htmlFor={fieldId('interest')}>{copy.interest} *<select {...inputProps('interest')} required>{LAB_INTERESTS.map(value => <option value={value} key={value}>{copy.interests[value]}</option>)}</select>{fieldError('interest')}</label>
      <label htmlFor={fieldId('website')}>{copy.website} <span className="lab-application-optional">({copy.optional})</span><input {...inputProps('website')} type="url" autoComplete="url" maxLength={300} placeholder="https://" autoCapitalize="none" spellCheck={false} /><small id={`${id}-website-hint`}>{copy.websiteHint}</small>{fieldError('website')}</label>
      <label className="lab-application-honeypot" aria-hidden="true">Leave empty<input name="company" value={fields.company} onChange={change} tabIndex={-1} autoComplete="off" /></label>
      <p className="lab-application-safety"><ShieldCheck size={17} aria-hidden="true" /><span>{copy.safety}</span></p>
      <div className="lab-application-consent"><input id={fieldId('consent')} name="consent" type="checkbox" checked={fields.consent} onChange={change} required aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? `${fieldId('consent')}-error` : undefined} /><div><label htmlFor={fieldId('consent')}>{copy.consent} *</label><a href="#lab-application-privacy" aria-controls="lab-application-privacy" aria-expanded={privacyOpen} onClick={showPrivacy}>{copy.privacy}</a>{fieldError('consent')}</div></div>
      <details className="lab-application-privacy" id="lab-application-privacy" open={privacyOpen} onToggle={event => setPrivacyOpen(event.currentTarget.open)}>
        <summary ref={privacySummaryRef}>{copy.privacyTitle}</summary>
        <div><p>{copy.privacyDetails}</p><p>{copy.privacyPurpose}</p><p>{copy.privacyRequest}</p><a href="tel:+38343777667">{copy.privacyContact}: +383 43 777 667</a><a href="/policies#privacy" target="_blank" rel="noopener noreferrer">{copy.fullPrivacy}</a></div>
      </details>
    </fieldset>
    {state.message && <div className="lab-application-error" role="alert" tabIndex={-1} ref={statusRef}><p>{state.message}</p>{changedAttempt && <><small>{copy.newWarning}</small><button type="button" className="lab-application-secondary" onClick={() => startNew(false)}>{copy.editAttempt}</button></>}</div>}
    <button type="submit" className="lab-application-submit" disabled={pendingState}>{pendingState ? copy.pending : state.status === 'error' && !changedAttempt ? copy.retry : copy.submit}<ArrowRight size={17} aria-hidden="true" /></button>
    <span className="lab-application-sr-only" role="status" aria-live="polite">{pendingState ? copy.pending : ''}</span>
  </form>;
}
