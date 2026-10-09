<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (!om_same_origin()) {
    om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$resource = om_clean($_GET['resource'] ?? '', 40);

if ($method === 'GET' && $resource === 'public') {
    om_release_expired_reservations();
    om_json([
        'ok' => true,
        'version' => OM_API_VERSION,
        'products' => om_products(),
        'content' => om_public_content(),
        'campaigns' => om_campaigns(),
        'commerce' => om_commerce_public_config(),
        'placements' => om_cms_public_placements(),
    ]);
}

om_session_start();

if ($method === 'GET' && $resource === 'session') {
    om_json([
        'ok' => true,
        'authenticated' => om_is_authenticated(),
        'email' => om_is_authenticated() ? (string) ($_SESSION['admin_email'] ?? '') : '',
        'csrf' => om_is_authenticated() ? om_csrf_token() : '',
        'passwordChangeRequired' => om_is_authenticated() ? om_password_change_required() : false,
    ]);
}

$input = om_input();
$action = om_clean($input['action'] ?? '', 60);

if ($method === 'POST' && $action === 'login') {
    om_rate_limit('admin_login', 20, 900);
    $attempts = (int) ($_SESSION['login_attempts'] ?? 0);
    $lockedUntil = (int) ($_SESSION['locked_until'] ?? 0);
    if ($lockedUntil > time()) {
        om_json(['ok' => false, 'error' => 'too_many_attempts', 'retryAfter' => $lockedUntil - time()], 429);
    }
    $email = strtolower(om_clean($input['email'] ?? '', 160));
    $password = is_string($input['password'] ?? null) ? $input['password'] : '';
    $credentials = om_credentials();
    if (!om_credentials_ready($credentials)) {
        om_json(['ok' => false, 'error' => 'setup_required'], 503);
    }
    $validEmail = hash_equals(strtolower((string) $credentials['email']), $email);
    $candidate = om_password_hash($password, (string) $credentials['salt'], (int) $credentials['iterations']);
    $validPassword = hash_equals((string) $credentials['hash'], $candidate);
    $staffLogin = null;
    if (!$validEmail || !$validPassword) {
        foreach (om_read('staff_users', []) as $person) {
            if (($person['active'] ?? false) && strtolower($person['email'] ?? '') === $email
                && password_verify($password, (string) ($person['passwordHash'] ?? ''))) { $staffLogin = $person; break; }
        }
    }
    if ((!$validEmail || !$validPassword) && !$staffLogin) {
        $_SESSION['login_attempts'] = $attempts + 1;
        if ($_SESSION['login_attempts'] >= 5) {
            $_SESSION['locked_until'] = time() + 900;
            $_SESSION['login_attempts'] = 0;
        }
        usleep(350000);
        om_json(['ok' => false, 'error' => 'invalid_credentials'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['optika_admin'] = true;
    $_SESSION['admin_email'] = $staffLogin ? $staffLogin['email'] : (string) $credentials['email'];
    unset($_SESSION['staff_id'], $_SESSION['staff_version']);
    if ($staffLogin) { $_SESSION['staff_id'] = $staffLogin['id']; $_SESSION['staff_version'] = $staffLogin['version']; }
    $_SESSION['last_seen'] = time();
    $_SESSION['login_attempts'] = 0;
    $_SESSION['csrf'] = bin2hex(random_bytes(24));
    om_audit('login', 'session', session_id());
    om_json([
        'ok' => true,
        'authenticated' => true,
        'email' => $_SESSION['admin_email'],
        'csrf' => $_SESSION['csrf'],
        'passwordChangeRequired' => om_password_change_required(),
    ]);
}

om_require_auth();

if ($method === 'GET' && $resource === 'snapshot') {
    if (om_password_change_required()) {
        om_json(['ok' => false, 'error' => 'password_change_required'], 403);
    }
    om_release_expired_reservations();
    $orders = om_read('orders', []);
    $customers = om_read('customers', []);
    $accounts = array_map('om_customer_public_profile', om_customer_accounts());
    $submissions = array_values(array_filter(om_read('submissions', []), static fn($s) => ($s['type'] ?? '') !== 'order'));
    $products = om_all_products();
    $revenue = array_reduce(
        array_filter($orders, static fn($order) => (string) ($order['status'] ?? '') === 'Completed'),
        static fn($sum, $order) => $sum + (float) ($order['total'] ?? 0),
        0.0
    );
    $requestValue = array_reduce(
        array_filter($orders, static fn($order) => !in_array((string) ($order['status'] ?? ''), ['Cancelled', 'Returned'], true)),
        static fn($sum, $order) => $sum + (float) ($order['total'] ?? 0),
        0.0
    );
    om_json([
        'ok' => true,
        'csrf' => om_csrf_token(),
        'user' => ['email' => (string) ($_SESSION['admin_email'] ?? '')],
        'products' => om_can('catalog.read') ? array_map('om_public_product', $products) : [],
        'orders' => om_can('orders.read') ? $orders : [],
        'customers' => om_can('customers.read') ? $customers : [],
        'accounts' => om_can('customers.read') ? $accounts : [],
        'submissions' => om_can('contacts.read') ? $submissions : [],
        'content' => om_can('content.read') ? om_public_content() : [],
        'campaigns' => om_can('marketing.read') ? om_campaigns() : [],
        'cms' => om_cms_state(),
        'commerce' => om_commerce_public_config(),
        'analytics' => om_can('analytics.read') ? om_analytics_summary() : [],
        'audit' => om_can('audit.read') ? array_slice(om_read('audit', []), 0, 80) : [],
        'metrics' => [
            'revenue' => om_can('orders.read') ? $revenue : 0,
            'requestValue' => om_can('orders.read') ? $requestValue : 0,
            'openOrders' => om_can('orders.read') ? count(array_filter($orders, static fn($o) => !in_array((string) ($o['status'] ?? ''), ['Completed', 'Returned', 'Cancelled'], true))) : 0,
            'lowStock' => om_can('catalog.read') ? count(array_filter($products, static fn($p) => (string) ($p['status'] ?? 'Published') !== 'Archived' && (int) ($p['stock'] ?? 0) <= 5)) : 0,
            'newSubmissions' => om_can('contacts.read') ? count(array_filter($submissions, static fn($s) => ($s['status'] ?? 'New') === 'New')) : 0,
        ],
    ]);
}

if ($method !== 'POST') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}
om_require_csrf();

if (om_password_change_required() && !in_array($action, ['change_password', 'logout'], true)) {
    om_json(['ok' => false, 'error' => 'password_change_required'], 403);
}

if ($action === 'logout') {
    om_audit('logout', 'session', session_id());
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
    }
    session_destroy();
    om_json(['ok' => true]);
}

$permissions = [
    'import_products' => 'catalog.replace', 'save_product' => 'catalog.write', 'delete_product' => 'catalog.delete',
    'save_campaign' => 'marketing.publish', 'delete_customer' => 'customers.delete',
    'update_customer_account' => 'customers.write', 'update_customer' => 'customers.write',
    'update_order' => 'orders.write', 'update_submission' => 'contacts.write',
    'save_content' => 'content.publish', 'save_content_draft' => 'content.write',
    'publish_content' => 'content.publish', 'restore_content' => 'content.publish',
];
if (isset($permissions[$action])) om_require_permission($permissions[$action]);
if ($action === 'update_order' && ($input['order']['paymentStatus'] ?? '') === 'Refunded') om_require_permission('orders.refund');

if ($action === 'import_products') {
    $commerceLock = om_acquire_commerce_lock();
    // Legacy setup endpoint is owner-only and cannot replace an operational store.
    if (om_read('orders', [])) om_json(['ok' => false, 'error' => 'use_merge_import'], 409);
    $incoming = is_array($input['products'] ?? null) ? $input['products'] : [];
    if (count($incoming) > 1000) {
        om_json(['ok' => false, 'error' => 'too_many_products'], 422);
    }
    $products = [];
    foreach ($incoming as $product) {
        if (!is_array($product) || om_clean($product['name'] ?? '', 140) === '') continue;
        $product['id'] = om_clean($product['id'] ?? om_id('PRD'), 100);
        $product['name'] = om_clean($product['name'], 140);
        $product['stock'] = max(0, (int) ($product['stock'] ?? 0));
        $product['price'] = max(0, (float) ($product['price'] ?? 0));
        $status = om_clean($product['status'] ?? 'Published', 20);
        $product['status'] = in_array($status, ['Published', 'Draft', 'Archived'], true) ? $status : 'Draft';
        $product['updatedAt'] = gmdate('c');
        $products[] = $product;
    }
    om_write('products', $products);
    om_release_commerce_lock($commerceLock);
    om_audit('catalog_imported', 'products', (string) count($products));
    om_json(['ok' => true, 'products' => $products]);
}

if ($action === 'save_product') {
    $commerceLock = om_acquire_commerce_lock();
    $product = is_array($input['product'] ?? null) ? $input['product'] : [];
    $product = om_cms_validate_product($product, om_all_products());
    if ($product['status'] === 'Published') om_require_permission('catalog.publish');
    $name = om_clean($product['name'] ?? '', 140);
    if ($name === '') om_json(['ok' => false, 'error' => 'product_name_required'], 422);
    $product['id'] = om_clean($product['id'] ?? '', 100) ?: om_id('PRD');
    $product['sku'] = om_clean($product['sku'] ?? '', 80) ?: strtoupper($product['id']);
    $product['name'] = $name;
    $product['stock'] = max(0, (int) ($product['stock'] ?? 0));
    $product['price'] = max(0, (float) ($product['price'] ?? 0));
    $product['salePrice'] = isset($product['salePrice']) && $product['salePrice'] !== '' ? max(0, (float) $product['salePrice']) : null;
    $status = om_clean($product['status'] ?? 'Published', 20);
    $product['status'] = in_array($status, ['Published', 'Draft', 'Archived'], true) ? $status : 'Draft';
    $product['image'] = om_clean($product['image'] ?? '', 500);
    $product['description'] = om_clean($product['description'] ?? '', 1800);
    $product['updatedAt'] = gmdate('c');
    $products = om_all_products();
    $found = false;
    foreach ($products as $index => $existing) {
        if (($existing['id'] ?? '') === $product['id']) {
            if ((int) ($product['stock'] ?? 0) !== (int) ($existing['stock'] ?? 0)
                && (!array_key_exists('expectedStock', $input) || (int) $input['expectedStock'] !== (int) ($existing['stock'] ?? 0))) {
                om_json(['ok' => false, 'error' => 'stock_conflict'], 409);
            }
            $products[$index] = array_merge($existing, $product);
            om_cms_record_stock($product['id'], (int) ($existing['stock'] ?? 0), (int) $product['stock'], 'catalogue_edit');
            $found = true;
            break;
        }
    }
    if (!$found) array_unshift($products, $product);
    om_write('products', $products);
    om_release_commerce_lock($commerceLock);
    om_audit($found ? 'product_updated' : 'product_created', 'product', (string) $product['id']);
    om_json(['ok' => true, 'product' => $product, 'products' => $products]);
}

if ($action === 'delete_product') {
    $commerceLock = om_acquire_commerce_lock();
    $id = om_clean($input['id'] ?? '', 100);
    foreach (om_read('orders', []) as $order) foreach (($order['items'] ?? []) as $line) {
        if (($line['productId'] ?? '') === $id) om_json(['ok' => false, 'error' => 'sold_product_archive_required'], 409);
    }
    $products = array_values(array_filter(om_all_products(), static fn($p) => ($p['id'] ?? '') !== $id));
    om_write('products', $products);
    om_release_commerce_lock($commerceLock);
    om_audit('product_deleted', 'product', $id);
    om_json(['ok' => true, 'products' => $products]);
}

if ($action === 'save_campaign') {
    $campaign = is_array($input['campaign'] ?? null) ? $input['campaign'] : [];
    $code = strtoupper(preg_replace('/[^A-Z0-9_-]/', '', strtoupper(om_clean($campaign['code'] ?? '', 40))));
    if ($code === '') om_json(['ok' => false, 'error' => 'campaign_code_required'], 422);
    $value = om_clean($campaign['value'] ?? '', 30);
    if (!preg_match('/^(?:[0-9]+(?:\.[0-9]+)?%|Free)$/i', $value) || (str_contains($value, '%') && (float) $value > 100)) {
        om_json(['ok' => false, 'error' => 'invalid_campaign_value'], 422);
    }
    $next = [
        'code' => $code,
        'value' => $value,
        'scope' => om_clean($campaign['scope'] ?? 'Entire order', 100),
        'active' => !empty($campaign['active']),
        'channel' => om_clean($campaign['channel'] ?? 'Checkout', 80),
        'updatedAt' => gmdate('c'),
    ];
    $campaigns = om_campaigns();
    $found = false;
    foreach ($campaigns as $index => $existing) {
        if (strtoupper((string) ($existing['code'] ?? '')) === $code) {
            $campaigns[$index] = array_merge($existing, $next);
            $found = true;
            break;
        }
    }
    if (!$found) array_unshift($campaigns, $next);
    om_write('campaigns', $campaigns);
    om_audit($found ? 'campaign_updated' : 'campaign_created', 'campaign', $code);
    om_json(['ok' => true, 'campaigns' => $campaigns]);
}

if ($action === 'delete_customer') {
    $id = om_clean($input['id'] ?? '', 100);
    if ($id === '') om_json(['ok' => false, 'error' => 'record_id_required'], 422);
    $commerceLock = om_acquire_commerce_lock();
    $allCustomers = om_read('customers', []);
    $target = null;
    foreach ($allCustomers as $customer) {
        if ((string) ($customer['id'] ?? '') === $id) { $target = $customer; break; }
    }
    if (!$target) om_json(['ok' => false, 'error' => 'record_not_found'], 404);
    $targetEmail = strtolower((string) ($target['email'] ?? ''));
    $targetPhone = preg_replace('/\s+/', '', (string) ($target['phone'] ?? ''));
    $matchesTarget = static function (array $record) use ($targetEmail, $targetPhone): bool {
        $emailMatch = $targetEmail !== '' && strtolower((string) ($record['email'] ?? '')) === $targetEmail;
        $phoneMatch = $targetPhone !== '' && preg_replace('/\s+/', '', (string) ($record['phone'] ?? '')) === $targetPhone;
        return $emailMatch || $phoneMatch;
    };
    $orders = om_read('orders', []);
    $prescriptionOrderIds = [];
    foreach ($orders as $index => $order) {
        if (!$matchesTarget($order)) continue;
        $prescriptionOrderIds[(string) ($order['id'] ?? '')] = true;
        $orders[$index]['customer'] = 'Deleted customer';
        $orders[$index]['email'] = '';
        $orders[$index]['phone'] = '';
        $orders[$index]['deliveryAddress'] = '';
        $orders[$index]['contactPreference'] = '';
        $orders[$index]['customerNote'] = '';
        $orders[$index]['updatedAt'] = gmdate('c');
    }
    $submissions = om_read('submissions', []);
    foreach ($submissions as $index => $submission) {
        if (!$matchesTarget($submission)) continue;
        $submissions[$index]['name'] = 'Deleted customer';
        $submissions[$index]['email'] = '';
        $submissions[$index]['phone'] = '';
        $submissions[$index]['message'] = '';
        $submissions[$index]['updatedAt'] = gmdate('c');
    }
    $customers = array_values(array_filter($allCustomers, static fn($customer) => (string) ($customer['id'] ?? '') !== $id));
    $accounts = array_values(array_filter(
        om_customer_accounts(),
        static fn($account) => $targetEmail === '' || strtolower((string) ($account['email'] ?? '')) !== $targetEmail
    ));
    if ($prescriptionOrderIds) {
        $remainingUploads = [];
        foreach (om_read('prescription_uploads', []) as $upload) {
            if (!is_array($upload) || !isset($prescriptionOrderIds[(string) ($upload['orderId'] ?? '')])) {
                $remainingUploads[] = $upload;
                continue;
            }
            $storedName = basename((string) ($upload['storedName'] ?? ''));
            if ($storedName !== '') @unlink(om_storage_dir() . '/prescriptions/' . $storedName);
        }
        om_write('prescription_uploads', $remainingUploads);
    }
    om_write('customers', $customers);
    om_write('customer_accounts', $accounts);
    om_write('orders', $orders);
    om_write('submissions', $submissions);
    om_release_commerce_lock($commerceLock);
    om_audit('customer_anonymized', 'customer', $id);
    om_json(['ok' => true, 'customers' => $customers, 'orders' => $orders, 'submissions' => $submissions]);
}

if ($action === 'update_customer_account') {
    $id = om_clean($input['id'] ?? '', 100);
    $status = om_clean($input['status'] ?? '', 20);
    if ($id === '' || !in_array($status, ['Active', 'Disabled'], true)) {
        om_json(['ok' => false, 'error' => 'invalid_account_update'], 422);
    }
    $commerceLock = om_acquire_commerce_lock();
    $accounts = om_customer_accounts();
    $updated = false;
    foreach ($accounts as $index => $account) {
        if ((string) ($account['id'] ?? '') !== $id) continue;
        $accounts[$index]['status'] = $status;
        $accounts[$index]['updatedAt'] = gmdate('c');
        $updated = true;
        break;
    }
    if (!$updated) om_json(['ok' => false, 'error' => 'record_not_found'], 404);
    om_write('customer_accounts', $accounts);
    om_audit('customer_account_updated', 'account', $id);
    om_release_commerce_lock($commerceLock);
    om_json(['ok' => true, 'accounts' => array_map('om_customer_public_profile', $accounts)]);
}

if (in_array($action, ['update_order', 'update_customer', 'update_submission'], true)) {
    $map = [
        'update_order' => ['orders', 'order'],
        'update_customer' => ['customers', 'customer'],
        'update_submission' => ['submissions', 'submission'],
    ];
    [$store, $entity] = $map[$action];
    $record = is_array($input[$entity] ?? null) ? $input[$entity] : [];
    $id = om_clean($record['id'] ?? '', 100);
    if ($id === '') om_json(['ok' => false, 'error' => 'record_id_required'], 422);
    $commerceLock = in_array($action, ['update_order', 'update_submission'], true) ? om_acquire_commerce_lock() : null;
    $items = om_read($store, []);
    $updated = false;
    $updatedProducts = null;
    $customerValueChange = null;
    foreach ($items as $index => $item) {
        if (($item['id'] ?? '') === $id) {
            if ($action === 'update_order') {
                $allowedStatuses = ['Pending', 'Confirmed', 'In lab', 'Ready', 'Completed', 'Return requested', 'Returned', 'Cancelled'];
                $allowedPayments = ['Awaiting confirmation', 'Awaiting payment', 'Partially paid', 'Paid', 'Refunded'];
                $allowedFulfilment = ['Unfulfilled', 'Processing', 'Ready for pickup', 'Shipped', 'Delivered', 'Cancelled'];
                $next = ['id' => $id];
                if (array_key_exists('status', $record)) {
                    $status = om_clean($record['status'], 40);
                    if (!in_array($status, $allowedStatuses, true)) om_json(['ok' => false, 'error' => 'invalid_order_status'], 422);
                    $next['status'] = $status;
                }
                if (array_key_exists('paymentStatus', $record)) {
                    $paymentStatus = om_clean($record['paymentStatus'], 40);
                    if (!in_array($paymentStatus, $allowedPayments, true)) om_json(['ok' => false, 'error' => 'invalid_payment_status'], 422);
                    $next['paymentStatus'] = $paymentStatus;
                }
                if (array_key_exists('fulfillmentStatus', $record)) {
                    $fulfilmentStatus = om_clean($record['fulfillmentStatus'], 40);
                    if (!in_array($fulfilmentStatus, $allowedFulfilment, true)) om_json(['ok' => false, 'error' => 'invalid_fulfillment_status'], 422);
                    $next['fulfillmentStatus'] = $fulfilmentStatus;
                }
                foreach (['trackingNumber' => 120, 'staffNote' => 800] as $field => $limit) {
                    if (array_key_exists($field, $record)) $next[$field] = om_clean($record[$field], $limit);
                }
                if (array_key_exists('paymentLink', $record)) {
                    $paymentLink = om_clean($record['paymentLink'], 500);
                    if ($paymentLink !== '' && (!filter_var($paymentLink, FILTER_VALIDATE_URL) || !str_starts_with(strtolower($paymentLink), 'https://'))) {
                        om_json(['ok' => false, 'error' => 'invalid_payment_link'], 422);
                    }
                    $next['paymentLink'] = $paymentLink;
                }

                $currentInventoryState = (string) ($item['inventoryState'] ?? 'Legacy');
                $nextStatus = (string) ($next['status'] ?? ($item['status'] ?? 'Pending'));
                $currentStatus = (string) ($item['status'] ?? 'Pending');
                if ($nextStatus !== $currentStatus) {
                    $closedStatuses = ['Completed', 'Returned', 'Cancelled'];
                    $currentIsRequest = !in_array($currentStatus, $closedStatuses, true);
                    $nextIsRequest = !in_array($nextStatus, $closedStatuses, true);
                    $currentIsSpend = $currentStatus === 'Completed';
                    $nextIsSpend = $nextStatus === 'Completed';
                    $orderValue = (float) ($item['total'] ?? 0);
                    $customerValueChange = [
                        'email' => (string) ($item['email'] ?? ''),
                        'phone' => (string) ($item['phone'] ?? ''),
                        'requestDelta' => (($nextIsRequest ? 1 : 0) - ($currentIsRequest ? 1 : 0)) * $orderValue,
                        'spendDelta' => (($nextIsSpend ? 1 : 0) - ($currentIsSpend ? 1 : 0)) * $orderValue,
                    ];
                }
                if (in_array($nextStatus, ['Confirmed', 'In lab', 'Ready', 'Completed'], true)) {
                    $next['priceStatus'] = 'Confirmed by optician';
                    if (!empty($item['appliedRuleIds'])) $next['discountConsumedAt'] = $item['discountConsumedAt'] ?? gmdate('c');
                }
                $quantities = [];
                foreach ((array) ($item['items'] ?? []) as $line) {
                    if (!is_array($line) || empty($line['productId'])) continue;
                    $productId = (string) $line['productId'];
                    $quantities[$productId] = ($quantities[$productId] ?? 0) + max(1, (int) ($line['quantity'] ?? 1));
                }
                if ($nextStatus === 'Cancelled' && $currentInventoryState === 'Reserved' && $quantities) {
                    $updatedProducts = om_adjust_inventory($quantities, 1);
                    $next['inventoryState'] = 'Released';
                    $next['fulfillmentStatus'] = 'Cancelled';
                } elseif ($nextStatus === 'Completed' && $currentInventoryState === 'Reserved') {
                    $next['inventoryState'] = 'Committed';
                    $next['fulfillmentStatus'] = $next['fulfillmentStatus'] ?? 'Delivered';
                } elseif ($nextStatus !== 'Cancelled' && $currentInventoryState === 'Released' && $quantities) {
                    $updatedProducts = om_adjust_inventory($quantities, -1);
                    $next['inventoryState'] = 'Reserved';
                }
                $record = $next;
            } elseif ($action === 'update_customer') {
                $record = ['id' => $id, 'status' => om_clean($record['status'] ?? ($item['status'] ?? 'Active'), 40)];
            } elseif ($action === 'update_submission') {
                $allowedSubmissionStatuses = ['New', 'Contacted', 'Confirmed', 'Completed', 'Closed'];
                $submissionStatus = om_clean($record['status'] ?? ($item['status'] ?? 'New'), 40);
                if (!in_array($submissionStatus, $allowedSubmissionStatuses, true)) {
                    om_json(['ok' => false, 'error' => 'invalid_submission_status'], 422);
                }
                $record = [
                    'id' => $id,
                    'status' => $submissionStatus,
                    'assignedTo' => om_clean($record['assignedTo'] ?? ($item['assignedTo'] ?? ''), 120),
                    'confirmedDate' => om_clean($record['confirmedDate'] ?? ($item['confirmedDate'] ?? ''), 30),
                    'confirmedTime' => om_clean($record['confirmedTime'] ?? ($item['confirmedTime'] ?? ''), 30),
                    'internalNote' => om_clean($record['internalNote'] ?? ($item['internalNote'] ?? ''), 800),
                ];
            }
            $record['updatedAt'] = gmdate('c');
            $mergedRecord = array_merge($item, $record);
            if ($action === 'update_order') {
                $notifyFields = ['status', 'paymentStatus', 'fulfillmentStatus', 'trackingNumber', 'paymentLink'];
                $shouldNotify = false;
                foreach ($notifyFields as $field) {
                    if (array_key_exists($field, $record) && (string) ($item[$field] ?? '') !== (string) ($record[$field] ?? '')) {
                        $shouldNotify = true;
                        break;
                    }
                }
                if ($shouldNotify && !empty($mergedRecord['email'])) {
                    $sent = om_send_transactional_email(
                        (string) $mergedRecord['email'],
                        'Optika Miftari — përditësim ' . $id,
                        om_order_status_email_body($mergedRecord)
                    );
                    $notifications = is_array($mergedRecord['notificationStatus'] ?? null) ? $mergedRecord['notificationStatus'] : [];
                    $notifications['lastStatusUpdate'] = $sent ? 'Sent' : 'Unavailable';
                    $notifications['lastAttemptedAt'] = gmdate('c');
                    $mergedRecord['notificationStatus'] = $notifications;
                }
            }
            $items[$index] = $mergedRecord;
            $updated = true;
            break;
        }
    }
    if (!$updated) om_json(['ok' => false, 'error' => 'record_not_found'], 404);
    om_write($store, $items);
    if (is_array($customerValueChange)) {
        om_apply_customer_value(
            (string) $customerValueChange['email'],
            (string) $customerValueChange['phone'],
            (float) $customerValueChange['requestDelta'],
            (float) $customerValueChange['spendDelta']
        );
    }
    om_release_commerce_lock($commerceLock);
    om_audit($action, $entity, $id);
    $response = ['ok' => true, $store => $items];
    if ($store === 'submissions') $response[$store] = array_values(array_filter($items, static fn($s) => ($s['type'] ?? '') !== 'order'));
    if (is_array($updatedProducts)) $response['products'] = $updatedProducts;
    om_json($response);
}

if (in_array($action, ['save_content', 'save_content_draft', 'publish_content', 'restore_content'], true)) {
    $contentLock = om_acquire_commerce_lock();
    if ($action === 'publish_content') {
        $draft = om_read('cms_content_draft', []);
        if (empty($draft['content'])) om_json(['ok' => false, 'error' => 'content_draft_required'], 422);
        if (($input['revision'] ?? '') !== ($draft['revision'] ?? '')) om_json(['ok' => false, 'error' => 'content_conflict'], 409);
        $input['content'] = $draft['content'];
    }
    if ($action === 'restore_content') {
        $input['content'] = null;
        foreach (om_read('cms_content_revisions', []) as $revision) if (($revision['id'] ?? '') === ($input['id'] ?? '')) $input['content'] = $revision['content'];
        if (!is_array($input['content'])) om_json(['ok' => false, 'error' => 'record_not_found'], 404);
    }
    $content = is_array($input['content'] ?? null) ? $input['content'] : [];
    $allowed = [
        'heroTitle', 'heroSubtitle', 'primaryCta', 'secondaryCta', 'announcement',
        'shopTitle', 'shopSubtitle',
        'examinationTitle', 'examinationSubtitle',
        'prescriptionTitle', 'prescriptionSubtitle',
        'sunglassesTitle', 'sunglassesSubtitle',
        'aboutTitle', 'aboutSubtitle',
        'contactTitle', 'contactSubtitle',
        'homeSeoTitle', 'homeSeoDescription',
        'shopSeoTitle', 'shopSeoDescription',
        'examinationSeoTitle', 'examinationSeoDescription',
        'prescriptionSeoTitle', 'prescriptionSeoDescription',
        'sunglassesSeoTitle', 'sunglassesSeoDescription',
        'aboutSeoTitle', 'aboutSeoDescription',
        'contactSeoTitle', 'contactSeoDescription',
    ];
    $allowed = array_merge($allowed, array_keys(require __DIR__ . '/holding-content.php'));
    $next = om_public_content();
    $imageKeys = ['heroImage', 'homeCollectionImage', 'laboratoryImage', 'examinationImage', 'aboutImage', 'prescriptionImage', 'sunglassesImage', 'lensDetailImage', 'contactImage', 'groupOpticalImage', 'groupLabImage', 'clinicImage', 'groupHeroImage', 'groupSunImage', 'groupCraftImage', 'labKosovoImage', 'labEuropeImage', 'opticalLifestyleImage'];
    foreach ($imageKeys as $key) {
        if (!array_key_exists($key, $content)) continue;
        $image = is_string($content[$key]) ? trim($content[$key]) : '';
        if ($image !== '' && (!preg_match('~^/(?:assets|uploads)/[a-zA-Z0-9_/-]+\.(?:webp|png|jpe?g)$~i', $image) || !is_file(dirname(__DIR__) . $image))) {
            om_json(['ok' => false, 'error' => 'Fotografia duhet të jetë një imazh i ngarkuar në këtë faqe.'], 422);
        }
        $next[$key] = $image;
    }
    foreach ($allowed as $key) {
        if (array_key_exists($key, $content)) {
            $isLongText = str_ends_with($key, 'Subtitle') || str_ends_with($key, 'SeoDescription');
            $next[$key] = om_clean($content[$key], $isLongText ? 500 : 220);
        }
    }
    $next['updatedAt'] = gmdate('c');
    if ($action === 'save_content_draft') {
        $currentDraft = om_read('cms_content_draft', []);
        if (($input['revision'] ?? '') !== ($currentDraft['revision'] ?? '')) om_json(['ok' => false, 'error' => 'content_conflict'], 409);
        $draft = ['revision' => bin2hex(random_bytes(12)), 'content' => $next, 'updatedAt' => gmdate('c'), 'actor' => $_SESSION['admin_email']];
        om_write('cms_content_draft', $draft);
        om_release_commerce_lock($contentLock);
        om_audit('content_draft_saved', 'content', $draft['revision']);
        om_json(['ok' => true, 'draft' => $draft]);
    }
    $revisions = om_read('cms_content_revisions', []);
    array_unshift($revisions, ['id' => om_id('REV'), 'at' => gmdate('c'), 'actor' => $_SESSION['admin_email'], 'content' => om_public_content()]);
    om_write('cms_content_revisions', array_slice($revisions, 0, 30));
    om_write('content', $next);
    if (in_array($action, ['publish_content', 'restore_content'], true)) om_write('cms_content_draft', []);
    om_release_commerce_lock($contentLock);
    om_audit('content_updated', 'content', 'homepage');
    om_json(['ok' => true, 'content' => $next]);
}

if ($action === 'change_password') {
    $current = is_string($input['currentPassword'] ?? null) ? $input['currentPassword'] : '';
    $next = is_string($input['newPassword'] ?? null) ? $input['newPassword'] : '';
    if ($member = om_staff_member()) {
        if (!password_verify($current, $member['passwordHash'])) om_json(['ok' => false, 'error' => 'current_password_incorrect'], 422);
        if (strlen($next) < 12) om_json(['ok' => false, 'error' => 'password_too_short'], 422);
        $lock = om_acquire_commerce_lock(); $members = om_read('staff_users', []);
        foreach ($members as &$person) if ($person['id'] === $member['id']) {
            $person['passwordHash'] = password_hash($next, PASSWORD_DEFAULT); $person['version']++;
            $_SESSION['staff_version'] = $person['version'];
        }
        unset($person); om_write('staff_users', $members); om_release_commerce_lock($lock);
        om_audit('password_changed', 'staff', $member['id']); om_json(['ok' => true]);
    }
    $credentials = om_credentials();
    if (!om_credentials_ready($credentials)) {
        om_json(['ok' => false, 'error' => 'setup_required'], 503);
    }
    $currentHash = om_password_hash($current, (string) $credentials['salt'], (int) $credentials['iterations']);
    if (!hash_equals((string) $credentials['hash'], $currentHash)) {
        om_json(['ok' => false, 'error' => 'current_password_incorrect'], 422);
    }
    if (strlen($next) < 12) {
        om_json(['ok' => false, 'error' => 'password_too_short'], 422);
    }
    $salt = bin2hex(random_bytes(16));
    $credentials['salt'] = $salt;
    $credentials['hash'] = om_password_hash($next, $salt, OM_PASSWORD_ITERATIONS);
    $credentials['iterations'] = OM_PASSWORD_ITERATIONS;
    $credentials['updatedAt'] = gmdate('c');
    om_write('credentials', $credentials);
    om_audit('password_changed', 'user', (string) $credentials['email']);
    om_json(['ok' => true]);
}

om_json(['ok' => false, 'error' => 'unknown_action'], 404);
