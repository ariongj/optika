// Settings → Data in the server-backed build: the shop's data lives on the server, so this section is about backups —
// download one, or put one back. (The demo build shows DemoDataSection: browser storage, demo reset.)
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Download, ShieldAlert, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { confirmDialog } from '@/admin/components/kit';
import { defineDict, useDict, useLang } from '@/i18n';
import { useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { num } from '@/lib/format';
import type { Settings } from '@/lib/types';
import { cn, download } from '@/lib/utils';
import { api, ApiError } from '@/lib/backend/api';
import { readBackup } from '@/lib/backend/setup';
import { S } from './strings';
import { Block, Gate, Panel } from './ui';

const D = defineDict({
  me: {
    products: 'Proizvodi',
    orders: 'Narudžbe',
    inquiries: 'Upiti',
    bookings: 'Termini',
    where: 'Podaci prodavnice su na serveru. Ovaj pregledač ih ne čuva.',
    backup_t: 'Preuzmi rezervnu kopiju',
    backup_d: 'Jedan .json fajl sa katalogom, sadržajem, narudžbama, upitima, terminima, spiskom naloga (bez lozinki) i istorijom saglasnosti. Sadrži lične podatke kupaca: čuvajte ga na sigurnom mestu i ne šaljite e-mailom.',
    backup: 'Preuzmi',
    backupDone: 'Rezervna kopija je preuzeta',
    backupFail: 'Rezervna kopija nije preuzeta. Pokušajte ponovo.',
    restore_t: 'Vrati iz rezervne kopije',
    restore_d: 'Zamenjuje katalog, sadržaj, narudžbe, upite i termine na serveru onim iz fajla. Nalozi osoblja i istorija saglasnosti ostaju kakvi jesu.',
    restore: 'Izaberi fajl',
    ownerOnly: 'Samo vlasnik',
    notJson: 'Fajl nije ispravan JSON.',
    notBackup: 'Fajl nije rezervna kopija ove prodavnice.',
    confirmTitle: 'Zameniti podatke prodavnice?',
    confirmText: 'Sve što je sada na serveru (proizvodi: {products}, narudžbe: {orders}) biće zamenjeno sadržajem fajla „{file}“ (proizvodi: {fp}, narudžbe: {fo}). Ovo se ne može poništiti. Prvo preuzmite rezervnu kopiju sadašnjeg stanja.',
    confirmBtn: 'Zameni podatke',
    restoreDone: 'Podaci su vraćeni iz kopije',
    restoreFail: 'Vraćanje nije uspelo. Na serveru ništa nije promenjeno.',
    tooBig: 'Fajl je prevelik za server.',
  },
  sq: {
    products: 'Produkte',
    orders: 'Porosi',
    inquiries: 'Kërkesa',
    bookings: 'Termine',
    where: 'Të dhënat e dyqanit janë në server. Ky shfletues nuk i ruan.',
    backup_t: 'Shkarko kopjen rezervë',
    backup_d: 'Një skedar .json me katalogun, përmbajtjen, porositë, kërkesat, terminet, listën e llogarive (pa fjalëkalime) dhe historinë e pëlqimeve. Përmban të dhëna personale të klientëve: ruajeni në vend të sigurt dhe mos e dërgoni me e-mail.',
    backup: 'Shkarko',
    backupDone: 'Kopja rezervë u shkarkua',
    backupFail: 'Kopja rezervë nuk u shkarkua. Provoni përsëri.',
    restore_t: 'Rikthe nga kopja rezervë',
    restore_d: 'Zëvendëson katalogun, përmbajtjen, porositë, kërkesat dhe terminet në server me ato të skedarit. Llogaritë e stafit dhe historia e pëlqimeve mbeten siç janë.',
    restore: 'Zgjidh skedarin',
    ownerOnly: 'Vetëm pronari',
    notJson: 'Skedari nuk është JSON i vlefshëm.',
    notBackup: 'Skedari nuk është kopje rezervë e këtij dyqani.',
    confirmTitle: 'Të zëvendësohen të dhënat e dyqanit?',
    confirmText: 'Gjithçka që është tani në server (produkte: {products}, porosi: {orders}) do të zëvendësohet me përmbajtjen e skedarit „{file}“ (produkte: {fp}, porosi: {fo}). Kjo nuk mund të zhbëhet. Shkarkoni më parë një kopje të gjendjes së tanishme.',
    confirmBtn: 'Zëvendëso të dhënat',
    restoreDone: 'Të dhënat u rikthyen nga kopja',
    restoreFail: 'Rikthimi nuk u krye. Në server nuk ndryshoi asgjë.',
    tooBig: 'Skedari është shumë i madh për serverin.',
  },
  en: {
    products: 'Products',
    orders: 'Orders',
    inquiries: 'Requests',
    bookings: 'Appointments',
    where: 'The shop data is on the server. This browser does not keep it.',
    backup_t: 'Download a backup',
    backup_d: 'One .json file with the catalogue, content, orders, requests, appointments, the list of accounts (no passwords) and the consent history. It contains customers’ personal data: keep it somewhere safe and do not send it by e-mail.',
    backup: 'Download',
    backupDone: 'Backup downloaded',
    backupFail: 'The backup was not downloaded. Try again.',
    restore_t: 'Restore from a backup',
    restore_d: 'Replaces the catalogue, content, orders, requests and appointments on the server with those in the file. Staff accounts and the consent history stay as they are.',
    restore: 'Choose the file',
    ownerOnly: 'Owner only',
    notJson: 'The file is not valid JSON.',
    notBackup: 'The file is not a backup of this shop.',
    confirmTitle: 'Replace the shop data?',
    confirmText: 'Everything on the server now (products: {products}, orders: {orders}) will be replaced by the contents of "{file}" (products: {fp}, orders: {fo}). This cannot be undone. Download a backup of the current state first.',
    confirmBtn: 'Replace the data',
    restoreDone: 'The data was restored from the backup',
    restoreFail: 'The restore did not go through. Nothing changed on the server.',
    tooBig: 'The file is too large for the server.',
  },
});

function Row({ icon, title, text, action, danger }: { icon: ReactNode; title: ReactNode; text: ReactNode; action: ReactNode; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset', danger ? 'bg-red-50 text-red-600 ring-red-600/10' : 'bg-[#f3f3f3] text-ink-soft ring-black/[0.05]')}>{icon}</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-ink">{title}</div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{text}</p>
        </div>
      </div>
      <div className="shrink-0 pl-12 sm:pl-0">{action}</div>
    </div>
  );
}

export function ServerDataSection({ onReplaced }: { onReplaced: (settings: Settings) => void }) {
  const t = useDict(D, 'admin');
  const ts = useDict(S, 'admin');
  const lang = useLang('admin');
  const owner = useUi((s) => s.adminRole) === 'owner';
  const products = useDb((st) => st.products.length);
  const orders = useDb((st) => st.orders.length);
  const inquiries = useDb((st) => st.inquiries.length);
  const bookings = useDb((st) => st.bookings.length);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'' | 'backup' | 'restore'>('');

  const stats = [
    { label: t('products'), value: products },
    { label: t('orders'), value: orders },
    { label: t('inquiries'), value: inquiries },
    { label: t('bookings'), value: bookings },
  ];

  const onBackup = async () => {
    if (busy) return;
    setBusy('backup');
    try {
      const { flush } = await import('@/lib/backend/sync');
      await flush(); // the backup should hold what is on screen
      const data = await api<Record<string, unknown>>('admin/export');
      download(`miftari-vision-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
      toast.success(t('backupDone'));
    } catch {
      toast.error(t('backupFail'));
    }
    setBusy('');
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;
    const data = readBackup(await file.text());
    if (data === 'not_json') return void toast.error(t('notJson'));
    if (data === 'not_backup') return void toast.error(t('notBackup'));
    const ok = await confirmDialog({
      title: t('confirmTitle'),
      text: t('confirmText', { products: num(products, lang), orders: num(orders, lang), file: file.name, fp: num(data.lists.products?.length ?? 0, lang), fo: num(data.lists.orders?.length ?? 0, lang) }),
      confirmLabel: t('confirmBtn'),
      danger: true,
    });
    if (!ok) return;
    setBusy('restore');
    try {
      const { importShop } = await import('@/lib/backend/sync');
      await importShop({ mode: 'replace', confirm: 'REPLACE', ...data });
      onReplaced(useDb.getState().settings);
      toast.success(t('restoreDone'));
    } catch (err) {
      toast.error(t(err instanceof ApiError && err.status === 413 ? 'tooBig' : 'restoreFail'));
    }
    setBusy('');
  };

  return (
    <Panel lead title={ts('sec_data_b')} description={t('where')}>
      <Block>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((x) => (
            <div key={x.label} className="rounded-lg border border-line px-4 py-3">
              <div className="text-[22px] font-bold tabular-nums tracking-tight text-ink">{num(x.value, lang)}</div>
              <div className="text-[12px] font-medium text-muted">{x.label}</div>
            </div>
          ))}
        </div>
      </Block>
      <Block>
        <div className="divide-y divide-line/70 rounded-lg border border-line">
          <Row
            icon={<Download className="h-[17px] w-[17px]" />}
            title={t('backup_t')}
            text={t('backup_d')}
            action={
              <Gate allowed={owner} reason={t('ownerOnly')}>
                <Button variant="outline" size="sm" shape="rounded" icon={<Download className="h-4 w-4" />} disabled={!owner || busy === 'restore'} loading={busy === 'backup'} onClick={() => void onBackup()}>
                  {t('backup')}
                </Button>
              </Gate>
            }
          />
          <Row
            danger
            icon={<ShieldAlert className="h-[17px] w-[17px]" />}
            title={t('restore_t')}
            text={t('restore_d')}
            action={
              <Gate allowed={owner} reason={t('ownerOnly')}>
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e)} />
                <Button variant="outline" size="sm" shape="rounded" icon={<Upload className="h-4 w-4" />} disabled={!owner || busy === 'backup'} loading={busy === 'restore'} onClick={() => fileRef.current?.click()}>
                  {t('restore')}
                </Button>
              </Gate>
            }
          />
        </div>
      </Block>
    </Panel>
  );
}
