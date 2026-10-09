import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Banknote, CalendarCheck, ChevronDown, CreditCard, FileText, Info, Landmark, Lock, ShieldCheck, ShoppingBag, Sparkles, Store, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, RadioCard, Select, Switch, Textarea } from '@/components/ui/Field';
import { Accent } from '@/components/ui/misc';
import { defineDict, useDict, useL, useLang } from '@/i18n';
import { common } from '@/i18n/common';
import { useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { useActiveProducts, useCart, useSettings } from '@/store/hooks';
import { allCities, zoneForCity } from '@/lib/pricing';
import { money } from '@/lib/format';
import type { Customer, DeliveryMethod, Lang, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { CheckoutSteps, CompactLine, CouponBox, TotalsRows, TrustNotes, useItemsLabel, useTotalsView } from '@/site/components/checkout/parts';
import { PaymentSim } from '@/site/components/checkout/PaymentSim';
import { RX_CHOICES, ck, rxNoteLine, type RxChoice } from '@/site/components/checkout/dict';
import { cartNeedsRx } from '@/site/components/product/optical';
import { openBooking } from '@/site/components/utility/Booking';

const T = defineDict({
  me: {
    pageTitle: 'Plaćanje',
    title: 'Završetak *kupovine*',
    subtitle: 'Još samo par detalja — potvrdu dobijate odmah, a optičar vas zove tokom radnog vremena.',
    backToCart: 'Nazad u korpu',
    secure: 'Sigurna kupovina',
    s1: 'Kontakt i adresa',
    s1d: 'Na ove podatke šaljemo potvrdu i dogovaramo dostavu ili preuzimanje.',
    s2: 'Način preuzimanja',
    s2d: 'Dostavljamo širom Kosova za 1–3 dana, ili preuzmite naočare u optici.',
    s3: 'Način plaćanja',
    s3d: 'Platite kako vam odgovara — bez skrivenih troškova.',
    demoFill: 'Popuni demo podacima',
    firstName: 'Ime',
    lastName: 'Prezime',
    phone: 'Telefon',
    phoneHint: 'Zovemo vas radi potvrde narudžbe i recepta.',
    email: 'E-mail',
    emailHint: 'Ovde stiže potvrda narudžbe.',
    emailPh: 'ime@primer.com',
    city: 'Grad',
    chooseCity: 'Izaberite grad',
    address: 'Adresa',
    addressPh: 'Ulica i broj, sprat, stan',
    addressOptional: 'Opciono kod preuzimanja u optici.',
    asCompany: 'Kupujem kao firma',
    asCompanyHint: 'Račun glasi na firmu, sa NUI brojem.',
    company: 'Naziv firme',
    pib: 'NUI',
    pibPh: '9 cifara',
    note: 'Napomena',
    optional: 'opciono',
    notePh: 'Npr. najbolje vreme za poziv ili napomena za kurira…',
    err_required: 'Obavezno polje',
    err_phone: 'Unesite ispravan broj telefona',
    err_email: 'Unesite ispravnu e-mail adresu',
    err_city: 'Izaberite grad',
    err_pib: 'NUI ima 9 cifara',
    err_terms: 'Potrebno je prihvatiti uslove',
    fixErrors: 'Proverite označena polja',
    deliveryDays: 'Isporuka za {days} radna dana',
    deliveryChooseCity: 'Izaberite grad za tačnu cenu i rok isporuke',
    freeThreshold: 'Besplatno za narudžbe preko {amount}',
    freeInstallation: 'Besplatna dostava uz Nega+',
    pickupNote: 'Pri preuzimanju okvir besplatno prilagođavamo vašem licu.',
    labNote: 'Dioptrijska sočiva su gotova za 2–7 radnih dana nakon potvrde recepta; rok dostave računa se od tada.',
    codDesc: 'Plaćate kuriru ili u optici — gotovinom ili karticom.',
    bankDesc: 'Podatke za uplatu ({bank}, broj računa i poziv na broj) dobijate uz potvrdu narudžbe.',
    cardDesc: 'Visa, Mastercard ili Maestro — na zaštićenoj stranici banke.',
    cardPanelTitle: 'Podatke o kartici unosite samo kod banke',
    cardPanelText: 'Nakon potvrde otvara se zaštićena stranica banke (3-D Secure). {company} nikada ne vidi niti čuva podatke vaše kartice.',
    termsPre: 'Prihvatam ',
    termsLink: 'uslove korišćenja',
    termsDesc: 'Vaše podatke koristimo isključivo za obradu narudžbe, recept i dostavu.',
    placeOrder: 'Potvrdi narudžbu',
    payNow: 'Plati {amount}',
    afterNote: 'Potvrdu narudžbe odmah šaljemo na vaš e-mail.',
    yourOrder: 'Vaša narudžba',
    edit: 'Uredi',
    showSummary: 'Prikaži pregled narudžbe',
    hideSummary: 'Sakrij pregled narudžbe',
  },
  sq: {
    pageTitle: 'Pagesa',
    title: 'Përfundimi i *blerjes*',
    subtitle: 'Edhe pak të dhëna — konfirmimin e merrni menjëherë, ndërsa optiku ynë ju telefonon gjatë orarit të punës.',
    backToCart: 'Kthehu te shporta',
    secure: 'Blerje e sigurt',
    s1: 'Kontakti dhe adresa',
    s1d: 'Në këto të dhëna dërgojmë konfirmimin dhe caktojmë dërgesën ose marrjen.',
    s2: 'Mënyra e marrjes',
    s2d: 'Dërgojmë në gjithë Kosovën për 1–3 ditë, ose merrni syzet në optikë.',
    s3: 'Mënyra e pagesës',
    s3d: 'Paguani si ju përshtatet — pa kosto të fshehura.',
    demoFill: 'Plotëso me të dhëna demo',
    firstName: 'Emri',
    lastName: 'Mbiemri',
    phone: 'Telefoni',
    phoneHint: 'Ju telefonojmë për konfirmimin e porosisë dhe të recetës.',
    email: 'E-mail',
    emailHint: 'Këtu vjen konfirmimi i porosisë.',
    emailPh: 'emri@shembull.com',
    city: 'Qyteti',
    chooseCity: 'Zgjidhni qytetin',
    address: 'Adresa',
    addressPh: 'Rruga dhe numri, kati, banesa',
    addressOptional: 'Opsionale për marrje në optikë.',
    asCompany: 'Blej si biznes',
    asCompanyHint: 'Fatura lëshohet në emër të biznesit, me NUI.',
    company: 'Emri i biznesit',
    pib: 'NUI',
    pibPh: '9 shifra',
    note: 'Shënim',
    optional: 'opsionale',
    notePh: 'P.sh. koha më e mirë për t’ju telefonuar ose shënim për korrierin…',
    err_required: 'Fushë e detyrueshme',
    err_phone: 'Shkruani një numër telefoni të saktë',
    err_email: 'Shkruani një adresë e-maili të saktë',
    err_city: 'Zgjidhni qytetin',
    err_pib: 'NUI ka 9 shifra',
    err_terms: 'Duhet të pranoni kushtet',
    fixErrors: 'Kontrolloni fushat e shënuara',
    deliveryDays: 'Dorëzim për {days} ditë pune',
    deliveryChooseCity: 'Zgjidhni qytetin për çmimin dhe afatin e saktë',
    freeThreshold: 'Falas për porosi mbi {amount}',
    freeInstallation: 'Transport falas me Kujdes+',
    pickupNote: 'Gjatë marrjes e përshtatim kornizën në fytyrën tuaj — pa pagesë.',
    labNote: 'Lentet me dioptri janë gati për 2–7 ditë pune pas konfirmimit të recetës; afati i dërgesës llogaritet prej atëherë.',
    codDesc: 'Paguani korrierit ose në optikë — me para në dorë ose me kartelë.',
    bankDesc: 'Të dhënat për pagesë ({bank}, llogaria dhe referenca) i merrni me konfirmimin e porosisë.',
    cardDesc: 'Visa, Mastercard ose Maestro — në faqen e mbrojtur të bankës.',
    cardPanelTitle: 'Të dhënat e kartelës i shkruani vetëm te banka',
    cardPanelText: 'Pas konfirmimit hapet faqja e mbrojtur e bankës (3-D Secure). {company} nuk i sheh dhe nuk i ruan kurrë të dhënat e kartelës suaj.',
    termsPre: 'Pranoj ',
    termsLink: 'kushtet e përdorimit',
    termsDesc: 'Të dhënat tuaja i përdorim vetëm për përpunimin e porosisë, recetën dhe dërgesën.',
    placeOrder: 'Konfirmo porosinë',
    payNow: 'Paguaj {amount}',
    afterNote: 'Konfirmimin e porosisë e dërgojmë menjëherë në e-mailin tuaj.',
    yourOrder: 'Porosia juaj',
    edit: 'Ndrysho',
    showSummary: 'Shfaq përmbledhjen e porosisë',
    hideSummary: 'Fshih përmbledhjen e porosisë',
  },
  en: {
    pageTitle: 'Checkout',
    title: 'Complete your *order*',
    subtitle: 'Just a few details — you get a confirmation right away and our optician calls you during opening hours.',
    backToCart: 'Back to bag',
    secure: 'Secure checkout',
    s1: 'Contact & address',
    s1d: 'We send the confirmation here and arrange delivery or pickup with you.',
    s2: 'Delivery method',
    s2d: 'We deliver across Kosovo in 1–3 days, or collect your glasses at the store.',
    s3: 'Payment method',
    s3d: 'Pay the way that suits you — no hidden costs.',
    demoFill: 'Fill with demo details',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    phoneHint: 'We’ll call you to confirm the order and your prescription.',
    email: 'E-mail',
    emailHint: 'Your order confirmation goes here.',
    emailPh: 'name@example.com',
    city: 'City',
    chooseCity: 'Choose a city',
    address: 'Address',
    addressPh: 'Street and number, floor, apartment',
    addressOptional: 'Optional for pickup in store.',
    asCompany: 'Buying as a business',
    asCompanyHint: 'Invoice issued to your business, with its NUI.',
    company: 'Business name',
    pib: 'Business no. (NUI)',
    pibPh: '9 digits',
    note: 'Note',
    optional: 'optional',
    notePh: 'E.g. the best time to call or a note for the courier…',
    err_required: 'Required',
    err_phone: 'Enter a valid phone number',
    err_email: 'Enter a valid e-mail address',
    err_city: 'Choose a city',
    err_pib: 'The NUI has 9 digits',
    err_terms: 'Please accept the terms',
    fixErrors: 'Please check the highlighted fields',
    deliveryDays: 'Delivered in {days} working days',
    deliveryChooseCity: 'Choose a city for the exact price and delivery time',
    freeThreshold: 'Free on orders over {amount}',
    freeInstallation: 'Free delivery with Care+',
    pickupNote: 'When you collect, we fit the frame to your face — free of charge.',
    labNote: 'Prescription lenses are ready 2–7 working days after we confirm your prescription; delivery time counts from then.',
    codDesc: 'Pay the courier or at the store — cash or card.',
    bankDesc: 'Bank details ({bank}, account number and reference) come with your order confirmation.',
    cardDesc: 'Visa, Mastercard or Maestro — on the bank’s secure page.',
    cardPanelTitle: 'Card details are entered only at the bank',
    cardPanelText: 'After you confirm, the bank’s secure page (3-D Secure) opens. {company} never sees or stores your card details.',
    termsPre: 'I accept the ',
    termsLink: 'terms of use',
    termsDesc: 'We use your details only to process your order, your prescription and delivery.',
    placeOrder: 'Place order',
    payNow: 'Pay {amount}',
    afterNote: 'We e-mail your order confirmation right away.',
    yourOrder: 'Your order',
    edit: 'Edit',
    showSummary: 'Show order summary',
    hideSummary: 'Hide order summary',
  },
});

/* ------------------------------------------------------------------ */
/* Form model                                                          */
/* ------------------------------------------------------------------ */
interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  isCompany: boolean;
  company: string;
  pib: string;
  note: string;
}
type TextKey = Exclude<keyof FormState, 'isCompany'>;
type FieldKey = 'firstName' | 'lastName' | 'phone' | 'email' | 'city' | 'address' | 'company' | 'pib' | 'terms';
const FIELD_ORDER: FieldKey[] = ['firstName', 'lastName', 'phone', 'email', 'city', 'address', 'company', 'pib', 'terms'];
const CONTACT_FIELDS: FieldKey[] = FIELD_ORDER.filter((k) => k !== 'terms');

const EMPTY: FormState = { firstName: '', lastName: '', phone: '', email: '', city: '', address: '', isCompany: false, company: '', pib: '', note: '' };

const DEMO: Record<Lang, Omit<FormState, 'isCompany' | 'company' | 'pib' | 'note'>> = {
  me: { firstName: 'Jeta', lastName: 'Krasniqi', phone: '+383 44 512 337', email: 'jeta.krasniqi@example.com', city: 'Mitrovicë', address: 'Rruga Bislim Bajgora 14' },
  sq: { firstName: 'Drilon', lastName: 'Berisha', phone: '+383 49 210 418', email: 'drilon.berisha@example.com', city: 'Prishtinë', address: 'Rruga Nëna Terezë 21, kati 3' },
  en: { firstName: 'Arta', lastName: 'Gashi', phone: '+383 45 330 612', email: 'arta.gashi@example.com', city: 'Vushtrri', address: 'Rruga Skënderbeu 8' },
};

const DRAFT_KEY = 'optika-checkout-draft';
interface Draft {
  form: FormState;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  rx: RxChoice;
}
function loadDraft(): Partial<Draft> {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : {};
  } catch {
    return {};
  }
}
function saveDraft(d: Draft | null) {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable — draft is a convenience only */
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
function Section({ n, title, desc, action, children }: { n: number; title: string; desc?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex items-start gap-3.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-bold text-paper">{n}</span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[18px] font-bold leading-tight text-ink">{title}</h2>
            {desc && <p className="mt-1 text-[13.5px] leading-snug text-muted">{desc}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardBrands() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="grid h-7 place-items-center rounded-md bg-white px-2 text-[12px] font-black italic tracking-tight text-[#1a1f71] ring-1 ring-line">VISA</span>
      <span className="flex h-7 items-center rounded-md bg-white px-2 ring-1 ring-line">
        <span className="h-4 w-4 rounded-full bg-[#eb001b]" />
        <span className="-ml-1.5 h-4 w-4 rounded-full bg-[#f79e1b]/90" />
      </span>
      <span className="flex h-7 items-center rounded-md bg-white px-2 ring-1 ring-line">
        <span className="h-4 w-4 rounded-full bg-[#0099df]" />
        <span className="-ml-1.5 h-4 w-4 rounded-full bg-[#eb001b]/90" />
      </span>
    </div>
  );
}

const reveal = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Checkout() {
  const t = useDict(T);
  const tk = useDict(ck);
  const tc = useDict(common);
  const l = useL();
  const lang = useLang();
  const items = useItemsLabel();
  const navigate = useNavigate();
  const settings = useSettings();
  const products = useActiveProducts();
  const cart = useUi((s) => s.cart);
  const codes = useUi((s) => s.codes);
  const clearCart = useUi((s) => s.clearCart);
  const placeOrder = useDb((s) => s.placeOrder);
  usePageTitle(t('pageTitle'));

  const cities = useMemo(() => allCities(settings), [settings]);
  const methods = useMemo(() => {
    const m = (['cod', 'bank', 'card'] as const).filter((k) => settings.payments[k]);
    return m.length ? m : (['cod'] as PaymentMethod[]);
  }, [settings.payments]);
  const needsRx = useMemo(() => cartNeedsRx(cart, products), [cart, products]);

  const [draft] = useState(loadDraft);
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, ...draft.form }));
  const [delivery, setDelivery] = useState<DeliveryMethod>(draft.delivery ?? 'delivery');
  const [payment, setPayment] = useState<PaymentMethod>(() => (draft.payment && methods.includes(draft.payment) ? draft.payment : methods[0]));
  const [rx, setRx] = useState<RxChoice>(() => (draft.rx && RX_CHOICES.includes(draft.rx) ? draft.rx : 'send'));
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'processing' | 'approved'>('idle');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const placed = useRef(false);
  const timers = useRef<number[]>([]);

  const city = form.city || undefined;
  const totals = useCart({ delivery, city });
  const homeTotals = useCart({ delivery: 'delivery', city });
  const view = useTotalsView(totals, { showEstimateHint: true });
  const zone = zoneForCity(settings, form.city);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  useEffect(() => {
    if (!placed.current) saveDraft({ form, delivery, payment, rx });
  }, [form, delivery, payment, rx]);
  // keep the chosen method valid if the CMS switches one off
  useEffect(() => {
    if (!methods.includes(payment)) setPayment(methods[0]);
  }, [methods, payment]);

  // Care+ needs no visit, so the address is only required for home delivery
  const addressRequired = delivery === 'delivery';

  const errors = useMemo(() => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!form.firstName.trim()) e.firstName = t('err_required');
    if (!form.lastName.trim()) e.lastName = t('err_required');
    if (!form.phone.trim()) e.phone = t('err_required');
    else if (form.phone.replace(/\D/g, '').length < 8) e.phone = t('err_phone');
    if (!form.email.trim()) e.email = t('err_required');
    else if (!EMAIL_RE.test(form.email.trim())) e.email = t('err_email');
    if (!form.city) e.city = t('err_city');
    if (addressRequired && !form.address.trim()) e.address = t('err_required');
    if (form.isCompany) {
      if (!form.company.trim()) e.company = t('err_required');
      if (!/^\d{9}$/.test(form.pib.replace(/\s/g, ''))) e.pib = form.pib.trim() ? t('err_pib') : t('err_required');
    }
    if (!terms) e.terms = t('err_terms');
    return e;
  }, [form, terms, addressRequired, t]);

  const err = (k: FieldKey) => (submitted || touched[k] ? errors[k] : undefined);
  const touch = (k: FieldKey) => () => setTouched((s) => (s[k] ? s : { ...s, [k]: true }));
  const set = (k: TextKey) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const contactDone = CONTACT_FIELDS.every((k) => !errors[k]);
  const step = phase === 'approved' ? 3 : contactDone ? 2 : 1;

  const fillDemo = () => {
    const d = DEMO[lang];
    setForm((f) => ({ ...f, ...d, city: cities.includes(d.city) ? d.city : (cities[0] ?? '') }));
    setTouched({});
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const finish = () => {
    // the prescription choice travels in the customer note (staff read it in the CMS order view)
    const note = [needsRx ? rxNoteLine(rx) : '', form.note.trim()].filter(Boolean).join('\n');
    const customer: Customer = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city,
      address: form.address.trim(),
      ...(form.isCompany ? { company: form.company.trim(), pib: form.pib.replace(/\s/g, '') } : {}),
      ...(note ? { note } : {}),
    };
    const order = placeOrder({ customer, items: cart, delivery, payment, codes, lang });
    placed.current = true;
    saveDraft(null);
    clearCart();
    navigate('/porosia/' + order.id);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    const first = FIELD_ORDER.find((k) => errors[k]);
    if (first) {
      const el = document.getElementById('f-' + first);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      later(() => el?.focus({ preventScroll: true }), 450);
      toast.error(t('fixErrors'));
      return;
    }
    setBusy(true);
    if (payment === 'card') {
      setPhase('processing');
      later(() => setPhase('approved'), 1800);
      later(finish, 2900);
    } else {
      later(finish, 750);
    }
  };

  if (!totals.lines.length) {
    return placed.current ? <div className="min-h-[60vh]" /> : <Navigate to="/shporta" replace />;
  }

  /* ---------- delivery card copy ---------- */
  const minFee = Math.min(...settings.shippingZones.map((z) => z.fee));
  const homeFree = homeTotals.freeShippingReason;
  const homeAside = homeFree ? (
    <span className="text-emerald-700">{tk('free')}</span>
  ) : zone ? (
    <span className="tabular-nums">{money(zone.fee, lang)}</span>
  ) : (
    <span className="tabular-nums">{tk('from', { amount: money(minFee, lang) })}</span>
  );
  const homeDesc = [
    homeFree === 'installation' && homeTotals.freeShippingRemaining > 0
      ? t('freeInstallation')
      : homeFree
        ? t('freeThreshold', { amount: money(homeTotals.freeShippingThreshold ?? settings.freeShippingThreshold, lang, { decimals: false }) })
        : null,
    zone ? t('deliveryDays', { days: zone.days }) : !homeFree ? t('deliveryChooseCity') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const payIcon = { cod: Banknote, bank: Landmark, card: CreditCard } as const;
  const payDesc = { cod: t('codDesc'), bank: t('bankDesc', { bank: settings.bankName }), card: t('cardDesc') } as const;
  const submitLabel = payment === 'card' ? t('payNow', { amount: money(totals.total, lang) }) : t('placeOrder');
  const n = needsRx ? { rx: 2, delivery: 3, payment: 4 } : { rx: 0, delivery: 2, payment: 3 };

  const summaryLines = (
    <div className="divide-y divide-line">
      {totals.lines.map((line) => (
        <CompactLine key={line.item.key} line={line} />
      ))}
    </div>
  );

  return (
    <div className="pb-4">
      {/* Checkout bar */}
      <div className="border-b border-line bg-white/55">
        <div className="container-x flex h-[60px] items-center justify-between gap-4">
          <Link to="/shporta" className="group hidden items-center gap-2 text-[13.5px] font-semibold text-ink-soft hover:text-ink md:inline-flex">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {t('backToCart')}
          </Link>
          <CheckoutSteps current={step} className="mx-auto md:mx-0" />
          <span className="hidden items-center gap-1.5 text-[13px] font-semibold text-emerald-700 md:inline-flex">
            <Lock className="h-3.5 w-3.5" />
            {t('secure')}
          </span>
        </div>
      </div>

      <div className="container-x pt-8 sm:pt-12">
        <div className="max-w-2xl">
          <h1 className="display text-[38px] leading-[1.04] text-ink sm:text-[52px]">
            <Accent text={t('title')} />
          </h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{t('subtitle')}</p>
        </div>

        {/* Mobile summary toggle */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white ring-1 ring-line lg:hidden">
          <button type="button" onClick={() => setSummaryOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left" aria-expanded={summaryOpen}>
            <span className="flex min-w-0 items-center gap-2.5 text-[13.5px] font-semibold text-ink">
              <ShoppingBag className="h-4 w-4 shrink-0 text-brand-600" />
              <span className="truncate">{summaryOpen ? t('hideSummary') : t('showSummary')}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform duration-300', summaryOpen && 'rotate-180')} />
            </span>
            <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink">{money(totals.total, lang)}</span>
          </button>
          <AnimatePresence initial={false}>
            {summaryOpen && (
              <motion.div {...reveal} className="overflow-hidden">
                <div className="border-t border-line px-4">{summaryLines}</div>
                <div className="border-t border-line bg-paper/60 px-4 py-4">
                  <CouponBox totals={totals} collapsible />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-8 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_430px] xl:gap-14">
          <form id="checkout-form" noValidate onSubmit={onSubmit} className="min-w-0">
            <fieldset disabled={busy} className="space-y-5">
              {/* 1 — Contact & address */}
              <Section
                n={1}
                title={t('s1')}
                desc={t('s1d')}
                action={
                  <button type="button" onClick={fillDemo} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink/20 px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('demoFill')}
                  </button>
                }
              >
                <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  <Input id="f-firstName" label={t('firstName')} required autoComplete="given-name" value={form.firstName} onChange={set('firstName')} onBlur={touch('firstName')} error={err('firstName')} />
                  <Input id="f-lastName" label={t('lastName')} required autoComplete="family-name" value={form.lastName} onChange={set('lastName')} onBlur={touch('lastName')} error={err('lastName')} />
                  <Input
                    id="f-phone"
                    type="tel"
                    inputMode="tel"
                    label={t('phone')}
                    required
                    autoComplete="tel"
                    placeholder="+383 4_ ___ ___"
                    hint={t('phoneHint')}
                    value={form.phone}
                    onChange={set('phone')}
                    onBlur={touch('phone')}
                    error={err('phone')}
                  />
                  <Input
                    id="f-email"
                    type="email"
                    inputMode="email"
                    label={t('email')}
                    required
                    autoComplete="email"
                    placeholder={t('emailPh')}
                    hint={t('emailHint')}
                    value={form.email}
                    onChange={set('email')}
                    onBlur={touch('email')}
                    error={err('email')}
                  />
                  <Select id="f-city" label={t('city')} required autoComplete="address-level2" value={form.city} onChange={set('city')} onBlur={touch('city')} error={err('city')}>
                    <option value="">{t('chooseCity')}</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <Input
                    id="f-address"
                    label={
                      <>
                        {t('address')}
                        {!addressRequired && <span className="ml-1 font-medium text-muted">({t('optional')})</span>}
                      </>
                    }
                    required={addressRequired}
                    autoComplete="street-address"
                    placeholder={t('addressPh')}
                    hint={!addressRequired ? t('addressOptional') : undefined}
                    value={form.address}
                    onChange={set('address')}
                    onBlur={touch('address')}
                    error={err('address')}
                  />
                </div>

                <div className={cn('mt-6 rounded-2xl p-4 transition-colors', form.isCompany ? 'bg-sand/60' : 'bg-paper')}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink">{t('asCompany')}</div>
                      <div className="text-[12.5px] text-muted">{t('asCompanyHint')}</div>
                    </div>
                    <Switch checked={form.isCompany} onChange={(v) => setForm((f) => ({ ...f, isCompany: v }))} />
                  </div>
                  <AnimatePresence initial={false}>
                    {form.isCompany && (
                      <motion.div {...reveal} className="overflow-hidden">
                        <div className="grid gap-x-4 gap-y-5 pt-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                          <Input id="f-company" label={t('company')} required autoComplete="organization" value={form.company} onChange={set('company')} onBlur={touch('company')} error={err('company')} />
                          <Input id="f-pib" label={t('pib')} required inputMode="numeric" maxLength={11} placeholder={t('pibPh')} value={form.pib} onChange={set('pib')} onBlur={touch('pib')} error={err('pib')} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Textarea
                  wrapClassName="mt-5"
                  rows={3}
                  label={
                    <>
                      {t('note')} <span className="font-medium text-muted">({t('optional')})</span>
                    </>
                  }
                  placeholder={t('notePh')}
                  value={form.note}
                  onChange={set('note')}
                />
              </Section>

              {/* 2 — Prescription (only when a line needs one) */}
              {needsRx && (
                <Section n={n.rx} title={tk('rx_title')} desc={tk('rx_desc')}>
                  <div className="grid gap-3" role="radiogroup" aria-label={tk('rx_title')}>
                    {RX_CHOICES.map((c) => (
                      <RadioCard
                        key={c}
                        checked={rx === c}
                        onSelect={() => setRx(c)}
                        icon={c === 'exam' ? <CalendarCheck className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        title={tk(`rx_${c}`)}
                        description={tk(`rx_${c}Desc`)}
                      />
                    ))}
                  </div>
                  <AnimatePresence initial={false}>
                    {rx === 'exam' && (
                      <motion.div {...reveal} className="overflow-hidden">
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sand/60 px-4 py-3 ring-1 ring-inset ring-line">
                          <span className="text-[13px] leading-snug text-ink-soft">{l(settings.hours)}</span>
                          <Button size="sm" variant="dark" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => openBooking('exam')}>
                            {tk('rx_examNow')}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-snug text-muted">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {tk('rx_pd')}
                  </p>
                </Section>
              )}

              {/* Delivery */}
              <Section n={n.delivery} title={t('s2')} desc={t('s2d')}>
                <div className="grid gap-3">
                  <RadioCard
                    checked={delivery === 'delivery'}
                    onSelect={() => setDelivery('delivery')}
                    icon={<Truck className="h-5 w-5" />}
                    title={tc('delivery_delivery')}
                    description={homeDesc}
                    aside={homeAside}
                  />
                  <RadioCard
                    checked={delivery === 'pickup'}
                    onSelect={() => setDelivery('pickup')}
                    icon={<Store className="h-5 w-5" />}
                    title={tc('delivery_pickup')}
                    description={`${settings.pickupAddress} · ${l(settings.hours)}`}
                    aside={<span className="text-emerald-700">{tk('free')}</span>}
                  />
                </div>
                <AnimatePresence initial={false}>
                  {(delivery === 'pickup' || needsRx) && (
                    <motion.div {...reveal} className="overflow-hidden">
                      <p className="mt-3 flex items-start gap-2 rounded-xl bg-paper px-3.5 py-3 text-[13px] leading-snug text-ink-soft ring-1 ring-inset ring-line">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        {[needsRx ? t('labNote') : '', delivery === 'pickup' ? t('pickupNote') : ''].filter(Boolean).join(' ')}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Section>

              {/* Payment */}
              <Section n={n.payment} title={t('s3')} desc={t('s3d')}>
                <div className="grid gap-3">
                  {methods.map((m) => {
                    const Icon = payIcon[m];
                    return <RadioCard key={m} checked={payment === m} onSelect={() => setPayment(m)} icon={<Icon className="h-5 w-5" />} title={tc(`pay_${m}`)} description={payDesc[m]} />;
                  })}
                </div>
                <AnimatePresence initial={false}>
                  {payment === 'card' && (
                    <motion.div {...reveal} className="overflow-hidden">
                      <div className="mt-3 flex gap-3.5 rounded-2xl bg-paper p-4 ring-1 ring-inset ring-line sm:p-5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 ring-1 ring-line">
                          <ShieldCheck className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-ink">{t('cardPanelTitle')}</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('cardPanelText', { company: settings.companyName })}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <CardBrands />
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">
                              <Lock className="h-3 w-3" /> 3-D Secure
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Section>

              {/* Confirm */}
              <section className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-7">
                <div className="lg:hidden">
                  <TotalsRows v={view} big />
                  <div className="my-5 h-px bg-line" />
                </div>
                <div
                  id="f-terms"
                  tabIndex={-1}
                  className={cn('rounded-2xl p-4 outline-none ring-1 ring-inset transition-colors', err('terms') ? 'bg-red-50/70 ring-red-300' : 'bg-paper ring-line')}
                >
                  <Checkbox
                    checked={terms}
                    onChange={(v) => {
                      setTerms(v);
                      setTouched((s) => ({ ...s, terms: true }));
                    }}
                    label={
                      <>
                        {t('termsPre')}
                        <Link to="/faqe/kushtet-e-perdorimit" target="_blank" className="text-brand-700 underline decoration-brand-700/30 underline-offset-[3px] hover:decoration-brand-700">
                          {t('termsLink')}
                        </Link>
                      </>
                    }
                    description={t('termsDesc')}
                  />
                  {err('terms') && <p className="mt-2 pl-8 text-xs font-medium text-red-600">{err('terms')}</p>}
                </div>
                <Button type="submit" size="lg" className="mt-5 w-full" loading={busy} iconRight={busy ? undefined : <ArrowRight className="h-4 w-4" />}>
                  {submitLabel}
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12px] text-muted">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  {t('afterNote')}
                </p>
              </section>
            </fieldset>
          </form>

          {/* Sticky summary (desktop) */}
          <aside className="hidden lg:sticky lg:top-[100px] lg:block">
            <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-line">
              <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
                <h2 className="text-[15px] font-bold text-ink">
                  {t('yourOrder')} <span className="font-medium text-muted">· {items(totals.count)}</span>
                </h2>
                <Link to="/shporta" className="text-[13px] font-semibold text-brand-700 hover:underline">
                  {t('edit')}
                </Link>
              </div>
              <div className="no-scrollbar max-h-[264px] overflow-y-auto px-6">{summaryLines}</div>
              <div className="border-t border-line bg-paper/60 px-6 py-5">
                <CouponBox totals={totals} collapsible />
                <div className="my-5 h-px bg-line" />
                <TotalsRows v={view} big />
                <Button type="submit" form="checkout-form" size="lg" className="mt-5 w-full" loading={busy} iconRight={busy ? undefined : <ArrowRight className="h-4 w-4" />}>
                  {submitLabel}
                </Button>
              </div>
            </div>
            <TrustNotes compact className="mt-5 px-2" />
          </aside>
        </div>
      </div>

      <PaymentSim phase={phase} amount={totals.total} merchant={settings.companyName} />
    </div>
  );
}
