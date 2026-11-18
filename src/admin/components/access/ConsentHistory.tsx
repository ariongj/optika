// Customer profile (server-backed build only): the marketing-consent record kept by the server — every sign-up,
// opt-in at checkout, change by staff and unsubscribe, with the wording the person saw. It is a legal record:
// this screen only reads it and adds new entries; nothing here edits or deletes a past entry.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, History, Plus, XCircle } from 'lucide-react';
import { cx } from '@/admin/components/customers/i18n';
import { phone8, type CustomerRecord } from '@/admin/components/customers/model';
import { CHANNEL_ICON, Gate, SectionTitle } from '@/admin/components/customers/parts';
import { CHANNELS } from '@/admin/components/customers/store';
import { TextAreaField } from '@/admin/components/settings/fields';
import { Choice } from '@/admin/components/settings/ui';
import { adm } from '@/admin/i18n';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Overlay';
import { useDict, useLang } from '@/i18n';
import { listConsent, recordConsent, type ConsentAction, type ConsentChannel, type ConsentEvent } from '@/lib/backend/staff';
import { pull } from '@/lib/backend/sync';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDb } from '@/store/db';
import { LoadState, errorText, isForbidden, useLoad } from './shared';
import { AX, type AxKey } from './strings';

/**
 * Every key the server may have filed this person under: the profile's own key, the keys of records merged into
 * it, their e-mails, and — as the server does for people without an e-mail — "tel-" + the last 8 digits.
 */
function subjectKeys(c: CustomerRecord): string[] {
  const out = new Set<string>();
  const add = (k: string) => {
    const v = k.trim().toLowerCase();
    if (v) out.add(v);
  };
  for (const k of [c.key, ...c.mergedKeys]) {
    add(k);
    if (!k.includes('@') && !k.startsWith('tel-') && phone8(k)) add(`tel-${phone8(k)}`);
  }
  for (const e of c.emails) add(e);
  if (c.emails.length === 0) for (const p of c.phones) if (phone8(p)) add(`tel-${phone8(p)}`);
  return [...out];
}

function RecordModal({ open, customer, onClose, onSaved }: { open: boolean; customer: CustomerRecord; onClose: () => void; onSaved: () => void }) {
  const t = useDict(AX, 'admin');
  const tx = useDict(cx, 'admin');
  const ta = useDict(adm, 'admin');
  const [channel, setChannel] = useState<ConsentChannel>('email');
  const suggested = (ch: ConsentChannel): ConsentAction => (customer.marketing[ch].status === 'subscribed' ? 'unsubscribe' : 'subscribe');
  const [action, setAction] = useState<ConsentAction>(() => suggested('email'));
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<unknown>(null);
  const noteOk = note.trim().length >= 5;

  const save = async () => {
    setTried(true);
    setRefused(null);
    if (!noteOk) return;
    setSaving(true);
    try {
      const email = customer.email.trim().toLowerCase();
      const phone = customer.phone.trim();
      // an empty e-mail is left out, so the server can take it from the key
      await recordConsent({ key: customer.key, channel, action, note: note.trim(), ...(email ? { email } : {}), ...(phone ? { phone } : {}) });
      useDb.getState().logAudit({ action: 'update', object: 'customer', objectId: customer.key, detail: `${customer.name}: ${channel} marketing → ${action === 'subscribe' ? 'subscribed' : 'unsubscribed'}` });
      // the server also updated the profile's current state: fetch it so the list and this drawer show it
      void pull();
      toast.success(t('recorded'), { description: `${tx(`ch_${channel}`)} · ${t(action === 'subscribe' ? 'c_subscribe' : 'c_unsubscribe')}` });
      onSaved();
      onClose();
    } catch (err) {
      setRefused(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('recordTitle', { name: customer.name })}
      description={t('recordText')}
      footer={
        <>
          <Button variant="outline" size="sm" shape="rounded" onClick={onClose}>
            {ta('cancel')}
          </Button>
          <Button size="sm" shape="rounded" loading={saving} onClick={() => void save()}>
            {t('recordSave')}
          </Button>
        </>
      }
    >
      <div className="space-y-5 px-6 py-5">
        <Select
          label={t('channel')}
          value={channel}
          onChange={(e) => {
            const ch = e.target.value as ConsentChannel;
            setChannel(ch);
            setAction(suggested(ch));
          }}
          className="h-10! rounded-lg! text-[13.5px]!"
        >
          {CHANNELS.map((ch) => (
            <option key={ch} value={ch}>
              {tx(`ch_${ch}`)} — {tx(`consent_${customer.marketing[ch].status}`)}
            </option>
          ))}
        </Select>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink-soft">{t('whatHappened')}</div>
          <div role="radiogroup" aria-label={t('whatHappened')} className="grid gap-2 sm:grid-cols-2">
            <Choice checked={action === 'subscribe'} onSelect={() => setAction('subscribe')} title={t('actGive')} />
            <Choice checked={action === 'unsubscribe'} onSelect={() => setAction('unsubscribe')} title={t('actWithdraw')} />
          </div>
        </div>
        <TextAreaField label={t('noteLabel')} value={note} onChange={(v) => setNote(v.slice(0, 300))} rows={3} placeholder={t('notePh')} error={tried && !noteOk ? t('noteReq') : undefined} />
        {refused !== null && (
          <p role="alert" className="text-[13px] font-medium text-red-600">
            {errorText(refused, t)}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function ConsentHistory({ customer, canEdit, noPermission }: { customer: CustomerRecord; canEdit: boolean; noPermission: string }) {
  const t = useDict(AX, 'admin');
  const tx = useDict(cx, 'admin');
  const lang = useLang('admin');
  const team = useDb((s) => s.staff);
  const keys = useMemo(() => subjectKeys(customer), [customer]);
  const state = useLoad(async () => {
    const lists = await Promise.all(keys.map((k) => listConsent(k)));
    const byId = new Map<number, ConsentEvent>();
    for (const e of lists.flat()) byId.set(e.id, e);
    return [...byId.values()].sort((a, b) => b.id - a.id);
  });
  const [modal, setModal] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const who = (e: ConsentEvent) => (e.actor === 'visitor' || !e.actor ? t('cVisitor') : t('cBy', { name: team.find((m) => m.id === e.actor)?.name ?? t('staffMember') }));
  const source = (e: ConsentEvent) => {
    const key = `cs_${e.source}` as AxKey;
    return key in AX.me ? t(key) : e.source;
  };
  const events = state.data ?? [];

  return (
    <section>
      <SectionTitle icon={<History className="h-3.5 w-3.5" />}>{t('consentLog')}</SectionTitle>
      <p className="-mt-1 mb-2.5 text-[12.5px] leading-snug text-muted">{t('consentLog_d')}</p>
      <div className="overflow-hidden rounded-xl border border-line/80 bg-white">
        {isForbidden(state.error) ? (
          <p className="px-4 py-3.5 text-[13px] text-muted">{t('e_forbidden')}</p>
        ) : (
          <LoadState state={state} className="px-4! py-4!" />
        )}
        {state.data && !state.error && events.length === 0 && <p className="px-4 py-3.5 text-[13px] text-muted">{t('consentEmpty')}</p>}
        {state.data && !state.error && events.length > 0 && (
          <ol className="divide-y divide-line/70">
            {events.map((e) => {
              const Icon = CHANNEL_ICON[e.channel] ?? History;
              const gave = e.action === 'subscribe';
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                      <span className={cn('inline-flex items-center gap-1.5 text-[13.5px] font-semibold', gave ? 'text-ink' : 'text-ink-soft')}>
                        {gave ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                        {tx(`ch_${e.channel}`)} · {t(gave ? 'c_subscribe' : 'c_unsubscribe')}
                      </span>
                      <time dateTime={e.at} className="text-[12px] tabular-nums text-muted">
                        {dateTime(e.at, lang)}
                      </time>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] leading-snug text-muted">
                      <span>{source(e)}</span>
                      {e.ref && <span>· {t('cOrder', { ref: e.ref })}</span>}
                      <span>· {who(e)}</span>
                      {e.ip && <span>· {t('cNet', { ip: e.ip })}</span>}
                    </div>
                    {e.wording && (
                      <div className="mt-1.5 border-l-2 border-line pl-2.5 text-[12.5px] leading-snug text-ink-soft">
                        <span className="text-muted">{t('cWording')}: </span>
                        <q className="break-words">{e.wording}</q>
                      </div>
                    )}
                    {e.note && (
                      <div className="mt-1.5 border-l-2 border-line pl-2.5 text-[12.5px] leading-snug text-ink-soft">
                        <span className="text-muted">{t('cNote')}: </span>
                        <span className="break-words">{e.note}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="mt-2.5">
        <Gate allowed={canEdit} reason={noPermission}>
          <Button
            variant="outline"
            shape="rounded"
            size="xs"
            icon={<Plus className="h-3.5 w-3.5" />}
            disabled={!canEdit}
            onClick={() => {
              setModal(Date.now());
              setOpen(true);
            }}
          >
            {t('record')}
          </Button>
        </Gate>
      </div>
      {modal !== null && <RecordModal key={modal} open={open} customer={customer} onClose={() => setOpen(false)} onSaved={() => void state.reload()} />}
    </section>
  );
}
