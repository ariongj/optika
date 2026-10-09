<?php
declare(strict_types=1);

// CMS v2 extends the existing store. Operational records and the owner login
// remain in their original stores; new modules have separate versioned records.
function om_staff_roles(): array
{
    return [
        'owner' => ['*'],
        'manager' => ['catalog.read', 'catalog.write', 'catalog.publish', 'catalog.export', 'inventory.write', 'orders.read', 'orders.write', 'customers.read', 'customers.write', 'contacts.read', 'contacts.write', 'content.read', 'content.write', 'content.publish', 'marketing.read', 'marketing.write', 'marketing.publish', 'analytics.read', 'audit.read', 'media.write'],
        'catalog' => ['catalog.read', 'catalog.write', 'catalog.publish', 'catalog.export', 'inventory.write', 'media.write'],
        'orders' => ['catalog.read', 'orders.read', 'orders.write', 'customers.read', 'contacts.read', 'contacts.write'],
        'editor' => ['content.read', 'content.write', 'content.publish', 'media.write'],
        'marketing' => ['catalog.read', 'marketing.read', 'marketing.write', 'content.read', 'media.write'],
        'reception' => ['contacts.read', 'contacts.write', 'customers.read'],
    ];
}

function om_staff_member(): ?array
{
    $id = (string) ($_SESSION['staff_id'] ?? '');
    if ($id === '') return null;
    foreach (om_read('staff_users', []) as $person) {
        if (($person['id'] ?? '') === $id && ($person['active'] ?? false)
            && (int) ($person['version'] ?? 0) === (int) ($_SESSION['staff_version'] ?? -1)) return $person;
    }
    return null;
}

function om_staff_permissions(): array
{
    if (!empty($_SESSION['staff_id'])) {
        $member = om_staff_member();
        return $member ? (om_staff_roles()[$member['role']] ?? []) : [];
    }
    return !empty($_SESSION['optika_admin']) ? ['*'] : [];
}

function om_can(string $permission): bool
{
    $permissions = om_staff_permissions();
    return in_array('*', $permissions, true) || in_array($permission, $permissions, true);
}

function om_require_permission(string $permission): void
{
    om_require_auth();
    if (!om_can($permission)) om_json(['ok' => false, 'error' => 'permission_denied'], 403);
}

function om_public_product(array $product): array
{
    // Internal supplier/cost fields must never become public by adding a CMS field.
    foreach (['cost', 'supplier', 'supplierCost', 'supplierNotes', 'internalNote', 'priceHistory', 'inventoryLocation', 'purchaseReference'] as $field) unset($product[$field]);
    return $product;
}

function om_cms_inventory(): array
{
    $reserved = [];
    foreach (om_read('orders', []) as $order) {
        if (($order['inventoryState'] ?? '') !== 'Reserved') continue;
        foreach (($order['items'] ?? []) as $line) {
            $id = (string) ($line['productId'] ?? '');
            $reserved[$id] = ($reserved[$id] ?? 0) + (int) ($line['quantity'] ?? 0);
        }
    }
    return array_map(static function ($product) use ($reserved) {
        $held = (int) ($reserved[$product['id']] ?? 0);
        return ['id' => $product['id'], 'name' => $product['name'], 'sku' => $product['sku'] ?? '',
            'available' => (int) ($product['stock'] ?? 0), 'reserved' => $held,
            'onHand' => (int) ($product['stock'] ?? 0) + $held, 'location' => 'main',
            'updatedAt' => $product['updatedAt'] ?? null];
    }, om_all_products());
}

function om_cms_validate_product(array $product, array $all): array
{
    $name = om_clean($product['name'] ?? '', 140);
    if ($name === '') om_json(['ok' => false, 'error' => 'product_name_required'], 422);
    foreach (['price', 'stock'] as $field) {
        if (!is_numeric($product[$field] ?? null) || (float) $product[$field] < 0 || (float) $product[$field] > 10000000
            || ($field === 'stock' && floor((float) $product[$field]) !== (float) $product[$field])) {
            om_json(['ok' => false, 'error' => 'invalid_product_' . $field], 422);
        }
    }
    $sku = strtoupper(om_clean($product['sku'] ?? '', 80));
    foreach ($all as $existing) {
        if ($sku !== '' && strtoupper((string) ($existing['sku'] ?? '')) === $sku && ($existing['id'] ?? '') !== ($product['id'] ?? '')) {
            om_json(['ok' => false, 'error' => 'duplicate_sku'], 409);
        }
    }
    $sale = $product['salePrice'] ?? null;
    if ($sale !== null && $sale !== '' && (!is_numeric($sale) || (float) $sale <= 0 || (float) $sale >= (float) $product['price'])) {
        om_json(['ok' => false, 'error' => 'invalid_sale_price'], 422);
    }
    $product['name'] = $name;
    $product['sku'] = $sku;
    $product['status'] = in_array($product['status'] ?? '', ['Published', 'Draft', 'Archived'], true) ? $product['status'] : 'Draft';
    if ($product['status'] === 'Published' && (float) $product['price'] <= 0) om_json(['ok' => false, 'error' => 'publish_price_required'], 422);
    foreach (['barcode', 'tags', 'supplier', 'imageAlt', 'seoTitle', 'seoDescription'] as $field) {
        if (isset($product[$field])) $product[$field] = om_clean($product[$field], $field === 'seoDescription' ? 500 : 180);
    }
    if (isset($product['seoDescription'])) $product['metaDescription'] = $product['seoDescription'];
    return $product;
}

function om_cms_public_destination(string $href): bool
{
    $path = '/' . trim((string) parse_url($href, PHP_URL_PATH), '/') . '/';
    if ($path === '//') $path = '/';
    $pages = ['/', '/optical/', '/shop/', '/sunglasses/', '/prescription-glasses/', '/ekzaminimi/', '/lens-focus/', '/virtual-try-on/', '/laboratory/', '/laboratory/partners/', '/laboratory/kosovo/', '/laboratory/europe/', '/clinic/', '/about/', '/contact/', '/policies/', '/wishlist/', '/account/'];
    if (in_array($path, $pages, true)) return true;
    foreach (om_products() as $product) {
        $category = ($product['type'] ?? '') === 'Sunglasses' ? 'syze-dielli' : 'syze-optike';
        if ($path === '/' . $category . '/' . rawurlencode((string) $product['id']) . '/') return true;
    }
    // Compiled guide pages are public; never allow internal APIs or staff routes.
    $registry = json_decode((string) @file_get_contents(dirname(__DIR__) . '/seo-pages.json'), true);
    return str_starts_with($path, '/lens-focus/') && isset($registry['pages'][rtrim($path, '/')]);
}

function om_cms_record_stock(string $productId, int $before, int $after, string $reason, string $reference = ''): void
{
    if ($before === $after) return;
    $movements = om_read('inventory_movements', []);
    array_unshift($movements, ['id' => om_id('MOV'), 'productId' => $productId, 'location' => 'main',
        'delta' => $after - $before, 'before' => $before, 'after' => $after, 'reason' => $reason,
        'reference' => $reference, 'actor' => $_SESSION['admin_email'] ?? 'checkout', 'at' => gmdate('c')]);
    om_write('inventory_movements', $movements);
}

function om_cms_state(): array
{
    $state = ['version' => 2, 'permissions' => om_staff_permissions(), 'role' => om_staff_member()['role'] ?? 'owner'];
    if (om_can('inventory.write')) $state += ['inventory' => om_cms_inventory(), 'movements' => array_slice(om_read('inventory_movements', []), 0, 300)];
    if (om_can('content.read')) $state += ['draft' => om_read('cms_content_draft', []), 'revisions' => array_map(static fn($r) => array_diff_key($r, ['content' => true]), om_read('cms_content_revisions', []))];
    if (om_can('marketing.read')) $state += ['rules' => om_read('cms_rules', []), 'offers' => om_read('cms_offers', [])];
    if (om_can('content.read')) $state += ['placements' => om_read('cms_placements', [])];
    if (om_can('catalog.read')) $state += ['collections' => om_read('cms_collections', [])];
    if (om_can('staff.manage')) $state += ['staff' => array_map(static fn($p) => array_intersect_key($p, array_flip(['id', 'name', 'email', 'role', 'active', 'updatedAt'])), om_read('staff_users', [])), 'roles' => om_staff_roles()];
    return $state;
}

function om_cms_active(array $record, ?int $now = null): bool
{
    $now ??= time();
    if (($record['status'] ?? '') !== 'Published') return false;
    $start = !empty($record['startsAt']) ? strtotime($record['startsAt']) : false;
    $end = !empty($record['endsAt']) ? strtotime($record['endsAt']) : false;
    return ($start === false || $start <= $now) && ($end === false || $end > $now);
}

function om_cms_local_image($value): string
{
    $image = is_string($value) ? trim($value) : '';
    if ($image !== '' && (!preg_match('~^/(?:assets|uploads)/[a-zA-Z0-9_/-]+\.(?:webp|png|jpe?g)$~i', $image) || !is_file(dirname(__DIR__) . $image))) {
        om_json(['ok' => false, 'error' => 'invalid_local_image'], 422);
    }
    return $image;
}

function om_cms_public_placements(): array
{
    $offers = array_column(om_read('cms_offers', []), null, 'id');
    $rules = array_column(om_read('cms_rules', []), null, 'id');
    $out = [];
    foreach (om_read('cms_placements', []) as $placement) {
        if (!om_cms_active($placement)) continue;
        if (!empty($placement['offerId'])) {
            $offer = $offers[$placement['offerId']] ?? null;
            if (!$offer || !om_cms_active($offer)) continue;
            if (!empty($offer['ruleId']) && (!isset($rules[$offer['ruleId']]) || !om_cms_active($rules[$offer['ruleId']]))) continue;
        }
        $out[] = array_intersect_key($placement, array_flip(['id','title','subtitle','image','mobileImage','alt','cta','href','position','order','locale','layout']));
    }
    usort($out, static fn($a, $b) => (($a['order'] ?? 0) <=> ($b['order'] ?? 0)) ?: strcmp($a['id'], $b['id']));
    return $out;
}

function om_cms_public_collections(): array
{
    $products = om_products(); $out = [];
    foreach (om_read('cms_collections', []) as $collection) {
        if (!om_cms_active($collection)) continue;
        $ids = [];
        foreach ($products as $product) {
            if (in_array($product['id'], $collection['excludeIds'] ?? [], true)) continue;
            if (($collection['mode'] ?? '') === 'dynamic') {
                $price = (float) (($product['salePrice'] ?? null) ?: $product['price']);
                if (!empty($collection['productType']) && $collection['productType'] !== ($product['type'] ?? '')) continue;
                if (!empty($collection['tag']) && !in_array(strtolower($collection['tag']), array_map('trim', explode(',', strtolower($product['tags'] ?? ''))), true)) continue;
                if ($price < ($collection['minimumPrice'] ?? 0) || (!empty($collection['maximumPrice']) && $price > $collection['maximumPrice'])) continue;
            } elseif (!in_array($product['id'], $collection['productIds'] ?? [], true)) continue;
            $ids[] = $product['id'];
        }
        if ($ids) $out[] = ['id' => $collection['id'], 'title' => $collection['title'], 'productIds' => $ids];
    }
    return $out;
}
