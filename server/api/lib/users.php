<?php
// Miftari Vision API — staff accounts (owner): invite, role, disable, reset links, 2-step reset, sessions, login history.
declare(strict_types=1);

function mv_user_row(array $u): array
{
    $q = mv_db()->prepare('SELECT COUNT(*) FROM sessions WHERE user_id = ? AND revoked = 0 AND expires_at > ? AND last_seen > ?');
    $q->execute([$u['id'], time(), time() - (int) mv_config()['session_idle']]);
    $link = mv_db()->prepare('SELECT kind, expires_at FROM tokens WHERE user_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1');
    $link->execute([$u['id'], time()]);
    $l = $link->fetch();
    return mv_user_public($u) + [
        'active' => (bool) (int) $u['active'],
        'hasPassword' => !empty($u['pass_hash']),
        'locked' => (int) $u['locked_until'] > time(),
        'sessions' => (int) $q->fetchColumn(),
        'createdAt' => $u['created_at'],
        'passwordChangedAt' => $u['pass_changed_at'],
        'pendingLink' => $l ? ['kind' => $l['kind'], 'expiresAt' => mv_iso((int) $l['expires_at'] * 1000)] : null,
    ];
}

function mv_route_users(string $path, array $me): never
{
    $m = mv_method();
    $isOwner = $me['role'] === 'owner';

    if ("$m $path" === 'GET admin/sessions') {
        $all = $isOwner && ($_GET['all'] ?? '') === '1';
        $sql = 'SELECT s.id, s.user_id, u.name, u.email, s.created_at, s.last_seen, s.expires_at, s.ip, s.ua FROM sessions s JOIN users u ON u.id = s.user_id
                 WHERE s.revoked = 0 AND s.expires_at > ? AND s.last_seen > ?' . ($all ? '' : ' AND s.user_id = ?') . ' ORDER BY s.last_seen DESC';
        $q = mv_db()->prepare($sql);
        $args = [time(), time() - (int) mv_config()['session_idle']];
        if (!$all) $args[] = $me['id'];
        $q->execute($args);
        $rows = array_map(fn($r) => [
            'id' => $r['id'], 'userId' => $r['user_id'], 'name' => $r['name'], 'email' => $r['email'],
            'createdAt' => mv_iso((int) $r['created_at'] * 1000), 'lastSeen' => mv_iso((int) $r['last_seen'] * 1000),
            'ip' => $r['ip'], 'ua' => $r['ua'], 'current' => $r['id'] === $me['sid'],
        ], $q->fetchAll());
        mv_out(['ok' => true, 'sessions' => $rows]);
    }

    if ("$m $path" === 'POST admin/sessions/revoke') {
        $id = mv_str(mv_body()['id'] ?? '', 80);
        $q = mv_db()->prepare('SELECT s.*, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?');
        $q->execute([$id]);
        $s = $q->fetch();
        if (!$s || ($s['user_id'] !== $me['id'] && !$isOwner)) mv_fail(404, 'not_found');
        mv_db()->prepare('UPDATE sessions SET revoked = 1 WHERE id = ?')->execute([$id]);
        mv_auth_log('session_revoked', mv_user((string) $s['user_id']), '', $s['user_id'] === $me['id'] ? 'by themselves' : 'by the owner', (string) $me['id']);
        mv_out(['ok' => true]);
    }

    if ("$m $path" === 'GET admin/auth-events') {
        $limit = min(500, max(1, (int) ($_GET['limit'] ?? 200)));
        $before = (int) ($_GET['before'] ?? 0);
        $who = $isOwner ? mv_str($_GET['user'] ?? '', 80) : (string) $me['id'];
        $sql = 'SELECT id, at, user_id, email, kind, ip, ua, detail, actor FROM auth_events WHERE 1 = 1'
            . ($who !== '' ? ' AND user_id = :who' : '') . ($before > 0 ? ' AND id < :before' : '') . ' ORDER BY id DESC LIMIT ' . $limit;
        $q = mv_db()->prepare($sql);
        if ($who !== '') $q->bindValue(':who', $who);
        if ($before > 0) $q->bindValue(':before', $before, PDO::PARAM_INT);
        $q->execute();
        mv_out(['ok' => true, 'events' => array_map(fn($r) => [
            'id' => (int) $r['id'], 'at' => $r['at'], 'userId' => $r['user_id'], 'email' => $r['email'], 'kind' => $r['kind'],
            'ip' => $r['ip'], 'ua' => $r['ua'], 'detail' => $r['detail'], 'actor' => $r['actor'],
        ], $q->fetchAll())]);
    }

    // everything below manages other people's accounts: owner only
    if (!$isOwner) mv_fail(403, 'forbidden');

    switch ("$m $path") {
        case 'GET admin/users':
            $rows = mv_db()->query('SELECT * FROM users ORDER BY created_at')->fetchAll();
            mv_out(['ok' => true, 'users' => array_map('mv_user_row', $rows)]);

        case 'POST admin/users':
            $b = mv_body();
            $role = (string) ($b['role'] ?? '');
            unset($b['password']);
            $u = mv_create_user_from($b, $role, $me);
            $link = mv_link_create((string) $u['id'], 'invite', (string) $me['id']);
            mv_auth_log('user_created', $u, '', "role $role", (string) $me['id']);
            mv_out(['ok' => true, 'user' => mv_user_row($u), 'link' => $link]);

        case 'POST admin/users/update':
            $b = mv_body();
            $u = mv_user(mv_str($b['id'] ?? '', 80));
            if (!$u) mv_fail(404, 'not_found');
            $set = [];
            $args = [];
            $notes = [];
            if (isset($b['name'])) {
                $name = mv_str($b['name'], 120);
                if ($name === '') mv_fail(422, 'name_required');
                $set[] = 'name = ?';
                $args[] = $name;
            }
            if (isset($b['email'])) {
                $email = mb_strtolower(mv_str($b['email'], 190));
                if (!mv_email_ok($email)) mv_fail(422, 'email_invalid');
                $other = mv_user_by_email($email);
                if ($other && $other['id'] !== $u['id']) mv_fail(409, 'email_taken');
                $set[] = 'email = ?';
                $args[] = $email;
            }
            if (isset($b['role']) && $b['role'] !== $u['role']) {
                if (!in_array($b['role'], MV_ROLES, true)) mv_fail(422, 'role_invalid');
                if ($u['role'] === 'owner' && mv_owner_count((string) $u['id']) === 0) mv_fail(409, 'last_owner');
                $set[] = 'role = ?';
                $args[] = $b['role'];
                $notes[] = "role {$u['role']} → {$b['role']}";
            }
            if (isset($b['active'])) {
                $active = (bool) $b['active'];
                if (!$active && $u['id'] === $me['id']) mv_fail(409, 'not_yourself');
                if (!$active && $u['role'] === 'owner' && mv_owner_count((string) $u['id']) === 0) mv_fail(409, 'last_owner');
                $set[] = 'active = ?';
                $args[] = $active ? 1 : 0;
                $notes[] = $active ? 'sign-in allowed' : 'sign-in blocked';
                if (!$active) mv_revoke_sessions((string) $u['id']);
            }
            if (array_key_exists('staffId', $b)) {
                $set[] = 'staff_id = ?';
                $args[] = mv_str($b['staffId'], 80) ?: null;
            }
            if (!empty($b['unlock'])) {
                $set[] = 'locked_until = 0, failed = 0';
                $notes[] = 'unlocked';
            }
            if ($set) {
                $set[] = 'updated_at = ?';
                $args[] = mv_iso();
                $args[] = $u['id'];
                mv_db()->prepare('UPDATE users SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
                $fresh = mv_user((string) $u['id']);
                // the team list shows the same role
                $staffId = (string) ($fresh['staff_id'] ?? '');
                $doc = $staffId !== '' ? mv_doc_data('staff', $staffId) : null;
                if (is_array($doc) && ($doc['role'] ?? '') !== $fresh['role']) {
                    $doc['role'] = $fresh['role'];
                    mv_put('staff', $staffId, $doc, (string) ($me['staff_id'] ?: $me['id']));
                }
                mv_auth_log('user_updated', $fresh, '', implode('; ', $notes), (string) $me['id']);
            }
            mv_out(['ok' => true, 'user' => mv_user_row(mv_user((string) $u['id']))]);

        case 'POST admin/users/link':
            $b = mv_body();
            $u = mv_user(mv_str($b['id'] ?? '', 80));
            if (!$u) mv_fail(404, 'not_found');
            $kind = empty($u['pass_hash']) ? 'invite' : 'reset';
            $link = mv_link_create((string) $u['id'], $kind, (string) $me['id']);
            mv_auth_log($kind === 'invite' ? 'invite_link' : 'reset_link', $u, '', 'new link created', (string) $me['id']);
            mv_out(['ok' => true, 'kind' => $kind, 'link' => $link]);

        case 'POST admin/users/2fa-reset':
            $u = mv_user(mv_str(mv_body()['id'] ?? '', 80));
            if (!$u) mv_fail(404, 'not_found');
            mv_db()->prepare('UPDATE users SET totp_secret = NULL, totp_pending = NULL, updated_at = ? WHERE id = ?')->execute([mv_iso(), $u['id']]);
            mv_auth_log('totp_reset', $u, '', 'by the owner', (string) $me['id']);
            mv_out(['ok' => true]);

        case 'POST admin/users/delete':
            $u = mv_user(mv_str(mv_body()['id'] ?? '', 80));
            if (!$u) mv_fail(404, 'not_found');
            if ($u['id'] === $me['id']) mv_fail(409, 'not_yourself');
            if ($u['role'] === 'owner' && mv_owner_count((string) $u['id']) === 0) mv_fail(409, 'last_owner');
            mv_auth_log('user_deleted', $u, '', '', (string) $me['id']);
            mv_db()->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]);
            mv_out(['ok' => true]);
    }
    mv_fail(404, 'not_found');
}
