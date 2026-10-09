<?php
declare(strict_types=1);

const OM_API_VERSION = '1.0.0';
const OM_DEFAULT_ADMIN_EMAIL = 'admin@optikamiftari.com';
const OM_PASSWORD_ITERATIONS = 210000;
require_once __DIR__ . '/cms-core.php';
require_once __DIR__ . '/cms-discounts.php';

function om_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow, noarchive');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function om_storage_dir(): string
{
    static $resolved = null;
    if (is_string($resolved)) {
        return $resolved;
    }
    $configured = trim((string) getenv('OPTIKA_STORAGE_DIR'));
    $candidates = array_filter([
        $configured,
        dirname(__DIR__, 2) . '/optika-miftari-data',
        __DIR__ . '/storage',
    ]);
    foreach ($candidates as $candidate) {
        if ((is_dir($candidate) || @mkdir($candidate, 0750, true)) && is_writable($candidate)) {
            $resolved = $candidate;
            return $resolved;
        }
    }
    om_json(['ok' => false, 'error' => 'storage_unavailable'], 500);
}

function om_boot_storage(): void
{
    om_storage_dir();
}

function om_commerce_seed(): array
{
    static $seed = null;
    if (is_array($seed)) {
        return $seed;
    }
    $path = __DIR__ . '/storage/commerce-seed.json';
    $decoded = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
    $seed = is_array($decoded) ? $decoded : [
        'version' => 'unavailable',
        'currency' => 'EUR',
        'products' => [],
        'lensPackages' => [],
        'coatings' => [],
        'campaigns' => [],
        'shipping' => [],
        'inventory' => ['reservationMinutes' => 1440, 'maximumLineQuantity' => 10],
    ];
    return $seed;
}

function om_normalize_asset_path($value)
{
    // The 2026-08-20 release converted bundled product/brand imagery from PNG to WebP;
    // stored data written by earlier releases may still reference the retired .png files.
    if (is_string($value) && preg_match('#^/assets/(products|brand|concepts|references|assembly)/[^/]+\.png$#', $value)) {
        $webp = substr($value, 0, -4) . '.webp';
        if (is_file(dirname(__DIR__) . $webp) || !is_file(dirname(__DIR__) . $value)) {
            return $webp;
        }
    }
    return $value;
}

function om_normalize_product_images(array $product): array
{
    if (isset($product['image'])) {
        $product['image'] = om_normalize_asset_path($product['image']);
    }
    if (isset($product['gallery']) && is_array($product['gallery'])) {
        $product['gallery'] = array_map('om_normalize_asset_path', $product['gallery']);
    }
    return $product;
}

function om_all_products(): array
{
    // A missing store may initialize from the bundled catalogue. An explicit
    // saved [] is an intentionally empty catalogue, never a request to reseed.
    $products = om_read('products', (array) (om_commerce_seed()['products'] ?? []));
    return array_map(
        static fn($product) => is_array($product) ? om_normalize_product_images($product) : $product,
        $products
    );
}

function om_products(): array
{
    return array_map('om_public_product', array_values(array_filter(
        om_all_products(),
        static fn($product) => (string) ($product['status'] ?? 'Published') === 'Published'
    )));
}

function om_campaigns(): array
{
    $stored = om_read('campaigns', []);
    return $stored ?: (array) (om_commerce_seed()['campaigns'] ?? []);
}

function om_commerce_public_config(): array
{
    $seed = om_commerce_seed();
    return [
        'version' => (string) ($seed['version'] ?? OM_API_VERSION),
        'currency' => (string) ($seed['currency'] ?? 'EUR'),
        'shipping' => (array) ($seed['shipping'] ?? []),
        'maximumLineQuantity' => max(1, (int) ($seed['inventory']['maximumLineQuantity'] ?? 10)),
        'paymentMode' => 'manual_confirmation',
    ];
}

function om_money(float $value): float
{
    return round(max(0, $value) + 0.000001, 2);
}

function om_find_named_option(array $options, string $requested): ?array
{
    $needle = strtolower(trim($requested));
    foreach ($options as $option) {
        if (!is_array($option)) continue;
        if ($needle !== '' && in_array($needle, [
            strtolower((string) ($option['id'] ?? '')),
            strtolower((string) ($option['name'] ?? '')),
        ], true)) {
            return $option;
        }
    }
    return null;
}

function om_quote_order(array $input): array
{
    $seed = om_commerce_seed();
    $products = om_products();
    $productMap = [];
    foreach ($products as $product) {
        if (is_array($product) && !empty($product['id'])) {
            $productMap[(string) $product['id']] = $product;
        }
    }

    $maximum = max(1, (int) ($seed['inventory']['maximumLineQuantity'] ?? 10));
    $incomingItems = is_array($input['items'] ?? null) ? $input['items'] : [];
    if (count($incomingItems) > 25) {
        om_json(['ok' => false, 'error' => 'cart_line_limit'], 422);
    }
    if (!$incomingItems) {
        om_json(['ok' => false, 'error' => 'cart_empty'], 422);
    }

    $lineItems = [];
    $subtotal = 0.0;
    $lensEligible = 0.0;
    $polarizedEligible = 0.0;
    $requestedByProduct = [];
    $configurationKeys = ['purchaseMode', 'lensPackage', 'coating', 'rxMode', 'frameVariant', 'lensTint', 'sunTreatment', 'lifestyle', 'prescriptionToken', 'manualPrescription'];

    foreach ($incomingItems as $incomingItem) {
        if (!is_array($incomingItem)) om_json(['ok' => false, 'error' => 'invalid_cart_item'], 422);
        $productId = om_clean($incomingItem['productId'] ?? '', 100);
        $product = $productMap[$productId] ?? null;
        if (!$product) {
            om_json(['ok' => false, 'error' => 'product_not_found', 'productId' => $productId], 422);
        }

        $rawQuantity = $incomingItem['quantity'] ?? 1;
        if (!is_numeric($rawQuantity) || (float) $rawQuantity !== (float) (int) $rawQuantity || (int) $rawQuantity < 1 || (int) $rawQuantity > $maximum) {
            om_json(['ok' => false, 'error' => 'invalid_quantity', 'productId' => $productId], 422);
        }
        $quantity = (int) $rawQuantity;
        $requestedByProduct[$productId] = ($requestedByProduct[$productId] ?? 0) + $quantity;
        $stock = max(0, (int) ($product['stock'] ?? 0));
        if ($requestedByProduct[$productId] > $stock) {
            om_json([
                'ok' => false,
                'error' => 'insufficient_stock',
                'productId' => $productId,
                'productName' => (string) ($product['name'] ?? $productId),
                'available' => $stock,
            ], 409);
        }

        $incomingConfiguration = is_array($incomingItem['configuration'] ?? null) ? $incomingItem['configuration'] : [];
        $configuration = [];
        foreach ($configurationKeys as $key) {
            if (array_key_exists($key, $incomingConfiguration)) {
                $configuration[$key] = om_clean($incomingConfiguration[$key], 180);
            }
        }

        $basePrice = isset($product['salePrice']) && $product['salePrice'] !== null && (float) $product['salePrice'] > 0
            ? (float) $product['salePrice']
            : (float) ($product['price'] ?? 0);
        $unitPrice = $basePrice;
        $lensPrice = 0.0;
        $purchaseMode = (string) ($configuration['purchaseMode'] ?? 'ready');
        if ($purchaseMode === 'prescription') {
            if (empty($product['prescriptionReady'])) {
                om_json(['ok' => false, 'error' => 'prescription_not_supported', 'productId' => $productId], 422);
            }
            $lens = om_find_named_option((array) ($seed['lensPackages'] ?? []), (string) ($configuration['lensPackage'] ?? ''));
            $coating = om_find_named_option((array) ($seed['coatings'] ?? []), (string) ($configuration['coating'] ?? ''));
            if (!$lens || !$coating) {
                om_json(['ok' => false, 'error' => 'invalid_lens_configuration', 'productId' => $productId], 422);
            }
            $lensPrice = (float) ($lens['price'] ?? 0);
            $unitPrice += $lensPrice + (float) ($coating['price'] ?? 0);
            $configuration['lensPackage'] = (string) ($lens['name'] ?? '');
            $configuration['coating'] = (string) ($coating['name'] ?? '');
            $rxMode = (string) ($configuration['rxMode'] ?? '');
            if ($rxMode === 'Ngarko recetën') {
                $token = (string) ($configuration['prescriptionToken'] ?? '');
                $validToken = false;
                foreach (om_read('prescription_uploads', []) as $upload) {
                    if (is_array($upload) && $token !== '' && hash_equals((string) ($upload['token'] ?? ''), $token)) {
                        $validToken = true;
                        break;
                    }
                }
                if (!$validToken) {
                    om_json(['ok' => false, 'error' => 'prescription_upload_required', 'productId' => $productId], 422);
                }
            }
            if ($rxMode === 'Shkruaje manualisht' && trim((string) ($configuration['manualPrescription'] ?? '')) === '') {
                om_json(['ok' => false, 'error' => 'manual_prescription_required', 'productId' => $productId], 422);
            }
        }

        $lineTotal = om_money($unitPrice * $quantity);
        $subtotal += $lineTotal;
        $lensEligible += $lensPrice * $quantity;
        if (!empty($product['polarized'])) {
            $polarizedEligible += $basePrice * $quantity;
        }
        $lineItems[] = [
            'productId' => $productId,
            'sku' => om_clean($product['sku'] ?? '', 80),
            'name' => om_clean($product['name'] ?? '', 180),
            'quantity' => $quantity,
            'unitPrice' => om_money($unitPrice),
            'lineTotal' => $lineTotal,
            'configuration' => $configuration,
        ];
    }

    $discountCode = strtoupper(om_clean($input['discountCode'] ?? '', 80));
    $campaign = null;
    foreach (om_campaigns() as $candidate) {
        if (is_array($candidate) && !empty($candidate['active']) && strtoupper((string) ($candidate['code'] ?? '')) === $discountCode) {
            $campaign = $candidate;
            break;
        }
    }
    $discount = 0.0;
    if ($campaign && preg_match('/([0-9]+(?:\.[0-9]+)?)%/', (string) ($campaign['value'] ?? ''), $match)) {
        $scope = strtolower((string) ($campaign['scope'] ?? ''));
        $eligible = str_contains($scope, 'lens') ? $lensEligible : (str_contains($scope, 'polarized') ? $polarizedEligible : $subtotal);
        $discount = om_money($eligible * (min(100, (float) $match[1]) / 100));
    }

    $shippingKey = om_clean($input['shippingKey'] ?? '', 40);
    $shippingOptions = (array) ($seed['shipping'] ?? []);
    if ($shippingKey === '' || !isset($shippingOptions[$shippingKey])) {
        om_json(['ok' => false, 'error' => 'invalid_shipping_method'], 422);
    }
    $shipping = (array) $shippingOptions[$shippingKey];
    $shippingFee = om_money((float) ($shipping['price'] ?? 0));
    $subtotal = om_money($subtotal);
    $total = om_money($subtotal - $discount + $shippingFee);

    $promotions = om_discount_evaluate(array_map(static fn($line) => [
        'productId' => $line['productId'], 'quantity' => $line['quantity'], 'amountCents' => om_cents($line['lineTotal'])
    ], $lineItems), om_cents($shippingFee), om_read('cms_rules', []), om_cms_discount_context($input));
    // Legacy codes retain their existing scope. New combinations compete on total
    // monetary benefit; old codes never silently stack with new rules.
    $appliedRuleIds = []; $discountAllocations = []; $shippingDiscount = 0.0;
    if ($promotions['discountCents'] + $promotions['shippingDiscountCents'] > om_cents($discount)) {
        $discount = $promotions['discountCents'] / 100;
        $shippingDiscount = $promotions['shippingDiscountCents'] / 100;
        $shippingFee = om_money($shippingFee - $shippingDiscount);
        $total = $promotions['totalCents'] / 100;
        $appliedRuleIds = $promotions['applied'];
        $discountAllocations = $promotions['allocations'];
        foreach ($lineItems as $i => &$line) $line['discountCents'] = $promotions['lineDiscountCents'][$i];
        unset($line);
        $campaign = null;
    }

    return [
        'items' => $lineItems,
        'subtotal' => $subtotal,
        'discount' => $discount,
        'discountCode' => $campaign ? (string) ($campaign['code'] ?? '') : ($appliedRuleIds ? $discountCode : ''),
        'campaign' => $campaign,
        'appliedRuleIds' => $appliedRuleIds,
        'discountAllocations' => $discountAllocations,
        'discountReasons' => $promotions['reasons'],
        'shippingDiscount' => $shippingDiscount,
        'shippingKey' => $shippingKey,
        'shipping' => om_clean($shipping['label'] ?? $shippingKey, 180),
        'shippingFee' => $shippingFee,
        'total' => $total,
        'currency' => (string) ($seed['currency'] ?? 'EUR'),
        // Captures the reviewed prices and promotion allocation, not browser totals.
        'fingerprint' => hash('sha256', json_encode([$lineItems, $subtotal, $discount, $shippingKey, $shippingFee, $total, $appliedRuleIds, $discountAllocations], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
        'requestedByProduct' => $requestedByProduct,
    ];
}

function om_adjust_inventory(array $quantities, int $direction): array
{
    $products = om_all_products();
    foreach ($products as $index => $product) {
        $id = (string) ($product['id'] ?? '');
        if (!isset($quantities[$id])) continue;
        $current = max(0, (int) ($product['stock'] ?? 0));
        $change = max(0, (int) $quantities[$id]);
        if ($direction < 0 && $change > $current) {
            om_json(['ok' => false, 'error' => 'insufficient_stock', 'productId' => $id, 'available' => $current], 409);
        }
        $products[$index]['stock'] = max(0, $current + ($direction * $change));
        om_cms_record_stock($id, $current, $products[$index]['stock'], $direction < 0 ? 'order_reservation' : 'reservation_released');
        $products[$index]['updatedAt'] = gmdate('c');
    }
    om_write('products', $products);
    return $products;
}

function om_send_transactional_email(string $to, string $subject, string $body): bool
{
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || !function_exists('mail')) {
        return false;
    }
    $host = preg_replace('/[^a-z0-9.-]/i', '', (string) ($_SERVER['HTTP_HOST'] ?? 'optikamiftari.com')) ?: 'optikamiftari.com';
    $configuredFrom = trim((string) getenv('OPTIKA_FROM_EMAIL'));
    $from = filter_var($configuredFrom, FILTER_VALIDATE_EMAIL) ? $configuredFrom : 'no-reply@' . $host;
    $safeSubject = str_replace(["\r", "\n"], '', $subject);
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: Optika Miftari <' . $from . '>',
        'Reply-To: ' . (filter_var(OM_DEFAULT_ADMIN_EMAIL, FILTER_VALIDATE_EMAIL) ? OM_DEFAULT_ADMIN_EMAIL : $from),
        'X-Mailer: Optika-Miftari-Commerce/' . OM_API_VERSION,
    ];
    return @mail($to, $safeSubject, $body, implode("\r\n", $headers));
}

function om_order_email_body(array $order, bool $staff = false): string
{
    $lines = [
        $staff ? 'Porosi e re nga faqja' : 'Faleminderit. Kërkesa juaj u regjistrua.',
        '',
        'Porosia: ' . (string) ($order['id'] ?? ''),
        'Klienti: ' . (string) ($order['customer'] ?? ''),
        'Produktet: ' . (string) ($order['product'] ?? ''),
        'Totali i verifikuar: ' . number_format((float) ($order['total'] ?? 0), 2, '.', '') . ' ' . (string) ($order['currency'] ?? 'EUR'),
        'Dërgesa: ' . (string) ($order['shipping'] ?? ''),
        'Statusi: ' . (string) ($order['status'] ?? 'Pending'),
        '',
        $staff
            ? 'Hapni portalin e stafit për verifikimin e recetës, pagesës dhe stokut.'
            : 'Optika Miftari do t’ju kontaktojë për verifikimin e recetës, çmimit final dhe mënyrës së pagesës para punës laboratorike.',
    ];
    return implode("\n", $lines);
}

function om_order_status_email_body(array $order): string
{
    return implode("\n", [
        'Përditësim për porosinë ' . (string) ($order['id'] ?? ''),
        '',
        'Statusi i porosisë: ' . (string) ($order['status'] ?? 'Pending'),
        'Pagesa: ' . (string) ($order['paymentStatus'] ?? 'Awaiting confirmation'),
        'Dorëzimi: ' . (string) ($order['fulfillmentStatus'] ?? 'Unfulfilled'),
        !empty($order['trackingNumber']) ? 'Gjurmimi: ' . (string) $order['trackingNumber'] : '',
        !empty($order['paymentLink']) ? 'Pagesa e sigurt: ' . (string) $order['paymentLink'] : '',
        '',
        'Mund ta kontrolloni statusin në faqen /order-status duke përdorur numrin e porosisë dhe kontaktin tuaj.',
        'Për ndihmë, kontaktoni Optika Miftari.',
    ]);
}

function om_release_expired_reservations(bool $alreadyLocked = false): int
{
    $lock = $alreadyLocked ? null : om_acquire_commerce_lock();
    $orders = om_read('orders', []);
    if (!$orders) {
        om_release_commerce_lock($lock);
        return 0;
    }
    $now = time();
    $release = [];
    $count = 0;
    foreach ($orders as $index => $order) {
        if ((string) ($order['inventoryState'] ?? '') !== 'Reserved') continue;
        if (!in_array((string) ($order['status'] ?? ''), ['Pending'], true)) continue;
        $expires = strtotime((string) ($order['reservedUntil'] ?? '')) ?: 0;
        if ($expires <= 0 || $expires > $now) continue;
        foreach ((array) ($order['items'] ?? []) as $line) {
            if (!is_array($line) || empty($line['productId'])) continue;
            $productId = (string) $line['productId'];
            $release[$productId] = ($release[$productId] ?? 0) + max(1, (int) ($line['quantity'] ?? 1));
        }
        $orders[$index]['status'] = 'Cancelled';
        $orders[$index]['inventoryState'] = 'Released';
        $orders[$index]['fulfillmentStatus'] = 'Cancelled';
        $orders[$index]['staffNote'] = trim((string) ($order['staffNote'] ?? '') . "\nStock reservation expired automatically.");
        $orders[$index]['updatedAt'] = gmdate('c');
        om_apply_customer_value(
            (string) ($order['email'] ?? ''),
            (string) ($order['phone'] ?? ''),
            -1 * (float) ($order['total'] ?? 0),
            0
        );
        $count++;
    }
    if ($count > 0) {
        if ($release) om_adjust_inventory($release, 1);
        om_write('orders', $orders);
        om_audit('expired_reservations_released', 'orders', (string) $count);
    }
    om_release_commerce_lock($lock);
    return $count;
}

function om_apply_customer_value(string $email, string $phone, float $requestDelta, float $spendDelta): void
{
    $customers = om_read('customers', []);
    $normalizedEmail = strtolower(trim($email));
    $normalizedPhone = preg_replace('/\s+/', '', $phone);
    foreach ($customers as $index => $customer) {
        $sameEmail = $normalizedEmail !== '' && strtolower((string) ($customer['email'] ?? '')) === $normalizedEmail;
        $samePhone = $normalizedPhone !== '' && preg_replace('/\s+/', '', (string) ($customer['phone'] ?? '')) === $normalizedPhone;
        if (!$sameEmail && !$samePhone) continue;
        $customers[$index]['requestValue'] = om_money(max(0, (float) ($customer['requestValue'] ?? 0) + $requestDelta));
        $customers[$index]['spend'] = om_money(max(0, (float) ($customer['spend'] ?? 0) + $spendDelta));
        $customers[$index]['updatedAt'] = gmdate('c');
        om_write('customers', $customers);
        return;
    }
}

function om_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    session_name('optika_ops');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function om_input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return $_POST;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $_POST;
}

function om_clean($value, int $max = 500): string
{
    $value = is_scalar($value) ? (string) $value : '';
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $value) ?? '';
    $value = trim(strip_tags($value));
    return function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

function om_id(string $prefix): string
{
    return $prefix . '-' . strtoupper(substr(bin2hex(random_bytes(8)), 0, 10));
}

function om_read(string $name, array $fallback = []): array
{
    om_boot_storage();
    $path = om_storage_dir() . '/' . preg_replace('/[^a-z0-9_-]/i', '', $name) . '.json';
    if (!is_file($path)) {
        return $fallback;
    }
    $handle = fopen($path, 'rb');
    if (!$handle) {
        return $fallback;
    }
    flock($handle, LOCK_SH);
    $raw = stream_get_contents($handle) ?: '';
    flock($handle, LOCK_UN);
    fclose($handle);
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function om_write(string $name, array $data): void
{
    om_boot_storage();
    $safe = preg_replace('/[^a-z0-9_-]/i', '', $name);
    $path = om_storage_dir() . '/' . $safe . '.json';
    $tmp = om_storage_dir() . '/.' . $safe . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        om_json(['ok' => false, 'error' => 'storage_write_failed'], 500);
    }
    @chmod($tmp, 0640);
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        om_json(['ok' => false, 'error' => 'storage_commit_failed'], 500);
    }
}

function om_acquire_commerce_lock()
{
    $path = om_storage_dir() . '/commerce.lock';
    $handle = fopen($path, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) fclose($handle);
        om_json(['ok' => false, 'error' => 'commerce_busy'], 503);
    }
    return $handle;
}

function om_release_commerce_lock($handle): void
{
    if (!is_resource($handle)) return;
    flock($handle, LOCK_UN);
    fclose($handle);
}

function om_credentials(): array
{
    // Deployments must provision their own private credentials record. Missing
    // configuration must not activate a shared, built-in administrator login.
    return array_merge([
        'email' => OM_DEFAULT_ADMIN_EMAIL,
        'salt' => '',
        'hash' => '',
        'iterations' => OM_PASSWORD_ITERATIONS,
        'updatedAt' => null,
    ], om_read('credentials', []));
}

function om_credentials_ready(array $credentials): bool
{
    $iterations = $credentials['iterations'] ?? null;
    return is_string($credentials['email'] ?? null)
        && filter_var($credentials['email'], FILTER_VALIDATE_EMAIL) !== false
        && is_string($credentials['salt'] ?? null) && $credentials['salt'] !== ''
        && is_string($credentials['hash'] ?? null) && preg_match('/^[a-f0-9]{64}$/i', $credentials['hash']) === 1
        && (is_int($iterations) || (is_string($iterations) && ctype_digit($iterations)))
        && (int) $iterations > 0;
}

function om_password_hash(string $password, string $salt, int $iterations): string
{
    return hash_pbkdf2('sha256', $password, $salt, $iterations, 64, false);
}

function om_password_change_required(): bool
{
    if (!empty($_SESSION['staff_id'])) return false;
    $credentials = om_credentials();
    return empty($credentials['updatedAt']);
}

function om_client_ip(): string
{
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : 'unknown';
}

function om_rate_limit(string $bucket, int $limit, int $windowSeconds): void
{
    $bucket = preg_replace('/[^a-z0-9_-]/i', '', $bucket) ?: 'public';
    $store = 'rate_limits_' . $bucket;
    $rates = om_read($store, []);
    $now = time();
    $cutoff = $now - max(1, $windowSeconds);

    foreach ($rates as $storedKey => $timestamps) {
        $recent = array_values(array_filter(
            is_array($timestamps) ? $timestamps : [],
            static fn($timestamp) => (int) $timestamp > $cutoff
        ));
        if ($recent) {
            $rates[$storedKey] = $recent;
        } else {
            unset($rates[$storedKey]);
        }
    }

    $key = hash('sha256', om_client_ip());
    $history = $rates[$key] ?? [];
    if (count($history) >= $limit) {
        $retryAfter = max(1, $windowSeconds - ($now - (int) $history[0]));
        om_json(['ok' => false, 'error' => 'rate_limit_exceeded', 'retryAfter' => $retryAfter], 429);
    }
    $history[] = $now;
    $rates[$key] = $history;
    if (count($rates) > 5000) {
        $rates = array_slice($rates, -5000, null, true);
    }
    om_write($store, $rates);
}

function om_is_authenticated(): bool
{
    om_session_start();
    return !empty($_SESSION['optika_admin']) && !empty($_SESSION['last_seen'])
        && (time() - (int) $_SESSION['last_seen']) < 28800
        && (empty($_SESSION['staff_id']) || om_staff_member() !== null);
}

function om_require_auth(): void
{
    if (!om_is_authenticated()) {
        om_json(['ok' => false, 'error' => 'authentication_required'], 401);
    }
    $_SESSION['last_seen'] = time();
}

function om_csrf_token(): string
{
    om_session_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return (string) $_SESSION['csrf'];
}

function om_require_csrf(): void
{
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($provided === '' || !hash_equals(om_csrf_token(), $provided)) {
        om_json(['ok' => false, 'error' => 'invalid_csrf_token'], 403);
    }
}

function om_customer_accounts(): array
{
    $seedPath = __DIR__ . '/storage/customer-account-seed.json';
    $seed = is_file($seedPath) ? json_decode((string) file_get_contents($seedPath), true) : [];
    return om_read('customer_accounts', is_array($seed) ? $seed : []);
}

function om_customer_public_profile(array $account): array
{
    return [
        'id' => (string) ($account['id'] ?? ''),
        'email' => (string) ($account['email'] ?? ''),
        'firstName' => (string) ($account['firstName'] ?? ''),
        'lastName' => (string) ($account['lastName'] ?? ''),
        'phone' => (string) ($account['phone'] ?? ''),
        'address' => (string) ($account['address'] ?? ''),
        'city' => (string) ($account['city'] ?? ''),
        'postcode' => (string) ($account['postcode'] ?? ''),
        'country' => (string) ($account['country'] ?? 'Kosovë'),
        'contactPreference' => (string) ($account['contactPreference'] ?? 'WhatsApp'),
        'status' => (string) ($account['status'] ?? 'Active'),
        'marketingConsent' => !empty($account['marketingConsent']),
        'mustChangePassword' => !empty($account['mustChangePassword']),
        'createdAt' => (string) ($account['createdAt'] ?? ''),
        'updatedAt' => (string) ($account['updatedAt'] ?? ''),
    ];
}

function om_customer_account_by_id(string $id): ?array
{
    foreach (om_customer_accounts() as $account) {
        if (is_array($account) && $id !== '' && hash_equals((string) ($account['id'] ?? ''), $id)) {
            return $account;
        }
    }
    return null;
}

function om_customer_account_by_email(string $email): ?array
{
    $normalized = strtolower(trim($email));
    foreach (om_customer_accounts() as $account) {
        if (is_array($account) && $normalized !== '' && hash_equals(strtolower((string) ($account['email'] ?? '')), $normalized)) {
            return $account;
        }
    }
    return null;
}

function om_customer_password_valid(string $password): bool
{
    return strlen($password) >= 12
        && strlen($password) <= 200
        && preg_match('/[a-z]/', $password) === 1
        && preg_match('/[A-Z]/', $password) === 1
        && preg_match('/[0-9]/', $password) === 1
        && preg_match('/[^a-zA-Z0-9]/', $password) === 1;
}

function om_is_customer_authenticated(): bool
{
    om_session_start();
    $id = (string) ($_SESSION['customer_id'] ?? '');
    $lastSeen = (int) ($_SESSION['customer_last_seen'] ?? 0);
    if (empty($_SESSION['customer_authenticated']) || $id === '' || $lastSeen <= 0 || (time() - $lastSeen) >= 28800) {
        return false;
    }
    $account = om_customer_account_by_id($id);
    return is_array($account) && (string) ($account['status'] ?? 'Active') === 'Active';
}

function om_require_customer_auth(): array
{
    if (!om_is_customer_authenticated()) {
        om_json(['ok' => false, 'error' => 'authentication_required'], 401);
    }
    $_SESSION['customer_last_seen'] = time();
    $account = om_customer_account_by_id((string) $_SESSION['customer_id']);
    if (!is_array($account)) {
        om_json(['ok' => false, 'error' => 'authentication_required'], 401);
    }
    return $account;
}

function om_current_customer_id(): string
{
    return om_is_customer_authenticated() ? (string) ($_SESSION['customer_id'] ?? '') : '';
}

// Keep internal CRM notes, assignments and prescription-upload tokens behind
// the staff boundary, even when a customer owns the associated order.
function om_customer_order_view(array $order): array
{
    $allowed = ['id', 'accountId', 'customer', 'email', 'phone', 'product', 'subtotal', 'discount', 'discountCode', 'shippingFee', 'total', 'currency', 'priceStatus', 'status', 'paymentStatus', 'fulfillmentStatus', 'prescription', 'shippingKey', 'shipping', 'deliveryAddress', 'contactPreference', 'customerNote', 'payment', 'trackingNumber', 'paymentLink', 'date', 'createdAt', 'updatedAt'];
    $view = array_intersect_key($order, array_flip($allowed));
    $view['items'] = array_map(static function ($item): array {
        if (!is_array($item)) return [];
        $safe = array_intersect_key($item, array_flip(['productId', 'sku', 'name', 'quantity', 'unitPrice', 'lineTotal']));
        $safe['configuration'] = array_intersect_key((array) ($item['configuration'] ?? []), array_flip(['purchaseMode', 'lensPackage', 'coating', 'rxMode', 'frameVariant', 'lensTint', 'sunTreatment', 'lifestyle']));
        return $safe;
    }, (array) ($order['items'] ?? []));
    return $view;
}

function om_customer_appointment_view(array $appointment): array
{
    return array_intersect_key($appointment, array_flip(['id', 'type', 'service', 'preferredDate', 'preferredTime', 'confirmedDate', 'confirmedTime', 'status', 'createdAt', 'updatedAt']));
}

function om_customer_csrf_token(): string
{
    om_session_start();
    if (empty($_SESSION['customer_csrf'])) {
        $_SESSION['customer_csrf'] = bin2hex(random_bytes(24));
    }
    return (string) $_SESSION['customer_csrf'];
}

function om_require_customer_csrf(): void
{
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($provided === '' || !hash_equals(om_customer_csrf_token(), $provided)) {
        om_json(['ok' => false, 'error' => 'invalid_csrf_token'], 403);
    }
}

function om_same_origin(): bool
{
    $host = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $key) {
        $source = (string) ($_SERVER[$key] ?? '');
        if ($source === '') {
            continue;
        }
        $sourceHost = strtolower((string) parse_url($source, PHP_URL_HOST));
        if ($sourceHost !== '' && $sourceHost !== $host) {
            return false;
        }
    }
    return true;
}

function om_audit(string $action, string $entity = '', string $entityId = ''): void
{
    $audit = om_read('audit', []);
    array_unshift($audit, [
        'id' => om_id('LOG'),
        'time' => gmdate('c'),
        'action' => om_clean($action, 100),
        'entity' => om_clean($entity, 80),
        'entityId' => om_clean($entityId, 100),
        'user' => (string) ($_SESSION['admin_email'] ?? $_SESSION['customer_email'] ?? 'public'),
    ]);
    om_write('audit', array_slice($audit, 0, 500));
}

function om_analytics_summary(): array
{
    $events = om_read('events', []);
    $dayAgo = time() - 86400;
    $weekAgo = time() - 604800;
    $events24 = array_values(array_filter($events, static fn($e) => strtotime((string) ($e['time'] ?? '')) >= $dayAgo));
    $events7 = array_values(array_filter($events, static fn($e) => strtotime((string) ($e['time'] ?? '')) >= $weekAgo));
    $countBy = static function (array $items, string $key): array {
        $out = [];
        foreach ($items as $item) {
            $value = om_clean($item[$key] ?? 'Unknown', 120) ?: 'Unknown';
            $out[$value] = ($out[$value] ?? 0) + 1;
        }
        arsort($out);
        return array_slice($out, 0, 8, true);
    };
    return [
        'events24h' => count($events24),
        'events7d' => count($events7),
        'pageviews24h' => count(array_filter($events24, static fn($e) => ($e['event'] ?? '') === 'page_view')),
        'actions24h' => count(array_filter($events24, static fn($e) => ($e['event'] ?? '') !== 'page_view')),
        'topPages' => $countBy($events7, 'path'),
        'topEvents' => $countBy($events7, 'event'),
        'latest' => array_slice($events, 0, 30),
    ];
}

function om_public_content(): array
{
    $defaults = [
        'heroTitle' => 'Shihni mirë. Jini vetvetja.',
        'heroSubtitle' => 'Korniza që ju shkojnë. Lente të punuara për ju, në laboratorin tonë.',
        'primaryCta' => 'Shiko kornizat',
        'secondaryCta' => 'Rezervo ekzaminimin',
        'announcement' => 'Dy lokacione · 30 vjet përvojë · Punim me recetë',
        'shopTitle' => 'Të gjitha kornizat.',
        'shopSubtitle' => 'Korniza optike dhe syze dielli. Zgjidhni online; për lentet dhe punimin kujdeset laboratori ynë.',
        'examinationTitle' => 'Së pari, si shihni ju?',
        'examinationSubtitle' => 'Matim shikimin dhe kuptojmë punën, ekranin, leximin e vozitjen, që receta dhe lentet të funksionojnë në jetën e përditshme.',
        'prescriptionTitle' => 'Syze me dioptri.',
        'prescriptionSubtitle' => 'Zgjidhni kornizën; pastaj përcaktojmë lentet sipas recetës, ekranit, leximit, vozitjes dhe matjeve tuaja.',
        'sunglassesTitle' => 'Syze dielli.',
        'sunglassesSubtitle' => 'Zgjidhni formën dhe filtrin, provojeni modelin virtualisht dhe kërkoni lente dielli me dioptri kur korniza e lejon.',
        'aboutTitle' => 'Familjarë në kujdes. Të përkushtuar ndaj shikimit.',
        'aboutSubtitle' => '30 vjet përvojë, dy lokacione dhe një laborator privat. Një shtëpi optike ku këshillimi dhe punimi bëhen bashkë.',
        'contactTitle' => 'Le të flasim për shikimin tuaj.',
        'contactSubtitle' => 'Zgjidhni arsyen e vizitës, ditën dhe orën e preferuar. Ekipi e kontrollon kërkesën dhe ju dërgon konfirmimin personalisht.',
        'homeSeoTitle' => 'Optika Miftari | Ekzaminim, lente dhe korniza në Kosovë',
        'homeSeoDescription' => 'Shtëpi optike familjare me 30 vjet përvojë: ekzaminime profesionale, lente me recetë, korniza dhe përshtatje në dy lokacione.',
        'shopSeoTitle' => 'Korniza dhe syze online | Optika Miftari',
        'shopSeoDescription' => 'Shfletoni korniza për syze me dioptri dhe syze dielli. Çdo porosi verifikohet për stokun, recetën dhe përshtatjen nga optiku.',
        'examinationSeoTitle' => 'Ekzaminimi profesional i syrit | Optika Miftari',
        'examinationSeoDescription' => 'Rezervoni ekzaminimin e shikimit dhe merrni udhëzim profesional për recetën, lentet dhe nevojat tuaja të përditshme.',
        'prescriptionSeoTitle' => 'Syze me dioptri dhe lente me recetë | Optika Miftari',
        'prescriptionSeoDescription' => 'Zgjidhni kornizën dhe konfiguroni lentet sipas recetës, rutinës dhe matjeve të verifikuara nga optiku.',
        'sunglassesSeoTitle' => 'Syze dielli dhe lente dielli me dioptri | Optika Miftari',
        'sunglassesSeoDescription' => 'Syze dielli UV400 dhe të polarizuara, modele të gatshme për recetë dhe provë virtuale 3D.',
        'aboutSeoTitle' => 'Rreth Optika Miftari | 30 vjet kujdes familjar',
        'aboutSeoDescription' => 'Njihuni me historinë familjare, laboratorin optik dhe standardin e kujdesit të Optika Miftari në Kosovë.',
        'contactSeoTitle' => 'Kontakti dhe rezervimi | Optika Miftari',
        'contactSeoDescription' => 'Rezervoni ekzaminim, këshillim për lente ose përshtatje kornize në një nga dy lokacionet e Optika Miftari.',
        'updatedAt' => null,
    ];
    $content = array_merge($defaults, require __DIR__ . '/holding-content.php', om_read('content', []));
    // Client corrected the business history to 30 years. Normalize legacy wording
    // on read, without rewriting the saved CMS record or changing unrelated copy.
    foreach ($content as $key => $value) {
        if (is_string($value) && !str_ends_with($key, 'Image')) {
            $content[$key] = str_replace(
                ['Mbi 20 vjet', 'mbi 20 vjet', 'Më shumë se 20 vjet', 'më shumë se 20 vjet', '20+ vjet', '20+ VJET'],
                ['30 vjet', '30 vjet', '30 vjet', '30 vjet', '30 vjet', '30 VJET'],
                $value
            );
        }
    }
    return $content;
}
