<?php
// Miftari Vision API — marketing consent: every sign-up, opt-in at checkout, change by staff and unsubscribe is kept
// as an event (who, when, how, what they were shown). The CRM profile shows the latest decision per channel.
declare(strict_types=1);

const MV_CHANNELS = ['email', 'sms', 'whatsapp', 'viber'];

function mv_migrate_consent(): void
{
    static $done = false;
    if ($done) return;
    mv_db()->exec('CREATE TABLE IF NOT EXISTS subscribers (id TEXT PRIMARY KEY, subject TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)');
    $done = true;
}

/** The random id that stands for a person in unsubscribe links (no e-mail address in the URL). */
function mv_subscriber_id(string $subject): string
{
    mv_migrate_consent();
    $q = mv_db()->prepare('SELECT id FROM subscribers WHERE subject = ?');
    $q->execute([$subject]);
    $id = $q->fetchColumn();
    if ($id) return (string) $id;
    $id = mv_token(16);
    mv_db()->prepare('INSERT OR IGNORE INTO subscribers (id, subject, created_at) VALUES (?, ?, ?)')->execute([$id, $subject, mv_iso()]);
    $q->execute([$subject]);
    return (string) $q->fetchColumn();
}

/** Absolute unsubscribe link for a person (for newsletters: one per recipient). */
function mv_unsubscribe_url(string $subject): string
{
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $api = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'))), '/');
    return (mv_https() ? 'https://' : 'http://') . $host . $api . '/unsubscribe?u=' . rawurlencode(mv_subscriber_id($subject));
}

/** Latest decision per channel for one person. */
function mv_consent_state(string $subject): array
{
    $q = mv_db()->prepare('SELECT channel, action, at, source FROM consent_events WHERE subject = ? ORDER BY id');
    $q->execute([$subject]);
    $out = [];
    foreach ($q->fetchAll() as $r) $out[$r['channel']] = $r;
    return $out;
}

/**
 * Record one consent event and show it on the customer's CRM profile.
 * $e: subject, email, phone, channel, action (subscribe|unsubscribe), source, actor, lang, wording, ref, note.
 */
function mv_consent_record(array $e): void
{
    $subject = (string) $e['subject'];
    if ($subject === '' || !in_array($e['channel'], MV_CHANNELS, true) || !in_array($e['action'], ['subscribe', 'unsubscribe'], true)) return;
    $at = mv_iso();
    $ip = mv_ip();
    mv_tx(function () use ($e, $subject, $at, $ip) {
        mv_db()->prepare('INSERT INTO consent_events (at, subject, email, phone, channel, action, source, actor, lang, wording, ref, ip, ua, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([
                $at, $subject, (string) ($e['email'] ?? ''), (string) ($e['phone'] ?? ''), $e['channel'], $e['action'], (string) $e['source'],
                (string) ($e['actor'] ?? 'visitor'), (string) ($e['lang'] ?? ''), mb_substr((string) ($e['wording'] ?? ''), 0, 600),
                (string) ($e['ref'] ?? ''), ($e['actor'] ?? 'visitor') === 'visitor' ? mv_ip_short($ip) : '', ($e['actor'] ?? 'visitor') === 'visitor' ? mv_ua() : '',
                mb_substr((string) ($e['note'] ?? ''), 0, 300),
            ]);
        // the CRM profile (what the customer list shows)
        $profile = mv_doc_data('crm_profiles', $subject) ?? ['tags' => [], 'notes' => []];
        $crmSource = ['checkout' => 'checkout', 'staff' => 'staff', 'import' => 'import', 'newsletter' => 'newsletter', 'link' => 'link'][$e['source']] ?? 'form';
        $consent = ['status' => $e['action'] === 'subscribe' ? 'subscribed' : 'unsubscribed', 'at' => $at, 'source' => $crmSource];
        if (($e['actor'] ?? 'visitor') !== 'visitor') $consent['by'] = (string) $e['actor'];
        $profile['marketing'] = (is_array($profile['marketing'] ?? null) ? $profile['marketing'] : []);
        $profile['marketing'][$e['channel']] = $consent;
        mv_put('crm_profiles', $subject, $profile, 'web');
        // someone who only signed up for the newsletter still appears in the customer list
        if (($e['source'] ?? '') === 'newsletter' && !mv_doc('crm_manual', $subject) && !mv_has_orders((string) ($e['email'] ?? ''))) {
            mv_put('crm_manual', $subject, [
                'key' => $subject, 'firstName' => '', 'lastName' => '', 'email' => (string) ($e['email'] ?? ''), 'phone' => (string) ($e['phone'] ?? ''),
                'city' => '', 'address' => '', 'lang' => mv_lang($e['lang'] ?? 'sq'), 'source' => 'newsletter', 'createdAt' => $at,
            ], 'web');
        }
    });
}

function mv_has_orders(string $email): bool
{
    if ($email === '') return false;
    $needle = '%' . strtr(substr(mv_json(['email' => $email]), 1, -1), ['\\' => '\\\\', '%' => '\\%', '_' => '\\_']) . '%';
    $q = mv_db()->prepare("SELECT COUNT(*) FROM docs WHERE col = 'orders' AND deleted = 0 AND data LIKE ? ESCAPE '\\'");
    $q->execute([$needle]);
    return (int) $q->fetchColumn() > 0;
}

/* ------------------------------------------------------------------ */
/* Visitors                                                            */
/* ------------------------------------------------------------------ */

/** POST subscribe — {email, lang, wording}: newsletter sign-up from the site. */
function mv_route_subscribe(): never
{
    mv_same_origin();
    mv_rate('subscribe', 8, 3600);
    $b = mv_body();
    if (mv_str($b['website'] ?? '', 50) !== '') mv_out(['ok' => true]); // form trap filled by a bot
    $email = mb_strtolower(mv_str($b['email'] ?? '', 190));
    if (!mv_email_ok($email)) mv_fail(422, 'email_invalid');
    $subject = mv_subject_key($email, '');
    $state = mv_consent_state($subject);
    if (($state['email']['action'] ?? '') !== 'subscribe') {
        mv_consent_record([
            'subject' => $subject, 'email' => $email, 'channel' => 'email', 'action' => 'subscribe', 'source' => 'newsletter',
            'lang' => mv_lang($b['lang'] ?? 'sq'), 'wording' => mv_str($b['wording'] ?? '', 600),
        ]);
    }
    mv_out(['ok' => true]);
}

/** GET unsubscribe?u=… shows a confirm page; POST (the page's button, or a mail app's one-click) unsubscribes. */
function mv_route_unsubscribe(): never
{
    mv_migrate_consent();
    $id = mv_str($_GET['u'] ?? $_POST['u'] ?? '', 40);
    $q = mv_db()->prepare('SELECT subject FROM subscribers WHERE id = ?');
    $q->execute([$id]);
    $subject = (string) ($q->fetchColumn() ?: '');
    $lang = 'sq';
    if ($subject !== '') {
        $l = mv_db()->prepare("SELECT lang FROM consent_events WHERE subject = ? AND lang <> '' ORDER BY id DESC LIMIT 1");
        $l->execute([$subject]);
        $lang = mv_lang($l->fetchColumn() ?: 'sq');
    }
    $al = strtolower((string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));
    if (isset($_GET['lang'])) $lang = mv_lang($_GET['lang']);
    elseif (str_starts_with($al, 'en')) $lang = 'en';
    $T = [
        'sq' => ['title' => 'Çregjistrohu nga lajmet', 'ask' => 'Nuk dëshironi më e-mail me lajme dhe oferta nga Miftari Vision?', 'btn' => 'Po, çregjistromë', 'done' => 'U çregjistruat. Nuk do t’ju dërgojmë më lajme me e-mail.', 'bad' => 'Lidhja nuk është e vlefshme ose ka skaduar.'],
        'en' => ['title' => 'Unsubscribe from news', 'ask' => 'No longer want news and offers by e-mail from Miftari Vision?', 'btn' => 'Yes, unsubscribe me', 'done' => 'You are unsubscribed. We will not send you news by e-mail any more.', 'bad' => 'This link is not valid or has expired.'],
        'me' => ['title' => 'Odjava sa vesti', 'ask' => 'Više ne želite vesti i ponude e-poštom od Miftari Vision?', 'btn' => 'Da, odjavi me', 'done' => 'Odjavljeni ste. Više vam nećemo slati vesti e-poštom.', 'bad' => 'Link nije važeći ili je istekao.'],
    ][$lang];
    $msg = '';
    $form = false;
    if ($subject === '') $msg = $T['bad'];
    elseif (mv_method() === 'POST') {
        mv_rate('unsubscribe', 30, 3600);
        if ((mv_consent_state($subject)['email']['action'] ?? '') !== 'unsubscribe') {
            $email = str_contains($subject, '@') ? $subject : '';
            mv_consent_record(['subject' => $subject, 'email' => $email, 'channel' => 'email', 'action' => 'unsubscribe', 'source' => 'link', 'lang' => $lang, 'wording' => $T['btn']]);
        }
        $msg = $T['done'];
    } else $form = true;
    http_response_code($subject === '' ? 404 : 200);
    mv_headers_common();
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    $h = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="' . $h($lang) . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
        . '<title>' . $h($T['title']) . '</title><style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f6f4ef;color:#1d2420;display:grid;place-items:center;min-height:100vh}'
        . 'main{max-width:420px;margin:24px;padding:32px;background:#fff;border-radius:20px;box-shadow:0 10px 40px #0001}h1{font-size:22px;margin:0 0 12px}'
        . 'button{margin-top:20px;font:inherit;font-weight:600;padding:12px 20px;border:0;border-radius:999px;background:#2c4a3a;color:#fff;cursor:pointer}</style></head><body><main>'
        . '<h1>' . $h($T['title']) . '</h1>'
        . ($form ? '<p>' . $h($T['ask']) . '</p><form method="post" action="?u=' . $h(rawurlencode($id)) . '&amp;lang=' . $h($lang) . '"><input type="hidden" name="u" value="' . $h($id) . '"><button type="submit">' . $h($T['btn']) . '</button></form>' : '<p>' . $h($msg) . '</p>')
        . '</main></body></html>';
    exit;
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

function mv_route_consent(string $path, array $me): never
{
    $m = mv_method();
    if ("$m $path" === 'GET admin/consent') {
        if (!mv_can((string) $me['role'], 'customers', 'view')) mv_fail(403, 'forbidden');
        $key = mb_strtolower(mv_str($_GET['key'] ?? '', 190));
        $q = mv_db()->prepare('SELECT id, at, channel, action, source, actor, lang, wording, ref, note, ip FROM consent_events WHERE subject = ? ORDER BY id DESC LIMIT 200');
        $q->execute([$key]);
        mv_out(['ok' => true, 'events' => $q->fetchAll()]);
    }
    if ("$m $path" === 'POST admin/consent') {
        if (!mv_can((string) $me['role'], 'customers', 'edit')) mv_fail(403, 'forbidden');
        $b = mv_body();
        $key = mb_strtolower(mv_str($b['key'] ?? '', 190));
        $channel = (string) ($b['channel'] ?? '');
        $action = (string) ($b['action'] ?? '');
        if ($key === '' || !in_array($channel, MV_CHANNELS, true) || !in_array($action, ['subscribe', 'unsubscribe'], true)) mv_fail(422, 'invalid');
        mv_consent_record([
            'subject' => $key, 'email' => mv_str($b['email'] ?? (str_contains($key, '@') ? $key : ''), 190), 'phone' => mv_str($b['phone'] ?? '', 40),
            'channel' => $channel, 'action' => $action, 'source' => 'staff', 'actor' => (string) ($me['staff_id'] ?: $me['id']), 'note' => mv_str($b['note'] ?? '', 300),
        ]);
        mv_out(['ok' => true, 'state' => mv_consent_state($key)]);
    }
    if ("$m $path" === 'GET admin/subscribers') {
        if (!mv_can((string) $me['role'], 'customers', 'export') && !mv_can((string) $me['role'], 'customers', 'view')) mv_fail(403, 'forbidden');
        $channel = in_array($_GET['channel'] ?? 'email', MV_CHANNELS, true) ? (string) ($_GET['channel'] ?? 'email') : 'email';
        $q = mv_db()->prepare('SELECT e.* FROM consent_events e JOIN (SELECT subject, MAX(id) AS id FROM consent_events WHERE channel = ? GROUP BY subject) last ON last.id = e.id ORDER BY e.at DESC');
        $q->execute([$channel]);
        $rows = [];
        foreach ($q->fetchAll() as $r) {
            $first = mv_db()->prepare("SELECT MIN(at) FROM consent_events WHERE subject = ? AND channel = ? AND action = 'subscribe'");
            $first->execute([$r['subject'], $channel]);
            $rows[] = [
                'key' => $r['subject'], 'email' => $r['email'] ?: (str_contains($r['subject'], '@') ? $r['subject'] : ''), 'phone' => $r['phone'],
                'status' => $r['action'] === 'subscribe' ? 'subscribed' : 'unsubscribed', 'since' => $r['at'], 'firstSubscribed' => $first->fetchColumn() ?: null,
                'source' => $r['source'], 'lang' => $r['lang'],
                'unsubscribeUrl' => $r['action'] === 'subscribe' && $channel === 'email' ? mv_unsubscribe_url((string) $r['subject']) : '',
            ];
        }
        if (($_GET['format'] ?? '') === 'csv') {
            if (!mv_can((string) $me['role'], 'customers', 'export')) mv_fail(403, 'forbidden');
            mv_auth_log('subscribers_export', $me, '', "$channel, " . count($rows) . ' rows');
            http_response_code(200);
            mv_headers_common();
            header('Content-Type: text/csv; charset=utf-8');
            header('Cache-Control: no-store');
            header('Content-Disposition: attachment; filename="subscribers-' . $channel . '-' . gmdate('Y-m-d') . '.csv"');
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['email', 'phone', 'status', 'since', 'first_subscribed', 'source', 'language', 'unsubscribe_url']);
            foreach ($rows as $r) {
                // a leading = + - @ would run as a formula in spreadsheet apps
                $cells = array_map(fn($v) => preg_match('/^[=+\-@\t\r]/', (string) $v) ? "'" . $v : (string) $v, [$r['email'], $r['phone'], $r['status'], $r['since'], $r['firstSubscribed'], $r['source'], $r['lang'], $r['unsubscribeUrl']]);
                fputcsv($out, $cells);
            }
            fclose($out);
            exit;
        }
        mv_out(['ok' => true, 'channel' => $channel, 'subscribers' => $rows]);
    }
    mv_fail(404, 'not_found');
}
