// "Set your password" — where an invitation or a new-password link from Settings → Access lands
// (/admin/lozinka#t=<token>). The token travels in the #fragment, which browsers never send to a server or put in a
// Referer; it is taken out of the address bar as soon as it has been read.
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useDict } from '@/i18n';
import { acceptLink, linkInfo, type LinkInfo } from '@/lib/backend/session';
import { AuthShell, enterCms, useAuthError } from '@/admin/components/auth/AuthShell';
import { AU } from '@/admin/components/auth/strings';
import { href } from '@/lib/paths';

function readToken(): string {
  const m = /(?:^#|&)t=([A-Za-z0-9_-]{16,200})/.exec(window.location.hash);
  if (!m) return '';
  try {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  } catch {
    /* the address just keeps the fragment */
  }
  return m[1];
}

export default function SetPassword() {
  const ta = useDict(AU, 'admin');
  const message = useAuthError();
  const [token] = useState(readToken);
  const [info, setInfo] = useState<LinkInfo | null | 'bad'>(token ? null : 'bad');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // the password is saved but nobody is signed in: the account is switched off, or it signs in with a 2-step code
  const [saved, setSaved] = useState<'' | 'blocked' | 'code'>('');

  useEffect(() => {
    if (!token) return;
    let alive = true;
    linkInfo(token).then(
      (i) => alive && setInfo(i),
      () => alive && setInfo('bad'),
    );
    return () => {
      alive = false;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password !== repeat) return setError(ta('e_mismatch'));
    setBusy(true);
    setError('');
    try {
      const user = await acceptLink(token, password);
      if (user && user !== 'code') enterCms();
      else {
        setSaved(user === 'code' ? 'code' : 'blocked');
        setBusy(false);
      }
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  if (info === null) {
    return (
      <AuthShell>
        <p className="text-muted" role="status">
          {ta('linkChecking')}
        </p>
      </AuthShell>
    );
  }
  if (info === 'bad' || saved) {
    return (
      <AuthShell>
        <h1 className="text-3xl font-extrabold tracking-tight">{saved ? ta('linkResetTitle') : ta('linkBadTitle')}</h1>
        <p className="mt-3 leading-relaxed text-muted" role="status">
          {saved === 'code' ? ta('linkNeedsCode') : saved ? ta('linkBlocked') : ta('linkBadText')}
        </p>
        <a href={href('/admin/login')} className="mt-6 inline-block text-[14px] font-semibold text-ink underline underline-offset-2">
          {ta('backToSignIn')}
        </a>
      </AuthShell>
    );
  }
  const invite = info.kind === 'invite';
  return (
    <AuthShell>
      <form onSubmit={submit} noValidate>
        <h1 className="text-3xl font-extrabold tracking-tight">{invite ? ta('linkInviteTitle') : ta('linkResetTitle')}</h1>
        <p className="mt-2 break-words text-muted">{invite ? ta('linkInviteText', { name: info.name, email: info.email }) : ta('linkResetText', { email: info.email })}</p>
        <div className="mt-8 space-y-4">
          {/* lets the password manager file the new password under the right account */}
          <input type="email" name="username" autoComplete="username" value={info.email} readOnly hidden />
          <Input label={ta('newPassword')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} leading={<Lock className="h-4 w-4" />} hint={ta('passwordHint')} autoComplete="new-password" minLength={10} autoFocus required />
          <Input label={ta('repeatPassword')} type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} leading={<Lock className="h-4 w-4" />} error={error} autoComplete="new-password" required />
        </div>
        <Button type="submit" size="lg" shape="rounded" className="mt-6 w-full" loading={busy}>
          {ta('linkDo')}
        </Button>
      </form>
    </AuthShell>
  );
}
