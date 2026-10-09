<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}
if (!om_same_origin()) {
    om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
}
om_rate_limit('prescription_uploads', 12, 3600);

if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    om_json(['ok' => false, 'error' => 'file_required'], 422);
}

$file = $_FILES['file'];
$size = (int) ($file['size'] ?? 0);
if ($size < 1 || $size > 10 * 1024 * 1024) {
    om_json(['ok' => false, 'error' => 'file_too_large'], 422);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string) $finfo->file((string) $file['tmp_name']);
$allowed = [
    'application/pdf' => 'pdf',
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
];
if (!isset($allowed[$mime])) {
    om_json(['ok' => false, 'error' => 'unsupported_file_type'], 422);
}

$storage = om_storage_dir() . '/prescriptions';
if (!is_dir($storage) && !mkdir($storage, 0700, true) && !is_dir($storage)) {
    om_json(['ok' => false, 'error' => 'upload_directory_unavailable'], 500);
}

$token = 'RX-' . strtoupper(bin2hex(random_bytes(10)));
$storedName = strtolower($token) . '.' . $allowed[$mime];
$target = $storage . '/' . $storedName;
if (!move_uploaded_file((string) $file['tmp_name'], $target)) {
    om_json(['ok' => false, 'error' => 'upload_failed'], 500);
}
@chmod($target, 0640);

$registryLock = om_acquire_commerce_lock();
$uploads = om_read('prescription_uploads', []);
$uploads[] = [
    'token' => $token,
    'storedName' => $storedName,
    'originalName' => om_clean($file['name'] ?? 'receta.' . $allowed[$mime], 180),
    'mime' => $mime,
    'size' => $size,
    'sha256' => hash_file('sha256', $target),
    'status' => 'Unassigned',
    'orderId' => '',
    'createdAt' => gmdate('c'),
    'attachedAt' => null,
];
om_write('prescription_uploads', array_slice($uploads, -3000));
om_audit('prescription_uploaded', 'prescription', $token);
om_release_commerce_lock($registryLock);

om_json([
    'ok' => true,
    'token' => $token,
    'name' => om_clean($file['name'] ?? 'Receta', 180),
], 201);
