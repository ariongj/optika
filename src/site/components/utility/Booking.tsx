import type { ReactNode } from 'react';
import { create } from 'zustand';
import { Button, ButtonLink, buttonClass, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';

/**
 * Eye-exam booking ("Rezervo kontrollin"). Storefront CTAs open one shared modal with the booking form;
 * `/#rezervo` links scroll to an inline booking form when the page has one (homepage CTA block, services
 * page) and open the modal otherwise — see SiteLayout. The modal itself (with the form) lives in BookingModal.tsx and is
 * loaded on first open, so pages that never book don't download the form.
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
