export const EU_PARTNER_COUNTRIES = Object.freeze([
  ['AT', 'Austria', 'Austri'], ['BE', 'Belgium', 'Belgjikë'], ['BG', 'Bulgaria', 'Bullgari'],
  ['HR', 'Croatia', 'Kroaci'], ['CY', 'Cyprus', 'Qipro'], ['CZ', 'Czechia', 'Çeki'],
  ['DK', 'Denmark', 'Danimarkë'], ['EE', 'Estonia', 'Estoni'], ['FI', 'Finland', 'Finlandë'],
  ['FR', 'France', 'Francë'], ['DE', 'Germany', 'Gjermani'], ['GR', 'Greece', 'Greqi'],
  ['HU', 'Hungary', 'Hungari'], ['IE', 'Ireland', 'Irlandë'], ['IT', 'Italy', 'Itali'],
  ['LV', 'Latvia', 'Letoni'], ['LT', 'Lithuania', 'Lituani'], ['LU', 'Luxembourg', 'Luksemburg'],
  ['MT', 'Malta', 'Maltë'], ['NL', 'Netherlands', 'Holandë'], ['PL', 'Poland', 'Poloni'],
  ['PT', 'Portugal', 'Portugali'], ['RO', 'Romania', 'Rumani'], ['SK', 'Slovakia', 'Sllovaki'],
  ['SI', 'Slovenia', 'Slloveni'], ['ES', 'Spain', 'Spanjë'], ['SE', 'Sweden', 'Suedi'],
]);

export const LAB_BUSINESS_TYPES = Object.freeze(['optical', 'clinic', 'distributor', 'other']);
export const LAB_INTERESTS = Object.freeze(['prescription', 'mounting', 'documentation', 'partnership']);
export const LAB_SOURCE_PATHS = Object.freeze(['/laboratory/partners', '/laboratory/kosovo', '/laboratory/europe']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = value => typeof value === 'string' ? value.trim() : '';

export function initialLabPartnerFields(marketSegment, initialInterest = 'partnership') {
  return {
    name: '', organization: '', email: '', phone: '', website: '',
    country: marketSegment === 'kosovo' ? 'XK' : '', businessType: 'optical',
    interest: LAB_INTERESTS.includes(initialInterest) ? initialInterest : 'partnership',
    consent: false, company: '',
  };
}

export function applyLabInitialInterest(fields, interest, { pending = false, hasAttempt = false, submitted = false } = {}) {
  if (pending || hasAttempt || submitted || !LAB_INTERESTS.includes(interest) || fields.interest === interest) return fields;
  return { ...fields, interest };
}

export function normalizeLabPartnerFields(fields) {
  return {
    name: clean(fields.name), organization: clean(fields.organization),
    email: clean(fields.email).toLowerCase(), phone: clean(fields.phone),
    country: clean(fields.country).toUpperCase(), businessType: clean(fields.businessType),
    interest: clean(fields.interest), website: clean(fields.website),
    consent: fields.consent === true, company: clean(fields.company),
  };
}

export function validateLabPartnerFields(fields, marketSegment) {
  const value = normalizeLabPartnerFields(fields);
  const errors = {};
  if (!['kosovo', 'eu'].includes(marketSegment)) errors.form = 'configuration';
  if (value.name.length < 2 || value.name.length > 140) errors.name = 'name';
  if (value.organization.length < 2 || value.organization.length > 160) errors.organization = 'organization';
  if (value.email.length > 180 || !emailPattern.test(value.email)) errors.email = 'email';
  if (value.phone && (value.phone.length < 5 || value.phone.length > 80 || !/^[+\d()\s.\-/]+$/.test(value.phone))) errors.phone = 'phone';
  if (marketSegment === 'kosovo' ? value.country !== 'XK' : !EU_PARTNER_COUNTRIES.some(([code]) => code === value.country)) errors.country = 'country';
  if (!LAB_BUSINESS_TYPES.includes(value.businessType)) errors.businessType = 'businessType';
  if (!LAB_INTERESTS.includes(value.interest)) errors.interest = 'interest';
  if (value.website) {
    try {
      const url = new URL(value.website);
      if (value.website.length > 300 || url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) errors.website = 'website';
    } catch { errors.website = 'website'; }
  }
  if (!value.consent) errors.consent = 'consent';
  return errors;
}

export function createLabApplicationRequestId(cryptoProvider = globalThis.crypto) {
  if (typeof cryptoProvider?.randomUUID === 'function') return cryptoProvider.randomUUID();
  if (typeof cryptoProvider?.getRandomValues !== 'function') throw new Error('request_id_unavailable');
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function labPartnerFingerprint(fields, marketSegment, locale, sourcePath) {
  return JSON.stringify({ ...normalizeLabPartnerFields(fields), marketSegment, locale, sourcePath });
}

export function buildLabPartnerPayload(fields, { marketSegment, locale, sourcePath, applicationRequestId }) {
  const errors = validateLabPartnerFields(fields, marketSegment);
  if (Object.keys(errors).length || !['sq', 'en'].includes(locale) || !LAB_SOURCE_PATHS.includes(sourcePath) || !requestIdPattern.test(applicationRequestId)) {
    throw new Error('invalid_application');
  }
  return {
    type: 'enquiry', division: 'lab', applicationRequestId,
    ...normalizeLabPartnerFields(fields), marketSegment, sourcePath, locale,
  };
}

export class LabPartnerSubmissionError extends Error {
  constructor(code, status = 0, fieldErrors = {}) {
    super(code); this.name = 'LabPartnerSubmissionError'; this.code = code;
    this.status = status; this.fieldErrors = fieldErrors;
  }
}

export async function submitLabPartnerApplication(payload, { fetcher = globalThis.fetch, signal, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetcher('/api/submit.php', {
      method: 'POST', credentials: 'same-origin', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    let result;
    try { result = await response.json(); } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new LabPartnerSubmissionError('unavailable', response.status);
    }
    if (!response.ok) {
      const code = typeof result?.error === 'string' ? result.error : 'unavailable';
      const fieldErrors = result?.fields && typeof result.fields === 'object' && !Array.isArray(result.fields) ? result.fields : {};
      throw new LabPartnerSubmissionError(code, response.status, fieldErrors);
    }
    if (result?.ok !== true || result?.accepted !== true || typeof result?.id !== 'string' || !/^[a-z0-9_-]{1,100}$/i.test(result.id)) {
      throw new LabPartnerSubmissionError('unconfirmed', response.status);
    }
    return { id: result.id, duplicate: result.duplicate === true };
  } catch (error) {
    if (error instanceof LabPartnerSubmissionError) throw error;
    if (controller.signal.aborted) throw new LabPartnerSubmissionError(timedOut ? 'timeout' : 'aborted');
    throw new LabPartnerSubmissionError('network');
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
  }
}

export function labPartnerErrorKey(error) {
  if (error.code === 'application_request_conflict') return 'conflict';
  if (error.code === 'timeout') return 'timeout';
  if (error.status === 429 || error.code === 'rate_limited') return 'rate';
  if (error.status === 422) return 'validation';
  if (error.code === 'unconfirmed') return 'unconfirmed';
  return 'unavailable';
}
