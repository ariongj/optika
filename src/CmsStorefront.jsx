import { useEffect, useState } from 'react';
import './styles/cms-storefront.css';

// CMS campaigns are optional. An empty or unavailable feed adds no placeholder UI.
export default function CmsStorefront({ page, products = [], openQuickView }) {
  const [feed,setFeed] = useState({placements:[],collections:[]});
  const [slide,setSlide] = useState(0);
  useEffect(() => {
    if (!['home','shop'].includes(page)) return;
    const controller = new AbortController();
    const refresh = async () => { if (document.hidden) return; try { const response = await fetch('/api/cms-public.php',{signal:controller.signal,cache:'no-store'}); const data=await response.json(); if(response.ok&&data.ok)setFeed(data); } catch { setFeed({placements:[],collections:[]}); } };
    refresh(); const timer=setInterval(refresh,60000); document.addEventListener('visibilitychange',refresh);
    return () => {controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[page]);
  if(page==='shop') return <>{feed.collections.map(collection => <section className="cms-store-collection" key={collection.id}><h2>{collection.title}</h2><div>{products.filter(p=>collection.productIds.includes(p.id)).map(product=><button key={product.id} onClick={()=>openQuickView(product)}>{product.image&&<img src={product.image} alt={product.imageAlt||product.name} loading="lazy"/>}<strong>{product.name}</strong><span>{new Intl.NumberFormat('sq-AL',{style:'currency',currency:'EUR'}).format(product.salePrice||product.price)}</span></button>)}</div></section>)}</>;
  if(page!=='home')return null;
  const banners=feed.placements.filter(p=>p.position==='home_banner'), active=banners[slide % (banners.length||1)];
  return <>{feed.placements.filter(p=>p.position==='announcement').map(p=><aside className="cms-store-announcement" key={p.id}><span>{p.title}</span><a href={p.href}>{p.cta}</a></aside>)}{active&&<section className="cms-store-banner" aria-roledescription="carousel" aria-label="Ofertat e dyqanit"><div className="cms-store-slide" key={active.id}>{active.image&&<picture>{active.mobileImage&&<source media="(max-width:600px)" srcSet={active.mobileImage}/>}<img src={active.image} alt={active.alt}/></picture>}<div><h2>{active.title}</h2>{active.subtitle&&<p>{active.subtitle}</p>}<a className="primary-button" href={active.href}>{active.cta}</a></div></div>{banners.length>1&&<nav aria-label="Zgjidh ofertën"><button aria-label="Oferta e mëparshme" onClick={()=>setSlide((slide+banners.length-1)%banners.length)}>←</button><span aria-live="polite">{slide%banners.length+1} / {banners.length}</span><button aria-label="Oferta tjetër" onClick={()=>setSlide((slide+1)%banners.length)}>→</button></nav>}</section>}</>;
}
