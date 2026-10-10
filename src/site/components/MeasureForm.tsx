import { useState } from 'react';
import { CalendarClock, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { defineDict, useDict, useLang } from '@/i18n';
import { site } from '@/i18n/site';
import { useDb } from '@/store/db';
import { useSettings } from '@/store/hooks';
import { allCities } from '@/lib/pricing';
import type { InquiryType, Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { longDate, timeRange } from '@/admin/components/appointments/dates';
import { readRules, webSlot } from '@/admin/components/appointments/rules';

/** Form copy that is specific to the optician (the shared field labels live in `site`). */
const F = defineDict({
  me: {
    slot: 'Okvirni termin: {when}',
    slotHint: 'Termin čeka potvrdu — potvrdićemo ga telefonom.',
    sv_exam: 'Pregled vida',
    sv_fitting: 'Prilagođavanje i merenje PD',
    sv_contacts: 'Kontaktna sočiva',
    sv_repair: 'Popravka i podešavanje',
    sv_clinic: 'Konsultacija u Klinici Miftari',
    sv_other: 'Drugo',
    rx: 'Imate li recept?',
    rx_yes: 'Imam recept',
    rx_no: 'Još nemam recept',
    rx_note: 'Recept',
    otherCity: 'Drugi grad / van Kosova',
    company: 'Optika / firma',
    companyPh: 'Naziv vaše optike',
    ph_contact: 'Npr. pitanje o okviru, porudžbini ili radnom vremenu',
    ph_quote: 'Npr. 20 pari progresivnih sočiva 1.6 sa antirefleksom, isporuka u Prištinu',
    ph_quoteProduct: 'Upišite dioptriju (SPH / CYL / AX) ili nam recept donesite u optiku',
    successExam: 'Zahtev je primljen. Javićemo vam se na {phone} da potvrdimo termin pregleda.',
  },
  sq: {
    slot: 'Termin i përkohshëm: {when}',
    slotHint: 'Termini është në pritje — do ta konfirmojmë me telefon.',
    sv_exam: 'Kontroll i syve',
    sv_fitting: 'Përshtatje & matje PD',
    sv_contacts: 'Lente kontakti',
    sv_repair: 'Riparim & rregullim',
    sv_clinic: 'Konsultë në Klinikën Miftari',
    sv_other: 'Tjetër',
    rx: 'Keni recetë?',
    rx_yes: 'Kam recetë',
    rx_no: 'Nuk kam ende recetë',
    rx_note: 'Receta',
    otherCity: 'Qytet tjetër / jashtë Kosovës',
    company: 'Optika / kompania',
    companyPh: 'Emri i optikës suaj',
    ph_contact: 'P.sh. pyetje për një kornizë, porosinë ose orarin',
    ph_quote: 'P.sh. 20 palë lente progresive 1.6 me antirefleks, dërgesë në Prishtinë',
    ph_quoteProduct: 'Shkruani dioptrinë (SPH / CYL / AX) ose sillni recetën në optikë',
    successExam: 'Kërkesa u pranua. Do t’ju telefonojmë në {phone} për ta konfirmuar terminin e kontrollit.',
  },
  en: {
    slot: 'Provisional slot: {when}',
    slotHint: 'Pending — we will confirm it by phone.',
    sv_exam: 'Eye exam',
    sv_fitting: 'Fitting & PD measurement',
    sv_contacts: 'Contact lenses',
    sv_repair: 'Repair & adjustment',
    sv_clinic: 'Klinika Miftari consultation',
    sv_other: 'Other',
    rx: 'Do you have a prescription?',
    rx_yes: 'I have a prescription',
    rx_no: 'I don’t have one yet',
    rx_note: 'Prescription',
    otherCity: 'Another town / outside Kosovo',
    company: 'Optician / company',
    companyPh: 'Your practice name',
    ph_contact: 'E.g. a question about a frame, your order or opening hours',
    ph_quote: 'E.g. 20 pairs of 1.6 progressive lenses with anti-reflective coating, delivered to Prishtina',
    ph_quoteProduct: 'Enter your prescription (SPH / CYL / AX) or bring it to the store',
    successExam: 'Request received. We’ll call you on {phone} to confirm your exam time.',
  },
});

/** Services offered in the booking form, stored on the inquiry in the shopper's language. */
export const SERVICE_KEYS = ['exam', 'fitting', 'contacts', 'repair', 'clinic', 'other'] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];
const isServiceKey = (v: string): v is ServiceKey => (SERVICE_KEYS as readonly string[]).includes(v);

/** Calendar service a web booking lands on, matched by name so it survives CMS renames. */
const SERVICE_MATCH: Partial<Record<ServiceKey, RegExp>> = {
  exam: /kontroll|exam|pregled/i,
  fitting: /përshtat|fitting|prilago/i,
  contacts: /lente kontakti|contact lens|kontaktn/i,
  repair: /riparim|repair|popravk/i,
  clinic: /klinik|clinic/i,
};

function pickService(services: Service[], key: ServiceKey | ''): Service | undefined {
  const byName = (re?: RegExp) => (re ? services.find((s) => re.test(`${s.name.sq} ${s.name.en} ${s.name.me}`)) : undefined);
  const specific = key && key !== 'exam' ? byName(SERVICE_MATCH[key]) : undefined;
  return specific ?? services.find((s) => s.id === 'sv-kontrolli') ?? byName(SERVICE_MATCH.exam) ?? services[0];
}

/**
 * Lead form: eye-exam booking (`measurement`), contact message (`contact`) and price / B2B lens requests
 * (`quote`). Submissions land in the CMS inbox instantly; a booking with a preferred day also reserves a
 * pending calendar slot.
 */
export function MeasureForm({
  type = 'measurement',
  productId,
  defaultService,
  defaultMessage,
  b2b = false,
  className,
  onDone,
}: {
  type?: InquiryType;
  productId?: string;
  /** A service key ("exam", "clinic"…) or free text */
  defaultService?: string;
  defaultMessage?: string;
  /** Optical Lab partner request: shows the company field and a lab-order placeholder */
  b2b?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const t = useDict(site);
  const f = useDict(F);
  const settings = useSettings();
  const addInquiry = useDb((s) => s.addInquiry);
  const lang = useLang();
  const blank = { name: '', phone: '', email: '', city: '', company: '', service: defaultService ?? '', rx: '' as '' | 'yes' | 'no', date: '', message: defaultMessage ?? '' };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<{ name: string; phone: string; slot?: { start: string; durationMin: number } } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: 'name' | 'phone' | 'email' | 'city' | 'company' | 'date' | 'message') => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }));
  const today = new Date().toISOString().slice(0, 10);
  const exam = type === 'measurement';
  const serviceLabel = (v: string) => (isServiceKey(v) ? f(`sv_${v}`) : v);
  const placeholder = exam ? t('f_messagePh') : type === 'contact' ? f('ph_contact') : b2b || !productId ? f('ph_quote') : f('ph_quoteProduct');
  const cities = allCities(settings);

  /**
   * A booking with a preferred day also books a PENDING appointment (the first free slot that day) linked
   * to the inquiry. Closed / full day → no booking; the team schedules it by hand.
   */
  const bookSlot = (inquiryId: string, day: string, note: string) => {
    const st = useDb.getState();
    const service = pickService(st.services, isServiceKey(form.service) ? form.service : '');
    if (!service) return undefined;
    const slot = webSlot(day, service, { bookings: st.bookings, services: st.services, rules: readRules(st.settings) });
    if (!slot?.staffId) return undefined;
    const store = st.settings.locations?.find((x) => x.isDefault)?.id;
    const res = st.addBooking({
      serviceId: service.id,
      staffId: slot.staffId,
      customerName: form.name.trim(),
      phone: form.phone.trim(),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.city ? { city: form.city } : {}),
      start: slot.start,
      location: service.location ?? store ?? 'onsite',
      inquiryId,
      note: note || undefined,
      status: 'pending',
    });
    if (!res.ok) return undefined;
    // addBooking marks the inquiry as scheduled + seen — a web request must stay new/unseen in the inbox.
    st.updateInquiry(inquiryId, { status: 'new', seen: false, scheduledAt: res.booking.start });
    return { start: res.booking.start, durationMin: res.booking.durationMin };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!form.name.trim()) err.name = t('f_required');
    if (!form.phone.trim()) err.phone = t('f_required');
    else if (form.phone.replace(/\D/g, '').length < 8) err.phone = t('f_invalidPhone');
    if (type === 'contact' && !form.message.trim()) err.message = t('f_required');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 650));
    const service = form.service ? serviceLabel(form.service) : '';
    // The prescription answer has no field of its own on the inquiry — it travels in the message.
    const rx = exam && form.rx ? `${f('rx_note')}: ${f(form.rx === 'yes' ? 'rx_yes' : 'rx_no')}` : '';
    const message = [rx, form.message.trim()].filter(Boolean).join('\n');
    const inq = addInquiry({
      type,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      city: form.city || undefined,
      company: form.company.trim() || undefined,
      service: service || undefined,
      productId,
      message: message || '—',
      preferredDate: form.date || undefined,
    });
    const slot = exam && form.date ? bookSlot(inq.id, form.date, [service, message].filter(Boolean).join(' — ')) : undefined;
    setBusy(false);
    setSent({ name: form.name.trim().split(' ')[0], phone: form.phone.trim(), slot });
    onDone?.();
  };

  const chip = (on: boolean) =>
    cn('rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors', on ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink-soft hover:border-ink/30');

  if (sent) {
    return (
      <div className={cn('flex flex-col items-center justify-center rounded-3xl bg-white p-8 text-center ring-1 ring-line sm:p-10', className)}>
        <span className="grid h-14 w-14 animate-pop place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3 className="display mt-5 text-3xl">{t('f_successTitle', { name: sent.name })}</h3>
        <p className="mt-2 max-w-sm text-muted">{exam ? f('successExam', { phone: sent.phone }) : t('f_successText', { phone: sent.phone })}</p>
        {sent.slot && (
          <div className="mt-5 flex max-w-sm items-start gap-3 rounded-2xl bg-sand/60 px-4 py-3 text-left ring-1 ring-line">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span className="text-sm">
              <span className="block font-semibold text-ink">{f('slot', { when: `${longDate(sent.slot.start, lang)}, ${timeRange(sent.slot.start, sent.slot.durationMin)}` })}</span>
              <span className="mt-0.5 block text-muted">{f('slotHint')}</span>
            </span>
          </div>
        )}
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setSent(null);
            setForm({ ...blank, message: '' });
          }}
        >
          {t('f_newRequest')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={cn('rounded-3xl bg-white p-6 ring-1 ring-line sm:p-8', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('f_name')} required value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" />
        <Input label={t('f_phone')} required type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="+383 4_ ___ ___" autoComplete="tel" />
        {type === 'contact' ? (
          <Input label={t('f_email')} type="email" value={form.email} onChange={set('email')} wrapClassName="sm:col-span-2" autoComplete="email" />
        ) : (
          <>
            {b2b && <Input label={f('company')} value={form.company} onChange={set('company')} placeholder={f('companyPh')} autoComplete="organization" />}
            <Select label={t('f_city')} value={form.city} onChange={set('city')}>
              <option value="">{t('f_chooseCity')}</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={f('otherCity')}>{f('otherCity')}</option>
            </Select>
            {exam ? (
              <Input label={t('f_date')} type="date" min={today} value={form.date} onChange={set('date')} />
            ) : (
              <Input label={t('f_email')} type="email" value={form.email} onChange={set('email')} autoComplete="email" wrapClassName={b2b ? 'sm:col-span-2' : undefined} />
            )}
            {exam && (
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{t('f_service')}</span>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_KEYS.map((k) => (
                    <button key={k} type="button" aria-pressed={form.service === k} onClick={() => setForm((x) => ({ ...x, service: x.service === k ? '' : k }))} className={chip(form.service === k)}>
                      {f(`sv_${k}`)}
                    </button>
                  ))}
                  {form.service && !isServiceKey(form.service) && (
                    <button type="button" aria-pressed className={chip(true)} onClick={() => setForm((x) => ({ ...x, service: '' }))}>
                      {form.service}
                    </button>
                  )}
                </div>
              </div>
            )}
            {exam && (
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{f('rx')}</span>
                <div className="inline-flex flex-wrap gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
                  {(['yes', 'no'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={form.rx === v}
                      onClick={() => setForm((x) => ({ ...x, rx: x.rx === v ? '' : v }))}
                      className={cn('min-h-10 rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors sm:min-h-0', form.rx === v ? 'bg-white text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink')}
                    >
                      {f(v === 'yes' ? 'rx_yes' : 'rx_no')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <Textarea label={t('f_message')} rows={3} value={form.message} onChange={set('message')} placeholder={placeholder} error={errors.message} wrapClassName="sm:col-span-2" />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted sm:max-w-[55%]">{t('f_privacy')}</p>
        <Button type="submit" size="lg" loading={busy} iconRight={<Send className="h-4 w-4" />}>
          {t('f_submit')}
        </Button>
      </div>
    </form>
  );
}
