<?php
// Miftari Vision API — what visitors send: orders (re-priced here, stock checked), bookings, requests, order tracking,
// discount-code lookups. Everything is checked; nothing the browser says about prices is trusted.
declare(strict_types=1);

const MV_UNTRACKED = 999;

/** L10n text in a language, with the app's fallbacks (lt() in src/i18n). */
function mv_lt($v, string $lang): string
{
    if (!is_array($v)) return is_string($v) ? $v : '';
    foreach ([$lang, 'sq', 'sq', 'en', 'me'] as $k) {
        $s = $v[$k] ?? '';
        if (is_string($s) && trim($s) !== '') return $s;
    }
    return is_string($v['me'] ?? null) ? $v['me'] : '';
}

/** JavaScript's Math.round(n * 100) / 100. */
function mv_round2(float $n): float
{
    return floor($n * 100 + 0.5) / 100;
}

/** Most a shopper may order (maxOrderQty in src/lib/inventory.ts). */
function mv_max_qty(array $p): int
{
    $stock = (int) ($p['stock'] ?? 0);
    if (!($stock > 0 && $stock < MV_UNTRACKED)) return MV_UNTRACKED;
    $area = ($p['unit'] ?? '') === 'm2' && !empty($p['packSize']);
    return max(1, $area ? ((int) floor($stock / (float) $p['packSize']) ?: 1) : $stock);
}

function mv_settings(): array
{
    $s = mv_single('settings');
    if (!is_array($s)) mv_fail(503, 'not_ready');
    return $s;
}

/** "W" + 5 characters without look-alikes, as the app numbers web orders; unique among stored orders. */
function mv_web_order_number(string $prefix): string
{
    $abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    do {
        $code = 'W';
        $b = random_bytes(5);
        for ($i = 0; $i < 5; $i++) $code .= $abc[ord($b[$i]) % strlen($abc)];
        $num = $prefix . $code;
    } while (mv_order_number_taken($num));
    return $num;
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

function mv_clean_customer(array $c, array $settings, string $delivery): array
{
    $co = is_array($settings['checkout'] ?? null) ? $settings['checkout'] : ['phoneRequired' => true, 'companyField' => 'optional'];
    $out = [
        'firstName' => mv_str($c['firstName'] ?? '', 60),
        'lastName' => mv_str($c['lastName'] ?? '', 60),
        'email' => mb_strtolower(mv_str($c['email'] ?? '', 190)),
        'phone' => mv_str($c['phone'] ?? '', 40),
        'city' => mv_str($c['city'] ?? '', 80),
        'address' => mv_str($c['address'] ?? '', 200),
    ];
    if ($out['firstName'] === '' || $out['lastName'] === '') mv_fail(422, 'name_required');
    if (!mv_email_ok($out['email'])) mv_fail(422, 'email_invalid');
    $phoneNeeded = ($co['phoneRequired'] ?? true) !== false;
    if (($phoneNeeded || $out['phone'] !== '') && strlen(preg_replace('/\D/', '', $out['phone']) ?? '') < 6) mv_fail(422, 'phone_invalid');
    if ($delivery !== 'pickup' && ($out['city'] === '' || $out['address'] === '')) mv_fail(422, 'address_required');
    $company = mv_str($c['company'] ?? '', 120);
    if (($co['companyField'] ?? 'optional') === 'required' && $company === '') mv_fail(422, 'company_required');
    if ($company !== '' && ($co['companyField'] ?? 'optional') !== 'hidden') {
        $out['company'] = $company;
        $pib = mv_str($c['pib'] ?? '', 40);
        if ($pib !== '') $out['pib'] = $pib;
    }
    $note = mv_str($c['note'] ?? '', 1500);
    if ($note !== '') $out['note'] = $note;
    if (!empty($c['marketing']) && !empty($co['marketingOptIn'])) $out['marketing'] = true;
    return $out;
}

/** The bag as sent, checked against the catalogue (options must exist, quantities within limits). */
function mv_clean_items($items, array $byId): array
{
    if (!is_array($items) || !$items || count($items) > 40) mv_fail(422, 'items_invalid');
    $out = [];
    foreach (array_values($items) as $it) {
        if (!is_array($it)) mv_fail(422, 'items_invalid');
        $pid = mv_str($it['productId'] ?? '', 80);
        $p = $byId[$pid] ?? null;
        if (!$p || ($p['status'] ?? '') !== 'active') mv_fail(409, 'product_unavailable', ['productId' => $pid]);
        if (!empty($p['quoteOnly']) || ($p['template'] ?? '') === 'quote') mv_fail(409, 'product_unavailable', ['productId' => $pid]);
        $qty = $it['qty'] ?? 0;
        if (!is_int($qty) || $qty < 1 || $qty > MV_UNTRACKED) mv_fail(422, 'qty_invalid', ['productId' => $pid]);
        $opts = [];
        foreach ((array) ($it['options'] ?? []) as $k => $v) {
            if (!is_string($k) || !is_string($v) || strlen($k) > 80 || strlen($v) > 200) mv_fail(422, 'options_invalid', ['productId' => $pid]);
            $opts[$k] = $v;
        }
        $out[] = ['key' => mv_str($it['key'] ?? $pid, 120) ?: $pid, 'productId' => $pid, 'qty' => $qty, 'options' => (object) $opts, 'installation' => !empty($it['installation'])];
    }
    return $out;
}

/**
 * POST order — {input: {customer, items, delivery, payment, codes, couponCode, lang}, total}
 * The order is priced here with the same rules as the shop page; if the visitor's page showed a different total
 * (prices or discounts changed meanwhile) nothing is saved and the page refreshes its prices.
 */
function mv_route_order(): never
{
    mv_same_origin();
    // refused attempts count too (a changed total costs two), and an office or a mobile carrier shares one address
    mv_rate('order', 30, 3600);
    $b = mv_body();
    if (mv_str($b['website'] ?? '', 50) !== '') mv_fail(422, 'invalid');
    $in = is_array($b['input'] ?? null) ? $b['input'] : mv_fail(422, 'invalid');
    $settings = mv_settings();
    $delivery = ($in['delivery'] ?? '') === 'pickup' ? 'pickup' : 'delivery';
    if ($delivery === 'pickup') {
        $pickup = false;
        foreach ((array) ($settings['locations'] ?? []) as $loc) if (!empty($loc['pickup'])) $pickup = true;
        if (!$pickup) mv_fail(422, 'pickup_unavailable');
    }
    $payment = (string) ($in['payment'] ?? '');
    if (!in_array($payment, ['cod', 'bank'], true) || empty($settings['payments'][$payment])) mv_fail(422, 'payment_unavailable');
    $lang = mv_lang($in['lang'] ?? 'sq');
    $customer = mv_clean_customer(is_array($in['customer'] ?? null) ? $in['customer'] : [], $settings, $delivery);
    $codes = [];
    foreach (array_slice(array_merge([$in['couponCode'] ?? null], (array) ($in['codes'] ?? [])), 0, 6) as $c) {
        $c = mv_str($c, 40);
        if ($c !== '') $codes[] = $c;
    }

    // The page sends one random reference per checkout. If its answer was lost on the way back (connection dropped
    // after the order was saved) the shopper presses the button again: the same reference returns the same order
    // instead of placing a second one.
    $ref = mv_str($b['ref'] ?? '', 64);
    if (!preg_match('/^[A-Za-z0-9_-]{16,64}$/', $ref)) $ref = '';

    $result = mv_tx(function () use ($b, $in, $settings, $delivery, $payment, $lang, $customer, $codes, $ref) {
        if ($ref !== '') {
            foreach (mv_docs('orders') as $o) {
                if (($o['clientRef'] ?? '') === $ref) return ['order' => $o, 'stock' => [], 'repeat' => true];
            }
        }
        $products = mv_docs('products');
        $byId = [];
        foreach ($products as $p) $byId[(string) $p['id']] = $p;
        $items = mv_clean_items($in['items'] ?? null, $byId);
        $discounts = mv_docs('discounts');
        $collections = mv_docs('collections');
        $now = mv_ms();
        $plain = fn($v) => json_decode(mv_json($v), true);
        $totals = mvp_price_cart($plain($items), $plain($products), $plain($settings), [
            'lang' => $lang, 'codes' => $codes, 'couponCode' => null, 'discounts' => $plain($discounts), 'collections' => $plain($collections),
            'delivery' => $delivery, 'city' => $customer['city'], 'now' => $now,
        ]);
        if (count($totals['lines']) !== count($items)) mv_fail(409, 'product_unavailable');
        // stock first: the bag never asks for more than is on hand (made-to-order items are not limited), and
        // "someone bought the last one" is the more useful answer than a total that no longer matches
        $want = [];
        foreach ($items as $it) $want[$it['productId']] = ($want[$it['productId']] ?? 0) + $it['qty'];
        foreach ($want as $pid => $qty) {
            if ($qty > mv_max_qty($byId[$pid])) mv_fail(409, 'stock', ['productId' => $pid, 'available' => mv_max_qty($byId[$pid])]);
        }
        $client = $b['total'] ?? null;
        if (!is_int($client) && !is_float($client)) mv_fail(422, 'total_missing');
        if (abs((float) $client - (float) $totals['total']) > 0.005) mv_fail(409, 'price_changed', ['total' => $totals['total']]);

        // a code meant once per customer
        $phone8 = mv_phone8($customer['phone']);
        $byDiscount = [];
        foreach ($discounts as $d) $byDiscount[(string) $d['id']] = $d;
        $once = [];
        foreach ($totals['applied'] as $a) if (!empty($byDiscount[$a['id']]['oncePerCustomer'])) $once[(string) $a['id']] = (string) ($a['code'] ?? $a['id']);
        if ($once) {
            foreach (mv_docs('orders') as $o) {
                if (($o['status'] ?? '') === 'cancelled') continue;
                $same = mb_strtolower((string) ($o['customer']['email'] ?? '')) === $customer['email'] || ($phone8 !== '' && mv_phone8((string) ($o['customer']['phone'] ?? '')) === $phone8);
                if (!$same) continue;
                foreach ((array) ($o['discounts'] ?? []) as $used) if (isset($once[$used['id'] ?? ''])) mv_fail(409, 'discount_used', ['code' => $once[$used['id']]]);
            }
        }
        return mv_build_web_order($settings, $totals, $items, $byId, $customer, $delivery, $payment, $lang, $now, $byDiscount, $ref);
    });

    $order = $result['order'];
    unset($order['clientRef']);
    if (!empty($result['repeat'])) mv_out(['ok' => true, 'order' => $order, 'stock' => [], 'repeat' => true]);
    if (!empty($customer['marketing'])) {
        mv_consent_record([
            'subject' => mv_subject_key($customer['email'], $customer['phone']), 'email' => $customer['email'], 'phone' => $customer['phone'],
            'channel' => 'email', 'action' => 'subscribe', 'source' => 'checkout', 'lang' => $lang, 'ref' => $order['number'],
            'wording' => mv_str($b['consentText'] ?? '', 600),
        ]);
    }
    mv_out(['ok' => true, 'order' => $order, 'stock' => $result['stock']]);
}

/** buildOrder() of src/store/db.ts for a web order: the order, stock, sold counts, movements, code uses, offer figures. */
function mv_build_web_order(array $settings, array $totals, array $items, array $byId, array $customer, string $delivery, string $payment, string $lang, int $now, array $byDiscount, string $ref = ''): array
{
    $prefix = (string) (($settings['orderPrefix'] ?? '') ?: 'SC-');
    $at = mv_iso($now);
    $lines = [];
    foreach ($totals['lines'] as $l) {
        $p = $byId[$l['productId']];
        $line = [
            'productId' => (string) $p['id'], 'sku' => (string) ($p['sku'] ?? ''), 'name' => mv_lt($p['name'] ?? null, $lang),
            'image' => (string) ($p['images'][0] ?? ''), 'unit' => (string) ($p['unit'] ?? 'kom'),
        ];
        if (isset($p['packSize'])) $line['packSize'] = $p['packSize'];
        $line += [
            'qty' => $l['item']['qty'], 'options' => (string) $l['optionsLabel'], 'unitPrice' => $l['unitPrice'],
            'installation' => !empty($l['item']['installation']) && !empty($p['installation']['available']),
            'installationPrice' => $l['installationUnitPrice'], 'lineTotal' => $l['lineTotal'], 'discount' => $l['discount'], 'allocations' => $l['allocations'],
        ];
        $lines[] = $line;
    }
    $total = mv_round2((float) $totals['total']);
    $first = null;
    foreach ($totals['applied'] as $a) if (!empty($a['code'])) {
        $first = $a;
        break;
    }
    $order = [
        'id' => mv_uid('o'),
        'number' => mv_web_order_number($prefix),
        'createdAt' => $at,
        'status' => 'new',
        'customer' => $customer,
        'items' => $lines,
        'delivery' => ['method' => $delivery, 'fee' => $totals['shipping']],
        'payment' => ['method' => $payment, 'status' => 'pending'],
        'coupon' => $first ? ['code' => $first['code'], 'discount' => $totals['discount']] : null,
        'subtotal' => mv_round2((float) $totals['subtotal']),
        'installationTotal' => $totals['installationTotal'],
        'discount' => $totals['discount'],
        'shipping' => $totals['shipping'],
        'total' => $total,
        'vat' => mv_round2($total - $total / (1 + (float) ($settings['vatRate'] ?? 0) / 100)),
        'lang' => $lang,
        'timeline' => [['at' => $at, 'status' => 'new', 'by' => 'web']],
        'seen' => false,
        'discounts' => $totals['applied'],
        'shippingBeforeDiscount' => $totals['shippingBeforeDiscount'],
    ];
    if ($ref !== '') $order['clientRef'] = $ref;
    // stock, sold counters and 'sale' movements
    $taken = [];
    $stockOut = [];
    $qtyBy = [];
    foreach ($items as $it) $qtyBy[$it['productId']] = ($qtyBy[$it['productId']] ?? 0) + $it['qty'];
    foreach ($qtyBy as $pid => $qty) {
        $p = $byId[$pid];
        $stock = (int) ($p['stock'] ?? 0);
        $tracked = $stock < MV_UNTRACKED;
        if ($tracked) {
            $t = min($qty, max(0, $stock));
            $taken[$pid] = $t;
            if ($t) mv_append('movements', [
                'id' => mv_uid('mv'), 'productId' => $pid, 'delta' => -$t, 'reason' => 'sale', 'at' => $at, 'by' => 'web', 'ref' => $order['number'],
            ], 'web', 500);
        }
        $p['sold'] = (int) ($p['sold'] ?? 0) + $qty;
        if ($tracked) $p['stock'] = max(0, $stock - $qty);
        mv_put('products', $pid, $p, 'web');
        $stockOut[] = ['id' => $pid, 'stock' => $p['stock'], 'sold' => $p['sold']];
    }
    $order['stockTaken'] = (object) $taken;
    // code uses and live offer figures
    $used = [];
    foreach ($totals['applied'] as $a) $used[(string) $a['id']] = $a;
    foreach ($used as $id => $a) {
        if (!isset($byDiscount[$id])) continue;
        $d = $byDiscount[$id];
        $d['uses'] = (int) ($d['uses'] ?? 0) + 1;
        mv_put('discounts', $id, $d, 'web');
    }
    if ($used) {
        foreach (mv_docs('offers') as $o) {
            $did = (string) ($o['discountId'] ?? '');
            if ($did === '' || !isset($used[$did]) || !is_array($o['metrics'] ?? null)) continue;
            $a = $used[$did];
            $m = $o['metrics'];
            $m['orders'] = (int) ($m['orders'] ?? 0) + 1;
            $m['codeUses'] = (int) ($m['codeUses'] ?? 0) + (!empty($a['code']) ? 1 : 0);
            $m['revenue'] = mv_round2((float) ($m['revenue'] ?? 0) + $total);
            $m['discountTotal'] = mv_round2((float) ($m['discountTotal'] ?? 0) + (float) $a['amount']);
            $o['metrics'] = $m;
            mv_put('offers', (string) $o['id'], $o, 'web');
        }
    }
    mv_put('orders', $order['id'], $order, 'web');
    return ['order' => $order, 'stock' => $stockOut];
}

/* ------------------------------------------------------------------ */
/* Requests & bookings                                                 */
/* ------------------------------------------------------------------ */

function mv_clean_inquiry(array $in): array
{
    $type = in_array($in['type'] ?? '', ['measurement', 'contact', 'quote'], true) ? $in['type'] : 'contact';
    $q = [
        'type' => $type,
        'name' => mv_str($in['name'] ?? '', 120),
        'phone' => mv_str($in['phone'] ?? '', 40),
        'message' => mv_str($in['message'] ?? '', 3000),
    ];
    if ($q['name'] === '') mv_fail(422, 'name_required');
    if (strlen(preg_replace('/\D/', '', $q['phone']) ?? '') < 6) mv_fail(422, 'phone_invalid');
    if ($q['message'] === '') $q['message'] = '—';
    $email = mb_strtolower(mv_str($in['email'] ?? '', 190));
    if ($email !== '') {
        if (!mv_email_ok($email)) mv_fail(422, 'email_invalid');
        $q['email'] = $email;
    }
    foreach (['city' => 80, 'service' => 160, 'productId' => 80, 'company' => 120] as $k => $max) {
        $v = mv_str($in[$k] ?? '', $max);
        if ($v !== '') $q[$k] = $v;
    }
    $date = mv_str($in['preferredDate'] ?? '', 10);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $q['preferredDate'] = $date;
    $tags = [];
    foreach (array_slice((array) ($in['tags'] ?? []), 0, 6) as $t) if (is_string($t) && preg_match('/^[a-z0-9-]{1,30}$/', $t)) $tags[] = $t;
    if ($tags) $q['tags'] = $tags;
    $src = $in['source'] ?? null;
    $q['source'] = in_array($src, ['web-form', 'measurement', 'quote'], true) ? $src : ($type === 'measurement' ? 'measurement' : ($type === 'quote' ? 'quote' : 'web-form'));
    return $q;
}

function mv_new_inquiry(array $q): array
{
    return ['id' => mv_uid('inq'), 'createdAt' => mv_iso(), 'status' => 'new', 'seen' => false] + $q;
}

/** POST inquiry — {input: InquiryInput} (contact form, measurement request, B2B quote). */
function mv_route_inquiry(): never
{
    mv_same_origin();
    mv_rate('inquiry', 10, 3600);
    $b = mv_body();
    if (mv_str($b['website'] ?? '', 50) !== '') mv_out(['ok' => true, 'inquiry' => null]);
    $inq = mv_new_inquiry(mv_clean_inquiry(is_array($b['input'] ?? null) ? $b['input'] : []));
    mv_put('inquiries', $inq['id'], $inq, 'web');
    mv_out(['ok' => true, 'inquiry' => $inq]);
}

/** checkBooking() of src/lib/bookings.ts. */
function mv_booking_problem(array $c, array $bookings, array $services): string
{
    $start = mv_parse_ms($c['start'] ?? null);
    if ($start === null || !((int) ($c['durationMin'] ?? 0) > 0)) return 'invalid';
    $svc = null;
    foreach ($services as $s) if (($s['id'] ?? '') === $c['serviceId']) $svc = $s;
    if (!$svc) return 'service';
    $staffIds = (array) ($svc['staffIds'] ?? []);
    if ($staffIds && !in_array($c['staffId'], $staffIds, true)) return 'staff';
    $end = $start + (int) $c['durationMin'] * 60000;
    $live = [];
    foreach ($bookings as $b) {
        if (!in_array($b['status'] ?? '', ['pending', 'confirmed', 'done'], true)) continue;
        $b0 = mv_parse_ms($b['start'] ?? null);
        if ($b0 === null) continue;
        if ($start < $b0 + (int) ($b['durationMin'] ?? 0) * 60000 && $b0 < $end) $live[] = $b;
    }
    foreach ($live as $b) if (($b['staffId'] ?? '') === $c['staffId']) return 'staffBusy';
    $same = count(array_filter($live, fn($b) => ($b['serviceId'] ?? '') === $c['serviceId']));
    if ($same >= max(1, (int) ($svc['capacity'] ?? 1))) return 'capacity';
    return '';
}

/**
 * The shop's booking rules for a request from the website (checkSlot() of the CMS, `web: true`): opening hours of
 * that weekday or of an exception day, closed days, the minimum notice, the grid of start times, and the pause kept
 * around each appointment of the same person. Times are read on the shop's clock (settings.timezone).
 * Returns '' when it fits, else 'closed' | 'outside' | 'notice' | 'grid' | 'buffer'.
 * A shop that never saved its booking rules has none on the server: then only overlaps are checked.
 */
function mv_booking_rules_problem(array $settings, int $startMs, int $durationMin, array $bookings, string $staffId, int $nowMs): string
{
    $rules = $settings['booking'] ?? null;
    if (!is_array($rules) || !is_array($rules['hours'] ?? null)) return '';
    try {
        $tz = new DateTimeZone((string) (($settings['timezone'] ?? '') ?: 'Europe/Belgrade'));
    } catch (Throwable $e) {
        $tz = new DateTimeZone('Europe/Belgrade');
    }
    $at = (new DateTimeImmutable('@' . intdiv($startMs, 1000)))->setTimezone($tz);
    $day = $at->format('Y-m-d');
    $minutes = (int) $at->format('G') * 60 + (int) $at->format('i');
    $toMin = function ($v): int {
        return preg_match('/^(\d{1,2}):(\d{2})$/', (string) $v, $m) ? (int) $m[1] * 60 + (int) $m[2] : 0;
    };
    $from = $to = null;
    foreach ((array) ($rules['exceptions'] ?? []) as $ex) {
        if (!is_array($ex) || !is_string($ex['date'] ?? null)) continue;
        $last = is_string($ex['dateTo'] ?? null) && $ex['dateTo'] !== '' ? $ex['dateTo'] : $ex['date'];
        if ($day < $ex['date'] || $day > $last) continue;
        if (!empty($ex['closed']) || empty($ex['from']) || empty($ex['to'])) return 'closed';
        $from = $toMin($ex['from']);
        $to = $toMin($ex['to']);
        break;
    }
    if ($from === null) {
        $h = $rules['hours'][((int) $at->format('N')) - 1] ?? null; // Monday = 0
        if (!is_array($h) || empty($h['open'])) return 'closed';
        $from = $toMin($h['from'] ?? '');
        $to = $toMin($h['to'] ?? '');
    }
    if ($minutes < $from || $minutes + $durationMin > $to) return 'outside';
    $step = max(5, (int) ($rules['slotStepMin'] ?? 30) ?: 30);
    if (($minutes - $from) % $step !== 0) return 'grid';
    if ($startMs < $nowMs + (int) round((float) ($rules['minNoticeHours'] ?? 0) * 3600000)) return 'notice';
    $buffer = (int) ($rules['bufferMin'] ?? 0) * 60000;
    if ($buffer > 0) {
        $end = $startMs + $durationMin * 60000;
        foreach ($bookings as $b) {
            if (($b['staffId'] ?? '') !== $staffId || !in_array($b['status'] ?? '', ['pending', 'confirmed', 'done'], true)) continue;
            $b0 = mv_parse_ms($b['start'] ?? null);
            if ($b0 === null) continue;
            if ($startMs < $b0 + (int) ($b['durationMin'] ?? 0) * 60000 + $buffer && $b0 < $end + $buffer) return 'buffer';
        }
    }
    return '';
}

/**
 * POST booking — {inquiry: InquiryInput, booking: {serviceId, staffId, start, location, note, …}}
 * Saves the request and the pending booking together (or neither, when the slot was just taken).
 */
function mv_route_booking(): never
{
    mv_same_origin();
    mv_rate('booking', 8, 3600);
    $b = mv_body();
    if (mv_str($b['website'] ?? '', 50) !== '') mv_fail(422, 'invalid');
    $q = mv_clean_inquiry(is_array($b['inquiry'] ?? null) ? $b['inquiry'] : []);
    $bk = is_array($b['booking'] ?? null) ? $b['booking'] : mv_fail(422, 'invalid');
    $start = mv_parse_ms($bk['start'] ?? null);
    $now = mv_ms();
    if ($start === null || $start < $now - 5 * 60000 || $start > $now + 400 * 86400000) mv_fail(422, 'time_invalid');
    $out = mv_tx(function () use ($q, $bk, $start, $now) {
        $services = mv_docs('services');
        $svc = null;
        foreach ($services as $s) if (($s['id'] ?? '') === ($bk['serviceId'] ?? '')) $svc = $s;
        if (!$svc || !((int) ($svc['durationMin'] ?? 0) > 0) || !($svc['staffIds'] ?? [])) mv_fail(422, 'service_invalid');
        $staffId = mv_str($bk['staffId'] ?? '', 80);
        $active = false;
        foreach (mv_docs('staff') as $m) if (($m['id'] ?? '') === $staffId && ($m['active'] ?? true)) $active = true;
        if (!$active) mv_fail(409, 'taken', ['reason' => 'staff']);
        $booking = [
            'serviceId' => (string) $svc['id'], 'staffId' => $staffId, 'customerName' => $q['name'], 'phone' => $q['phone'],
        ];
        if (isset($q['email'])) $booking['email'] = $q['email'];
        $booking += ['start' => mv_iso($start), 'durationMin' => (int) $svc['durationMin']];
        $all = mv_docs('bookings');
        $problem = mv_booking_problem($booking, $all, $services);
        if ($problem !== '') mv_fail(409, 'taken', ['reason' => $problem]);
        // the page only offers times that fit the shop's rules; a request that does not was not made with the page
        // (or the rules changed while it was open)
        $why = mv_booking_rules_problem(mv_settings(), $start, (int) $svc['durationMin'], $all, $staffId, $now);
        if ($why === 'buffer') mv_fail(409, 'taken', ['reason' => 'staffBusy']);
        if ($why !== '') mv_fail(422, 'time_invalid', ['reason' => $why]);
        $locations = array_map(fn($l) => (string) ($l['id'] ?? ''), (array) (mv_settings()['locations'] ?? []));
        $loc = mv_str($bk['location'] ?? '', 80);
        if ($loc !== 'onsite' && !in_array($loc, $locations, true)) $loc = (string) ($svc['location'] ?? ($locations[0] ?? 'onsite'));
        $inq = mv_new_inquiry($q + ['scheduledAt' => $booking['start']]);
        $booking = ['id' => mv_uid('bk')] + $booking + [
            'status' => 'pending', 'inquiryId' => $inq['id'], 'location' => $loc,
        ];
        $note = mv_str($bk['note'] ?? '', 600);
        if ($note !== '') $booking['note'] = $note;
        $addr = mv_str($bk['address'] ?? '', 200);
        if ($addr !== '') $booking['address'] = $addr;
        $city = mv_str($bk['city'] ?? '', 80);
        if ($city !== '') $booking['city'] = $city;
        $booking['createdAt'] = mv_iso();
        mv_put('inquiries', $inq['id'], $inq, 'web');
        // bookings are kept in start order
        mv_put('bookings', $booking['id'], $booking, 'web', (float) $start);
        return ['inquiry' => $inq, 'booking' => $booking];
    });
    mv_out(['ok' => true] + $out);
}

/* ------------------------------------------------------------------ */
/* Order tracking & discount codes                                     */
/* ------------------------------------------------------------------ */

/**
 * POST track — {number, contact}: the order's progress when the e-mail or phone matches the order, and that
 * customer's upcoming appointments (time and service only).
 */
function mv_route_track(): never
{
    mv_same_origin();
    mv_rate('track', 20, 900);
    $b = mv_body();
    // As the tracking page reads numbers (findOrder in src/site/components/booking/tracking.ts): letters and digits
    // only, so "om w7k3qf", "OM-W7K3QF" and "#OM-W7K3QF" are one number, and the shop's prefix may be left out.
    $canon = fn($s): string => preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $s)) ?? '';
    $num = $canon(mv_str($b['number'] ?? '', 40));
    $contact = mb_strtolower(mv_str($b['contact'] ?? '', 190));
    if ($num === '' || $contact === '') mv_fail(422, 'invalid');
    $settings = mv_single('settings');
    $prefix = $canon((is_array($settings) ? ($settings['orderPrefix'] ?? '') : '') ?: 'SC-');
    $found = null;
    foreach (mv_docs('orders') as $o) {
        $on = $canon($o['number'] ?? '');
        if ($on === '' || ($on !== $num && $on !== $prefix . $num)) continue;
        $email = mb_strtolower((string) ($o['customer']['email'] ?? ''));
        $p8 = mv_phone8((string) ($o['customer']['phone'] ?? ''));
        // a contact with an @ is an e-mail address: it is never compared as a phone number
        if (($email !== '' && $email === $contact) || ($p8 !== '' && !str_contains($contact, '@') && mv_phone8($contact) === $p8)) $found = $o;
    }
    if (!$found) mv_fail(404, 'not_found');
    // what the customer may see: no internal notes, no staff names
    $view = [];
    foreach (['id', 'number', 'createdAt', 'status', 'items', 'delivery', 'payment', 'coupon', 'subtotal', 'installationTotal', 'discount', 'shipping', 'total', 'vat', 'lang', 'discounts', 'shippingBeforeDiscount', 'fulfillment', 'tracking', 'carrier'] as $k) {
        if (array_key_exists($k, $found)) $view[$k] = $found[$k];
    }
    $c = (array) ($found['customer'] ?? []);
    $view['customer'] = ['firstName' => $c['firstName'] ?? '', 'lastName' => $c['lastName'] ?? '', 'email' => $c['email'] ?? '', 'phone' => $c['phone'] ?? '', 'city' => $c['city'] ?? '', 'address' => $c['address'] ?? ''];
    $view['timeline'] = array_values(array_map(
        fn($e) => ['at' => $e['at'] ?? '', 'status' => $e['status'] ?? ''],
        array_filter((array) ($found['timeline'] ?? []), fn($e) => ($e['status'] ?? '') !== 'note')
    ));
    $view['seen'] = true;
    mv_out(['ok' => true, 'order' => $view, 'bookings' => mv_track_bookings($c)]);
}

/**
 * The upcoming appointments of the customer whose order was just found (upcomingFor() of the tracking page): booked
 * with the order's e-mail or phone, pending or confirmed, in the future — at most four, soonest first. Only what the
 * page lists: when, which service, where, and whether it is confirmed. No names, contacts, notes or staff.
 */
function mv_track_bookings(array $customer): array
{
    $email = mb_strtolower(trim((string) ($customer['email'] ?? '')));
    $p8 = mv_phone8((string) ($customer['phone'] ?? ''));
    if ($email === '' && $p8 === '') return [];
    $now = mv_ms();
    $out = [];
    foreach (mv_docs('bookings') as $bk) {
        if (!in_array($bk['status'] ?? '', ['pending', 'confirmed'], true)) continue;
        $t = mv_parse_ms($bk['start'] ?? null);
        if ($t === null || $t <= $now) continue;
        $same = ($email !== '' && mb_strtolower(trim((string) ($bk['email'] ?? ''))) === $email)
            || ($p8 !== '' && mv_phone8((string) ($bk['phone'] ?? '')) === $p8);
        if (!$same) continue;
        $out[] = [
            't' => $t,
            'view' => [
                'id' => (string) ($bk['id'] ?? ''), 'serviceId' => (string) ($bk['serviceId'] ?? ''), 'start' => (string) $bk['start'],
                'durationMin' => (int) ($bk['durationMin'] ?? 60), 'status' => (string) $bk['status'], 'location' => (string) ($bk['location'] ?? ''),
            ],
        ];
    }
    usort($out, fn($x, $y) => $x['t'] <=> $y['t']);
    return array_map(fn($x) => $x['view'], array_slice($out, 0, 4));
}

/** POST coupon — {code}: the rule behind a discount code, so the shop page can show its effect (or why it does not apply). */
function mv_route_coupon(): never
{
    mv_same_origin();
    mv_rate('coupon', 30, 900);
    // normalizeCode() of src/lib/discounts.ts: spaces dropped, upper case
    $norm = fn($c) => mb_strtoupper(preg_replace('/\s+/u', '', trim((string) $c)) ?? '');
    $code = $norm(mv_str(mv_body()['code'] ?? '', 40));
    if ($code === '') mv_fail(422, 'invalid');
    foreach (mv_docs('discounts') as $d) {
        if (($d['method'] ?? '') !== 'code' || ($d['status'] ?? '') === 'draft') continue;
        if ($norm($d['code'] ?? '') === $code) mv_out(['ok' => true, 'discount' => mv_public_discount($d)]);
    }
    mv_out(['ok' => true, 'discount' => null]);
}
