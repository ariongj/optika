<?php
// Miftari Vision API — what each role may change. The role matrix is generated from the CMS's own
// src/lib/permissions.ts (permissions.json), so the server enforces exactly what the CMS shows.
declare(strict_types=1);

function mv_perm_matrix(): array
{
    static $m = null;
    if (is_array($m)) return $m;
    $raw = @file_get_contents(dirname(__DIR__) . '/permissions.json');
    $j = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($j) || !isset($j['matrix'])) mv_fail(500, 'permissions_missing');
    return $m = $j;
}

/** Can $role perform $action in $module? The owner can do everything. */
function mv_can(string $role, string $module, string $action = 'view'): bool
{
    if ($role === 'owner') return true;
    $m = mv_perm_matrix()['matrix'];
    return in_array($action, $m[$role][$module] ?? [], true);
}

/**
 * Every collection the CMS stores, with the id field, the CMS module that owns it, and (for some) fields another
 * module may change as a side effect of its own work — e.g. an order lowers a product's stock, a used code counts up.
 */
function mv_collections(): array
{
    $stock = [['stock', 'sold', 'incoming', 'unavailable', 'updatedAt'], ['orders', 'drafts', 'returns', 'inventory', 'purchasing']];
    return [
        'categories' => ['id' => 'id', 'module' => 'products'],
        'products' => ['id' => 'id', 'module' => 'products', 'side' => [$stock]],
        'orders' => ['id' => 'id', 'module' => 'orders', 'also' => ['drafts', 'returns']],
        'inquiries' => ['id' => 'id', 'module' => 'contacts', 'side' => [[['status', 'scheduledAt', 'seen'], ['appointments']]]],
        'coupons' => ['id' => 'id', 'module' => 'discounts'],
        'pages' => ['id' => 'id', 'module' => 'content'],
        'posts' => ['id' => 'id', 'module' => 'content'],
        'projects' => ['id' => 'id', 'module' => 'content'],
        'media' => ['id' => 'id', 'module' => 'content', 'also' => ['products', 'onlineStore', 'offers', 'collections']],
        'collections' => ['id' => 'id', 'module' => 'collections'],
        'discounts' => ['id' => 'id', 'module' => 'discounts', 'side' => [[['uses'], ['orders', 'drafts']]]],
        'offers' => ['id' => 'id', 'module' => 'offers', 'side' => [[['metrics'], ['orders', 'drafts']]]],
        'placements' => ['id' => 'id', 'module' => 'offers', 'also' => ['onlineStore']],
        'staff' => ['id' => 'id', 'module' => 'staff'],
        'services' => ['id' => 'id', 'module' => 'appointments'],
        'bookings' => ['id' => 'id', 'module' => 'appointments'],
        'segments' => ['id' => 'id', 'module' => 'segments'],
        'purchaseOrders' => ['id' => 'id', 'module' => 'purchasing'],
        'drafts' => ['id' => 'id', 'module' => 'drafts'],
        'returns' => ['id' => 'id', 'module' => 'returns'],
        'quotes' => ['id' => 'id', 'module' => 'quotes'],
        'menus' => ['id' => 'id', 'module' => 'onlineStore'],
        'contentModels' => ['id' => 'id', 'module' => 'content'],
        // append-only logs: any signed-in staff member adds entries; nobody edits or deletes them
        'audit' => ['id' => 'id', 'module' => '', 'append' => 300],
        'movements' => ['id' => 'id', 'module' => '', 'append' => 500],
        // CRM profiles (tags, notes, consent) and customers added by staff
        'crm_profiles' => ['id' => '', 'module' => 'customers', 'map' => true],
        'crm_manual' => ['id' => 'key', 'module' => 'customers'],
    ];
}

/** Single values (one document each) and the module that may change them. */
function mv_singles(): array
{
    return [
        'settings' => 'settings',
        'home' => 'onlineStore',
        'homeDraft' => 'onlineStore',
        'homeHistory' => 'onlineStore',
        'seededAt' => 'settings',
        'version' => 'settings',
        'crm_merges' => 'customers',
        'crm_dismissed' => 'customers',
    ];
}

/** Settings are shared by several CMS screens: each top-level key belongs to the module whose screen edits it. */
const MV_SETTINGS_KEYS = [
    'theme' => 'onlineStore',
    'brandColor' => 'onlineStore',
    'seo' => 'onlineStore',
    'booking' => 'appointments',
    'markets' => 'markets',
    'integrations' => 'integrations',
];

/** May this role change the single value $key from $old to $new? '' when allowed. */
function mv_single_problem(string $role, string $key, $old, $new): string
{
    if ($role === 'owner') return '';
    $module = mv_singles()[$key] ?? null;
    if ($module === null) return 'unknown_single';
    if ($key === 'settings') {
        $a = is_array($old) ? $old : [];
        $b = is_array($new) ? $new : [];
        foreach (array_keys(mv_diff_keys($a, $b)) as $k) {
            if (!mv_can($role, MV_SETTINGS_KEYS[$k] ?? 'settings', 'edit')) return 'forbidden';
        }
        return '';
    }
    // the published homepage changes only by publishing a draft
    if ($key === 'home') return mv_can($role, 'onlineStore', 'publish') ? '' : 'publish_needed';
    return mv_can($role, $module, 'edit') ? '' : 'forbidden';
}

/** Statuses that make something live on the site: changing into one of them needs 'publish'. */
const MV_LIVE_STATUSES = ['active', 'published', 'scheduled', 'live'];

/**
 * May this role write $new over $old in $col? Returns '' when allowed, else the reason.
 * $old / $new are null for create / delete.
 */
function mv_write_problem(string $role, string $col, ?array $old, ?array $new): string
{
    if ($role === 'owner') return '';
    $c = mv_collections()[$col] ?? null;
    if (!$c) return 'unknown_collection';
    if (isset($c['append'])) return $old === null && $new !== null ? '' : 'append_only';
    $modules = array_merge([$c['module']], $c['also'] ?? []);
    $action = $new === null ? 'delete' : 'edit';
    foreach ($modules as $m) {
        if (!mv_can($role, $m, $action)) continue;
        // making something live (draft → active / published) needs 'publish' in the owning module
        if ($new !== null && isset($new['status']) && in_array($new['status'], MV_LIVE_STATUSES, true)
            && ($old['status'] ?? null) !== $new['status'] && !mv_can($role, $m, 'publish')) {
            return 'publish_needed';
        }
        return '';
    }
    // side effects of another module's work: only the listed fields may differ
    if ($old !== null && $new !== null) {
        foreach ($c['side'] ?? [] as [$fields, $via]) {
            $ok = false;
            foreach ($via as $m) if (mv_can($role, $m, 'edit')) $ok = true;
            if (!$ok) continue;
            $changed = array_keys(mv_diff_keys($old, $new));
            if (!array_diff($changed, $fields)) return '';
        }
    }
    return 'forbidden';
}

/** Top-level keys whose value differs between two documents. */
function mv_diff_keys(array $a, array $b): array
{
    $out = [];
    foreach (array_unique(array_merge(array_keys($a), array_keys($b))) as $k) {
        if (!array_key_exists($k, $a) || !array_key_exists($k, $b) || mv_json($a[$k]) !== mv_json($b[$k])) $out[$k] = true;
    }
    return $out;
}

/** Fields stripped for roles that may not see purchase costs. */
function mv_strip_cost(array $p): array
{
    unset($p['cost']);
    return $p;
}
