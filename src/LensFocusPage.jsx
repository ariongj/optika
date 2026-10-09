import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Play, Search, X } from 'lucide-react';
import EditorialImage from './EditorialImage.jsx';
import { translate } from './i18n/locale.js';
import { useLanguage } from './i18n/LanguageSwitch.jsx';
import useDialogFocus from './useDialogFocus.js';
import { blogPosts } from './data/catalog.js';
import { normalizeSearch } from './catalogSearch.js';
import { guideReadingTime } from './guideContent.js';
import { lensChoices, lensMeasurements, lensTreatments } from './lensFocusContent.js';

function PageLink({ target, href, navigate, children, className = 'lf-link' }) {
  return <a className={className} href={href} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(target, undefined, href);
  }}>{children}<ArrowRight size={17} aria-hidden="true" /></a>;
}

function LensStory({ onClose }) {
  const language = useLanguage();
  const [mode, setMode] = useState('guided');
  const panelRef = useRef(null), frameRef = useRef(null), closeRef = useRef(null), endRef = useRef(null), cleanupRef = useRef(null);
  useDialogFocus(true, panelRef, onClose);
  useEffect(() => {
    const frame = frameRef.current;
    const receive = event => {
      if (event.origin !== window.location.origin || event.source !== frame?.contentWindow || event.data?.type !== 'crafted-lens-exit') return;
      onClose();
      requestAnimationFrame(() => document.getElementById('lens-systems')?.scrollIntoView({ behavior: 'auto', block: 'start' }));
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); cleanupRef.current?.(); };
  }, [mode, onClose]);
  const connectKeyboard = () => {
    cleanupRef.current?.();
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = [...doc.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length && !node.closest('[inert]'));
      if (event.shiftKey && doc.activeElement === items[0]) { event.preventDefault(); closeRef.current?.focus(); }
      else if (!event.shiftKey && doc.activeElement === items.at(-1)) { event.preventDefault(); endRef.current?.focus(); }
    };
    doc.addEventListener('keydown', keyboard);
    cleanupRef.current = () => doc.removeEventListener('keydown', keyboard);
  };
  return <div className="lf-story-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="lf-story-dialog" role="dialog" aria-modal="true" aria-labelledby="lf-story-title" ref={panelRef}>
      <header><div><span className="lf-eyebrow">Optical Lab / Lens Focus</span><h2 id="lf-story-title">Punimi, hap pas hapi.</h2></div>
        <label className="lf-story-mode"><span>Mënyra</span><select value={mode} onChange={event => setMode(event.target.value)}><option value="guided">Hap pas hapi</option><option value="scroll">Me scroll</option></select></label>
        <button ref={closeRef} data-autofocus className="lf-icon-button" onClick={onClose} aria-label="Mbyll animacionin"><X size={22} /></button>
      </header>
      <iframe key={mode} ref={frameRef} tabIndex={0} onLoad={connectKeyboard} src={`/crafted-lens/index.html?mode=${mode}&lang=${language}&v=20261004-language`} title="Tetë fazat e punimit të lentes" aria-describedby="lf-story-note" />
      <footer><p id="lf-story-note">{mode === 'guided' ? 'Përdorni Para / Tjetra. Çdo fazë qëndron derisa të vazhdoni.' : 'Lëvizni brenda animacionit ose përdorni Para / Tjetra.'} <span>Ilustrim, jo demonstrim i një produkti të caktuar.</span></p><button ref={endRef} className="lf-link" onClick={onClose}>Kthehu te lentet <X size={15} /></button></footer>
    </section>
  </div>;
}

export default function LensFocusPage({ navigate, content = {} }) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [selected, setSelected] = useState('progressive');
  const [category, setCategory] = useState('Të gjitha'), [query, setQuery] = useState(''), [limit, setLimit] = useState(4);
  const lens = lensChoices.find(item => item.id === selected) || lensChoices[0];
  const categories = ['Të gjitha', ...new Set(blogPosts.map(post => post.category))];
  const articles = blogPosts.filter(post => (category === 'Të gjitha' || post.category === category) && normalizeSearch(`${post.title} ${post.excerpt} ${post.category} ${translate(post.title, 'en')} ${translate(post.excerpt, 'en')} ${translate(post.category, 'en')}`).includes(normalizeSearch(query)));
  const tabKey = (event, index) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? lensChoices.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + lensChoices.length) % lensChoices.length;
    setSelected(lensChoices[next].id);
    document.getElementById(`lens-tab-${lensChoices[next].id}`)?.focus();
  };
  return <div className="lens-focus-studio">
    <section className="lf-hero" aria-labelledby="lf-title">
      <div className="lf-hero-copy"><span className="lf-eyebrow">Optical Lab · Lens Focus</span><h1 id="lf-title">Bota juaj. <br />Në fokus.</h1><p>Lentet e duhura fillojnë me mënyrën si jetoni. Nga receta te punimi në laboratorin tonë, çdo zgjedhje bëhet për ju.</p>
        <div className="lf-actions"><a className="lf-button" href="#lens-systems">Gjeni lentet tuaja <ArrowRight size={18} /></a><button className="lf-link" onClick={() => setStoryOpen(true)}><Play size={16} />Shihni punimin në 3D</button></div>
        <span className="lf-hero-note">Recetë · Matje personale · Laboratori ynë</span>
      </div>
      <figure className="lf-hero-image"><EditorialImage name="lensDetailImage" value={content.lensDetailImage} priority alt="Ilustrim i lentes optike në dritë natyrale" /><figcaption><span>Lente, nga afër <small>Vizual ilustrues</small></span><button onClick={() => setStoryOpen(true)} aria-label="Hap animacionin e punimit të lentes"><Play size={19} fill="currentColor" /></button></figcaption></figure>
    </section>

    <section id="lens-systems" className="lf-selection" aria-labelledby="lf-selection-title">
      <header className="lf-section-heading"><div><span className="lf-eyebrow">01 / Zgjedhja</span><h2 id="lf-selection-title">Si e përdorni shikimin tuaj?</h2></div><p>Krahasoni përdorimin. Zgjedhjen përfundimtare e bëjmë së bashku me optikun.</p></header>
      <div className="lf-tabs" role="tablist" aria-label="Llojet e lenteve">{lensChoices.map((item, index) => <button key={item.id} id={`lens-tab-${item.id}`} type="button" role="tab" aria-selected={selected === item.id} aria-controls="lf-lens-panel" tabIndex={selected === item.id ? 0 : -1} onKeyDown={event => tabKey(event, index)} onClick={() => setSelected(item.id)}><span>{item.label}</span><small>{item.need}</small></button>)}</div>
      <div className="lf-lens-panel" id="lf-lens-panel" role="tabpanel" aria-labelledby={`lens-tab-${selected}`} tabIndex={0}>
        <div className={`lf-lens-diagram is-${lens.id}`} aria-label={`Skemë orientuese: ${lens.zones.join(', ')}`} role="img"><div className="lf-lens-circle">{lens.zones.map((zone, index) => <span key={zone}><i>{String(index + 1).padStart(2, '0')}</i>{zone}</span>)}</div><small>Skemë orientuese · jo recetë</small></div>
        <div className="lf-lens-description"><span className="lf-eyebrow">{lens.label}</span><h3>{lens.title}</h3><p>{lens.copy}</p><dl><div><dt>Përdorimi</dt><dd>{lens.use}</dd></div><div><dt>Diskutojmë</dt><dd>{lens.discuss}</dd></div></dl><p className="lf-lens-note">{lens.note}</p><PageLink navigate={navigate} target="contact" href="/contact#booking">Diskutojeni me optikun</PageLink></div>
      </div>
    </section>

    <section className="lf-treatment" aria-labelledby="lf-treatment-title"><header className="lf-section-heading"><div><span className="lf-eyebrow">02 / Detajet</span><h2 id="lf-treatment-title">Jo vetëm receta.<br />Edhe sipërfaqja ka rëndësi.</h2><p>Materiali, nuanca dhe trajtimet janë pjesë të ndryshme të zgjedhjes. Ja çfarë të diskutoni me optikun.</p></div></header><div className="lf-treatment-list">{lensTreatments.map(([title, text], index) => <details key={title} open={index === 0 ? true : undefined}><summary><span><small>{String(index + 1).padStart(2, '0')}</small>{title}</span><ChevronDown size={18} /></summary><p>{text}</p></details>)}</div></section>

    <section className="lf-fitting" id="lens-measurements" aria-labelledby="lf-fitting-title"><div className="lf-fitting-top"><figure><EditorialImage name="groupLabImage" value={content.groupLabImage} alt="Ilustrim i kontrollit të një lenteje në laborator optik" sizes="(max-width: 700px) 100vw, 45vw" /><figcaption>Punimi optik · imazh ilustrues</figcaption></figure><div><span className="lf-eyebrow">03 / Përshtatja</span><h2 id="lf-fitting-title">Më shumë se<br />një numër në recetë.</h2><p>Korniza, matjet dhe mënyra si i mbani syzet punojnë së bashku. Prandaj porosia kalon nga këshillimi te laboratori ynë dhe përshtatja në optikë.</p><PageLink navigate={navigate} target="brand" href="/laboratory">Njihuni me Optical Lab</PageLink></div></div><ol className="lf-fitting-steps">{lensMeasurements.map(([number, title, text]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></li>)}</ol><p className="lf-fitting-note">Prova virtuale ndihmon për pamjen. Ajo nuk zëvendëson recetën, matjet apo përshtatjen profesionale.</p></section>

    <section className="lf-library" id="lens-guides" aria-labelledby="lf-library-title"><header className="lf-section-heading"><div><span className="lf-eyebrow">04 / Përgjigjet</span><h2 id="lf-library-title">Njihuni më mirë me lentet.</h2></div><p>Udhëzues të shkurtër për t’u përgatitur për bisedën me optikun.</p></header>
      <div className="lf-library-tools"><label><Search size={18} /><input aria-label="Kërko udhëzues për lentet" type="search" placeholder="Kërko: progresive, recetë, kujdes…" value={query} onChange={event => { setQuery(event.target.value); setLimit(4); }} /></label><label className="lf-category"><span>Kategoria</span><select value={category} onChange={event => { setCategory(event.target.value); setLimit(4); }}>{categories.map(item => <option key={item}>{item}</option>)}</select></label><span aria-live="polite">{articles.length} artikuj</span></div>
      <div className="lf-articles">{articles.slice(0, limit).map((post, index) => <article key={post.slug}><div><span>{post.category}</span><small>{guideReadingTime(post)}</small></div><h3><a data-testid={`article-open-${index}`} href={`/lens-focus/articles/${post.slug}`} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate('article', post.slug, `/lens-focus/articles/${post.slug}`); }}>{post.title}<ArrowRight size={20} /></a></h3><p>{post.excerpt}</p></article>)}</div>
      {!articles.length && <div className="lf-empty"><p>Nuk gjetëm artikuj për këtë kërkim.</p><button className="lf-link" onClick={() => { setQuery(''); setCategory('Të gjitha'); setLimit(4); }}>Pastro filtrat <X size={16} /></button></div>}
      {limit < articles.length && <button className="lf-more" onClick={() => setLimit(count => count + 8)}>Më shumë udhëzues <span>{Math.min(limit, articles.length)} / {articles.length}</span><ChevronDown size={17} /></button>}
    </section>
    <section className="lf-next"><div><span className="lf-eyebrow">Hapi tjetër</span><h2>Le t’i gjejmë lentet tuaja.</h2><p>Sillni recetën ose niseni me një ekzaminim. Ne ju ndihmojmë me pjesën tjetër.</p></div><div><PageLink navigate={navigate} target="contact" href="/contact#booking" className="lf-button">Rezervo një takim</PageLink><PageLink navigate={navigate} target="prescription" href="/prescription-glasses">Shiko kornizat me dioptri</PageLink></div></section>
    {storyOpen && <LensStory onClose={() => setStoryOpen(false)} />}
  </div>;
}
