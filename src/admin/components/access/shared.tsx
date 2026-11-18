// Pieces shared by Settings → Access and "My account" (server-backed build only): loading states, the server's
// refusals as text, signed-in devices and the sign-in history.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Check, Copy, Lock, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { confirmDialog } from '@/admin/components/kit';
import { Avatar, Panel, StateText } from '@/admin/components/settings/ui';
import { Button, buttonClass } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { useDict, useL, useLang } from '@/i18n';
import { ApiError } from '@/lib/backend/api';
import { useSession } from '@/lib/backend/session';
import { listAuthEvents, listSessions, revokeSession, revokeSessions, type AuthEvent, type SessionRow } from '@/lib/backend/staff';
import { dateTime, timeAgo } from '@/lib/format';
import { ROLE_META, ROLES } from '@/lib/permissions';
import type { RoleId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AX, type AxKey } from './strings';

type T = (key: AxKey, vars?: Record<string, string | number>) => string;

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */
/** The server's refusal as a sentence that says what to do next. */
export function errorText(err: unknown, t: T): string {
  const code = err instanceof ApiError ? err.code : 'server';
  const key = `e_${code}` as AxKey;
  return key in AX.me ? t(key) : t('e_server');
}

export const isForbidden = (err: unknown) => err instanceof ApiError && err.status === 403 && err.code === 'forbidden';

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */
export interface Loaded<D> {
  data: D | null;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (next: D | ((prev: D | null) => D | null)) => void;
}

/** Load once on mount; `reload` asks again and keeps what is shown until the answer arrives. */
export function useLoad<D>(load: () => Promise<D>): Loaded<D> {
  const [data, setData] = useState<D | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const fn = useRef(load);
  fn.current = load;
  const alive = useRef(true);
  const turn = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++turn.current;
    setLoading(true);
    try {
      const d = await fn.current();
      if (!alive.current || mine !== turn.current) return;
      setData(d);
      setError(null);
    } catch (err) {
      if (!alive.current || mine !== turn.current) return;
      setError(err);
    } finally {
      if (alive.current && mine === turn.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);
  return { data, error, loading, reload, setData: setData as Loaded<D>['setData'] };
}

/** Placeholder rows while the first answer is on its way, or the error with a retry. Null once there is data. */
export function LoadState({ state, className }: { state: Pick<Loaded<unknown>, 'data' | 'error' | 'loading' | 'reload'>; className?: string }) {
  const t = useDict(AX, 'admin');
  if (state.data !== null && !state.error) return null;
  if (state.error) {
    return (
      <div role="alert" className={cn('flex flex-col items-start gap-3 px-5 py-6 text-[13px] text-ink-soft sm:px-6', className)}>
        <span>
          {t('loadFailed')} {errorText(state.error, t)}
        </span>
        <Button variant="outline" size="xs" shape="rounded" icon={<RefreshCw className="h-3.5 w-3.5" />} loading={state.loading} onClick={() => void state.reload()}>
          {t('retry')}
        </Button>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label={t('loading')} className={cn('space-y-2.5 px-5 py-5 sm:px-6', className)}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-ink/[0.05]" />
      ))}
    </div>
  );
}

/** The "no permission" card of the CMS, for screens only the owner may use. */
export function OwnerOnly() {
  const t = useDict(AX, 'admin');
  return (
    <div className="grid min-h-[46vh] place-items-center py-6">
      <div className="w-full max-w-[460px] rounded-xl border border-line bg-white px-6 py-9 text-center shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-10">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-canvas text-ink ring-1 ring-line">
          <Lock className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-[22px] font-bold tracking-tight text-ink">{t('ownerOnlyTitle')}</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">{t('ownerOnlyText')}</p>
        <div className="mt-6 flex justify-center">
          <Link to="/admin/llogaria" className={buttonClass({ size: 'sm', shape: 'rounded' })}>
            {t('openMyAccount')}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ text, onCopied, size = 'sm', variant = 'outline', className }: { text: string; onCopied?: () => void; size?: 'xs' | 'sm'; variant?: 'outline' | 'dark'; className?: string }) {
  const t = useDict(AX, 'admin');
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    if (!(await copyText(text))) {
      toast.error(t('copyFailed'));
      return;
    }
    setDone(true);
    onCopied?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 2500);
  };
  return (
    <Button variant={variant} size={size} shape="rounded" className={className} icon={done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={() => void copy()}>
      <span aria-live="polite">{done ? t('copied') : t('copy')}</span>
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Devices                                                             */
/* ------------------------------------------------------------------ */
/** "Chrome · Windows" from a browser's user-agent line ('' when nothing is recognised). */
export function deviceName(ua: string): { label: string; mobile: boolean } {
  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser\//.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : '';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPod/.test(ua)
      ? 'iPhone'
      : /iPad/.test(ua)
        ? 'iPad'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /CrOS/.test(ua)
              ? 'ChromeOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : '';
  return { label: [browser, os].filter(Boolean).join(' · '), mobile: /Android|iPhone|iPod|iPad|Mobile/.test(ua) };
}

function DeviceRow({ s, busy, onSignOut }: { s: SessionRow; busy: boolean; onSignOut: () => void }) {
  const t = useDict(AX, 'admin');
  const lang = useLang('admin');
  const d = deviceName(s.ua);
  const Icon = d.mobile ? Smartphone : Monitor;
  return (
    <li className="flex items-start gap-3 px-5 py-3 sm:items-center sm:px-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f3f3f3] text-ink-soft ring-1 ring-inset ring-black/[0.05]">
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-semibold text-ink">
          <span className="min-w-0 truncate" title={s.ua}>
            {d.label || t('unknownDevice')}
          </span>
          {s.current && <span className="rounded bg-ink px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">{t('thisDevice')}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] leading-snug text-muted">
          {s.ip && <span className="break-all tabular-nums">{s.ip}</span>}
          <span title={dateTime(s.lastSeen, lang)}>{t('lastSeen', { ago: timeAgo(s.lastSeen, lang) })}</span>
          <span>{t('signedInAt', { at: dateTime(s.createdAt, lang) })}</span>
        </div>
      </div>
      {!s.current && (
        <Button variant="outline" size="xs" shape="rounded" loading={busy} onClick={onSignOut} className="shrink-0">
          {t('signOut')}
        </Button>
      )}
    </li>
  );
}

/** Signed-in devices: mine, or (for the owner) everyone's grouped by account. */
export function SessionsPanel({ scope, lead }: { scope: 'mine' | 'all'; lead?: boolean }) {
  const t = useDict(AX, 'admin');
  const state = useLoad(() => listSessions(scope === 'all'));
  const [busy, setBusy] = useState<string | null>(null);
  const rows = state.data ?? [];
  const mineOthers = rows.filter((s) => !s.current && rows.some((c) => c.current && c.userId === s.userId));

  const groups = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    for (const s of rows) m.set(s.userId, [...(m.get(s.userId) ?? []), s]);
    // my own devices first, then by name
    return [...m.values()].sort((a, b) => Number(b.some((s) => s.current)) - Number(a.some((s) => s.current)) || a[0].name.localeCompare(b[0].name));
  }, [rows]);

  const signOutOne = async (s: SessionRow) => {
    const device = deviceName(s.ua).label || t('unknownDevice');
    if (!(await confirmDialog({ title: t('signOutDeviceTitle'), text: t('signOutDeviceText', { device, name: s.name || s.email }), confirmLabel: t('signOut'), danger: true }))) return;
    setBusy(s.id);
    try {
      await revokeSession(s.id);
      toast.success(t('t_sessionEnded'));
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404) toast.error(errorText(err, t));
    } finally {
      setBusy(null);
      void state.reload();
    }
  };
  const signOutOthers = async () => {
    if (!(await confirmDialog({ title: t('signOutOthersTitle'), text: t('signOutOthersText'), confirmLabel: t('signOutOthers'), danger: true }))) return;
    setBusy('others');
    const failed = await revokeSessions(mineOthers.map((s) => s.id));
    setBusy(null);
    if (failed) toast.error(t('t_someFailed'));
    else toast.success(t('t_othersEnded'));
    void state.reload();
  };

  return (
    <Panel
      lead={lead}
      flush
      title={t('sessions')}
      description={scope === 'all' ? t('sessionsAll_d') : t('sessionsMine_d')}
      actions={
        // my own other devices in one go — offered on "My account"; the owner's overview signs out device by device
        scope === 'mine' && mineOthers.length > 0 ? (
          <Button variant="outline" size="sm" shape="rounded" loading={busy === 'others'} onClick={() => void signOutOthers()}>
            {t('signOutOthers')}
          </Button>
        ) : undefined
      }
    >
      <LoadState state={state} />
      {state.data && !state.error && (
        <>
          {rows.length === 0 && <div className="px-6 py-10 text-center text-[13px] text-muted">{t('noSessions')}</div>}
          {scope === 'mine' ? (
            <ul className="divide-y divide-line/60">
              {rows.map((s) => (
                <DeviceRow key={s.id} s={s} busy={busy === s.id} onSignOut={() => void signOutOne(s)} />
              ))}
            </ul>
          ) : (
            groups.map((g) => (
              <div key={g[0].userId} className="border-b border-line/60 last:border-b-0">
                <div className="flex items-center gap-2.5 bg-[#f7f7f7] px-5 py-2 text-[12.5px] font-semibold text-ink-soft sm:px-6">
                  <Avatar name={g[0].name} size="sm" />
                  <span className="min-w-0 truncate">{g[0].name}</span>
                  <span className="min-w-0 truncate font-normal text-muted">{g[0].email}</span>
                </div>
                <ul className="divide-y divide-line/60">
                  {g.map((s) => (
                    <DeviceRow key={s.id} s={s} busy={busy === s.id} onSignOut={() => void signOutOne(s)} />
                  ))}
                </ul>
              </div>
            ))
          )}
          {scope === 'mine' && rows.length === 1 && rows[0].current && <p className="border-t border-line/60 px-5 py-3 text-[12.5px] text-muted sm:px-6">{t('onlyThis')}</p>}
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Sign-in history                                                     */
/* ------------------------------------------------------------------ */
const EVENT_SYMBOL: Record<string, string> = {
  login: '→', logout: '←', login_failed: '×', login_locked: '×', locked: '▪', password_change_failed: '×', user_deleted: '−', user_created: '+', session_revoked: '←',
  subscribers_export: '↧',
};
/** Events worth a second look (shown with a warning mark, never by colour alone). */
const WARN = new Set(['login_failed', 'login_locked', 'locked', 'password_change_failed', 'recovered', 'totp_reset']);

const DETAIL: Record<string, AxKey> = {
  'unknown e-mail': 'd_unknown_email',
  'account disabled': 'd_disabled',
  'no password yet': 'd_no_password',
  'wrong password': 'd_wrong_password',
  'wrong current password': 'd_wrong_password',
  'wrong 2-step code': 'd_wrong_code',
  'by themselves': 'd_self',
  'by the owner': 'd_owner',
  'new link created': 'd_new_link',
  'first owner account': 'd_first_owner',
  'owner access recovered with the file code': 'd_recovered',
  '2-step sign-in switched off': 'd_recovered',
  'sign-in blocked': 'd_blocked',
  'sign-in allowed': 'd_allowed',
  unlocked: 'd_unlocked',
};

/** The server writes its notes in English; show the known ones in the CMS language, the rest as written. */
function detailText(detail: string, t: T, roleName: (id: string) => string): string {
  if (!detail) return '';
  const parts: string[] = [];
  for (const raw of detail.split(';').map((p) => p.trim()).filter(Boolean)) {
    const known = DETAIL[raw];
    let m: RegExpExecArray | null;
    let out = raw;
    if (known) out = t(known);
    else if ((m = /^role (\w+) → (\w+)$/.exec(raw))) out = t('d_role_change', { from: roleName(m[1]), to: roleName(m[2]) });
    else if ((m = /^role (\w+)$/.exec(raw))) out = t('d_role', { role: roleName(m[1]) });
    else if ((m = /^locked for (\d+) min$/.exec(raw))) out = t('d_locked_for', { n: m[1] });
    else if ((m = /^(\w+), (\d+) rows$/.exec(raw))) out = t('d_rows', { channel: m[1], n: m[2] });
    if (!parts.includes(out)) parts.push(out);
  }
  return parts.join(' · ');
}

const EVENTS_PAGE = 50;

/**
 * Sign-in history, newest first. The server pages by entry id ("before"); "Show more" asks for the next page.
 * `people` (owner) gives the account filter and the names behind account ids.
 */
export function AuthEventsPanel({ scope, people = [] }: { scope: 'mine' | 'all'; people?: { id: string; name: string; email: string }[] }) {
  const t = useDict(AX, 'admin');
  const l = useL('admin');
  const lang = useLang('admin');
  const me = useSession((s) => s.user);
  const [who, setWho] = useState('');
  const [rows, setRows] = useState<AuthEvent[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const turn = useRef(0);

  const load = useCallback(
    async (before?: number) => {
      const mine = ++turn.current;
      setLoading(true);
      try {
        const page = await listAuthEvents({ limit: EVENTS_PAGE, before, user: scope === 'all' ? who : '' });
        if (mine !== turn.current) return;
        setRows((prev) => (before && prev ? [...prev, ...page] : page));
        setMore(page.length === EVENTS_PAGE);
        setError(null);
      } catch (err) {
        if (mine !== turn.current) return;
        setError(err);
        // asking for more failed: the list stays, the reason is said
        if (before) toast.error(errorText(err, t));
      } finally {
        if (mine === turn.current) setLoading(false);
      }
    },
    [scope, who, t],
  );
  useEffect(() => {
    setRows(null);
    void load();
    return () => {
      turn.current++;
    };
  }, [load]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const roleName = (id: string) => ((ROLES as string[]).includes(id) ? l(ROLE_META[id as RoleId].name) : id);
  const nameOf = (id: string) => byId.get(id)?.name ?? (id === me?.id ? me.name : t('deletedAccount'));

  const account = (e: AuthEvent) => {
    const p = e.userId ? byId.get(e.userId) : undefined;
    const name = p?.name ?? (e.userId && e.userId === me?.id ? me.name : '');
    return (
      <span className="block min-w-0">
        {name && <span className="block truncate font-medium text-ink">{name}</span>}
        <span className={cn('block break-all', name ? 'text-[12px] text-muted' : 'text-ink-soft')}>{e.email || '—'}</span>
      </span>
    );
  };
  const event = (e: AuthEvent) => {
    const key = `k_${e.kind}` as AxKey;
    const detail = detailText(e.detail, t, roleName);
    const actor = e.actor && e.actor !== e.userId ? t('byActor', { name: nameOf(e.actor) }) : '';
    return (
      <span className="block min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft">
          {WARN.has(e.kind) ? (
            <StateText tone="warn">{key in AX.me ? t(key) : e.kind}</StateText>
          ) : (
            <>
              <span aria-hidden className="grid h-4 w-4 shrink-0 place-items-center rounded bg-[#efefef] text-[10px] font-bold text-ink-soft">
                {EVENT_SYMBOL[e.kind] ?? '·'}
              </span>
              {key in AX.me ? t(key) : e.kind}
            </>
          )}
        </span>
        {(detail || actor) && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{[detail, actor].filter(Boolean).join(' · ')}</span>}
      </span>
    );
  };
  const where = (e: AuthEvent) => {
    const d = deviceName(e.ua).label;
    return (
      <span className="block min-w-0 text-[12.5px] text-muted" title={e.ua || undefined}>
        <span className="break-all tabular-nums text-ink-soft">{e.ip || '—'}</span>
        {d && <span className="block truncate">{d}</span>}
      </span>
    );
  };

  const state = { data: rows, error, loading, reload: () => load() };
  /** the list is on screen (an error while asking for more keeps it there) */
  const shown = rows !== null && (error === null || rows.length > 0);
  return (
    <Panel
      flush
      title={t('events')}
      description={scope === 'all' ? t('eventsAll_d') : t('eventsMine_d')}
      actions={
        scope === 'all' && people.length > 0 ? (
          <Select aria-label={t('colAccount')} value={who} onChange={(e) => setWho(e.target.value)} wrapClassName="w-full sm:w-[220px]" className="h-9! rounded-lg! text-[13px]! pr-9!">
            <option value="">{t('allAccounts')}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.email}
              </option>
            ))}
          </Select>
        ) : undefined
      }
    >
      {!shown && <LoadState state={state} />}
      {shown && rows.length === 0 && <div className="px-6 py-12 text-center text-[13px] text-muted">{t('noEvents')}</div>}
      {shown && rows.length > 0 && (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr>
                  {[t('colTime'), ...(scope === 'all' ? [t('colAccount')] : []), t('colEvent'), t('colWhere')].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-line bg-[#f7f7f7] px-3 py-2.5 text-[12px] font-semibold text-muted first:pl-6 last:pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="align-top transition-colors hover:bg-[#fafafa]">
                    <td className="whitespace-nowrap border-b border-line/60 py-2.5 pl-6 pr-3 text-muted">
                      <div className="text-ink-soft">{timeAgo(e.at, lang)}</div>
                      <div className="text-[11.5px] tabular-nums">{dateTime(e.at, lang)}</div>
                    </td>
                    {scope === 'all' && <td className="max-w-[220px] border-b border-line/60 px-3 py-2.5">{account(e)}</td>}
                    <td className="border-b border-line/60 px-3 py-2.5">{event(e)}</td>
                    <td className="max-w-[220px] border-b border-line/60 py-2.5 pl-3 pr-6">{where(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <ul className="divide-y divide-line/60 md:hidden">
            {rows.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">{event(e)}</div>
                  <span className="shrink-0 text-[12.5px] text-muted" title={dateTime(e.at, lang)}>
                    {timeAgo(e.at, lang)}
                  </span>
                </div>
                {scope === 'all' && <div className="mt-1.5 text-[12.5px]">{account(e)}</div>}
                <div className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-muted">
                  <span className="tabular-nums">{dateTime(e.at, lang)}</span>
                  {e.ip && <span className="break-all tabular-nums">{e.ip}</span>}
                  {deviceName(e.ua).label && <span>{deviceName(e.ua).label}</span>}
                </div>
              </li>
            ))}
          </ul>
          {more && (
            <div className="border-t border-line/70 px-5 py-3 text-center sm:px-6">
              <Button variant="outline" size="xs" shape="rounded" loading={loading} onClick={() => void load(rows[rows.length - 1].id)}>
                {t('more')}
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
