<?php
// Miftari Vision API — storage: one SQLite file in a private folder outside the web root.
//
// Shop data is kept as documents (one row per product, order, booking…; "$" rows for single values such as
// settings) with a revision number that grows on every write, so staff browsers can fetch only what changed.
declare(strict_types=1);

const MV_SCHEMA = 3;

/** The private data folder (created on first use). */
function mv_data_dir(): string
{
    static $dir = null;
    if (is_string($dir)) return $dir;
    $cfg = (string) mv_config()['data_dir'];
    $candidates = array_values(array_filter([
        $cfg,
        // next to public_html: /home/u…/domains/example.com/miftari-vision-data
        dirname(__DIR__, 3) . '/miftari-vision-data',
        // fallback inside the API folder; its .htaccess denies all web access
        dirname(__DIR__) . '/storage',
    ]));
    foreach ($candidates as $c) {
        if ((is_dir($c) || @mkdir($c, 0750, true)) && is_writable($c)) {
            $dir = rtrim(str_replace('\\', '/', $c), '/');
            // a stray copy of the folder inside the web root must never be served
            if (!is_file("$dir/.htaccess")) @file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n");
            if (!is_file("$dir/index.html")) @file_put_contents("$dir/index.html", '');
            return $dir;
        }
    }
    mv_fail(500, 'storage_unavailable');
}

function mv_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    if (!extension_loaded('pdo_sqlite')) mv_fail(500, 'sqlite_missing');
    $file = mv_data_dir() . '/miftari-vision.sqlite';
    $pdo = new PDO('sqlite:' . $file, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 10,
    ]);
    $pdo->exec('PRAGMA busy_timeout = 10000');
    $pdo->exec('PRAGMA foreign_keys = ON');
    // rollback journal (not WAL): safest on shared hosting file systems
    $pdo->exec('PRAGMA journal_mode = DELETE');
    $pdo->exec('PRAGMA synchronous = FULL');
    @chmod($file, 0640);
    mv_migrate($pdo);
    return $pdo;
}

function mv_migrate(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    $v = (int) ($pdo->query("SELECT v FROM meta WHERE k = 'schema'")->fetchColumn() ?: 0);
    if ($v >= MV_SCHEMA) return;
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $v = (int) ($pdo->query("SELECT v FROM meta WHERE k = 'schema'")->fetchColumn() ?: 0);
        if ($v < 1) {
            $pdo->exec(<<<'SQL'
                CREATE TABLE IF NOT EXISTS docs (
                    col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL, pos REAL NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (col, id)
                );
                CREATE INDEX IF NOT EXISTS docs_rev ON docs (rev);
                CREATE TABLE IF NOT EXISTS doc_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, col TEXT NOT NULL, doc TEXT NOT NULL,
                    rev INTEGER NOT NULL, op TEXT NOT NULL, by TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, staff_id TEXT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
                    role TEXT NOT NULL, pass_hash TEXT, active INTEGER NOT NULL DEFAULT 1,
                    totp_secret TEXT, totp_pending TEXT, totp_last INTEGER NOT NULL DEFAULT 0,
                    failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL, created_by TEXT, updated_at TEXT, last_login_at TEXT, pass_changed_at TEXT
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    csrf TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL,
                    ip TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '', revoked INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
                CREATE TABLE IF NOT EXISTS tokens (
                    hash TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, created_by TEXT
                );
                CREATE TABLE IF NOT EXISTS auth_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user_id TEXT, email TEXT NOT NULL DEFAULT '',
                    kind TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', actor TEXT
                );
                CREATE INDEX IF NOT EXISTS auth_events_user ON auth_events (user_id, id);
                CREATE TABLE IF NOT EXISTS consent_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '', channel TEXT NOT NULL, action TEXT NOT NULL, source TEXT NOT NULL,
                    actor TEXT NOT NULL DEFAULT 'visitor', lang TEXT NOT NULL DEFAULT '', wording TEXT NOT NULL DEFAULT '',
                    ref TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS consent_subject ON consent_events (subject, channel, id);
                CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, win INTEGER NOT NULL, n INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS uploads (
                    id TEXT PRIMARY KEY, path TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
                    width INTEGER, height INTEGER, at TEXT NOT NULL, by TEXT NOT NULL
                );
                SQL);
            $pdo->exec("INSERT OR IGNORE INTO meta (k, v) VALUES ('rev', '0')");
            $pdo->exec("INSERT OR IGNORE INTO meta (k, v) VALUES ('order_seq', '1000')");
        }
        if ($v < 2) {
            $pdo->exec('CREATE INDEX IF NOT EXISTS docs_col ON docs (col, deleted, pos)');
        }
        if ($v < 3) {
            $pdo->exec('CREATE INDEX IF NOT EXISTS consent_email ON consent_events (email)');
        }
        $pdo->prepare("INSERT INTO meta (k, v) VALUES ('schema', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([(string) MV_SCHEMA]);
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
}

/* ------------------------------------------------------------------ */
/* Meta & secrets                                                      */
/* ------------------------------------------------------------------ */

function mv_meta(string $k, ?string $default = null): ?string
{
    $q = mv_db()->prepare('SELECT v FROM meta WHERE k = ?');
    $q->execute([$k]);
    $v = $q->fetchColumn();
    return $v === false ? $default : (string) $v;
}

function mv_meta_set(string $k, string $v): void
{
    mv_db()->prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute([$k, $v]);
}

/** A per-purpose key derived from the installation's random master key (created on first use). */
function mv_secret(string $purpose): string
{
    static $master = null;
    if ($master === null) {
        $m = mv_meta('secret');
        if ($m === null) {
            $m = bin2hex(random_bytes(32));
            mv_db()->prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)')->execute(['secret', $m]);
            $m = mv_meta('secret');
        }
        $master = (string) $m;
    }
    return hash_hmac('sha256', $purpose, $master);
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

/** Run $fn inside one write transaction (all-or-nothing). Nested calls join the outer one. */
function mv_tx(callable $fn)
{
    static $depth = 0;
    $pdo = mv_db();
    if ($depth > 0) return $fn($pdo);
    $depth++;
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $out = $fn($pdo);
        $pdo->exec('COMMIT');
        return $out;
    } catch (Throwable $e) {
        try {
            $pdo->exec('ROLLBACK');
        } catch (Throwable) {
        }
        throw $e;
    } finally {
        $depth--;
    }
}

/** Next global revision (call inside mv_tx). */
function mv_next_rev(): int
{
    $pdo = mv_db();
    $pdo->exec("UPDATE meta SET v = CAST(v AS INTEGER) + 1 WHERE k = 'rev'");
    return (int) $pdo->query("SELECT v FROM meta WHERE k = 'rev'")->fetchColumn();
}

function mv_rev(): int
{
    return (int) (mv_meta('rev', '0') ?? 0);
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

const MV_SINGLE = '$';

function mv_json($v): string
{
    return json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE);
}

/**
 * json_decode() to arrays that keeps empty objects as objects: plain decoding turns {} into [] and the browser would
 * get back a list where it stored an object. Used for everything that passes documents back to the CMS unchanged.
 */
function mv_jd(string $json, int $depth = 512)
{
    return mv_jd_keep(json_decode($json, false, $depth));
}

function mv_jd_keep($v)
{
    if ($v instanceof stdClass) {
        $a = get_object_vars($v);
        if (!$a) return new ArrayObject();
        foreach ($a as $k => $x) $a[$k] = mv_jd_keep($x);
        return $a;
    }
    if (is_array($v)) {
        foreach ($v as $i => $x) $v[$i] = mv_jd_keep($x);
    }
    return $v;
}

/** One document (null when missing or deleted). */
function mv_doc(string $col, string $id): ?array
{
    $q = mv_db()->prepare('SELECT data, rev, pos FROM docs WHERE col = ? AND id = ? AND deleted = 0');
    $q->execute([$col, $id]);
    $r = $q->fetch();
    if (!$r) return null;
    return ['data' => json_decode((string) $r['data'], true), 'rev' => (int) $r['rev'], 'pos' => (float) $r['pos']];
}

function mv_doc_data(string $col, string $id, $default = null)
{
    $d = mv_doc($col, $id);
    return $d ? $d['data'] : $default;
}

/** Every live document of a collection, in list order. */
function mv_docs(string $col): array
{
    $q = mv_db()->prepare('SELECT data FROM docs WHERE col = ? AND deleted = 0 ORDER BY pos, id');
    $q->execute([$col]);
    $out = [];
    foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $raw) {
        $v = json_decode((string) $raw, true);
        if (is_array($v)) $out[] = $v;
    }
    return $out;
}

/**
 * Write (or delete with $data === null) a document; returns its new revision. $pos null keeps the current
 * position, or puts a new document first in its list (lists show newest first, as in the app).
 */
function mv_put(string $col, string $id, $data, string $by, ?float $pos = null, string $op = ''): int
{
    $pdo = mv_db();
    return mv_tx(function () use ($pdo, $col, $id, $data, $by, $pos, $op) {
        $rev = mv_next_rev();
        $at = mv_iso();
        if ($pos === null) {
            $q = $pdo->prepare('SELECT pos FROM docs WHERE col = ? AND id = ?');
            $q->execute([$col, $id]);
            $cur = $q->fetchColumn();
            if ($cur !== false) $pos = (float) $cur;
            else {
                $m = $pdo->prepare('SELECT MIN(pos) FROM docs WHERE col = ? AND deleted = 0');
                $m->execute([$col]);
                $min = $m->fetchColumn();
                $pos = $min === null || $min === false ? 0.0 : (float) $min - 1;
            }
        }
        $deleted = $data === null ? 1 : 0;
        $json = $data === null ? 'null' : mv_json($data);
        $pdo->prepare(
            'INSERT INTO docs (col, id, data, rev, pos, updated_at, updated_by, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(col, id) DO UPDATE SET data = excluded.data, rev = excluded.rev, pos = excluded.pos,
               updated_at = excluded.updated_at, updated_by = excluded.updated_by, deleted = excluded.deleted'
        )->execute([$col, $id, $json, $rev, $pos, $at, $by, $deleted]);
        $pdo->prepare('INSERT INTO doc_log (at, col, doc, rev, op, by) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$at, $col, $id, $rev, $op !== '' ? $op : ($deleted ? 'delete' : 'put'), $by]);
        return $rev;
    });
}

/** Append to a capped list collection (audit trail, stock movements): the oldest rows beyond $max are dropped. */
function mv_append(string $col, array $item, string $by, int $max): void
{
    mv_put($col, (string) $item['id'], $item, $by);
    $pdo = mv_db();
    $n = (int) $pdo->query('SELECT COUNT(*) FROM docs WHERE col = ' . $pdo->quote($col) . ' AND deleted = 0')->fetchColumn();
    if ($n > $max) {
        $q = $pdo->prepare('SELECT id FROM docs WHERE col = ? AND deleted = 0 ORDER BY pos DESC, id DESC LIMIT ?');
        $q->execute([$col, $n - $max]);
        foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $old) mv_put($col, (string) $old, null, $by, null, 'trim');
    }
}

function mv_single(string $key, $default = null)
{
    return mv_doc_data(MV_SINGLE, $key, $default);
}

function mv_set_single(string $key, $value, string $by): int
{
    return mv_put(MV_SINGLE, $key, $value, $by, 0.0);
}
