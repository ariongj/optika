<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
om_require_auth();
om_require_permission('media.write');
om_require_csrf();

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}
if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    om_json(['ok' => false, 'error' => 'file_required'], 422);
}
$file = $_FILES['file'];
if ((int) $file['size'] > 5 * 1024 * 1024) {
    om_json(['ok' => false, 'error' => 'file_too_large'], 422);
}
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
if (!isset($allowed[$mime])) {
    om_json(['ok' => false, 'error' => 'unsupported_file_type'], 422);
}
$uploadDir = dirname(__DIR__) . '/uploads/products';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    om_json(['ok' => false, 'error' => 'upload_directory_unavailable'], 500);
}
$name = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
$target = $uploadDir . '/' . $name;
if (!move_uploaded_file($file['tmp_name'], $target)) {
    om_json(['ok' => false, 'error' => 'upload_failed'], 500);
}
@chmod($target, 0644);
om_audit('media_uploaded', 'product_image', $name);
om_json(['ok' => true, 'url' => '/uploads/products/' . $name], 201);
