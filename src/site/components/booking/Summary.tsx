import type { ComponentType, ReactNode } from 'react';
import { CalendarDays, Clock, MapPin, Phone, Stethoscope } from 'lucide-react';
import { Img } from '@/components/ui/misc';
import { WhatsAppIcon } from '@/components/brand/Social';
import { useDict, useL, useLang } from '@/i18n';
import { useSettings } from '@/store/hooks';
import type { Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { timeRange } from '@/admin/components/appointments/dates';
import { telHref } from '@/site/components/content/posts';
import { SERVICE_IMAGE, locationOf } from './availability';
import { bk } from './dict';
import { longDay } from './Pickers';

function Row({ icon: Icon, label, children, muted }: { icon: ComponentType<{ className?: string }>; label: string; children: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper text-ink-soft ring-1 ring-inset ring-line">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</div>
        <div className={cn('mt-0.5 text-[14px] leading-snug', muted ? 'text-muted' : 'font-semibold text-ink')}>{children}</div>
      </div>
    </div>
  );
}

/** What is being booked: service, day + time, duration, store. */
export function SummaryCard({ service, day, start, compact }: { service?: Service; day?: Date; start?: string; compact?: boolean }) {
  const t = useDict(bk);
  const l = useL();
  const lang = useLang();
  const settings = useSettings();
  const loc = service ? locationOf(service, settings) : undefined;
  const img = service ? SERVICE_IMAGE[service.id] : undefined;
  const when = day ? `${longDay(day, lang)}${start && service ? ` · ${timeRange(start, service.durationMin)}` : ''}` : '';
  const isMain = loc?.isDefault;

  if (compact) {
    if (!service) return null;
    return (
      <div className="rounded-2xl bg-paper px-4 py-1 ring-1 ring-inset ring-line">
        <Row icon={Stethoscope} label={t('sumService')}>
          {l(service.name)}
        </Row>
        {when && (
          <div className="border-t border-line">
            <Row icon={CalendarDays} label={t('sumWhen')}>
              {when}
            </Row>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-line">
      <div className="relative aspect-[2/1] overflow-hidden bg-sand">
        {img ? <Img src={img} alt="" className="h-full w-full object-cover" /> : <div className="bg-grain absolute inset-0" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="eyebrow text-brand-200">{t('summary')}</div>
          <div className="display mt-1 text-[24px] leading-tight text-white">{service ? l(service.name) : '—'}</div>
        </div>
      </div>
      <div className="divide-y divide-line px-5">
        {!service ? (
          <p className="py-5 text-[13.5px] text-muted">{t('sumEmpty')}</p>
        ) : (
          <>
            <Row icon={CalendarDays} label={t('sumWhen')} muted={!when}>
              {when || '—'}
            </Row>
            <Row icon={Clock} label={t('sumDuration')}>
              {t('min', { n: service.durationMin })}
            </Row>
            {loc && (
              <Row icon={MapPin} label={t('sumWhere')}>
                {loc.name}
                <span className="block text-[13px] font-normal text-muted">
                  {isMain ? `${settings.address}, ${settings.city}` : [loc.address, loc.city].filter(Boolean).join(', ')}
                </span>
                {isMain && settings.mapUrl && (
                  <a href={settings.mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline">
                    {t('map')} ↗
                  </a>
                )}
              </Row>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Phone / WhatsApp fallback. */
export function PhoneCard({ className }: { className?: string }) {
  const t = useDict(bk);
  const l = useL();
  const settings = useSettings();
  const wa = (settings.whatsapp ?? '').replace(/\D/g, '');
  const hours = l(settings.hours).split(/\s*·\s*/)[0];
  return (
    <div className={cn('relative overflow-hidden rounded-3xl bg-ink p-5 text-paper sm:p-6', className)}>
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative">
        <div className="text-[15px] font-semibold text-white">{t('preferPhone')}</div>
        <p className="mt-1 text-[13px] text-paper/65">
          {t('preferPhoneText')} {hours && <span className="whitespace-nowrap">{hours}</span>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={telHref(settings.phone)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-semibold text-ink transition hover:bg-sand">
            <Phone className="h-4 w-4" /> {settings.phone}
          </a>
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25d366] px-4 text-[13.5px] font-semibold text-[#04210f] transition hover:brightness-95">
              <WhatsAppIcon className="h-4 w-4" /> {t('whatsapp')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
