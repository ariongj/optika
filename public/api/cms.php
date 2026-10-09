<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
if (!om_same_origin()) om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
om_require_auth();
if (om_password_change_required()) om_json(['ok' => false, 'error' => 'password_change_required'], 403);
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') om_json(['ok' => true, 'cms' => om_cms_state()]);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
om_require_csrf();
$input = om_input(); $action = om_clean($input['action'] ?? '', 60);
$permission = ['stock_adjust' => 'inventory.write', 'bulk_products' => 'catalog.write', 'duplicate_product' => 'catalog.write',
    'import_preview' => 'catalog.write', 'import_commit' => 'catalog.write', 'save_rule' => 'marketing.write',
    'save_offer' => 'marketing.write', 'save_placement' => 'content.write', 'save_collection' => 'catalog.write',
    'save_staff' => 'staff.manage', 'discount_preview' => 'marketing.read'];
if (!isset($permission[$action])) om_json(['ok' => false, 'error' => 'unknown_action'], 404);
om_require_permission($permission[$action]);
$lock = om_acquire_commerce_lock();

function cms_fail(string $message, int $status = 422): never { om_json(['ok' => false, 'error' => $message], $status); }
function cms_list($value, int $limit = 200): array {
    if (!is_array($value) || count($value) > $limit) cms_fail('invalid_list');
    return array_values(array_unique(array_filter(array_map(static fn($s) => om_clean($s, 100), $value))));
}
function cms_upsert(string $store, array $record): void {
    $records = om_read($store, []); $found = false;
    $publishPermissions = ['cms_rules' => 'marketing.publish', 'cms_offers' => 'marketing.publish', 'cms_placements' => 'content.publish', 'cms_collections' => 'catalog.publish'];
    foreach ($records as $i => $existing) if ($existing['id'] === $record['id']) {
        // Changing a live record, including unpublishing it, is a publication action.
        if (($existing['status'] ?? '') === 'Published' && isset($publishPermissions[$store])) om_require_permission($publishPermissions[$store]);
        $records[$i] = $record; $found = true; break;
    }
    if (!$found) $records[] = $record;
    om_write($store, $records);
    om_audit($store . '_saved', $store, $record['id']);
}
function cms_schedule(array $record, string $publishPermission): array {
    $status = $record['status'] ?? 'Draft';
    if (!in_array($status, ['Draft', 'Published', 'Paused', 'Archived'], true)) cms_fail('invalid_status');
    if ($status === 'Published') om_require_permission($publishPermission);
    $out = ['id' => om_clean($record['id'] ?? '', 100) ?: om_id('CMS'), 'status' => $status,
        'title' => om_clean($record['title'] ?? '', 180), 'updatedAt' => gmdate('c')];
    if ($out['title'] === '') cms_fail('title_required');
    foreach (['startsAt', 'endsAt'] as $field) {
        $date = $record[$field] ?? '';
        if ($date !== '' && (!is_string($date) || !preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?(?:Z|[+-]\d\d:\d\d)$/', $date) || strtotime($date) === false)) cms_fail('invalid_schedule');
        $out[$field] = $date === '' ? '' : gmdate('c', strtotime($date));
    }
    if ($out['startsAt'] && $out['endsAt'] && strtotime($out['endsAt']) <= strtotime($out['startsAt'])) cms_fail('invalid_schedule');
    return $out;
}

if ($action === 'stock_adjust') {
    $id = om_clean($input['id'] ?? '', 100); $reason = om_clean($input['reason'] ?? '', 240);
    $delta = filter_var($input['delta'] ?? null, FILTER_VALIDATE_INT);
    if ($delta === false || $delta === 0 || abs($delta) > 100000 || strlen($reason) < 3) cms_fail('stock_reason_required');
    $products = om_all_products(); $found = false;
    foreach ($products as &$product) if ($product['id'] === $id) {
        $before = (int) $product['stock'];
        if (($input['expectedStock'] ?? null) !== $before) cms_fail('stock_conflict', 409);
        if ($before + $delta < 0) cms_fail('insufficient_stock', 409);
        $product['stock'] = $before + $delta; $product['updatedAt'] = gmdate('c'); $found = true;
        om_cms_record_stock($id, $before, $product['stock'], $reason, om_clean($input['reference'] ?? '', 120));
        break;
    }
    unset($product); if (!$found) cms_fail('record_not_found', 404);
    om_write('products', $products); om_audit('stock_adjusted', 'product', $id);
}

if ($action === 'bulk_products') {
    $ids = cms_list($input['ids'] ?? []); $status = $input['status'] ?? '';
    if (!$ids || !in_array($status, ['Published', 'Draft', 'Archived'], true)) cms_fail('invalid_product_selection');
    if ($status === 'Published') om_require_permission('catalog.publish');
    $products = om_all_products();
    foreach ($products as &$product) if (in_array($product['id'], $ids, true)) {
        $product['status'] = $status; $product = om_cms_validate_product($product, $products); $product['updatedAt'] = gmdate('c');
    }
    unset($product); om_write('products', $products); om_audit('products_status_changed', 'products', implode(',', $ids));
}

if ($action === 'duplicate_product') {
    $products = om_all_products(); $copy = null;
    foreach ($products as $product) if ($product['id'] === ($input['id'] ?? '')) {
        $copy = $product; $copy['id'] = om_id('PRD'); $copy['sku'] = strtoupper($copy['id']);
        $copy['name'] .= ' — kopje'; $copy['stock'] = 0; $copy['status'] = 'Draft'; $copy['updatedAt'] = gmdate('c'); break;
    }
    if (!$copy) cms_fail('record_not_found', 404);
    array_unshift($products, $copy); om_write('products', $products); om_audit('product_duplicated', 'product', $copy['id']);
}

if (in_array($action, ['import_preview', 'import_commit'], true)) {
    $rows = $input['rows'] ?? []; if (!is_array($rows) || !$rows || count($rows) > 500) cms_fail('invalid_import');
    $products = om_all_products(); $existingBySku = []; foreach ($products as $p) $existingBySku[strtoupper($p['sku'] ?? '')] = $p;
    $rowHash = hash('sha256', json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $actor = (string) ($_SESSION['admin_email'] ?? '');
    $suppliedToken = (string) ($input['previewToken'] ?? '');
    $receipts = om_read('cms_import_receipts', []);
    if ($action === 'import_commit' && $suppliedToken !== '') foreach ($receipts as $receipt) {
        if (hash_equals($receipt['token'], $suppliedToken) && $receipt['actor'] === $actor && $receipt['rows'] === $rowHash) {
            om_json(['ok' => true, 'duplicate' => true, 'cms' => om_cms_state(), 'products' => array_map('om_public_product', $products)]);
        }
    }
    $baseline = [];
    foreach ($rows as $row) {
        $sku = is_array($row) ? strtoupper(om_clean($row['sku'] ?? '', 80)) : '';
        $baseline[$sku] = $existingBySku[$sku] ?? null;
    }
    ksort($baseline);
    $previewToken = hash('sha256', $actor . $rowHash . json_encode($baseline, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    if ($action === 'import_commit' && ($suppliedToken === '' || !hash_equals($previewToken, $suppliedToken))) cms_fail('import_preview_stale', 409);
    $seen = []; $errors = []; $ready = [];
    foreach ($rows as $i => $row) {
        if (!is_array($row)) { $errors[] = ['row' => $i + 2, 'message' => 'Rresht i pavlefshëm']; continue; }
        $sku = strtoupper(om_clean($row['sku'] ?? '', 80));
        if ($sku === '' || isset($seen[$sku]) || trim((string) ($row['name'] ?? '')) === '' || !is_numeric($row['price'] ?? null) || (float) $row['price'] <= 0
            || filter_var($row['stock'] ?? null, FILTER_VALIDATE_INT) === false || (int) $row['stock'] < 0) {
            $errors[] = ['row' => $i + 2, 'message' => 'Kontrolloni emrin, SKU unike, çmimin dhe stokun.']; continue;
        }
        $seen[$sku] = true; $old = $existingBySku[$sku] ?? null;
        // Import never publishes or replaces the whole catalogue.
        $ready[] = array_merge($old ?? [], ['id' => $old['id'] ?? om_id('PRD'), 'sku' => $sku,
            'name' => om_clean($row['name'], 140), 'price' => round((float) $row['price'], 2), 'salePrice' => null, 'stock' => (int) $row['stock'],
            'type' => in_array($row['type'] ?? '', ['Sunglasses', 'Prescription Glasses'], true) ? $row['type'] : ($old['type'] ?? 'Sunglasses'),
            'collection' => om_clean($row['collection'] ?? $old['collection'] ?? '', 120), 'status' => 'Draft', 'updatedAt' => gmdate('c')]);
    }
    if ($action === 'import_preview') om_json(['ok' => true, 'previewToken' => $previewToken, 'rows' => $ready, 'errors' => $errors, 'existing' => count(array_filter($ready, static fn($p) => isset($existingBySku[$p['sku']])))]);
    if ($errors) om_json(['ok' => false, 'error' => 'import_validation_failed', 'errors' => $errors], 422);
    foreach ($ready as $next) {
        $found = false;
        foreach ($products as $i => $old) if (strtoupper($old['sku'] ?? '') === $next['sku']) {
            om_cms_record_stock($old['id'], (int) $old['stock'], $next['stock'], 'csv_import'); $products[$i] = $next; $found = true; break;
        }
        if (!$found) $products[] = $next;
    }
    om_write('products', $products);
    array_unshift($receipts, ['token' => $previewToken, 'rows' => $rowHash, 'actor' => $actor, 'at' => gmdate('c')]);
    om_write('cms_import_receipts', array_slice($receipts, 0, 100));
    om_audit('catalogue_merged', 'products', (string) count($ready));
}

if ($action === 'save_rule') {
    $raw = is_array($input['record'] ?? null) ? $input['record'] : [];
    $r = cms_schedule($raw, 'marketing.publish');
    if (!in_array($raw['type'] ?? '', ['product', 'order', 'buyXGetY', 'shipping'], true)) cms_fail('invalid_discount_type');
    $r['type'] = $raw['type']; $r['method'] = ($raw['method'] ?? '') === 'automatic' ? 'automatic' : 'code';
    $r['code'] = strtoupper(om_clean($raw['code'] ?? '', 40));
    if ($r['method'] === 'code' && !preg_match('/^[A-Z0-9_-]{2,40}$/', $r['code'])) cms_fail('campaign_code_required');
    $r['valueType'] = ($raw['valueType'] ?? '') === 'fixed' ? 'fixed' : 'percent';
    foreach (['value','minimumCents','minimumQuantity','maximumShippingCents','usageLimit','perCustomerLimit','buyQuantity','getQuantity','maxApplications'] as $key) {
        $n = filter_var($raw[$key] ?? 0, FILTER_VALIDATE_INT);
        if ($n === false || $n < 0 || $n > 100000000) cms_fail('invalid_discount_number');
        $r[$key] = $n;
    }
    if ($r['valueType'] === 'percent' && $r['value'] > 10000) cms_fail('invalid_campaign_value');
    if ($r['type'] === 'buyXGetY' && (!$r['buyQuantity'] || !$r['getQuantity'] || !$r['maxApplications'] || $r['maxApplications'] > 100)) cms_fail('invalid_buy_get_quantity');
    $r['fixedPerUnit'] = !empty($raw['fixedPerUnit']);
    foreach (['productIds','rewardProductIds','countries','customerIds','combinesWith'] as $key) $r[$key] = cms_list($raw[$key] ?? []);
    if (array_diff($r['combinesWith'], ['product','order','shipping'])) cms_fail('invalid_combination');
    $knownIds = array_column(om_all_products(), 'id');
    if (array_diff(array_merge($r['productIds'], $r['rewardProductIds']), $knownIds)) cms_fail('unknown_product');
    if ($r['type'] === 'buyXGetY' && !$r['rewardProductIds']) cms_fail('reward_products_required');
    $rules = om_read('cms_rules', []); $active = 0;
    foreach ($rules as $rule) {
        if ($rule['id'] === $r['id']) continue;
        if ($r['method'] === 'code' && $r['code'] !== '' && ($rule['code'] ?? '') === $r['code']) cms_fail('duplicate_discount_code', 409);
        if ($rule['status'] === 'Published') $active++;
    }
    foreach (om_campaigns() as $legacy) if ($r['code'] !== '' && strtoupper($legacy['code'] ?? '') === $r['code']) cms_fail('duplicate_discount_code', 409);
    if ($r['status'] === 'Published' && $active >= 10) cms_fail('active_discount_limit');
    cms_upsert('cms_rules', $r);
}

if ($action === 'discount_preview') {
    $lines = []; $products = array_column(om_all_products(), null, 'id');
    foreach ((array) ($input['items'] ?? []) as $item) {
        $product = $products[$item['productId'] ?? ''] ?? null; if (!$product) cms_fail('unknown_product');
        $q = max(1, min(100, (int) ($item['quantity'] ?? 1)));
        $lines[] = ['productId' => $product['id'], 'quantity' => $q, 'amountCents' => om_cents(($product['salePrice'] ?? null) ?: $product['price']) * $q];
    }
    $result = om_discount_evaluate($lines, max(0, (int) ($input['shippingCents'] ?? 0)), om_read('cms_rules', []), ['codes' => cms_list($input['codes'] ?? []), 'country' => om_clean($input['country'] ?? '', 5)]);
    om_json(['ok' => true, 'preview' => $result]);
}

if ($action === 'save_offer') {
    $raw = (array) ($input['record'] ?? []); $r = cms_schedule($raw, 'marketing.publish');
    $r['ruleId'] = om_clean($raw['ruleId'] ?? '', 100);
    if ($r['ruleId'] !== '' && !in_array($r['ruleId'], array_column(om_read('cms_rules', []), 'id'), true)) cms_fail('unknown_discount_rule');
    $r['description'] = om_clean($raw['description'] ?? '', 800);
    $r['owner'] = om_clean($raw['owner'] ?? '', 120); cms_upsert('cms_offers', $r);
}

if ($action === 'save_placement') {
    $raw = (array) ($input['record'] ?? []); $r = cms_schedule($raw, 'content.publish');
    $r['position'] = in_array($raw['position'] ?? '', ['home_banner','announcement'], true) ? $raw['position'] : 'home_banner';
    $r['image'] = om_cms_local_image($raw['image'] ?? ''); $r['mobileImage'] = om_cms_local_image($raw['mobileImage'] ?? '');
    $r['alt'] = om_clean($raw['alt'] ?? '', 200); $r['subtitle'] = om_clean($raw['subtitle'] ?? '', 400);
    $r['cta'] = om_clean($raw['cta'] ?? '', 80); $r['href'] = om_clean($raw['href'] ?? '', 300);
    if (!preg_match('~^/(?!/)[a-zA-Z0-9/_?=&%.-]*$~', $r['href']) || str_contains($r['href'], '..')) cms_fail('invalid_destination');
    if (!om_cms_public_destination($r['href'])) cms_fail('invalid_destination');
    if ($r['position'] === 'home_banner' && (!$r['image'] || !$r['alt'])) cms_fail('image_and_alt_required');
    $r['offerId'] = om_clean($raw['offerId'] ?? '', 100);
    if ($r['offerId'] && !in_array($r['offerId'], array_column(om_read('cms_offers', []), 'id'), true)) cms_fail('unknown_offer');
    $r['order'] = max(0, min(99, (int) ($raw['order'] ?? 0))); $r['locale'] = 'sq';
    $r['layout'] = in_array($raw['layout'] ?? '', ['inset','full','layered'], true) ? $raw['layout'] : 'inset';
    cms_upsert('cms_placements', $r);
}

if ($action === 'save_collection') {
    $raw = (array) ($input['record'] ?? []); $r = cms_schedule($raw, 'catalog.publish');
    $r['mode'] = ($raw['mode'] ?? '') === 'dynamic' ? 'dynamic' : 'manual';
    $r['productIds'] = cms_list($raw['productIds'] ?? []); $r['excludeIds'] = cms_list($raw['excludeIds'] ?? []);
    $r['tag'] = om_clean($raw['tag'] ?? '', 80); $r['productType'] = om_clean($raw['productType'] ?? '', 80);
    $r['minimumPrice'] = max(0, (float) ($raw['minimumPrice'] ?? 0)); $r['maximumPrice'] = max(0, (float) ($raw['maximumPrice'] ?? 0));
    cms_upsert('cms_collections', $r);
}

if ($action === 'save_staff') {
    $raw = (array) ($input['record'] ?? []); $id = om_clean($raw['id'] ?? '', 100) ?: om_id('STAFF');
    $email = strtolower(om_clean($raw['email'] ?? '', 160)); $role = $raw['role'] ?? '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !isset(om_staff_roles()[$role]) || $role === 'owner') cms_fail('invalid_staff');
    if ($email === strtolower((string) (om_credentials()['email'] ?? ''))) cms_fail('owner_login_reserved');
    $users = om_read('staff_users', []); $old = null;
    foreach ($users as $user) {
        if ($user['email'] === $email && $user['id'] !== $id) cms_fail('duplicate_staff_email', 409);
        if ($user['id'] === $id) $old = $user;
    }
    $password = is_string($raw['password'] ?? null) ? $raw['password'] : '';
    if ((!$old || $password !== '') && strlen($password) < 12) cms_fail('password_too_short');
    $r = ['id' => $id, 'email' => $email, 'name' => om_clean($raw['name'] ?? '', 120), 'role' => $role,
        'active' => !empty($raw['active']), 'version' => (int) ($old['version'] ?? 0) + 1, 'updatedAt' => gmdate('c'),
        'passwordHash' => $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : $old['passwordHash']];
    cms_upsert('staff_users', $r);
}

om_release_commerce_lock($lock);
om_json(['ok' => true, 'cms' => om_cms_state(), 'products' => om_can('catalog.read') ? array_map('om_public_product', om_all_products()) : []]);
