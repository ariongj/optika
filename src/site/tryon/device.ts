// Device / browser checks for the live camera. Kept tiny and dependency-free so the page can use them
// before any of the heavy try-on code loads.

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '');

/** Phones and tablets: iOS / iPadOS (incl. an iPad presenting itself as a Mac), Android, or any coarse-pointer device. */
export function isHandheld(): boolean {
  if (typeof navigator === 'undefined') return false;
  const agent = ua();
  if (/iPhone|iPad|iPod|Android/i.test(agent)) return true;
  if (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1) return true;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

/** In-app browsers (Instagram, Facebook, Messenger, TikTok, Snapchat, LinkedIn, Line) often block or break the camera. */
export function isInAppBrowser(): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|musical_ly|BytedanceWebview|Snapchat|LinkedInApp|Line\//.test(ua());
}

export type CameraSupport = 'ok' | 'insecure' | 'unsupported';

/** getUserMedia needs a secure context (HTTPS / localhost) and a browser that exposes it. */
export function cameraSupport(): CameraSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  return typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'ok' : 'unsupported';
}

/** Camera constraints: lighter capture on phones (faster CPU tracking, less heat), 720p on desktops. */
export function videoConstraints(facing: 'user' | 'environment', lite: boolean): MediaTrackConstraints {
  return {
    facingMode: { ideal: facing },
    width: { ideal: lite ? 640 : 1280 },
    height: { ideal: lite ? 480 : 720 },
    frameRate: { ideal: lite ? 24 : 30, max: 30 },
  };
}

/** Short technical detail for the error line ("NotReadableError: Could not start video source"). */
export function describeError(error: unknown, prefix?: string): string {
  let text: string;
  if (error instanceof DOMException || error instanceof Error) {
    const msg = (error.message || '').trim();
    text = msg && !msg.startsWith(error.name) ? `${error.name}: ${msg}` : msg || error.name;
  } else text = String(error ?? 'Unknown error');
  text = text.replace(/\s+/g, ' ');
  if (prefix && !text.startsWith(prefix)) text = `${prefix} · ${text}`;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/** Copies text, with a textarea fallback for webviews without the async Clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** video.play(), retried once after `loadedmetadata` (iOS can reject the first call). Resolves to "is playing". */
export async function playVideo(video: HTMLVideoElement): Promise<boolean> {
  const attempt = () =>
    Promise.race([
      video.play().then(
        () => true,
        (error) => {
          console.warn('[try-on] video.play() was rejected', error);
          return false;
        },
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(!video.paused), 4000)),
    ]);
  if (await attempt()) return true;
  if (video.readyState < 1) {
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        video.removeEventListener('loadedmetadata', done);
        resolve();
      };
      const timer = setTimeout(done, 3000);
      video.addEventListener('loadedmetadata', done, { once: true });
    });
  }
  return attempt();
}
