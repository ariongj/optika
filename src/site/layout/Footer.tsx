import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Clock, Mail, MapPin, Phone, ArrowUp, ScanFace } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/brand/Logo';
import { InstagramIcon, FacebookIcon, WhatsAppIcon } from '@/components/brand/Social';
import { defineDict, useDict, useL } from '@/i18n';
import { site } from '@/i18n/site';
import { common } from '@/i18n/common';
import { useCategories, useSettings } from '@/store/hooks';
import { useDb } from '@/store/db';
import { isPromo, type NavNode } from '@/admin/components/menus/links';
import { useNavMenu } from '@/admin/components/menus/useNav';
import { cn } from '@/lib/utils';
import { isBookingHref, openBooking } from '@/site/components/utility/Booking';

/** Footer-only copy (the shared footer strings live in `site`). */
const F = defineDict({
  me: { group: 'Deo grupe Miftari Holding Group', vatNo: 'PDV br.', country: 'Kosovo', bank: 'Uplata na račun' },
  sq: { group: 'Pjesë e Miftari Holding Group', vatNo: 'Nr. TVSH', country: 'Kosovë', bank: 'Transfertë bankare' },
  en: { group: 'Part of Miftari Holding Group', vatNo: 'VAT no.', country: 'Kosovo', bank: 'Bank transfer' },
});

/** The three parts of the group, shown under the logo. */
const DIVISIONS = ['Optika Miftari', 'Optical Lab', 'Klinika Miftari'];

const socialCls = 'grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] transition-colors hover:bg-white hover:text-ink';

export function Footer() {
  const t = useDict(site);
  const f = useDict(F);
  const l = useL();
  const settings = useSettings();
  const menu = useNavMenu('footer');
  const [email, setEmail] = useState('');
  const year = new Date().getFullYear();
  const ig = (settings.instagram ?? '').trim().replace(/^@/, '');
  const wa = (settings.whatsapp ?? '').replace(/\D/g, '');
  const pays = [
    ...(settings.payments.card ? ['VISA', 'Mastercard', 'Maestro'] : []),
    ...(settings.payments.bank ? [f('bank')] : []),
    ...(settings.payments.cod ? [t('payCod')] : []),
  ];

  return (
    <footer className="relative mt-24 overflow-hidden bg-ink text-paper">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-60" />
      <div className="container-x relative">
        {/* Newsletter */}
        <div className="grid gap-8 border-b border-white/10 py-14 lg:grid-cols-2 lg:items-end">
          <div>
            <h2 className="display max-w-lg text-3xl leading-tight text-white sm:text-4xl">{t('newsTitle')}</h2>
            <p className="mt-3 max-w-md text-[15px] text-paper/60">{t('newsText')}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\S+@\S+\.\S+$/.test(email)) return;
              toast.success(t('subscribed'));
              setEmail('');
            }}
            className="flex w-full max-w-lg gap-2 rounded-full bg-white/[0.07] p-1.5 ring-1 ring-white/10 focus-within:ring-white/30 lg:justify-self-end"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('newsPlaceholder')}
              aria-label={t('newsPlaceholder')}
              className="min-w-0 flex-1 bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-paper/40"
            />
            <button type="submit" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50">
              {t('subscribe')} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Columns */}
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo tone="light" className="h-14" />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-paper/60">{t('footerAbout')}</p>
            <div className="mt-5">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-paper/40">{f('group')}</div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {DIVISIONS.map((d) => (
                  <span key={d} className="rounded-full border border-white/12 px-2.5 py-1 text-[11.5px] font-semibold text-paper/70">
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              {ig && (
                <a href={`https://www.instagram.com/${ig}/`} target="_blank" rel="noreferrer" className={socialCls} aria-label="Instagram">
                  <InstagramIcon className="h-[18px] w-[18px]" />
                </a>
              )}
              {settings.facebook && (
                <a href={settings.facebook} target="_blank" rel="noreferrer" className={socialCls} aria-label="Facebook">
                  <FacebookIcon className="h-[18px] w-[18px]" />
                </a>
              )}
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={socialCls} aria-label="WhatsApp">
                  <WhatsAppIcon className="h-[18px] w-[18px]" />
                </a>
              )}
            </div>
          </div>

          {menu.length ? <MenuColumns nodes={menu} /> : <DefaultColumns />}

          <div className="lg:col-span-4">
            <h3 className={headCls}>{t('footer_contact')}</h3>
            <ul className="space-y-4 text-[14.5px] text-paper/80">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                <a href={settings.mapUrl} target="_blank" rel="noreferrer" className="hover:text-white">
                  {settings.address}, {settings.city}, {f('country')}
                </a>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                <span>
                  <a href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`} className="hover:text-white">
                    {settings.phone}
                  </a>
                  {wa && (
                    <>
                      <span className="text-paper/35"> · </span>
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="hover:text-white">
                        WhatsApp
                      </a>
                    </>
                  )}
                </span>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                <a href={`mailto:${settings.email}`} className="hover:text-white">
                  {settings.email}
                </a>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                <span>{l(settings.hours)}</span>
              </li>
              {ig && (
                <li className="flex gap-3">
                  <InstagramIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                  <a href={`https://www.instagram.com/${ig}/`} target="_blank" rel="noreferrer" className="hover:text-white">
                    @{ig}
                  </a>
                </li>
              )}
            </ul>
            {pays.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {pays.map((p) => (
                  <span key={p} className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-paper/70">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-[12.5px] text-paper/45 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {settings.legalName}
            {settings.pib && (
              <>
                {' '}
                · {t('taxId')} {settings.pib}
              </>
            )}
            {settings.pdv && (
              <>
                {' '}
                · {f('vatNo')} {settings.pdv}
              </>
            )}{' '}
            · {t('rights')}
          </span>
          <span className="flex items-center gap-5">
            <Link to="/admin" className="hover:text-white">
              {t('adminLink')}
            </Link>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-1.5 hover:text-white">
              {t('backToTop')} <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Link columns from the CMS footer menu                               */
/* ------------------------------------------------------------------ */
const headCls = 'mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-paper/45';
const linkCls = 'link-u text-paper/80 hover:text-white';

interface FooterGroup {
  id: string;
  heading: string;
  to: string;
  external: boolean;
  links: NavNode[];
}

/** Router link or external link with the footer styling. */
function FooterLink({ node, className, children }: { node: Pick<NavNode, 'to' | 'external'>; className: string; children: ReactNode }) {
  if (isBookingHref(node.to))
    return (
      <button type="button" onClick={() => openBooking()} className={cn('text-left', className)}>
        {children}
      </button>
    );
  return node.external ? (
    <a href={node.to} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link to={node.to} className={className}>
      {children}
    </Link>
  );
}

/** Virtual try-on link: a small face-scan icon and a "new" tag. */
function TryOnLabel({ label }: { label: string }) {
  const tc = useDict(common);
  return (
    <span className="inline-flex items-center gap-1.5">
      <ScanFace className="h-3.5 w-3.5 text-brand-300" />
      {label}
      <span className="ml-1 rounded-full bg-brand-600/60 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.12em] text-white">{tc('badge_new')}</span>
    </span>
  );
}

const isTryOn = (to: string) => to.split(/[?#]/)[0] === '/provo-virtualisht';

/**
 * Top-level items with sub-links become columns (heading + links); loose top-level links share one column.
 * Columns fill the two middle slots of the grid (1 | 2 stacked for three columns).
 */
function MenuColumns({ nodes }: { nodes: NavNode[] }) {
  const l = useL();
  const groups = useMemo(() => {
    const out: FooterGroup[] = nodes.filter((n) => n.children.length).map((n) => ({ id: n.id, heading: l(n.label), to: n.to, external: n.external, links: n.children }));
    const loose = nodes.filter((n) => !n.children.length);
    if (loose.length) out.push({ id: 'loose', heading: '', to: '', external: false, links: loose });
    return out;
  }, [nodes, l]);
  const split = Math.floor(groups.length / 2);
  const slots = groups.length === 1 ? [groups] : [groups.slice(0, split), groups.slice(split)];
  return (
    <>
      {slots.map((slot, si) => (
        <div key={si} className={groups.length === 1 ? 'lg:col-span-4' : 'lg:col-span-2'}>
          {slot.map((g, gi) => (
            <div key={g.id}>
              {g.heading && (
                <h3 className={cn(headCls, gi > 0 && 'mt-8')}>
                  {g.to ? (
                    <FooterLink node={g} className="transition-colors hover:text-paper/80">
                      {g.heading}
                    </FooterLink>
                  ) : (
                    g.heading
                  )}
                </h3>
              )}
              <ul className={cn('space-y-2.5 text-[14.5px]', !g.heading && gi > 0 && 'mt-8')}>
                {g.links.map((n) => (
                  <li key={n.id}>
                    <FooterLink node={n} className={isPromo(n) ? 'link-u font-semibold text-brand-200 hover:text-white' : linkCls}>
                      {!n.external && isTryOn(n.to) ? <TryOnLabel label={l(n.label)} /> : l(n.label)}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/** Built-in columns, shown while the footer menu has no visible links. */
function DefaultColumns() {
  const t = useDict(site);
  const l = useL();
  const cats = useCategories();
  const allPages = useDb((s) => s.pages);
  const pages = useMemo(() => allPages.filter((p) => p.published && p.showInFooter), [allPages]);
  return (
    <>
      <div className="lg:col-span-2">
        <h3 className={headCls}>{t('footer_shop')}</h3>
        <ul className="space-y-2.5 text-[14.5px]">
          {cats.map((c) => (
            <li key={c.id}>
              <Link to={`/produktet/${c.slug}`} className={linkCls}>
                {l(c.name)}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/produktet?akcija=1" className="link-u font-semibold text-brand-200 hover:text-white">
              {t('sale')}
            </Link>
          </li>
          <li>
            <Link to="/provo-virtualisht" className={linkCls}>
              <TryOnLabel label={t('nav_tryon')} />
            </Link>
          </li>
        </ul>
      </div>

      <div className="lg:col-span-2">
        <h3 className={headCls}>{t('footer_company')}</h3>
        <ul className="space-y-2.5 text-[14.5px]">
          {[
            ['/rreth-nesh', t('nav_about')],
            ['/sherbimet', t('nav_services')],
            ['/lookbook', t('nav_projects')],
            ['/keshilla', t('nav_blog')],
            ['/kontakt', t('nav_contact')],
          ].map(([to, label]) => (
            <li key={to}>
              <Link to={to} className={linkCls}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        {pages.length > 0 && (
          <>
            <h3 className={cn(headCls, 'mt-8')}>{t('footer_help')}</h3>
            <ul className="space-y-2.5 text-[14.5px]">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link to={`/faqe/${p.slug}`} className={linkCls}>
                    {l(p.title)}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
