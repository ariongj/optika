// Server-backed build: whether the CMS's edits have reached the server (top bar, beside the account menu).
import { Check, CloudOff, Loader2, TriangleAlert } from 'lucide-react';
import { useDict } from '@/i18n';
import { adm } from '@/admin/i18n';
import { useSyncStatus } from '@/lib/backend/sync';

export default function SaveStatus() {
  const t = useDict(adm, 'admin');
  const state = useSyncStatus((s) => s.state);
  const pending = useSyncStatus((s) => s.pending);
  const savedAt = useSyncStatus((s) => s.savedAt);
  const view =
    state === 'offline'
      ? { icon: <CloudOff className="h-3.5 w-3.5" />, text: t('syncOffline'), tone: 'bg-amber-400/20 text-amber-100 ring-amber-300/30' }
      : state === 'error'
        ? { icon: <TriangleAlert className="h-3.5 w-3.5" />, text: t('syncError'), tone: 'bg-red-400/20 text-red-100 ring-red-300/30' }
        : state === 'saving' || pending > 0
          ? { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: t('syncSaving'), tone: 'bg-white/[0.08] text-white/80 ring-white/10' }
          : savedAt
            ? { icon: <Check className="h-3.5 w-3.5" />, text: t('syncSaved'), tone: 'bg-white/[0.08] text-white/70 ring-white/10' }
            : null;
  if (!view) return null;
  return (
    <span role="status" title={view.text} className={`mr-1 inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold ring-1 ${view.tone}`}>
      {view.icon}
      <span className="hidden md:inline">{view.text}</span>
      <span className="sr-only md:hidden">{view.text}</span>
    </span>
  );
}
