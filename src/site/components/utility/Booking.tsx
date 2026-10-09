import type { ReactNode } from 'react';
import { create } from 'zustand';
import { Clock, Eye, Phone, Ruler, X } from 'lucide-react';
import { Button, ButtonLink, buttonClass, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { Img } from '@/components/ui/misc';
import { defineDict, useDict, useL } from '@/i18n';
import { common } from '@/i18n/common';
import { useSettings } from '@/store/hooks';
import { MeasureForm } from '@/site/components/MeasureForm';

/**
 * Eye-exam booking ("Rezervo kontrollin"). Storefront CTAs open one shared modal with the booking form;
 * `/#rezervo` links scroll to an inline booking form when the page has one (homepage CTA block, services
 * page) and open the modal otherwise — see SiteLayout.
 */
export const BOOK_ID = 'rezervo';
export const BOOK_HREF = `/#${BOOK_ID}`;

/** True for links that mean "book an eye exam" ("/#rezervo", "/sherbimet#rezervo", "#rezervo"). */
export const isBookingHref = (href: string | undefined) => !!href && href.trim().endsWith(`#${BOOK_ID}`);

interface BookingState {
  open: boolean;
  /** Pre-selected service key (see MeasureForm `SERVICE_KEYS`) */
  service?: string;
  show: (service?: string) => void;
  hide: () => void;
}

export const useBooking = create<BookingState>((set) => ({
  open: false,
  service: undefined,
  show: (service) => set({ open: true, service }),
  hide: () => set({ open: false }),
}));

/** Open the booking modal from anywhere (event handlers, effects). */
export const openBooking = (service?: string) => useBooking.getState().show(service);

/**
 * Button for a CMS-editable link: booking links open the booking modal, absolute URLs open in a new tab,
 * everything else is a router link.
 */
export function CtaLink({
  to,
  variant,
  size,
  icon,
  iconRight,
  className,
  onClick,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const href = to.trim();
  if (isBookingHref(href)) {
    return (
      <Button
        variant={variant}
        size={size}
        icon={icon}
        iconRight={iconRight}
        className={className}
        onClick={() => {
          onClick?.();
          openBooking();
        }}
      >
        {children}
      </Button>
    );
  }
  if (/^(?:https?:|mailto:|tel:)/i.test(href)) {
    return (
      <a href={href} target={/^https?:/i.test(href) ? '_blank' : undefined} rel="noreferrer" onClick={onClick} className={buttonClass({ variant, size, className })}>
        {icon}
        {children}
        {iconRight}
      </a>
    );
  }
  return (
    <ButtonLink to={href || '/'} variant={variant} size={size} icon={icon} iconRight={iconRight} className={className} onClick={onClick}>
      {children}
    </ButtonLink>
  );
}

const T = defineDict({
  me: {
    eyebrow: 'Pregled vida',
    title: 'Zakažite pregled vida',
    text: 'Pregled vida košta 15 € — besplatan je uz kupovinu okvira. Izaberite dan, a tačan termin vam potvrđujemo telefonom.',
    p1: 'Stručan pregled i provera dioptrije',
    p2: 'Merenje PD-a i savet za sočiva — besplatno',
    p3: 'Pon–Sub 10:00–19:30',
  },
  sq: {
    eyebrow: 'Kontroll i syve',
    title: 'Rezervoni kontrollin e syve',
    text: 'Kontrolli i syve kushton 15 € — falas me blerjen e kornizës. Zgjidhni ditën, ndërsa orarin e saktë jua konfirmojmë me telefon.',
    p1: 'Kontroll profesional dhe verifikim i dioptrisë',
    p2: 'Matje e PD-së dhe këshillë për lentet — falas',
    p3: 'Hën–Sht 10:00–19:30',
  },
  en: {
    eyebrow: 'Eye exam',
    title: 'Book an eye exam',
    text: 'An eye exam costs €15 — free when you buy a frame. Pick a day and we’ll confirm the exact time by phone.',
    p1: 'Professional exam and prescription check',
    p2: 'PD measurement and lens advice — free',
    p3: 'Mon–Sat 10:00–19:30',
  },
});

/** The global booking modal — rendered once by SiteLayout. */
export function BookingModal() {
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
