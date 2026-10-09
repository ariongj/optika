<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (!om_same_origin()) {
    om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$resource = om_clean($_GET['resource'] ?? 'session', 40);
om_session_start();

if ($method === 'GET' && $resource === 'session') {
    $authenticated = om_is_customer_authenticated();
    $account = $authenticated ? om_customer_account_by_id((string) ($_SESSION['customer_id'] ?? '')) : null;
    om_json([
        'ok' => true,
        'authenticated' => $authenticated,
        'profile' => is_array($account) ? om_customer_public_profile($account) : null,
        'csrf' => $authenticated ? om_customer_csrf_token() : '',
    ]);
}

if ($method === 'GET' && $resource === 'profile') {
    $account = om_require_customer_auth();
    $accountId = (string) $account['id'];
    $orders = array_values(array_filter(
        om_read('orders', []),
        static fn($order) => is_array($order) && (string) ($order['accountId'] ?? '') === $accountId
    ));
    usort($orders, static fn($a, $b) => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
    $appointments = array_values(array_filter(
        om_read('submissions', []),
        static fn($submission) => is_array($submission)
            && (string) ($submission['type'] ?? '') === 'appointment'
            && (string) ($submission['accountId'] ?? '') === $accountId
    ));
    usort($appointments, static fn($a, $b) => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
    om_json([
        'ok' => true,
        'authenticated' => true,
        'profile' => om_customer_public_profile($account),
        'orders' => array_map('om_customer_order_view', array_slice($orders, 0, 100)),
        'appointments' => array_map('om_customer_appointment_view', array_slice($appointments, 0, 50)),
        'csrf' => om_customer_csrf_token(),
    ]);
}

if ($method !== 'POST') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$input = om_input();
$action = om_clean($input['action'] ?? '', 50);

if ($action === 'register') {
    om_rate_limit('customer_register', 8, 3600);
    $firstName = om_clean($input['firstName'] ?? '', 80);
    $lastName = om_clean($input['lastName'] ?? '', 80);
    $email = strtolower(om_clean($input['email'] ?? '', 180));
    $phone = om_clean($input['phone'] ?? '', 80);
    $password = (string) ($input['password'] ?? '');
    if ($firstName === '' || $lastName === '' || $phone === '') {
        om_json(['ok' => false, 'error' => 'profile_fields_required'], 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        om_json(['ok' => false, 'error' => 'invalid_email'], 422);
    }
    if (empty($input['termsAccepted'])) {
        om_json(['ok' => false, 'error' => 'terms_required'], 422);
    }
    if (!om_customer_password_valid($password)) {
        om_json(['ok' => false, 'error' => 'weak_password'], 422);
    }
    $lock = om_acquire_commerce_lock();
    $accounts = om_customer_accounts();
    foreach ($accounts as $account) {
        if (is_array($account) && strtolower((string) ($account['email'] ?? '')) === $email) {
            om_release_commerce_lock($lock);
            om_json(['ok' => false, 'error' => 'email_already_registered'], 409);
        }
    }
    $now = gmdate('c');
    $account = [
        'id' => om_id('ACC'),
        'email' => $email,
        'firstName' => $firstName,
        'lastName' => $lastName,
        'phone' => $phone,
        'address' => '',
        'city' => '',
        'postcode' => '',
        'country' => 'Kosovë',
        'contactPreference' => 'WhatsApp',
        'status' => 'Active',
        'marketingConsent' => !empty($input['marketingConsent']),
        'mustChangePassword' => false,
        'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
        'createdAt' => $now,
        'updatedAt' => $now,
    ];
    array_unshift($accounts, $account);
    om_write('customer_accounts', $accounts);
    om_release_commerce_lock($lock);
    session_regenerate_id(true);
    $_SESSION['customer_authenticated'] = true;
    $_SESSION['customer_id'] = $account['id'];
    $_SESSION['customer_email'] = $account['email'];
    $_SESSION['customer_last_seen'] = time();
    $_SESSION['customer_csrf'] = bin2hex(random_bytes(24));
    om_audit('customer_registered', 'account', (string) $account['id']);
    om_json([
        'ok' => true,
        'authenticated' => true,
        'profile' => om_customer_public_profile($account),
        'orders' => [],
        'csrf' => $_SESSION['customer_csrf'],
    ], 201);
}

if ($action === 'login') {
    om_rate_limit('customer_login', 20, 900);
    $lockedUntil = (int) ($_SESSION['customer_locked_until'] ?? 0);
    if ($lockedUntil > time()) {
        om_json(['ok' => false, 'error' => 'too_many_attempts', 'retryAfter' => $lockedUntil - time()], 429);
    }
    $email = strtolower(om_clean($input['email'] ?? '', 180));
    $password = (string) ($input['password'] ?? '');
    $account = om_customer_account_by_email($email);
    $candidateHash = is_array($account)
        ? (string) ($account['passwordHash'] ?? '')
        : '$2y$10$6YmYvXtJT5gWZsDMW/IDYe3pc.ljhT9JBaGTSLoVdKa17Dg994YOu';
    $passwordMatches = password_verify($password, $candidateHash);
    $valid = is_array($account)
        && (string) ($account['status'] ?? 'Active') === 'Active'
        && $passwordMatches;
    if (!$valid) {
        $attempts = (int) ($_SESSION['customer_login_attempts'] ?? 0) + 1;
        $_SESSION['customer_login_attempts'] = $attempts;
        if ($attempts >= 5) {
            $_SESSION['customer_locked_until'] = time() + 900;
            $_SESSION['customer_login_attempts'] = 0;
        }
        usleep(350000);
        om_json(['ok' => false, 'error' => 'invalid_credentials'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['customer_authenticated'] = true;
    $_SESSION['customer_id'] = (string) $account['id'];
    $_SESSION['customer_email'] = (string) $account['email'];
    $_SESSION['customer_last_seen'] = time();
    $_SESSION['customer_login_attempts'] = 0;
    $_SESSION['customer_locked_until'] = 0;
    $_SESSION['customer_csrf'] = bin2hex(random_bytes(24));
    om_audit('customer_login', 'session', session_id());
    om_json([
        'ok' => true,
        'authenticated' => true,
        'profile' => om_customer_public_profile($account),
        'csrf' => $_SESSION['customer_csrf'],
    ]);
}

$account = om_require_customer_auth();
om_require_customer_csrf();

if ($action === 'logout') {
    om_audit('customer_logout', 'session', session_id());
    foreach (['customer_authenticated', 'customer_id', 'customer_email', 'customer_last_seen', 'customer_csrf', 'customer_login_attempts', 'customer_locked_until'] as $key) {
        unset($_SESSION[$key]);
    }
    om_json(['ok' => true, 'authenticated' => false]);
}

if ($action === 'update_profile') {
    $firstName = om_clean($input['firstName'] ?? '', 80);
    $lastName = om_clean($input['lastName'] ?? '', 80);
    $phone = om_clean($input['phone'] ?? '', 80);
    $address = om_clean($input['address'] ?? '', 220);
    $city = om_clean($input['city'] ?? '', 100);
    $postcode = om_clean($input['postcode'] ?? '', 30);
    $country = om_clean($input['country'] ?? 'Kosovë', 80) ?: 'Kosovë';
    $contactPreference = om_clean($input['contactPreference'] ?? 'WhatsApp', 30);
    if ($firstName === '' || $lastName === '' || $phone === '') {
        om_json(['ok' => false, 'error' => 'profile_fields_required'], 422);
    }
    if (!in_array($contactPreference, ['WhatsApp', 'Telefon', 'Email'], true)) {
        om_json(['ok' => false, 'error' => 'invalid_contact_preference'], 422);
    }
    $lock = om_acquire_commerce_lock();
    // Recheck after taking the shared writer lock: a staff action may have
    // removed or disabled this account while the request was waiting.
    $account = om_require_customer_auth();
    $accounts = om_customer_accounts();
    foreach ($accounts as $index => $candidate) {
        if ((string) ($candidate['id'] ?? '') !== (string) $account['id']) continue;
        $accounts[$index]['firstName'] = $firstName;
        $accounts[$index]['lastName'] = $lastName;
        $accounts[$index]['phone'] = $phone;
        $accounts[$index]['address'] = $address;
        $accounts[$index]['city'] = $city;
        $accounts[$index]['postcode'] = $postcode;
        $accounts[$index]['country'] = $country;
        $accounts[$index]['contactPreference'] = $contactPreference;
        $accounts[$index]['marketingConsent'] = !empty($input['marketingConsent']);
        $accounts[$index]['updatedAt'] = gmdate('c');
        $account = $accounts[$index];
        break;
    }
    om_write('customer_accounts', $accounts);
    om_audit('customer_profile_updated', 'account', (string) $account['id']);
    om_release_commerce_lock($lock);
    om_json(['ok' => true, 'profile' => om_customer_public_profile($account), 'csrf' => om_customer_csrf_token()]);
}

if ($action === 'change_password') {
    $current = is_string($input['currentPassword'] ?? null) ? $input['currentPassword'] : '';
    $next = is_string($input['newPassword'] ?? null) ? $input['newPassword'] : '';
    $lock = om_acquire_commerce_lock();
    // Verify against the latest password under the same lock used by profile
    // edits and registration, not the pre-lock authentication snapshot.
    $account = om_require_customer_auth();
    if (!password_verify($current, (string) ($account['passwordHash'] ?? ''))) {
        om_json(['ok' => false, 'error' => 'current_password_incorrect'], 422);
    }
    if (!om_customer_password_valid($next)) {
        om_json(['ok' => false, 'error' => 'weak_password'], 422);
    }
    if (password_verify($next, (string) ($account['passwordHash'] ?? ''))) {
        om_json(['ok' => false, 'error' => 'password_unchanged'], 422);
    }
    $accounts = om_customer_accounts();
    foreach ($accounts as $index => $candidate) {
        if ((string) ($candidate['id'] ?? '') !== (string) $account['id']) continue;
        $accounts[$index]['passwordHash'] = password_hash($next, PASSWORD_DEFAULT);
        $accounts[$index]['mustChangePassword'] = false;
        $accounts[$index]['updatedAt'] = gmdate('c');
        $account = $accounts[$index];
        break;
    }
    om_write('customer_accounts', $accounts);
    session_regenerate_id(true);
    $_SESSION['customer_csrf'] = bin2hex(random_bytes(24));
    om_audit('customer_password_changed', 'account', (string) $account['id']);
    om_release_commerce_lock($lock);
    om_json(['ok' => true, 'profile' => om_customer_public_profile($account), 'csrf' => $_SESSION['customer_csrf']]);
}

om_json(['ok' => false, 'error' => 'unknown_action'], 404);
