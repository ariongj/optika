<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
om_require_auth();
om_require_permission('orders.read');

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'GET') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$token = om_clean($_GET['token'] ?? '', 80);
$record = null;
foreach (om_read('prescription_uploads', []) as $candidate) {
    if (is_array($candidate) && hash_equals((string) ($candidate['token'] ?? ''), $token)) {
        $record = $candidate;
        break;
    }
}
if (!$record) {
    om_json(['ok' => false, 'error' => 'prescription_not_found'], 404);
}

$storedName = basename((string) ($record['storedName'] ?? ''));
$path = om_storage_dir() . '/prescriptions/' . $storedName;
if ($storedName === '' || !is_file($path)) {
    om_json(['ok' => false, 'error' => 'prescription_file_missing'], 404);
}

header('Content-Type: ' . (string) ($record['mime'] ?? 'application/octet-stream'));
header('Content-Length: ' . (string) filesize($path));
header('Content-Disposition: attachment; filename="' . rawurlencode((string) ($record['originalName'] ?? 'receta')) . '"');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow, noarchive');
readfile($path);
exit;
