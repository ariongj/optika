import { Link, useParams } from 'react-router';
import { ArrowRight, Banknote, CalendarCheck, Copy, CreditCard, FileText, FlaskConical, Home, Landmark, LayoutDashboard, Mail, PackageSearch, PhoneCall, ShieldCheck, ShieldPlus, Store, Truck } from 'lucide-react';
import type { ComponentType } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Accent, Badge, Img } from '@/components/ui/misc';
import { WhatsAppIcon } from '@/components/brand/Social';
import { defineDict, useDict, useLang } from '@/i18n';
import { common } from '@/i18n/common';
import { useDb } from '@/store/db';
import { useSettings } from '@/store/hooks';
import { zoneForCity } from '@/lib/pricing';
import { dateTime, money, num, unitLabel } from '@/lib/format';
import type { Order, OrderLine } from '@/lib/types';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { CheckoutSteps, TotalsRows, useCopy, useDiscountRows, useItemsLabel } from '@/site/components/checkout/parts';
import { Confetti, SuccessCheck } from '@/site/components/checkout/Celebrate';
import { ck, noteWithoutRx, rxChoiceFromNote, type RxChoice } from '@/site/components/checkout/dict';
import { openBooking } from '@/site/components/utility/Booking';

const T = defineDict({
  me: {
    pageTitle: 'Narudžba primljena',
    eyebrow: 'Narudžba je primljena',
    thanks: 'Hvala, *{name}*!',
    lead: 'Vaša narudžba je uspešno primljena. Potvrdu smo poslali na {email}, a naš optičar će vas uskoro pozvati.',
    orderNo: 'Broj narudžbe',
    placedAt: 'Naručeno {date}',
    nextTitle: 'Šta *sledi*',
    n1: 'Poziv za potvrdu',
    n1rx: 'Potvrđujemo recept',
    n1when: 'danas',
    n1text: 'Optičar vas zove na {phone} da potvrdi narudžbu i detalje.',
    n1textRx: 'Optičar vas zove na {phone} da potvrdi narudžbu, recept i PD pre izrade sočiva.',
    n2lab: 'Laboratorija izrađuje sočiva',
    n2labWhen: '2–7 radnih dana',
    n2labText: 'Sočiva centriramo, montiramo u okvir i proveravamo na fokometru u našoj laboratoriji u Mitrovici.',
    n3delivery: 'Dostava na adresu',
    n3deliveryText: 'Dostavljamo na {address}. Kurir vas zove pre isporuke, a besplatno podešavanje okvira čeka vas u optici 30 dana.',
    n3pickup: 'Prilagođavanje i preuzimanje',
    n3pickupText: 'Javljamo vam se kada su naočare gotove. U optici ih prilagođavamo vašem licu: {address}.',
    n3when: '{days} radna dana',
    n3whenRx: 'nakon izrade',
    n3whenPickup: 'kada bude spremno',
    n4care: 'Nega+ je aktivna',
    n4careWhen: '12 meseci',
    n4careText: 'Slučajni lom okvira i sočiva je pokriven, a podešavanja u optici su besplatna.',
    rxTitle: 'Vaš recept',
    rxChoice: 'Izabrali ste:',
    rx_sendText: 'Pošaljite fotografiju recepta sa brojem narudžbe {n} — preko WhatsApp-a ili e-maila.',
    rx_haveText: 'Recept nalazimo u našoj evidenciji i potvrđujemo ga telefonom pre izrade.',
    rx_examText: 'Izaberite termin za pregled — sočiva izrađujemo nakon pregleda.',
    rxWhatsapp: 'Pošalji na WhatsApp',
    rxEmail: 'Pošalji e-mailom',
    rxBook: 'Zakaži pregled',
    rxMsg: 'Recept za narudžbu {n}',
    bankTitle: 'Podaci za uplatu',
    bankText: 'Narudžbu šaljemo u izradu čim uplata bude evidentirana (obično 1 radni dan). Obavezno navedite poziv na broj.',
    recipient: 'Primalac',
    bank: 'Banka',
    account: 'Broj računa',
    amount: 'Iznos',
    reference: 'Poziv na broj',
    purpose: 'Svrha uplate',
    purposeText: 'Uplata po narudžbi {n}',
    codNote: 'Pripremite {amount} — plaćate kuriru gotovinom ili karticom.',
    codNotePickup: 'Pripremite {amount} — plaćate u optici gotovinom ili karticom.',
    cardNote: 'Plaćanje karticom je odobreno — iznos {amount} je naplaćen.',
    deliveryTo: 'Dostava',
    payment: 'Plaćanje',
    contact: 'Kontakt',
    note: 'Napomena',
    summary: 'Pregled narudžbe',
    continue: 'Nastavi kupovinu',
    track: 'Pratite porudžbinu',
    home: 'Početna',
    demo: 'Demo:',
    demoText: 'narudžba se upravo pojavila u CMS-u.',
    demoLink: 'Pogledaj narudžbu u CMS-u',
    nfTitle: 'Narudžba nije pronađena',
    nfText: 'Proverite link iz potvrde ili nas kontaktirajte — rado ćemo pomoći.',
    contactUs: 'Kontaktirajte nas',
  },
  sq: {
    pageTitle: 'Porosia u pranua',
    eyebrow: 'Porosia u pranua',
    thanks: 'Faleminderit, *{name}*!',
    lead: 'Porosia juaj u pranua me sukses. Konfirmimin e dërguam në {email}, ndërsa optiku ynë do t’ju telefonojë së shpejti.',
    orderNo: 'Numri i porosisë',
    placedAt: 'Porositur më {date}',
    nextTitle: 'Çfarë *vijon*',
    n1: 'Thirrje konfirmimi',
    n1rx: 'Konfirmojmë recetën',
    n1when: 'sot',
    n1text: 'Optiku ju telefonon në {phone} për të konfirmuar porosinë dhe detajet.',
    n1textRx: 'Optiku ju telefonon në {phone} për të konfirmuar porosinë, recetën dhe PD-në para punimit të lenteve.',
    n2lab: 'Laboratori punon lentet',
    n2labWhen: '2–7 ditë pune',
    n2labText: 'Lentet i centrojmë, i montojmë në kornizë dhe i kontrollojmë në fokometër në laboratorin tonë në Mitrovicë.',
    n3delivery: 'Dërgesë në adresë',
    n3deliveryText: 'Dërgojmë në {address}. Korrieri ju telefonon para dorëzimit, ndërsa rregullimi falas i kornizës ju pret në optikë për 30 ditë.',
    n3pickup: 'Përshtatja dhe marrja',
    n3pickupText: 'Ju njoftojmë kur syzet të jenë gati. Në optikë i përshtatim në fytyrën tuaj: {address}.',
    n3when: '{days} ditë pune',
    n3whenRx: 'pas punimit',
    n3whenPickup: 'kur të jetë gati',
    n4care: 'Kujdes+ është aktiv',
    n4careWhen: '12 muaj',
    n4careText: 'Thyerja aksidentale e kornizës dhe e lenteve është e mbuluar, ndërsa rregullimet në optikë janë falas.',
    rxTitle: 'Receta juaj',
    rxChoice: 'Keni zgjedhur:',
    rx_sendText: 'Dërgoni një foto të recetës me numrin e porosisë {n} — me WhatsApp ose me e-mail.',
    rx_haveText: 'Recetën e gjejmë në evidencën tonë dhe e konfirmojmë me telefon para punimit.',
    rx_examText: 'Zgjidhni terminin për kontroll — lentet i punojmë pas kontrollit.',
    rxWhatsapp: 'Dërgo në WhatsApp',
    rxEmail: 'Dërgo me e-mail',
    rxBook: 'Rezervo kontrollin',
    rxMsg: 'Receta për porosinë {n}',
    bankTitle: 'Të dhënat për pagesë',
    bankText: 'Porosinë e dërgojmë në punim sapo të regjistrohet pagesa (zakonisht 1 ditë pune). Patjetër shënoni referencën.',
    recipient: 'Përfituesi',
    bank: 'Banka',
    account: 'Llogaria',
    amount: 'Shuma',
    reference: 'Referenca',
    purpose: 'Qëllimi i pagesës',
    purposeText: 'Pagesë për porosinë {n}',
    codNote: 'Përgatitni {amount} — paguani korrierit me para në dorë ose me kartelë.',
    codNotePickup: 'Përgatitni {amount} — paguani në optikë me para në dorë ose me kartelë.',
    cardNote: 'Pagesa me kartelë u miratua — shuma {amount} u pagua.',
    deliveryTo: 'Dërgesa',
    payment: 'Pagesa',
    contact: 'Kontakti',
    note: 'Shënim',
    summary: 'Përmbledhja e porosisë',
    continue: 'Vazhdo blerjen',
    track: 'Gjurmo porosinë',
    home: 'Ballina',
    demo: 'Demo:',
    demoText: 'porosia sapo u shfaq në CMS.',
    demoLink: 'Shiko porosinë në CMS',
    nfTitle: 'Porosia nuk u gjet',
    nfText: 'Kontrolloni lidhjen nga konfirmimi ose na kontaktoni — me kënaqësi ju ndihmojmë.',
    contactUs: 'Na kontaktoni',
  },
  en: {
    pageTitle: 'Order received',
    eyebrow: 'Order received',
    thanks: 'Thank you, *{name}*!',
    lead: 'Your order has been received. We’ve sent the confirmation to {email} and our optician will call you shortly.',
    orderNo: 'Order number',
    placedAt: 'Placed {date}',
    nextTitle: 'What happens *next*',
    n1: 'Confirmation call',
    n1rx: 'We confirm your prescription',
    n1when: 'today',
    n1text: 'Our optician calls you on {phone} to confirm the order and the details.',
    n1textRx: 'Our optician calls you on {phone} to confirm the order, your prescription and PD before the lenses are made.',
    n2lab: 'Our lab makes your lenses',
    n2labWhen: '2–7 working days',
    n2labText: 'We centre the lenses, fit them to the frame and verify them on the lensmeter in our lab in Mitrovica.',
    n3delivery: 'Home delivery',
    n3deliveryText: 'We deliver to {address}. The courier calls before delivery, and a free frame adjustment awaits you at the store for 30 days.',
    n3pickup: 'Fitting & pickup',
    n3pickupText: 'We’ll let you know when your glasses are ready. At the store we fit them to your face: {address}.',
    n3when: '{days} working days',
    n3whenRx: 'after production',
    n3whenPickup: 'when ready',
    n4care: 'Care+ is active',
    n4careWhen: '12 months',
    n4careText: 'Accidental breakage of the frame and lenses is covered, and adjustments at the store are free.',
    rxTitle: 'Your prescription',
    rxChoice: 'You chose:',
    rx_sendText: 'Send a photo of your prescription with order number {n} — by WhatsApp or e-mail.',
    rx_haveText: 'We’ll find your prescription in our records and confirm it by phone before production.',
    rx_examText: 'Pick a time for your eye exam — we make the lenses after the exam.',
    rxWhatsapp: 'Send on WhatsApp',
    rxEmail: 'Send by e-mail',
    rxBook: 'Book an eye exam',
    rxMsg: 'Prescription for order {n}',
    bankTitle: 'Bank transfer details',
    bankText: 'We start your order as soon as the payment is registered (usually 1 working day). Please quote the reference.',
    recipient: 'Recipient',
    bank: 'Bank',
    account: 'Account number',
    amount: 'Amount',
    reference: 'Reference',
    purpose: 'Payment description',
    purposeText: 'Payment for order {n}',
    codNote: 'Please have {amount} ready — pay the courier in cash or by card.',
    codNotePickup: 'Please have {amount} ready — pay at the store in cash or by card.',
    cardNote: 'Card payment approved — {amount} has been charged.',
    deliveryTo: 'Delivery',
    payment: 'Payment',
    contact: 'Contact',
    note: 'Note',
    summary: 'Order summary',
    continue: 'Continue shopping',
    track: 'Track your order',
    home: 'Home',
    demo: 'Demo:',
    demoText: 'the order has just landed in the CMS.',
    demoLink: 'View the order in the CMS',
    nfTitle: 'Order not found',
    nfText: 'Please check the link from your confirmation or get in touch — we’re happy to help.',
    contactUs: 'Contact us',
  },
});

const units = (it: OrderLine) => (it.unit === 'm2' && it.packSize ? Math.round(it.qty * it.packSize * 100) / 100 : it.qty);

function NotFoundState() {
  const t = useDict(T);
  usePageTitle(t('nfTitle'));
  return (
    <div className="container-x py-16 sm:py-24">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl bg-white px-6 py-16 text-center ring-1 ring-line">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-sand text-ink-soft">
          <PackageSearch className="h-7 w-7" strokeWidth={1.6} />
        </span>
        <h1 className="display mt-6 text-[34px] leading-tight text-ink sm:text-[42px]">{t('nfTitle')}</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">{t('nfText')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/" icon={<Home className="h-4 w-4" />}>
            {t('home')}
          </ButtonLink>
          <ButtonLink to="/kontakt" variant="outline">
            {t('contactUs')}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function Step({ icon: Icon, title, when, text, first, last }: { icon: ComponentType<{ className?: string }>; title: string; when: string; text: string; first?: boolean; last?: boolean }) {
  return (
    <li className={cn('relative flex gap-4', !last && 'pb-7')}>
      {!last && <span aria-hidden className="absolute bottom-0 left-5 top-11 w-px bg-line" />}
      <span className={cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-full', first ? 'bg-brand-600 text-white shadow-[0_8px_20px_-10px_var(--color-brand-700)]' : 'bg-sand text-ink-soft')}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 pt-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-[15.5px] font-semibold text-ink">{title}</h3>
          <Badge tone={first ? 'brand' : 'sand'}>{when}</Badge>
        </div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{text}</p>
      </div>
    </li>
  );
}

function BankBox({ order }: { order: Order }) {
  const t = useDict(T);
  const tk = useDict(ck);
  const lang = useLang();
  const settings = useSettings();
  const copy = useCopy();
  const rows: { label: string; value: string; copy?: boolean; strong?: boolean }[] = [
    { label: t('recipient'), value: settings.legalName },
    { label: t('bank'), value: settings.bankName },
    { label: t('account'), value: settings.bankAccount, copy: true, strong: true },
    { label: t('amount'), value: money(order.total, lang), strong: true },
    { label: t('reference'), value: order.number, copy: true, strong: true },
    { label: t('purpose'), value: t('purposeText', { n: order.number }) },
  ];
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-paper sm:p-8">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-brand-200">
            <Landmark className="h-5 w-5" />
          </span>
          <h2 className="font-display text-[26px] leading-tight text-white">{t('bankTitle')}</h2>
        </div>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-paper/65">{t('bankText')}</p>
        <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 bg-ink/80 px-4 py-3.5">
              <div className="min-w-0">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-paper/50">{r.label}</dt>
                <dd className={cn('mt-0.5 break-words text-[14.5px] tabular-nums', r.strong ? 'font-bold text-white' : 'font-medium text-paper/85')}>{r.value}</dd>
              </div>
              {r.copy && (
                <button
                  type="button"
                  onClick={() => copy(r.value)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-paper/80 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label={`${tk('copy')}: ${r.label}`}
                  title={tk('copy')}
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** How the prescription reaches us — with a WhatsApp / e-mail shortcut or the booking modal. */
function RxBox({ order, choice }: { order: Order; choice: RxChoice }) {
  const t = useDict(T);
  const tk = useDict(ck);
  const settings = useSettings();
  const wa = settings.whatsapp?.replace(/[^\d]/g, '');
  const msg = t('rxMsg', { n: order.number });
  return (
    <section className="rounded-3xl bg-sand/70 p-6 ring-1 ring-inset ring-line sm:p-8">
      <div className="flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand-600 ring-1 ring-line">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="display text-[26px] leading-tight text-ink">{t('rxTitle')}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">
            <span className="text-muted">{t('rxChoice')}</span> <span className="font-semibold text-ink">{tk(`rx_${choice}`)}</span>
          </p>
        </div>
      </div>
      <p className="mt-4 text-[14.5px] leading-relaxed text-ink-soft">{t(`rx_${choice}Text`, { n: order.number })}</p>
      {choice === 'send' && (
        <div className="mt-5 flex flex-wrap gap-2.5">
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25d366] px-5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              <WhatsAppIcon className="h-[18px] w-[18px]" /> {t('rxWhatsapp')}
            </a>
          )}
          <a
            href={`mailto:${settings.email}?subject=${encodeURIComponent(msg)}`}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-5 text-[14px] font-semibold text-ink transition-colors hover:border-ink/30"
          >
            <Mail className="h-4 w-4" /> {t('rxEmail')}
          </a>
        </div>
      )}
      {choice === 'exam' && (
        <Button className="mt-5" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => openBooking('exam')}>
          {t('rxBook')}
        </Button>
      )}
    </section>
  );
}

export default function OrderSuccess() {
  const { id } = useParams();
  const order = useDb((s) => s.orders.find((o) => o.id === id || o.number === id));
  if (!order) return <NotFoundState />;
  return <Success order={order} />;
}

function Success({ order }: { order: Order }) {
  const t = useDict(T);
  const tk = useDict(ck);
  const tc = useDict(common);
  const lang = useLang();
  const settings = useSettings();
  const items = useItemsLabel();
  const copy = useCopy();
  const discountRows = useDiscountRows(order.discounts);
  usePageTitle(t('pageTitle'));

  const c = order.customer;
  const name = c.firstName.replace(/\*/g, '').trim() || c.lastName;
  const pickup = order.delivery.method === 'pickup';
  const hasCare = order.items.some((i) => i.installation);
  const rx = rxChoiceFromNote(c.note);
  const ownNote = noteWithoutRx(c.note);
  const zone = zoneForCity(settings, c.city);
  const fullAddress = [c.address, c.city].filter(Boolean).join(', ');
  const count = order.items.reduce((s, i) => s + (i.unit === 'kom' || i.unit === 'set' ? i.qty : 1), 0);

  const steps = [
    rx
      ? { icon: FileText, title: t('n1rx'), when: t('n1when'), text: t('n1textRx', { phone: c.phone }) }
      : { icon: PhoneCall, title: t('n1'), when: t('n1when'), text: t('n1text', { phone: c.phone }) },
    ...(rx ? [{ icon: FlaskConical, title: t('n2lab'), when: t('n2labWhen'), text: t('n2labText') }] : []),
    pickup
      ? { icon: Store, title: t('n3pickup'), when: t('n3whenPickup'), text: t('n3pickupText', { address: settings.pickupAddress }) }
      : { icon: Truck, title: t('n3delivery'), when: rx ? t('n3whenRx') : t('n3when', { days: zone?.days ?? '1–3' }), text: t('n3deliveryText', { address: fullAddress }) },
    ...(hasCare ? [{ icon: ShieldPlus, title: t('n4care'), when: t('n4careWhen'), text: t('n4careText') }] : []),
  ];

  const PayIcon = { cod: Banknote, bank: Landmark, card: CreditCard }[order.payment.method];
  const payNote =
    order.payment.method === 'card'
      ? t('cardNote', { amount: money(order.total, lang) })
      : order.payment.method === 'cod'
        ? t(pickup ? 'codNotePickup' : 'codNote', { amount: money(order.total, lang) })
        : null;

  return (
    <div className="pb-4">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-white/80 to-paper">
        <Confetti />
        <div className="container-x relative flex flex-col items-center pb-14 pt-8 text-center sm:pb-16 sm:pt-10">
          <CheckoutSteps current={4} className="mb-10 sm:mb-12" />
          <SuccessCheck />
          <div className="eyebrow mt-7 animate-fade-up [animation-delay:250ms]">{t('eyebrow')}</div>
          <h1 className="display mt-3 animate-fade-up text-[42px] leading-[1.02] text-ink [animation-delay:320ms] sm:text-[64px]">
            <Accent text={t('thanks', { name })} />
          </h1>
          <p className="mt-4 max-w-xl animate-fade-up text-[16px] leading-relaxed text-muted [animation-delay:400ms] sm:text-[17px]">
            {t('lead')
              .split('{email}')
              .flatMap((part, i) => (i === 0 ? [part] : [<strong key={i} className="font-semibold text-ink">{c.email}</strong>, part]))}
          </p>
          <div className="mt-7 inline-flex animate-fade-up items-center gap-3 rounded-full bg-white py-1.5 pl-5 pr-1.5 shadow-[0_10px_30px_-18px_rgba(28,26,23,0.45)] ring-1 ring-line [animation-delay:480ms]">
            <span className="text-[13px] text-muted">{t('orderNo')}</span>
            <span className="text-[17px] font-bold tracking-wide text-ink">{order.number}</span>
            <button type="button" onClick={() => copy(order.number)} className="grid h-9 w-9 place-items-center rounded-full bg-sand text-ink-soft transition-colors hover:bg-ink hover:text-paper" aria-label={tk('copy')} title={tk('copy')}>
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 animate-fade-up text-[12.5px] text-muted [animation-delay:520ms]">{t('placedAt', { date: dateTime(order.createdAt, lang) })}</p>
        </div>
      </section>

      <div className="container-x grid grid-cols-1 items-start gap-8 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12 xl:gap-16">
        <div className="min-w-0 space-y-6">
          {rx && <RxBox order={order} choice={rx} />}
          {order.payment.method === 'bank' && <BankBox order={order} />}

          {/* What happens next */}
          <section className="rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8">
            <h2 className="display text-[30px] leading-tight text-ink">
              <Accent text={t('nextTitle')} />
            </h2>
            <ol className="mt-7">
              {steps.map((s, i) => (
                <Step key={i} {...s} first={i === 0} last={i === steps.length - 1} />
              ))}
            </ol>
          </section>

          {/* Delivery · payment · contact */}
          <section className="grid gap-px overflow-hidden rounded-3xl bg-line ring-1 ring-line sm:grid-cols-3">
            <div className="bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                {pickup ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                {t('deliveryTo')}
              </div>
              <p className="mt-2 text-[14px] font-semibold text-ink">{tc(`delivery_${order.delivery.method}`)}</p>
              <p className="mt-1 text-[13.5px] leading-snug text-muted">{pickup ? settings.pickupAddress : fullAddress}</p>
            </div>
            <div className="bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                <PayIcon className="h-3.5 w-3.5" />
                {t('payment')}
              </div>
              <p className="mt-2 text-[14px] font-semibold text-ink">{tc(`pay_${order.payment.method}`)}</p>
              <Badge tone={order.payment.status === 'paid' ? 'green' : order.payment.status === 'refunded' ? 'gray' : 'amber'} dot className="mt-2">
                {tc(`paystatus_${order.payment.status}`)}
              </Badge>
            </div>
            <div className="bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                <PhoneCall className="h-3.5 w-3.5" />
                {t('contact')}
              </div>
              <p className="mt-2 text-[14px] font-semibold text-ink">
                {c.firstName} {c.lastName}
              </p>
              <p className="mt-1 break-words text-[13.5px] leading-snug text-muted">
                {c.phone}
                <br />
                {c.email}
                {c.company && (
                  <>
                    <br />
                    {c.company}
                    {c.pib ? ` · NUI ${c.pib}` : ''}
                  </>
                )}
              </p>
              {ownNote && (
                <p className="mt-2 whitespace-pre-line text-[12.5px] leading-snug text-muted">
                  <span className="font-semibold text-ink-soft">{t('note')}:</span> {ownNote}
                </p>
              )}
            </div>
          </section>

          {payNote && (
            <p className={cn('flex items-start gap-2.5 rounded-2xl px-4 py-3.5 text-[13.5px] leading-snug ring-1 ring-inset', order.payment.method === 'card' ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/15' : 'bg-white text-ink-soft ring-line')}>
              {order.payment.method === 'card' ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />}
              {payNote}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink to="/produktet" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
              {t('continue')}
            </ButtonLink>
            <ButtonLink to={`/gjurmo-porosine?nr=${encodeURIComponent(order.number)}`} size="lg" variant="outline" icon={<PackageSearch className="h-4 w-4" />}>
              {t('track')}
            </ButtonLink>
            <ButtonLink to="/" size="lg" variant="outline" icon={<Home className="h-4 w-4" />}>
              {t('home')}
            </ButtonLink>
          </div>

          <Link
            to={`/admin/narudzbe/${order.id}`}
            className="group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-dashed border-ink/20 px-4 py-3.5 text-[13px] text-muted transition-colors hover:border-ink/40 hover:bg-white/60"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-paper">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-ink-soft">{t('demo')}</span> {t('demoText')}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-ink group-hover:text-brand-700">
              {t('demoLink')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-[100px]">
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-line">
            <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
              <h2 className="text-[15px] font-bold text-ink">
                {t('summary')} <span className="font-medium text-muted">· {items(count)}</span>
              </h2>
              <span className="text-[13px] font-semibold text-muted">{order.number}</span>
            </div>
            <ul className="divide-y divide-line px-6">
              {order.items.map((it, i) => {
                const u = units(it);
                const care = it.installation ? Math.round(it.installationPrice * u * 100) / 100 : 0;
                return (
                  <li key={i} className="flex gap-3.5 py-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-line">
                      {it.image && <Img src={it.image} small alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">{it.name}</p>
                        <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-ink">{money(it.lineTotal, lang)}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {it.unit === 'm2' && it.packSize ? tk('packsArea', { packs: it.qty, area: num(u, lang), unit: unitLabel('m2', lang) }) : `${it.qty} ${unitLabel(it.unit, lang)}`}
                        {it.options && <span className="block truncate">{it.options}</span>}
                      </p>
                      {care > 0 && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-brand-700">
                          <ShieldPlus className="h-3 w-3" />
                          {tk('plusInstallation', { amount: money(care, lang) })}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line bg-paper/60 px-6 py-5">
              <TotalsRows
                big
                v={{
                  subtotal: order.subtotal,
                  installationTotal: order.installationTotal,
                  discount: order.discount,
                  couponCode: order.coupon?.code,
                  discounts: discountRows,
                  shipping: order.shipping,
                  shippingFree: order.shipping === 0,
                  shippingLabel: pickup ? tc('delivery_pickup') : tc('shipping'),
                  total: order.total,
                  vat: order.vat,
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
