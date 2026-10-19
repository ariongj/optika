import { Link } from 'react-router';
import {
  Aperture, ArrowUpRight, BookOpen, CalendarCheck, FileText, FlaskConical, Glasses, Images, Layers, MapPin, PackageSearch, ScanFace, Sparkles, Stethoscope, Users,
  type LucideIcon,
} from 'lucide-react';
import { defineDict, lt, useDict } from '@/i18n';
import { fold } from '@/lib/search';
import type { CmsPage, L10n, Lang, Post } from '@/lib/types';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Site search beyond products: built-in pages, CMS pages, advice posts */
/* ------------------------------------------------------------------ */
const T = (me: string, sq: string, en: string): L10n => ({ me, sq, en });

interface StaticPage {
  to: string;
  icon: LucideIcon;
  title: L10n;
  sub: L10n;
  /** Extra search words in every language (folded when matched) */
  keys: string;
}

const STATIC_PAGES: StaticPage[] = [
  { to: '/rezervo', icon: CalendarCheck, title: T('Zakažite termin', 'Rezervo termin', 'Book an appointment'), sub: T('Pregled vida, prilagođavanje, sočiva', 'Kontroll i syve, përshtatje, lente kontakti', 'Eye exam, fitting, contact lenses'), keys: 'rezervo termin kontroll ekzaminim syve pregled vida zakazi appointment book exam eye test orari' },
  { to: '/sherbimet', icon: Sparkles, title: T('Usluge', 'Shërbimet', 'Services'), sub: T('Pregled, laboratorija, popravke', 'Kontroll, laborator, riparime', 'Exams, lab, repairs'), keys: 'sherbimet usluge services riparim popravka repair rregullim adjustment pd matje' },
  { to: '/klinika', icon: Stethoscope, title: T('Klinika Miftari', 'Klinika Miftari', 'Klinika Miftari'), sub: T('Specijalističke konsultacije', 'Konsulta specialistike për sytë', 'Specialist eye consultations'), keys: 'klinika clinic oftalmolog ophthalmologist doktor mjek lekar konsulte konsultacija consultation' },
  { to: '/optical-lab', icon: FlaskConical, title: T('Optical Lab', 'Optical Lab', 'Optical Lab'), sub: T('Dioptrijska sočiva · B2B', 'Lente me recetë · B2B për optikat', 'Prescription lenses · B2B'), keys: 'laborator laboratorija lab b2b optika partner bashkepunim saradnja partnership lente sociva lenses' },
  { to: '/lentet', icon: Layers, title: T('Vodič kroz sočiva', 'Udhëzuesi i lenteve', 'Lens guide'), sub: T('Koja sočiva i koji indeks', 'Cilat lente dhe cili indeks', 'Which lenses and which index'), keys: 'lente lentet sociva lenses progresive progressive njevizore single indeks index 1.67 1.74 antirefleks fotokromatike photochromic drita blu blue light' },
  { to: '/gjej-kornizen', icon: Glasses, title: T('Pronađite svoj okvir', 'Gjeni kornizën tuaj', 'Find your frame'), sub: T('Kviz za oblik lica i stil', 'Kuiz për formën e fytyrës dhe stilin', 'Face-shape and style quiz'), keys: 'kuiz quiz kviz forma fytyres lice face shape kornize okvir frame stil style madhesia size' },
  { to: '/syze-inteligjente', icon: Aperture, title: T('Pametne naočare', 'Syze inteligjente', 'Smart glasses'), sub: T('Ray-Ban Meta, Oakley Meta i Meta Ray-Ban Display', 'Ray-Ban Meta, Oakley Meta dhe Meta Ray-Ban Display', 'Ray-Ban Meta, Oakley Meta and Meta Ray-Ban Display'), keys: 'smart glasses inteligjente syze pametne naocare meta ray-ban rayban oakley display kamere kamera camera ai asistent assistant audio wayfarer aviator zena hstn' },
  { to: '/provo-virtualisht', icon: ScanFace, title: T('Virtuelna proba', 'Provo virtualisht', 'Virtual try-on'), sub: T('Kamera, fotografija ili 3D', 'Kamera, foto ose 3D', 'Camera, photo or 3D'), keys: 'provo virtual virtuelno try on kamera camera foto selfie 3d' },
  { to: '/gjurmo-porosine', icon: PackageSearch, title: T('Pratite porudžbinu', 'Gjurmo porosinë', 'Track your order'), sub: T('Status porudžbine', 'Statusi i porosisë', 'Order status'), keys: 'gjurmo porosi porosine status order track narudzba porudzbina dergesa delivery dostava' },
  { to: '/kontakt', icon: MapPin, title: T('Kontakt', 'Kontakt', 'Contact'), sub: T('Mbretëresha Teutë 182, Mitrovica', 'Mbretëresha Teutë 182, Mitrovicë', 'Mbretëresha Teutë 182, Mitrovica'), keys: 'kontakt contact adresa address telefon phone whatsapp orari hours mitrovice mitrovica' },
  { to: '/rreth-nesh', icon: Users, title: T('O nama', 'Rreth nesh', 'About'), sub: T('30 godina porodične tradicije', '30 vjet traditë familjare', '30 years of family tradition'), keys: 'rreth nesh o nama about histori familje family miftari vision group grupi kompani holding' },
  { to: '/lookbook', icon: Images, title: T('Lookbook', 'Lookbook', 'Lookbook'), sub: T('Kampanje i editorijali', 'Fushata dhe editoriale', 'Campaigns and editorials'), keys: 'lookbook kampanje fushata campaign foto editorial' },
];

export interface SiteHit {
  key: string;
  to: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  kind: 'page' | 'post' | 'info';
}

const strip = (s: string) => s.replace(/[*#>[\]()_`-]/g, ' ');

/** Built-in pages, published CMS pages and advice posts that match every word of the query. */
export function searchSite(query: string, lang: Lang, pages: CmsPage[], posts: Post[]): SiteHit[] {
  const terms = fold(query.trim()).split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const scored: { hit: SiteHit; score: number }[] = [];
  const consider = (hit: SiteHit, title: string, hay: string) => {
    const t = fold(title);
    const h = fold(hay);
    let score = 0;
    for (const term of terms) {
      if (t.includes(term)) score += 4;
      else if (h.includes(term)) score += 1;
      else return;
    }
    scored.push({ hit, score });
  };
  for (const p of STATIC_PAGES) {
    const title = lt(p.title, lang);
    consider(
      { key: p.to, to: p.to, icon: p.icon, title, sub: lt(p.sub, lang), kind: 'page' },
      title,
      `${p.title.me} ${p.title.sq} ${p.title.en} ${p.sub.sq} ${p.sub.en} ${p.keys}`,
    );
  }
  for (const pg of pages.filter((x) => x.published)) {
    const title = lt(pg.title, lang);
    consider({ key: pg.id, to: `/faqe/${pg.slug}`, icon: FileText, title, sub: '', kind: 'info' }, title, `${pg.title.sq} ${pg.title.en} ${strip(lt(pg.body, lang))}`);
  }
  for (const po of posts.filter((x) => x.published)) {
    const title = lt(po.title, lang);
    consider({ key: po.id, to: `/keshilla/${po.slug}`, icon: BookOpen, title, sub: lt(po.excerpt, lang), kind: 'post' }, title, `${po.title.sq} ${po.title.en} ${lt(po.excerpt, lang)} ${lt(po.tag, lang)} ${strip(lt(po.body, lang))}`);
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.hit);
}

const D = defineDict({
  me: { pagesAndAdvice: 'Stranice i saveti', page: 'Stranica', post: 'Savet', info: 'Info' },
  sq: { pagesAndAdvice: 'Faqe dhe këshilla', page: 'Faqe', post: 'Këshillë', info: 'Info' },
  en: { pagesAndAdvice: 'Pages & advice', page: 'Page', post: 'Advice', info: 'Info' },
});

/** Compact list of page / advice hits (search overlay and search page). */
export function SiteHits({ hits, onPick, className, cols = 3 }: { hits: SiteHit[]; onPick?: () => void; className?: string; cols?: 2 | 3 }) {
  const t = useDict(D);
  if (!hits.length) return null;
  return (
    <div className={className}>
      <div className="eyebrow mb-3 text-muted">{t('pagesAndAdvice')}</div>
      <div className={cn('grid gap-2', cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2')}>
        {hits.map((h) => (
          <Link key={h.key} to={h.to} onClick={onPick} className="group flex items-center gap-3.5 rounded-2xl border border-line bg-white p-3 transition-colors hover:border-ink/25">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <h.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="line-clamp-1 text-sm font-semibold text-ink">{h.title}</span>
                <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">{t(h.kind)}</span>
              </span>
              {h.sub && <span className="mt-0.5 line-clamp-1 block text-[12.5px] text-muted">{h.sub}</span>}
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ))}
      </div>
    </div>
  );
}
