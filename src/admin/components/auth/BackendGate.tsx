// Server-backed build: what stands between a signed-in staff member and the CMS.
//  - the shop's data could not be fetched → "try again" (never the sample data bundled with the site);
//  - the server is empty (first run) → the owner chooses what the shop starts with.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { DatabaseBackup, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDict } from '@/i18n';
import { ApiError } from '@/lib/backend/api';
import { useBackend } from '@/lib/backend/mode';
import { signOut, useSession } from '@/lib/backend/session';
import { cleanStart, readBackup, type ShopImport } from '@/lib/backend/setup';
import { AuthShell } from './AuthShell';
import { AU } from './strings';

export default function BackendGate({ children }: { children: ReactNode }) {
  const failed = useBackend((s) => s.failed);
  const ready = useBackend((s) => s.ready);
  if (failed) return <LoadFailed />;
  if (!ready) return <ShopSetup />;
  return <>{children}</>;
}

function LoadFailed() {
  const ta = useDict(AU, 'admin');
  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold tracking-tight">{ta('loadFailTitle')}</h1>
      <p className="mt-3 leading-relaxed text-muted" role="alert">
        {ta('loadFailText')}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button shape="rounded" onClick={() => window.location.reload()}>
          {ta('retry')}
        </Button>
        <Button shape="rounded" variant="outline" onClick={() => void signOut()}>
          {ta('signOut')}
        </Button>
      </div>
    </AuthShell>
  );
}

function ShopSetup() {
  const ta = useDict(AU, 'admin');
  const role = useSession((s) => s.user?.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const clean = useMemo(() => (role === 'owner' ? cleanStart() : null), [role]);

  const send = async (data: ShopImport) => {
    setBusy(true);
    setError('');
    try {
      const { importShop } = await import('@/lib/backend/sync');
      await importShop({ mode: 'init', ...data });
      // ready is now true: the gate opens the CMS
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === 'not_empty') {
        setError(ta('importNotEmpty'));
        window.setTimeout(() => window.location.reload(), 1500);
      } else setError(ta(err instanceof ApiError && err.status === 413 ? 'importTooBig' : 'importFailed'));
    }
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const data = readBackup(await f.text());
    if (data === 'not_json') return setError(ta('backupNotJson'));
    if (data === 'not_backup') return setError(ta('backupNotBackup'));
    void send(data);
  };

  if (role !== 'owner' || !clean) {
    return (
      <AuthShell>
        <h1 className="text-3xl font-extrabold tracking-tight">{ta('shopTitle')}</h1>
        <p className="mt-3 leading-relaxed text-muted">{ta('shopNotOwner')}</p>
        <Button className="mt-6" shape="rounded" variant="outline" onClick={() => void signOut()}>
          {ta('signOut')}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold tracking-tight">{ta('shopTitle')}</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{ta('shopText')}</p>
      <div className="mt-7 space-y-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <PackageCheck className="h-4 w-4 text-brand-600" /> {ta('cleanTitle')}
          </div>
          <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{ta('cleanText', { n: clean.lists.products?.length ?? 0 })}</p>
          <Button className="mt-3 w-full" shape="rounded" loading={busy} onClick={() => void send(clean)}>
            {ta('cleanDo')}
          </Button>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <DatabaseBackup className="h-4 w-4 text-brand-600" /> {ta('backupTitle')}
          </div>
          <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{ta('backupText')}</p>
          <input
            ref={file}
            id="shop-backup-file"
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button className="mt-3 w-full" shape="rounded" variant="outline" disabled={busy} onClick={() => file.current?.click()}>
            {ta('backupDo')}
          </Button>
        </div>
      </div>
      <p className="mt-4 min-h-5 text-[13.5px] leading-snug text-red-700" role="alert">
        {error}
      </p>
      {busy && (
        <p className="text-[13.5px] text-muted" role="status">
          {ta('importing')}
        </p>
      )}
    </AuthShell>
  );
}
