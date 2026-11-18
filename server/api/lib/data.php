<?php
// Miftari Vision API — shop data for visitors (public snapshot) and staff (full snapshot, sync, change feed,
// backup export / import).
declare(strict_types=1);

/* ------------------------------------------------------------------ */
/* Public snapshot: what every visitor's browser needs, nothing more   */
/* ------------------------------------------------------------------ */

const MV_PRIVATE_SETTINGS = ['adminEmail', 'integrations', 'notifications'];

function mv_public_settings(array $s): array
{
    foreach (MV_PRIVATE_SETTINGS as $k) unset($s[$k]);
    return $s;
}

function mv_public_product(array $p): array
{
    unset($p['cost'], $p['barcode'], $p['incoming']);
    return $p;
}

/** Code discounts stay private unless an offer the shop has published advertises them. */
function mv_public_discounts(array $discounts, array $offers): array
{
    $advertised = [];
    foreach ($offers as $o) {
        if (($o['status'] ?? 'draft') !== 'draft' && !empty($o['discountId'])) $advertised[(string) $o['discountId']] = true;
    }
    $out = [];
    foreach ($discounts as $d) {
        if (($d['status'] ?? '') === 'draft') continue;
        if (($d['method'] ?? 'auto') === 'code' && empty($advertised[(string) ($d['id'] ?? '')])) continue;
        $out[] = mv_public_discount($d);
    }
    return $out;
}

function mv_public_discount(array $d): array
{
    unset($d['tags'], $d['note'], $d['notes'], $d['createdBy']);
    return $d;
}

function mv_public_offer(array $o): array
{
    if (isset($o['metrics']) && is_array($o['metrics'])) {
        foreach ($o['metrics'] as $k => $v) if (is_int($v) || is_float($v)) $o['metrics'][$k] = 0;
    }
    unset($o['notes'], $o['note'], $o['owner'], $o['approvals']);
    return $o;
}

/** Booked times without anyone's details: enough to show which slots are taken. */
function mv_public_bookings(array $bookings): array
{
    $from = mv_ms() - 86400000;
    $out = [];
    foreach ($bookings as $b) {
        if (!in_array($b['status'] ?? '', ['pending', 'confirmed', 'done'], true)) continue;
        $t = mv_parse_ms($b['start'] ?? null);
        if ($t === null || $t < $from) continue;
        $out[] = [
            'id' => (string) $b['id'], 'serviceId' => (string) ($b['serviceId'] ?? ''), 'staffId' => (string) ($b['staffId'] ?? ''),
            'customerName' => '', 'phone' => '', 'start' => (string) $b['start'], 'durationMin' => (int) ($b['durationMin'] ?? 60),
            'status' => (string) $b['status'], 'location' => (string) ($b['location'] ?? ''), 'createdAt' => (string) ($b['createdAt'] ?? ''),
        ];
    }
    return $out;
}

function mv_public_staff(array $staff): array
{
    $out = [];
    foreach ($staff as $m) {
        $out[] = [
            'id' => (string) $m['id'], 'name' => (string) ($m['name'] ?? ''), 'email' => '', 'role' => (string) ($m['role'] ?? 'reception'),
            'color' => (string) ($m['color'] ?? ''), 'active' => (bool) ($m['active'] ?? true),
        ] + (isset($m['title']) ? ['title' => $m['title']] : []);
    }
    return $out;
}

function mv_public_build(): array
{
    $offers = mv_docs('offers');
    $settings = mv_single('settings');
    return [
        'version' => mv_single('version'),
        'seededAt' => mv_single('seededAt'),
        'settings' => is_array($settings) ? mv_public_settings($settings) : null,
        'categories' => mv_docs('categories'),
        'products' => array_values(array_map('mv_public_product', array_filter(mv_docs('products'), fn($p) => ($p['status'] ?? '') === 'active'))),
        'collections' => array_values(array_filter(mv_docs('collections'), fn($c) => !empty($c['published']))),
        'discounts' => mv_public_discounts(mv_docs('discounts'), $offers),
        'offers' => array_values(array_map('mv_public_offer', array_filter($offers, fn($o) => ($o['status'] ?? 'draft') !== 'draft'))),
        'placements' => mv_docs('placements'),
        'pages' => array_values(array_filter(mv_docs('pages'), fn($p) => !empty($p['published']))),
        'posts' => array_values(array_filter(mv_docs('posts'), fn($p) => !empty($p['published']))),
        'projects' => mv_docs('projects'),
        'home' => mv_single('home', []),
        'menus' => mv_docs('menus'),
        'services' => mv_docs('services'),
        'staff' => mv_public_staff(mv_docs('staff')),
        'bookings' => mv_public_bookings(mv_docs('bookings')),
    ];
}

/** GET public — cached per data revision; browsers revalidate with the ETag (304 when nothing changed). */
function mv_route_public(): never
{
    $rev = mv_rev();
    $etag = '"p' . $rev . '-' . MV_API_VERSION . '"';
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        mv_headers_common();
        header("ETag: $etag");
        header('Cache-Control: no-cache');
        exit;
    }
    $dir = mv_data_dir() . '/cache';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $file = "$dir/public-$rev.json";
    $json = is_file($file) ? (string) file_get_contents($file) : '';
    if ($json === '') {
        $json = mv_json(['ok' => true, 'rev' => $rev, 'ready' => mv_single('settings') !== null] + mv_public_build());
        @file_put_contents("$file.tmp", $json);
        @rename("$file.tmp", $file);
        foreach (glob("$dir/public-*.json") ?: [] as $old) if ($old !== $file) @unlink($old);
    }
    http_response_code(200);
    mv_headers_common();
    header('Content-Type: application/json; charset=utf-8');
    header("ETag: $etag");
    header('Cache-Control: no-cache');
    if (extension_loaded('zlib') && !ini_get('zlib.output_compression') && str_contains((string) ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? ''), 'gzip')) {
        header('Content-Encoding: gzip');
        header('Vary: Accept-Encoding');
        echo gzencode($json, 6);
    } else {
        echo $json;
    }
    exit;
}

/* ------------------------------------------------------------------ */
/* Staff snapshot & change feed                                        */
/* ------------------------------------------------------------------ */

function mv_staff_doc(array $user, string $col, $data)
{
    if ($col === 'products' && is_array($data) && !mv_can((string) $user['role'], 'products', 'viewCost')) return mv_strip_cost($data);
    return $data;
}

/** GET admin/snapshot — every document with its revision and list position. */
function mv_route_snapshot(array $user): never
{
    $pdo = mv_db();
    $rev = mv_rev();
    $lists = [];
    $singles = [];
    $q = $pdo->query('SELECT col, id, data, rev, pos FROM docs WHERE deleted = 0 ORDER BY col, pos, id');
    foreach ($q as $r) {
        $data = mv_jd((string) $r['data']);
        if ($r['col'] === MV_SINGLE) $singles[$r['id']] = [(int) $r['rev'], $data];
        else $lists[$r['col']][] = [(string) $r['id'], (int) $r['rev'], (float) $r['pos'], mv_staff_doc($user, (string) $r['col'], $data)];
    }
    mv_out(['ok' => true, 'rev' => $rev, 'lists' => (object) $lists, 'singles' => (object) $singles]);
}

/** GET admin/changes?since=N — documents written after revision N (deleted ones flagged). */
function mv_route_changes(array $user): never
{
    $since = max(0, (int) ($_GET['since'] ?? 0));
    $q = mv_db()->prepare('SELECT col, id, data, rev, pos, deleted FROM docs WHERE rev > ? ORDER BY rev LIMIT 1001');
    $q->execute([$since]);
    $rows = $q->fetchAll();
    $more = count($rows) > 1000;
    if ($more) array_pop($rows);
    $out = [];
    foreach ($rows as $r) {
        $data = (int) $r['deleted'] ? null : mv_staff_doc($user, (string) $r['col'], mv_jd((string) $r['data']));
        $out[] = [(string) $r['col'], (string) $r['id'], (int) $r['rev'], (float) $r['pos'], (int) $r['deleted'], $data];
    }
    $last = $rows ? (int) end($rows)['rev'] : max($since, mv_rev());
    mv_out(['ok' => true, 'rev' => $more ? $last : max($last, mv_rev()), 'more' => $more, 'docs' => $out]);
}

/* ------------------------------------------------------------------ */
/* Sync: staff browsers send what they changed                         */
/* ------------------------------------------------------------------ */

/** Arrays whose entries only ever get added (order history, notes): concurrent additions are kept from both sides. */
const MV_APPEND_KEYS = ['timeline', 'notes', 'history', 'events'];

/**
 * Three-way merge of top-level fields: what this editor changed wins, what someone else changed meanwhile is kept.
 * Returns [merged, list of fields both changed].
 */
function mv_merge(?array $base, ?array $mine, ?array $theirs): array
{
    if ($mine === null) return [null, []];
    if ($theirs === null || $base === null) return [$mine, []];
    $out = $theirs;
    $clash = [];
    foreach (array_unique(array_merge(array_keys($base), array_keys($mine), array_keys($theirs))) as $k) {
        $b = array_key_exists($k, $base) ? mv_json($base[$k]) : null;
        $m = array_key_exists($k, $mine) ? mv_json($mine[$k]) : null;
        $t = array_key_exists($k, $theirs) ? mv_json($theirs[$k]) : null;
        if ($m === $b) continue; // I did not touch it: keep theirs
        if ($t !== $b && $t !== $m) {
            if (in_array($k, MV_APPEND_KEYS, true) && is_array($mine[$k] ?? null) && is_array($theirs[$k] ?? null)) {
                $seen = [];
                $union = [];
                foreach (array_merge($mine[$k], $theirs[$k]) as $e) {
                    $j = mv_json($e);
                    if (isset($seen[$j])) continue;
                    $seen[$j] = true;
                    $union[] = $e;
                }
                $out[$k] = $union;
                continue;
            }
            $clash[] = $k;
        }
        if (array_key_exists($k, $mine)) $out[$k] = $mine[$k];
        else unset($out[$k]);
    }
    return [$out, $clash];
}

function mv_raw_doc(string $col, string $id): ?array
{
    $q = mv_db()->prepare('SELECT data, rev, deleted FROM docs WHERE col = ? AND id = ?');
    $q->execute([$col, $id]);
    $r = $q->fetch();
    if (!$r) return null;
    return ['data' => (int) $r['deleted'] ? null : mv_jd((string) $r['data']), 'rev' => (int) $r['rev']];
}

/** POST admin/sync — {ops: [{col, id, base, prev?, data|null, pos?}]}; singles use col "$" and the key as id. */
function mv_route_sync(array $user): never
{
    $ops = mv_body()['ops'] ?? null;
    if (!is_array($ops) || count($ops) > 500) mv_fail(422, 'ops_invalid');
    $role = (string) $user['role'];
    $by = (string) ($user['staff_id'] ?: $user['id']);
    $cols = mv_collections();
    $results = mv_tx(function () use ($ops, $role, $by, $cols, $user) {
        $res = [];
        foreach ($ops as $op) {
            $col = is_string($op['col'] ?? null) ? $op['col'] : '';
            $id = is_string($op['id'] ?? null) ? $op['id'] : '';
            $data = $op['data'] ?? null;
            if ($id === '' || strlen($id) > 160 || ($data !== null && !is_array($data) && $col !== MV_SINGLE)) {
                $res[] = ['col' => $col, 'id' => $id, 'status' => 'rejected', 'reason' => 'invalid'];
                continue;
            }
            $single = $col === MV_SINGLE;
            if (!$single && !isset($cols[$col])) {
                $res[] = ['col' => $col, 'id' => $id, 'status' => 'rejected', 'reason' => 'unknown_collection'];
                continue;
            }
            if ($single && !isset(mv_singles()[$id])) {
                $res[] = ['col' => $col, 'id' => $id, 'status' => 'rejected', 'reason' => 'unknown_single'];
                continue;
            }
            $cur = mv_raw_doc($col, $id);
            $curData = $cur['data'] ?? null;
            $base = (int) ($op['base'] ?? 0);
            // append-only logs: new entries only; the browser trimming its copy is not a delete
            if (!$single && isset($cols[$col]['append'])) {
                if ($data === null || $cur !== null) {
                    $res[] = ['col' => $col, 'id' => $id, 'status' => 'ignored'];
                    continue;
                }
                $data[$cols[$col]['id']] = $id;
                mv_append($col, $data, $by, (int) $cols[$col]['append']);
                $res[] = ['col' => $col, 'id' => $id, 'status' => 'ok', 'rev' => mv_rev()];
                continue;
            }
            // concurrent edit: merge field by field against the version this editor started from
            $clash = [];
            $merged = $data;
            if ($cur !== null && $cur['rev'] !== $base) {
                $prev = is_array($op['prev'] ?? null) ? $op['prev'] : null;
                if (!$single || $id === 'settings') [$merged, $clash] = mv_merge($prev, is_array($data) ? $data : null, is_array($curData) ? $curData : null);
            }
            // roles that never saw the purchase cost (stripped from their copy) keep it as it is
            if ($col === 'products' && is_array($merged) && is_array($curData) && array_key_exists('cost', $curData) && !mv_can($role, 'products', 'viewCost')) {
                $merged['cost'] = $curData['cost'];
            }
            $problem = $single ? mv_single_problem($role, $id, $curData, $merged) : mv_write_problem($role, $col, is_array($curData) ? $curData : null, is_array($merged) ? $merged : null);
            if ($problem === '' && !$single) $problem = mv_guard_doc($col, $id, is_array($curData) ? $curData : null, is_array($merged) ? $merged : null, $user);
            if ($problem !== '') {
                $res[] = ['col' => $col, 'id' => $id, 'status' => 'rejected', 'reason' => $problem, 'rev' => $cur['rev'] ?? 0, 'data' => $curData];
                continue;
            }
            if (!$single && is_array($merged)) {
                $idKey = (string) $cols[$col]['id'];
                if ($idKey !== '') $merged[$idKey] = $id;
                if (strlen(mv_json($merged)) > 2 * 1024 * 1024) {
                    $res[] = ['col' => $col, 'id' => $id, 'status' => 'rejected', 'reason' => 'too_large', 'rev' => $cur['rev'] ?? 0, 'data' => $curData];
                    continue;
                }
            }
            $rewritten = false;
            if ($col === 'orders' && $cur === null && is_array($merged)) [$merged, $rewritten] = mv_unique_order_number($merged);
            $pos = isset($op['pos']) && is_numeric($op['pos']) ? (float) $op['pos'] : null;
            $rev = mv_put($col, $id, $merged, $by, $single ? 0.0 : $pos);
            if ($col === 'staff') mv_mirror_staff($id, is_array($merged) ? $merged : null, (string) $user['id']);
            // what this editor gets back is their own view of the document (no purchase cost for cost-blind roles)
            $view = $single ? $merged : mv_staff_doc($user, $col, $merged);
            $differs = $rewritten || mv_json($view) !== mv_json($data);
            $out = ['col' => $col, 'id' => $id, 'status' => $clash || $differs ? 'merged' : 'ok', 'rev' => $rev];
            if ($clash) $out['clash'] = $clash;
            if ($differs) $out['data'] = $view;
            $res[] = $out;
        }
        return $res;
    });
    mv_out(['ok' => true, 'results' => $results]);
}

/** Rules that hold whoever writes: the shop always keeps a signed-in owner; order numbers stay unique. */
function mv_guard_doc(string $col, string $id, ?array $old, ?array $new, array $user): string
{
    if ($col === 'staff') {
        $q = mv_db()->prepare('SELECT id FROM users WHERE staff_id = ? AND role = ? AND active = 1');
        $q->execute([$id, 'owner']);
        $linkedOwner = $q->fetchColumn();
        if ($linkedOwner && ($new === null || ($new['role'] ?? '') !== 'owner') && mv_owner_count((string) $linkedOwner) === 0) return 'last_owner';
    }
    return '';
}

/** A staff member's role in the CMS team list is the role of their sign-in account. */
function mv_mirror_staff(string $staffId, ?array $staff, string $by): void
{
    if ($staff === null) return;
    $role = (string) ($staff['role'] ?? '');
    if (!in_array($role, MV_ROLES, true)) return;
    $q = mv_db()->prepare('SELECT * FROM users WHERE staff_id = ?');
    $q->execute([$staffId]);
    foreach ($q->fetchAll() as $u) {
        if ($u['role'] === $role) continue;
        mv_db()->prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')->execute([$role, mv_iso(), $u['id']]);
        mv_auth_log('role_changed', $u, '', "{$u['role']} → $role (team list)", $by);
    }
}

/** Two staff browsers may number new orders the same way at once: the later one gets the next free number. */
function mv_unique_order_number(array $order): array
{
    $num = (string) ($order['number'] ?? '');
    if ($num === '' || !mv_order_number_taken($num)) return [$order, false];
    if (!preg_match('/^(.*?)(\d+)$/', $num, $m)) return [$order, false];
    $n = (int) $m[2];
    do $n++; while (mv_order_number_taken($m[1] . $n));
    $order['number'] = $m[1] . $n;
    return [$order, true];
}

/** Is an order number in use? (Stored JSON is always written by this API, so the field's text form is predictable.) */
function mv_order_number_taken(string $num): bool
{
    $needle = '%' . strtr(substr(mv_json(['number' => $num]), 1, -1), ['\\' => '\\\\', '%' => '\\%', '_' => '\\_']) . '%';
    $q = mv_db()->prepare("SELECT COUNT(*) FROM docs WHERE col = 'orders' AND deleted = 0 AND data LIKE ? ESCAPE '\\'");
    $q->execute([$needle]);
    return (int) $q->fetchColumn() > 0;
}

/* ------------------------------------------------------------------ */
/* Backup export & first import                                        */
/* ------------------------------------------------------------------ */

function mv_docs_empty(): bool
{
    return (int) mv_db()->query('SELECT COUNT(*) FROM docs WHERE deleted = 0')->fetchColumn() === 0;
}

/**
 * POST admin/import (owner) — {mode: 'init'|'replace', confirm?: 'REPLACE', lists: {col: [items]}, singles: {key: value},
 * crm?: {profiles, manual, merges, dismissed}}. 'init' fills an empty shop (first setup); 'replace' restores a backup.
 */
function mv_route_import(array $user): never
{
    if ($user['role'] !== 'owner') mv_fail(403, 'forbidden');
    $b = mv_body();
    $mode = (string) ($b['mode'] ?? 'init');
    if ($mode === 'init' && !mv_docs_empty()) mv_fail(409, 'not_empty');
    if ($mode === 'replace' && ($b['confirm'] ?? '') !== 'REPLACE') mv_fail(422, 'confirm_needed');
    if (!in_array($mode, ['init', 'replace'], true)) mv_fail(422, 'mode_invalid');
    $lists = is_array($b['lists'] ?? null) ? $b['lists'] : [];
    $singles = is_array($b['singles'] ?? null) ? $b['singles'] : [];
    $crm = is_array($b['crm'] ?? null) ? $b['crm'] : [];
    $by = (string) ($user['staff_id'] ?: $user['id']);
    $cols = mv_collections();
    $count = mv_tx(function () use ($mode, $lists, $singles, $crm, $by, $cols) {
        $pdo = mv_db();
        if ($mode === 'replace') {
            $rev = mv_next_rev();
            $pdo->prepare("UPDATE docs SET deleted = 1, data = 'null', rev = ?, updated_at = ?, updated_by = ? WHERE deleted = 0")->execute([$rev, mv_iso(), $by]);
        }
        $n = 0;
        foreach ($lists as $col => $items) {
            if (!isset($cols[$col]) || !empty($cols[$col]['map']) || !is_array($items)) continue;
            $idKey = (string) $cols[$col]['id'];
            foreach (array_values($items) as $i => $item) {
                if (!is_array($item) || !isset($item[$idKey]) || !is_string($item[$idKey])) continue;
                mv_put($col, $item[$idKey], $item, $by, (float) $i, 'import');
                $n++;
            }
        }
        foreach ($singles as $key => $value) {
            if (!isset(mv_singles()[$key])) continue;
            mv_set_single((string) $key, $value, $by);
            $n++;
        }
        foreach ((array) ($crm['profiles'] ?? []) as $key => $p) {
            if (is_string($key) && is_array($p)) {
                mv_put('crm_profiles', $key, $p, $by, 0.0, 'import');
                $n++;
            }
        }
        foreach (array_values((array) ($crm['manual'] ?? [])) as $i => $m) {
            if (is_array($m) && is_string($m['key'] ?? null)) {
                mv_put('crm_manual', $m['key'], $m, $by, (float) $i, 'import');
                $n++;
            }
        }
        if (isset($crm['merges']) && is_array($crm['merges'])) mv_set_single('crm_merges', (object) $crm['merges'], $by);
        if (isset($crm['dismissed']) && is_array($crm['dismissed'])) mv_set_single('crm_dismissed', array_values($crm['dismissed']), $by);
        return $n;
    });
    mv_link_owner_staff();
    mv_auth_log('data_import', $user, '', "$mode: $count documents");
    mv_out(['ok' => true, 'count' => $count, 'rev' => mv_rev()]);
}

/** Sign-in accounts find their team-list entry by e-mail (first setup, imports). */
function mv_link_owner_staff(): void
{
    $staff = mv_docs('staff');
    foreach (mv_db()->query("SELECT * FROM users WHERE staff_id IS NULL OR staff_id = ''")->fetchAll() as $u) {
        foreach ($staff as $m) {
            if (mb_strtolower((string) ($m['email'] ?? '')) === mb_strtolower((string) $u['email'])) {
                mv_db()->prepare('UPDATE users SET staff_id = ? WHERE id = ?')->execute([$m['id'], $u['id']]);
                break;
            }
        }
    }
}

/** GET admin/export (owner) — the whole shop as one JSON file (no password hashes or session data). */
function mv_route_export(array $user): never
{
    if ($user['role'] !== 'owner') mv_fail(403, 'forbidden');
    $pdo = mv_db();
    $lists = [];
    $singles = [];
    $crm = ['profiles' => [], 'manual' => [], 'merges' => (object) [], 'dismissed' => []];
    foreach ($pdo->query('SELECT col, id, data FROM docs WHERE deleted = 0 ORDER BY col, pos, id') as $r) {
        $v = mv_jd((string) $r['data']);
        if ($r['col'] === MV_SINGLE) {
            if ($r['id'] === 'crm_merges') $crm['merges'] = (object) ($v ?: []);
            elseif ($r['id'] === 'crm_dismissed') $crm['dismissed'] = $v ?: [];
            else $singles[$r['id']] = $v;
        } elseif ($r['col'] === 'crm_profiles') $crm['profiles'][$r['id']] = $v;
        elseif ($r['col'] === 'crm_manual') $crm['manual'][] = $v;
        else $lists[$r['col']][] = $v;
    }
    $crm['profiles'] = (object) $crm['profiles'];
    $users = $pdo->query('SELECT id, staff_id AS staffId, email, name, role, active, created_at AS createdAt, last_login_at AS lastLoginAt FROM users ORDER BY created_at')->fetchAll();
    $consent = $pdo->query('SELECT at, subject, email, phone, channel, action, source, actor, lang, wording, ref, note FROM consent_events ORDER BY id')->fetchAll();
    mv_auth_log('data_export', $user);
    $name = 'miftari-vision-backup-' . gmdate('Y-m-d-His') . '.json';
    mv_out(['ok' => true, 'kind' => 'miftari-vision-backup', 'exportedAt' => mv_iso(), 'rev' => mv_rev(), 'lists' => (object) $lists, 'singles' => (object) $singles, 'crm' => $crm, 'users' => $users, 'consent' => $consent], 200, ['Content-Disposition' => "attachment; filename=\"$name\""]);
}
