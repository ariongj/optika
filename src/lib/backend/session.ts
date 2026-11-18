// Staff sign-in against the shop server: the session lives in an HttpOnly cookie the page cannot read; the page only
// keeps who is signed in (memory) and the anti-forgery token for writes. Nothing about the session is stored in the
// browser's storage except a "staff used this browser" hint, so visitors' pages never ask the server who they are.
import { create } from 'zustand';
import type { RoleId } from '@/lib/types';
import { useUi } from '@/store/ui';
import { api, ApiError, setCsrf } from './api';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: RoleId;
  /** Team-list entry (Settings → Staff) this account belongs to */
  staffId: string;
  /** 2-step sign-in switched on */
  totp: boolean;
  lastLoginAt: string | null;
}

interface MePayload {
  ok: true;
  user: StaffUser;
  csrf: string;
  version: string;
}

export interface SessionState {
  /** unknown = not asked yet; checking = asking the server */
  status: 'unknown' | 'checking' | 'in' | 'out';
  user: StaffUser | null;
  /** The shop has no owner account yet (first setup) */
  setup: boolean;
  /** Owner recovery switched on in the hosting file manager */
  recovery: boolean;
}

export const useSession = create<SessionState>(() => ({ status: 'unknown', user: null, setup: false, recovery: false }));

const HINT = 'mv-staff';
function hint(on: boolean) {
  try {
    if (on) window.localStorage.setItem(HINT, '1');
    else window.localStorage.removeItem(HINT);
  } catch {
    /* storage blocked */
  }
}
/** Did staff sign in on this browser before? (Only then does the storefront check for a session.) */
export function staffHint(): boolean {
  try {
    return window.localStorage.getItem(HINT) === '1';
  } catch {
    return false;
  }
}

function signedIn(me: MePayload): StaffUser {
  setCsrf(me.csrf);
  hint(true);
  useSession.setState({ status: 'in', user: me.user, setup: false, recovery: false });
  // the CMS's role checks and "signed in" switches read these
  useUi.setState({ adminAuthed: true, adminRole: me.user.role });
  return me.user;
}

function signedOutState(extra: Partial<SessionState> = {}) {
  setCsrf('');
  useSession.setState({ status: 'out', user: null, ...extra });
  useUi.setState({ adminAuthed: false, adminRole: 'owner' });
}

let checking: Promise<StaffUser | null> | null = null;

/** Ask the server whether this browser has a staff session. Resolves with the user, or null. */
export function checkSession(): Promise<StaffUser | null> {
  if (checking) return checking;
  useSession.setState({ status: 'checking' });
  checking = (async () => {
    try {
      return signedIn(await api<MePayload>('auth/me'));
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) {
        // server unreachable: stay signed out, keep the hint so a later visit asks again
        signedOutState();
        return null;
      }
      hint(false);
      let st = { setup: false, recovery: false };
      try {
        st = await api<{ setup: boolean; recovery: boolean }>('auth/status');
      } catch {
        /* keep defaults */
      }
      signedOutState({ setup: !!st.setup, recovery: !!st.recovery });
      return null;
    } finally {
      checking = null;
    }
  })();
  return checking;
}

export async function signIn(email: string, password: string, code = ''): Promise<StaffUser> {
  return signedIn(await api<MePayload>('auth/login', { body: { email, password, code } }));
}

/** First owner account, with the code from SETUP-CODE.txt in the private data folder. */
export async function setupOwner(input: { code: string; name: string; email: string; password: string }): Promise<StaffUser> {
  return signedIn(await api<MePayload>('auth/setup', { body: input }));
}

/** Owner recovery, with the code from RECOVERY-CODE.txt (after creating a RECOVER file in the data folder). */
export async function recoverOwner(input: { code: string; email: string; password: string }): Promise<StaffUser> {
  return signedIn(await api<MePayload>('auth/recover', { body: input }));
}

export interface LinkInfo {
  kind: 'invite' | 'reset';
  email: string;
  name: string;
  expiresAt: string;
}
export function linkInfo(token: string): Promise<LinkInfo> {
  return api<LinkInfo & { ok: true }>('auth/link-info', { body: { token } });
}

/** Set a password from an invite / reset link. Signs in unless the account is blocked. */
export async function acceptLink(token: string, password: string): Promise<StaffUser | null> {
  const r = await api<(MePayload & { signedIn: true }) | { ok: true; signedIn: false }>('auth/link-accept', { body: { token, password } });
  return r.signedIn ? signedIn(r) : null;
}

export async function changePassword(current: string, password: string): Promise<void> {
  await api('auth/password', { body: { current, password } });
}

export async function totpBegin(): Promise<{ secret: string; uri: string }> {
  return api<{ ok: true; secret: string; uri: string }>('auth/totp/begin', { body: {} });
}
export async function totpEnable(code: string): Promise<void> {
  await api('auth/totp/enable', { body: { code } });
  const u = useSession.getState().user;
  if (u) useSession.setState({ user: { ...u, totp: true } });
}
export async function totpDisable(password: string): Promise<void> {
  await api('auth/totp/disable', { body: { password } });
  const u = useSession.getState().user;
  if (u) useSession.setState({ user: { ...u, totp: false } });
}

/** Sign out and start the page afresh (nothing of the CMS data stays in memory). */
export async function signOut(to = 'admin/login'): Promise<void> {
  try {
    await api('auth/logout', { body: {} });
  } catch {
    /* signed out locally anyway */
  }
  hint(false);
  signedOutState();
  window.location.assign(`${import.meta.env.BASE_URL}${to}`);
}

// a 401 from any call (session expired / revoked / signed out in another tab) ends the session here too
if (typeof window !== 'undefined') {
  window.addEventListener('mv:signed-out', () => {
    if (useSession.getState().status === 'in') signedOutState();
  });
}

/** Messages for the server's sign-in error codes. */
export function authErrorKey(err: unknown):
  | 'bad_credentials' | 'locked' | 'code_required' | 'code_bad' | 'rate_limited' | 'network' | 'password_short' | 'password_long'
  | 'password_weak' | 'password_personal' | 'email_invalid' | 'email_taken' | 'link_invalid' | 'not_owner' | 'recovery_off'
  | 'already_set_up' | 'name_required' | 'server' {
  const code = err instanceof ApiError ? err.code : 'server';
  const known = [
    'bad_credentials', 'locked', 'code_required', 'code_bad', 'rate_limited', 'network', 'password_short', 'password_long', 'password_weak',
    'password_personal', 'email_invalid', 'email_taken', 'link_invalid', 'not_owner', 'recovery_off', 'already_set_up', 'name_required',
  ] as const;
  return (known as readonly string[]).includes(code) ? (code as (typeof known)[number]) : 'server';
}
