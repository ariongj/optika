// "My account" (server-backed build only): the signed-in staff member's own sign-in — password, 2-step codes,
// devices and recent sign-ins. Name, e-mail and role are changed by the owner in Settings → Access.
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { toast } from 'sonner';
import { ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { AuthEventsPanel, CopyButton, SessionsPanel, errorText } from '@/admin/components/access/shared';
import { AX, type AxKey } from '@/admin/components/access/strings';
import { PageHeader } from '@/admin/components/kit';
import { TextField } from '@/admin/components/settings/fields';
import { Avatar, Block, Note, Panel, StateText } from '@/admin/components/settings/ui';
import { adm } from '@/admin/i18n';
import { Button, buttonClass } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { useDict, useL, useLang } from '@/i18n';
import { BACKEND } from '@/lib/backend/api';
import { authErrorKey, changePassword, totpBegin, totpDisable, totpEnable, useSession, type StaffUser } from '@/lib/backend/session';
import { dateTime } from '@/lib/format';
import { ROLE_META } from '@/lib/permissions';
import { useDb } from '@/store/db';

type T = (key: AxKey, vars?: Record<string, string | number>) => string;

/** The server's sign-in refusals as text (password rules, wrong password, wrong code…). */
function authText(err: unknown, t: T): string {
  const known = authErrorKey(err);
  const key = `e_${known}` as AxKey;
  // 'server' = a code the sign-in helper does not know: the general table may still have a sentence for it
  return known !== 'server' && key in AX.me ? t(key) : errorText(err, t);
}

/* ------------------------------------------------------------------ */
/* Password                                                            */
/* ------------------------------------------------------------------ */
function PasswordPanel({ onChanged }: { onChanged: () => void }) {
  const t = useDict(AX, 'admin');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<unknown>(null);

  const code = refused ? authErrorKey(refused) : '';
  const errors = {
    current: !current ? t('pwCurrentReq') : code === 'bad_credentials' ? t('e_bad_credentials') : undefined,
    next: next.length < 10 ? t('e_password_short') : next === current ? t('pwSame') : code.startsWith('password_') ? authText(refused, t) : undefined,
    repeat: repeat !== next ? t('pwMismatch') : undefined,
  };
  const fieldRefusal = code === 'bad_credentials' || code.startsWith('password_');
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setRefused(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setRefused(null);
    if (!current || next.length < 10 || next === current || repeat !== next) return;
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setTried(false);
      setShow(false);
      toast.success(t('pwChanged'));
      onChanged();
    } catch (err) {
      setRefused(err);
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';
  return (
    <Panel
      title={t('pw')}
      description={t('pw_d')}
      actions={
        <Button variant="outline" size="xs" shape="rounded" icon={show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} aria-pressed={show} onClick={() => setShow((v) => !v)}>
          {show ? t('hide') : t('show')}
        </Button>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="grid max-w-[560px] gap-4">
        <TextField label={t('pwCurrent')} type={type} value={current} onChange={edit(setCurrent)} autoComplete="current-password" leading={<KeyRound className="h-4 w-4" />} error={tried ? errors.current : undefined} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('pwNew')} type={type} value={next} onChange={edit(setNext)} autoComplete="new-password" error={tried ? errors.next : undefined} />
          <TextField label={t('pwRepeat')} type={type} value={repeat} onChange={edit(setRepeat)} autoComplete="new-password" error={tried ? errors.repeat : undefined} />
        </div>
        <p className="text-[12.5px] leading-snug text-muted">{t('pwRules')}</p>
        {refused !== null && !fieldRefusal && (
          <p role="alert" className="text-[13px] font-medium text-red-600">
            {authText(refused, t)}
          </p>
        )}
        <div>
          <Button type="submit" size="sm" shape="rounded" loading={saving}>
            {t('pwSave')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 2-step sign-in                                                      */
/* ------------------------------------------------------------------ */
function TwoStepPanel({ user }: { user: StaffUser }) {
  const t = useDict(AX, 'admin');
  const ta = useDict(adm, 'admin');
  /** The new key, shown until it is confirmed with a code (or the setup is abandoned) */
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<unknown>(null);
  const [offOpen, setOffOpen] = useState(false);
  const [password, setPassword] = useState('');

  const begin = async () => {
    setBusy(true);
    setRefused(null);
    try {
      setSetup(await totpBegin());
      setCode('');
    } catch (err) {
      toast.error(authText(err, t));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setRefused('short');
      return;
    }
    setBusy(true);
    setRefused(null);
    try {
      await totpEnable(code);
      setSetup(null);
      setCode('');
      toast.success(t('twoEnabled'));
    } catch (err) {
      setRefused(err);
    } finally {
      setBusy(false);
    }
  };
  const closeOff = () => {
    setOffOpen(false);
    setPassword('');
    setRefused(null);
  };
  const disable = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setRefused(null);
    try {
      await totpDisable(password);
      closeOff();
      toast.success(t('twoDisabled'));
    } catch (err) {
      setRefused(err);
    } finally {
      setBusy(false);
    }
  };

  const grouped = setup ? (setup.secret.match(/.{1,4}/g) ?? []).join(' ') : '';
  const refusedText = refused === 'short' ? t('codeReq') : refused ? authText(refused, t) : undefined;
  return (
    <Panel
      title={t('two')}
      description={t('two_d')}
      actions={<StateText tone={user.totp ? 'ok' : 'off'}>{user.totp ? t('twoOn') : t('twoOff')}</StateText>}
    >
      {user.totp ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-start gap-2 text-[13.5px] font-medium text-ink">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> {t('twoIsOn')}
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted">{t('twoKeep')}</p>
          </div>
          <Button variant="outline" size="sm" shape="rounded" onClick={() => setOffOpen(true)} className="self-start sm:self-center">
            {t('twoDisable')}
          </Button>
        </div>
      ) : !setup ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-ink-soft">{t('twoIsOff')}</p>
          <Button size="sm" shape="rounded" icon={<Smartphone className="h-4 w-4" />} loading={busy} onClick={() => void begin()} className="self-start sm:self-center">
            {t('twoStart')}
          </Button>
        </div>
      ) : (
        <div>
          <Block title={t('twoStep1')} hint={t('twoStep1Text')}>
            <div className="text-[12.5px] font-semibold text-ink-soft">{t('secretLabel')}</div>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 select-all break-words rounded-lg bg-[#f6f6f6] px-3 py-2.5 font-mono text-[14px] font-semibold tracking-[0.06em] text-ink ring-1 ring-inset ring-black/[0.06]">{grouped}</code>
              <CopyButton text={setup.secret} className="self-start sm:self-center" />
            </div>
            {setup.uri.startsWith('otpauth://') && (
              <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <a href={setup.uri} className={buttonClass({ variant: 'outline', size: 'sm', shape: 'rounded', className: 'self-start bg-white' })}>
                  <ExternalLink className="h-4 w-4" /> {t('openApp')}
                </a>
                <span className="text-[12.5px] text-muted">{t('openAppHint')}</span>
              </div>
            )}
          </Block>
          <Block title={t('twoStep2')} hint={t('twoStep2Text')}>
            <form onSubmit={(e) => void confirm(e)} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <TextField
                label={<span className="sr-only">{t('codeLabel')}</span>}
                value={code}
                onChange={(v) => {
                  setCode(v.replace(/\D/g, '').slice(0, 6));
                  setRefused(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label={t('codeLabel')}
                error={refusedText}
                className="w-full sm:w-[180px]"
                inputClassName="font-mono text-[16px] tracking-[0.3em]"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" shape="rounded" loading={busy} className="h-10!">
                  {t('twoConfirm')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  shape="rounded"
                  className="h-10!"
                  onClick={() => {
                    setSetup(null);
                    setCode('');
                    setRefused(null);
                  }}
                >
                  {t('twoCancel')}
                </Button>
              </div>
            </form>
          </Block>
        </div>
      )}

      <Modal
        open={offOpen}
        onClose={closeOff}
        size="sm"
        title={t('twoDisableTitle')}
        description={t('twoDisableText')}
        footer={
          <>
            <Button variant="outline" size="sm" shape="rounded" onClick={closeOff}>
              {ta('cancel')}
            </Button>
            <Button variant="danger" size="sm" shape="rounded" type="submit" form="mv-totp-off" loading={busy} disabled={!password}>
              {t('twoDisableConfirm')}
            </Button>
          </>
        }
      >
        <form id="mv-totp-off" onSubmit={(e) => void disable(e)} noValidate className="px-6 py-5">
          <TextField
            label={t('password')}
            type="password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setRefused(null);
            }}
            autoComplete="current-password"
            leading={<KeyRound className="h-4 w-4" />}
            error={offOpen ? refusedText : undefined}
            autoFocus
          />
        </form>
      </Modal>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function MyAccount() {
  const t = useDict(AX, 'admin');
  const l = useL('admin');
  const lang = useLang('admin');
  const user = useSession((s) => s.user);
  const team = useDb((s) => s.staff);
  /** bumped after a password change: the other devices were signed out, the lists below ask again */
  const [stamp, setStamp] = useState(0);

  // the demo build has no accounts on a server
  if (!BACKEND) return <Navigate to="/admin" replace />;
  if (!user) {
    return (
      <div aria-busy="true" aria-label={t('loading')} className="space-y-3 py-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-ink/[0.05]" />
        ))}
      </div>
    );
  }

  const rows: [string, string][] = [
    [t('name'), user.name],
    [t('email'), user.email],
    [t('role'), l(ROLE_META[user.role]?.name) || user.role],
    [t('lastLogin'), user.lastLoginAt ? dateTime(user.lastLoginAt, lang) : t('never')],
  ];
  return (
    <div className="pb-16">
      <PageHeader breadcrumbs={[t('my')]} title={t('my')} description={t('my_d')} />
      <div className="max-w-[920px] space-y-5">
        <Panel title={t('profile')}>
          <div className="flex items-start gap-4">
            <Avatar name={user.name} color={team.find((m) => m.id === user.staffId)?.color} />
            <dl className="grid min-w-0 flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[12px] text-muted">{label}</dt>
                  <dd className="break-words text-[13.5px] font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Note className="mt-5">{t('profileHint')}</Note>
        </Panel>

        <PasswordPanel onChanged={() => setStamp((n) => n + 1)} />
        <TwoStepPanel user={user} />
        <SessionsPanel key={`s${stamp}`} scope="mine" />
        <AuthEventsPanel key={`e${stamp}`} scope="mine" />
      </div>
    </div>
  );
}
