// Customers page (server-backed build only): download the server's subscriber list for one channel — the latest
// decision per person, with the unsubscribe link each newsletter must carry. The server notes every export.
import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { cx } from '@/admin/components/customers/i18n';
import { ActionMenu, CHANNEL_ICON, Gate } from '@/admin/components/customers/parts';
import { CHANNELS } from '@/admin/components/customers/store';
import { Button } from '@/components/ui/Button';
import { useDict } from '@/i18n';
import { saveBlob, subscribersCsv, type ConsentChannel } from '@/lib/backend/staff';
import { errorText } from './shared';
import { AX } from './strings';

export function SubscribersExport({ allowed, noPermission }: { allowed: boolean; noPermission: string }) {
  const t = useDict(AX, 'admin');
  const tx = useDict(cx, 'admin');
  const [busy, setBusy] = useState(false);

  const run = async (channel: ConsentChannel) => {
    if (busy) return;
    setBusy(true);
    try {
      const f = await subscribersCsv(channel);
      saveBlob(f.blob, f.filename);
      toast.success(t('subsDone'), { description: t('subsDoneText') });
    } catch (err) {
      toast.error(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <Gate allowed={false} reason={noPermission}>
        <Button variant="outline" shape="rounded" size="sm" icon={<Download className="h-4 w-4" />} disabled>
          {t('subsCsv')}
        </Button>
      </Gate>
    );
  }
  return (
    <ActionMenu
      label={t('subsChoose')}
      trigger={
        <>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t('subsCsv')}
        </>
      }
      items={CHANNELS.map((ch) => ({ label: tx(`ch_${ch}`), icon: CHANNEL_ICON[ch], onSelect: () => void run(ch) }))}
    />
  );
}
