import '@/admin/admin.css'; // full CMS stylesheet (the storefront sheet leaves admin-only classes out)
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { LangSwitcher } from '@/components/LangSwitcher';
import { ArrowLeft } from 'lucide-react';
import { useDict } from '@/i18n';
import { adm } from '@/admin/i18n';
import { href } from '@/lib/paths';
import { ApiError } from '@/lib/backend/api';
import { authErrorKey } from '@/lib/backend/session';
import { AU, type AuthKey } from './strings';

/** The two-column page the sign-in screens share (photo and claim on the left, the form on the right). */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useDict(adm, 'admin');
  const ta = useDict(AU, 'admin');
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <img src={href('/images/hero/optical.webp')} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/10" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo tone="light" accent className="h-14" />
          <div>
            <p className="display max-w-md text-4xl leading-tight">{t('loginHero')}</p>
            <p className="mt-4 max-w-sm text-paper/70">{t('loginHeroText')}</p>
          </div>
        </div>
      </div>
      <div className="relative flex flex-col bg-paper">
        <div className="flex items-center justify-between p-6">
          {/* a full page load: the storefront then starts with the visitor's data, not the sign-in page's */}
          <a href={href('/')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> {ta('backToSite')}
          </a>
          <LangSwitcher scope="admin" />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <div className="lg:hidden">
              <Logo className="mb-10 h-12" />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The message for a failed sign-in call, in the reader's language. */
export function useAuthError() {
  const ta = useDict(AU, 'admin');
  return (err: unknown) => {
    const key = `e_${authErrorKey(err)}` as AuthKey;
    const wait = err instanceof ApiError ? Number((err.data as { retryAfter?: number } | undefined)?.retryAfter) : NaN;
    return ta(key, { min: Number.isFinite(wait) ? Math.max(1, Math.ceil(wait / 60)) : 15 });
  };
}

/** After signing in, the CMS starts from a fresh page load: the shop's data is fetched before anything is drawn. */
export function enterCms() {
  window.location.assign(href('/admin'));
}
