import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Sparkles, Send, X } from 'lucide-react';
import { getLanguage, subscribeLanguage } from './i18n/locale.js';
import './styles/luna-try-on.css';

const copy = {
  sq: {
    title: 'LUNA · Asistenti AI', subtitle: 'Ndihmë për kamerën, foton dhe modelin 3D',
    open: 'Më ndihmo', close: 'Mbyll ndihmën LUNA', label: 'Pyet LUNA-n',
    placeholder: 'P.sh. Si ta vendos kornizën më saktë?', send: 'Pyet LUNA-n', busy: 'LUNA po përgjigjet…',
    privacy: 'Dërgohen te OpenAI vetëm pyetja, mënyra e provës, statusi teknik dhe të dhënat publike të kornizës. Kamera dhe fotot nuk dërgohen. Mos shkruani të dhëna personale, receta ose informacione shëndetësore.',
    consent: 'Pranoj dërgimin e këtyre të dhënave te OpenAI për këtë ndihmë.',
    disclaimer: 'Përgjigje nga AI; mund të ketë gabime. LUNA nuk ju sheh dhe nuk kryen matje. Përshtatja konfirmohet në optikë.',
    offline: 'LUNA nuk është aktivizuar në këtë instalim. Kamera, fotografia dhe pamja 3D vazhdojnë të funksionojnë.',
    failed: 'Nuk u mor përgjigjja. Pyetja juaj u ruajt këtu; provoni përsëri.',
    limit: 'Është arritur kufiri i kërkesave. Provoni më vonë; mjetet e provës mbeten të disponueshme.',
    checking: 'Po kontrollohet lidhja…', retry: 'Kontrollo përsëri', cancel: 'Anulo',
    camera: 'Si ta nis kamerën?', photo: 'Si ta përdor fotografinë?', viewer: 'Si ta përdor modelin 3D?',
    alignment: 'Si ta rregulloj pozicionimin?', cameraAction: 'Shko te kamera', photoAction: 'Shko te fotografia',
    viewerAction: 'Shiko në 3D', reset: 'Qendërzo pamjen', product: 'Detajet e kornizës', actions: 'Kontrolle të shpejta',
  },
  en: {
    title: 'LUNA · AI assistant', subtitle: 'Help with the camera, photo and 3D model',
    open: 'Help me', close: 'Close LUNA help', label: 'Ask LUNA',
    placeholder: 'E.g. How can I align the frame better?', send: 'Ask LUNA', busy: 'LUNA is answering…',
    privacy: 'Only your question, try-on mode, technical status and public frame details are sent to OpenAI. Camera footage and photos are not sent. Do not enter personal details, prescriptions or health information.',
    consent: 'I agree to send these details to OpenAI for this help.',
    disclaimer: 'AI-generated guidance may be wrong. LUNA cannot see you or take measurements. Confirm your fit with an optician.',
    offline: 'LUNA is not activated on this installation. Camera, photo and 3D tools still work.',
    failed: 'No answer received. Your question is still here; please try again.',
    limit: 'The request limit has been reached. Try again later; the try-on tools remain available.',
    checking: 'Checking connection…', retry: 'Check again', cancel: 'Cancel',
    camera: 'How do I start the camera?', photo: 'How do I use a photo?', viewer: 'How do I use the 3D model?',
    alignment: 'How can I adjust the alignment?', cameraAction: 'Go to camera', photoAction: 'Go to photo',
    viewerAction: 'View in 3D', reset: 'Centre the view', product: 'Frame details', actions: 'Quick controls',
  },
};

export default function LunaTryOnGuide({ mode, status, productId, onMode, onReset, onProduct }) {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'sq');
  const t = copy[language];
  const [open, setOpen] = useState(false);
  const [connection, setConnection] = useState('checking');
  const [reload, setReload] = useState(0);
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const csrf = useRef('');
  const active = useRef(null);
  const cancel = () => { active.current?.abort(); active.current = null; setBusy(false); };
  const useMode = next => {
    onMode(next); setOpen(false);
    requestAnimationFrame(() => document.getElementById(`vto-tab-${next}`)?.focus());
  };

  useEffect(() => {
    cancel(); setAnswer(''); setError('');
    if (!open) return;
    const controller = new AbortController();
    let disposed = false;
    setConnection('checking');
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch('/api/luna.php', { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable');
        const data = await response.json();
        if (controller.signal.aborted) return;
        csrf.current = typeof data.csrf === 'string' ? data.csrf : '';
        setConnection(data.available && csrf.current ? 'ready' : 'offline');
      }).catch(() => { if (!disposed) setConnection('failed'); })
      .finally(() => clearTimeout(timeout));
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); active.current?.abort(); active.current = null; };
  }, [open, reload]);

  useEffect(() => { cancel(); setAnswer(''); setError(''); }, [mode, productId, language]);

  const ask = async event => {
    event.preventDefault();
    if (!consent || !question.trim() || busy || connection !== 'ready') return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(''); setAnswer('');
    const timeout = setTimeout(() => controller.abort(), 32000);
    try {
      const response = await fetch('/api/luna.php', { method: 'POST', signal: controller.signal,
        credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.current },
        body: JSON.stringify({ question: question.trim(), language, mode, status, productId, consent: true }) });
      const data = await response.json();
      if (active.current !== controller) return;
      if (!response.ok || !data.ok || typeof data.answer !== 'string') {
        if (data.error === 'invalid_csrf_token') setConnection('failed');
        throw new Error(data.error || 'failed');
      }
      setAnswer(data.answer);
    } catch (failure) {
      if (active.current === controller) setError(failure.message === 'usage_limit' ? 'limit' : failure.message === 'configuration_required' ? 'offline' : 'failed');
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  };

  return <section className="luna-guide" lang={language} aria-label={t.title}>
    <button type="button" className="luna-guide-toggle" aria-expanded={open} aria-controls="luna-guide-body" onClick={() => setOpen(value => !value)}>
      <Sparkles size={19} aria-hidden="true"/><span><strong>{t.title}</strong><small>{t.subtitle}</small></span>
      <span className="luna-guide-toggle-label">{open ? t.close : t.open}</span>{open ? <X size={18}/> : <ChevronDown size={18}/>}
    </button>
    {open && <div id="luna-guide-body" className="luna-guide-body">
      <div className="luna-guide-main">
        <div className="luna-guide-prompts">{['camera', 'photo', 'viewer', 'alignment'].map(key => <button type="button" key={key} disabled={busy} onClick={() => { setQuestion(t[key]); setAnswer(''); setError(''); }}>{t[key]}</button>)}</div>
        <form onSubmit={ask}>
          <label htmlFor="luna-question">{t.label}</label>
          <textarea id="luna-question" rows={2} maxLength={600} value={question} placeholder={t.placeholder} onChange={event => setQuestion(event.target.value)} disabled={busy} aria-describedby="luna-privacy"/>
          <p id="luna-privacy" className="luna-guide-privacy">{t.privacy}</p>
          <label className="luna-guide-consent"><input type="checkbox" checked={consent} onChange={event => { setConsent(event.target.checked); if (!event.target.checked) cancel(); }}/><span>{t.consent}</span></label>
          <div className="luna-guide-submit"><button type="submit" disabled={!consent || !question.trim() || busy || connection !== 'ready'}><Send size={16}/>{busy ? t.busy : t.send}</button>{busy && <button type="button" onClick={cancel}>{t.cancel}</button>}</div>
        </form>
        {connection !== 'ready' && <p role="status">{t[connection]} {connection === 'failed' && <button type="button" onClick={() => setReload(value => value + 1)}>{t.retry}</button>}</p>}
        {error && <p role="alert">{t[error]}</p>}
        <div role="status" aria-live="polite" aria-atomic="true">{answer && <div className="luna-guide-answer"><strong>LUNA</strong><p>{answer}</p><small>{t.disclaimer}</small></div>}</div>
      </div>
      <nav className="luna-guide-actions" aria-label={t.actions}><strong>{t.actions}</strong>
        <button type="button" onClick={() => useMode('live')}>{t.cameraAction}</button>
        <button type="button" onClick={() => useMode('photo')}>{t.photoAction}</button>
        <button type="button" onClick={() => useMode('viewer')}>{t.viewerAction}</button>
        <button type="button" onClick={onReset}>{t.reset}</button>
        <button type="button" onClick={onProduct}>{t.product}</button>
      </nav>
    </div>}
  </section>;
}
