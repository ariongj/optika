// Staff sign-in for the server-backed build: real accounts on the shop server (the demo build keeps pages/Login).
// Three states: sign in (with the 2-step code when the account asks for it), the first owner set-up while the shop has
// no account yet, and owner recovery while it is switched on in the hosting file manager.
import { useEffect, useState } from 'react';
import { KeyRound, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useDict } from '@/i18n';
import { ApiError } from '@/lib/backend/api';
import { checkSession, recoverOwner, setupOwner, signIn, useSession } from '@/lib/backend/session';
import { AuthShell, enterCms, useAuthError } from '@/admin/components/auth/AuthShell';
import { AU } from '@/admin/components/auth/strings';

export default function StaffLogin() {
  const ta = useDict(AU, 'admin');
  const status = useSession((s) => s.status);
  const setup = useSession((s) => s.setup);
  const recovery = useSession((s) => s.recovery);
  const [recovering, setRecovering] = useState(false);

  // reached from inside the app (not a page load): ask the server once who is here and what state the shop is in
  useEffect(() => {
    if (useSession.getState().status === 'unknown') void checkSession();
  }, []);
  // already signed in (another tab, or the cookie outlived this browser's hint)
  useEffect(() => {
    if (status === 'in') enterCms();
  }, [status]);

  if (status === 'unknown' || status === 'checking' || status === 'in') {
    return (
      <AuthShell>
        <p className="text-muted" role="status">
          {ta('checking')}
        </p>
      </AuthShell>
    );
  }
  return <AuthShell>{setup ? <SetupForm /> : recovering && recovery ? <RecoverForm onBack={() => setRecovering(false)} /> : <SignInForm recovery={recovery} onRecover={() => setRecovering(true)} />}</AuthShell>;
}

function SignInForm({ recovery, onRecover }: { recovery: boolean; onRecover: () => void }) {
  const ta = useDict(AU, 'admin');
  const message = useAuthError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password, needCode ? code.replace(/\s/g, '') : '');
      enterCms(); // stays "busy" until the CMS page replaces this one
    } catch (err) {
      if (err instanceof ApiError && err.code === 'code_required') {
        // the password was right: the account has 2-step sign-in on
        setNeedCode(true);
        setCode('');
      } else {
        setError(message(err));
        if (err instanceof ApiError && err.code === 'code_bad') setCode('');
      }
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-3xl font-extrabold tracking-tight">{ta('signInTitle')}</h1>
      <p className="mt-2 text-muted">{needCode ? ta('codeHint') : ta('signInText')}</p>
      <div className="mt-8 space-y-4">
        {needCode ? (
          <Input
            key="code"
            label={ta('code')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            leading={<ShieldCheck className="h-4 w-4" />}
            error={error}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            autoFocus
            required
          />
        ) : (
          <>
            <Input label={ta('email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} leading={<Mail className="h-4 w-4" />} autoComplete="username" autoFocus required />
            <Input label={ta('password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} leading={<Lock className="h-4 w-4" />} error={error} autoComplete="current-password" required />
          </>
        )}
      </div>
      <Button type="submit" size="lg" shape="rounded" className="mt-6 w-full" loading={busy}>
        {ta('signIn')}
      </Button>
      {needCode ? (
        <button
          type="button"
          className="mt-4 text-[13px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
          onClick={() => {
            setNeedCode(false);
            setPassword('');
            setError('');
          }}
        >
          {ta('codeBack')}
        </button>
      ) : (
        <>
          <p className="mt-4 rounded-xl bg-sand/70 p-3 text-[13px] leading-snug text-ink-soft">{ta('forgot')}</p>
          {recovery && (
            <button type="button" className="mt-3 text-[13px] font-semibold text-ink underline underline-offset-2" onClick={onRecover}>
              {ta('recoverLink')}
            </button>
          )}
        </>
      )}
    </form>
  );
}

/** New password + its repeat, with the rule shown before it is broken. */
function NewPassword({ value, repeat, onValue, onRepeat, error, label }: { value: string; repeat: string; onValue: (v: string) => void; onRepeat: (v: string) => void; error: string; label: string }) {
  const ta = useDict(AU, 'admin');
  return (
    <>
      <Input label={label} type="password" value={value} onChange={(e) => onValue(e.target.value)} leading={<Lock className="h-4 w-4" />} hint={ta('passwordHint')} autoComplete="new-password" minLength={10} required />
      <Input label={ta('repeatPassword')} type="password" value={repeat} onChange={(e) => onRepeat(e.target.value)} leading={<Lock className="h-4 w-4" />} error={error} autoComplete="new-password" required />
    </>
  );
}

function SetupForm() {
  const ta = useDict(AU, 'admin');
  const message = useAuthError();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password !== repeat) return setError(ta('e_mismatch'));
    setBusy(true);
    setError('');
    try {
      await setupOwner({ code: code.trim(), name: name.trim(), email: email.trim(), password });
      enterCms();
    } catch (err) {
      setError(message(err));
      setBusy(false);
      // someone else finished the set-up meanwhile: show the sign-in form
      if (err instanceof ApiError && err.code === 'already_set_up') useSession.setState({ setup: false });
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-3xl font-extrabold tracking-tight">{ta('setupTitle')}</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{ta('setupText')}</p>
      <div className="mt-8 space-y-4">
        <Input label={ta('setupCode')} value={code} onChange={(e) => setCode(e.target.value)} leading={<KeyRound className="h-4 w-4" />} autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus required />
        <Input label={ta('name')} value={name} onChange={(e) => setName(e.target.value)} leading={<User className="h-4 w-4" />} autoComplete="name" required />
        <Input label={ta('email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} leading={<Mail className="h-4 w-4" />} autoComplete="username" required />
        <NewPassword label={ta('password')} value={password} repeat={repeat} onValue={setPassword} onRepeat={setRepeat} error={error} />
      </div>
      <Button type="submit" size="lg" shape="rounded" className="mt-6 w-full" loading={busy}>
        {ta('setupDo')}
      </Button>
    </form>
  );
}

function RecoverForm({ onBack }: { onBack: () => void }) {
  const ta = useDict(AU, 'admin');
  const message = useAuthError();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password !== repeat) return setError(ta('e_mismatch'));
    setBusy(true);
    setError('');
    try {
      await recoverOwner({ code: code.trim(), email: email.trim(), password });
      enterCms();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-3xl font-extrabold tracking-tight">{ta('recoverTitle')}</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{ta('recoverText')}</p>
      <div className="mt-8 space-y-4">
        <Input label={ta('recoverCode')} value={code} onChange={(e) => setCode(e.target.value)} leading={<KeyRound className="h-4 w-4" />} autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus required />
        <Input label={ta('recoverEmail')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} leading={<Mail className="h-4 w-4" />} autoComplete="username" required />
        <NewPassword label={ta('newPassword')} value={password} repeat={repeat} onValue={setPassword} onRepeat={setRepeat} error={error} />
      </div>
      <Button type="submit" size="lg" shape="rounded" className="mt-6 w-full" loading={busy}>
        {ta('recoverDo')}
      </Button>
      <button type="button" className="mt-4 text-[13px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline" onClick={onBack}>
        {ta('backToSignIn')}
      </button>
    </form>
  );
}
