<?php
declare(strict_types=1);

// Public presentation only: no account, order, session or write operations.
function om_seo_escape($value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function om_seo_product_path(array $product): string {
    $id = (string) $product['id'];
    if (!preg_match('/^[a-z0-9][a-z0-9_-]{0,199}$/i', $id)) return '/shop/?product=' . rawurlencode($id);
    return '/' . (($product['type'] ?? '') === 'Sunglasses' ? 'syze-dielli' : 'syze-optike') . '/' . rawurlencode($id) . '/';
}
function om_seo_product_title(array $product): string {
    $title = trim((string) ($product['seoTitle'] ?? '')) ?: (string) $product['name'] . ' · ' . (($product['type'] ?? '') === 'Sunglasses' ? 'Syze dielli' : 'Syze me dioptri');
    return str_contains($title, 'Optika Miftari') ? $title : $title . ' | Optika Miftari';
}
function om_seo_image(string $value): string {
    // Uploaded media stays on the same host. No arbitrary external embeds.
    return preg_match('#^/(?:assets|uploads)/[a-zA-Z0-9_./-]+$#', $value) && !str_contains($value, '..') ? $value : '/og.png';
}
function om_seo_product_body(array $product, array $catalogue): string {
    $e = 'om_seo_escape';
    $path = ($product['type'] ?? '') === 'Sunglasses' ? '/sunglasses/' : '/prescription-glasses/';
    $category = ($product['type'] ?? '') === 'Sunglasses' ? 'Syze dielli' : 'Syze me dioptri';
    $price = number_format((float) (($product['salePrice'] ?? null) ?: ($product['price'] ?? 0)), 2, ',', '.') . ' €';
    $image = om_seo_image((string) ($product['image'] ?? ''));
    $body = '<header class="static-site-header"><a class="static-brand" href="/">OPTIKA MIFTARI</a><nav aria-label="Navigimi kryesor"><a href="/optical/">Optical</a><a href="/laboratory/">Optical Lab</a><a href="/clinic/">Klinika Miftari</a><a href="/contact/">Kontakt</a></nav></header><main class="static-product-page"><nav class="static-breadcrumb" aria-label="Rruga e faqes"><a href="/">Ballina</a> › <a href="' . $path . '">' . $category . '</a></nav><section class="static-product-above-fold"><div class="static-product-gallery"><img width="900" height="700" fetchpriority="high" src="' . $e($image) . '" alt="' . $e($product['name']) . ', imazh ilustrues i modelit" /></div><div class="static-product-summary"><h1>' . $e($product['name']) . '</h1><p>' . $e($product['description'] ?? '') . '</p><p class="static-product-price">' . $price . '</p><p class="static-stock">' . ((int) ($product['stock'] ?? 0) > 0 ? 'Në stok' : 'Aktualisht nuk ka stok') . '</p><p>Aktivizoni JavaScript për konfigurimin dhe shportën, ose <a href="tel:+38343777667">kontaktoni optikën</a>.</p><p>' . $e($product['delivery'] ?? 'Afati dhe kostoja konfirmohen para porosisë.') . '</p><a href="/policies/#returns">Kushtet e kthimit</a></div></section><section class="static-product-details"><h2>Masat dhe specifikat</h2><dl>';
    foreach (['sku' => 'SKU', 'material' => 'Materiali', 'color' => 'Ngjyra', 'size' => 'Masa', 'lensType' => 'Lentja', 'uv' => 'Mbrojtja', 'care' => 'Kujdesi'] as $field => $label) {
        if (!empty($product[$field])) $body .= '<div><dt>' . $label . '</dt><dd>' . $e($product[$field]) . '</dd></div>';
    }
    $body .= '</dl></section><section class="static-product-variants"><h2>Variantet e modelit</h2>';
    $family = $product['baseId'] ?? $product['id'];
    foreach ($catalogue as $variant) if (($variant['baseId'] ?? $variant['id']) === $family) $body .= '<a href="' . $e(om_seo_product_path($variant)) . '">' . $e($variant['name']) . '</a>';
    return $body . '</section></main><footer class="static-site-footer"><strong>Optika Miftari</strong><p>Mbretëresha Teutë 182, 40000 Mitrovicë · +383 43 777 667</p><a href="/contact/">Kontakt dhe rezervime</a></footer>';
}

function om_seo_render(string $html, array $metadata, ?array $product = null, array $catalogue = []): string {
    $e = 'om_seo_escape';
    $html = preg_replace_callback('#<title>.*?</title>#s', static fn() => '<title>' . $e($metadata['title']) . '</title>', $html, 1);
    $values = ['description' => $metadata['description'], 'og:title' => $metadata['title'], 'twitter:title' => $metadata['title'], 'og:description' => $metadata['description'], 'twitter:description' => $metadata['description'], 'og:url' => $metadata['canonical'], 'og:image' => $metadata['image'], 'twitter:image' => $metadata['image'], 'og:image:alt' => $product ? $product['name'] . ', pamja e produktit' : $metadata['title']];
    if ($product) $values += ['product:price:amount' => (string) (($product['salePrice'] ?? null) ?: ($product['price'] ?? 0)), 'product:price:currency' => 'EUR', 'product:availability' => (int) ($product['stock'] ?? 0) > 0 ? 'in stock' : 'out of stock'];
    foreach ($values as $key => $value) {
        $pattern = '#<meta\b[^>]*(?:name|property)="' . preg_quote($key, '#') . '"[^>]*>#';
        $html = preg_replace_callback($pattern, static fn() => '<meta ' . (str_starts_with($key, 'og:') || str_starts_with($key, 'product:') ? 'property' : 'name') . '="' . $key . '" content="' . $e($value) . '" />', $html, 1);
    }
    $html = preg_replace_callback('#<link\b[^>]*rel="canonical"[^>]*>#', static fn() => '<link rel="canonical" href="' . $e($metadata['canonical']) . '" />', $html, 1);
    $html = preg_replace_callback('#<script\b[^>]*id="optika-prerendered-structured-data"[^>]*>(.*?)</script>#s', static function ($match) use ($metadata, $product) {
        $schema = json_decode($match[1], true);
        if (!is_array($schema)) return '';
        foreach ($schema['@graph'] as &$entity) {
            if (($entity['@type'] ?? '') === 'WebPage') {
                $entity['name'] = $metadata['title']; $entity['description'] = $metadata['description']; $entity['url'] = $metadata['canonical']; $entity['@id'] = $metadata['canonical'] . '#webpage';
                $entity['primaryImageOfPage']['url'] = $metadata['image'];
                $entity['breadcrumb']['@id'] = $metadata['canonical'] . '#breadcrumb';
                if ($product) $entity['mainEntity']['@id'] = $metadata['canonical'] . '#product';
            }
            if ($product && ($entity['@type'] ?? '') === 'Product') {
                $entity['@id'] = $metadata['canonical'] . '#product';
                $entity['category'] = ($product['type'] ?? '') === 'Sunglasses' ? 'Syze dielli' : 'Syze me dioptri';
                $entity['name'] = $product['name']; $entity['description'] = $metadata['description']; $entity['sku'] = $product['sku'] ?? $product['id'];
                foreach (['color', 'material'] as $field) { if (isset($product[$field])) $entity[$field] = $product[$field]; else unset($entity[$field]); }
                $images = array_filter((array) ($product['gallery'] ?? [$product['image'] ?? '/og.png']));
                if (!$images) $images = [$product['image'] ?? '/og.png'];
                $entity['image'] = array_values(array_map(static fn($image) => $metadata['site'] . om_seo_image((string) $image), $images));
                unset($entity['brand']);
                if (!empty($product['brand'])) $entity['brand'] = ['@type' => 'Brand', 'name' => $product['brand']];
                $entity['offers']['url'] = $metadata['canonical']; $entity['offers']['price'] = (float) (($product['salePrice'] ?? null) ?: ($product['price'] ?? 0));
                $entity['offers']['availability'] = (int) ($product['stock'] ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
            }
            if (($entity['@type'] ?? '') === 'BreadcrumbList') {
                $entity['@id'] = $metadata['canonical'] . '#breadcrumb';
                $last = count($entity['itemListElement']) - 1;
                $entity['itemListElement'][$last]['item'] = $metadata['canonical'];
                $entity['itemListElement'][$last]['name'] = $product['name'] ?? explode('|', $metadata['title'])[0];
                if ($product) {
                    $sun = ($product['type'] ?? '') === 'Sunglasses';
                    $entity['itemListElement'][1]['name'] = $sun ? 'Syze dielli' : 'Syze me dioptri';
                    $entity['itemListElement'][1]['item'] = $metadata['site'] . ($sun ? '/sunglasses/' : '/prescription-glasses/');
                }
            }
        }
        return '<script id="optika-prerendered-structured-data" type="application/ld+json">' . json_encode($schema, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>';
    }, $html, 1);
    if ($product) $html = preg_replace_callback('#<div id="root">.*?</div>\s*<script>window\.dataLayer#s', static fn() => '<div id="root">' . om_seo_product_body($product, $catalogue) . '</div><script>window.dataLayer', $html, 1);
    return $html;
}
