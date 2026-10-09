import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { guideDetails, guideReadingTime, guideSources } from './guideContent.js';

export default function AdviceArticle({ article, articles, navigate }) {
  const detail = guideDetails[article.slug];
  const related = [...articles.filter(p => p.category === article.category && p.slug !== article.slug), ...articles.filter(p => p.category !== article.category)].slice(0, 3);
  const source = guideSources[article.category];
  const link = (event, page, slug, path) => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(page, slug, path); };
  return <article className="advice-page">
    <a className="ed-link" href="/lens-focus#lens-guides" onClick={e => link(e, 'guides', undefined, '/lens-focus#lens-guides')}><ArrowLeft size={16}/> Kthehu te udhëzuesit</a>
    <header><span className="ed-kicker">{article.category} · {guideReadingTime(article)} lexim</span><h1>{article.title}</h1><p>{article.excerpt}</p></header>
    <div className="advice-layout"><div>
      {detail && <section><h2>{detail[0]}</h2><p>{detail[1]}</p></section>}
      <section><h2>Mbani parasysh</h2><ul className="advice-checklist">{article.points.map(point => <li key={point}><Check size={18}/><span>{point}</span></li>)}</ul></section>
      {detail && <section className="advice-question"><span className="ed-kicker">Një pyetje për takimin tuaj</span><h2>“{detail[2]}”</h2><a className="ed-link" href="/contact#booking" onClick={e => link(e, 'contact', undefined, '/contact#booking')}>Diskutojeni me optikun <ArrowRight size={16}/></a></section>}
      <p className="advice-disclaimer">Udhëzues i përgjithshëm, jo diagnozë ose recetë. Zgjedhja dhe matjet përfundimtare kërkojnë vlerësim individual nga profesionisti.</p>
      {source && <p className="advice-source">Lexim plotësues: <a href={source[1]} target="_blank" rel="noopener noreferrer">{source[0]}</a>. Burimi nuk nënkupton partneritet me Miftari.</p>}
    </div><aside><span className="ed-kicker">Vazhdoni me</span><h2>Nga informacioni, te zgjedhja juaj.</h2><a href="/prescription-glasses" onClick={e => link(e, 'prescription', undefined, '/prescription-glasses')}>Kornizat optike <ArrowRight size={17}/></a><a href="/laboratory" onClick={e => link(e, 'brand', undefined, '/laboratory')}>Laboratori ynë <ArrowRight size={17}/></a><a href="/contact#booking" onClick={e => link(e, 'contact', undefined, '/contact#booking')}>Kërko një takim <ArrowRight size={17}/></a></aside></div>
    <section className="advice-related"><h2>Edhe këto mund t’ju ndihmojnë.</h2><div>{related.map(post => <a key={post.slug} href={`/lens-focus/articles/${post.slug}`} onClick={e => link(e, 'article', post.slug, `/lens-focus/articles/${post.slug}`)}><span className="ed-kicker">{post.category} · {guideReadingTime(post)}</span><h3>{post.title}</h3><span className="ed-link">Lexo udhëzuesin <ArrowRight size={16}/></span></a>)}</div></section>
  </article>;
}
