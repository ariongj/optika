<?php
// Miftari Vision API — image uploads from the CMS media library. Pictures are checked by content (not by name),
// re-encoded when the server can (drops camera metadata such as GPS position), and stored under /uploads/ with a
// random name. The uploads folder never runs scripts (see uploads/.htaccess in the release).
declare(strict_types=1);

const MV_IMAGE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/avif' => 'avif'];

/** The site's base path ("/" or "/shop/"), from where the API lives. */
function mv_base_path(): string
{
    $api = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')));
    $base = rtrim(str_replace('\\', '/', dirname($api)), '/');
    return $base === '' ? '/' : $base . '/';
}

function mv_uploads_dir(): string
{
    return dirname(__DIR__, 2) . '/uploads';
}

/** POST admin/upload (multipart, field "file"). */
function mv_route_upload(array $me): never
{
    $role = (string) $me['role'];
    $ok = false;
    foreach (['content', 'products', 'onlineStore', 'offers', 'collections'] as $m) if (mv_can($role, $m, 'edit')) $ok = true;
    if (!$ok) mv_fail(403, 'forbidden');
    mv_rate('upload', 120, 3600, false, (string) $me['id']);
    $f = $_FILES['file'] ?? null;
    if (!is_array($f) || !isset($f['error']) || is_array($f['error'])) mv_fail(422, 'file_missing');
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) mv_fail(413, 'too_large');
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string) $f['tmp_name'])) mv_fail(422, 'file_missing');
    $max = (int) mv_config()['upload_max'];
    if ((int) $f['size'] > $max) mv_fail(413, 'too_large', ['max' => $max]);
    $tmp = (string) $f['tmp_name'];
    $mime = '';
    if (class_exists('finfo')) $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
    $info = @getimagesize($tmp);
    if ($mime === '' && is_array($info)) $mime = (string) ($info['mime'] ?? '');
    if (!isset(MV_IMAGE_TYPES[$mime]) || !is_array($info) || ($info['mime'] ?? '') !== $mime) mv_fail(415, 'not_an_image');
    [$w, $h] = [(int) $info[0], (int) $info[1]];
    if ($w < 1 || $h < 1 || $w > 12000 || $h > 12000 || $w * $h > 60000000) mv_fail(422, 'image_size');
    $ext = MV_IMAGE_TYPES[$mime];

    $sub = gmdate('Y') . '/' . gmdate('m');
    $dir = mv_uploads_dir() . '/' . $sub;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) mv_fail(500, 'uploads_unavailable');
    $name = strtolower(mv_token(12)) . '.' . $ext;
    $dest = "$dir/$name";
    if (!mv_reencode($tmp, $dest, $mime, $w, $h)) {
        if (!move_uploaded_file($tmp, $dest)) mv_fail(500, 'uploads_unavailable');
    }
    @chmod($dest, 0644);
    $bytes = (int) filesize($dest);
    $id = mv_uid('up');
    $url = mv_base_path() . "uploads/$sub/$name";
    mv_db()->prepare('INSERT INTO uploads (id, path, mime, bytes, width, height, at, by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$id, "uploads/$sub/$name", $mime, $bytes, $w, $h, mv_iso(), (string) ($me['staff_id'] ?: $me['id'])]);
    mv_out(['ok' => true, 'id' => $id, 'url' => $url, 'mime' => $mime, 'bytes' => $bytes, 'width' => $w, 'height' => $h]);
}

/** Re-encode JPEG / PNG / WebP with GD (drops EXIF incl. GPS; keeps the photo the right way up). false = not possible. */
function mv_reencode(string $src, string $dest, string $mime, int &$w, int &$h): bool
{
    if (!extension_loaded('gd')) return false;
    $img = match ($mime) {
        'image/jpeg' => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($src) : false,
        'image/png' => function_exists('imagecreatefrompng') ? @imagecreatefrompng($src) : false,
        'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : false,
        default => false,
    };
    if (!$img) return false;
    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($src);
        $turn = ['3' => 180, '6' => -90, '8' => 90][(string) ($exif['Orientation'] ?? '')] ?? 0;
        if ($turn) {
            $r = imagerotate($img, $turn, 0);
            if ($r) {
                imagedestroy($img);
                $img = $r;
            }
        }
    }
    $w = imagesx($img);
    $h = imagesy($img);
    if ($mime !== 'image/jpeg') {
        imagealphablending($img, false);
        imagesavealpha($img, true);
    }
    $ok = match ($mime) {
        'image/jpeg' => imagejpeg($img, $dest, 88),
        'image/png' => imagepng($img, $dest, 6),
        'image/webp' => function_exists('imagewebp') && imagewebp($img, $dest, 86),
        default => false,
    };
    imagedestroy($img);
    return (bool) $ok && is_file($dest) && filesize($dest) > 0;
}
