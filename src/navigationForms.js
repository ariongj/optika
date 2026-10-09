import { getLanguage } from './i18n/locale.js';
export const bookingTimes = ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00'];

// Generate the same calendar in Kosovo even when the visitor is abroad.
export function bookingCalendar(now = new Date(), locale = getLanguage()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Tirane', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  const cursor = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  const shortDays = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];
  const longDays = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë'];
  const shortMonths = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'];
  const longMonths = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
  const days = [];
  while (days.length < 12) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() === 0) continue;
    days.push({ value: cursor.toISOString().slice(0, 10), weekday: shortDays[cursor.getUTCDay()], date: `${String(cursor.getUTCDate()).padStart(2, '0')} ${shortMonths[cursor.getUTCMonth()]}`, full: `${longDays[cursor.getUTCDay()]}, ${cursor.getUTCDate()} ${longMonths[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}` });
  }
  if (locale === 'en') return days.map(day => {
    const date = new Date(day.value + 'T12:00:00Z');
    return { ...day, weekday: new Intl.DateTimeFormat('en-GB', { weekday:'short', timeZone:'UTC' }).format(date), date: new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', timeZone:'UTC' }).format(date), full: new Intl.DateTimeFormat('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(date) };
  });
  return days;
}

export function bookingContactError(values) {
  if (values.name.trim().length < 2 || values.name.trim().length > 140) return ['name', 'Shkruani emrin dhe mbiemrin (2–140 shkronja).'];
  const digits = values.phone.replace(/\D/g, '');
  if (!/^\+?[\d\s().-]+$/.test(values.phone.trim()) || digits.length < 7 || digits.length > 15 || values.phone.length > 80) return ['phone', 'Shkruani një numër telefoni të vlefshëm me 7–15 shifra.'];
  if (values.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 180)) return ['email', 'Kontrolloni adresën e emailit ose lëreni bosh.'];
  if (values.message.length > 1000) return ['message', 'Shënimi mund të ketë deri në 1000 shkronja.'];
  if (!values.consent) return ['consent', 'Jepni pëlqimin që ekipi t’ju kontaktojë për këtë kërkesë.'];
  return null;
}

export async function sendAppointment(payload, fetcher = globalThis.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetcher('/api/submit.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: '', ...payload }), signal: controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok || result.accepted !== true || !/^SUB-[A-Z0-9-]+$/i.test(result.id || '')) {
      const error = new Error(result?.error || 'appointment_unconfirmed');
      error.status = response.status;
      error.fields = result?.fields || {};
      throw error;
    }
    return result;
  } finally { clearTimeout(timeout); }
}

export function appointmentFailure(error) {
  if (error?.status === 429) return 'Ka shumë kërkesa. Prisni pak dhe provoni përsëri; të dhënat tuaja janë ruajtur në këtë formular.';
  if (error?.status === 409) return 'Kjo referencë lidhet me një kërkesë tjetër. Kontrolloni kërkesën e mëparshme para se të filloni një të re.';
  if (error?.status === 422) return 'Kontrolloni të dhënat dhe ditën e preferuar. Nuk u pranua një kërkesë e re.';
  return 'Nuk morëm konfirmim nga serveri. Kërkesa mund të jetë ruajtur. Provoni përsëri me të njëjtat të dhëna; përdorim të njëjtën referencë për të shmangur dublimin.';
}

export const initialMeasurementMarkers = () => ({ card: [30, 70], pupils: [35.5, 64.5], face: [17.5, 82.5] });

// This is image geometry, not a medical or frame-fitting model. No confidence
// percentage, bridge size, lens size or fit guarantee can be derived from it.
export function estimatePhotoDimensions(markers) {
  if (!['card', 'pupils', 'face'].every(key => Array.isArray(markers?.[key]) && markers[key].length === 2 && markers[key].every(value => Number.isFinite(value) && value >= 0 && value <= 100) && markers[key][1] > markers[key][0])) return null;
  const cardSpan = markers.card[1] - markers.card[0];
  if (cardSpan < 12 || markers.pupils[0] <= markers.face[0] || markers.pupils[1] >= markers.face[1]) return null;
  const scale = 85.6 / cardSpan;
  return { pd: (markers.pupils[1] - markers.pupils[0]) * scale, faceWidth: (markers.face[1] - markers.face[0]) * scale };
}
