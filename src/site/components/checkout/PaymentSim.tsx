import { motion } from 'motion/react';
import { Check, Lock, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Overlay';
import { defineDict, useDict, useLang } from '@/i18n';
import { money } from '@/lib/format';

const T = defineDict({
  me: {
    title: 'Simulacija plaćanja',
    desc: 'Demo — ne izvršava se nikakva stvarna transakcija.',
    processing: 'Povezivanje sa bankom…',
    processingText: 'Zaštićena stranica banke (3-D Secure) potvrđuje plaćanje. Ne zatvarajte ovu stranicu.',
    approved: 'Plaćanje odobreno',
    approvedText: 'Iznos je uspješno naplaćen. Preusmjeravamo vas na potvrdu narudžbe…',
    amount: 'Iznos',
    merchant: 'Trgovac',
  },
  sq: {
    title: 'Simulim pagese',
    desc: 'Demo — nuk kryhet asnjë transaksion i vërtetë.',
    processing: 'Duke u lidhur me bankën…',
    processingText: 'Faqja e mbrojtur e bankës (3-D Secure) po e konfirmon pagesën. Mos e mbyllni këtë faqe.',
    approved: 'Pagesa u miratua',
    approvedText: 'Shuma u pagua me sukses. Po ju dërgojmë te konfirmimi i porosisë…',
    amount: 'Shuma',
    merchant: 'Tregtari',
  },
  en: {
    title: 'Payment simulation',
    desc: 'Demo — no real transaction takes place.',
    processing: 'Connecting to the bank…',
    processingText: 'The bank’s secure page (3-D Secure) is confirming the payment. Please keep this page open.',
    approved: 'Payment approved',
    approvedText: 'The amount was charged successfully. Taking you to your order confirmation…',
    amount: 'Amount',
    merchant: 'Merchant',
  },
});

/** Fake 3-D Secure step for the "card" payment method — no card data is ever collected. */
export function PaymentSim({ phase, amount, merchant }: { phase: 'idle' | 'processing' | 'approved'; amount: number; merchant: string }) {
  const t = useDict(T);
  const lang = useLang();
  return (
    <Modal open={phase !== 'idle'} onClose={() => {}} title={t('title')} description={t('desc')} size="sm">
      <div className="px-6 pb-8 pt-8 text-center sm:px-8">
        {phase === 'approved' ? (
          <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <span className="mx-auto grid h-16 w-16 animate-pop place-items-center rounded-full bg-emerald-600 text-white shadow-[0_12px_30px_-12px_rgb(5_150_105/0.8)]">
              <Check className="h-8 w-8" strokeWidth={3} />
            </span>
            <h3 className="mt-5 text-xl font-bold text-ink">{t('approved')}</h3>
            <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-muted">{t('approvedText')}</p>
          </motion.div>
        ) : (
          <div>
            <div className="relative mx-auto h-16 w-16">
              <span className="absolute inset-0 rounded-full border-[3px] border-ink/10" />
              <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand-600" />
              <span className="absolute inset-0 grid place-items-center text-ink">
                <Lock className="h-5 w-5" />
              </span>
            </div>
            <h3 className="mt-5 text-xl font-bold text-ink">{t('processing')}</h3>
            <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-muted">{t('processingText')}</p>
            <div className="mx-auto mt-6 h-1 max-w-[220px] overflow-hidden rounded-full bg-sand">
              <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 1.8, ease: 'easeInOut' }} />
            </div>
          </div>
        )}
        <dl className="mx-auto mt-7 grid max-w-xs grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line text-left ring-1 ring-line">
          <div className="bg-paper px-4 py-3">
            <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{t('merchant')}</dt>
            <dd className="mt-0.5 truncate text-[13.5px] font-semibold text-ink">{merchant}</dd>
          </div>
          <div className="bg-paper px-4 py-3">
            <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{t('amount')}</dt>
            <dd className="mt-0.5 text-[13.5px] font-bold tabular-nums text-ink">{money(amount, lang)}</dd>
          </div>
        </dl>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 3-D Secure · SSL
        </p>
      </div>
    </Modal>
  );
}
