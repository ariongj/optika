import { useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import EditorialImage from './EditorialImage.jsx';
import { EditorialProductCard } from './EditorialPages.jsx';
import { holdingCopy } from './holdingContent.js';
import { homepageSelection } from './premiumPresentation.js';

function Link({ navigate, page, href, children, className = 'ed-link', arrow = true }) {
  return <a href={href} className={className} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(page, undefined, href);
  }}>{children}{arrow && <ArrowRight size={18} aria-hidden="true" />}</a>;
}

export default function PremiumHome({ navigate, content = {}, products = [], openQuickView, toggleWishlist, wishlist, label }) {
  const copy = holdingCopy(content);
  const [selection, setSelection] = useState('all');
  const featured = homepageSelection(products, selection, content.featuredProducts || '');
  return <div className="mh-home">
    <section className="mh-hero" aria-labelledby="group-title">
      <div className="mh-hero-copy">
        <span className="ed-kicker">Miftari Holding Group · 30 vjet kujdes familjar</span>
        <h1 id="group-title">{copy.groupTitle}</h1>
        <p>{copy.groupSubtitle}</p>
        <div className="mh-actions"><Link navigate={navigate} page="shop" href="/shop" className="primary-button">Gjeni syzet tuaja</Link><Link navigate={navigate} page="contact" href="/contact#booking">Rezervoni një vizitë</Link></div>
        <div className="mh-hero-signature"><span>Një familje. Tri specializime.</span><span>Optical / Lab / Klinikë</span></div>
      </div>
      <figure className="mh-hero-image"><EditorialImage name="groupHeroImage" value={content.groupHeroImage} priority sizes="(max-width: 680px) 100vw, 60vw" alt="Dy breza me syze optike, duke ndarë një buzëqeshje — portret ilustrues i fushatës, jo familja Miftari" />{!content.groupHeroImage && <figcaption>Fushatë ilustruese</figcaption>}</figure>
    </section>

    <nav className="mh-division-entry" aria-label="Departamentet e Miftari Holding Group">
      {[
        { name: 'Optical', detail: 'Stil, korniza dhe syze dielli', image: 'groupOpticalImage', page: 'optical', href: '/optical' },
        { name: 'Optical Lab', detail: 'Lente me recetë · partnerë B2B', image: 'groupLabImage', page: 'brand', href: '/laboratory' },
        { name: 'Klinika Miftari', detail: 'Kujdes specialistik për sytë', image: 'clinicImage', page: 'clinic', href: '/clinic' },
      ].map(({ name, detail, image, page, href }) => <Link key={name} navigate={navigate} page={page} href={href} className="mh-division-link" arrow={false}><EditorialImage name={image} value={content[image]} alt="" sizes="84px" /><span><strong>{name}</strong><small>{detail}</small></span><ArrowUpRight size={19} aria-hidden="true" /></Link>)}
    </nav>

    <section className="mh-selection" aria-labelledby="mh-selection-title">
      <div className="mh-section-heading"><div><span className="ed-kicker">Optical · Një zgjedhje personale</span><h2 id="mh-selection-title">Një palë që ju ngjan.</h2></div><Link navigate={navigate} page="shop" href="/shop">Të gjitha kornizat</Link></div>
      <div className="mh-selection-tools"><div role="group" aria-label="Përzgjedhja e kornizave">{[['all', 'Për ju'], ['Prescription Glasses', 'Me dioptri'], ['Sunglasses', 'Syze dielli']].map(([value, text]) => <button key={value} type="button" aria-pressed={selection === value} onClick={() => setSelection(value)}>{text}</button>)}</div><span>Shikojini nga afër, pa lënë faqen.</span></div>
      <div className="ed-product-grid" aria-live="polite">{featured.map(({ product, variants }) => <EditorialProductCard key={`${selection}-${product.id}`} product={product} variants={variants} label={label} openQuickView={openQuickView} navigate={navigate} toggleWishlist={toggleWishlist} wishlist={wishlist} />)}{featured.length === 0 && <p className="mh-empty">Nuk ka modele në këtë kategori për momentin. <Link navigate={navigate} page="shop" href="/shop">Shikoni katalogun</Link></p>}</div>
    </section>

    <section className="mh-collections" aria-label="Zbuloni koleksionet">
      <article><Link navigate={navigate} page="prescription" href="/prescription-glasses" className="mh-collection-image" arrow={false}><EditorialImage name="groupOpticalImage" value={content.groupOpticalImage} alt="Kompozim ilustrues i kornizave optike dhe syzeve të diellit" /><span className="mh-image-tag">Përditshmëria, në fokus</span><span className="sr-only">Shikoni syzet me dioptri</span></Link><div><h2>Stili juaj. Receta juaj.</h2><Link navigate={navigate} page="prescription" href="/prescription-glasses">Syze me dioptri</Link></div></article>
      <article><Link navigate={navigate} page="sunglasses" href="/sunglasses" className="mh-collection-image" arrow={false}><EditorialImage name="groupSunImage" value={content.groupSunImage} alt="Portret ilustrues i fushatës: burrë me syze dielli në dritë natyrale" /><span className="mh-image-tag">Jeta, në dritë tjetër</span><span className="sr-only">Shikoni syzet e diellit</span></Link><div><h2>Më shumë ditë me diell.</h2><Link navigate={navigate} page="sunglasses" href="/sunglasses">Syze dielli</Link></div></article>
    </section>

    <section className="mh-craft" aria-labelledby="mh-craft-title">
      <figure><EditorialImage name="groupCraftImage" value={content.groupCraftImage} alt="Duart e një optiku duke kontrolluar kornizën — fotografi ilustruese e punimit" />{!content.groupCraftImage && <figcaption>Detaj ilustrues i punimit optik</figcaption>}</figure>
      <div className="mh-craft-copy"><span className="ed-kicker">Optical Lab · Laboratori ynë privat</span><h2 id="mh-craft-title">Pas çdo pale,<br /><em>një punë me kujdes.</em></h2><p>30 vjet përvojë na kanë mësuar të mos e lëmë kujdesin te zgjedhja e kornizës. Receta, lentet, montimi dhe përshtatja janë pjesë e së njëjtës përgjegjësi.</p><p>Porosia juaj punohet përmes nesh, në laboratorin tonë. Pa ndërmjetësues.</p><Link navigate={navigate} page="brand" href="/laboratory">Shihni si punojmë</Link><div className="mh-craft-partners"><span>Për profesionistët e optikës</span><Link navigate={navigate} page="partners" href="/laboratory/partners">Partneritet B2B · Kosovë & BE</Link></div></div>
    </section>

    <section className="mh-group-story" aria-labelledby="mh-group-story-title">
      <div><span className="ed-kicker">Një familje. Një drejtim i përbashkët.</span><h2 id="mh-group-story-title">Tri specializime.<br />Një emër që i bashkon.</h2><Link navigate={navigate} page="about" href="/about">Njihuni me grupin</Link></div>
      <div><p>Miftari Holding Group zotëron Optical, Optical Lab dhe Klinikën Miftari. Secili departament ka fokusin e vet: zgjedhjen e syzeve, punimin e lenteve ose kujdesin klinik.</p><p>Nga një palë e re te një porosi profesionale ose një vizitë me specialistin — drejtohuni te ekipi i duhur, brenda të njëjtit grup familjar.</p><span className="mh-group-note">30 vjet përvojë · Kosovë · Bashkëpunim laboratorik me partnerë në BE</span></div>
    </section>

    <section className="mh-visit"><div><span className="ed-kicker">Nga ekrani, te kujdesi personal</span><h2>Le të takohemi.</h2><p>Provoni kornizat, diskutoni lentet dhe gjeni hapin e duhur për shikimin tuaj.</p></div><div><Link navigate={navigate} page="contact" href="/contact#booking" className="primary-button">Rezervoni një vizitë</Link><a className="ed-link" href="tel:+38343777667">+383 43 777 667 <ArrowUpRight size={17} /></a></div></section>
    <p className="mh-image-disclosure">Imazhet e fushatës janë ilustruese. Kornizat dhe opsionet e blerjes gjenden në katalog.</p>
  </div>;
}
