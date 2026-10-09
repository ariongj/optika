<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}
if (!om_same_origin()) {
    om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
}
$input = om_input();
om_session_start();
if (om_clean($input['company'] ?? '', 100) !== '') {
    om_json(['ok' => true, 'accepted' => true]);
}

om_rate_limit('public_submissions', 20, 3600);

$type = om_clean($input['type'] ?? '', 40);
if (!in_array($type, ['appointment', 'order', 'enquiry'], true)) {
    om_json(['ok' => false, 'error' => 'invalid_submission_type'], 422);
}
$isVersionedAppointment = $type === 'appointment'
    && (array_key_exists('appointmentSchemaVersion', $input) || array_key_exists('appointmentRequestId', $input));
$name = om_clean($input['name'] ?? '', 140);
$phone = om_clean($input['phone'] ?? '', 80);
$email = strtolower(om_clean($input['email'] ?? '', 180));
if (!$isVersionedAppointment && $email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    om_json(['ok' => false, 'error' => 'invalid_email'], 422);
}

// Division is a routing label, never an access-control role. Existing optical
// bookings/checkouts remain compatible; the new forms only request a callback.
$division = om_clean($input['division'] ?? 'optical', 30);
if (!in_array($division, ['optical', 'lab', 'clinic'], true)) {
    om_json(['ok' => false, 'error' => 'invalid_division'], 422);
}
$isLabApplication = $division === 'lab' && count(array_intersect(
    ['applicationRequestId', 'marketSegment', 'country', 'businessType', 'interest', 'sourcePath', 'locale', 'website'],
    array_keys($input)
)) > 0;
if (!$isVersionedAppointment && ($name === '' || (!$isLabApplication && $phone === ''))) {
    om_json(['ok' => false, 'error' => $isLabApplication ? 'application_contact_required' : 'name_and_phone_required'], 422);
}
$isDivisionEnquiry = $division !== 'optical';
$service = om_clean($input['service'] ?? '', 180);
$divisionServices = [
    'clinic' => ['Konsultë me specialistin e syve', 'Informacion për vlerësim kirurgjikal', 'Informacion për vizitë kontrolli'],
    'lab' => ['Bashkëpunim për lente me recetë', 'Montim dhe kontroll i porosive', 'Informacion për bashkëpunim profesional'],
];
if ($isDivisionEnquiry && ($type !== 'enquiry' || ($input['consent'] ?? false) !== true)) {
    om_json(['ok' => false, 'error' => $type !== 'enquiry' ? 'invalid_division_type' : 'consent_required'], 422);
}
$application = [];
if ($isLabApplication) {
    $requestId = strtolower(om_clean($input['applicationRequestId'] ?? '', 100));
    if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $requestId)) {
        om_json(['ok' => false, 'error' => 'invalid_application_request_id'], 422);
    }
    $marketSegment = om_clean($input['marketSegment'] ?? '', 20);
    $country = strtoupper(om_clean($input['country'] ?? '', 10));
    $businessType = om_clean($input['businessType'] ?? '', 30);
    $interest = om_clean($input['interest'] ?? '', 30);
    $sourcePath = om_clean($input['sourcePath'] ?? '', 100);
    $locale = om_clean($input['locale'] ?? '', 10);
    $euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    if (!in_array($marketSegment, ['kosovo', 'eu'], true)) {
        om_json(['ok' => false, 'error' => 'invalid_application_market'], 422);
    }
    if (($marketSegment === 'kosovo' && $country !== 'XK') || ($marketSegment === 'eu' && !in_array($country, $euCountries, true))) {
        om_json(['ok' => false, 'error' => 'invalid_application_country'], 422);
    }
    if (!in_array($businessType, ['optical', 'clinic', 'distributor', 'other'], true)) {
        om_json(['ok' => false, 'error' => 'invalid_application_business_type'], 422);
    }
    if (!in_array($interest, ['prescription', 'mounting', 'documentation', 'partnership'], true)) {
        om_json(['ok' => false, 'error' => 'invalid_application_interest'], 422);
    }
    if (!in_array($sourcePath, ['/laboratory/partners', '/laboratory/kosovo', '/laboratory/europe'], true)
        || ($sourcePath === '/laboratory/kosovo' && $marketSegment !== 'kosovo')
        || ($sourcePath === '/laboratory/europe' && $marketSegment !== 'eu')) {
        om_json(['ok' => false, 'error' => 'invalid_application_source'], 422);
    }
    if (!in_array($locale, ['sq', 'en'], true)) {
        om_json(['ok' => false, 'error' => 'invalid_application_locale'], 422);
    }
    if ($email === '' || om_clean($input['organization'] ?? '', 160) === '') {
        om_json(['ok' => false, 'error' => 'application_contact_required'], 422);
    }
    // This endpoint is for business contact only, not patient records, clinical
    // files or prescriptions. Unexpected fields never enter the saved record.
    foreach (['message', 'patient', 'patientName', 'patientData', 'medicalData', 'prescription', 'prescriptionToken', 'files', 'attachments'] as $field) {
        if (array_key_exists($field, $input) && $input[$field] !== '' && $input[$field] !== null && $input[$field] !== []) {
            om_json(['ok' => false, 'error' => 'application_business_contact_only'], 422);
        }
    }
    $websiteRaw = $input['website'] ?? '';
    $website = is_string($websiteRaw) ? trim($websiteRaw) : '';
    if (!is_string($websiteRaw) || strlen($website) > 300) {
        om_json(['ok' => false, 'error' => 'invalid_application_website'], 422);
    }
    if ($website !== '') {
        $websiteParts = parse_url($website);
        $websiteHost = strtolower((string) ($websiteParts['host'] ?? ''));
        if (!filter_var($website, FILTER_VALIDATE_URL) || !is_array($websiteParts)
            || strtolower((string) ($websiteParts['scheme'] ?? '')) !== 'https'
            || isset($websiteParts['user']) || isset($websiteParts['pass'])
            || (isset($websiteParts['port']) && $websiteParts['port'] !== 443)
            || filter_var($websiteHost, FILTER_VALIDATE_IP)
            || !filter_var($websiteHost, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)
            || !str_contains($websiteHost, '.')
            || preg_match('/\.(?:localhost|local|internal)$/i', $websiteHost)
            || preg_match('/[\x00-\x20\x7f]/', $website)) {
            om_json(['ok' => false, 'error' => 'invalid_application_website'], 422);
        }
    }
    $interestServices = [
        'prescription' => 'Bashkëpunim për lente me recetë',
        'mounting' => 'Montim dhe kontroll i porosive',
        'documentation' => 'Kërkesë për dokumentacion profesional',
        'partnership' => 'Informacion për bashkëpunim profesional',
    ];
    $service = $interestServices[$interest];
    $application = [
        'applicationSchemaVersion' => 1,
        'applicationRequestId' => $requestId,
        'marketSegment' => $marketSegment,
        'country' => $country,
        'businessType' => $businessType,
        'interest' => $interest,
        'sourcePath' => $sourcePath,
        'locale' => $locale,
        'website' => $website,
    ];
}
if ($isDivisionEnquiry && !$isLabApplication && !in_array($service, $divisionServices[$division], true)) {
    om_json(['ok' => false, 'error' => 'invalid_division_service'], 422);
}
$organization = $division === 'lab' ? om_clean($input['organization'] ?? '', 160) : '';
$market = $isLabApplication
    ? ($application['marketSegment'] === 'kosovo' ? 'Kosovë' : 'BE · ' . $application['country'])
    : ($division === 'lab' ? om_clean($input['market'] ?? '', 100) : '');
if ($division === 'lab' && ($organization === '' || $market === '')) {
    om_json(['ok' => false, 'error' => 'organization_and_market_required'], 422);
}

$appointmentMetadata = [];
$appointmentValues = [];
if ($isVersionedAppointment) {
    // Versioning lets the new form enforce the complete booking contract while
    // older deployed forms continue to submit the legacy callback request.
    if (($input['appointmentSchemaVersion'] ?? null) !== 1) {
        om_json(['ok' => false, 'error' => 'invalid_appointment_schema'], 422);
    }
    $appointmentRequestId = is_string($input['appointmentRequestId'] ?? null)
        ? strtolower(trim($input['appointmentRequestId'])) : '';
    if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $appointmentRequestId)) {
        om_json(['ok' => false, 'error' => 'invalid_appointment_request_id'], 422);
    }
    $fields = [];
    $appointmentLimits = ['name' => 140, 'phone' => 80, 'email' => 180, 'service' => 180, 'preferredDate' => 10, 'preferredTime' => 5, 'message' => 1000];
    foreach ($appointmentLimits as $field => $limit) {
        $raw = $input[$field] ?? '';
        $value = is_string($raw) ? trim($raw) : '';
        $length = preg_match_all('/./us', $value);
        if (!is_string($raw) || $length === false || $length > $limit) {
            $fields[$field] = 'invalid_' . $field;
        }
        // The character limits above are Unicode-aware even on hosts without
        // mbstring; leave enough bytes here not to split Albanian characters.
        $appointmentValues[$field] = om_clean($value, $limit * 4);
    }
    if ((preg_match_all('/./us', $appointmentValues['name']) ?: 0) < 2) {
        $fields['name'] = 'invalid_name';
    }
    $phoneDigits = preg_replace('/[^0-9]/', '', $appointmentValues['phone']);
    $rawAppointmentPhone = is_string($input['phone'] ?? null) ? trim($input['phone']) : '';
    if (!preg_match('/^\+?[0-9 ().-]+$/', $rawAppointmentPhone)
        || strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
        $fields['phone'] = 'invalid_phone';
    }
    $appointmentValues['phone'] = (str_starts_with($appointmentValues['phone'], '+') ? '+' : '') . $phoneDigits;
    $appointmentValues['email'] = strtolower($appointmentValues['email']);
    if ($appointmentValues['email'] !== '' && !filter_var($appointmentValues['email'], FILTER_VALIDATE_EMAIL)) {
        $fields['email'] = 'invalid_email';
    }
    // These are the existing ContactPage choices, not a live availability feed.
    $appointmentServices = ['Ekzaminim i syrit', 'Matje për progresive', 'Këshillim për recetën', 'Përshtatje e kornizës', 'Ndihmë për porosinë'];
    $appointmentSlots = ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00'];
    if (!in_array($appointmentValues['service'], $appointmentServices, true)) {
        $fields['service'] = 'invalid_service';
    }
    if (!in_array($appointmentValues['preferredTime'], $appointmentSlots, true)) {
        $fields['preferredTime'] = 'invalid_preferredTime';
    }
    $appointmentTimezone = new DateTimeZone('Europe/Belgrade');
    $requestedDay = preg_match('/^\d{4}-\d{2}-\d{2}$/', $appointmentValues['preferredDate'])
        ? DateTimeImmutable::createFromFormat('!Y-m-d', $appointmentValues['preferredDate'], $appointmentTimezone) : false;
    if (!$requestedDay || $requestedDay->format('Y-m-d') !== $appointmentValues['preferredDate'] || $requestedDay->format('N') === '7') {
        $fields['preferredDate'] = 'invalid_preferredDate';
    }
    if (($input['consent'] ?? false) !== true) {
        $fields['consent'] = 'consent_required';
    }
    if ($fields) {
        om_json(['ok' => false, 'error' => 'invalid_appointment', 'fields' => $fields], 422);
    }
    $name = $appointmentValues['name'];
    $phone = $appointmentValues['phone'];
    $email = $appointmentValues['email'];
    $service = $appointmentValues['service'];
    $appointmentMetadata = [
        'appointmentSchemaVersion' => 1,
        'appointmentRequestId' => $appointmentRequestId,
        'appointmentTimezone' => 'Europe/Belgrade',
    ];
}

// All submission writers share the existing lock. This also prevents legacy
// enquiries or administrative updates from overwriting a concurrent application.
$commerceLock = om_acquire_commerce_lock();
if ($type === 'order') om_release_expired_reservations(true);

if ($isVersionedAppointment) {
    $appointmentMetadata['idempotencyFingerprint'] = hash('sha256', json_encode([
        'appointment' => $appointmentValues,
        'requestId' => $appointmentMetadata['appointmentRequestId'],
        'accountId' => om_current_customer_id(),
        'consent' => true,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    foreach (om_read('submissions', []) as $existingSubmission) {
        if (($existingSubmission['type'] ?? '') !== 'appointment'
            || ($existingSubmission['appointmentRequestId'] ?? '') !== $appointmentMetadata['appointmentRequestId']) continue;
        if (!hash_equals((string) ($existingSubmission['idempotencyFingerprint'] ?? ''), $appointmentMetadata['idempotencyFingerprint'])) {
            om_json(['ok' => false, 'error' => 'appointment_request_conflict'], 409);
        }
        om_release_commerce_lock($commerceLock);
        om_json(['ok' => true, 'accepted' => true, 'duplicate' => true, 'id' => $existingSubmission['id']]);
    }
    // An already-saved retry is acknowledged above even after its selected day
    // has passed. New requests must match the same next-12 Mon-Sat days as UI.
    $bookableDates = [];
    $cursor = new DateTimeImmutable('today', $appointmentTimezone);
    while (count($bookableDates) < 12) {
        $cursor = $cursor->modify('+1 day');
        if ($cursor->format('N') !== '7') $bookableDates[] = $cursor->format('Y-m-d');
    }
    if (!in_array($appointmentValues['preferredDate'], $bookableDates, true)) {
        om_json(['ok' => false, 'error' => 'invalid_appointment', 'fields' => ['preferredDate' => 'appointment_date_unavailable']], 422);
    }
}

if ($isLabApplication) {
    $application['idempotencyFingerprint'] = hash('sha256', json_encode([
        'application' => $application,
        'name' => $name,
        'phone' => $phone,
        'email' => $email,
        'organization' => $organization,
        'accountId' => om_current_customer_id(),
        'consent' => true,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    foreach (om_read('submissions', []) as $existingSubmission) {
        if (($existingSubmission['division'] ?? '') !== 'lab'
            || ($existingSubmission['applicationRequestId'] ?? '') !== $application['applicationRequestId']) continue;
        if (!hash_equals((string) ($existingSubmission['idempotencyFingerprint'] ?? ''), $application['idempotencyFingerprint'])) {
            // Never reveal the existing contact, identifier or application state
            // to someone reusing a key with a different identity or payload.
            om_json(['ok' => false, 'error' => 'application_request_conflict'], 409);
        }
        om_release_commerce_lock($commerceLock);
        om_json(['ok' => true, 'accepted' => true, 'duplicate' => true, 'id' => $existingSubmission['id']]);
    }
}

$requestedOrderId = $type === 'order' ? om_clean($input['orderId'] ?? '', 100) : '';
if ($requestedOrderId !== '') {
    foreach (om_read('orders', []) as $existingOrder) {
        if ((string) ($existingOrder['id'] ?? '') === $requestedOrderId) {
            $existingAccountId = (string) ($existingOrder['accountId'] ?? '');
            $currentAccountId = om_current_customer_id();
            $sameOwner = $existingAccountId !== ''
                ? ($currentAccountId !== '' && hash_equals($existingAccountId, $currentAccountId))
                : (
                    $email !== ''
                    && hash_equals(strtolower((string) ($existingOrder['email'] ?? '')), $email)
                    && hash_equals(
                        preg_replace('/\s+/', '', (string) ($existingOrder['phone'] ?? '')),
                        preg_replace('/\s+/', '', $phone)
                    )
                );
            if (!$sameOwner) {
                om_json(['ok' => false, 'error' => 'order_id_conflict'], 409);
            }
            om_json([
                'ok' => true,
                'accepted' => true,
                'duplicate' => true,
                'orderId' => $requestedOrderId,
                'order' => om_customer_order_view($existingOrder),
                'products' => om_products(),
            ]);
        }
    }
}

$quote = $type === 'order' ? om_quote_order($input) : null;
// Legacy clients remain server-priced. Current checkout also binds submission
// to the quote the customer actually reviewed. Duplicate retries above still
// return the accepted order even when prices have since changed.
if ($quote !== null && array_key_exists('quoteFingerprint', $input)
    && (!is_string($input['quoteFingerprint']) || !hash_equals($quote['fingerprint'], $input['quoteFingerprint']))) {
    om_json(['ok' => false, 'error' => 'quote_changed'], 409);
}

$submission = array_merge([
    'id' => om_id('SUB'),
    'accountId' => om_current_customer_id(),
    'type' => $type,
    'division' => $division,
    'organization' => $organization,
    'market' => $market,
    'contactConsentAt' => ($isDivisionEnquiry || $isVersionedAppointment) ? gmdate('c') : null,
    'name' => $name,
    'phone' => $phone,
    'email' => $email,
    'service' => $service,
    'preferredDate' => $isVersionedAppointment ? $appointmentValues['preferredDate'] : ($isLabApplication ? '' : om_clean($input['preferredDate'] ?? '', 30)),
    'preferredTime' => $isVersionedAppointment ? $appointmentValues['preferredTime'] : ($isLabApplication ? '' : om_clean($input['preferredTime'] ?? '', 30)),
    // New callback forms deliberately do not accept medical free text/files.
    'message' => $isVersionedAppointment ? $appointmentValues['message'] : ($isDivisionEnquiry ? '' : om_clean($input['message'] ?? '', 1400)),
    'status' => 'New',
    'createdAt' => gmdate('c'),
    'updatedAt' => gmdate('c'),
], $application, $appointmentMetadata);
$submissions = om_read('submissions', []);
array_unshift($submissions, $submission);
$retainedSubmissions = array_slice($submissions, 0, 3000);
foreach (array_slice($submissions, 3000) as $olderSubmission) {
    // Versioned requests remain available for review and retry resolution
    // instead of disappearing from the legacy rolling inbox.
    if ((($olderSubmission['division'] ?? '') === 'lab' && ($olderSubmission['applicationSchemaVersion'] ?? 0) === 1)
        || (($olderSubmission['type'] ?? '') === 'appointment' && ($olderSubmission['appointmentSchemaVersion'] ?? 0) === 1)) {
        $retainedSubmissions[] = $olderSubmission;
    }
}
om_write('submissions', $retainedSubmissions);

if ($type === 'order') {
    $quote = is_array($quote) ? $quote : om_quote_order($input);
    $lineItems = (array) $quote['items'];
    $productSummary = implode(' / ', array_map(
        static fn($line) => (string) ($line['name'] ?? '') . ' x' . (int) ($line['quantity'] ?? 1),
        $lineItems
    ));
    $reservedUntil = gmdate('c', time() + (max(1, (int) (om_commerce_seed()['inventory']['reservationMinutes'] ?? 1440)) * 60));
    $updatedProducts = om_adjust_inventory((array) $quote['requestedByProduct'], -1);
    $order = [
        'id' => $requestedOrderId ?: om_id('OM'),
        'accountId' => om_current_customer_id(),
        'customer' => $name,
        'email' => $email,
        'phone' => $phone,
        'product' => om_clean($productSummary, 1200),
        'items' => $lineItems,
        'subtotal' => $quote['subtotal'],
        'discount' => $quote['discount'],
        'discountCode' => $quote['discountCode'],
        'appliedRuleIds' => $quote['appliedRuleIds'] ?? [],
        'discountAllocations' => $quote['discountAllocations'] ?? [],
        'shippingDiscount' => $quote['shippingDiscount'] ?? 0,
        'shippingFee' => $quote['shippingFee'],
        'total' => $quote['total'],
        'currency' => $quote['currency'],
        'priceStatus' => 'Server-verified estimate · awaiting optical review',
        'status' => 'Pending',
        'paymentStatus' => 'Awaiting confirmation',
        'fulfillmentStatus' => 'Unfulfilled',
        'prescription' => om_clean($input['prescription'] ?? 'None', 100),
        'shippingKey' => $quote['shippingKey'],
        'shipping' => $quote['shipping'],
        'deliveryAddress' => om_clean($input['deliveryAddress'] ?? '', 500),
        'contactPreference' => om_clean($input['contactPreference'] ?? 'WhatsApp', 40),
        'customerNote' => om_clean($input['customerNote'] ?? '', 600),
        'source' => 'Website checkout',
        'payment' => 'Confirm with store',
        'inventoryState' => 'Reserved',
        'reservedUntil' => $reservedUntil,
        'trackingNumber' => '',
        'paymentLink' => '',
        'staffNote' => '',
        'note' => 'Server-priced checkout request. Stock reserved pending optical confirmation.',
        'date' => gmdate('Y-m-d'),
        'createdAt' => gmdate('c'),
        'updatedAt' => gmdate('c'),
    ];
    $customerNotified = $email !== '' && om_send_transactional_email(
        $email,
        'Optika Miftari — porosia ' . $order['id'],
        om_order_email_body($order, false)
    );
    $staffEmail = trim((string) getenv('OPTIKA_ORDER_EMAIL')) ?: OM_DEFAULT_ADMIN_EMAIL;
    $staffNotified = om_send_transactional_email(
        $staffEmail,
        'Porosi e re ' . $order['id'] . ' — ' . $name,
        om_order_email_body($order, true)
    );
    $order['notificationStatus'] = [
        'customer' => $customerNotified ? 'Sent' : 'Unavailable',
        'staff' => $staffNotified ? 'Sent' : 'Unavailable',
        'attemptedAt' => gmdate('c'),
    ];
    $orders = om_read('orders', []);
    array_unshift($orders, $order);
    om_write('orders', array_slice($orders, 0, 5000));

    $prescriptionTokens = [];
    foreach ($lineItems as $lineItem) {
        $token = (string) (($lineItem['configuration'] ?? [])['prescriptionToken'] ?? '');
        if ($token !== '') $prescriptionTokens[$token] = true;
    }
    if ($prescriptionTokens) {
        $uploads = om_read('prescription_uploads', []);
        foreach ($uploads as $index => $upload) {
            $token = (string) ($upload['token'] ?? '');
            if (isset($prescriptionTokens[$token])) {
                $uploads[$index]['status'] = 'Attached';
                $uploads[$index]['orderId'] = $order['id'];
                $uploads[$index]['attachedAt'] = gmdate('c');
            }
        }
        om_write('prescription_uploads', $uploads);
    }

    $customers = om_read('customers', []);
    $match = -1;
    foreach ($customers as $index => $customer) {
        if (($email !== '' && strtolower((string) ($customer['email'] ?? '')) === $email) || (string) ($customer['phone'] ?? '') === $phone) {
            $match = $index;
            break;
        }
    }
    if ($match >= 0) {
        $customers[$match]['name'] = $name;
        $customers[$match]['orders'] = (int) ($customers[$match]['orders'] ?? 0) + 1;
        $customers[$match]['requestValue'] = (float) ($customers[$match]['requestValue'] ?? 0) + $order['total'];
        $customers[$match]['lastOrder'] = $order['date'];
        $customers[$match]['updatedAt'] = gmdate('c');
    } else {
        array_unshift($customers, [
            'id' => om_id('CUS'),
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'segment' => $order['prescription'] === 'None' ? 'New customer' : 'Optical care',
            'status' => 'Active',
            'orders' => 1,
            'spend' => 0,
            'requestValue' => $order['total'],
            'lastOrder' => $order['date'],
            'prescription' => $order['prescription'],
            'note' => 'Created from public checkout.',
            'createdAt' => gmdate('c'),
            'updatedAt' => gmdate('c'),
        ]);
    }
    om_write('customers', $customers);
}

om_audit('public_submission', $type, (string) $submission['id']);
om_release_commerce_lock($commerceLock);
om_json([
    'ok' => true,
    'accepted' => true,
    'id' => $submission['id'],
    'orderId' => $type === 'order' ? ($order['id'] ?? null) : null,
    'order' => $type === 'order' && isset($order) ? om_customer_order_view($order) : null,
    'products' => $type === 'order' ? om_products() : null,
], 201);
