<?php
// LOCAL-ONLY browser fixture. Never shipped. The isolated API suites verify real
// password login; this switch lets visual QA exercise their synthetic sessions.
declare(strict_types=1);
$storage = realpath((string) getenv('OPTIKA_STORAGE_DIR'));
$report = (string) (getenv('OPTIKA_AUDIT_REPORT') ?: 'final-audit-20261003');
if (!preg_match('/^[a-z0-9-]+$/', $report)) { http_response_code(403); exit('Invalid local QA report.'); }
$allowed = realpath(__DIR__ . '/../output/qa/' . $report);
if (!$storage || !$allowed || !str_starts_with($storage, $allowed . DIRECTORY_SEPARATOR)
    || !preg_match('/^run-\d+$/', basename($storage))
    || ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1'
    || !str_contains((string) ini_get('disable_functions'), 'mail')) {
    http_response_code(403); exit('Only the mail-disabled localhost test fixture is permitted.');
}
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
if ($path === '/__qa__/sessions') {
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex');
    echo '<!doctype html><html lang="en"><title>Isolated Optika QA</title><body><h1>Isolated test sessions</h1><p>Synthetic data only. Email is disabled. No production access.</p><form action="/__qa__/session" method="post"><button name="role" value="customer">Enter synthetic customer session</button><button name="role" value="admin">Enter synthetic staff session</button><button name="role" value="guest">Return to guest session</button></form></body></html>';
    exit;
}
if ($path === '/__qa__/session' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require __DIR__ . '/../dist/api/bootstrap.php';
    om_session_start();
    $_SESSION = [];
    session_regenerate_id(true);
    if (($_POST['role'] ?? '') === 'customer') {
        $account = om_customer_account_by_email('qa.alice@example.test');
        if (!$account) { http_response_code(404); exit('Run the isolated workflow suite first.'); }
        $_SESSION['customer_authenticated'] = true;
        $_SESSION['customer_id'] = $account['id'];
        $_SESSION['customer_email'] = $account['email'];
        $_SESSION['customer_last_seen'] = time();
        $_SESSION['customer_csrf'] = bin2hex(random_bytes(24));
        $destination = '/account/';
    } elseif (($_POST['role'] ?? '') === 'admin') {
        $_SESSION['optika_admin'] = true;
        $_SESSION['admin_email'] = 'qa.admin@example.test';
        $_SESSION['last_seen'] = time();
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        $destination = '/staff/';
    } else { $destination = '/shop/'; }
    header('Location: ' . $destination, true, 303); exit;
}
return require __DIR__ . '/seo-router.php';
