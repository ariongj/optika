import { defineDict } from '@/i18n';
import type { Lang } from '@/lib/types';

/** Strings shared by the cart → checkout → confirmation flow. `me` = Serbian (Latin). */
export const ck = defineDict({
  me: {
    step_cart: 'Korpa',
    step_details: 'Podaci',
    step_payment: 'Plaćanje',
    step_done: 'Potvrda',
    stepsLabel: 'Koraci kupovine',
    items_one: '{n} artikal',
    items_few: '{n} artikla',
    items_many: '{n} artikala',
    couponLabel: 'Kod za popust',
    couponHave: 'Imate kod za popust?',
    couponPh: 'Unesite kod',
    couponApply: 'Primeni',
    couponRemove: 'Ukloni kod',
    couponSaving: 'Ušteda {amount} na ovoj narudžbi',
    couponDemo: 'Demo kod:',
    err_notfound: 'Kod „{code}“ ne postoji — proverite da li je ispravno unet.',
    err_inactive: 'Kod „{code}“ trenutno nije aktivan.',
    err_expired: 'Kod „{code}“ je istekao.',
    err_min: 'Kod važi za narudžbe od {amount} — dodajte još {left}.',
    err_minQty: 'Kod važi uz najmanje {amount} artikala — dodajte još {left}.',
    err_scheduled: 'Kod „{code}“ još nije počeo da važi.',
    err_notCombinable: 'Kod „{code}“ se ne može kombinovati sa popustom koji je već primenjen — zadržali smo povoljniju opciju.',
    err_notEligible: 'Kod „{code}“ ne važi za proizvode u korpi.',
    err_usageLimit: 'Kod „{code}“ je iskorišćen do kraja.',
    err_audience: 'Kod „{code}“ važi samo za odabrane kupce.',
    free: 'Besplatno',
    from: 'od {amount}',
    shippingCalc: 'Tačan iznos nakon izbora grada',
    free_threshold: 'narudžba preko {amount}',
    free_installation: 'besplatna dostava uz Nega+',
    free_pickup: 'preuzimanje u optici',
    vatNote: 'PDV ({rate}%) uračunat: {amount}',
    trust_secure: 'Sigurno plaćanje',
    trust_secureText: 'Pouzećem, uplatom na račun ili karticom preko zaštićene stranice banke.',
    trust_exam: 'Pregled vida',
    trust_examText: 'Pre izrade sočiva možete zakazati pregled kod nas.',
    trust_warranty: 'Garancija i servis',
    trust_warrantyText: 'Pisana garancija na okvire i sočiva, servis i podešavanje u optici.',
    installation: 'Nega+',
    plusInstallation: '+ Nega+ {amount}',
    packsArea: '{packs} pak. · {area} {unit}',
    copied: 'Kopirano',
    copy: 'Kopiraj',
    rx_title: 'Recept',
    rx_desc: 'Dioptrijska sočiva izrađujemo po vašem receptu. Kako da ga dobijemo?',
    rx_send: 'Poslaću recept preko WhatsApp-a/e-maila',
    rx_sendDesc: 'Dovoljna je fotografija recepta — pišemo vam odmah nakon narudžbe.',
    rx_have: 'Imam recept iz Optike Miftari',
    rx_haveDesc: 'Nalazimo ga u našoj evidenciji — samo potvrdite ime i telefon.',
    rx_exam: 'Zakaži besplatan pregled pre izrade',
    rx_examDesc: 'Sočiva izrađujemo tek nakon pregleda u optici.',
    rx_examNow: 'Izaberi termin',
    rx_pd: 'Za PD (razmak zenica) se ne brinite — merimo ga pri pregledu ili ga uzimamo sa vašeg recepta.',
    rx_summary: 'Recept',
  },
  sq: {
    step_cart: 'Shporta',
    step_details: 'Të dhënat',
    step_payment: 'Pagesa',
    step_done: 'Konfirmimi',
    stepsLabel: 'Hapat e blerjes',
    items_one: '{n} artikull',
    items_few: '{n} artikuj',
    items_many: '{n} artikuj',
    couponLabel: 'Kodi i zbritjes',
    couponHave: 'Keni kod zbritjeje?',
    couponPh: 'Shkruani kodin',
    couponApply: 'Apliko',
    couponRemove: 'Hiq kodin',
    couponSaving: 'Kurseni {amount} në këtë porosi',
    couponDemo: 'Kodi demo:',
    err_notfound: 'Kodi „{code}“ nuk ekziston — kontrolloni nëse është shkruar saktë.',
    err_inactive: 'Kodi „{code}“ aktualisht nuk është aktiv.',
    err_expired: 'Kodi „{code}“ ka skaduar.',
    err_min: 'Kodi vlen për porosi nga {amount} — shtoni edhe {left}.',
    err_minQty: 'Kodi vlen me të paktën {amount} artikuj — shtoni edhe {left}.',
    err_scheduled: 'Kodi „{code}“ ende nuk ka filluar të vlejë.',
    err_notCombinable: 'Kodi „{code}“ nuk kombinohet me zbritjen e aplikuar — ruajtëm opsionin më të leverdishëm.',
    err_notEligible: 'Kodi „{code}“ nuk vlen për produktet në shportë.',
    err_usageLimit: 'Kodi „{code}“ është përdorur deri në fund.',
    err_audience: 'Kodi „{code}“ vlen vetëm për klientë të caktuar.',
    free: 'Falas',
    from: 'nga {amount}',
    shippingCalc: 'Shuma e saktë pasi të zgjidhni qytetin',
    free_threshold: 'porosi mbi {amount}',
    free_installation: 'transport falas me Kujdes+',
    free_pickup: 'marrje në optikë',
    vatNote: 'TVSH ({rate}%) e përfshirë: {amount}',
    trust_secure: 'Pagesë e sigurt',
    trust_secureText: 'Në dorëzim, me transfertë bankare ose me kartelë në faqen e mbrojtur të bankës.',
    trust_exam: 'Kontroll i syve',
    trust_examText: 'Para punimit të lenteve mund të rezervoni kontrollin te ne.',
    trust_warranty: 'Garanci dhe servis',
    trust_warrantyText: 'Garanci me shkrim për kornizat dhe lentet, servis dhe rregullim në optikë.',
    installation: 'Kujdes+',
    plusInstallation: '+ Kujdes+ {amount}',
    packsArea: '{packs} pako · {area} {unit}',
    copied: 'U kopjua',
    copy: 'Kopjo',
    rx_title: 'Receta',
    rx_desc: 'Lentet me dioptri i punojmë sipas recetës suaj. Si do ta marrim?',
    rx_send: 'Do ta dërgoj recetën me WhatsApp/e-mail',
    rx_sendDesc: 'Mjafton një foto e recetës — ju shkruajmë menjëherë pas porosisë.',
    rx_have: 'Kam recetë nga Optika Miftari',
    rx_haveDesc: 'E gjejmë në evidencën tonë — vetëm konfirmoni emrin dhe telefonin.',
    rx_exam: 'Rezervo kontroll falas para punimit',
    rx_examDesc: 'Lentet i punojmë vetëm pas kontrollit në optikë.',
    rx_examNow: 'Zgjidh terminin',
    rx_pd: 'Mos u shqetësoni për PD-në (largësinë mes bebëzave) — e masim gjatë kontrollit ose e marrim nga receta juaj.',
    rx_summary: 'Receta',
  },
  en: {
    step_cart: 'Bag',
    step_details: 'Details',
    step_payment: 'Payment',
    step_done: 'Confirmation',
    stepsLabel: 'Checkout steps',
    items_one: '{n} item',
    items_few: '{n} items',
    items_many: '{n} items',
    couponLabel: 'Discount code',
    couponHave: 'Have a discount code?',
    couponPh: 'Enter code',
    couponApply: 'Apply',
    couponRemove: 'Remove code',
    couponSaving: 'You save {amount} on this order',
    couponDemo: 'Demo code:',
    err_notfound: 'Code “{code}” doesn’t exist — please check the spelling.',
    err_inactive: 'Code “{code}” is not active at the moment.',
    err_expired: 'Code “{code}” has expired.',
    err_min: 'This code applies to orders from {amount} — add {left} more.',
    err_minQty: 'This code needs at least {amount} items — add {left} more.',
    err_scheduled: 'Code “{code}” is not valid yet.',
    err_notCombinable: 'Code “{code}” can’t be combined with the discount already applied — we kept the better deal.',
    err_notEligible: 'Code “{code}” doesn’t apply to the items in your bag.',
    err_usageLimit: 'Code “{code}” has been fully used.',
    err_audience: 'Code “{code}” is only for selected customers.',
    free: 'Free',
    from: 'from {amount}',
    shippingCalc: 'Exact amount once you pick a city',
    free_threshold: 'order over {amount}',
    free_installation: 'free delivery with Care+',
    free_pickup: 'pickup in store',
    vatNote: 'VAT ({rate}%) included: {amount}',
    trust_secure: 'Secure payment',
    trust_secureText: 'Cash on delivery, bank transfer or card on the bank’s protected page.',
    trust_exam: 'Eye exam',
    trust_examText: 'You can book an eye exam with us before your lenses are made.',
    trust_warranty: 'Warranty & service',
    trust_warrantyText: 'Written warranty on frames and lenses, with servicing and adjustments in store.',
    installation: 'Care+',
    plusInstallation: '+ Care+ {amount}',
    packsArea: '{packs} packs · {area} {unit}',
    copied: 'Copied',
    copy: 'Copy',
    rx_title: 'Prescription',
    rx_desc: 'Your lenses are made to your prescription. How shall we get it?',
    rx_send: 'I’ll send my prescription by WhatsApp/e-mail',
    rx_sendDesc: 'A photo of the prescription is enough — we’ll message you right after you order.',
    rx_have: 'I have a prescription from Optika Miftari',
    rx_haveDesc: 'We’ll find it in our records — just confirm your name and phone.',
    rx_exam: 'Book a free eye exam before production',
    rx_examDesc: 'We only make the lenses after your exam at the store.',
    rx_examNow: 'Pick a time',
    rx_pd: 'Don’t worry about your PD (pupillary distance) — we measure it at the exam or take it from your prescription.',
    rx_summary: 'Prescription',
  },
});

/** Plural category for item counts (Serbian has one / few / many). */
export function pluralKey(n: number, lang: Lang): 'items_one' | 'items_few' | 'items_many' {
  if (lang === 'me') {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'items_one';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'items_few';
    return 'items_many';
  }
  return n === 1 ? 'items_one' : 'items_many';
}

/* ------------------------------------------------------------------ */
/* Prescription step                                                   */
/* ------------------------------------------------------------------ */
export type RxChoice = 'send' | 'have' | 'exam';
export const RX_CHOICES: RxChoice[] = ['send', 'have', 'exam'];

/**
 * The choice is stored in the order's customer note (no schema change) — always in Albanian, the staff language:
 * "Receta: Do ta dërgoj recetën me WhatsApp/e-mail".
 */
export const RX_NOTE_PREFIX = 'Receta: ';
const RX_NOTE: Record<RxChoice, string> = {
  send: ck.sq.rx_send,
  have: ck.sq.rx_have,
  exam: ck.sq.rx_exam,
};
export const rxNoteLine = (c: RxChoice) => RX_NOTE_PREFIX + RX_NOTE[c];

/** Reads the prescription choice back from a customer note (confirmation page). */
export function rxChoiceFromNote(note: string | undefined): RxChoice | null {
  if (!note) return null;
  return RX_CHOICES.find((c) => note.includes(rxNoteLine(c))) ?? null;
}

/** The customer's own note without the prescription line. */
export const noteWithoutRx = (note: string | undefined) =>
  (note ?? '')
    .split('\n')
    .filter((line) => !line.startsWith(RX_NOTE_PREFIX))
    .join('\n')
    .trim();
