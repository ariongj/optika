<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}
if (!om_same_origin()) {
    om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
}

om_rate_limit('order_status', 20, 3600);
om_release_expired_reservations();
$input = om_input();
$orderId = strtoupper(om_clean($input['orderId'] ?? '', 100));
$contact = strtolower(om_clean($input['contact'] ?? '', 180));
if ($orderId === '' || $contact === '') {
    om_json(['ok' => false, 'error' => 'order_and_contact_required'], 422);
}

foreach (om_read('orders', []) as $order) {
    if (strtoupper((string) ($order['id'] ?? '')) !== $orderId) continue;
    $email = strtolower((string) ($order['email'] ?? ''));
    $phone = strtolower(preg_replace('/\s+/', '', (string) ($order['phone'] ?? '')));
    $normalizedContact = strtolower(preg_replace('/\s+/', '', $contact));
    if (!hash_equals($email, $contact) && !hash_equals($phone, $normalizedContact)) {
        break;
    }
    om_json([
        'ok' => true,
        'order' => [
            'id' => (string) ($order['id'] ?? ''),
            'date' => (string) ($order['date'] ?? ''),
            'items' => om_customer_order_view($order)['items'],
            'product' => (string) ($order['product'] ?? ''),
            'total' => (float) ($order['total'] ?? 0),
            'currency' => (string) ($order['currency'] ?? 'EUR'),
            'status' => (string) ($order['status'] ?? 'Pending'),
            'paymentStatus' => (string) ($order['paymentStatus'] ?? 'Awaiting confirmation'),
            'fulfillmentStatus' => (string) ($order['fulfillmentStatus'] ?? 'Unfulfilled'),
            'shipping' => (string) ($order['shipping'] ?? ''),
            'trackingNumber' => (string) ($order['trackingNumber'] ?? ''),
            'paymentLink' => (string) ($order['paymentLink'] ?? ''),
            'updatedAt' => (string) ($order['updatedAt'] ?? $order['createdAt'] ?? ''),
        ],
    ]);
}

// Do not disclose whether the order number or contact value was incorrect.
om_json(['ok' => false, 'error' => 'order_not_found'], 404);
