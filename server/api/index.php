<?php
// Miftari Vision API — front controller. Every request to /api/<route> lands here (api/.htaccess).
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

foreach (['core', 'store', 'auth', 'perms', 'data', 'users', 'consent', 'visitor', 'uploads', 'seo'] as $lib) require __DIR__ . "/lib/$lib.php";
if (is_file(__DIR__ . '/lib/pricing.php')) require __DIR__ . '/lib/pricing.php';

set_exception_handler(function (Throwable $e): void {
    // details go to the private data folder, never to the browser
    try {
        @file_put_contents(mv_data_dir() . '/error.log', '[' . gmdate('c') . '] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine() . "\n", FILE_APPEND);
    } catch (Throwable) {
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo '{"ok":false,"error":"server_error"}';
});

$path = trim((string) ($_GET['r'] ?? ''), '/');
$m = mv_method();

if ($path === 'health' && $m === 'GET') {
    mv_out(['ok' => true, 'version' => MV_API_VERSION, 'php' => PHP_VERSION, 'sqlite' => extension_loaded('pdo_sqlite'), 'pricing' => function_exists('mvp_price_cart'), 'https' => mv_https()]);
}
if ($path === 'public' && $m === 'GET') mv_route_public();
if ($path === 'seo/page' && ($m === 'GET' || $m === 'HEAD')) mv_route_seo_page();
if ($path === 'seo/sitemap' && ($m === 'GET' || $m === 'HEAD')) mv_route_sitemap();
if ($path === 'unsubscribe') mv_route_unsubscribe();
if (str_starts_with($path, 'auth/')) mv_route_auth($path);

if ($m === 'POST') {
    switch ($path) {
        case 'subscribe':
            mv_route_subscribe();
        case 'inquiry':
            mv_route_inquiry();
        case 'booking':
            mv_route_booking();
        case 'track':
            mv_route_track();
        case 'coupon':
            mv_route_coupon();
        case 'order':
            if (!function_exists('mvp_price_cart')) mv_fail(503, 'pricing_missing');
            mv_route_order();
    }
}

if (str_starts_with($path, 'admin/')) {
    $me = mv_staff();
    if (preg_match('#^admin/(users|sessions|auth-events)#', $path)) mv_route_users($path, $me);
    if ($path === 'admin/consent' || $path === 'admin/subscribers') mv_route_consent($path, $me);
    switch ("$m $path") {
        case 'GET admin/snapshot':
            mv_route_snapshot($me);
        case 'GET admin/changes':
            mv_route_changes($me);
        case 'POST admin/sync':
            mv_route_sync($me);
        case 'POST admin/import':
            mv_route_import($me);
        case 'GET admin/export':
            mv_route_export($me);
        case 'POST admin/upload':
            mv_route_upload($me);
    }
}

mv_fail(404, 'not_found');
