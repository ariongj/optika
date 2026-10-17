import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import './index.css';
import App from './App';
import { reloadOnce } from './site/pages/lazy';

/**
 * Production builds load the stylesheet without blocking the first paint (the static first screen in #root has
 * inline styles — see vite.config.ts / scripts/prerender-meta.mjs). React mounts once the sheet has applied, so the
 * real page never shows unstyled. In dev Vite injects the CSS itself and there is no such link.
 */
function cssReady(): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[data-app-css]');
  const done = () => {
    if (link) link.media = 'all';
    document.getElementById('shell-css')?.remove();
  };
  if (!link || link.sheet) {
    done();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      done();
      resolve();
    };
    link.addEventListener('load', finish, { once: true });
    link.addEventListener('error', finish, { once: true });
  });
}

void cssReady().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

// Production only: the service worker keeps build files and photos on the device for fast repeat visits on phones
// (pages are still fetched fresh — see public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

// A preloaded chunk failed (new deploy or flaky connection): reload once to fetch the current files.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnce()) event.preventDefault();
});
