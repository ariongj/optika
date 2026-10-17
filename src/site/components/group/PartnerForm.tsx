import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Accent } from '@/components/ui/misc';
import { defineDict, useDict, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { useDb } from '@/store/db';
import { useSettings } from '@/store/hooks';
import { allCities } from '@/lib/pricing';
import type { Lang } from '@/lib/types';
import { cn } from '@/lib/utils';
import { notifyInquiry } from '@/lib/leads';

/** Market of a partner application — the B2B tabs on /optical-lab. */
export type Market = 'xk' | 'eu';

/** Lens / service interests a partner can tick (keys of `i_*` in the dictionary). */
export const INTERESTS = ['single', 'progressive', 'screen', 'photo', 'sun', 'thin', 'mount', 'docs'] as const;
export type Interest = (typeof INTERESTS)[number];

const VOLUMES = ['v1', 'v2', 'v3', 'v4'] as const;
type Volume = (typeof VOLUMES)[number];

/**
 * EU member states → [Serbian, Albanian, English] names. A static list on purpose: Chrome's bundled ICU has no
 * Albanian region names, so Intl.DisplayNames would fall back to English.
 */
const EU: [code: string, me: string, sq: string, en: string][] = [
  ['AT', 'Austrija', 'Austri', 'Austria'],
  ['BE', 'Belgija', 'Belgjikë', 'Belgium'],
  ['BG', 'Bugarska', 'Bullgari', 'Bulgaria'],
  ['HR', 'Hrvatska', 'Kroaci', 'Croatia'],
  ['CY', 'Kipar', 'Qipro', 'Cyprus'],
  ['CZ', 'Češka', 'Çeki', 'Czechia'],
  ['DK', 'Danska', 'Danimarkë', 'Denmark'],
  ['EE', 'Estonija', 'Estoni', 'Estonia'],
  ['FI', 'Finska', 'Finlandë', 'Finland'],
  ['FR', 'Francuska', 'Francë', 'France'],
  ['DE', 'Nemačka', 'Gjermani', 'Germany'],
  ['GR', 'Grčka', 'Greqi', 'Greece'],
  ['HU', 'Mađarska', 'Hungari', 'Hungary'],
  ['IE', 'Irska', 'Irlandë', 'Ireland'],
  ['IT', 'Italija', 'Itali', 'Italy'],
  ['LV', 'Letonija', 'Letoni', 'Latvia'],
  ['LT', 'Litvanija', 'Lituani', 'Lithuania'],
  ['LU', 'Luksemburg', 'Luksemburg', 'Luxembourg'],
  ['MT', 'Malta', 'Maltë', 'Malta'],
  ['NL', 'Holandija', 'Holandë', 'Netherlands'],
  ['PL', 'Poljska', 'Poloni', 'Poland'],
  ['PT', 'Portugalija', 'Portugali', 'Portugal'],
  ['RO', 'Rumunija', 'Rumani', 'Romania'],
  ['SK', 'Slovačka', 'Sllovaki', 'Slovakia'],
  ['SI', 'Slovenija', 'Slloveni', 'Slovenia'],
  ['ES', 'Španija', 'Spanjë', 'Spain'],
  ['SE', 'Švedska', 'Suedi', 'Sweden'],
];
const COLLATE: Record<Lang, string> = { sq: 'sq', en: 'en', me: 'sr-Latn' };
const LANG_COL: Record<Lang, 1 | 2 | 3> = { me: 1, sq: 2, en: 3 };
const OTHER = 'other';

const PF = defineDict({
  me: {
    title: 'Prijavite se za *saradnju*',
    text: 'Recite nam gde radite i šta vam je potrebno. Tim Optical Lab-a pregledaće zahtev i javiti vam se.',
    company: 'Optika / firma',
    companyPh: 'Naziv vaše optike',
    contact: 'Kontakt osoba',
    country: 'Država',
    chooseCountry: 'Izaberite državu',
    otherCountry: 'Druga zemlja',
    otherCity: 'Drugi grad',
    email: 'Poslovni e-mail',
    invalidEmail: 'Unesite ispravan e-mail',
    volume: 'Mesečni obim (okvirno)',
    v1: 'Do 20 pari',
    v2: '20–50 pari',
    v3: '50–150 pari',
    v4: 'Preko 150 pari',
    lenses: 'Šta vas zanima',
    i_single: 'Jednožižna',
    i_progressive: 'Progresivna',
    i_screen: 'Za ekran',
    i_photo: 'Fotohromatska',
    i_sun: 'Sunčana sa dioptrijom',
    i_thin: 'Visok indeks (1.67–1.74)',
    i_mount: 'Brušenje i montaža',
    i_docs: 'Tehnička dokumentacija',
    messagePh: 'Npr. oko 30 pari progresivnih 1.6 sa antirefleksom mesečno, sa montažom u naše okvire.',
    consent: 'Slažem se da me Optical Lab kontaktira samo u vezi sa ovim zahtevom.',
    consentErr: 'Potvrdite saglasnost za kontakt.',
    safety: 'Samo poslovni i kontakt podaci — ne šaljite recepte niti podatke o pacijentima.',
    submit: 'Pošaljite prijavu',
    successText: 'Prijava za {company} je primljena. Tim Optical Lab-a kontaktiraće vas na {email} ili {phone}.',
    reference: 'Referenca',
    successNote: 'Ovo nije odobrenje partnerstva niti potvrda porudžbine — uslovi se potvrđuju pismeno nakon razgovora.',
    marketLine: 'Tržište',
  },
  sq: {
    title: 'Aplikoni për *bashkëpunim*',
    text: 'Na tregoni ku punoni dhe çfarë ju nevojitet. Ekipi i Optical Lab e shqyrton kërkesën dhe ju kontakton.',
    company: 'Optika / kompania',
    companyPh: 'Emri i optikës suaj',
    contact: 'Personi kontaktues',
    country: 'Shteti',
    chooseCountry: 'Zgjidhni shtetin',
    otherCountry: 'Shtet tjetër',
    otherCity: 'Qytet tjetër',
    email: 'E-mail i biznesit',
    invalidEmail: 'Shkruani një e-mail të vlefshëm',
    volume: 'Vëllimi mujor (i përafërt)',
    v1: 'Deri në 20 palë',
    v2: '20–50 palë',
    v3: '50–150 palë',
    v4: 'Mbi 150 palë',
    lenses: 'Çfarë ju intereson',
    i_single: 'Njëvizore',
    i_progressive: 'Progresive',
    i_screen: 'Për ekran',
    i_photo: 'Fotokromatike',
    i_sun: 'Dielli me dioptri',
    i_thin: 'Indeks i lartë (1.67–1.74)',
    i_mount: 'Prerje & montim',
    i_docs: 'Dokumentacion teknik',
    messagePh: 'P.sh. rreth 30 palë progresive 1.6 me antirefleks në muaj, me montim në kornizat tona.',
    consent: 'Pranoj që Optical Lab të më kontaktojë vetëm për këtë kërkesë.',
    consentErr: 'Ju lutemi pranoni kontaktin për këtë kërkesë.',
    safety: 'Vetëm të dhëna biznesi dhe kontakti — mos dërgoni receta apo të dhëna pacientësh.',
    submit: 'Dërgo aplikimin',
    successText: 'Aplikimi për {company} u regjistrua. Ekipi i Optical Lab do t’ju kontaktojë në {email} ose {phone}.',
    reference: 'Referenca',
    successNote: 'Ky nuk është miratim partneriteti apo konfirmim porosie — kushtet konfirmohen me shkrim pas bisedës.',
    marketLine: 'Tregu',
  },
  en: {
    title: 'Apply for a *partnership*',
    text: 'Tell us where you work and what you need. The Optical Lab team will review your request and get in touch.',
    company: 'Practice / company',
    companyPh: 'Your practice name',
    contact: 'Contact person',
    country: 'Country',
    chooseCountry: 'Choose a country',
    otherCountry: 'Another country',
    otherCity: 'Another town',
    email: 'Business e-mail',
    invalidEmail: 'Enter a valid e-mail address',
    volume: 'Monthly volume (estimate)',
    v1: 'Up to 20 pairs',
    v2: '20–50 pairs',
    v3: '50–150 pairs',
    v4: '150+ pairs',
    lenses: 'What you’re interested in',
    i_single: 'Single vision',
    i_progressive: 'Progressive',
    i_screen: 'Screen / blue filter',
    i_photo: 'Photochromic',
    i_sun: 'Prescription sun',
    i_thin: 'High index (1.67–1.74)',
    i_mount: 'Edging & mounting',
    i_docs: 'Technical documentation',
    messagePh: 'E.g. around 30 pairs of 1.6 progressives with anti-reflective coating a month, mounted in our frames.',
    consent: 'I agree to be contacted by Optical Lab about this request only.',
    consentErr: 'Please agree to be contacted about this request.',
    safety: 'Business and contact details only — please don’t send prescriptions or patient data.',
    submit: 'Send application',
    successText: 'The application for {company} has been received. The Optical Lab team will contact you at {email} or {phone}.',
    reference: 'Reference',
    successNote: 'This is not a partnership approval or an order confirmation — terms are confirmed in writing after we talk.',
    marketLine: 'Market',
  },
});

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * Optical Lab partner application. Creates a CMS inquiry of type `quote` (→ "B2B" in the admin inbox,
 * /admin/kontakti) tagged `b2b` + `optical-lab` + the market.
 */
export function PartnerForm({
  market,
  marketLabel,
  interests,
  onInterests,
  className,
}: {
  market: Market;
  /** "Kosovë" / "European Union"… in the shopper's language */
  marketLabel: string;
  /** Controlled so the page can pre-select "Technical documentation" */
  interests: Interest[];
  onInterests: (next: Interest[]) => void;
  className?: string;
}) {
  const t = useDict(PF);
  const ts = useDict(site);
  const lang = useLang();
  const settings = useSettings();
  const addInquiry = useDb((s) => s.addInquiry);
  const updateInquiry = useDb((s) => s.updateInquiry);
  const blank = { company: '', name: '', phone: '', email: '', cityXk: '', cityEu: '', country: '', volume: '' as Volume | '', message: '', consent: false };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ name: string; company: string; email: string; phone: string; ref: string } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const set = (k: 'company' | 'name' | 'phone' | 'email' | 'cityXk' | 'cityEu' | 'country' | 'message') => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }));
  const cities = allCities(settings);

  const countries = useMemo(
    () => EU.map((row) => ({ code: row[0], name: row[LANG_COL[lang]] })).sort((a, b) => a.name.localeCompare(b.name, COLLATE[lang])),
    [lang],
  );
  const countryName = (code: string) => (code === OTHER ? t('otherCountry') : (countries.find((c) => c.code === code)?.name ?? code));

  const toggle = (k: Interest) => onInterests(interests.includes(k) ? interests.filter((x) => x !== k) : [...interests, k]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!form.company.trim()) err.company = ts('f_required');
    if (!form.name.trim()) err.name = ts('f_required');
    if (!form.phone.trim()) err.phone = ts('f_required');
    else if (form.phone.replace(/\D/g, '').length < 8) err.phone = ts('f_invalidPhone');
    if (!form.email.trim()) err.email = ts('f_required');
    else if (!isEmail(form.email.trim())) err.email = t('invalidEmail');
    if (market === 'eu' && !form.country) err.country = ts('f_required');
    if (!form.consent) err.consent = t('consentErr');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 650));

    const country = market === 'eu' ? countryName(form.country) : '';
    const city = market === 'eu' ? [form.cityEu.trim(), country].filter(Boolean).join(', ') : form.cityXk;
    // The inquiry has no fields for market / volume / interests — they travel in the message, one per line.
    const message = [
      `${t('marketLine')}: ${marketLabel}${country ? ` · ${country}` : ''}`,
      form.volume ? `${t('volume')}: ${t(form.volume)}` : '',
      interests.length ? `${t('lenses')}: ${INTERESTS.filter((k) => interests.includes(k)).map((k) => t(`i_${k}`)).join(', ')}` : '',
      form.message.trim() ? `\n${form.message.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const inq = addInquiry({
      type: 'quote',
      source: 'quote',
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: city || undefined,
      company: form.company.trim(),
      service: `Optical Lab B2B · ${marketLabel}`,
      message,
    });
    // `InquiryInput` has no tags — set them right after (does not mark the inquiry as seen).
    updateInquiry(inq.id, { tags: ['b2b', 'optical-lab', market === 'eu' ? 'eu' : 'kosove'] });
    notifyInquiry({ ...inq, tags: ['b2b', 'optical-lab', market === 'eu' ? 'eu' : 'kosove'] }, { topic: 'Optical Lab B2B' }); // e-mail to the shop
    setBusy(false);
    setSent({
      name: form.name.trim().split(' ')[0],
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      ref: inq.id.replace(/^inq_/, '').slice(0, 6).toUpperCase(),
    });
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const chip = (on: boolean) =>
    cn('rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors', on ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink-soft hover:border-ink/30');

  if (sent) {
    return (
      <div ref={top} className={cn('flex flex-col items-center justify-center rounded-[28px] bg-white p-8 text-center text-ink sm:p-12', className)} role="status">
        <span className="grid h-14 w-14 animate-pop place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3 className="display mt-5 text-3xl">{ts('f_successTitle', { name: sent.name })}</h3>
        <p className="mt-2 max-w-sm text-muted">{t('successText', { company: sent.company, email: sent.email, phone: sent.phone })}</p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-sand/60 px-5 py-3 ring-1 ring-line">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('reference')}</span>
          <span className="display text-[22px] tracking-wide text-ink">#{sent.ref}</span>
        </div>
        <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-muted">{t('successNote')}</p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setSent(null);
            setForm(blank);
            onInterests([]);
          }}
        >
          {ts('f_newRequest')}
        </Button>
      </div>
    );
  }

  return (
    <div ref={top} className={cn('rounded-[28px] bg-white text-ink', className)}>
      <div className="px-6 pt-7 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="display text-[28px] leading-tight sm:text-[32px]">
            <Accent text={t('title')} />
          </h3>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-[11.5px] font-bold text-brand-700">
            {t('marketLine')}: {marketLabel}
          </span>
        </div>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t('text')}</p>
      </div>
      <form onSubmit={submit} noValidate className="p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('company')} required value={form.company} onChange={set('company')} error={errors.company} placeholder={t('companyPh')} autoComplete="organization" />
          <Input label={t('contact')} required value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" />
          {market === 'xk' ? (
            <Select label={ts('f_city')} value={form.cityXk} onChange={set('cityXk')} wrapClassName="sm:col-span-2">
              <option value="">{ts('f_chooseCity')}</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={t('otherCity')}>{t('otherCity')}</option>
            </Select>
          ) : (
            <>
              <Select label={t('country')} required value={form.country} onChange={set('country')} error={errors.country} autoComplete="country">
                <option value="">{t('chooseCountry')}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
                <option value={OTHER}>{t('otherCountry')}</option>
              </Select>
              <Input label={ts('f_city')} value={form.cityEu} onChange={set('cityEu')} autoComplete="address-level2" />
            </>
          )}
          <Input label={ts('f_phone')} required type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder={market === 'xk' ? '+383 4_ ___ ___' : '+49 …'} autoComplete="tel" />
          <Input label={t('email')} required type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{t('volume')}</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('volume')}>
              {VOLUMES.map((v) => (
                <button key={v} type="button" aria-pressed={form.volume === v} onClick={() => setForm((x) => ({ ...x, volume: x.volume === v ? '' : v }))} className={chip(form.volume === v)}>
                  {t(v)}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{t('lenses')}</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('lenses')}>
              {INTERESTS.map((k) => (
                <button key={k} type="button" aria-pressed={interests.includes(k)} onClick={() => toggle(k)} className={chip(interests.includes(k))}>
                  {t(`i_${k}`)}
                </button>
              ))}
            </div>
          </div>
          <Textarea label={ts('f_message')} rows={3} value={form.message} onChange={set('message')} placeholder={t('messagePh')} wrapClassName="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Checkbox checked={form.consent} onChange={(v) => setForm((x) => ({ ...x, consent: v }))} label={t('consent')} />
            {errors.consent && <p className="mt-1.5 pl-8 text-xs font-medium text-red-600">{errors.consent}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted sm:max-w-[55%]">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-brand-600" /> {t('safety')}
          </p>
          <Button type="submit" size="lg" loading={busy} iconRight={<Send className="h-4 w-4" />}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
