<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
om_require_auth();
om_require_permission('catalog.write');
om_require_csrf();

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}
if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    om_json(['ok' => false, 'error' => 'file_required'], 422);
}

$file = $_FILES['file'];
$size = (int) ($file['size'] ?? 0);
if ($size <= 0 || $size > 20 * 1024 * 1024) {
    om_json(['ok' => false, 'error' => 'file_too_large'], 422);
}
if (strtolower((string) pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION)) !== 'glb') {
    om_json(['ok' => false, 'error' => 'unsupported_file_type'], 422);
}

$handle = fopen($file['tmp_name'], 'rb');
$header = $handle ? fread($handle, 12) : false;
if ($handle) fclose($handle);
if (!is_string($header) || strlen($header) !== 12 || substr($header, 0, 4) !== 'glTF') {
    om_json(['ok' => false, 'error' => 'invalid_glb'], 422);
}
$version = unpack('Vvalue', substr($header, 4, 4));
$declaredLength = unpack('Vvalue', substr($header, 8, 4));
if (($version['value'] ?? 0) !== 2 || ($declaredLength['value'] ?? 0) !== $size) {
    om_json(['ok' => false, 'error' => 'invalid_glb'], 422);
}

$uploadDir = dirname(__DIR__) . '/uploads/models';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    om_json(['ok' => false, 'error' => 'upload_directory_unavailable'], 500);
}
$name = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.glb';
$target = $uploadDir . '/' . $name;
if (!move_uploaded_file($file['tmp_name'], $target)) {
    om_json(['ok' => false, 'error' => 'upload_failed'], 500);
}
@chmod($target, 0644);
om_audit('model_uploaded', 'product_model', $name);
om_json(['ok' => true, 'url' => '/uploads/models/' . $name], 201);
