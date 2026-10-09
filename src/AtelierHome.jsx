import { useState } from 'react';
import { ArrowUpRight, Glasses, ScanFace, Ruler, MapPin } from 'lucide-react';
import EditorialImage from './EditorialImage.jsx';
import { EditorialProductCard } from './EditorialPages.jsx';
import { holdingDefaults } from './holdingContent.js';
import { homepageSelection } from './premiumPresentation.js';
import { heroDestination } from './commercePresentation.js';
import { useLanguage } from './i18n/LanguageSwitch.jsx';

function Link({ navigate, page, href, children, className = 'atelier-link', arrow = true }) {
  return <a href={href} className={className} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(page, undefined, href);
  }}>{children}{arrow && <ArrowUpRight size={18} aria-hidden="true" />}</a>;
}

export default function AtelierHome({ navigate, content = {}, products = [], openQuickView, toggleWishlist, wishlist, label, optical = false }) {
  const english = useLanguage() === 'en';
  const t = (sq, en) => english ? en : sq;
  const [selection, setSelection] = useState('all');
  const featured = homepageSelection(products, selection, content.featuredProducts || '');
  const title = optical ? (content.heroTitle || content.title) : content.groupTitle;
  const subtitle = optical ? (content.heroSubtitle || content.subtitle) : content.groupSubtitle;
  const customTitle = title && title !== (optical ? 'Shihni mirë. Jini vetvetja.' : holdingDefaults.groupTitle);
  const customSubtitle = subtitle && subtitle !== (optical ? 'Korniza që ju shkojnë. Lente të punuara për ju, në laboratorin tonë.' : holdingDefaults.groupSubtitle);
  const primary = optical ? heroDestination(content, 'primary') : 'shop';
  const paths = {shop:'/shop',prescription:'/prescription-glasses',sunglasses:'/sunglasses',contact:'/contact#booking',examination:'/ekzaminimi',guides:'/lens-focus',brand:'/laboratory'};
  return <div className="atelier-home">
    <section className="atelier-hero" aria-labelledby="atelier-title">
      <EditorialImage className="atelier-hero-photo" name={optical ? 'heroImage' : 'groupHeroImage'} value={optical ? content.heroImage : content.groupHeroImage} priority sizes="100vw" alt={t('Portret ilustrues i fushatës me korniza optike në acetat', 'Illustrative campaign portrait with acetate optical frames')} />
      <div className="atelier-hero-shade" />
      <div className="atelier-hero-copy">
        <span className="atelier-eyebrow">OPTIKA MIFTARI / {t('NJË KËNDVËSHTRIM PERSONAL', 'A PERSONAL PERSPECTIVE')}</span>
        <h1 id="atelier-title">{customTitle ? title : <>{t('Shihni ndryshe.', 'See differently.')}<br /><em>{t('Jini vetvetja.', 'Be yourself.')}</em></>}</h1>
        <p>{customSubtitle ? subtitle : t('Një kornizë që ju shkon. Një detaj që ndryshon gjithçka.', 'A frame that feels like you. A detail that changes everything.')}</p>
        <Link navigate={navigate} page={primary} href={paths[primary]} className="atelier-button light">{optical && content.primaryCta && content.primaryCta !== 'Shiko kornizat' ? content.primaryCta : t('Zbuloni koleksionin', 'Explore the collection')}</Link>
        {optical && content.secondaryCta && <Link navigate={navigate} page={heroDestination(content,'secondary')} href={paths[heroDestination(content,'secondary')]} className="atelier-secondary">{content.secondaryCta}</Link>}
      </div>
      <div className="atelier-hero-foot"><span>{t('30 VJET KUJDES PËR SHIKIMIN', '30 YEARS OF EYE CARE')}</span><span>{t('Fushatë ilustruese', 'Illustrative campaign')} / 01</span></div>
    </section>
    <nav className="atelier-shop-doors" aria-label={t('Bli sipas koleksionit', 'Shop by collection')}>
      {[[Glasses,'prescription','/prescription-glasses','Syze me dioptri','Optical frames','Për çdo ditë. Për ju.','Every day. Entirely you.'],[Glasses,'sunglasses','/sunglasses','Syze dielli','Sunglasses','Shiheni ditën ndryshe.','A different kind of daylight.'],[ScanFace,'fit','/virtual-try-on','Provojini virtualisht','Find your look','Shikoni si ju shkojnë.','Try your frames virtually.']].map(([Icon,page,href,sq,en,subSq,subEn],i) => <Link key={page} {...{navigate,page,href}} className="atelier-shop-door" arrow={false}><span className="atelier-door-icon"><Icon size={25} strokeWidth={1.25}/></span><span><small>0{i+1}</small><strong>{t(sq,en)}</strong><span>{t(subSq,subEn)}</span></span><ArrowUpRight size={22} strokeWidth={1.3}/></Link>)}
    </nav>
    <section className="atelier-selection" aria-labelledby="atelier-selection-title">
      <div className="atelier-section-head"><div><span className="atelier-eyebrow">{t('PËRZGJEDHJA JONË', 'THE EDIT')}</span><h2 id="atelier-selection-title">{t('Gjeni palën', 'Find your')} <em>{t('tuaj.', 'pair.')}</em></h2></div><Link navigate={navigate} page="shop" href="/shop">{t('Të gjitha kornizat', 'Shop all frames')}</Link></div>
      <div className="atelier-selection-tools" role="group" aria-label={t('Përzgjedhja e kornizave', 'Frame selection')}>{[['all','Të përzgjedhurat','Our selection'],['Prescription Glasses','Me dioptri','Optical'],['Sunglasses','Syze dielli','Sunglasses']].map(([value,sq,en]) => <button key={value} type="button" aria-pressed={selection === value} onClick={() => setSelection(value)}>{t(sq,en)}</button>)}</div>
      <div className="ed-product-grid" aria-live="polite">{featured.map(({product,variants}) => <EditorialProductCard key={`${selection}-${product.id}`} {...{product,variants,label,openQuickView,navigate,toggleWishlist,wishlist}} />)}{!featured.length && <p>{t('Nuk ka modele në këtë përzgjedhje.', 'No frames in this selection.')} <Link navigate={navigate} page="shop" href="/shop">{t('Shikoni katalogun', 'Browse the catalogue')}</Link></p>}</div>
    </section>
    <section className="atelier-collections" aria-label={t('Dy mënyra për të parë botën', 'Two ways to see the world')}>
      <Link navigate={navigate} page="prescription" href="/prescription-glasses" className="atelier-collection optical" arrow={false}><EditorialImage name="prescriptionImage" value={content.prescriptionImage} alt={t('Fushatë ilustruese e kornizave optike', 'Illustrative optical frames campaign')}/><div><span className="atelier-eyebrow">01 / {t('ME DIOPTRI', 'OPTICAL')}</span><h2>{t('Përditshmëria.', 'Everyday.')}<br/><em>{t('Me karakter.', 'With character.')}</em></h2><span className="atelier-collection-cta">{t('Zbuloni kornizat optike', 'Discover optical frames')} <ArrowUpRight size={20}/></span></div></Link>
      <Link navigate={navigate} page="sunglasses" href="/sunglasses" className="atelier-collection sun" arrow={false}><EditorialImage name="groupSunImage" value={content.groupSunImage} alt={t('Portret ilustrues me syze dielli në dritë natyrale', 'Illustrative sunglasses portrait in natural light')}/><div><span className="atelier-eyebrow">02 / {t('SYZE DIELLI', 'SUNGLASSES')}</span><h2>{t('Në dritën', 'In your')}<br/><em>{t('tuaj.', 'own light.')}</em></h2><span className="atelier-collection-cta">{t('Zbuloni syzet e diellit', 'Discover sunglasses')} <ArrowUpRight size={20}/></span></div></Link>
    </section>
    <section className="atelier-fit"><div><span className="atelier-eyebrow">{t('ZGJEDHJA BËHET MË E LEHTË', 'A LITTLE HELP CHOOSING')}</span><h2>{t('Pamja juaj.', 'Your look.')}<br/><em>{t('Pa hamendësime.', 'Less guesswork.')}</em></h2><p>{t('Provoni formën virtualisht, krahasoni masën dhe gjeni lentet për rutinën tuaj. Matjet përfundimtare i kontrollojmë në optikë.', 'Try the shape virtually, compare the fit and explore lenses for your routine. Final measurements are checked in store.')}</p><Link navigate={navigate} page="fit" href="/virtual-try-on" className="atelier-button">{t('Provo një kornizë', 'Try a frame')}</Link></div><div className="atelier-fit-steps">{[[ScanFace,'01','Shihni si ju shkon','See it on you','Kamera ose fotografia juaj.','Your camera or a photograph.','fit','/virtual-try-on'],[Ruler,'02','Gjeni masën tuaj','Find your fit','Krahasoni përmasat e kornizës.','Compare the frame dimensions.','shop','/shop'],[Glasses,'03','Zgjidhni lentet','Choose your lenses','Për recetën dhe përditshmërinë tuaj.','For your prescription and your day.','guides','/lens-focus']].map(([Icon,n,sq,en,subSq,subEn,page,href]) => <Link key={n} {...{navigate,page,href}} className="atelier-fit-step" arrow={false}><span>{n}</span><Icon size={27} strokeWidth={1.2}/><div><h3>{t(sq,en)}</h3><p>{t(subSq,subEn)}</p></div><ArrowUpRight size={20}/></Link>)}</div></section>
    <section className="atelier-craft"><figure><EditorialImage name="groupCraftImage" value={content.groupCraftImage} alt={t('Detaj ilustrues i punimit të kornizave optike', 'Illustrative detail of optical frame craftsmanship')}/></figure><div><span className="atelier-eyebrow">OPTICAL LAB / {t('NGA DUART TONA', 'IN OUR HANDS')}</span><h2>{t('Ju zgjidhni stilin.', 'You choose the style.')}<br/><em>{t('Ne kujdesemi për detajet.', 'We take care of the details.')}</em></h2><p>{t('Nga receta te lentet, montimi dhe përshtatja. Laboratori ynë privat është pjesë e kujdesit që vjen me çdo palë.', 'From prescription to lenses, assembly and fitting. Our private laboratory is part of the care behind every pair.')}</p><Link navigate={navigate} page="brand" href="/laboratory">{t('Brenda laboratorit', 'Inside the laboratory')}</Link></div></section>
    <section className="atelier-visit"><MapPin size={30} strokeWidth={1.1}/><div><span className="atelier-eyebrow">{t('MË MIRË NGA AFËR', 'EVEN BETTER IN PERSON')}</span><h2>{t('Le të gjejmë palën tuaj.', 'Let’s find your pair.')}</h2><p>{t('Provoni, pyesni, zgjidhni. Ne jemi këtu për ju.', 'Try, ask, choose. We’re here for you.')}</p></div><Link navigate={navigate} page="contact" href="/contact#booking" className="atelier-button">{t('Planifikoni vizitën', 'Plan your visit')}</Link></section>
    <nav className="atelier-divisions" aria-label="Miftari Holding Group"><span>MIFTARI HOLDING GROUP</span><Link navigate={navigate} page="optical" href="/optical">Optical</Link><Link navigate={navigate} page="brand" href="/laboratory">Optical Lab</Link><Link navigate={navigate} page="clinic" href="/clinic">{t('Klinika Miftari','Miftari Clinic')}</Link><Link navigate={navigate} page="about" href="/about">{t('Historia jonë','Our story')}</Link></nav>
    <p className="atelier-disclosure">{t('Fotografitë e fushatës janë ilustrime të krijuara me AI, jo fotografi të produkteve të caktuara. Detajet e modeleve dhe varianteve konfirmohen me optikën.', 'Campaign photography is AI-generated illustration, not photography of specific products. Model and variant details are confirmed with the optician.')}</p>
  </div>;
}
