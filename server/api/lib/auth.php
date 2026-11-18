<?php
// Miftari Vision API — staff sign-in: passwords, sessions, CSRF, lockout, optional 2-step codes (TOTP),
// first-owner setup and owner recovery through a code file in the private data folder.
declare(strict_types=1);

const MV_ROLES = ['owner', 'manager', 'catalog', 'orders', 'editor', 'marketing', 'reception'];

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

function mv_hash_password(string $p): string
{
    if (defined('PASSWORD_ARGON2ID')) {
        // OWASP minimum for Argon2id (19 MiB, 2 passes): strong, and light enough for shared hosting
        return password_hash($p, PASSWORD_ARGON2ID, ['memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1]);
    }
    return password_hash($p, PASSWORD_BCRYPT, ['cost' => 11]);
}

/** A hash of a random secret, so a sign-in with an unknown e-mail costs the same time as a wrong password. */
function mv_dummy_hash(): string
{
    $h = mv_meta('dummy_hash');
    if ($h === null) {
        $h = mv_hash_password(bin2hex(random_bytes(16)));
        mv_meta_set('dummy_hash', $h);
    }
    return $h;
}

/** Why a new password is not accepted ('' = fine). */
function mv_password_problem(string $p, string $email = ''): string
{
    $len = mb_strlen($p);
    if ($len < 10) return 'password_short';
    if (strlen($p) > 72 && !defined('PASSWORD_ARGON2ID')) return 'password_long';
    if ($len > 200) return 'password_long';
    if (count(array_unique(mb_str_split($p))) < 4) return 'password_weak';
    $low = mb_strtolower($p);
    $local = mb_strtolower(explode('@', $email)[0] ?? '');
    if ($local !== '' && mb_strlen($local) >= 4 && str_contains($low, $local)) return 'password_personal';
    foreach (['password', 'passwort', 'fjalekalim', 'lozinka', '123456', 'qwerty', 'miftari', 'optika', 'admin', 'welcome', 'iloveyou'] as $w) {
        if (str_contains($low, $w) && $len < 16) return 'password_weak';
    }
    return '';
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

function mv_cookie_name(): string
{
    // __Host- cookies are only accepted over HTTPS, for this exact host and path "/"
    return mv_https() ? '__Host-mv_sid' : 'mv_sid';
}

function mv_set_cookie(string $value, int $expires): void
{
    setcookie(mv_cookie_name(), $value, [
        'expires' => $expires,
        'path' => '/',
        'secure' => mv_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

/** The signed-in staff member and session, or null. */
function mv_current(): ?array
{
    static $cur = false;
    if ($cur !== false) return $cur;
    $cur = null;
    $tok = (string) ($_COOKIE[mv_cookie_name()] ?? '');
    if ($tok === '' || strlen($tok) > 100) return null;
    $q = mv_db()->prepare(
        'SELECT s.id AS sid, s.csrf, s.created_at, s.last_seen, s.expires_at, s.revoked, u.*
           FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'
    );
    $q->execute([hash('sha256', $tok)]);
    $r = $q->fetch();
    $now = time();
    if (!$r || (int) $r['revoked'] || (int) $r['expires_at'] <= $now || (int) $r['last_seen'] + (int) mv_config()['session_idle'] <= $now || !(int) $r['active']) {
        return null;
    }
    if ($now - (int) $r['last_seen'] > 60) {
        mv_db()->prepare('UPDATE sessions SET last_seen = ? WHERE id = ?')->execute([$now, $r['sid']]);
    }
    $cur = $r;
    return $cur;
}

/** Start a new session for a user (sets the cookie). */
function mv_session_start(array $user): array
{
    $tok = mv_token(32);
    $now = time();
    $exp = $now + (int) mv_config()['session_max_age'];
    $sid = mv_uid('ses');
    $csrf = mv_token(24);
    mv_db()->prepare('INSERT INTO sessions (id, token_hash, user_id, csrf, created_at, last_seen, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$sid, hash('sha256', $tok), $user['id'], $csrf, $now, $now, $exp, mv_ip(), mv_ua()]);
    mv_set_cookie($tok, $exp);
    // tidy: expired sessions of everyone
    if (random_int(1, 20) === 1) mv_db()->prepare('DELETE FROM sessions WHERE expires_at < ? OR (revoked = 1 AND last_seen < ?)')->execute([$now, $now - 30 * 86400]);
    return ['sid' => $sid, 'csrf' => $csrf];
}

function mv_revoke_sessions(string $userId, ?string $exceptSid = null): void
{
    if ($exceptSid) mv_db()->prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND id <> ?')->execute([$userId, $exceptSid]);
    else mv_db()->prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?')->execute([$userId]);
}

/**
 * Require a signed-in staff member. State-changing requests must also carry the session's CSRF token in the
 * X-MV-CSRF header and come from this site. With $module, the role must allow $action there.
 */
function mv_staff(string $module = '', string $action = 'view'): array
{
    $u = mv_current();
    if (!$u) mv_fail(401, 'signed_out');
    if (mv_method() !== 'GET') {
        mv_same_origin();
        $h = (string) ($_SERVER['HTTP_X_MV_CSRF'] ?? '');
        if ($h === '' || !hash_equals((string) $u['csrf'], $h)) mv_fail(403, 'csrf');
    }
    if ($module !== '' && !mv_can((string) $u['role'], $module, $action)) mv_fail(403, 'forbidden');
    return $u;
}

function mv_auth_log(string $kind, ?array $user, string $email = '', string $detail = '', ?string $actor = null): void
{
    mv_db()->prepare('INSERT INTO auth_events (at, user_id, email, kind, ip, ua, detail, actor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([mv_iso(), $user['id'] ?? null, $user['email'] ?? $email, $kind, mv_ip(), mv_ua(), mb_substr($detail, 0, 300), $actor]);
    if (random_int(1, 50) === 1) {
        $days = (int) mv_config()['auth_log_days'];
        mv_db()->prepare('DELETE FROM auth_events WHERE at < ?')->execute([mv_iso((time() - $days * 86400) * 1000)]);
    }
}

/** What the CMS needs to know about the signed-in person. */
function mv_user_public(array $u): array
{
    return [
        'id' => (string) $u['id'],
        'email' => (string) $u['email'],
        'name' => (string) $u['name'],
        'role' => (string) $u['role'],
        'staffId' => (string) ($u['staff_id'] ?? ''),
        'totp' => !empty($u['totp_secret']),
        'lastLoginAt' => $u['last_login_at'] ?? null,
    ];
}

function mv_me_payload(array $u, string $csrf): array
{
    return ['ok' => true, 'user' => mv_user_public($u), 'csrf' => $csrf, 'version' => MV_API_VERSION];
}

function mv_user_by_email(string $email): ?array
{
    $q = mv_db()->prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
    $q->execute([$email]);
    return $q->fetch() ?: null;
}

function mv_user(string $id): ?array
{
    $q = mv_db()->prepare('SELECT * FROM users WHERE id = ?');
    $q->execute([$id]);
    return $q->fetch() ?: null;
}

function mv_owner_count(?string $exceptId = null): int
{
    $q = mv_db()->prepare("SELECT COUNT(*) FROM users WHERE role = 'owner' AND active = 1 AND pass_hash IS NOT NULL AND id <> ?");
    $q->execute([$exceptId ?? '']);
    return (int) $q->fetchColumn();
}

/* ------------------------------------------------------------------ */
/* TOTP (RFC 6238, 6 digits, 30 s) — works with any authenticator app  */
/* ------------------------------------------------------------------ */

function mv_b32_encode(string $bin): string
{
    $abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    foreach (str_split($bin) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    $out = '';
    foreach (str_split($bits, 5) as $chunk) $out .= $abc[bindec(str_pad($chunk, 5, '0'))];
    return $out;
}

function mv_b32_decode(string $s): string
{
    $abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $s = strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $s) ?? '');
    $bits = '';
    foreach (str_split($s) as $c) $bits .= str_pad(decbin((int) strpos($abc, $c)), 5, '0', STR_PAD_LEFT);
    $out = '';
    foreach (str_split($bits, 8) as $byte) if (strlen($byte) === 8) $out .= chr(bindec($byte));
    return $out;
}

function mv_totp_at(string $secretB32, int $step): string
{
    $h = hash_hmac('sha1', pack('J', $step), mv_b32_decode($secretB32), true);
    $o = ord($h[19]) & 0x0f;
    $n = ((ord($h[$o]) & 0x7f) << 24) | (ord($h[$o + 1]) << 16) | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
    return str_pad((string) ($n % 1000000), 6, '0', STR_PAD_LEFT);
}

/** Matching step (±1 step for clock drift), or null. */
function mv_totp_check(string $secretB32, string $code, int $lastStep = 0): ?int
{
    $code = preg_replace('/\D/', '', $code) ?? '';
    if (strlen($code) !== 6) return null;
    $now = intdiv(time(), 30);
    for ($d = -1; $d <= 1; $d++) {
        $step = $now + $d;
        if ($step <= $lastStep) continue; // a code works once
        if (hash_equals(mv_totp_at($secretB32, $step), $code)) return $step;
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* Setup & recovery codes (files in the private data folder)          */
/* ------------------------------------------------------------------ */

function mv_code(): string
{
    $abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    $out = '';
    $b = random_bytes(12);
    for ($i = 0; $i < 12; $i++) $out .= $abc[ord($b[$i]) % strlen($abc)] . ($i === 3 || $i === 7 ? '-' : '');
    return $out;
}

function mv_code_file(string $name, string $intro): string
{
    $f = mv_data_dir() . '/' . $name;
    if (!is_file($f)) {
        $code = mv_code();
        file_put_contents($f, "$code\n\n$intro\n");
        @chmod($f, 0600);
    }
    return trim(explode("\n", (string) file_get_contents($f))[0]);
}

function mv_setup_needed(): bool
{
    return (int) mv_db()->query('SELECT COUNT(*) FROM users WHERE pass_hash IS NOT NULL')->fetchColumn() === 0;
}

/** Owner recovery is armed when a file named RECOVER exists in the data folder (created in the host's file manager). */
function mv_recovery_armed(): bool
{
    $dir = mv_data_dir();
    if (!is_file("$dir/RECOVER")) return false;
    $code = "$dir/RECOVERY-CODE.txt";
    if (is_file($code) && filemtime($code) < time() - 3600) @unlink($code); // codes last one hour
    return true;
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

function mv_route_auth(string $path): never
{
    $m = mv_method();
    switch ("$m $path") {
        case 'GET auth/status':
            $setup = mv_setup_needed();
            if ($setup) mv_code_file('SETUP-CODE.txt', "Miftari Vision CMS — first sign-in.\nOpen the CMS (/admin), choose \"Set up\" and enter this code with your name, e-mail and a new password.\nThe file is deleted once the owner account exists.");
            $rec = !$setup && mv_recovery_armed();
            if ($rec) mv_code_file('RECOVERY-CODE.txt', "Miftari Vision CMS — owner recovery (valid for 1 hour).\nOpen the CMS sign-in page, choose \"Recover owner access\" and enter this code with the owner's e-mail and a new password.\nDelete the RECOVER file when you are done.");
            mv_out(['ok' => true, 'setup' => $setup, 'recovery' => $rec, 'version' => MV_API_VERSION]);

        case 'GET auth/me':
            $u = mv_current();
            if (!$u) mv_fail(401, 'signed_out');
            mv_out(mv_me_payload($u, (string) $u['csrf']));

        case 'POST auth/login':
            mv_same_origin();
            mv_rate('login-ip', 20, 900);
            $b = mv_body();
            $email = mb_strtolower(mv_str($b['email'] ?? '', 190));
            $pass = is_string($b['password'] ?? null) ? $b['password'] : '';
            $code = mv_str($b['code'] ?? '', 12);
            $u = $email !== '' ? mv_user_by_email($email) : null;
            if (!$u || empty($u['pass_hash']) || !(int) $u['active']) {
                password_verify($pass, mv_dummy_hash());
                mv_auth_log('login_failed', $u, $email, !$u ? 'unknown e-mail' : (!(int) $u['active'] ? 'account disabled' : 'no password yet'));
                // answers like a real account would, lock included, so the reply does not tell whether the address exists
                $max = max(1, (int) mv_config()['login_max_failures']);
                $secs = max(60, (int) mv_config()['login_lock_seconds']);
                if ($email !== '' && !mv_rate('login-none', $max, $secs, true, $email)) {
                    mv_fail(423, 'locked', ['retryAfter' => $secs - (time() % $secs)]);
                }
                mv_fail(401, 'bad_credentials');
            }
            if ((int) $u['locked_until'] > time()) {
                password_verify($pass, mv_dummy_hash());
                mv_auth_log('login_locked', $u);
                mv_fail(423, 'locked', ['retryAfter' => (int) $u['locked_until'] - time()]);
            }
            if (!password_verify($pass, (string) $u['pass_hash'])) {
                mv_login_failure($u, 'wrong password');
                mv_fail(401, 'bad_credentials');
            }
            if (!empty($u['totp_secret'])) {
                if ($code === '') mv_fail(401, 'code_required');
                $step = mv_totp_check((string) $u['totp_secret'], $code, (int) $u['totp_last']);
                if ($step === null) {
                    mv_login_failure($u, 'wrong 2-step code');
                    mv_fail(401, 'code_bad');
                }
                mv_db()->prepare('UPDATE users SET totp_last = ? WHERE id = ?')->execute([$step, $u['id']]);
            }
            $set = ['failed = 0', 'locked_until = 0', 'last_login_at = ?'];
            $args = [mv_iso()];
            if (password_needs_rehash((string) $u['pass_hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT, defined('PASSWORD_ARGON2ID') ? ['memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1] : ['cost' => 11])) {
                $set[] = 'pass_hash = ?';
                $args[] = mv_hash_password($pass);
            }
            $args[] = $u['id'];
            mv_db()->prepare('UPDATE users SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
            $s = mv_session_start($u);
            mv_auth_log('login', $u);
            mv_out(mv_me_payload(mv_user((string) $u['id']), $s['csrf']));

        case 'POST auth/logout':
            $u = mv_current();
            if ($u) {
                mv_same_origin();
                mv_db()->prepare('UPDATE sessions SET revoked = 1 WHERE id = ?')->execute([$u['sid']]);
                mv_auth_log('logout', $u);
            }
            mv_set_cookie('', time() - 3600);
            mv_out(['ok' => true]);

        case 'POST auth/password':
            $u = mv_staff();
            mv_rate('password', 10, 900, false, (string) $u['id']);
            $b = mv_body();
            $cur = is_string($b['current'] ?? null) ? $b['current'] : '';
            $new = is_string($b['password'] ?? null) ? $b['password'] : '';
            if (!password_verify($cur, (string) $u['pass_hash'])) {
                mv_auth_log('password_change_failed', $u, '', 'wrong current password');
                mv_fail(401, 'bad_credentials');
            }
            if ($p = mv_password_problem($new, (string) $u['email'])) mv_fail(422, $p);
            mv_db()->prepare('UPDATE users SET pass_hash = ?, pass_changed_at = ?, updated_at = ? WHERE id = ?')->execute([mv_hash_password($new), mv_iso(), mv_iso(), $u['id']]);
            mv_revoke_sessions((string) $u['id'], (string) $u['sid']);
            mv_auth_log('password_changed', $u);
            mv_out(['ok' => true]);

        case 'POST auth/setup':
            mv_same_origin();
            mv_rate('setup', 10, 900);
            if (!mv_setup_needed()) mv_fail(409, 'already_set_up');
            $b = mv_body();
            $expect = mv_code_file('SETUP-CODE.txt', '');
            if (!hash_equals(strtoupper($expect), strtoupper(mv_str($b['code'] ?? '', 20)))) mv_fail(401, 'code_bad');
            $u = mv_create_user_from($b, 'owner', null);
            @unlink(mv_data_dir() . '/SETUP-CODE.txt');
            mv_auth_log('setup', $u, '', 'first owner account');
            $s = mv_session_start($u);
            mv_out(mv_me_payload($u, $s['csrf']));

        case 'POST auth/recover':
            mv_same_origin();
            mv_rate('recover', 10, 900);
            if (!mv_recovery_armed()) mv_fail(409, 'recovery_off');
            $b = mv_body();
            $expect = mv_code_file('RECOVERY-CODE.txt', '');
            if (!hash_equals(strtoupper($expect), strtoupper(mv_str($b['code'] ?? '', 20)))) mv_fail(401, 'code_bad');
            $u = mv_user_by_email(mb_strtolower(mv_str($b['email'] ?? '', 190)));
            if (!$u || $u['role'] !== 'owner') mv_fail(404, 'not_owner');
            $new = is_string($b['password'] ?? null) ? $b['password'] : '';
            if ($p = mv_password_problem($new, (string) $u['email'])) mv_fail(422, $p);
            mv_db()->prepare('UPDATE users SET pass_hash = ?, active = 1, failed = 0, locked_until = 0, totp_secret = NULL, totp_pending = NULL, pass_changed_at = ?, updated_at = ? WHERE id = ?')
                ->execute([mv_hash_password($new), mv_iso(), mv_iso(), $u['id']]);
            mv_revoke_sessions((string) $u['id']);
            @unlink(mv_data_dir() . '/RECOVERY-CODE.txt');
            @unlink(mv_data_dir() . '/RECOVER');
            mv_auth_log('recovered', $u, '', 'owner access recovered with the file code; 2-step sign-in switched off');
            $u = mv_user((string) $u['id']);
            $s = mv_session_start($u);
            mv_out(mv_me_payload($u, $s['csrf']));

        case 'POST auth/link-info':
            mv_same_origin();
            mv_rate('link', 30, 900);
            $t = mv_link_lookup(mv_str(mv_body()['token'] ?? '', 100));
            if (!$t) mv_fail(404, 'link_invalid');
            mv_out(['ok' => true, 'kind' => $t['kind'], 'email' => $t['email'], 'name' => $t['name'], 'expiresAt' => mv_iso((int) $t['expires_at'] * 1000)]);

        case 'POST auth/link-accept':
            mv_same_origin();
            mv_rate('link', 30, 900);
            $b = mv_body();
            $t = mv_link_lookup(mv_str($b['token'] ?? '', 100));
            if (!$t) mv_fail(404, 'link_invalid');
            $new = is_string($b['password'] ?? null) ? $b['password'] : '';
            if ($p = mv_password_problem($new, (string) $t['email'])) mv_fail(422, $p);
            mv_tx(function () use ($t, $new) {
                mv_db()->prepare('UPDATE tokens SET used_at = ? WHERE hash = ?')->execute([time(), $t['hash']]);
                mv_db()->prepare('UPDATE users SET pass_hash = ?, failed = 0, locked_until = 0, pass_changed_at = ?, updated_at = ? WHERE id = ?')
                    ->execute([mv_hash_password($new), mv_iso(), mv_iso(), $t['user_id']]);
            });
            mv_revoke_sessions((string) $t['user_id']);
            $u = mv_user((string) $t['user_id']);
            mv_auth_log($t['kind'] === 'invite' ? 'invite_accepted' : 'password_reset', $u);
            if (!(int) $u['active']) mv_out(['ok' => true, 'signedIn' => false]);
            // a new password does not replace the second step: an account with 2-step sign-in signs in the normal way
            if (!empty($u['totp_secret'])) mv_out(['ok' => true, 'signedIn' => false, 'needsCode' => true]);
            $s = mv_session_start($u);
            mv_out(mv_me_payload($u, $s['csrf']) + ['signedIn' => true]);

        case 'POST auth/totp/begin':
            $u = mv_staff();
            // moving 2-step to another phone means switching it off first, which asks for the password
            if (!empty(mv_user((string) $u['id'])['totp_secret'])) mv_fail(409, 'totp_on');
            $secret = mv_b32_encode(random_bytes(20));
            mv_db()->prepare('UPDATE users SET totp_pending = ? WHERE id = ?')->execute([$secret, $u['id']]);
            $label = rawurlencode('Miftari Vision CMS:' . $u['email']);
            mv_out(['ok' => true, 'secret' => $secret, 'uri' => "otpauth://totp/$label?secret=$secret&issuer=" . rawurlencode('Miftari Vision CMS') . '&digits=6&period=30']);

        case 'POST auth/totp/enable':
            $u = mv_staff();
            $row = mv_user((string) $u['id']);
            if (!empty($row['totp_secret'])) mv_fail(409, 'totp_on');
            $pending = (string) ($row['totp_pending'] ?? '');
            if ($pending === '') mv_fail(409, 'totp_not_started');
            mv_rate('totp', 10, 900, false, (string) $u['id']);
            $step = mv_totp_check($pending, mv_str(mv_body()['code'] ?? '', 12));
            if ($step === null) mv_fail(422, 'code_bad');
            mv_db()->prepare('UPDATE users SET totp_secret = ?, totp_pending = NULL, totp_last = ?, updated_at = ? WHERE id = ?')->execute([$pending, $step, mv_iso(), $u['id']]);
            mv_auth_log('totp_on', $u);
            mv_out(['ok' => true]);

        case 'POST auth/totp/disable':
            $u = mv_staff();
            // the same limit as changing the password: a stolen session must not be able to guess it here
            mv_rate('password', 10, 900, false, (string) $u['id']);
            $pw = mv_body()['password'] ?? '';
            if (!is_string($pw) || !password_verify($pw, (string) $u['pass_hash'])) {
                mv_auth_log('totp_off_failed', $u, '', 'wrong password');
                mv_fail(401, 'bad_credentials');
            }
            mv_db()->prepare('UPDATE users SET totp_secret = NULL, totp_pending = NULL, updated_at = ? WHERE id = ?')->execute([mv_iso(), $u['id']]);
            mv_auth_log('totp_off', $u);
            mv_out(['ok' => true]);
    }
    mv_fail(404, 'not_found');
}

function mv_login_failure(array $u, string $why): void
{
    $cfg = mv_config();
    $failed = (int) $u['failed'] + 1;
    if ($failed >= (int) $cfg['login_max_failures']) {
        mv_db()->prepare('UPDATE users SET failed = 0, locked_until = ? WHERE id = ?')->execute([time() + (int) $cfg['login_lock_seconds'], $u['id']]);
        mv_auth_log('locked', $u, '', "$why; locked for " . round((int) $cfg['login_lock_seconds'] / 60) . ' min');
    } else {
        mv_db()->prepare('UPDATE users SET failed = ? WHERE id = ?')->execute([$failed, $u['id']]);
        mv_auth_log('login_failed', $u, '', $why);
    }
}

/** Create a staff login from {name, email, password?} (setup creates the owner with a password). */
function mv_create_user_from(array $b, string $role, ?array $by): array
{
    $email = mb_strtolower(mv_str($b['email'] ?? '', 190));
    $name = mv_str($b['name'] ?? '', 120);
    if (!mv_email_ok($email)) mv_fail(422, 'email_invalid');
    if ($name === '') mv_fail(422, 'name_required');
    if (!in_array($role, MV_ROLES, true)) mv_fail(422, 'role_invalid');
    if (mv_user_by_email($email)) mv_fail(409, 'email_taken');
    $hash = null;
    if (array_key_exists('password', $b)) {
        $pw = is_string($b['password']) ? $b['password'] : '';
        if ($p = mv_password_problem($pw, $email)) mv_fail(422, $p);
        $hash = mv_hash_password($pw);
    }
    $id = mv_uid('u');
    $staffId = mv_str($b['staffId'] ?? '', 80);
    mv_db()->prepare('INSERT INTO users (id, staff_id, email, name, role, pass_hash, active, created_at, created_by, updated_at, pass_changed_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)')
        ->execute([$id, $staffId ?: null, $email, $name, $role, $hash, mv_iso(), $by['id'] ?? null, mv_iso(), $hash ? mv_iso() : null]);
    return mv_user($id);
}

/** A fresh invite / reset link for a user (older unused links of that user stop working). Returns the token. */
function mv_link_create(string $userId, string $kind, string $by): array
{
    $ttl = (int) mv_config()[$kind === 'invite' ? 'invite_ttl' : 'reset_ttl'];
    $tok = mv_token(24);
    $now = time();
    mv_db()->prepare('DELETE FROM tokens WHERE user_id = ? AND used_at IS NULL')->execute([$userId]);
    mv_db()->prepare('INSERT INTO tokens (hash, kind, user_id, created_at, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([hash('sha256', $tok), $kind, $userId, $now, $now + $ttl, $by]);
    return ['token' => $tok, 'expiresAt' => mv_iso(($now + $ttl) * 1000)];
}

function mv_link_lookup(string $tok): ?array
{
    if ($tok === '') return null;
    $q = mv_db()->prepare('SELECT t.*, u.email, u.name FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ? AND t.used_at IS NULL AND t.expires_at > ?');
    $q->execute([hash('sha256', $tok), time()]);
    return $q->fetch() ?: null;
}
