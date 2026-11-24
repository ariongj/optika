<?php
// Miftari Vision API — what search engines and link previews read, for the pages whose content lives in the shop
// database: products, categories, collections, offers, CMS pages and articles, plus /sitemap.xml.
//
// The release has a built page (<route>/index.html) for every route known at build time (scripts/prerender-meta.mjs).
// Products and articles are added, renamed, hidden and removed in the CMS after that, so the web root's .htaccess sends
// these routes here: the built page (or the generic 404.html shell) gets the head the current data calls for: title,
// description, canonical address, robots, Open Graph / Twitter tags and JSON-LD, with HTTP 200; a route with nothing
// published behind it answers 404. The rules mirror the build script, so a page reads the same either way.
//
// The canonical host comes from the built sitemap (the --site address the release was packaged for), never from the
// request's Host header.
declare(strict_types=1);

const MV_SEO_KINDS = ['produkt', 'produktet', 'koleksioni', 'oferta', 'faqe', 'keshilla'];

function mv_seo_root(): string
{
    return dirname(__DIR__, 2);
}

/** Absolute URLs of the built sitemap (static pages first). */
function mv_seo_static_urls(): array
{
    $xml = @file_get_contents(mv_seo_root() . '/sitemap.xml');
    if (!is_string($xml)) return [];
    preg_match_all('#<loc>([^<]+)</loc>#', $xml, $m);
    return array_map(fn($u) => html_entity_decode($u, ENT_QUOTES | ENT_XML1, 'UTF-8'), $m[1]);
}

/** "https://example.com/" — the site address the release was built for. */
function mv_seo_home(): string
{
    static $home = null;
    if (is_string($home)) return $home;
    // the build lists the home page first
    $first = mv_seo_static_urls()[0] ?? '';
    if (preg_match('#^https?://[^/?\#]+/(?:[^?\#]*/)?$#', $first)) {
        $home = $first;
    } else {
        $home = (mv_https() ? 'https://' : 'http://') . preg_replace('/[^A-Za-z0-9.:-]/', '', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost')) . '/';
    }
    return $home;
}

function mv_seo_abs(string $p = ''): string
{
    if (preg_match('#^https?://#', $p)) return $p;
    return mv_seo_home() . ltrim($p, '/');
}

function mv_seo_l($v): string
{
    if (is_array($v)) return (string) ($v['sq'] ?? $v['en'] ?? $v['me'] ?? '');
    return is_scalar($v) ? (string) $v : '';
}

/** Markdown-ish text → one plain line (same rules as the build script). */
function mv_seo_plain($v): string
{
    $t = str_replace('*', '', mv_seo_l($v));
    $t = preg_replace('/\[([^\]]+)\]\([^)]*\)/u', '$1', $t) ?? $t;
    $t = preg_replace('/^#+\s*/mu', '', $t) ?? $t;
    $t = preg_replace('/^[>-]\s*/mu', '', $t) ?? $t;
    return trim(preg_replace('/\s+/u', ' ', $t) ?? $t);
}

function mv_seo_clip($v, int $n = 158): string
{
    $t = mv_seo_plain($v);
    if (mb_strlen($t) <= $n) return $t;
    return (preg_replace('/\s+\S*$/u', '', mb_substr($t, 0, $n - 1)) ?? '') . '…';
}

function mv_seo_esc($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Published documents of a list, each with the date it last changed. */
function mv_seo_docs(string $col): array
{
    $q = mv_db()->prepare('SELECT data, updated_at FROM docs WHERE col = ? AND deleted = 0 ORDER BY pos, id');
    $q->execute([$col]);
    $out = [];
    foreach ($q->fetchAll(PDO::FETCH_NUM) as [$raw, $at]) {
        $v = json_decode((string) $raw, true);
        if (!is_array($v) || !is_string($v['slug'] ?? null) || $v['slug'] === '') continue;
        $live = match ($col) {
            'products' => ($v['status'] ?? '') === 'active',
            'offers' => ($v['status'] ?? 'draft') !== 'draft',
            'collections', 'pages', 'posts' => !empty($v['published']),
            default => true,
        };
        if ($live) $out[] = $v + ['__at' => (string) $at];
    }
    return $out;
}

const MV_SEO_COLS = ['produkt' => 'products', 'produktet' => 'categories', 'koleksioni' => 'collections', 'oferta' => 'offers', 'faqe' => 'pages', 'keshilla' => 'posts'];

/** BreadcrumbList for [[name, route], …] after the home page. */
function mv_seo_crumbs(array $trail): array
{
    $items = [];
    foreach (array_merge([['Ballina', '']], $trail) as $i => [$name, $route]) {
        $items[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => mv_seo_plain($name), 'item' => mv_seo_abs($route === '' ? '' : "$route/")];
    }
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items];
}

/** The 1200×630 JPG made for link previews (og/<dir>-<name>.jpg) when there is one, else the picture itself. */
function mv_seo_image(string $img): string
{
    $rel = ltrim($img, '/');
    if (preg_match('#^images/(.+)\.webp$#', $rel, $m)) {
        $og = 'og/' . str_replace('/', '-', $m[1]) . '.jpg';
        if (is_file(mv_seo_root() . "/$og")) return mv_seo_abs($og);
    }
    return mv_seo_abs($rel);
}

/** What one route shows search engines, or null when nothing published is there. */
function mv_seo_meta(string $kind, string $slug): ?array
{
    $settings = mv_single('settings');
    $brand = is_array($settings) && !empty($settings['companyName']) ? (string) $settings['companyName'] : 'Miftari Vision';
    $titled = fn(string $t) => mv_seo_plain($t) . " · $brand";
    $fit = fn(string $main, string $detail) => $detail !== '' && mb_strlen($titled("$main — $detail")) <= 65 ? "$main — $detail" : $main;
    $find = function (string $col) use ($slug): ?array {
        foreach (mv_seo_docs($col) as $d) if ($d['slug'] === $slug) return $d;
        return null;
    };
    $route = "$kind/$slug";

    switch ($kind) {
        case 'produktet':
            $c = $find('categories');
            if (!$c) return null;
            return ['title' => $fit(mv_seo_l($c['name'] ?? ''), mv_seo_l($c['tagline'] ?? '')), 'description' => $c['description'] ?? '', 'image' => (string) ($c['image'] ?? ''),
                'jsonld' => [mv_seo_crumbs([['Produktet', 'produktet'], [mv_seo_l($c['name'] ?? ''), $route]])], 'photo' => (string) ($c['image'] ?? '')];
        case 'produkt':
            $all = mv_seo_docs('products');
            $p = null;
            $shorts = [];
            foreach ($all as $d) {
                $k = mv_seo_plain($d['short'] ?? '');
                $shorts[$k] = ($shorts[$k] ?? 0) + 1;
                if ($d['slug'] === $slug) $p = $d;
            }
            if (!$p) return null;
            $cat = null;
            foreach (mv_seo_docs('categories') as $c) if (($c['id'] ?? null) === ($p['categoryId'] ?? '')) $cat = $c;
            $catName = $cat ? mv_seo_l($cat['name'] ?? '') : '';
            $name = mv_seo_l($p['name'] ?? '');
            $short = mv_seo_plain($p['short'] ?? '');
            // read from the database on every request, so the price stated here is the one the page shows (src/lib/pricing.ts
            // basePrice: the sale price when it is below the regular one); "price on request" listings state none
            $price = (float) ($p['price'] ?? 0);
            $sale = isset($p['salePrice']) && is_numeric($p['salePrice']) ? (float) $p['salePrice'] : 0.0;
            $shown = $sale > 0 && $sale < $price ? $sale : $price;
            $onRequest = !empty($p['quoteOnly']) && !($price > 0);
            $amount = rtrim(rtrim(number_format($shown, 2, '.', ''), '0'), '.');
            $tail = $onRequest ? ' Çmimi sipas kërkesës' : ($shown > 0 ? " $amount €" : '');
            $desc = mv_seo_l($p['seo']['description'] ?? '') ?: trim((($shorts[$short] ?? 0) > 1 ? mv_seo_plain($name) . '. ' : '') . $short . $tail) . " · $brand, Mitrovicë.";
            $images = array_values(array_filter(array_map('strval', is_array($p['images'] ?? null) ? $p['images'] : []), fn($i) => $i !== ''));
            $product = ['@context' => 'https://schema.org', '@type' => 'Product', 'name' => $name, 'sku' => (string) ($p['sku'] ?? ''),
                'brand' => ['@type' => 'Brand', 'name' => (string) (($p['vendor'] ?? '') ?: $brand)], 'description' => mv_seo_plain($p['description'] ?? ''),
                'image' => array_map('mv_seo_abs', $images)] + ($catName !== '' ? ['category' => $catName] : []);
            if (!$onRequest && $shown > 0) {
                $product['offers'] = ['@type' => 'Offer', 'price' => $amount, 'priceCurrency' => 'EUR',
                    'availability' => (float) ($p['stock'] ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
                    'url' => mv_seo_abs("$route/"), 'seller' => ['@type' => 'Organization', 'name' => $brand]];
            }
            $trail = $cat ? [[$catName, 'produktet/' . $cat['slug']]] : [];
            $trail[] = [$name, $route];
            return ['title' => mv_seo_l($p['seo']['title'] ?? '') ?: $fit($name, $catName), 'description' => $desc, 'image' => $images[0] ?? '', 'type' => 'product',
                'jsonld' => [$product, mv_seo_crumbs($trail)], 'photo' => $images[0] ?? ''];
        case 'koleksioni':
            $c = $find('collections');
            if (!$c) return null;
            return ['title' => mv_seo_l($c['seo']['title'] ?? '') ?: mv_seo_l($c['title'] ?? ''), 'description' => mv_seo_l($c['seo']['description'] ?? '') ?: ($c['description'] ?? ''), 'image' => (string) ($c['image'] ?? ''), 'jsonld' => []];
        case 'oferta':
            $o = $find('offers');
            if (!$o) return null;
            return ['title' => mv_seo_l($o['landing']['title'] ?? '') ?: mv_seo_l($o['name'] ?? ''), 'description' => mv_seo_l($o['landing']['text'] ?? '') ?: ($o['description'] ?? ''), 'image' => (string) ($o['image'] ?? ''), 'jsonld' => []];
        case 'faqe':
            $pg = $find('pages');
            if (!$pg) return null;
            return ['title' => mv_seo_l($pg['seo']['title'] ?? '') ?: mv_seo_l($pg['title'] ?? ''), 'description' => mv_seo_l($pg['seo']['description'] ?? '') ?: ($pg['body'] ?? ''), 'image' => '/images/misc/contact.webp', 'jsonld' => []];
        case 'keshilla':
            $po = $find('posts');
            if (!$po) return null;
            $title = mv_seo_l($po['title'] ?? '');
            $article = ['@context' => 'https://schema.org', '@type' => 'Article', 'headline' => mv_seo_plain($title), 'description' => mv_seo_plain($po['excerpt'] ?? ''),
                'image' => mv_seo_abs((string) ($po['cover'] ?? '')), 'datePublished' => (string) ($po['publishedAt'] ?? ''),
                'author' => ['@type' => 'Organization', 'name' => (string) (($po['author'] ?? '') ?: $brand)],
                'publisher' => ['@type' => 'Organization', 'name' => $brand, 'logo' => ['@type' => 'ImageObject', 'url' => mv_seo_abs('icon-512.png')]]];
            return ['title' => mv_seo_l($po['seo']['title'] ?? '') ?: $title, 'description' => mv_seo_l($po['seo']['description'] ?? '') ?: ($po['excerpt'] ?? ''), 'image' => (string) ($po['cover'] ?? ''), 'type' => 'article', 'jsonld' => [$article, mv_seo_crumbs([['Këshilla', 'keshilla'], [$title, $route]])]];
    }
    return null;
}

/** The page HTML: the built page for this route (or the generic shell) with the head rewritten from $m. */
function mv_seo_render(string $route, array $m): string
{
    $root = mv_seo_root();
    $built = "$root/$route/index.html";
    $html = is_file($built) ? (string) file_get_contents($built) : '';
    // a built product or category page draws its photo before the app runs; if the photo has changed since, use the plain shell
    if ($html !== '' && !empty($m['photo']) && !str_contains($html, ltrim((string) $m['photo'], '/'))) $html = '';
    if ($html === '') $html = (string) file_get_contents("$root/404.html");

    $brand = 'Miftari Vision';
    $settings = mv_single('settings');
    if (is_array($settings) && !empty($settings['companyName'])) $brand = (string) $settings['companyName'];
    $url = mv_seo_abs("$route/");
    $title = mv_seo_plain($m['title']) . " · $brand";
    if (mb_strlen($title) > 70) $title = mv_seo_plain($m['title']); // a long title keeps its own words, not the brand
    $desc = mv_seo_clip($m['description']);
    $image = mv_seo_image((string) ($m['image'] ?: '/images/hero/optical.webp'));
    $type = $m['type'] ?? 'website';
    $e = 'mv_seo_esc';
    $head = [
        "<title>{$e($title)}</title>",
        "<meta name=\"description\" content=\"{$e($desc)}\" />",
        "<link rel=\"canonical\" href=\"{$e($url)}\" />",
        '<meta name="robots" content="index, follow" />',
        "<meta property=\"og:site_name\" content=\"{$e($brand)}\" />",
        '<meta property="og:locale" content="sq_AL" />',
        "<meta property=\"og:type\" content=\"{$e($type)}\" />",
        "<meta property=\"og:title\" content=\"{$e($title)}\" />",
        "<meta property=\"og:description\" content=\"{$e($desc)}\" />",
        "<meta property=\"og:url\" content=\"{$e($url)}\" />",
        "<meta property=\"og:image\" content=\"{$e($image)}\" />",
        '<meta name="twitter:card" content="summary_large_image" />',
        "<meta name=\"twitter:title\" content=\"{$e($title)}\" />",
        "<meta name=\"twitter:description\" content=\"{$e($desc)}\" />",
        "<meta name=\"twitter:image\" content=\"{$e($image)}\" />",
    ];
    foreach ($m['jsonld'] as $j) {
        $head[] = '<script type="application/ld+json">' . str_replace('<', '<', (string) json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)) . '</script>';
    }
    $strip = ['#\s*<title>.*?</title>#s', '#\s*<meta name="description"[^>]*>#', '#\s*<meta property="og:[^>]*>#', '#\s*<meta name="twitter:[^>]*>#',
        '#\s*<link rel="canonical"[^>]*>#', '#\s*<meta name="robots"[^>]*>#', '#\s*<script type="application/ld\+json">.*?</script>#s'];
    $html = preg_replace($strip, '', $html) ?? $html;
    return preg_replace('#</head>#', '    ' . implode("\n    ", $head) . "\n  </head>", $html, 1) ?? $html;
}

function mv_seo_send(int $status, string $type, string $body): never
{
    http_response_code($status);
    header("Content-Type: $type");
    header('Cache-Control: no-cache');
    header('X-Content-Type-Options: nosniff');
    header_remove('X-Powered-By');
    if (mv_method() !== 'HEAD') echo $body;
    exit;
}

/** GET /<kind>/<slug>/ (rewritten here by the web root's .htaccess). */
function mv_route_seo_page(): never
{
    $p = trim((string) ($_GET['p'] ?? ''), '/');
    $parts = explode('/', $p);
    $root = mv_seo_root();
    $notFound = fn() => mv_seo_send(404, 'text/html; charset=utf-8', (string) @file_get_contents("$root/404.html"));
    if (count($parts) !== 2 || !in_array($parts[0], MV_SEO_KINDS, true) || !preg_match('/^[A-Za-z0-9_-]{1,120}$/', $parts[1])) $notFound();
    // one address per page: the canonical one ends in "/" (as Apache's own directory redirect would do)
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
    $path = (string) parse_url($uri, PHP_URL_PATH);
    if (!str_ends_with($path, '/')) {
        $q = parse_url($uri, PHP_URL_QUERY);
        header('Location: ' . $path . '/' . (is_string($q) && $q !== '' ? "?$q" : ''), true, 301);
        exit;
    }
    $m = mv_seo_meta($parts[0], $parts[1]);
    if ($m === null) $notFound();
    mv_seo_send(200, 'text/html; charset=utf-8', mv_seo_render($p, $m));
}

/** GET /sitemap.xml: the built pages that don't come from the database, then everything published in it. */
function mv_route_sitemap(): never
{
    $rows = [];
    $home = mv_seo_home();
    foreach (mv_seo_static_urls() as $u) {
        $rel = str_starts_with($u, $home) ? substr($u, strlen($home)) : '';
        if (preg_match('#^(' . implode('|', MV_SEO_KINDS) . ')/[^/]+/$#', $rel)) continue;
        $rows[] = [$u, ''];
    }
    foreach (MV_SEO_COLS as $kind => $col) {
        foreach (mv_seo_docs($col) as $d) {
            $at = substr((string) $d['__at'], 0, 10);
            $rows[] = [mv_seo_abs("$kind/{$d['slug']}/"), preg_match('/^\d{4}-\d{2}-\d{2}$/', $at) ? $at : ''];
        }
    }
    $seen = [];
    $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
    foreach ($rows as [$loc, $at]) {
        if (isset($seen[$loc])) continue;
        $seen[$loc] = true;
        $xml .= '  <url><loc>' . htmlspecialchars($loc, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</loc>' . ($at !== '' ? "<lastmod>$at</lastmod>" : '') . "</url>\n";
    }
    mv_seo_send(200, 'application/xml; charset=utf-8', $xml . "</urlset>\n");
}
