// The shop's own server (PHP + SQLite on the hosting, server/api). Only used by builds made with VITE_BACKEND=1
// (the Hostinger release); the GitHub Pages demo keeps everything in the visitor's browser and never calls it.

/** Compile-time switch: true only in the server-backed release build. */
export const BACKEND = import.meta.env.VITE_BACKEND === '1';

/** /api/ under the site's base path. */
export const API_ROOT = `${import.meta.env.BASE_URL}api/`;

/** A failed API call: `code` is the server's stable error code (e.g. "bad_credentials"), "network" when offline. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly data: Record<string, unknown> | null;
  constructor(status: number, code: string, data: Record<string, unknown> | null) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

let csrf = '';
/** The signed-in session's anti-forgery token (sent with every staff write). */
export function setCsrf(token: string) {
  csrf = token;
}

export interface ApiOptions {
  method?: 'GET' | 'POST';
  /** JSON body (POST) */
  body?: unknown;
  /** multipart body (uploads) */
  form?: FormData;
  signal?: AbortSignal;
  /** HTTP cache mode: API answers are never stored, except the public snapshot (revalidated with its ETag) */
  cache?: RequestCache;
}

/** Call the shop server. Resolves with the JSON answer; rejects with an ApiError. */
export async function api<T = Record<string, unknown>>(route: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (csrf && method !== 'GET') headers['X-MV-CSRF'] = csrf;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(API_ROOT + route, { method, headers, body, credentials: 'same-origin', cache: opts.cache ?? 'no-store', signal: opts.signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', null);
  }
  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty or non-JSON answer */
  }
  if (!res.ok || data?.ok === false) {
    const code = typeof data?.error === 'string' ? data.error : `http_${res.status}`;
    // the session ended (expired, revoked, signed out in another tab): the CMS shows the sign-in page
    if (res.status === 401 && code === 'signed_out') window.dispatchEvent(new CustomEvent('mv:signed-out'));
    throw new ApiError(res.status, code, data);
  }
  return data as T;
}

/** True for errors that mean "try again later" (offline, server busy) rather than "this was refused". */
export function isTransient(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status === 429 || err.status >= 500);
}
