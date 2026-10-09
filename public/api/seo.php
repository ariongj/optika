<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/seo-render.php';

$root = dirname(__DIR__);
$registry = json_decode((string) @file_get_contents($root . '/seo-pages.json'), true);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'HEAD'], true)) { http_response_code(405); header('Allow: GET, HEAD'); header('X-Robots-Tag: noindex'); exit; }
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
// This endpoint is an internal renderer, not an alternative indexable URL.
if (str_starts_with((string) $requestPath, '/api/') || !is_array($registry)) { http_response_code(404); header('X-Robots-Tag: noindex'); exit; }
$site = (string) $registry['site'];
$route = trim(rawurldecode((string) $requestPath), '/');
if (str_contains($route, '..') || strlen($route) > 400) { http_response_code(404); header('X-Robots-Tag: noindex'); exit; }
$catalogue = om_products();
header('Cache-Control: no-cache, max-age=0, must-revalidate');
header('X-Content-Type-Options: nosniff');
if ($route === 'sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $urls = (array) $registry['indexablePages'];
    foreach ($catalogue as $product) $urls[] = $site . om_seo_product_path($product);
    $xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    foreach (array_unique($urls) as $url) $xml .= '<url><loc>' . om_seo_escape($url) . '</loc></url>';
    if ($method !== 'HEAD') echo $xml . '</urlset>';
    exit;
}
$productId = str_starts_with($route, 'syze-dielli/') || str_starts_with($route, 'syze-optike/') ? rawurldecode(substr($route, strpos($route, '/') + 1)) : ($route === 'shop' ? trim((string) ($_GET['product'] ?? '')) : '');
$product = null;
if ($productId !== '') {
    foreach ($catalogue as $candidate) if ((string) $candidate['id'] === $productId) { $product = $candidate; break; }
    if (!$product) { http_response_code(404); header('Content-Type: text/html; charset=utf-8'); header('X-Robots-Tag: noindex, follow'); if ($method !== 'HEAD') readfile($root . '/404.html'); exit; }
    $path = om_seo_product_path($product);
    $queryUrl = $requestPath . (isset($_GET['product']) ? '?product=' . rawurlencode((string) $_GET['product']) : '');
    if ($queryUrl !== $path) {
        $languageQuery = in_array($_GET['lang'] ?? '', ['sq', 'en'], true) ? '?lang=' . $_GET['lang'] : '';
        http_response_code(301); header('Location: ' . $path . $languageQuery); exit;
    }
    $image = om_seo_image((string) ($product['image'] ?? '/og.png'));
    $jpeg = preg_replace('#^/assets/products/([^/]+)\.webp$#', '/assets/social/$1.jpg', $image);
    if (is_file($root . $jpeg)) $image = $jpeg;
    $metadata = ['site' => $site, 'title' => om_seo_product_title($product), 'description' => ($product['metaDescription'] ?? '') ?: (($product['description'] ?? '') ?: $product['name'] . ' — shihni masat, ngjyrën dhe detajet e porosisë te Optika Miftari.'), 'canonical' => $site . $path, 'image' => $site . $image];
    $html = (string) file_get_contents(__DIR__ . '/seo-template.html');
} else {
    $definition = $registry['pages']['/' . $route] ?? null;
    if (!$definition) { http_response_code(404); header('X-Robots-Tag: noindex'); exit; }
    $metadata = $definition;
    $metadata['site'] = $site;
    $content = om_public_content();
    if (in_array($route, ['laboratory/kosovo', 'laboratory/europe'], true)) {
        $imageKey = $route === 'laboratory/europe' ? 'labEuropeImage' : 'labKosovoImage';
        $image = (string) ($content[$imageKey] ?? '');
        if (preg_match('#^/(?:assets|uploads)/[a-zA-Z0-9_/-]+\.(?:webp|png|jpe?g)$#i', $image)) $metadata['image'] = $site . $image;
    }
    if (!empty($definition['contentKey'])) {
        $key = $definition['contentKey'];
        $metadata['title'] = trim((string) ($content[$key . 'SeoTitle'] ?? '')) ?: $definition['title'];
        $metadata['description'] = trim((string) ($content[$key . 'SeoDescription'] ?? '')) ?: $definition['description'];
    }
    $html = (string) file_get_contents($root . ($route === '' ? '/index.html' : '/' . $route . '/index.html'));
    // The catalogue seen without JavaScript must also exclude drafts/removals.
    if (in_array($route, ['optical', 'shop', 'sunglasses', 'prescription-glasses'], true)) {
        $cards = '';
        foreach ($catalogue as $item) {
            $sun = ($item['type'] ?? '') === 'Sunglasses';
            if (($route === 'sunglasses' && !$sun) || ($route === 'prescription-glasses' && $sun)) continue;
            $cards .= '<article><a href="' . om_seo_escape(om_seo_product_path($item)) . '"><img width="480" height="360" loading="lazy" src="' . om_seo_escape(om_seo_image((string) ($item['image'] ?? ''))) . '" alt="' . om_seo_escape($item['name']) . ', imazh ilustrues" /><h2>' . om_seo_escape($item['name']) . '</h2><p>' . number_format((float) (($item['salePrice'] ?? null) ?: ($item['price'] ?? 0)), 2, ',', '.') . ' €</p></a></article>';
        }
        $html = preg_replace_callback('#<section class="static-product-grid"[^>]*>.*?</section>#s', static fn() => '<section class="static-product-grid" aria-label="Katalogu">' . ($cards ?: '<p>Aktualisht nuk ka modele të publikuara. Kontaktoni optikën për informacion.</p>') . '</section>', $html, 1);
    }
    if (!empty($definition['contentKey'])) {
        $key = $definition['contentKey'] === 'home' ? '' : $definition['contentKey'];
        $headingKey = $key === '' ? 'title' : $key . 'Title';
        $copyKey = $key === '' ? 'subtitle' : $key . 'Subtitle';
        if (!empty($content[$headingKey])) $html = str_replace('<h1>' . om_seo_escape($definition['heading']) . '</h1>', '<h1>' . om_seo_escape($content[$headingKey]) . '</h1>', $html);
        if (!empty($content[$copyKey])) $html = str_replace('<p>' . om_seo_escape($definition['copy']) . '</p>', '<p>' . om_seo_escape($content[$copyKey]) . '</p>', $html);
    }
}
header('Content-Type: text/html; charset=utf-8');
if ($method !== 'HEAD') echo om_seo_render($html, $metadata, $product, $catalogue);
