import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import {
  ArrowRight, ArrowUpRight, CalendarCheck, Eye, FlaskConical, Glasses, Heart, Layers, Menu, PackageSearch, Phone, ScanFace, Search, ShoppingBag,
  Sparkles, Stethoscope, type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Logo } from '@/components/brand/Logo';
import { LangSwitcher } from '@/components/LangSwitcher';
import { ButtonLink } from '@/components/ui/Button';
import { Img } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/Overlay';
import { useDict, useL } from '@/i18n';
import { site } from '@/i18n/site';
import { common } from '@/i18n/common';
import { useUi } from '@/store/ui';
import { isBookingHref, openBooking } from '@/site/components/utility/Booking';
import { useCategories, usePlacements, useSettings } from '@/store/hooks';
import { isPromo, type NavNode } from '@/admin/components/menus/links';
import { useNavMenu } from '@/admin/components/menus/useNav';
import type { L10n } from '@/lib/types';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Main menu (CMS → Menus "main"), with the built-in links as fallback  */
/* ------------------------------------------------------------------ */
/** A header link, already in the shopper's language. */
interface NavItem {
  id: string;
  label: string;
  /** Router path or absolute URL; '' = heading without a link */
  to: string;
  external: boolean;
  type: NavNode['type'];
  image?: string;
  sub?: string;
  /** Icon for picture-less pages in the dropdown (see PAGE_HINTS) */
  icon?: LucideIcon;
  children: NavItem[];
}

/** Built-in pages have no picture: a dropdown tile gets an icon and a one-line description instead. */
const PAGE_HINTS: Record<string, { icon: LucideIcon; sub: L10n }> = {
  '/sherbimet': { icon: Sparkles, sub: { me: 'Pregled, prilagođavanje, popravke i još mnogo toga', sq: 'Kontroll, përshtatje, riparime dhe më shumë', en: 'Eye exams, fittings, repairs and more' } },
  '/rezervo': { icon: CalendarCheck, sub: { me: 'Izaberite uslugu, dan i vreme online', sq: 'Zgjidhni shërbimin, ditën dhe orën online', en: 'Pick the service, day and time online' } },
  '/klinika': { icon: Stethoscope, sub: { me: 'Specijalističke konsultacije za oči', sq: 'Konsulta specialistike për sytë', en: 'Specialist eye consultations' } },
  '/optical-lab': { icon: FlaskConical, sub: { me: 'Dioptrijska sočiva · saradnja B2B', sq: 'Lente me recetë · bashkëpunim B2B', en: 'Prescription lenses · B2B partnerships' } },
  '/gjej-kornizen': { icon: Glasses, sub: { me: 'Kratak kviz — tri okvira koja vam pristaju', sq: 'Kuiz i shkurtër — tri korniza që ju shkojnë', en: 'A short quiz — three frames that suit you' } },
  '/lentet': { icon: Layers, sub: { me: 'Koja sočiva i koji indeks za vaš recept', sq: 'Cilat lente dhe cili indeks për recetën tuaj', en: 'Which lenses and index for your prescription' } },
  '/gjurmo-porosine': { icon: PackageSearch, sub: { me: 'Gde je vaša porudžbina', sq: 'Ku ndodhet porosia juaj', en: 'See where your order is' } },
  '/provo-virtualisht': { icon: ScanFace, sub: { me: 'Kamera, fotografija ili 3D', sq: 'Kamera, foto ose 3D', en: 'Camera, photo or 3D' } },
};
const hintFor = (to: string, external: boolean) => (external ? undefined : PAGE_HINTS[to.split(/[?#]/)[0]]);

const toItem = (n: NavNode, l: (v: L10n) => string): NavItem => ({
  id: n.id,
  label: l(n.label),
  to: n.to,
  external: n.external,
  type: n.type,
  image: n.entity?.image,
  sub: n.entity?.subtitle ? l(n.entity.subtitle) || undefined : (() => { const h = hintFor(n.to, n.external); return h ? l(h.sub) : undefined; })(),
  icon: n.entity?.image ? undefined : hintFor(n.to, n.external)?.icon,
  children: n.children.map((c) => toItem(c, l)),
});

/** Image tile in the mega menu / mobile grid (category, collection, product, offer). */
const isTile = (n: NavItem) => !!n.image && n.type !== 'url' && n.type !== 'page' && !isPromo(n);

/** Header main menu: the CMS menu when it has visible links, otherwise the built-in navigation. */
function useMainNav(): { items: NavItem[]; fallback: boolean } {
  const nodes = useNavMenu('main');
  const cats = useCategories();
  const l = useL();
  const t = useDict(site);
  return useMemo(() => {
    if (nodes.length) return { items: nodes.map((n) => toItem(n, l)), fallback: false };
    const link = (id: string, to: string, label: string): NavItem => {
      const h = hintFor(to, false);
      return { id, label, to, external: false, type: 'url', sub: h ? l(h.sub) : undefined, icon: h?.icon, children: [] };
    };
    return {
      fallback: true,
      items: [
        {
          ...link('nav-products', '/produktet', t('nav_products')),
          children: [
            ...cats.map((c): NavItem => ({ id: c.id, label: l(c.name), to: `/produktet/${c.slug}`, external: false, type: 'category', image: c.image, sub: l(c.tagline), children: [] })),
            link('nav-finder', '/gjej-kornizen', t('nav_finder')),
            link('nav-lens-guide', '/lentet', t('nav_lensGuide')),
            link('nav-sale', '/produktet?akcija=1', t('sale')),
          ],
        },
        link('nav-tryon', TRYON, t('nav_tryon')),
        {
          ...link('nav-services', '/sherbimet', t('nav_services')),
          children: [
            link('nav-services-all', '/sherbimet', t('nav_ourServices')),
            link('nav-book', '/rezervo', t('nav_book')),
            link('nav-clinic', '/klinika', 'Klinika Miftari'),
            link('nav-lab', '/optical-lab', 'Optical Lab'),
          ],
        },
        link('nav-projects', '/lookbook', t('nav_projects')),
        link('nav-about', '/rreth-nesh', t('nav_about')),
        link('nav-blog', '/keshilla', t('nav_blog')),
        link('nav-contact', '/kontakt', t('nav_contact')),
      ],
    };
  }, [nodes, cats, l, t]);
}

const pathOf = (to: string) => to.split(/[?#]/)[0];

/** Virtual try-on page — highlighted in the menu wherever it appears (CMS menu or built-in). */
const TRYON = '/provo-virtualisht';
const isTryOn = (n: Pick<NavItem, 'to' | 'external'>) => !n.external && pathOf(n.to) === TRYON;

/** Highlight a dropdown parent while the shopper is inside its section. */
function inSection(n: NavItem, pathname: string) {
  const shop = n.children.some((c) => c.type === 'category' || c.type === 'product' || c.type === 'collection');
  if (shop && (pathname.startsWith('/produkt') || pathname.startsWith('/koleksioni'))) return true;
  return [n, ...n.children].some((x) => {
    const p = pathOf(x.to);
    return !x.external && p.length > 1 && (pathname === p || pathname.startsWith(`${p}/`));
  });
}

/** Router link, external link or plain block (heading without a target). */
function NavTarget({ item, className, onClick, children }: { item: NavItem; className?: string; onClick?: () => void; children: ReactNode }) {
  if (!item.to) return <div className={className}>{children}</div>;
  if (isBookingHref(item.to))
    return (
      <button
        type="button"
        onClick={() => {
          onClick?.();
          openBooking();
        }}
        className={cn('text-left', className)}
      >
        {children}
      </button>
    );
  if (item.external)
    return (
      <a href={item.to} target="_blank" rel="noreferrer" onClick={onClick} className={className}>
        {children}
      </a>
    );
  return (
    <Link to={item.to} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Announcement bar — live "bar" placements, settings as fallback       */
/* ------------------------------------------------------------------ */
function AnnouncementBar() {
  const settings = useSettings();
  const bar = usePlacements('bar');
  const l = useL();
  const [i, setI] = useState(0);
  const items = useMemo(() => {
    const live = bar.filter((p) => p.title.me.trim()).map((p) => ({ id: p.id, text: p.title, href: p.cta?.href?.trim() ?? '' }));
    return live.length ? live : settings.announcements.map((text, n) => ({ id: `a${n}`, text, href: '' }));
  }, [bar, settings.announcements]);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  const cur = items[i % items.length];
  const textCls = 'truncate font-medium';
  return (
    <div className="relative z-50 bg-ink text-paper">
      <div className="container-x flex h-9 items-center justify-between gap-4 text-[12.5px]">
        <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="hidden items-center gap-1.5 text-paper/75 hover:text-white md:flex">
          <Phone className="h-3.5 w-3.5" /> {settings.phone}
        </a>
        <div className="relative h-full flex-1 overflow-hidden text-center md:max-w-[60%]">
          <AnimatePresence mode="wait">
            <motion.p
              key={cur.id}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 flex items-center justify-center truncate font-medium"
            >
              {!cur.href ? (
                l(cur.text)
              ) : isBookingHref(cur.href) ? (
                <button type="button" onClick={() => openBooking()} className={cn(textCls, 'decoration-paper/40 underline-offset-4 hover:underline')}>
                  {l(cur.text)}
                </button>
              ) : /^(?:https?:|mailto:|tel:)/i.test(cur.href) ? (
                <a href={cur.href} target="_blank" rel="noreferrer" className={cn(textCls, 'decoration-paper/40 underline-offset-4 hover:underline')}>
                  {l(cur.text)}
                </a>
              ) : (
                <Link to={cur.href} className={cn(textCls, 'decoration-paper/40 underline-offset-4 hover:underline')}>
                  {l(cur.text)}
                </Link>
              )}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="hidden md:block">
          <LangSwitcher tone="light" compact />
        </div>
      </div>
    </div>
  );
}

function MegaMenu({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const t = useDict(site);
  const promo = item.children.find((c) => isPromo(c));
  const tiles = item.children.filter((c) => c !== promo);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="absolute inset-x-0 top-full border-t border-line bg-paper shadow-[0_30px_60px_-30px_rgba(28,26,23,0.35)]"
    >
      <div className="container-x grid grid-cols-12 gap-8 py-8">
        <div className={cn('grid gap-3', promo ? 'col-span-9 grid-cols-3' : 'col-span-12 grid-cols-4')}>
          {tiles.map((c) => (
            <NavTarget key={c.id} item={c} onClick={onClose} className="group flex items-center gap-4 rounded-2xl p-2.5 transition-colors hover:bg-white">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">
                {c.image ? (
                  <Img src={c.image} small alt={c.label} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
                    {c.icon ? <c.icon className="h-7 w-7" strokeWidth={1.5} /> : <ArrowUpRight className="h-5 w-5" />}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-ink">{c.label}</div>
                {c.sub && <div className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{c.sub}</div>}
              </div>
            </NavTarget>
          ))}
        </div>
        {promo && (
          <NavTarget item={promo} onClick={onClose} className="group relative col-span-3 overflow-hidden rounded-2xl bg-ink">
            <Img src={promo.image ?? '/images/misc/promo.webp'} small alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
            <div className="relative flex h-full min-h-[180px] flex-col justify-end p-5 text-white">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-200">{promo.label}</span>
              <span className="mt-1 font-display text-2xl leading-tight">{promo.type === 'offer' ? promo.sub ?? '' : '−20%'}</span>
              <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold">
                {t('seeAll')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </NavTarget>
        )}
      </div>
    </motion.div>
  );
}

export function Header({ transparentTop = false }: { transparentTop?: boolean }) {
  const t = useDict(site);
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState<string | null>(null);
  const cartCount = useUi((s) => s.cart.length);
  const wishCount = useUi((s) => s.wishlist.length);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { items: nav, fallback } = useMainNav();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    setMega(null);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const megaItem = mega ? nav.find((n) => n.id === mega && n.children.length) : undefined;
  const solid = !transparentTop || scrolled || !!megaItem;
  const tone = solid ? 'dark' : 'light';

  const settings = useSettings();

  const linkCls = (active: boolean) =>
    cn(
      'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-2 text-[14px] font-semibold transition-colors xl:px-3 xl:text-[14.5px] 2xl:px-3.5',
      solid ? (active ? 'text-ink' : 'text-ink-soft hover:text-ink') : active ? 'text-white' : 'text-white/85 hover:text-white',
    );

  /** Try-on link gets a face-scan icon and a soft "new" dot. */
  const tryOnIcon = <ScanFace className={cn('h-4 w-4 shrink-0', solid ? 'text-brand-600' : 'text-brand-200')} />;
  const tryOnDot = (
    <span aria-hidden className="absolute right-0.5 top-1 flex h-2 w-2">
      <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 [animation-duration:2.4s]', solid ? 'bg-brand-400' : 'bg-brand-200')} />
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', solid ? 'bg-brand-500' : 'bg-brand-200')} />
    </span>
  );

  const iconBtn = cn('relative grid h-10 w-10 place-items-center rounded-full transition-colors', solid ? 'text-ink hover:bg-ink/[0.06]' : 'text-white hover:bg-white/10');

  return (
    <>
      <AnnouncementBar />
      <header
        className={cn(
          'sticky top-0 z-40 transition-[background,box-shadow,border-color] duration-300',
          solid ? 'border-b border-line/80 bg-paper/90 backdrop-blur-xl' : 'border-b border-transparent bg-transparent',
          transparentTop && '-mb-[76px]',
        )}
        onMouseLeave={() => setMega(null)}
      >
        <div className="container-x flex h-[76px] items-center gap-3">
          <button className={cn(iconBtn, 'lg:hidden -ml-2')} onClick={() => setMobileOpen(true)} aria-label={t('menu')}>
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="shrink-0" aria-label={settings.companyName}>
            <Logo tone={tone} className="h-[42px] xl:h-[46px]" />
          </Link>

          <nav className="ml-4 hidden items-center gap-0 lg:flex 2xl:ml-6">
            {nav.map((n) =>
              n.children.length ? (
                <button
                  key={n.id}
                  type="button"
                  onMouseEnter={() => setMega(n.id)}
                  onClick={() => setMega((m) => (m === n.id ? null : n.id))}
                  className={linkCls(inSection(n, location.pathname) || mega === n.id)}
                  aria-expanded={mega === n.id}
                >
                  {n.label}
                </button>
              ) : isBookingHref(n.to) ? (
                <button key={n.id} type="button" onMouseEnter={() => setMega(null)} onClick={() => openBooking()} className={linkCls(false)}>
                  {n.label}
                </button>
              ) : n.external ? (
                <a key={n.id} href={n.to} target="_blank" rel="noreferrer" onMouseEnter={() => setMega(null)} className={linkCls(false)}>
                  {n.label}
                </a>
              ) : (
                <NavLink key={n.id} to={n.to} onMouseEnter={() => setMega(null)} className={({ isActive }) => linkCls(isActive)}>
                  {isTryOn(n) && tryOnIcon}
                  {n.label}
                  {isTryOn(n) && tryOnDot}
                </NavLink>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <button className={iconBtn} onClick={() => setSearchOpen(true)} aria-label={t('searchPlaceholder')}>
              <Search className="h-[19px] w-[19px]" />
            </button>
            <Link to="/te-preferuarat" className={cn(iconBtn, 'hidden sm:grid')} aria-label={t('wishlist')}>
              <Heart className="h-[19px] w-[19px]" />
              {wishCount > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{wishCount}</span>}
            </Link>
            <button className={iconBtn} onClick={() => setCartOpen(true)} aria-label={t('cart')}>
              <ShoppingBag className="h-[19px] w-[19px]" />
              {cartCount > 0 && (
                <span key={cartCount} className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] animate-pop place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
            {/* Wrapper carries the breakpoint: the button's own `inline-flex` would win over `hidden` (cn has no tailwind-merge). */}
            <span className="ml-2 hidden xl:inline-flex">
              <ButtonLink to="/rezervo" variant={solid ? 'primary' : 'light'} size="sm" icon={<Eye className="h-4 w-4" />}>
                {t('freeMeasure')}
              </ButtonLink>
            </span>
          </div>
        </div>
        <AnimatePresence>{megaItem && <MegaMenu key={megaItem.id} item={megaItem} onClose={() => setMega(null)} />}</AnimatePresence>
      </header>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} nav={nav} fallback={fallback} />
    </>
  );
}

interface MobileRow {
  key: string;
  to: string;
  label: string;
  external: boolean;
  /** Indented sub-links shown under the row */
  sub: NavItem[];
}

function MobileMenu({ open, onClose, nav, fallback }: { open: boolean; onClose: () => void; nav: NavItem[]; fallback: boolean }) {
  const t = useDict(site);
  const tc = useDict(common);
  const settings = useSettings();
  // The first dropdown with image tiles (Proizvodi) drives the category grid; its link becomes "All products".
  const shop = nav.find((n) => n.children.some(isTile));
  const tiles = shop ? shop.children.filter(isTile) : [];
  const links: MobileRow[] = [
    { key: 'home', to: '/', label: t('home'), external: false, sub: [] },
    ...nav.map((n) =>
      n === shop
        ? { key: n.id, to: n.to || '/produktet', label: n.to ? t('allProducts') : n.label, external: n.external, sub: fallback ? [] : n.children.filter((c) => !isTile(c)) }
        : { key: n.id, to: n.to, label: n.label, external: n.external, sub: n.children },
    ),
  ];
  const rowCls = 'border-b border-line py-3.5 text-[17px] font-semibold';
  return (
    <Drawer open={open} onClose={onClose} side="left" title={<Logo className="h-9" />} width="max-w-[380px]">
      <div className="px-5 py-5">
        {tiles.length > 0 && (
          <>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{t('categories')}</div>
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((c, i) => (
                <NavTarget key={c.id} item={c} onClick={onClose} className={cn('group relative h-24 overflow-hidden rounded-xl bg-ink', tiles.length % 2 === 1 && i === 0 && 'col-span-2')}>
                  <Img src={c.image} small alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                  <span className="absolute bottom-2 left-3 right-3 truncate text-sm font-semibold text-white">{c.label}</span>
                </NavTarget>
              ))}
            </div>
          </>
        )}
        <nav className={cn('flex flex-col', tiles.length > 0 && 'mt-6')}>
          {links.map((n) => (
            <div key={n.key} className="flex flex-col">
              {!n.to ? (
                <span className={cn(rowCls, 'text-ink')}>{n.label}</span>
              ) : isBookingHref(n.to) ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openBooking();
                  }}
                  className={cn(rowCls, 'text-left text-ink')}
                >
                  {n.label}
                </button>
              ) : n.external ? (
                <a href={n.to} target="_blank" rel="noreferrer" onClick={onClose} className={cn(rowCls, 'text-ink')}>
                  {n.label}
                </a>
              ) : isTryOn(n) ? (
                <NavLink to={n.to} onClick={onClose} className={({ isActive }) => cn(rowCls, 'flex items-center gap-2.5', isActive ? 'text-brand-700' : 'text-ink')}>
                  <ScanFace className="h-[18px] w-[18px] text-brand-600" />
                  {n.label}
                  <span className="ml-auto rounded-full bg-brand-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand-700 ring-1 ring-brand-100">{tc('badge_new')}</span>
                </NavLink>
              ) : (
                <NavLink to={n.to} end onClick={onClose} className={({ isActive }) => cn(rowCls, isActive ? 'text-brand-700' : 'text-ink')}>
                  {n.label}
                </NavLink>
              )}
              {n.sub.map((c) => (
                <NavTarget
                  key={c.id}
                  item={c}
                  onClick={onClose}
                  className={cn('border-b border-line py-3 pl-4 text-[15px]', isPromo(c) ? 'font-semibold text-brand-700' : 'font-medium text-ink-soft')}
                >
                  {c.label}
                </NavTarget>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-6 flex items-center justify-between">
          <LangSwitcher align="left" />
          <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Phone className="h-4 w-4" /> {settings.phone}
          </a>
        </div>
        <ButtonLink to="/rezervo" onClick={onClose} className="mt-6 w-full" size="lg" icon={<Eye className="h-4 w-4" />}>
          {t('freeMeasure')}
        </ButtonLink>
      </div>
    </Drawer>
  );
}
