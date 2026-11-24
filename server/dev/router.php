<?php
// Local test server only — NOT part of the release. Mimics what the .htaccess files do on Hostinger:
//   php -S 127.0.0.1:8090 -t <release>/public_html server/dev/router.php
// /api/<route> → api/index.php?r=<route>; built pages and files as-is; unknown paths → 404.html with HTTP 404;
// dot-files, backups and non-image uploads refused; the web root's response headers (read from server/root/.htaccess,
// so the policy under test is the one that ships) added to every static response.
declare(strict_types=1);

$root = rtrim(str_replace('\\', '/', (string) $_SERVER['DOCUMENT_ROOT']), '/');
$uri = rawurldecode((string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH));

/** Header lines of the shipped web-root .htaccess ("Header always set Name "value""). */
function mv_dev_headers(): array
{
    $file = dirname(__DIR__) . '/root/.htaccess';
    $out = [];
    foreach (file($file) ?: [] as $line) {
        if (preg_match('/^\s*Header always set ([A-Za-z-]+) "(.*)"\s*$/', $line, $m)) $out[$m[1]] = $m[2];
    }
    return $out;
}

// the web root's rewrites to the API: the sitemap and the pages whose content lives in the database
if ($uri === '/sitemap.xml') {
    $uri = '/api/seo/sitemap';
} elseif (preg_match('#^/(produkt|produktet|koleksioni|oferta|faqe|keshilla)/([^/.]+)/?$#', $uri, $m)) {
    $_GET['p'] = "$m[1]/$m[2]";
    $uri = '/api/seo/page';
    foreach (mv_dev_headers() as $k => $v) header("$k: $v");
}

if (preg_match('#^/api(?:/(.*))?$#', $uri, $m)) {
    $_GET['r'] = $m[1] ?? '';
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    $_SERVER['SCRIPT_FILENAME'] = "$root/api/index.php";
    if (preg_match('#^(lib|storage|tests)(/|$)#', $_GET['r'])) {
        http_response_code(403);
        exit;
    }
    chdir("$root/api");
    require "$root/api/index.php";
    exit;
}

$deny = static function (): never {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Forbidden';
    exit;
};
if (preg_match('#(^|/)\.(?!well-known(/|$))#', $uri)) $deny();
if (preg_match('#\.(?:zip|tar|t?gz|7z|rar|sql|sqlite|sqlite3|db|bak|old|orig|swp|log|ini|env|sh|md|php)$#i', $uri)) $deny();
if (str_starts_with($uri, '/uploads/') && !preg_match('#/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif|avif)$#', $uri)) $deny();

$types = [
    'html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8',
    'json' => 'application/json', 'webmanifest' => 'application/manifest+json', 'svg' => 'image/svg+xml', 'png' => 'image/png',
    'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'avif' => 'image/avif', 'gif' => 'image/gif',
    'ico' => 'image/x-icon', 'woff2' => 'font/woff2', 'woff' => 'font/woff', 'wasm' => 'application/wasm', 'task' => 'application/octet-stream',
    'txt' => 'text/plain; charset=utf-8', 'xml' => 'application/xml', 'mp4' => 'video/mp4', 'webm' => 'video/webm', 'glb' => 'model/gltf-binary',
];

$path = $root . $uri;
$status = 200;
if (is_dir($path)) {
    if (!str_ends_with($uri, '/')) {
        header('Location: ' . $uri . '/' . (($q = parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_QUERY)) ? "?$q" : ''), true, 301);
        exit;
    }
    $path .= 'index.html';
}
$real = realpath($path);
if ($real === false || !is_file($real) || !str_starts_with(str_replace('\\', '/', $real), $root . '/')) {
    $status = 404;
    $real = "$root/404.html";
}

$ext = strtolower(pathinfo($real, PATHINFO_EXTENSION));
http_response_code($status);
foreach (mv_dev_headers() as $k => $v) header("$k: $v");
// the web root's SetEnvIf rule: the CMS is kept out of search results
if (preg_match('#^/admin(?:/|$)#', $uri)) header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
if (str_starts_with($uri, '/assets/')) header('Cache-Control: public, max-age=31536000, immutable');
elseif (in_array($ext, ['html', 'webmanifest'], true) || basename($real) === 'sw.js') header('Cache-Control: no-cache');
if (str_starts_with($uri, '/uploads/')) {
    header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
}
header('Content-Length: ' . filesize($real));
readfile($real);
