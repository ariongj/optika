// Staff data in the server-backed build. The CMS keeps working on the same in-memory stores as the demo (useDb and
// the customer store); this engine
//  - loads the full shop from the server when staff sign in (admin/snapshot);
//  - watches the stores and sends what changed, document by document, a moment after each edit (admin/sync) — the
//    server merges field by field with what others changed meanwhile and refuses what the role may not do;
//  - fetches what others changed (admin/changes) every few seconds and when the tab comes back to the front;
//  - shares edits instantly with this browser's other staff tabs (e.g. the CMS preview frame).
import { create } from 'zustand';
import { toast } from 'sonner';
import type { Db } from '@/lib/types';
import { DATA_KEYS, useDb } from '@/store/db';
import { useCustomerStore, type CustomerProfile, type ManualCustomer } from '@/admin/components/customers/store';
import { useUi } from '@/store/ui';
import { api, ApiError, isTransient } from './api';
import { useBackend } from './mode';

/* ------------------------------------------------------------------ */
/* What is synced                                                      */
/* ------------------------------------------------------------------ */

const SINGLES = ['settings', 'home', 'homeDraft', 'homeHistory', 'seededAt', 'version'] as const satisfies readonly (keyof Db)[];
type SingleKey = (typeof SINGLES)[number];
const LISTS = DATA_KEYS.filter((k) => !(SINGLES as readonly string[]).includes(k)) as Exclude<keyof Db, SingleKey>[];
/** Append-only logs: the browser trimming its copy to the newest N is not a deletion. */
const APPEND = new Set<string>(['audit', 'movements']);
/** Customer layer (admin/components/customers/store) */
const CRM_PROFILES = 'crm_profiles';
const CRM_MANUAL = 'crm_manual';
const CRM_SINGLES = { merges: 'crm_merges', dismissed: 'crm_dismissed' } as const;
const SINGLE = '$';

type Doc = Record<string, unknown>;
type SnapshotDoc = [id: string, rev: number, pos: number, data: unknown];
interface Snapshot {
  rev: number;
  lists: Record<string, SnapshotDoc[]>;
  singles: Record<string, [rev: number, data: unknown]>;
}
type ChangeDoc = [col: string, id: string, rev: number, pos: number, deleted: 0 | 1, data: unknown];

interface Base {
  rev: number;
  pos: number;
  json: string;
  data: unknown;
}
interface Op {
  col: string;
  id: string;
  data: unknown;
  pos?: number;
}
interface Result {
  col: string;
  id: string;
  status: 'ok' | 'merged' | 'rejected' | 'ignored';
  rev?: number;
  data?: unknown;
  reason?: string;
  clash?: string[];
}

const key = (col: string, id: string) => `${col}\u0001${id}`;
const bases = new Map<string, Base>();
const queue = new Map<string, Op>();
const inflight = new Map<string, Op>();
let cursor = 0;
let applying = 0;
let started = false;

/* ------------------------------------------------------------------ */
/* Status (CMS header: "Saved" / "Saving…" / "Offline — will retry")   */
/* ------------------------------------------------------------------ */

export interface SyncStatus {
  state: 'idle' | 'saving' | 'offline' | 'error';
  pending: number;
  savedAt: number | null;
}
export const useSyncStatus = create<SyncStatus>(() => ({ state: 'idle', pending: 0, savedAt: null }));
const status = (patch: Partial<SyncStatus>) => useSyncStatus.setState({ pending: queue.size + inflight.size, ...patch });

/* ------------------------------------------------------------------ */
/* Store ⇄ documents                                                   */
/* ------------------------------------------------------------------ */

const idOf = (col: string, item: unknown): string => {
  const o = item as Doc;
  const v = col === CRM_MANUAL ? o?.key : o?.id;
  return typeof v === 'string' ? v : '';
};

function withApplying<T>(fn: () => T): T {
  applying++;
  try {
    return fn();
  } finally {
    applying--;
  }
}

function setBase(col: string, id: string, rev: number, pos: number, data: unknown) {
  bases.set(key(col, id), { rev, pos, json: JSON.stringify(data), data });
}

/** Load the whole shop (on sign-in). */
function applySnapshot(snap: Snapshot) {
  bases.clear();
  const patch: Record<string, unknown> = {};
  for (const col of LISTS) {
    const docs = snap.lists[col] ?? [];
    patch[col] = docs.map(([id, rev, pos, data]) => {
      setBase(col, id, rev, pos, data);
      return data;
    });
  }
  for (const k of SINGLES) {
    const d = snap.singles[k];
    if (d) {
      patch[k] = d[1];
      setBase(SINGLE, k, d[0], 0, d[1]);
    } else if (k === 'homeDraft') patch[k] = null;
    else if (k === 'homeHistory') patch[k] = [];
  }
  const profiles: Record<string, CustomerProfile> = {};
  for (const [id, rev, pos, data] of snap.lists[CRM_PROFILES] ?? []) {
    profiles[id] = data as CustomerProfile;
    setBase(CRM_PROFILES, id, rev, pos, data);
  }
  const manual = (snap.lists[CRM_MANUAL] ?? []).map(([id, rev, pos, data]) => {
    setBase(CRM_MANUAL, id, rev, pos, data);
    return data as ManualCustomer;
  });
  const crmSingle = (name: string, fallback: unknown) => {
    const d = snap.singles[name];
    if (d) setBase(SINGLE, name, d[0], 0, d[1]);
    return d ? d[1] : fallback;
  };
  withApplying(() => {
    useDb.setState(patch as Partial<Db>);
    useCustomerStore.setState({
      // bound to the shop's data: the demo profiles are never generated over real ones
      seed: (patch.seededAt as string | undefined) ?? useDb.getState().seededAt,
      profiles,
      manual,
      merges: (crmSingle(CRM_SINGLES.merges, {}) as Record<string, string>) ?? {},
      dismissed: (crmSingle(CRM_SINGLES.dismissed, []) as string[]) ?? [],
    });
  });
  cursor = snap.rev;
}

/** Positions for a list after a local change: keep known ones while they stay in order, fill in the rest. */
function positions(col: string, items: unknown[]): (number | undefined)[] {
  const known = items.map((it) => bases.get(key(col, idOf(col, it)))?.pos ?? queue.get(key(col, idOf(col, it)))?.pos);
  const out: (number | undefined)[] = new Array(items.length);
  let last = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const p = known[i];
    if (p !== undefined && p > last) {
      // only keep it if something later can still fit after it (otherwise the list is renumbered below)
      out[i] = p;
      last = p;
      continue;
    }
    let next: number | undefined;
    for (let j = i + 1; j < items.length; j++) {
      const q = known[j];
      if (q !== undefined && q > last) {
        next = q;
        break;
      }
    }
    const np = next === undefined ? (last === -Infinity ? 0 : last + 1) : last === -Infinity ? next - 1 : (last + next) / 2;
    if (next !== undefined && last !== -Infinity && next - last < 1e-7) return items.map((_, k) => k); // gaps used up: renumber
    out[i] = np;
    last = np;
  }
  return out;
}

function enqueue(col: string, id: string, data: unknown, pos?: number) {
  if (!id) return;
  const k = key(col, id);
  const base = bases.get(k);
  const json = data === null ? 'null' : JSON.stringify(data);
  const posSame = pos === undefined || base?.pos === pos;
  if (base && base.json === json && posSame) {
    queue.delete(k);
    return;
  }
  if (!base && data === null) {
    queue.delete(k);
    return;
  }
  queue.set(k, { col, id, data, ...(pos !== undefined ? { pos } : {}) });
}

function diffList(col: string, prev: unknown[] | undefined, next: unknown[] | undefined) {
  const before = new Map<string, unknown>();
  for (const it of prev ?? []) before.set(idOf(col, it), it);
  const items = next ?? [];
  const pos = positions(col, items);
  const seen = new Set<string>();
  items.forEach((it, i) => {
    const id = idOf(col, it);
    if (!id || seen.has(id)) return;
    seen.add(id);
    const p = pos[i];
    const base = bases.get(key(col, id));
    if (before.get(id) !== it || base?.pos !== p) enqueue(col, id, it, p);
  });
  if (APPEND.has(col)) return;
  for (const [id] of before) if (id && !seen.has(id)) enqueue(col, id, null);
}

function diffSingle(name: string, prev: unknown, next: unknown) {
  if (prev === next) return;
  enqueue(SINGLE, name, next === undefined ? null : next, 0);
}

function onDbChange(state: Db, prev: Db) {
  if (applying || !started) return;
  for (const col of LISTS) if (state[col] !== prev[col]) diffList(col, prev[col] as unknown[], state[col] as unknown[]);
  for (const k of SINGLES) if (state[k] !== prev[k]) diffSingle(k, prev[k], state[k]);
  schedule();
}

type CrmState = ReturnType<typeof useCustomerStore.getState>;
function onCrmChange(state: CrmState, prev: CrmState) {
  if (applying || !started) return;
  if (state.profiles !== prev.profiles) {
    for (const [id, p] of Object.entries(state.profiles)) if (prev.profiles[id] !== p) enqueue(CRM_PROFILES, id, p);
    for (const id of Object.keys(prev.profiles)) if (!(id in state.profiles)) enqueue(CRM_PROFILES, id, null);
  }
  if (state.manual !== prev.manual) diffList(CRM_MANUAL, prev.manual, state.manual);
  if (state.merges !== prev.merges) diffSingle(CRM_SINGLES.merges, prev.merges, state.merges);
  if (state.dismissed !== prev.dismissed) diffSingle(CRM_SINGLES.dismissed, prev.dismissed, state.dismissed);
  schedule();
}

/* ------------------------------------------------------------------ */
/* Applying the server's version (merges, refusals, others' changes)   */
/* ------------------------------------------------------------------ */

/** Put documents from the server into the stores (several at once, one render). */
function applyDocs(docs: { col: string; id: string; rev: number; pos?: number; data: unknown }[], live = false) {
  if (!docs.length) return;
  const lists = new Map<string, Map<string, { data: unknown; pos?: number }>>();
  const singles: Record<string, unknown> = {};
  const crmSingles: Record<string, unknown> = {};
  for (const d of docs) {
    if (!live) {
      const prev = bases.get(key(d.col, d.id));
      setBase(d.col, d.id, d.rev, d.pos ?? prev?.pos ?? 0, d.data);
    }
    if (d.col === SINGLE) {
      if (d.id === CRM_SINGLES.merges || d.id === CRM_SINGLES.dismissed) crmSingles[d.id] = d.data;
      else singles[d.id] = d.data;
    } else {
      if (!lists.has(d.col)) lists.set(d.col, new Map());
      lists.get(d.col)!.set(d.id, { data: d.data, pos: d.pos });
    }
  }
  withApplying(() => {
    const db = useDb.getState();
    const patch: Record<string, unknown> = { ...singles };
    for (const [col, changed] of lists) {
      if (col === CRM_PROFILES || col === CRM_MANUAL) continue;
      if (!(LISTS as string[]).includes(col)) continue;
      patch[col] = mergeList(col, (db as unknown as Record<string, unknown[]>)[col] ?? [], changed);
    }
    if (Object.keys(patch).length) useDb.setState(patch as Partial<Db>);
    const crm = useCustomerStore.getState();
    const cpatch: Partial<CrmState> = {};
    const prof = lists.get(CRM_PROFILES);
    if (prof) {
      const profiles = { ...crm.profiles };
      for (const [id, { data }] of prof) {
        if (data === null) delete profiles[id];
        else profiles[id] = data as CustomerProfile;
      }
      cpatch.profiles = profiles;
    }
    const man = lists.get(CRM_MANUAL);
    if (man) cpatch.manual = mergeList(CRM_MANUAL, crm.manual, man) as ManualCustomer[];
    if (CRM_SINGLES.merges in crmSingles) cpatch.merges = (crmSingles[CRM_SINGLES.merges] as Record<string, string>) ?? {};
    if (CRM_SINGLES.dismissed in crmSingles) cpatch.dismissed = (crmSingles[CRM_SINGLES.dismissed] as string[]) ?? [];
    if (Object.keys(cpatch).length) useCustomerStore.setState(cpatch);
  });
}

/** Replace / insert / remove items by id; new items go where their position says. */
function mergeList(col: string, current: unknown[], changed: Map<string, { data: unknown; pos?: number }>): unknown[] {
  const out: unknown[] = [];
  const done = new Set<string>();
  for (const it of current) {
    const id = idOf(col, it);
    const c = changed.get(id);
    if (!c) out.push(it);
    else if (c.data !== null) out.push(c.data);
    done.add(id);
  }
  const added = [...changed].filter(([id, c]) => !done.has(id) && c.data !== null);
  if (!added.length) return out;
  for (const [id, c] of added) {
    const p = c.pos ?? bases.get(key(col, id))?.pos ?? Infinity;
    let at = out.length;
    for (let i = 0; i < out.length; i++) {
      const q = bases.get(key(col, idOf(col, out[i])))?.pos;
      if (q !== undefined && q > p) {
        at = i;
        break;
      }
    }
    out.splice(at, 0, c.data);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

let timer: number | undefined;
let backoff = 0;
let retryAt = 0;
let sending = false;

function schedule(delay = 450) {
  if (!queue.size) return;
  status({ state: useSyncStatus.getState().state === 'offline' ? 'offline' : 'saving' });
  if (sending) return; // flush() looks again when its batch is answered
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void flush(), Math.max(delay, retryAt - Date.now()));
}

const REASON: Record<string, string> = {
  forbidden: 'Your role may not change this.',
  publish_needed: 'Publishing needs a role that may publish.',
  last_owner: 'The shop must keep an owner.',
  too_large: 'Too large to save (pictures should be uploaded, not pasted).',
  unknown_collection: 'This kind of data cannot be saved.',
  invalid: 'Not saved: the data was not valid.',
};

/** Send what is waiting (in batches) and apply the answers. */
export async function flush(): Promise<void> {
  if (sending || !queue.size) return;
  sending = true;
  window.clearTimeout(timer);
  const batch = [...queue.values()].slice(0, 150);
  for (const op of batch) {
    const k = key(op.col, op.id);
    queue.delete(k);
    inflight.set(k, op);
  }
  status({ state: 'saving' });
  const ops = batch.map((op) => {
    const base = bases.get(key(op.col, op.id));
    return { col: op.col, id: op.id, base: base?.rev ?? 0, ...(base ? { prev: base.data } : {}), data: op.data, ...(op.pos !== undefined ? { pos: op.pos } : {}) };
  });
  let again = 0;
  try {
    const res = await api<{ results: Result[] }>('admin/sync', { body: { ops } });
    backoff = 0;
    retryAt = 0;
    const fromServer: { col: string; id: string; rev: number; pos?: number; data: unknown }[] = [];
    const final: Op[] = [];
    const refused: string[] = [];
    res.results.forEach((r, i) => {
      const op = batch[i];
      if (!op || r.col !== op.col || r.id !== op.id) return;
      const k = key(op.col, op.id);
      inflight.delete(k);
      const newer = queue.has(k); // edited again while this was on its way: that edit goes next, from this version
      if (r.status === 'ok' || r.status === 'ignored') {
        if (op.data === null) bases.delete(k);
        else setBase(op.col, op.id, r.rev ?? bases.get(k)?.rev ?? 0, op.pos ?? bases.get(k)?.pos ?? 0, op.data);
        final.push(op);
      } else if (r.status === 'merged') {
        if (newer) setBase(op.col, op.id, r.rev ?? 0, op.pos ?? bases.get(k)?.pos ?? 0, r.data ?? null);
        else fromServer.push({ col: op.col, id: op.id, rev: r.rev ?? 0, pos: op.pos, data: r.data ?? null });
        final.push({ ...op, data: r.data ?? null });
        if (r.clash?.length) toast.message('Someone else changed the same item at the same time — your version was kept.', { id: 'mv-clash' });
      } else {
        // refused: back to the server's version (a newer local edit of it is dropped too)
        queue.delete(k);
        fromServer.push({ col: op.col, id: op.id, rev: r.rev ?? 0, data: r.data ?? null });
        final.push({ col: op.col, id: op.id, data: r.data ?? null });
        refused.push(REASON[r.reason ?? ''] ?? 'A change was not saved.');
      }
    });
    applyDocs(fromServer);
    broadcast(final);
    if (refused.length) toast.error([...new Set(refused)].join(' '), { id: 'mv-refused' });
    status({ state: queue.size ? 'saving' : 'idle', savedAt: Date.now() });
  } catch (err) {
    // not sent: back in the queue, unless a newer edit of the same item is already waiting
    for (const op of batch) {
      const k = key(op.col, op.id);
      inflight.delete(k);
      if (!queue.has(k)) queue.set(k, op);
    }
    if (err instanceof ApiError && err.status === 401) status({ state: 'error' });
    else if (isTransient(err)) {
      backoff = Math.min(60_000, backoff ? backoff * 2 : 2000);
      retryAt = Date.now() + backoff;
      again = backoff;
      status({ state: 'offline' });
    } else {
      status({ state: 'error' });
      toast.error('Changes could not be saved.', { id: 'mv-sync-error' });
    }
  } finally {
    sending = false;
  }
  if (again) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void flush(), again);
  } else if (queue.size && useSyncStatus.getState().state !== 'error') schedule(0);
}

/* ------------------------------------------------------------------ */
/* Others' changes                                                     */
/* ------------------------------------------------------------------ */

let polling: number | undefined;
let pullBusy = false;

/** Fetch documents changed on the server since the last look. */
export async function pull(): Promise<void> {
  if (pullBusy || !started) return;
  pullBusy = true;
  try {
    for (let page = 0; page < 20; page++) {
      const r = await api<{ rev: number; more: boolean; docs: ChangeDoc[] }>(`admin/changes?since=${cursor}`);
      const docs = r.docs
        .filter(([col, id, rev]) => {
          const k = key(col, id);
          // ours already (or older), or edited here and not yet saved (the server merges when it arrives)
          return (bases.get(k)?.rev ?? -1) < rev && !queue.has(k) && !inflight.has(k);
        })
        .map(([col, id, rev, pos, deleted, data]) => ({ col, id, rev, pos, data: deleted ? null : data }));
      applyDocs(docs);
      cursor = Math.max(cursor, r.rev);
      if (!r.more) break;
    }
    if (useSyncStatus.getState().state === 'offline' && !queue.size) status({ state: 'idle' });
  } catch (err) {
    if (isTransient(err)) status({ state: 'offline' });
  } finally {
    pullBusy = false;
  }
}

/* ------------------------------------------------------------------ */
/* This browser's other staff tabs                                     */
/* ------------------------------------------------------------------ */

let channel: BroadcastChannel | null = null;
function broadcast(ops: Op[]) {
  try {
    channel?.postMessage({ type: 'docs', docs: ops.map((o) => ({ col: o.col, id: o.id, data: o.data, pos: o.pos })) });
  } catch {
    /* not cloneable / closed */
  }
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

/** Load the whole shop for the signed-in staff member and keep it in step with the server. */
export async function startStaffData(): Promise<void> {
  useBackend.setState({ mode: 'staff' });
  const snap = await api<Snapshot & { ok: true }>('admin/snapshot');
  applySnapshot(snap);
  const ready = !!snap.singles.settings;
  useBackend.setState({ loaded: true, ready });
  if (started) return;
  started = true;
  useDb.subscribe(onDbChange);
  useCustomerStore.subscribe(onCrmChange);
  polling = window.setInterval(() => {
    if (document.visibilityState === 'visible') void pull();
  }, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pull();
    else void flush();
  });
  window.addEventListener('online', () => {
    void flush();
    void pull();
  });
  // leaving with unsaved edits: send them, and ask the browser to warn
  window.addEventListener('beforeunload', (e) => {
    if (!queue.size && !inflight.size) return;
    void flush();
    e.preventDefault();
  });
  try {
    channel = new BroadcastChannel('mv-live');
    channel.onmessage = (e: MessageEvent<{ type: string; docs: { col: string; id: string; data: unknown; pos?: number }[] }>) => {
      if (e.data?.type !== 'docs') return;
      // shown at once; the server's numbered version follows with the next pull
      applyDocs(
        e.data.docs.filter((d) => !queue.has(key(d.col, d.id)) && !inflight.has(key(d.col, d.id))).map((d) => ({ ...d, rev: 0 })),
        true,
      );
    };
  } catch {
    channel = null;
  }
}

/** Stop syncing (sign-out). */
export function stopStaffData() {
  window.clearInterval(polling);
  channel?.close();
  channel = null;
  started = false;
}

/** Anything not yet on the server? (sign-out asks first) */
export const hasUnsaved = () => queue.size > 0 || inflight.size > 0;

/** Replace the whole shop on the server (first setup / restoring a backup), then reload it here. */
export async function importShop(body: { mode: 'init' | 'replace'; confirm?: 'REPLACE'; lists: Record<string, unknown[]>; singles: Record<string, unknown>; crm?: unknown }) {
  await flush();
  const r = await api<{ count: number; rev: number }>('admin/import', { body });
  const snap = await api<Snapshot & { ok: true }>('admin/snapshot');
  queue.clear();
  applySnapshot(snap);
  useBackend.setState({ loaded: true, ready: !!snap.singles.settings });
  return r;
}

/** Signed-in role (for the CMS), re-read after the session check. */
export const currentRole = () => useUi.getState().adminRole;
