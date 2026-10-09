import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, HelpCircle, MessageCircle, Phone, X } from 'lucide-react';
import { getSiteHelp, helpCartPages, helpIsAvailable } from './siteHelp.js';
import useDialogFocus from './useDialogFocus.js';
import './styles/site-help.css';

export default function SiteHelp({ page, blocked = false, navigate, onOpenCart }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const panelRef = useRef(null);
  const answerRef = useRef(null);
  const topicRefs = useRef(new Map());
  const content = getSiteHelp(page);
  const available = helpIsAvailable(page, blocked);
  const visible = open && available;
  const topic = content.topics.find(item => item.id === selected);
  useDialogFocus(visible, panelRef, () => setOpen(false));

  useEffect(() => { setOpen(false); setSelected(null); }, [page, blocked]);
  useEffect(() => {
    if (!visible || !selected) return;
    answerRef.current?.focus({ preventScroll: true });
  }, [selected, visible]);

  const follow = (action) => {
    setOpen(false);
    setSelected(null);
    if (action.action === 'cart') onOpenCart?.();
    else navigate(action.page, undefined, action.path);
  };
  const back = () => {
    const previous = selected;
    setSelected(null);
    requestAnimationFrame(() => topicRefs.current.get(previous)?.focus());
  };

  if (!available) return null;
  return <div className="miftari-help" lang={content.locale}>
    <button type="button" className={`miftari-help-launcher${helpCartPages.has(page) ? ' has-cart' : ''}`} aria-haspopup="dialog" aria-expanded={visible} aria-controls={visible ? 'miftari-help-dialog' : undefined} onClick={() => { setSelected(null); setOpen(true); }}>
      <HelpCircle size={19} aria-hidden="true"/><span>{content.launcher}</span>
    </button>
    {visible && <div className="miftari-help-overlay">
      <div className="miftari-help-backdrop" onClick={() => setOpen(false)} aria-hidden="true"/>
      <section className="miftari-help-panel" id="miftari-help-dialog" data-help-dialog role="dialog" aria-modal="true" aria-labelledby="miftari-help-title" aria-describedby="miftari-help-disclosure" ref={panelRef}>
        <header><div><span>{content.eyebrow}</span><h2 id="miftari-help-title">{content.title}</h2></div><button type="button" className="miftari-help-close" aria-label={content.close} onClick={() => setOpen(false)} data-autofocus><X size={20} aria-hidden="true"/></button></header>
        <div className="miftari-help-body">
          {topic ? <div className="miftari-help-answer">
            <button type="button" className="miftari-help-back" onClick={back}><ArrowLeft size={16} aria-hidden="true"/>{content.back}</button>
            <h3 ref={answerRef} tabIndex={-1}>{topic.title}</h3><p>{topic.body}</p>
            <div className="miftari-help-actions">{topic.actions.filter(action => action.action !== 'cart' || onOpenCart).map(action => <button key={action.path || action.action} type="button" onClick={() => follow(action)}>{action.label}<ArrowRight size={16} aria-hidden="true"/></button>)}</div>
          </div> : <><p className="miftari-help-intro">{content.intro}</p><nav className="miftari-help-topics" aria-label={content.topicsLabel}>{content.topics.map(item => <button type="button" key={item.id} ref={node => { if (node) topicRefs.current.set(item.id, node); else topicRefs.current.delete(item.id); }} onClick={() => setSelected(item.id)}>{item.title}<ArrowRight size={16} aria-hidden="true"/></button>)}</nav></>}
          <div className="miftari-help-human"><strong>{content.contact}</strong><div><a href="tel:+38343777667"><Phone size={16} aria-hidden="true"/>{content.call}</a><a href="https://wa.me/38343777667" target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true"/>{content.whatsapp}<span className="miftari-help-sr">{content.locale === 'en' ? ' (opens a new tab)' : ' (hapet në skedë të re)'}</span></a></div></div>
        </div>
        <p id="miftari-help-disclosure" className="miftari-help-disclosure">{content.disclosure}</p>
      </section>
    </div>}
  </div>;
}
