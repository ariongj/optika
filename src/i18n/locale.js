import { english } from './en.js';
const listeners = new Set();
const storageKey = 'miftari-language';
function initialLanguage() {
  if (typeof window === 'undefined') return 'sq';
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'en' || requested === 'sq') return requested;
  try { return window.localStorage.getItem(storageKey) === 'en' ? 'en' : 'sq'; } catch { return 'sq'; }
}
let language = initialLanguage();
// Back/forward navigation can restore a route with a different language query.
if (typeof window !== 'undefined') window.addEventListener('popstate', () => {
  const next = initialLanguage();
  if (next !== language) {
    language = next;
    document.documentElement.lang = next;
    listeners.forEach(callback => callback());
  }
});
export const getLanguage = () => language;
export const subscribeLanguage = callback => { listeners.add(callback); return () => listeners.delete(callback); };
export function setLanguage(next) {
  if (!['sq', 'en'].includes(next) || next === language) return;
  language = next;
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(storageKey, next); } catch { /* Private mode can deny storage. */ }
    const url = new URL(window.location.href); url.searchParams.set('lang', next);
    window.history.replaceState(window.history.state, '', url);
    document.documentElement.lang = next;
  }
  listeners.forEach(callback => callback());
}
export function translate(value, locale = language) {
  if (locale !== 'en' || typeof value !== 'string' || !value.trim()) return value;
  const key = value.replace(/\s+/g, ' ').trim();
  let translated = english[key];
  if (translated === undefined && key.includes(' | ')) translated = key.split(' | ').map(t => translate(t, locale)).join(' | ');
  if (translated === undefined) {
    // Explicit parameterised UI messages; never alter identifiers or entered values.
    const patterns = [
      [/^Ruaj (.+) te të preferuarat$/, m => `Save ${m[1]} to favourites`],
      [/^Hiq (.+) nga të preferuarat$/, m => `Remove ${m[1]} from favourites`],
      [/^Hiq filtrin (.+)$/, m => `Remove filter ${translate(m[1],locale)}`],
      [/^Shiko shpejt (.+)$/, m => `Quick view ${m[1]}`],
      [/^Fotografitë e (.+)$/, m => `Photos of ${m[1]}`],
      [/^Ruaj (.+)$/, m => `Save ${m[1]}`],
      [/^Korniza (.+)$/, m => `Frame ${translate(m[1],locale)}`],
      [/^Shto (?:në shportë|kornizën)\s*[·-]\s*(.+)$/, m => `Add to bag · ${m[1]}`],
      [/^(.+) Ky variant vjen në ngjyrën (.+), me lente (.+)\.$/, m => `${translate(m[1],locale)} This variant pairs ${translate(m[2].charAt(0).toUpperCase()+m[2].slice(1),locale).toLowerCase()} with ${translate(m[3].charAt(0).toUpperCase()+m[3].slice(1),locale).toLowerCase()} lenses.`],
      [/^Hiq (.+)$/, m => `Remove ${m[1]}`],
      [/^Variantet e (.+)$/, m => `Variants of ${m[1]}`],
      [/^Sasia për (.+)$/, m => `Quantity for ${m[1]}`],
      [/^Zvogëlo sasinë e (.+)$/, m => `Decrease quantity of ${m[1]}`],
      [/^Rrit sasinë e (.+)$/, m => `Increase quantity of ${m[1]}`],
      [/^(.+) në shportë$/, m => `${m[1]} in your bag`],
      [/^(.+) nuk është aktualisht në stok\.$/, m => `${m[1]} is currently out of stock.`],
      [/^(\d+) modele(?: · (\d+) variante)?$/, m => `${m[1]} ${m[1]==='1'?'frame':'frames'}${m[2]?` · ${m[2]} variants`:''}`],
      [/^(\d+) modele në katalog · Variantet dhe çmimi shfaqen për çdo kornizë\.$/, m => `${m[1]} models in the catalogue · Each frame shows its variants and price.`],
      [/^(\d+) (artikuj|artikull|copë|në stok|modele|variante)$/, m => `${m[1]} ${{artikuj:'items',artikull:'item',copë:'units','në stok':'in stock',modele:'models',variante:'variants'}[m[2]]}`],
      [/^Hap shportën, (\d+) (artikuj|artikull)$/, m => `Open bag, ${m[1]} ${m[2]==='artikull'?'item':'items'}`],
      [/^Zmadho pamjen e (.+)$/, m => `Enlarge image of ${m[1]}`],
      [/^Shfaq pamjen (\d+) të (.+)$/, m => `Show image ${m[1]} of ${m[2]}`],
      [/^Shiko pamjen (\d+)$/, m => `View image ${m[1]}`],
      [/^Pamja (\d+)$/, m => `Image ${m[1]}`],
      [/^Provo (.+) në 3D$/, m => `Try ${m[1]} in 3D`],
      [/^(.+), pamja (\d+)$/, m => `${m[1]}, image ${m[2]}`],
      [/^(.+), syze me dioptri, pamja e zgjedhur$/, m => `${m[1]}, prescription glasses, selected image`],
      [/^(.+), syze dielli, pamja e zgjedhur$/, m => `${m[1]}, sunglasses, selected image`],
      [/^(.+), (syze dielli|kornizë optike) — imazh ilustrues i modelit$/, m => `${m[1]}, ${m[2]==='syze dielli'?'sunglasses':'optical frame'} — illustrative model image`],
      [/^Skemë orientuese: (.+)$/, m => `Illustrative diagram: ${m[1].split(', ').map(t=>translate(t,locale)).join(', ')}`],
      [/^(.+): ([^:]+), ([^,]+)$/, m => `${translate(m[1],locale)}: ${translate(m[2],locale)}, ${translate(m[3],locale)}`],
      [/^([^:]+): (.+)$/, m => `${translate(m[1],locale)}: ${translate(m[2],locale)}`],
    ];
    for (const [pattern, render] of patterns) { const match = key.match(pattern); if (match) { translated = render(match); break; } }
    if (translated === undefined && key.includes(' · ')) translated = key.split(' · ').map(t => translate(t, locale)).join(' · ');
    if (translated === undefined && key.includes(' | ')) translated = key.split(' | ').map(t => translate(t, locale)).join(' | ');
    if (translated === undefined && key.includes(' / ')) translated = key.split(' / ').map(t => translate(t, locale)).join(' / ');
    if (translated === undefined && key.endsWith(' *')) translated = `${translate(key.slice(0,-2), locale)} *`;
  }
  return translated === undefined ? value : value.replace(value.trim(), translated);
}
// Translate presentation only: identifiers, URLs, handlers, entered values and
// server payloads stay unchanged. Explicit option values survive either locale.
export function localizeProps(type, props) {
  if (!props || (typeof type !== 'string' && type !== Symbol.for('react.fragment')) || props.translate === 'no' || ['script','style'].includes(type)) return props;
  const result = { ...props };
  const children = value => Array.isArray(value) ? value.map(children) : translate(value);
  if (type === 'option' && props.value === undefined && typeof props.children === 'string') result.value = props.children;
  if (type !== 'textarea') result.children = children(props.children);
  // New-tab navigation retains the language too; downloads/API paths are not pages.
  if (language === 'en' && typeof props.href === 'string' && /^\/(?!\/|api(?:\/|\?)|assets\/|uploads\/|crafted-lens\/)/.test(props.href)) {
    const target = new URL(props.href, 'https://language.local');
    target.searchParams.set('lang','en');
    result.href = target.pathname + target.search + target.hash;
  }
  for (const attr of ['aria-label', 'aria-description', 'placeholder', 'title', 'alt']) {
    if (typeof props[attr] === 'string') result[attr] = translate(props[attr]);
  }
  return result;
}
