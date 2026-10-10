import { useMemo } from 'react';
import { ArrowRight, CalendarX2, ChevronLeft, ChevronRight, Clock, Eye, MapPin, Phone } from 'lucide-react';
import { Img } from '@/components/ui/misc';
import { WhatsAppIcon } from '@/components/brand/Social';
import { useDict, useL, useLang } from '@/i18n';
import { useSettings } from '@/store/hooks';
import { date } from '@/lib/format';
import type { Lang, Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { addDays, dayKey, fromMin, startOfDay } from '@/admin/components/appointments/dates';
import type { DaySlot } from '@/admin/components/appointments/rules';
import { telHref } from '@/site/components/content/posts';
import { SERVICE_IMAGE, firstFree, isFree, locationOf, type Ctx, type DayInfo } from './availability';
import { bk } from './dict';
import { Meta, cap } from './parts';

type T = ReturnType<typeof useDict<typeof bk.me>>;

/** "Sot" / "Nesër" / "Hën 13 tet" */
export function shortDay(d: Date | string, now: number, lang: Lang, t: T) {
  const k = dayKey(d);
  if (k === dayKey(now)) return t('today');
  if (k === dayKey(addDays(startOfDay(now), 1))) return t('tomorrow');
  return date(new Date(d), lang, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "E hënë 13 tetor" */
/** "e hënë 13 tetor" — inside a sentence */
export const midDay = (d: Date | string, lang: Lang) => date(new Date(d), lang, { weekday: 'long', day: 'numeric', month: 'long' });

/** "E hënë 13 tetor" — standalone */
export const longDay = (d: Date | string, lang: Lang) => cap(midDay(d, lang));

const focusRing = 'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-600/25';

/* ------------------------------------------------------------------ */
/* 1 · Service                                                         */
/* ------------------------------------------------------------------ */
export function ServicePicker({ services, value, onChange, ctx }: { services: Service[]; value: string; onChange: (id: string) => void; ctx: Ctx }) {
  const t = useDict(bk);
  const l = useL();
  const lang = useLang();
  const settings = useSettings();
  const firsts = useMemo(() => new Map(services.map((s) => [s.id, firstFree(s, ctx)] as const)), [services, ctx]);
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t('s1')}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => {
          const on = s.id === value;
          const first = firsts.get(s.id);
          const img = SERVICE_IMAGE[s.id];
          const loc = locationOf(s, settings);
          return (
            <label
              key={s.id}
              className={cn(
                'relative flex cursor-pointer gap-3.5 rounded-2xl border bg-white p-3.5 transition-[border-color,box-shadow,background-color] duration-200',
                on ? 'border-ink bg-paper/40 shadow-[0_0_0_1px_var(--color-ink)]' : 'border-line hover:border-ink/30',
                focusRing,
              )}
            >
              <input type="radio" name="bk-service" value={s.id} checked={on} onChange={() => onChange(s.id)} className="sr-only" />
              <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-sand sm:h-20 sm:w-20">
                {img ? (
                  <Img src={img} small alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-brand-600">
                    <Eye className="h-6 w-6" strokeWidth={1.6} />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block pr-7 text-[15px] font-semibold leading-snug text-ink">{l(s.name)}</span>
                {s.description && <span className="mt-1 block text-[12.5px] leading-snug text-muted">{l(s.description)}</span>}
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  <Meta icon={<Clock className="h-3 w-3" />}>{t('min', { n: s.durationMin })}</Meta>
                  {loc && <Meta icon={<MapPin className="h-3 w-3" />}>{loc.name}</Meta>}
                </span>
                <span className={cn('mt-2 flex items-center gap-1.5 text-[12px] font-semibold', first ? 'text-emerald-700' : 'text-muted')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', first ? 'bg-emerald-500' : 'bg-muted/50')} />
                  {first ? t('firstFree', { when: `${shortDay(first.start, ctx.now, lang, t)} · ${first.label}` }) : t('noneSoon')}
                </span>
              </span>
              <span aria-hidden className={cn('absolute right-3.5 top-3.5 grid h-5 w-5 place-items-center rounded-full border-2 transition-colors', on ? 'border-ink' : 'border-ink/20')}>
                <span className={cn('h-2.5 w-2.5 rounded-full bg-ink transition-transform', on ? 'scale-100' : 'scale-0')} />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · Day                                                             */
/* ------------------------------------------------------------------ */
export function DayNav({ days, offset, maxOffset, onOffset }: { days: DayInfo[]; offset: number; maxOffset: number; onOffset: (o: number) => void }) {
  const t = useDict(bk);
  const lang = useLang();
  if (!days.length) return null;
  const range = `${date(days[0].date, lang, { day: 'numeric', month: 'short' })} – ${date(days[days.length - 1].date, lang, { day: 'numeric', month: 'short' })}`;
  const btn = 'grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-ink/30 disabled:pointer-events-none disabled:opacity-35';
  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-[13px] font-semibold tabular-nums text-ink-soft sm:inline">{range}</span>
      <button type="button" className={cn(btn, 'sm:ml-2')} disabled={offset <= 0} onClick={() => onOffset(Math.max(0, offset - 14))} aria-label={t('prevDays')} title={t('prevDays')}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" className={btn} disabled={offset >= maxOffset} onClick={() => onOffset(Math.min(maxOffset, offset + 14))} aria-label={t('nextDays')} title={t('nextDays')}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DayPicker({ days, value, onChange, now }: { days: DayInfo[]; value: string; onChange: (key: string) => void; now: number }) {
  const t = useDict(bk);
  const l = useL();
  const lang = useLang();
  const today = dayKey(now);
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t('daysLabel')}</legend>
      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:pb-0">
        {days.map((d) => {
          const on = d.key === value;
          const off = d.free === 0;
          const status = !d.open ? (d.exception ? l(d.exception.label) : t('closed')) : !d.slots.length ? t('none') : off ? t('full') : t('freeShort', { n: d.free });
          const full = `${longDay(d.date, lang)} — ${off ? status : d.free === 1 ? t('freeOne') : t('freeN', { n: d.free })}`;
          const relative = d.key === today ? t('today') : d.key === dayKey(addDays(startOfDay(now), 1)) ? t('tomorrow') : date(d.date, lang, { weekday: 'short' });
          return (
            <label
              key={d.key}
              title={full}
              className={cn(
                'relative flex w-[76px] shrink-0 snap-start flex-col items-center rounded-2xl border px-1.5 pb-2.5 pt-2 text-center transition-[border-color,background-color,box-shadow] sm:w-auto',
                off ? 'cursor-not-allowed border-dashed border-line bg-paper/60 text-muted' : 'cursor-pointer',
                on ? 'border-ink bg-ink text-paper shadow-[0_10px_24px_-14px_rgba(28,26,23,0.7)]' : !off && 'border-line bg-white text-ink hover:border-ink/35',
                focusRing,
              )}
            >
              <input type="radio" name="bk-day" value={d.key} checked={on} disabled={off} onChange={() => onChange(d.key)} className="sr-only" aria-label={full} />
              <span className={cn('max-w-full truncate text-[11px] font-bold uppercase tracking-[0.08em]', on ? 'text-paper/70' : 'text-muted')}>{relative}</span>
              <span className={cn('display mt-0.5 text-[26px] leading-none', off && !on && 'text-muted/70')}>{d.date.getDate()}</span>
              <span className={cn('mt-0.5 text-[11px]', on ? 'text-paper/70' : 'text-muted')}>{date(d.date, lang, { month: 'short' })}</span>
              <span
                className={cn(
                  'mt-1.5 line-clamp-1 max-w-full text-[10.5px] font-semibold leading-tight',
                  on ? 'text-brand-200' : off ? 'text-muted/80' : 'text-emerald-700',
                )}
              >
                {status}
              </span>
              {d.exception && d.open && <span aria-hidden className={cn('absolute right-2 top-2 h-1.5 w-1.5 rounded-full', on ? 'bg-amber-300' : 'bg-amber-500')} />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* 3 · Time                                                            */
/* ------------------------------------------------------------------ */
const GROUPS = [
  { key: 'morning', to: 12 * 60 },
  { key: 'afternoon', to: 17 * 60 },
  { key: 'evening', to: 24 * 60 },
] as const;

export function TimePicker({
  info,
  value,
  onChange,
  nextFree,
  onJump,
}: {
  info: DayInfo;
  value: string;
  onChange: (start: string) => void;
  nextFree?: DayInfo;
  onJump: (key: string) => void;
}) {
  const t = useDict(bk);
  const l = useL();
  const lang = useLang();
  const reduced = info.exception && info.open && info.slots.length ? info.exception : undefined;

  if (!info.free) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl bg-paper px-4 py-4 ring-1 ring-inset ring-line sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2.5 text-[14px] text-ink-soft">
          <CalendarX2 className="h-4 w-4 shrink-0 text-muted" />
          {!info.open ? t('dayClosed') : info.slots.length ? t('dayFull') : t('none')}
        </p>
        {nextFree && (
          <button type="button" onClick={() => onJump(nextFree.key)} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:underline">
            {t('nextFree', { day: longDay(nextFree.date, lang) })} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  let from = 0;
  const groups = GROUPS.map((g) => {
    const slots = info.slots.filter((s) => s.minutes >= from && s.minutes < g.to);
    from = g.to;
    return { key: g.key, slots };
  }).filter((g) => g.slots.length);

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t('timesLabel')}</legend>
      {reduced && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 ring-1 ring-inset ring-amber-600/20">
          {l(reduced.label)} · {t('reducedHours', { from: reduced.from ?? '', to: reduced.to ?? '' })}
        </p>
      )}
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{t(g.key)}</div>
            <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-5 xl:grid-cols-6">
              {g.slots.map((s) => (
                <SlotButton key={s.start} slot={s} on={s.start === value} onChange={onChange} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function SlotButton({ slot, on, onChange }: { slot: DaySlot; on: boolean; onChange: (start: string) => void }) {
  const t = useDict(bk);
  const free = isFree(slot);
  return (
    <label
      className={cn(
        'relative grid h-11 place-items-center rounded-xl border text-[14.5px] font-semibold tabular-nums transition-[border-color,background-color,color,box-shadow]',
        !free ? 'cursor-not-allowed border-transparent bg-paper text-muted/60 line-through decoration-muted/40' : 'cursor-pointer',
        on ? 'border-brand-600 bg-brand-600 text-white shadow-[0_10px_22px_-12px_var(--color-brand-700)]' : free && 'border-line bg-white text-ink hover:border-ink/35',
        focusRing,
      )}
      title={free ? undefined : t('taken')}
    >
      <input type="radio" name="bk-time" value={slot.start} checked={on} disabled={!free} onChange={() => onChange(slot.start)} className="sr-only" aria-label={free ? slot.label : `${slot.label} — ${t('taken')}`} />
      {slot.label || fromMin(slot.minutes)}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* No free time in the whole window                                    */
/* ------------------------------------------------------------------ */
export function NoSlots({ onNext, canNext }: { onNext: () => void; canNext: boolean }) {
  const t = useDict(bk);
  const settings = useSettings();
  const wa = (settings.whatsapp ?? '').replace(/\D/g, '');
  return (
    <div className="mt-4 rounded-2xl bg-paper p-5 text-center ring-1 ring-inset ring-line sm:p-6">
      <CalendarX2 className="mx-auto h-7 w-7 text-muted" strokeWidth={1.6} />
      <h3 className="mt-3 text-[16px] font-semibold text-ink">{t('noSlotsTitle')}</h3>
      <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted">{t('noSlotsText')}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {canNext && (
          <button type="button" onClick={onNext} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-paper transition hover:bg-ink-soft">
            {t('nextDays')} <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <a href={telHref(settings.phone)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold text-ink transition hover:border-ink/30">
          <Phone className="h-4 w-4" /> {settings.phone}
        </a>
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#25d366] px-4 text-[13.5px] font-semibold text-white transition hover:brightness-95">
            <WhatsAppIcon className="h-4 w-4" /> {t('whatsapp')}
          </a>
        )}
      </div>
    </div>
  );
}
