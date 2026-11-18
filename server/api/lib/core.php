<?php
// Miftari Vision API — shared helpers: config, JSON in/out, errors, ids, time, client address, rate limits.
declare(strict_types=1);

const MV_API_VERSION = '1.0.0';

/** Settings with safe defaults. An optional api/config.php (never shipped in the release ZIP) returns overrides. */
function mv_config(): array
{
    static $cfg = null;
    if (is_array($cfg)) return $cfg;
    $cfg = [
        // Where the database lives. Default: a folder next to public_html (outside the web root).
        'data_dir' => '',
        // Header that carries the visitor's real address when the site sits behind a proxy/CDN the shop controls
        // (e.g. 'HTTP_CF_CONNECTING_IP' behind Cloudflare). Empty = use REMOTE_ADDR only.
        'client_ip_header' => '',
        // Staff sessions: signed out after this much inactivity, and in any case after max_age.
        'session_idle' => 12 * 3600,
        'session_max_age' => 14 * 86400,
        // Sign-in protection: failed attempts per account before a lock, and the lock length.
        'login_max_failures' => 5,
        'login_lock_seconds' => 15 * 60,
        // Invite and password-reset links stay valid this long.
        'invite_ttl' => 7 * 86400,
        'reset_ttl' => 24 * 3600,
        // Login history and consent records: how long security logs are kept (consent records are kept for good).
        'auth_log_days' => 365,
        // Largest accepted upload (bytes) and request body (bytes).
        'upload_max' => 8 * 1024 * 1024,
        'body_max' => 4 * 1024 * 1024,
    ];
    $file = dirname(__DIR__) . '/config.php';
    if (is_file($file)) {
        $over = require $file;
        if (is_array($over)) $cfg = array_replace($cfg, $over);
    }
    $env = getenv('MV_DATA_DIR');
    if (is_string($env) && trim($env) !== '') $cfg['data_dir'] = trim($env);
    return $cfg;
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

function mv_headers_common(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow, noarchive');
    header('Referrer-Policy: same-origin');
    header('Cross-Origin-Resource-Policy: same-origin');
    header_remove('X-Powered-By');
}

/** Send JSON and stop. Responses are never cached by shared caches. */
function mv_out($payload, int $status = 200, array $headers = []): never
{
    http_response_code($status);
    mv_headers_common();
    header('Content-Type: application/json; charset=utf-8');
    if (!isset($headers['Cache-Control'])) header('Cache-Control: no-store');
    foreach ($headers as $k => $v) header("$k: $v");
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

/** Fail with a stable machine-readable code (the client maps codes to translated messages). */
function mv_fail(int $status, string $code, array $extra = []): never
{
    mv_out(['ok' => false, 'error' => $code] + $extra, $status);
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

function mv_method(): string
{
    return strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

/** JSON body of a POST. Only application/json is accepted, so a cross-site HTML form can never reach the API. */
function mv_body(): array
{
    static $body = null;
    if (is_array($body)) return $body;
    $type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
    if (!str_starts_with($type, 'application/json')) mv_fail(415, 'json_required');
    $max = (int) mv_config()['body_max'];
    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $max) mv_fail(413, 'too_large');
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) mv_fail(413, 'too_large');
    $data = $raw === '' ? [] : mv_jd($raw, 64);
    if ($data instanceof ArrayObject && !count($data)) $data = [];
    if (!is_array($data)) mv_fail(400, 'bad_json');
    return $body = $data;
}

/**
 * Same-origin check for every state-changing request: the browser's Origin (or Sec-Fetch-Site) must be this site.
 * Requests without either header (curl, server-to-server) pass here; staff writes also need the CSRF header.
 */
function mv_same_origin(): void
{
    $site = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($site !== '' && !in_array($site, ['same-origin', 'none'], true)) mv_fail(403, 'cross_site');
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '' || $origin === 'null') {
        if ($origin === 'null') mv_fail(403, 'cross_site');
        return;
    }
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $expect = (mv_https() ? 'https://' : 'http://') . $host;
    if (strtolower(rtrim($origin, '/')) !== $expect) mv_fail(403, 'cross_site');
}

function mv_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') return true;
    if ((string) ($_SERVER['SERVER_PORT'] ?? '') === '443') return true;
    // Hostinger and most shared hosts terminate TLS in front of PHP and say so in this header
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

/** The visitor's address (only used for rate limits and the staff login history). */
function mv_ip(): string
{
    $h = (string) mv_config()['client_ip_header'];
    if ($h !== '' && !empty($_SERVER[$h])) {
        $ip = trim(explode(',', (string) $_SERVER[$h])[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/** Shortened address for consent records: the network, not the device (IPv4 /24, IPv6 /48). */
function mv_ip_short(string $ip): string
{
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $p = explode('.', $ip);
        return "{$p[0]}.{$p[1]}.{$p[2]}.0";
    }
    $bin = @inet_pton($ip);
    if ($bin === false) return '';
    $bin = substr($bin, 0, 6) . str_repeat("\0", 10);
    return (string) inet_ntop($bin);
}

function mv_ua(): string
{
    return mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200);
}

/* ------------------------------------------------------------------ */
/* Values                                                              */
/* ------------------------------------------------------------------ */

/** ISO time with milliseconds, like JavaScript's toISOString(). */
function mv_iso(?int $ms = null): string
{
    $ms ??= mv_ms();
    $sec = intdiv($ms, 1000);
    return gmdate('Y-m-d\TH:i:s', $sec) . sprintf('.%03dZ', $ms % 1000);
}

function mv_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

/** Epoch ms of an ISO string (null when it does not parse). */
function mv_parse_ms($iso): ?int
{
    if (!is_string($iso) || $iso === '') return null;
    try {
        $d = new DateTimeImmutable($iso, new DateTimeZone('UTC'));
    } catch (Throwable) {
        return null;
    }
    return (int) $d->format('U') * 1000 + (int) $d->format('v');
}

/** Same shape as the app's uid(): prefix + "_" + random + time (base 36). */
function mv_uid(string $prefix = 'id'): string
{
    $abc = '0123456789abcdefghijklmnopqrstuvwxyz';
    $r = '';
    $bytes = random_bytes(6);
    for ($i = 0; $i < 6; $i++) $r .= $abc[ord($bytes[$i]) % 36];
    return $prefix . '_' . $r . substr(base_convert((string) mv_ms(), 10, 36), -4);
}

/** URL-safe random token (used for sessions, invites, resets). */
function mv_token(int $bytes = 32): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

/** Trimmed string of at most $max characters ('' for non-strings). */
function mv_str($v, int $max = 200): string
{
    if (is_int($v) || is_float($v)) $v = (string) $v;
    if (!is_string($v)) return '';
    $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '');
    return mb_substr($v, 0, $max);
}

function mv_email_ok(string $e): bool
{
    return strlen($e) <= 190 && (bool) preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $e);
}

/** Last 8 digits of a phone number ("+383 44 123 456" and "044 123 456" are the same phone), as the CRM does. */
function mv_phone8(string $p): string
{
    $d = preg_replace('/\D/', '', $p) ?? '';
    return strlen($d) >= 6 ? substr($d, -8) : '';
}

/** The CRM's customer key: lower-case e-mail, else "tel-" + last 8 digits. */
function mv_subject_key(string $email, string $phone): string
{
    $e = mb_strtolower(trim($email));
    if ($e !== '') return $e;
    $p = mv_phone8($phone);
    return $p !== '' ? "tel-$p" : '';
}

function mv_lang($v): string
{
    return in_array($v, ['me', 'sq', 'en'], true) ? $v : 'sq';
}

/* ------------------------------------------------------------------ */
/* Rate limits                                                         */
/* ------------------------------------------------------------------ */

/**
 * At most $limit hits per $window seconds for this bucket and client address. The address is stored hashed.
 * $soft = true returns false instead of failing (for checks that degrade, e.g. login history).
 */
function mv_rate(string $bucket, int $limit, int $window, bool $soft = false, ?string $who = null): bool
{
    $key = $bucket . ':' . hash_hmac('sha256', $who ?? mv_ip(), mv_secret('rate'));
    $now = time();
    $win = $now - ($now % $window);
    $pdo = mv_db();
    $row = $pdo->prepare('SELECT win, n FROM rate WHERE k = ?');
    $row->execute([$key]);
    $r = $row->fetch(PDO::FETCH_ASSOC);
    $n = ($r && (int) $r['win'] === $win) ? (int) $r['n'] + 1 : 1;
    $pdo->prepare('INSERT INTO rate (k, win, n) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET win = excluded.win, n = excluded.n')->execute([$key, $win, $n]);
    if (random_int(1, 200) === 1) $pdo->prepare('DELETE FROM rate WHERE win < ?')->execute([$now - 86400]);
    if ($n <= $limit) return true;
    if ($soft) return false;
    header('Retry-After: ' . ($win + $window - $now));
    mv_fail(429, 'rate_limited');
}
