// Staff accounts on the shop server (server/api/lib/users.php, consent.php): sign-in accounts, one-time invite /
// password links, signed-in devices, the sign-in history, the marketing-consent record and the subscribers export.
// Only called by the server-backed build (BACKEND); the demo never reaches these.
import type { RoleId } from '@/lib/types';
import { API_ROOT, ApiError, api } from './api';
import type { StaffUser } from './session';

/* ------------------------------------------------------------------ */
/* Accounts (owner only)                                               */
/* ------------------------------------------------------------------ */
export interface AccountRow extends StaffUser {
  /** false = sign-in blocked by the owner */
  active: boolean;
  /** false = invited, has not set a password yet */
  hasPassword: boolean;
  /** Locked for a while after too many wrong sign-ins */
  locked: boolean;
  /** Devices signed in right now */
  sessions: number;
  createdAt: string;
  passwordChangedAt: string | null;
  /** An unused invite / password link that still works */
  pendingLink: { kind: 'invite' | 'reset'; expiresAt: string } | null;
}

/** A one-time link token. The server keeps only its hash: this is the single time it can be read. */
export interface OneTimeLink {
  token: string;
  expiresAt: string;
}

export async function listAccounts(): Promise<AccountRow[]> {
  return (await api<{ users: AccountRow[] }>('admin/users')).users;
}

export function inviteAccount(input: { name: string; email: string; role: RoleId; staffId?: string }): Promise<{ user: AccountRow; link: OneTimeLink }> {
  return api<{ ok: true; user: AccountRow; link: OneTimeLink }>('admin/users', { body: input });
}

export interface AccountPatch {
  name?: string;
  email?: string;
  role?: RoleId;
  /** false blocks sign-in (and signs the account out everywhere) */
  active?: boolean;
  /** '' removes the link to the team list */
  staffId?: string;
  /** End a lockout after wrong sign-ins */
  unlock?: true;
}
export async function updateAccount(id: string, patch: AccountPatch): Promise<AccountRow> {
  return (await api<{ user: AccountRow }>('admin/users/update', { body: { id, ...patch } })).user;
}

/** A fresh invite (no password yet) or password link; older unused links of the account stop working. */
export function newAccountLink(id: string): Promise<{ kind: 'invite' | 'reset'; link: OneTimeLink }> {
  return api<{ ok: true; kind: 'invite' | 'reset'; link: OneTimeLink }>('admin/users/link', { body: { id } });
}

/** Switch off someone's 2-step sign-in (lost phone). */
export async function resetAccountTotp(id: string): Promise<void> {
  await api('admin/users/2fa-reset', { body: { id } });
}

export async function deleteAccount(id: string): Promise<void> {
  await api('admin/users/delete', { body: { id } });
}

/** Where the person opens a one-time link: /admin/lozinka#t=<token> (the token stays out of server logs). */
export function linkUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}admin/lozinka#t=${encodeURIComponent(token)}`;
}

/* ------------------------------------------------------------------ */
/* Signed-in devices                                                   */
/* ------------------------------------------------------------------ */
export interface SessionRow {
  /** Server row id (not the cookie); only used to sign that device out */
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  lastSeen: string;
  ip: string;
  ua: string;
  /** The device asking */
  current: boolean;
}

/** My devices; with `all`, every account's (the server answers with mine only unless I am the owner). */
export async function listSessions(all = false): Promise<SessionRow[]> {
  return (await api<{ sessions: SessionRow[] }>(`admin/sessions${all ? '?all=1' : ''}`)).sessions;
}

export async function revokeSession(id: string): Promise<void> {
  await api('admin/sessions/revoke', { body: { id } });
}

/** Sign several devices out, one after another. Resolves with how many could not be ended. */
export async function revokeSessions(ids: string[]): Promise<number> {
  let failed = 0;
  for (const id of ids) {
    try {
      await revokeSession(id);
    } catch (err) {
      // already gone counts as done
      if (!(err instanceof ApiError) || err.status !== 404) failed++;
    }
  }
  return failed;
}

/* ------------------------------------------------------------------ */
/* Sign-in history                                                     */
/* ------------------------------------------------------------------ */
export interface AuthEvent {
  id: number;
  at: string;
  userId: string | null;
  /** The account's e-mail, or what was typed at a failed sign-in */
  email: string;
  kind: string;
  ip: string;
  ua: string;
  detail: string;
  /** Account id of who did it, when it was not the person themselves */
  actor: string | null;
}

/** Newest first. `before` = id of the last entry already shown; `user` filters (owner only). */
export async function listAuthEvents(opts: { limit?: number; before?: number; user?: string } = {}): Promise<AuthEvent[]> {
  const q = new URLSearchParams();
  q.set('limit', String(opts.limit ?? 50));
  if (opts.before) q.set('before', String(opts.before));
  if (opts.user) q.set('user', opts.user);
  const r = await api<{ events: AuthEvent[] }>(`admin/auth-events?${q.toString()}`);
  return r.events.map((e) => ({ ...e, id: Number(e.id) }));
}

/* ------------------------------------------------------------------ */
/* Marketing consent (a legal record: the server only ever adds to it) */
/* ------------------------------------------------------------------ */
export type ConsentChannel = 'email' | 'sms' | 'whatsapp' | 'viber';
export type ConsentAction = 'subscribe' | 'unsubscribe';

export interface ConsentEvent {
  id: number;
  at: string;
  channel: ConsentChannel;
  action: ConsentAction;
  /** newsletter · checkout · staff · link (unsubscribe link) · import */
  source: string;
  /** "visitor", or the staff member who recorded it */
  actor: string;
  lang: string;
  /** The consent text the person was shown */
  wording: string;
  /** Order number, when given at checkout */
  ref: string;
  note: string;
  /** Network part of the visitor's address ('' for staff entries) */
  ip: string;
}

/** History for one customer key (lower-case e-mail, or "tel-" + last 8 digits). Newest first. */
export async function listConsent(key: string): Promise<ConsentEvent[]> {
  const r = await api<{ events: ConsentEvent[] }>(`admin/consent?key=${encodeURIComponent(key)}`);
  return r.events.map((e) => ({ ...e, id: Number(e.id) }));
}

export async function recordConsent(input: { key: string; channel: ConsentChannel; action: ConsentAction; note: string; email?: string; phone?: string }): Promise<void> {
  await api('admin/consent', { body: input });
}

/* ------------------------------------------------------------------ */
/* Subscribers export                                                  */
/* ------------------------------------------------------------------ */
/**
 * The CSV of one channel's subscribers. Fetched (not a plain link) so a refusal is an error message here rather
 * than a page of JSON; a GET needs no anti-forgery header, the session cookie travels with same-origin requests.
 */
export async function subscribersCsv(channel: ConsentChannel = 'email'): Promise<{ blob: Blob; filename: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_ROOT}admin/subscribers?format=csv&channel=${channel}`, { headers: { Accept: 'text/csv' }, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'network', null);
  }
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const j = (await res.json()) as { error?: unknown };
      if (typeof j.error === 'string') code = j.error;
    } catch {
      /* not JSON */
    }
    if (res.status === 401 && code === 'signed_out') window.dispatchEvent(new CustomEvent('mv:signed-out'));
    throw new ApiError(res.status, code, null);
  }
  const named = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '');
  return { blob: await res.blob(), filename: named?.[1] ?? `subscribers-${channel}-${new Date().toISOString().slice(0, 10)}.csv` };
}

/** Hand a fetched file to the browser's download. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
