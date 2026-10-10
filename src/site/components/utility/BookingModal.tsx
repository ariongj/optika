import { Link } from 'react-router';
import { ArrowRight, CalendarDays, Clock, Eye, Phone, Ruler, X } from 'lucide-react';
import { Modal } from '@/components/ui/Overlay';
import { Img } from '@/components/ui/misc';
import { defineDict, useDict, useL } from '@/i18n';
import { common } from '@/i18n/common';
import { useSettings } from '@/store/hooks';
import { MeasureForm } from '@/site/components/MeasureForm';
import { useBooking } from './Booking';

const T = defineDict({
  me: {
    eyebrow: 'Pregled vida',
    title: 'Zakažite pregled vida',
    text: 'Pregled vida košta 15 € — besplatan je uz kupovinu okvira. Izaberite dan, a tačan termin vam potvrđujemo telefonom.',
    p1: 'Stručan pregled i provera dioptrije',
    p2: 'Merenje PD-a i savet za sočiva — besplatno',
    p3: 'Pon–Sub 10:00–19:30',
    calendar: 'Ili izaberite tačan termin u kalendaru',
  },
  sq: {
    eyebrow: 'Kontroll i syve',
    title: 'Rezervoni kontrollin e syve',
    text: 'Kontrolli i syve kushton 15 € — falas me blerjen e kornizës. Zgjidhni ditën, ndërsa orarin e saktë jua konfirmojmë me telefon.',
    p1: 'Kontroll profesional dhe verifikim i dioptrisë',
    p2: 'Matje e PD-së dhe këshillë për lentet — falas',
    p3: 'Hën–Sht 10:00–19:30',
    calendar: 'Ose zgjidhni orarin e saktë në kalendar',
  },
  en: {
    eyebrow: 'Eye exam',
    title: 'Book an eye exam',
    text: 'An eye exam costs €15 — free when you buy a frame. Pick a day and we’ll confirm the exact time by phone.',
    p1: 'Professional exam and prescription check',
    p2: 'PD measurement and lens advice — free',
    p3: 'Mon–Sat 10:00–19:30',
    calendar: 'Or pick an exact time in the calendar',
  },
});

/** The global booking modal — rendered by SiteLayout after the first openBooking(). */
export default function BookingModal() {
  const open = useBooking((s) => s.open);
  const service = useBooking((s) => s.service);
  const hide = useBooking((s) => s.hide);
  const t = useDict(T);
  const tc = useDict(common);
  const l = useL();
  const settings = useSettings();
  const hours = l(settings.hours).split(/\s*·\s*/)[0] || t('p3');
  const perks = [
    { icon: Eye, text: t('p1') },
    { icon: Ruler, text: t('p2') },
    { icon: Clock, text: hours },
  ];
  return (
    <Modal open={open} onClose={hide} size="xl" className="sm:max-w-[1040px]">
      <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
        <div className="relative isolate hidden flex-col justify-end overflow-hidden bg-ink p-8 text-white lg:flex">
          <Img src="/images/s/kontrolli.webp" eager alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/55 to-ink/5" />
          <ul className="space-y-3">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[14.5px] font-medium text-white/90">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <a
            href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`}
            className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-white/10 px-4 py-2 text-[13.5px] font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
          >
            <Phone className="h-4 w-4" /> {settings.phone}
          </a>
        </div>
        <div className="min-w-0">
          <div className="px-6 pb-1 pr-16 pt-7 sm:px-8 sm:pt-8">
            <div className="eyebrow">{t('eyebrow')}</div>
            <h2 className="display mt-2 text-[30px] leading-[1.06] text-ink sm:text-[36px]">{t('title')}</h2>
            <p className="mt-2.5 max-w-lg text-[14.5px] leading-relaxed text-muted">{t('text')}</p>
            <Link
              to={`/rezervo${service ? `?sherbimi=${encodeURIComponent(service)}` : ''}`}
              onClick={hide}
              className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 underline-offset-4 hover:underline"
            >
              <CalendarDays className="h-4 w-4" />
              {t('calendar')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <MeasureForm key={`${open}-${service ?? ''}`} type="measurement" defaultService={service} className="rounded-none! p-6! ring-0! sm:p-8! sm:pt-6!" />
        </div>
      </div>
      <button
        type="button"
        onClick={hide}
        aria-label={tc('close')}
        className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-md ring-1 ring-line backdrop-blur transition hover:bg-white sm:right-4 sm:top-4"
      >
        <X className="h-5 w-5" />
      </button>
    </Modal>
  );
}
