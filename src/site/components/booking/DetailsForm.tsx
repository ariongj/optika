import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarCheck, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, FieldError, Input, Textarea } from '@/components/ui/Field';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import { validEmail, validPhone } from './availability';
import { bk } from './dict';

export type RxAnswer = '' | 'yes' | 'no' | 'unsure';
export interface DetailsValues {
  name: string;
  phone: string;
  email: string;
  rx: RxAnswer;
  note: string;
}

/**
 * Step 4 — contact details. `onSubmit` returns false when the slot was taken in the meantime (the page then
 * sends the visitor back to the time step).
 */
export function DetailsForm({ askRx, summary, onSubmit }: { askRx: boolean; summary?: ReactNode; onSubmit: (v: DetailsValues) => Promise<boolean> }) {
  const t = useDict(bk);
  const [v, setV] = useState<DetailsValues>({ name: '', phone: '', email: '', rx: '', note: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DetailsValues | 'consent', string>>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: 'name' | 'phone' | 'email' | 'note') => (e: { target: { value: string } }) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (!v.name.trim()) err.name = t('required');
    if (!v.phone.trim()) err.phone = t('required');
    else if (!validPhone(v.phone)) err.phone = t('invalidPhone');
    if (v.email.trim() && !validEmail(v.email)) err.email = t('invalidEmail');
    if (!consent) err.consent = t('consentRequired');
    setErrors(err);
    const first = (['name', 'phone', 'email', 'consent'] as const).find((k) => err[k]);
    if (first) {
      document.getElementById(`bk-f-${first}`)?.focus();
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    const ok = await onSubmit({ ...v, rx: askRx ? v.rx : '' });
    if (!ok) setBusy(false);
  };

  const rxOptions = [
    { id: 'yes', label: t('rx_yes') },
    { id: 'no', label: t('rx_no') },
    { id: 'unsure', label: t('rx_unsure') },
  ] as const;

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="bk-f-name" label={t('name')} required value={v.name} onChange={set('name')} error={errors.name} autoComplete="name" />
        <Input
          id="bk-f-phone"
          label={t('phone')}
          required
          type="tel"
          inputMode="tel"
          value={v.phone}
          onChange={set('phone')}
          error={errors.phone}
          hint={t('phoneHint')}
          placeholder="+383 4_ ___ ___"
          autoComplete="tel"
        />
        <Input
          id="bk-f-email"
          label={
            <>
              {t('email')} <span className="font-normal text-muted">· {t('optional')}</span>
            </>
          }
          type="email"
          value={v.email}
          onChange={set('email')}
          error={errors.email}
          hint={t('emailHint')}
          autoComplete="email"
          wrapClassName="sm:col-span-2"
        />
        {askRx && (
          <fieldset className="min-w-0 sm:col-span-2">
            <legend className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{t('rx')}</legend>
            <div className="inline-flex flex-wrap gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
              {rxOptions.map((o) => {
                const on = v.rx === o.id;
                return (
                  <label
                    key={o.id}
                    className={cn(
                      'cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-600/25',
                      on ? 'bg-white text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink',
                    )}
                  >
                    <input type="radio" name="bk-rx" value={o.id} checked={on} onChange={() => setV((x) => ({ ...x, rx: o.id }))} className="sr-only" />
                    {o.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <Textarea label={t('note')} rows={3} value={v.note} onChange={set('note')} placeholder={t('notePh')} wrapClassName="sm:col-span-2" maxLength={600} />
        <div className="sm:col-span-2">
          <div id="bk-f-consent" tabIndex={-1} className="rounded-2xl bg-paper/70 px-4 py-3.5 outline-none ring-1 ring-inset ring-line">
            <Checkbox
              checked={consent}
              onChange={(c) => {
                setConsent(c);
                if (c) setErrors((x) => ({ ...x, consent: undefined }));
              }}
              label={<span className="font-medium text-ink-soft">{t('consent')}</span>}
            />
            <Link to="/faqe/privatesia" className="ml-8 mt-1 inline-block text-[12.5px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
              {t('privacy')}
            </Link>
          </div>
          <FieldError>{errors.consent}</FieldError>
        </div>
      </div>

      {summary && <div className="mt-6 lg:hidden">{summary}</div>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-[12.5px] leading-snug text-muted sm:max-w-[55%]">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          {t('pendingNote')}
        </p>
        <Button type="submit" size="lg" loading={busy} icon={<CalendarCheck className="h-4 w-4" />} className="w-full sm:w-auto">
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
