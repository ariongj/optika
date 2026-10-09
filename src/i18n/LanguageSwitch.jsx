import { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage, setLanguage } from './locale.js';
export const useLanguage = () => useSyncExternalStore(subscribeLanguage, getLanguage, () => 'sq');
export default function LanguageSwitch() {
  const language = useLanguage();
  return <div className="language-switch" role="group" aria-label={language === 'en' ? 'Website language' : 'Gjuha e faqes'} translate="no">
    <button type="button" lang="sq" aria-label="Shqip" aria-pressed={language === 'sq'} onClick={() => setLanguage('sq')}>SQ</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
  </div>;
}
