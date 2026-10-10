import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertCircle, CalendarClock, Clock, PhoneCall, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Accent, Badge, Img } from '@/components/ui/misc';
import { useDict, useL, useLang, lt } from '@/i18n';
import { useDb } from '@/store/db';
import { useSettings } from '@/store/hooks';
import type { Booking, Service } from '@/lib/types';
import { readRules, slotsForDay } from '@/admin/components/appointments/rules';
import { dayKey } from '@/admin/components/appointments/dates';
import { Breadcrumbs } from '@/site/components/SectionHeading';
import { usePageTitle } from '@/site/layout/SiteLayout';
import { bookable, dayInfo, daysFrom, firstFree, isFree, resolveService, type Ctx } from '@/site/components/booking/availability';
import { bk } from '@/site/components/booking/dict';
import { StepCard, reveal, useNow } from '@/site/components/booking/parts';
import { DayNav, DayPicker, NoSlots, ServicePicker, TimePicker, midDay, shortDay } from '@/site/components/booking/Pickers';
import { DetailsForm, type DetailsValues } from '@/site/components/booking/DetailsForm';
import { PhoneCard, SummaryCard } from '@/site/components/booking/Summary';
import { Confirmation } from '@/site/components/booking/Confirmation';

/** Days shown per page of the day picker, and how far ahead the visitor may page. */
const WINDOW = 14;
const MAX_OFFSET = 42;

/**
 * /rezervo — real slot booking: service → day → time → details. Availability comes from the CMS booking rules
 * (opening hours, holidays, notice, buffers, capacity) and the live calendar, so a slot can't be double-booked.
 * A booking creates the same records as the booking modal: an eye-exam inquiry (Kontakti) + a PENDING
 * appointment linked to it (Terminet).
 */
export default function BookingPage() {
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<{ booking: Booking; service: Service } | null>(null);
  if (done)
    return (
      <Confirmation
        booking={done.booking}
        service={done.service}
        onAnother={() => {
          setDone(null);
          setRound((r) => r + 1);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  return <BookingFlow key={round} onDone={setDone} />;
}

function BookingFlow({ onDone }: { onDone: (d: { booking: Booking; service: Service }) => void }) {
  const t = useDict(bk);
  const l = useL();
  const lang = useLang();
  usePageTitle(t('pageTitle'));
  const services = useDb((s) => s.services);
  const bookings = useDb((s) => s.bookings);
  const settings = useSettings();
  const now = useNow();
  const rules = useMemo(() => readRules(settings, new Date(now)), [settings, now]);
  const ctx = useMemo<Ctx>(() => ({ bookings, services, rules, now }), [bookings, services, rules, now]);
  const list = useMemo(() => services.filter(bookable), [services]);

  const [params, setParams] = useSearchParams();
  const param = params.get('sherbimi') ?? '';
  const [seenParam, setSeenParam] = useState(param);
  const [serviceId, setServiceId] = useState(() => resolveService(param, services)?.id ?? '');
  const [offset, setOffset] = useState(0);
  const [pickedDay, setPickedDay] = useState('');
  const [pickedTime, setPickedTime] = useState('');
  const [error, setError] = useState('');
  const step2 = useRef<HTMLElement>(null);
  const step3 = useRef<HTMLElement>(null);
  const step4 = useRef<HTMLElement>(null);

  // A header / footer link to "/rezervo?sherbimi=…" while the page is open → follow it.
  if (param !== seenParam) {
    setSeenParam(param);
    const s = resolveService(param, services);
    if (s && s.id !== serviceId) {
      setServiceId(s.id);
      setOffset(0);
      setPickedDay('');
      setPickedTime('');
    }
  }

  const service = list.find((s) => s.id === serviceId);
  const days = useMemo(() => (service ? daysFrom(now, offset, WINDOW).map((d) => dayInfo(d, service, ctx)) : []), [service, now, offset, ctx]);
  const anyFree = days.some((d) => d.free > 0);
  const day = days.find((d) => d.key === pickedDay) ?? days.find((d) => d.free > 0);
  const slot = day?.slots.find((s) => s.start === pickedTime && isFree(s));
  const nextFree = day ? (days.find((d) => d.free > 0 && d.key > day.key) ?? days.find((d) => d.free > 0)) : undefined;
  const heroService = service ?? list.find((s) => s.id === 'sv-kontrolli') ?? list[0];
  const heroNext = useMemo(() => (heroService ? firstFree(heroService, ctx) : undefined), [heroService, ctx]);
  const hours = l(settings.hours).split(/\s*·\s*/)[0] || t('chipHours');

  const chooseService = (id: string) => {
    setServiceId(id);
    setSeenParam(id);
    setOffset(0);
    setPickedDay('');
    setPickedTime('');
    setError('');
    setParams(
      (p) => {
        p.set('sherbimi', id);
        return p;
      },
      { replace: true, preventScrollReset: true },
    );
    reveal(step2.current);
  };
  const chooseDay = (key: string) => {
    setPickedDay(key);
    setPickedTime('');
    setError('');
  };
  const page = (o: number) => {
    setOffset(o);
    setPickedDay('');
    setPickedTime('');
  };
  const chooseTime = (start: string) => {
    setPickedTime(start);
    setError('');
    reveal(step4.current);
  };

  const taken = () => {
    setPickedTime('');
    setError(t('takenError'));
    toast.error(t('takenError'));
    reveal(step3.current);
  };

  /** Re-checks the slot against the live calendar, then writes inquiry + pending booking. */
  const submit = async (v: DetailsValues) => {
    if (!service || !slot) return false;
    const st = useDb.getState();
    const svc = st.services.find((s) => s.id === service.id);
    const fresh = svc
      ? slotsForDay(dayKey(slot.start), svc, '', { bookings: st.bookings, services: st.services, rules: readRules(st.settings), web: true }).slots.find((s) => s.start === slot.start && isFree(s))
      : undefined;
    if (!svc || !fresh?.staffId) {
      taken();
      return false;
    }
    const name = v.name.trim();
    const phone = v.phone.trim();
    const email = v.email.trim();
    const rxLine = v.rx ? `${t('rxNote')}: ${t(`rx_${v.rx}`)}` : '';
    const message = [rxLine, v.note.trim()].filter(Boolean).join('\n');
    const inq = st.addInquiry({
      type: 'measurement',
      name,
      phone,
      ...(email ? { email } : {}),
      service: lt(svc.name, lang),
      message: message || '—',
      preferredDate: dayKey(fresh.start),
    });
    const store = st.settings.locations?.find((x) => x.isDefault)?.id;
    const res = st.addBooking({
      serviceId: svc.id,
      staffId: fresh.staffId,
      customerName: name,
      phone,
      ...(email ? { email } : {}),
      start: fresh.start,
      location: svc.location ?? store ?? 'onsite',
      inquiryId: inq.id,
      note: [t('note_web'), rxLine, v.note.trim()].filter(Boolean).join(' — '),
      status: 'pending',
    });
    if (!res.ok) {
      st.deleteInquiry(inq.id);
      taken();
      return false;
    }
    // addBooking marks the inquiry scheduled + seen — a web request stays new/unseen in the inbox (as in MeasureForm).
    st.updateInquiry(inq.id, { status: 'new', seen: false, scheduledAt: res.booking.start });
    onDone({ booking: res.booking, service: svc });
    window.scrollTo({ top: 0 });
    return true;
  };

  const chip = 'inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-ink ring-1 ring-line';

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-paper">
        <div className="container-x grid items-center gap-10 pb-10 pt-8 sm:pb-14 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0">
            <Breadcrumbs items={[{ label: t('crumb') }]} />
            <div className="eyebrow mb-3 mt-8">{t('eyebrow')}</div>
            <h1 className="display max-w-3xl text-[40px] leading-[1.04] text-ink sm:text-[56px]">
              <Accent text={t('title')} />
            </h1>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted sm:text-[17px]">{t('lead')}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <span className={chip}>
                <Clock className="h-3.5 w-3.5 text-brand-600" />
                {hours}
              </span>
              <span className={chip}>
                <PhoneCall className="h-3.5 w-3.5 text-brand-600" />
                {t('chipConfirm')}
              </span>
              <span className={chip}>
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                {t('chipCancel', { h: rules.cancelNoticeHours })}
              </span>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-sand ring-1 ring-line">
              <Img src="/images/s/pershtatja.webp" eager alt="" className="h-full w-full object-cover" />
            </div>
            {heroService && heroNext && (
              <div className="absolute -bottom-6 -left-6 flex max-w-[300px] items-center gap-3 rounded-2xl bg-white p-3.5 pr-5 shadow-[0_24px_50px_-28px_rgba(28,26,23,0.55)] ring-1 ring-line">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                  <CalendarClock className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{t('heroNext')}</span>
                  <span className="block text-[14.5px] font-semibold text-ink">
                    {shortDay(heroNext.start, now, lang, t)} · {heroNext.label}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{l(heroService.name)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Flow */}
      <div className="container-x grid grid-cols-1 items-start gap-5 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-10">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <StepCard n={1} title={t('s1')} hint={t('s1Hint')} done={!!service}>
            <ServicePicker services={list} value={serviceId} onChange={chooseService} ctx={ctx} />
          </StepCard>

          <StepCard
            ref={step2}
            n={2}
            title={t('s2')}
            hint={t('s2Hint')}
            done={!!service && !!day && anyFree}
            locked={!service && t('lockedService')}
            aside={service && <DayNav days={days} offset={offset} maxOffset={MAX_OFFSET} onOffset={page} />}
          >
            {service && (anyFree ? <DayPicker days={days} value={day?.key ?? ''} onChange={chooseDay} now={now} /> : <NoSlots canNext={offset < MAX_OFFSET} onNext={() => page(offset + WINDOW)} />)}
          </StepCard>

          <StepCard
            ref={step3}
            n={3}
            title={t('s3')}
            hint={day ? t('slotsFor', { day: midDay(day.date, lang) }) : t('s3Hint')}
            done={!!slot}
            locked={(!service || !day || !anyFree) && (service ? t('lockedDay') : t('lockedService'))}
            aside={day && day.free > 0 && <Badge tone="green">{day.free === 1 ? t('freeOne') : t('freeN', { n: day.free })}</Badge>}
          >
            {error && (
              <p role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13.5px] font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            {day && <TimePicker info={day} value={slot?.start ?? ''} onChange={chooseTime} nextFree={nextFree && nextFree.key !== day.key ? nextFree : undefined} onJump={chooseDay} />}
          </StepCard>

          <StepCard ref={step4} n={4} title={t('s4')} hint={t('s4Hint')} locked={!slot && (service ? t('lockedTime') : t('lockedService'))}>
            <DetailsForm askRx={serviceId !== 'sv-marrja'} summary={<SummaryCard compact service={service} day={day?.date} start={slot?.start} />} onSubmit={submit} />
          </StepCard>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[100px]">
          <div className="hidden lg:block">
            <SummaryCard service={service} day={service ? day?.date : undefined} start={slot?.start} />
          </div>
          <PhoneCard />
        </aside>
      </div>
    </>
  );
}
