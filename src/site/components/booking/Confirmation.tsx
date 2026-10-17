import { Link } from 'react-router';
import { ArrowRight, CalendarPlus, Check, Clock, Home, LayoutDashboard, MapPin, Phone, RotateCcw } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Accent, Badge } from '@/components/ui/misc';
import { WhatsAppIcon } from '@/components/brand/Social';
import { useDict, useL, useLang } from '@/i18n';
import { useSettings } from '@/store/hooks';
import { date } from '@/lib/format';
import type { Booking, Service } from '@/lib/types';
import { dayKey, hhmm, timeRange } from '@/admin/components/appointments/dates';
import { readRules } from '@/admin/components/appointments/rules';
import { telHref } from '@/site/components/content/posts';
import { SuccessCheck } from '@/site/components/checkout/Celebrate';
import { BRING, BRING_DEFAULT, bk } from './dict';
import { buildIcs, downloadIcs, locationOf } from './availability';
import { longDay, midDay } from './Pickers';
import { PhoneCard } from './Summary';

const pill = 'inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold transition';

/** Confirmation after a web booking: summary, calendar file, WhatsApp, map, what to bring. */
export function Confirmation({ booking, service, onAnother }: { booking: Booking; service: Service; onAnother: () => void }) {
  const t = useDict(bk);
  const l = useL();
  const lang = useLang();
  const settings = useSettings();
  const cancelH = readRules(settings).cancelNoticeHours;
  const loc = locationOf(service, settings);
  const isMain = !!loc?.isDefault;
  const address = isMain ? `${settings.address}, ${settings.city}` : [loc?.address, loc?.city].filter(Boolean).join(', ');
  const name = booking.customerName.split(/\s+/)[0] || booking.customerName;
  const svc = l(service.name);
  const start = new Date(booking.start);
  const when = `${midDay(start, lang)}, ${hhmm(start)}`;
  const wa = (settings.whatsapp ?? '').replace(/\D/g, '');
  const waText = t('waMsg', { service: svc, when, name: booking.customerName });
  const bring = BRING[service.id] ?? BRING_DEFAULT;

  const addToCalendar = () =>
    downloadIcs(
      `optika-miftari-${dayKey(start)}.ics`,
      buildIcs({
        uid: booking.id,
        start: booking.start,
        durationMin: booking.durationMin,
        title: t('icsTitle', { service: svc }),
        location: [loc?.name ?? settings.companyName, address].filter(Boolean).join(', '),
        description: `${t('icsDesc', { phone: settings.phone })}\n${address}`,
        alarm: t('icsAlarm'),
        tentative: booking.status === 'pending',
      }),
    );

  return (
    <div className="pb-6">
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-white/80 to-paper">
        <div className="container-x flex flex-col items-center pb-12 pt-10 text-center sm:pb-14 sm:pt-14">
          <SuccessCheck />
          <div className="eyebrow mt-7 animate-fade-up [animation-delay:250ms]">{t('okEyebrow')}</div>
          <h1 className="display mt-3 animate-fade-up text-[40px] leading-[1.03] text-ink [animation-delay:320ms] sm:text-[60px]">
            <Accent text={t('okTitle', { name })} />
          </h1>
          <p className="mt-4 max-w-xl animate-fade-up text-[16px] leading-relaxed text-muted [animation-delay:400ms] sm:text-[17px]">{t('okText', { phone: booking.phone.replace(/ /g, ' ') })}</p>
          <Badge tone="amber" dot className="mt-5 animate-fade-up [animation-delay:480ms]">
            {t('okPending')}
          </Badge>
        </div>
      </section>

      <div className="container-x grid grid-cols-1 items-start gap-6 pt-10 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
        <div className="min-w-0 space-y-6">
          {/* The appointment */}
          <section className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-8" aria-label={t('summary')}>
            <div className="flex items-start gap-4 sm:gap-6">
              <div className="w-[84px] shrink-0 overflow-hidden rounded-2xl text-center ring-1 ring-line sm:w-[104px]">
                <div className="bg-brand-600 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white">{date(start, lang, { month: 'short' })}</div>
                <div className="bg-white pb-2 pt-1.5">
                  <div className="display text-[38px] leading-none text-ink sm:text-[46px]">{start.getDate()}</div>
                  <div className="mt-1 text-[11.5px] font-semibold text-muted">{date(start, lang, { weekday: 'short' })}</div>
                </div>
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="eyebrow">{t('summary')}</div>
                <h2 className="display mt-1 text-[26px] leading-tight text-ink sm:text-[32px]">{svc}</h2>
                <p className="mt-2 flex items-start gap-2 text-[14.5px] font-semibold text-ink">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>
                    {longDay(start, lang)} · <span className="whitespace-nowrap">{timeRange(booking.start, booking.durationMin)}</span>
                  </span>
                </p>
                {loc && (
                  <p className="mt-1.5 flex items-start gap-2 text-[14px] text-muted">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>
                      <span className="font-semibold text-ink-soft">{loc.name}</span> · {address}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5 border-t border-line pt-6">
              <Button onClick={addToCalendar} icon={<CalendarPlus className="h-4 w-4" />}>
                {t('addCal')}
              </Button>
              {wa && (
                <a href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" className={`${pill} bg-[#25d366] text-[#04210f] hover:brightness-95`}>
                  <WhatsAppIcon className="h-[18px] w-[18px]" /> {t('waConfirm')}
                </a>
              )}
              {isMain && settings.mapUrl && (
                <a href={settings.mapUrl} target="_blank" rel="noreferrer" className={`${pill} border border-line bg-white text-ink hover:border-ink/30`}>
                  <MapPin className="h-4 w-4" /> {t('map')}
                </a>
              )}
              <a href={telHref(settings.phone)} className={`${pill} border border-line bg-white text-ink hover:border-ink/30`}>
                <Phone className="h-4 w-4" /> {t('call')}
              </a>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant="dark" icon={<RotateCcw className="h-4 w-4" />} onClick={onAnother}>
              {t('another')}
            </Button>
            <ButtonLink to="/" size="lg" variant="outline" icon={<Home className="h-4 w-4" />}>
              {t('home')}
            </ButtonLink>
          </div>

          <Link
            to={`/admin/termini?id=${encodeURIComponent(booking.id)}`}
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

        <aside className="space-y-4 lg:sticky lg:top-[100px]">
          <section className="rounded-3xl bg-sand/70 p-6 ring-1 ring-inset ring-line sm:p-7">
            <h2 className="display text-[26px] leading-tight text-ink">
              <Accent text={t('bringTitle')} />
            </h2>
            <ul className="mt-5 space-y-3">
              {bring.map((k) => (
                <li key={k} className="flex items-start gap-3 text-[14px] leading-snug text-ink-soft">
                  <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-brand-600 ring-1 ring-line">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">{t('cancelText', { h: cancelH })}</p>
          </section>
          <PhoneCard />
        </aside>
      </div>
    </div>
  );
}
