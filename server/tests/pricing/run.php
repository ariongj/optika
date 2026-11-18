<?php
// PHP side of diff.mjs: prices every case of a cases file with server/api/lib/pricing.php, one JSON result per line.
//   php run.php <cases.ndjson> <results.ndjson>
// Line 1 of the cases file holds the shared pools; every other line is {cart, p, s, opts}, {normalize: [...]}
// or {alloc: [[total, weights], ...]}. opts.discounts / collections / coupons may be {"$pool": n}.
declare(strict_types=1);

require __DIR__ . '/../../api/lib/pricing.php';

ini_set('serialize_precision', '-1');
[, $inFile, $outFile] = $argv + [null, null, null];
if (!$inFile || !$outFile) {
    fwrite(STDERR, "usage: php run.php <cases.ndjson> <results.ndjson>\n");
    exit(2);
}
$in = fopen($inFile, 'rb');
$out = fopen($outFile, 'wb');
$pools = json_decode((string) fgets($in), true, 512, JSON_THROW_ON_ERROR)['pools'];
$t0 = microtime(true);
$n = 0;
while (($line = fgets($in)) !== false) {
    if (trim($line) === '') continue;
    $c = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
    try {
        if (array_key_exists('normalize', $c)) {
            $r = array_map(fn(string $s): string => mvp_normalize_code($s), $c['normalize']);
        } elseif (array_key_exists('alloc', $c)) {
            $r = array_map(fn(array $a): array => mvp_allocate_cents((float) $a[0], array_map('floatval', $a[1])), $c['alloc']);
        } else {
            $opts = $c['opts'];
            foreach (['discounts', 'collections', 'coupons'] as $k) {
                if (is_array($opts[$k] ?? null) && array_key_exists('$pool', $opts[$k])) $opts[$k] = $pools[$k][$opts[$k]['$pool']];
            }
            $r = mvp_price_cart($c['cart'], $pools['products'][$c['p']], $pools['settings'][$c['s']], $opts);
        }
        $json = json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        $json = json_encode(['__error' => get_class($e) . ': ' . $e->getMessage() . ' (line ' . $e->getLine() . ')']);
    }
    fwrite($out, $json . "\n");
    $n++;
}
fclose($out);
fwrite(STDERR, sprintf("php: %d cases in %.1f s (PHP %s, extensions: %s, intl %s)\n", $n, microtime(true) - $t0, PHP_VERSION, implode(' ', get_loaded_extensions()), extension_loaded('intl') ? 'LOADED' : 'not loaded'));
