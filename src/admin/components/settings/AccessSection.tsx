// Settings → Access (server-backed build only): who can sign in to the CMS. Accounts, one-time invite / password
// links, blocking, lockouts, signed-in devices and the sign-in history. Every action is saved by the server at once
// (no SaveBar), and the server decides what is allowed — its refusals are shown as they come.
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, KeyRound, Link2, LogOut, Mail, Pencil, ShieldOff, Trash2, Unlock, UserCheck, UserPlus, UserRound } from 'lucide-react';
import { AuthEventsPanel, CopyButton, LoadState, OwnerOnly, SessionsPanel, errorText, isForbidden, useLoad } from '@/admin/components/access/shared';
import { AX } from '@/admin/components/access/strings';
import { pluralForm } from '@/admin/components/crm/shared';
import { ActionMenu, type MenuAction } from '@/admin/components/customers/parts';
import { confirmDialog } from '@/admin/components/kit';
import { adm } from '@/admin/i18n';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Overlay';
import { useDict, useL, useLang } from '@/i18n';
import { ApiError } from '@/lib/backend/api';
import { useSession } from '@/lib/backend/session';
import {
  deleteAccount, inviteAccount, linkUrl, listAccounts, listSessions, newAccountLink, resetAccountTotp, revokeSessions, updateAccount,
  type AccountPatch, type AccountRow,
} from '@/lib/backend/staff';
import { dateTime, timeAgo } from '@/lib/format';
import { ROLES, ROLE_META } from '@/lib/permissions';
import type { RoleId, Staff } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { S } from './strings';
import { TextField, isEmail } from './fields';
import { Avatar, Choice, Note, Panel, StateText, type StateTone } from './ui';

interface ShownLink {
  kind: 'invite' | 'reset';
  name: string;
  url: string;
  expiresAt: string;
}

/** Owners who can actually sign in, other than `except` — the server refuses to lose the last one. */
const otherOwners = (rows: AccountRow[], except: string) => rows.filter((u) => u.id !== except && u.role === 'owner' && u.active && u.hasPassword).length;

/* ------------------------------------------------------------------ */
/* The one-time link, shown once                                       */
/* ------------------------------------------------------------------ */
function LinkModal({ link, onClose }: { link: ShownLink | null; onClose: () => void }) {
  const t = useDict(AX, 'admin');
  const lang = useLang('admin');
  const [copied, setCopied] = useState(false);
  const url = link?.url;
  useEffect(() => setCopied(false), [url]);
  return (
    <Modal
      open={!!link}
      onClose={onClose}
      size="md"
      title={link ? t(link.kind === 'invite' ? 'linkTitle_invite' : 'linkTitle_reset', { name: link.name }) : undefined}
      footer={
        <Button variant={copied ? 'primary' : 'outline'} size="sm" shape="rounded" onClick={onClose}>
          {t('linkClose')}
        </Button>
      }
    >
      {link && (
        <div className="space-y-4 px-6 py-5">
          <Note tone="amber" icon={KeyRound}>
            {t('linkOnce')}
          </Note>
          <div>
            <label htmlFor="mv-one-time-link" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
              {t('linkLabel')}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="mv-one-time-link"
                readOnly
                value={link.url}
                onFocus={(e) => e.currentTarget.select()}
                autoComplete="off"
                spellCheck={false}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-[#f7f7f7] px-3 font-mono text-[12.5px] text-ink outline-none focus:border-ink/40"
              />
              <CopyButton text={link.url} variant="dark" onCopied={() => setCopied(true)} className="h-10!" />
            </div>
          </div>
          <ul className="space-y-1.5 text-[13px] leading-snug text-ink-soft">
            <li>{t('linkExpires', { at: dateTime(link.expiresAt, lang) })}</li>
            <li className="text-muted">{t('linkReplace')}</li>
          </ul>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Invite / edit                                                       */
/* ------------------------------------------------------------------ */
function AccountModal({
  open,
  account,
  accounts,
  onClose,
  onSaved,
  onInvited,
}: {
  open: boolean;
  /** null = invite a new person */
  account: AccountRow | null;
  accounts: AccountRow[];
  onClose: () => void;
  onSaved: (u: AccountRow) => void;
  onInvited: (u: AccountRow, link: ShownLink) => void;
}) {
  const t = useDict(AX, 'admin');
  const ta = useDict(adm, 'admin');
  const l = useL('admin');
  const me = useSession((s) => s.user);
  const team = useDb((s) => s.staff);
  const isNew = !account;
  const [name, setName] = useState(account?.name ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [role, setRole] = useState<RoleId>(account?.role ?? 'orders');
  const [staffId, setStaffId] = useState(account?.staffId ?? '');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<unknown>(null);

  const isSelf = !!account && account.id === me?.id;
  const lockOwner = !!account && account.role === 'owner' && account.active && account.hasPassword && otherOwners(accounts, account.id) === 0;
  const taken = (m: Staff) => accounts.some((a) => a.staffId === m.id && a.id !== account?.id);
  const refusedCode = refused instanceof ApiError ? refused.code : '';
  const errors = {
    name: !name.trim() || refusedCode === 'name_required' ? t('e_name_required') : undefined,
    email: !isEmail(email) || refusedCode === 'email_invalid' ? t('e_email_invalid') : refusedCode === 'email_taken' ? t('e_email_taken') : undefined,
  };

  /** typing clears the server's last refusal */
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setRefused(null);
  };
  const pickMember = (id: string) => {
    setStaffId(id);
    const m = team.find((x) => x.id === id);
    // a new invite for someone from the team list starts from their details
    if (m && isNew) {
      if (!name.trim()) setName(m.name);
      if (!email.trim()) setEmail(m.email);
      setRole(m.role);
    }
  };

  const save = async () => {
    setTried(true);
    setRefused(null);
    if (!name.trim() || !isEmail(email)) return;
    const clean = { name: name.trim(), email: email.trim().toLowerCase() };
    if (account && isSelf && role !== account.role) {
      if (!(await confirmDialog({ title: t('selfRoleTitle'), text: t('selfRoleText'), confirmLabel: t('selfRoleConfirm'), danger: true }))) return;
    }
    setSaving(true);
    try {
      if (!account) {
        const r = await inviteAccount({ ...clean, role, ...(staffId ? { staffId } : {}) });
        onInvited(r.user, { kind: 'invite', name: r.user.name, url: linkUrl(r.link.token), expiresAt: r.link.expiresAt });
      } else {
        const patch: AccountPatch = {};
        if (clean.name !== account.name) patch.name = clean.name;
        if (clean.email !== account.email.toLowerCase()) patch.email = clean.email;
        if (role !== account.role) patch.role = role;
        if (staffId !== account.staffId) patch.staffId = staffId;
        onSaved(Object.keys(patch).length ? await updateAccount(account.id, patch) : account);
      }
      onClose();
    } catch (err) {
      setRefused(err);
    } finally {
      setSaving(false);
    }
  };

  const fieldRefusal = ['name_required', 'email_invalid', 'email_taken'].includes(refusedCode);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isNew ? t('inviteTitle') : t('editTitle')}
      description={isNew ? t('inviteText') : account?.email}
      footer={
        <>
          <Button variant="outline" size="sm" shape="rounded" onClick={onClose}>
            {ta('cancel')}
          </Button>
          <Button size="sm" shape="rounded" loading={saving} onClick={() => void save()}>
            {isNew ? t('createInvite') : ta('save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 px-6 py-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <TextField label={t('name')} value={name} onChange={edit(setName)} leading={<UserRound className="h-4 w-4" />} error={tried ? errors.name : undefined} autoComplete="off" autoFocus />
          <TextField label={t('email')} type="email" value={email} onChange={edit(setEmail)} leading={<Mail className="h-4 w-4" />} error={tried ? errors.email : undefined} hint={t('emailHint')} autoComplete="off" />
          <div>
            <Select label={t('member')} value={staffId} onChange={(e) => pickMember(e.target.value)} className="h-10! rounded-lg! text-[13.5px]!" hint={t('memberHint')}>
              <option value="">{t('memberNone')}</option>
              {team.map((m) => (
                <option key={m.id} value={m.id} disabled={taken(m)}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          {refused !== null && !fieldRefusal && (
            <p role="alert" className="text-[13px] font-medium text-red-600">
              {errorText(refused, t)}
            </p>
          )}
        </div>
        <div>
          <div className="mb-2.5 text-[13px] font-semibold text-ink-soft">{t('role')}</div>
          <div role="radiogroup" aria-label={t('role')} className="grid gap-2">
            {ROLES.map((r) => (
              <Choice key={r} checked={role === r} disabled={lockOwner && r !== 'owner'} onSelect={() => setRole(r)} title={l(ROLE_META[r].name)} description={l(ROLE_META[r].description)} />
            ))}
          </div>
          {lockOwner && <p className="mt-2.5 text-[12.5px] leading-snug text-muted">{t('e_last_owner')}</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */
export function AccessSection() {
  const t = useDict(AX, 'admin');
  const ts = useDict(S, 'admin');
  const l = useL('admin');
  const lang = useLang('admin');
  const me = useSession((s) => s.user);
  const team = useDb((s) => s.staff);
  const state = useLoad(listAccounts);
  const [editor, setEditor] = useState<{ account: AccountRow | null; key: number } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [link, setLink] = useState<ShownLink | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** bumping this reloads the devices and history panels after a change */
  const [stamp, setStamp] = useState(0);

  const accounts = useMemo(() => {
    const rows = state.data ?? [];
    return [...rows].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));
  }, [state.data]);
  const teamById = useMemo(() => new Map(team.map((m) => [m.id, m])), [team]);

  if (isForbidden(state.error)) return <OwnerOnly />;

  const openEditor = (account: AccountRow | null) => {
    setEditor({ account, key: Date.now() });
    setEditorOpen(true);
  };
  const put = (u: AccountRow) => {
    state.setData((prev) => (prev ? (prev.some((x) => x.id === u.id) ? prev.map((x) => (x.id === u.id ? u : x)) : [...prev, u]) : [u]));
    // my own account changed: the CMS menu and permission checks follow at once
    if (me && u.id === me.id) {
      useSession.setState({ user: { ...me, name: u.name, email: u.email, role: u.role, staffId: u.staffId, totp: u.totp } });
      useUi.setState({ adminRole: u.role });
      // no longer an owner: the next answer is "no permission", and this screen says so
      if (u.role !== 'owner') void state.reload();
    }
    setStamp((n) => n + 1);
  };

  /** Run one server action for a row; refusals become a message, a vanished row refreshes the list. */
  const run = async (u: AccountRow, action: () => Promise<AccountRow | void>, done: string) => {
    setBusy(u.id);
    try {
      const next = await action();
      if (next) put(next);
      else {
        await state.reload();
        setStamp((n) => n + 1);
      }
      toast.success(done, { description: u.name });
    } catch (err) {
      toast.error(errorText(err, t));
      if (err instanceof ApiError && err.status === 404) void state.reload();
    } finally {
      setBusy(null);
    }
  };

  const makeLink = async (u: AccountRow) => {
    if (u.hasPassword && !(await confirmDialog({ title: t('resetLinkTitle', { name: u.name }), text: t('resetLinkText'), confirmLabel: t('resetLinkConfirm'), danger: false }))) return;
    setBusy(u.id);
    try {
      const r = await newAccountLink(u.id);
      setLink({ kind: r.kind, name: u.name, url: linkUrl(r.link.token), expiresAt: r.link.expiresAt });
      void state.reload();
      setStamp((n) => n + 1);
    } catch (err) {
      toast.error(errorText(err, t));
      if (err instanceof ApiError && err.status === 404) void state.reload();
    } finally {
      setBusy(null);
    }
  };
  const block = async (u: AccountRow) => {
    if (!(await confirmDialog({ title: t('blockTitle', { name: u.name }), text: t('blockText'), confirmLabel: t('blockConfirm'), danger: true }))) return;
    await run(u, () => updateAccount(u.id, { active: false }), t('t_blocked'));
  };
  const remove = async (u: AccountRow) => {
    if (!(await confirmDialog({ title: t('removeTitle', { name: u.name }), text: t('removeText'), confirmLabel: t('removeConfirm'), danger: true }))) return;
    await run(u, () => deleteAccount(u.id), t('t_removed'));
  };
  const reset2fa = async (u: AccountRow) => {
    if (!(await confirmDialog({ title: t('reset2faTitle', { name: u.name }), text: t('reset2faText'), confirmLabel: t('reset2faConfirm'), danger: true }))) return;
    await run(u, () => resetAccountTotp(u.id), t('t_2faReset'));
  };
  const signOutAll = async (u: AccountRow) => {
    if (!(await confirmDialog({ title: t('signOutAllTitle', { name: u.name }), text: t('signOutAllText'), confirmLabel: t('signOutAllConfirm'), danger: true }))) return;
    await run(
      u,
      async () => {
        const mine = (await listSessions(true)).filter((s) => s.userId === u.id && !s.current);
        if (await revokeSessions(mine.map((s) => s.id))) throw new ApiError(500, 'server', null);
      },
      t('t_signedOut'),
    );
  };

  const stateOf = (u: AccountRow): { tone: StateTone; label: string; sub?: string } => {
    if (!u.active) return { tone: 'off', label: t('st_blocked') };
    if (!u.hasPassword) {
      return u.pendingLink ? { tone: 'test', label: t('st_invited'), sub: t('linkUntil', { at: dateTime(u.pendingLink.expiresAt, lang) }) } : { tone: 'warn', label: t('st_inviteExpired') };
    }
    const sub = u.pendingLink ? t('resetPending', { at: dateTime(u.pendingLink.expiresAt, lang) }) : undefined;
    return u.locked ? { tone: 'warn', label: t('st_locked'), sub } : { tone: 'ok', label: t('st_active'), sub };
  };

  const menu = (u: AccountRow): MenuAction[] => {
    const self = u.id === me?.id;
    const last = u.role === 'owner' && u.active && u.hasPassword && otherOwners(accounts, u.id) === 0;
    const guard = self ? t('e_not_yourself') : last ? t('e_last_owner') : undefined;
    const items: MenuAction[] = [
      { label: t('a_edit'), icon: Pencil, onSelect: () => openEditor(u) },
      { label: u.hasPassword ? t('a_linkReset') : t('a_linkInvite'), icon: Link2, onSelect: () => void makeLink(u) },
    ];
    if (u.locked) items.push({ label: t('a_unlock'), icon: Unlock, onSelect: () => void run(u, () => updateAccount(u.id, { unlock: true }), t('t_unlocked')) });
    if (u.totp) items.push({ label: t('a_reset2fa'), icon: ShieldOff, onSelect: () => void reset2fa(u) });
    if (u.sessions > 0 && !self) items.push({ label: t('a_signOut'), icon: LogOut, onSelect: () => void signOutAll(u) });
    if (u.active) items.push({ label: t('a_block'), icon: Ban, danger: true, divider: true, disabled: !!guard, hint: guard, onSelect: () => void block(u) });
    else items.push({ label: t('a_unblock'), icon: UserCheck, divider: true, onSelect: () => void run(u, () => updateAccount(u.id, { active: true }), t('t_unblocked')) });
    items.push({ label: t('a_remove'), icon: Trash2, danger: true, disabled: !!guard, hint: guard, onSelect: () => void remove(u) });
    return items;
  };

  const who = (u: AccountRow) => (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={u.name} color={u.active ? teamById.get(u.staffId)?.color : '#a3a3a3'} />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className={cn('truncate font-semibold', u.active ? 'text-ink' : 'text-muted')}>{u.name}</span>
          {u.id === me?.id && <span className="rounded bg-ink px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">{t('you')}</span>}
        </span>
        <span className="block truncate text-[12.5px] text-muted">{u.email}</span>
      </span>
    </span>
  );
  const status = (u: AccountRow) => {
    const s = stateOf(u);
    return (
      <span className="block min-w-0">
        <StateText tone={s.tone} className="whitespace-normal">
          {s.label}
        </StateText>
        {s.sub && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{s.sub}</span>}
      </span>
    );
  };
  const twoStep = (u: AccountRow) => <StateText tone={u.totp ? 'ok' : 'off'}>{u.totp ? t('twoOn') : t('twoOff')}</StateText>;
  const member = (u: AccountRow) => (u.staffId && teamById.get(u.staffId) ? <span className="text-ink-soft">{teamById.get(u.staffId)!.name}</span> : <span className="text-muted">{t('noMember')}</span>);
  const lastSeen = (u: AccountRow) => (
    <span className="block">
      <span title={u.lastLoginAt ? dateTime(u.lastLoginAt, lang) : undefined}>{u.lastLoginAt ? timeAgo(u.lastLoginAt, lang) : t('never')}</span>
      {u.sessions > 0 && <span className="block text-[12px]">{t(`devices_${pluralForm(u.sessions, lang)}`, { n: u.sessions })}</span>}
    </span>
  );
  const actions = (u: AccountRow) => (
    <span className={cn('flex justify-end', busy === u.id && 'pointer-events-none opacity-50')} aria-busy={busy === u.id || undefined}>
      <ActionMenu label={t('actionsFor', { name: u.name })} items={menu(u)} />
    </span>
  );

  const loaded = state.data !== null && !state.error;
  return (
    <div className="space-y-5">
      <Panel
        lead
        flush
        title={ts('sec_access')}
        description={t('accounts_d')}
        actions={
          <Button size="sm" shape="rounded" icon={<UserPlus className="h-4 w-4" />} disabled={!loaded} onClick={() => openEditor(null)}>
            {t('invite')}
          </Button>
        }
      >
        <LoadState state={state} />
        {loaded && (
          <>
            <div className="px-5 py-2.5 text-[12.5px] text-muted sm:px-6">{t('accountsCount', { n: accounts.length, active: accounts.filter((u) => u.active && u.hasPassword).length })}</div>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-[13.5px]">
                <thead>
                  <tr>
                    {[t('colPerson'), t('role'), t('colMember'), t('col2fa'), t('colLast'), t('colState'), ''].map((h, i) => (
                      <th key={i} className="whitespace-nowrap border-y border-line bg-[#f7f7f7] px-3 py-2.5 text-[12.5px] font-semibold text-muted first:pl-6 last:pr-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-[#fafafa]">
                      <td className="max-w-[260px] border-b border-line/60 py-2.5 pl-6 pr-3">{who(u)}</td>
                      <td className="border-b border-line/60 px-3 py-2.5 font-medium text-ink">{l(ROLE_META[u.role]?.name)}</td>
                      <td className="border-b border-line/60 px-3 py-2.5 text-[13px]">{member(u)}</td>
                      <td className="border-b border-line/60 px-3 py-2.5">{twoStep(u)}</td>
                      <td className="whitespace-nowrap border-b border-line/60 px-3 py-2.5 text-[12.5px] text-muted">{lastSeen(u)}</td>
                      <td className="max-w-[230px] border-b border-line/60 px-3 py-2.5">{status(u)}</td>
                      <td className="border-b border-line/60 py-2.5 pl-3 pr-5">{actions(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile list */}
            <ul className="divide-y divide-line/60 border-t border-line md:hidden">
              {accounts.map((u) => (
                <li key={u.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    {who(u)}
                    {actions(u)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-11 text-[12.5px]">
                    <span className="font-semibold text-ink">{l(ROLE_META[u.role]?.name)}</span>
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      {t('col2fa')}: {twoStep(u)}
                    </span>
                  </div>
                  <div className="mt-1.5 pl-11">{status(u)}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-11 text-[12.5px] text-muted">
                    <span>
                      {t('colLast')}: {u.lastLoginAt ? timeAgo(u.lastLoginAt, lang) : t('never')}
                    </span>
                    {u.sessions > 0 && <span>{t(`devices_${pluralForm(u.sessions, lang)}`, { n: u.sessions })}</span>}
                    {u.staffId && teamById.get(u.staffId) && (
                      <span>
                        {t('colMember')}: {teamById.get(u.staffId)!.name}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {loaded && (
        <>
          <SessionsPanel key={`s${stamp}`} scope="all" />
          <AuthEventsPanel key={`e${stamp}`} scope="all" people={accounts} />
        </>
      )}

      {editor && (
        <AccountModal
          key={editor.key}
          open={editorOpen}
          account={editor.account}
          accounts={accounts}
          onClose={() => setEditorOpen(false)}
          onSaved={(u) => {
            put(u);
            toast.success(t('accountSaved'), { description: u.name });
          }}
          onInvited={(u, shown) => {
            put(u);
            setLink(shown);
          }}
        />
      )}
      <LinkModal link={link} onClose={() => setLink(null)} />
    </div>
  );
}
