<?php
/**
 * Cart pricing + discount engine: a PHP port of priceCart() in src/lib/pricing.ts and of everything it reaches
 * (src/lib/discounts.ts, collectionIdsFor() in src/lib/collections.ts, lt() in src/i18n, round2() in src/lib/utils.ts),
 * so the API re-prices a web order exactly like the shop page did.
 *
 *   $totals = mvp_price_cart($cart, $products, $settings, $opts);
 *
 * Inputs are json_decode($json, true) versions of the TS values (same keys). $opts mirrors PriceCartOptions:
 * lang, codes, couponCode, discounts, collections, coupons, delivery, city, now, customer — `now` is epoch ms
 * (int/float) or an ISO string, a missing `now` means the current time. A missing key behaves like `undefined`
 * in the TS, null like null. The result is the TS `Totals` as JSON carries it (keys the TS leaves undefined are
 * absent, NaN/Infinity become null, -0 becomes 0), except that each line has `productId` instead of `product`.
 *
 * Exactness (money): every number is a PHP float, i.e. an IEEE double like a JS number, and every operation runs
 * in the same order as in the TS. Math.round/min/max, Number(), String(), trim/toUpperCase/toLowerCase, \s,
 * Array.includes, the stable sorts, Date.parse and the NFD/NFKD folding are re-implemented with JS semantics
 * (Unicode folding through generated tables at the end of this file: no intl needed, mbstring is).
 * server/tests/pricing/diff.mjs compares this file with the TS engine on thousands of random carts:
 * re-run it (node server/tests/pricing/diff.mjs) after any change here or in the TS files above.
 *
 * Not mirrored on purpose (the TS would throw or concatenate strings): values of the wrong type, e.g. a string
 * qty/price/priceDelta, non-string codes or ids; strings are coerced with Number() semantics instead.
 * Date strings: the ES date-time format as V8 reads it (also `t`/`z`, ' ' before the time, +HHMM offsets);
 * a date-time without offset is local time = PHP's default time zone. Other legacy formats give NaN.
 *
 * PHP 8.1+, needs mbstring. Every function is prefixed mvp_; no global state.
 */
declare(strict_types=1);

/* ================================================================== */
/* JS semantics                                                        */
/* ================================================================== */

/** JS truthiness of a JSON value (objects and arrays are truthy, even empty ones). */
function mvp_truthy($v): bool
{
    if (is_bool($v)) return $v;
    if ($v === null) return false;
    if (is_string($v)) return $v !== '';
    if (is_int($v)) return $v !== 0;
    if (is_float($v)) return !($v == 0.0 || is_nan($v));
    return true;
}

/** Number(v) for a JSON value. */
function mvp_num($v): float
{
    if (is_float($v)) return $v;
    if (is_int($v)) return (float) $v;
    if (is_string($v)) return mvp_str_num($v);
    if ($v === null) return 0.0;
    if (is_bool($v)) return $v ? 1.0 : 0.0;
    if (is_array($v)) {
        // Number([]) is 0 (an empty {} would be NaN, json_decode cannot tell them apart); Number([x]) is Number(String(x))
        if (!$v) return 0.0;
        if (array_is_list($v) && count($v) === 1 && !is_array($v[0])) return $v[0] === null ? 0.0 : mvp_str_num(mvp_str($v[0]));
    }
    return NAN;
}

/** Number(a[k]): a missing key is `undefined`, i.e. NaN (null is 0). */
function mvp_numk(array $a, string $k): float
{
    return array_key_exists($k, $a) ? mvp_num($a[$k]) : NAN;
}

/** StringToNumber: JS whitespace trimmed; decimal, Infinity and 0x/0o/0b literals; anything else NaN. */
function mvp_str_num(string $s): float
{
    $t = mvp_trim($s);
    if ($t === '') return 0.0;
    if (preg_match('/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?\z/', $t)) return (float) $t;
    if (preg_match('/^([+-]?)Infinity\z/', $t, $m)) return $m[1] === '-' ? -INF : INF;
    if (preg_match('/^0([xXoObB])([0-9a-fA-F]+)\z/', $t, $m)) {
        $base = ['x' => 16, 'o' => 8, 'b' => 2][strtolower($m[1])];
        $r = 0.0;
        foreach (str_split(strtolower($m[2])) as $ch) {
            $d = (int) strpos('0123456789abcdef', $ch);
            if ($d >= $base) return NAN;
            $r = $r * $base + $d;
        }
        return $r;
    }
    return NAN;
}

/** String(v), also what a template literal prints. */
function mvp_str($v): string
{
    if (is_string($v)) return $v;
    if ($v === null) return 'null';
    if (is_bool($v)) return $v ? 'true' : 'false';
    if (is_int($v) || is_float($v)) return mvp_num_str((float) $v);
    if (is_array($v) && array_is_list($v)) return implode(',', array_map(fn($x) => $x === null ? '' : mvp_str($x), $v));
    return '[object Object]';
}

/** Number.prototype.toString(): shortest round-trip digits, JS exponent rules. */
function mvp_num_str(float $x): string
{
    if (is_nan($x)) return 'NaN';
    if ($x == 0.0) return '0';
    if (is_infinite($x)) return $x > 0 ? 'Infinity' : '-Infinity';
    $sign = $x < 0 ? '-' : '';
    $a = abs($x);
    $e = '';
    for ($p = 0; $p < 17; $p++) {
        $e = sprintf('%.' . $p . 'e', $a);
        if ((float) $e === $a) break;
    }
    [$mant, $exp] = explode('e', $e);
    $digits = rtrim(str_replace('.', '', $mant), '0');
    if ($digits === '') $digits = '0';
    $k = strlen($digits);
    $n = (int) $exp + 1;
    if ($k <= $n && $n <= 21) return $sign . $digits . str_repeat('0', $n - $k);
    if (0 < $n && $n <= 21) return $sign . substr($digits, 0, $n) . '.' . substr($digits, $n);
    if (-6 < $n && $n <= 0) return $sign . '0.' . str_repeat('0', -$n) . $digits;
    $e2 = $n - 1;
    return $sign . $digits[0] . ($k > 1 ? '.' . substr($digits, 1) : '') . 'e' . ($e2 >= 0 ? '+' : '-') . abs($e2);
}

/** Math.round: the nearest integer, halves towards +Infinity (not PHP's round()). */
function mvp_round(float $x): float
{
    if (is_nan($x) || is_infinite($x)) return $x;
    $r = floor($x);
    return $x - $r >= 0.5 ? $r + 1.0 : $r;
}

/** round2() of src/lib/utils.ts */
function mvp_round2(float $n): float
{
    return mvp_round($n * 100) / 100;
}

/** Math.min(a, b) — NaN wins. */
function mvp_min(float $a, float $b): float
{
    if (is_nan($a) || is_nan($b)) return NAN;
    return $b < $a ? $b : $a;
}

/** Math.max(a, b) — NaN wins. */
function mvp_max(float $a, float $b): float
{
    if (is_nan($a) || is_nan($b)) return NAN;
    return $b > $a ? $b : $a;
}

/** Math.min(...list) (Infinity for an empty list). */
function mvp_min_list(array $xs): float
{
    $r = INF;
    foreach ($xs as $x) $r = mvp_min($r, $x);
    return $r;
}

/** JS whitespace (String.prototype.trim, \s): WhiteSpace + LineTerminator, as a regex class body. */
function mvp_ws(): string
{
    return '\x{0009}-\x{000D}\x{0020}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';
}

/** String.prototype.trim */
function mvp_trim(string $s): string
{
    $w = mvp_ws();
    return preg_replace('/^[' . $w . ']+|[' . $w . ']+\z/u', '', $s) ?? $s;
}

/** a === b for JSON values (two objects are never the same object). */
function mvp_eq($a, $b): bool
{
    if (is_string($a) || is_string($b)) return $a === $b;
    if ((is_int($a) || is_float($a)) && (is_int($b) || is_float($b))) return (float) $a == (float) $b;
    if (is_array($a) || is_array($b)) return false;
    return $a === $b;
}

/** Array.prototype.includes (SameValueZero); false for anything that is not a list. */
function mvp_includes($list, $v): bool
{
    if (!is_array($list)) return false;
    if (is_string($v)) return in_array($v, $list, true);
    foreach ($list as $x) {
        if (mvp_eq($x, $v)) return true;
        if (is_float($x) && is_float($v) && is_nan($x) && is_nan($v)) return true;
    }
    return false;
}

/** Same value of a property on two objects (=== with `undefined` for missing keys). */
function mvp_same_prop(array $a, array $b, string $k): bool
{
    $ha = array_key_exists($k, $a);
    $hb = array_key_exists($k, $b);
    if (!$ha || !$hb) return !$ha && !$hb;
    return mvp_eq($a[$k], $b[$k]);
}

/** Map key for a property value (Map uses SameValueZero; 'u' = undefined). Never a numeric string. */
function mvp_key(array $a, string $k = 'id'): string
{
    if (!array_key_exists($k, $a)) return 'u';
    $v = $a[$k];
    if (is_string($v)) return 's' . $v;
    if (is_int($v) || is_float($v)) return 'n' . ((float) $v == 0.0 ? '0' : mvp_num_str((float) $v));
    if ($v === null) return 'l';
    if (is_bool($v)) return $v ? 'T' : 'F';
    return 'o' . json_encode($v);
}

/** A JSON array (list) or [] — what `for…of`/`.map` over the TS value would walk. */
function mvp_list($v): array
{
    return is_array($v) && array_is_list($v) ? $v : [];
}

/** A code value as normalizeCode() receives it (null/undefined → null). */
function mvp_code_str($v): ?string
{
    if ($v === null || is_string($v)) return $v;
    return mvp_str($v);
}

/** JSON view of a result: NaN/±Infinity → null (JSON.stringify), -0 → 0. */
function mvp_jsonish($v)
{
    if (is_float($v)) {
        if (is_nan($v) || is_infinite($v)) return null;
        return $v == 0.0 ? 0.0 : $v;
    }
    if (is_array($v)) {
        foreach ($v as $k => $x) if (is_float($x) || is_array($x)) $v[$k] = mvp_jsonish($x);
    }
    return $v;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/** Days since 1970-01-01 of a proleptic Gregorian date (month 1–12). */
function mvp_days_from_civil(int $y, int $m, int $d): int
{
    $y -= $m <= 2 ? 1 : 0;
    $era = intdiv($y >= 0 ? $y : $y - 399, 400);
    $yoe = $y - $era * 400;
    $doy = intdiv(153 * ($m > 2 ? $m - 3 : $m + 9) + 2, 5) + $d - 1;
    $doe = $yoe * 365 + intdiv($yoe, 4) - intdiv($yoe, 100) + $doy;
    return $era * 146097 + $doe - 719468;
}

/** TimeClip */
function mvp_time_clip(float $t): float
{
    if (is_nan($t) || is_infinite($t) || abs($t) > 8.64e15) return NAN;
    return ($t < 0 ? ceil($t) : floor($t)) + 0.0;
}

/** Offset (ms) of PHP's default time zone for a local wall-clock time given as ms. */
function mvp_local_offset_ms(float $wall): float
{
    $tz = new DateTimeZone(date_default_timezone_get());
    $sec = (int) floor($wall / 1000);
    $off = $tz->getOffset(new DateTimeImmutable('@' . $sec));
    return $tz->getOffset(new DateTimeImmutable('@' . ($sec - $off))) * 1000.0;
}

/** Date.parse for the ES date-time string format, as V8 reads it (NaN for anything else). */
function mvp_date_parse(string $s): float
{
    if (!preg_match('/^([+-]\d{6}|\d{4})(?:-(\d\d)(?:-(\d\d))?)?(?:([Tt ])(\d\d):(\d\d)(?::(\d\d)(?:\.(\d+))?)?([Zz]|[+-]\d\d:?\d\d)?)?\z/', $s, $m, PREG_UNMATCHED_AS_NULL)) return NAN;
    if ($m[1] === '-000000') return NAN;
    $month = $m[2] !== null ? (int) $m[2] : 1;
    $day = $m[3] !== null ? (int) $m[3] : 1;
    if ($month < 1 || $month > 12 || $day < 1 || $day > 31) return NAN;
    $hasTime = $m[5] !== null;
    if ($hasTime && $m[4] === ' ' && $m[3] === null) return NAN;
    $h = $hasTime ? (int) $m[5] : 0;
    $mi = $hasTime ? (int) $m[6] : 0;
    $sec = $m[7] !== null ? (int) $m[7] : 0;
    $ms = $m[8] !== null ? (int) substr($m[8] . '00', 0, 3) : 0;
    if ($h > 24 || $mi > 59 || $sec > 59 || ($h === 24 && ($mi || $sec || $ms))) return NAN;
    // MakeDay lets day 31 of a short month roll over, like V8
    $t = (mvp_days_from_civil((int) $m[1], $month, 1) + $day - 1) * 86400000.0 + $h * 3600000.0 + $mi * 60000.0 + $sec * 1000.0 + $ms;
    $z = $m[9];
    if ($z !== null && $z !== 'Z' && $z !== 'z') {
        $oh = (int) substr($z, 1, 2);
        $om = (int) substr($z, -2);
        if ($oh > 23 || $om > 59) return NAN;
        $t -= ($z[0] === '-' ? -1 : 1) * ($oh * 3600000.0 + $om * 60000.0);
    } elseif ($z === null && $hasTime) {
        $t -= mvp_local_offset_ms($t);
    }
    return mvp_time_clip($t);
}

/** new Date(v).getTime() */
function mvp_date_value($v): float
{
    if (is_string($v)) return mvp_date_parse($v);
    if (is_array($v)) return mvp_date_parse(mvp_str($v));
    return mvp_time_clip(mvp_num($v));
}

/** time(opts.now) of src/lib/discounts.ts: missing = now, a number as is, anything else through new Date(). */
function mvp_now(array $opts): float
{
    if (!array_key_exists('now', $opts)) return floor(microtime(true) * 1000);
    $v = $opts['now'];
    if (is_int($v) || is_float($v)) return (float) $v;
    return mvp_date_value($v);
}

/* ------------------------------------------------------------------ */
/* Strings                                                             */
/* ------------------------------------------------------------------ */

/** normalizeCode() of src/lib/discounts.ts: trimmed, no whitespace at all, upper case. */
function mvp_normalize_code(?string $c): string
{
    if ($c === null || $c === '') return '';
    $s = preg_replace('/[' . mvp_ws() . ']+/u', '', $c);
    return mb_strtoupper($s ?? $c, 'UTF-8');
}

/** fold() of src/lib/collections.ts: toLowerCase → NFKD → no U+0300–036F marks → đ = dj. */
function mvp_fold(string $s): string
{
    $s = mb_strtolower($s, 'UTF-8');
    if (!preg_match('/[\x80-\xFF]/', $s)) return $s;
    $map = mvp_nfkd_map();
    $s = preg_replace_callback('/[^\x00-\x7F]/u', fn(array $m): string => $map[$m[0]] ?? $m[0], $s) ?? $s;
    $s = preg_replace('/[\x{0300}-\x{036F}]/u', '', $s) ?? $s;
    return str_replace('đ', 'dj', $s);
}

/** foldCity() of src/lib/pricing.ts: NFD → no U+0300–036F marks → trim → toLowerCase. */
function mvp_fold_city(string $v): string
{
    if (preg_match('/[\x80-\xFF]/', $v)) {
        $map = mvp_nfd_map();
        $v = preg_replace_callback('/[^\x00-\x7F]/u', fn(array $m): string => $map[$m[0]] ?? $m[0], $v) ?? $v;
        $v = preg_replace('/[\x{0300}-\x{036F}]/u', '', $v) ?? $v;
    }
    return mb_strtolower(mvp_trim($v), 'UTF-8');
}

/** lt() of src/i18n (fallback language 'sq'), returned as a template literal would print it. */
function mvp_lt($v, string $lang): string
{
    if (!mvp_truthy($v)) return '';
    if (!is_array($v)) return 'undefined';
    foreach ([$lang, 'sq', 'sq', 'en'] as $k) {
        $s = $v[$k] ?? null;
        if (is_string($s) && mvp_trim($s) !== '') return $s;
    }
    return array_key_exists('me', $v) ? mvp_str($v['me']) : 'undefined';
}

/* ================================================================== */
/* Products (src/lib/pricing.ts)                                       */
/* ================================================================== */

/** The option value picked for option $o: o.values.find((x) => x.id === options[o.id]). */
function mvp_option_value(array $o, array $options): ?array
{
    $oid = array_key_exists('id', $o) ? mvp_str($o['id']) : 'undefined';
    $has = array_key_exists($oid, $options);
    $sel = $has ? $options[$oid] : null;
    foreach (mvp_list($o['values'] ?? null) as $x) {
        if (!is_array($x)) continue;
        $xHas = array_key_exists('id', $x);
        if ($has ? $xHas && mvp_eq($x['id'], $sel) : !$xHas) return $x;
    }
    return null;
}

/** optionsDelta() */
function mvp_options_delta(array $p, array $options): float
{
    $delta = 0.0;
    foreach (mvp_list($p['options'] ?? null) as $o) {
        if (!is_array($o)) continue;
        $v = mvp_option_value($o, $options);
        if ($v !== null && mvp_truthy($v['priceDelta'] ?? null)) $delta += mvp_num($v['priceDelta']);
    }
    return $delta;
}

/** basePrice(): the sale price when it is a real reduction, else the price. */
function mvp_base_price(array $p): float
{
    $price = mvp_numk($p, 'price');
    $sp = $p['salePrice'] ?? null;
    if ($sp !== null) {
        $s = mvp_num($sp);
        if ($s > 0 && $s < $price) return $s;
    }
    return $price;
}

/** unitPrice() */
function mvp_unit_price(array $p, array $options): float
{
    return mvp_round2(mvp_base_price($p) + mvp_options_delta($p, $options));
}

/** regularUnitPrice() */
function mvp_regular_unit_price(array $p, array $options): float
{
    return mvp_round2(mvp_numk($p, 'price') + mvp_options_delta($p, $options));
}

/** optionsLabel() */
function mvp_options_label(array $p, array $options, string $lang): string
{
    $parts = [];
    foreach (mvp_list($p['options'] ?? null) as $o) {
        if (!is_array($o)) continue;
        $v = mvp_option_value($o, $options);
        if ($v !== null) $parts[] = mvp_lt($o['name'] ?? null, $lang) . ': ' . mvp_lt($v['label'] ?? null, $lang);
    }
    return implode(' · ', $parts);
}

/** zoneForCity() */
function mvp_zone_for_city(array $settings, $city): ?array
{
    if (!mvp_truthy($city)) return null;
    $c = mb_strtolower(mvp_str($city), 'UTF-8');
    foreach (mvp_list($settings['shippingZones'] ?? null) as $z) {
        if (!is_array($z)) continue;
        foreach (mvp_list($z['cities'] ?? null) as $x) if (is_string($x) && mb_strtolower($x, 'UTF-8') === $c) return $z;
    }
    return null;
}

/**
 * readLocalDelivery(): settings.ext.localDelivery as checkout uses it, null when not set. An old never-chosen
 * default (no `v` key, enabled === true, fee not > 0) counts as off.
 */
function mvp_read_local_delivery(array $settings): ?array
{
    $ext = $settings['ext'] ?? null;
    $local = is_array($ext) ? ($ext['localDelivery'] ?? null) : null;
    if (!mvp_truthy($local)) return null;
    if (!is_array($local)) return ['enabled' => false, 'fee' => 0.0, 'area' => ''];
    $fee = array_key_exists('fee', $local) ? mvp_num($local['fee']) : NAN;
    $legacyDefault = !array_key_exists('v', $local) && ($local['enabled'] ?? null) === true && !($fee > 0);
    $out = ['enabled' => mvp_truthy($local['enabled'] ?? null) && !$legacyDefault, 'fee' => mvp_truthy($fee) ? $fee : 0.0, 'area' => is_string($local['area'] ?? null) ? $local['area'] : ''];
    if (array_key_exists('v', $local)) $out['v'] = $local['v'];
    return $out;
}

/** localDeliveryFor(): the local-delivery fee when it is on and this is that town, else null. */
function mvp_local_delivery_for(array $settings, $city): ?float
{
    $local = mvp_read_local_delivery($settings);
    if ($local === null || !$local['enabled'] || !mvp_truthy($city) || mvp_trim($local['area']) === '') return null;
    if (mvp_fold_city($local['area']) !== mvp_fold_city(mvp_str($city))) return null;
    return mvp_max(0.0, $local['fee']);
}

/** Lifecycle state: discountState() with an evaluation time in ms. */
function mvp_discount_state(array $d, float $t): string
{
    $st = $d['status'] ?? null;
    if ($st === 'draft' || $st === 'paused') return $st;
    $s = $d['startsAt'] ?? null;
    if (mvp_truthy($s) && mvp_date_value($s) > $t) return 'scheduled';
    $e = $d['endsAt'] ?? null;
    if (mvp_truthy($e) && mvp_date_value($e) <= $t) return 'expired';
    return 'active';
}

/**
 * activeShippingRule(): the live automatic free-shipping rule — no minimum (rank 0), then the lowest amount,
 * item-count rules last (rank Infinity); stable sort, Infinity − Infinity counts as equal like in JS.
 */
function mvp_active_shipping_rule(array $discounts, float $now): ?array
{
    $list = [];
    foreach ($discounts as $d) {
        if (($d['kind'] ?? null) !== 'shipping' || ($d['method'] ?? null) !== 'auto') continue;
        $aud = $d['audience'] ?? null;
        if (is_array($aud) && ($aud['type'] ?? null) === 'segment') continue;
        if (mvp_discount_state($d, $now) === 'active') $list[] = $d;
    }
    $rank = function (array $d): float {
        $m = is_array($d['minimum'] ?? null) ? $d['minimum'] : [];
        $t = $m['type'] ?? null;
        return $t === 'amount' ? mvp_numk($m, 'value') : ($t === 'qty' ? INF : 0.0);
    };
    usort($list, function (array $a, array $b) use ($rank): int {
        $x = $rank($a) - $rank($b);
        return $x < 0 ? -1 : ($x > 0 ? 1 : 0);
    });
    return $list[0] ?? null;
}

/**
 * freeShippingFrom(): order amount from which the rule applies — [has, value]: 'amount' → minimum.value
 * (has = false when that key is missing, i.e. undefined), 'qty' → null, anything else → 0; no rule → null.
 */
function mvp_free_shipping_from(?array $rule): array
{
    if ($rule === null) return [true, null];
    $m = is_array($rule['minimum'] ?? null) ? $rule['minimum'] : [];
    $t = $m['type'] ?? null;
    if ($t === 'amount') return [array_key_exists('value', $m), $m['value'] ?? null];
    return [true, $t === 'qty' ? null : 0];
}

/** couponToDiscount(): a v1 coupon as an order discount (only when no `discounts` are passed). */
function mvp_coupon_to_discount(array $c): array
{
    $d = [];
    if (array_key_exists('id', $c)) $d['id'] = $c['id'];
    if (mvp_truthy($c['description'] ?? null)) $d['title'] = $c['description'];
    elseif (array_key_exists('code', $c)) $d['title'] = $c['code'];
    $code = $c['code'] ?? null;
    $d['publicTitle'] = ['me' => $code, 'sq' => $code, 'en' => $code];
    $d['kind'] = 'order';
    $d['method'] = 'code';
    $d['code'] = mvp_normalize_code(mvp_code_str($code));
    if (array_key_exists('type', $c)) $d['valueType'] = $c['type'];
    if (array_key_exists('value', $c)) $d['value'] = $c['value'];
    $d['appliesTo'] = ['scope' => 'all', 'ids' => []];
    $d['minimum'] = mvp_truthy($c['minTotal'] ?? null) ? ['type' => 'amount', 'value' => $c['minTotal']] : ['type' => 'none', 'value' => 0];
    $d['audience'] = ['type' => 'all'];
    $d['combines'] = ['products' => true, 'order' => false, 'shipping' => true];
    $d['startsAt'] = '2000-01-01T00:00:00.000Z';
    if (array_key_exists('expiresAt', $c)) $d['endsAt'] = $c['expiresAt'];
    $d['status'] = mvp_truthy($c['active'] ?? null) ? 'active' : 'paused';
    if (array_key_exists('uses', $c)) $d['uses'] = $c['uses'];
    $d['createdAt'] = '2000-01-01T00:00:00.000Z';
    return $d;
}

/** couponView(): Coupon-shaped view of the applied first code. */
function mvp_coupon_view(array $d, array $applied): array
{
    $v = [];
    if (array_key_exists('id', $d)) $v['id'] = $d['id'];
    $v['code'] = $applied['code'] ?? mvp_normalize_code(mvp_code_str($d['code'] ?? null));
    $bx = ($d['kind'] ?? null) === 'bxgy';
    if ($bx) $v['type'] = 'fixed';
    elseif (array_key_exists('valueType', $d)) $v['type'] = $d['valueType'];
    if ($bx) $v['value'] = $applied['amount'];
    elseif (array_key_exists('value', $d)) $v['value'] = $d['value'];
    $m = is_array($d['minimum'] ?? null) ? $d['minimum'] : [];
    if (($m['type'] ?? null) === 'amount' && array_key_exists('value', $m)) $v['minTotal'] = $m['value'];
    $v['active'] = true;
    if (array_key_exists('uses', $d)) $v['uses'] = $d['uses'];
    if (array_key_exists('endsAt', $d)) $v['expiresAt'] = $d['endsAt'];
    if (array_key_exists('title', $d)) $v['description'] = $d['title'];
    return $v;
}

/* ================================================================== */
/* Collections (src/lib/collections.ts)                                */
/* ================================================================== */

function mvp_on_sale(array $p): bool
{
    $sp = $p['salePrice'] ?? null;
    if ($sp === null) return false;
    $s = mvp_num($sp);
    return $s > 0 && $s < mvp_numk($p, 'price');
}

function mvp_cmp_number($actual, $op, $raw): bool
{
    $v = (is_int($raw) || is_float($raw)) ? (float) $raw : mvp_str_num(preg_replace('/,/', '.', mvp_str($raw), 1) ?? '');
    if ($actual === null) return $op === 'neq';
    if (is_nan($v) || is_infinite($v)) return false;
    $a = mvp_num($actual);
    switch ($op) {
        case 'gt':
            return $a > $v;
        case 'lt':
            return $a < $v;
        case 'eq':
            return abs($a - $v) < 0.005;
        case 'neq':
            return abs($a - $v) >= 0.005;
    }
    return false;
}

function mvp_cmp_text(array $values, $op, $raw): bool
{
    $v = mvp_fold(mvp_trim(mvp_str($raw)));
    $list = array_map(fn($x) => mvp_fold(mvp_str($x)), $values);
    if ($op === 'eq') return in_array($v, $list, true);
    if ($op === 'neq') return !in_array($v, $list, true);
    if ($op === 'contains') {
        foreach ($list as $x) if (str_contains($x, $v)) return true;
    }
    return false;
}

/** matchesRule() */
function mvp_matches_rule(array $p, array $r): bool
{
    $op = $r['op'] ?? null;
    $val = $r['value'] ?? null;
    $field = $r['field'] ?? null;
    if (!is_string($field)) return false;
    $sale = mvp_on_sale($p);
    switch ($field) {
        case 'category':
            return mvp_cmp_text([$p['categoryId'] ?? null], $op, $val);
        case 'price':
            return mvp_cmp_number($sale ? $p['salePrice'] : ($p['price'] ?? null), $op, $val);
        case 'compareAt':
            return mvp_cmp_number($sale ? $p['price'] : null, $op, $val);
        case 'stock':
            return mvp_cmp_number($p['stock'] ?? null, $op, $val);
        case 'status':
            return mvp_cmp_text([$p['status'] ?? null], $op, $val);
        case 'tag':
            return mvp_cmp_text(mvp_list($p['tags'] ?? null), $op, $val);
        case 'title':
            $n = is_array($p['name'] ?? null) ? $p['name'] : [];
            return mvp_cmp_text([$n['me'] ?? null, $n['sq'] ?? null, $n['en'] ?? null], $op === 'eq' ? 'contains' : $op, $val);
        case 'vendor':
            return mvp_cmp_text(mvp_truthy($p['vendor'] ?? null) ? [$p['vendor']] : [], $op, $val);
        case 'onSale':
            $want = (bool) preg_match('/^(true|1|da|po|yes)\z/i', mvp_trim(mvp_str($val)));
            return $op === 'neq' ? $sale !== $want : $sale === $want;
        case 'badge':
            return mvp_cmp_text(mvp_list($p['badges'] ?? null), $op, $val);
    }
    return false;
}

/** inCollection(): membership, ignoring publication status. */
function mvp_in_collection(array $c, array $p): bool
{
    if (($c['kind'] ?? null) === 'manual') return array_key_exists('id', $p) && mvp_includes($c['productIds'] ?? null, $p['id']);
    $rules = mvp_list($c['rules'] ?? null);
    if (!$rules) return false;
    $any = ($c['match'] ?? null) === 'any';
    foreach ($rules as $r) {
        $hit = is_array($r) && mvp_matches_rule($p, $r);
        if ($any && $hit) return true;
        if (!$any && !$hit) return false;
    }
    return !$any;
}

/** collectionIdsFor() (collections without an id are left out: `includes(undefined)` never matches JSON ids). */
function mvp_collection_ids_for(array $p, array $collections): array
{
    $out = [];
    foreach ($collections as $c) if (is_array($c) && array_key_exists('id', $c) && mvp_in_collection($c, $p)) $out[] = $c['id'];
    return $out;
}

/* ================================================================== */
/* Discount engine (src/lib/discounts.ts) — integer cents as floats    */
/* ================================================================== */

/** toCents(): Number.isFinite (no coercion) else 0, × 100, Math.round. */
function mvp_to_cents($v): float
{
    $x = (is_int($v) || is_float($v)) ? (float) $v : 0.0;
    if (is_nan($x) || is_infinite($x)) $x = 0.0;
    return mvp_round($x * 100);
}

/** pct(): Math.min(100, Math.max(0, v || 0)) */
function mvp_pct($v): float
{
    return mvp_min(100.0, mvp_max(0.0, mvp_truthy($v) ? mvp_num($v) : 0.0));
}

/** allocateCents(): split cents proportionally, left-over cents by largest remainder, then position. */
function mvp_allocate_cents(float $total, array $weights): array
{
    $out = array_fill(0, count($weights), 0.0);
    $sum = 0.0;
    foreach ($weights as $w) $sum += mvp_max(0.0, $w);
    if ($total <= 0 || $sum <= 0) return $out;
    $amount = mvp_min($total, $sum);
    $rems = [];
    $given = 0.0;
    foreach ($weights as $i => $w) {
        if ($w <= 0) continue;
        $share = floor(($amount * $w) / $sum);
        $out[$i] = $share;
        $given += $share;
        $rems[] = [$i, fmod($amount * $w, $sum)];
    }
    usort($rems, function (array $a, array $b): int {
        $d = $b[1] - $a[1];
        return $d < 0 ? -1 : ($d > 0 ? 1 : $a[0] <=> $b[0]);
    });
    for ($k = 0, $n = count($rems); $k < $amount - $given && $k < $n; $k++) $out[$rems[$k][0]] += 1;
    return $out;
}

/** lineMatches(): does a line fall inside a target (all / products / collections)? */
function mvp_line_matches($target, array $line): bool
{
    if (!mvp_truthy($target)) return true;
    if (!is_array($target)) return false;
    $scope = $target['scope'] ?? null;
    if ($scope === 'all') return true;
    $ids = $target['ids'] ?? null;
    if ($scope === 'products') return $line['pidHas'] && mvp_includes($ids, $line['productId']);
    foreach ($line['collectionIds'] as $cid) if (mvp_includes($ids, $cid)) return true;
    return false;
}

/** discountClass() as a property key ('bxgy' is a product discount). */
function mvp_class(array $d): string
{
    if (!array_key_exists('kind', $d)) return "\0undefined";
    $k = $d['kind'];
    if (!is_string($k)) return "\0" . mvp_str($k);
    return $k === 'bxgy' ? 'products' : $k;
}

/** A rule entered or picked up automatically, with its Map key and class precomputed. */
function mvp_candidate(array $d, string $code, bool $auto): array
{
    return ['d' => $d, 'code' => $code, 'auto' => $auto, 'idx' => 0, 'k' => mvp_key($d), 'cls' => mvp_class($d), 'own' => ['has' => array_key_exists('id', $d), 'id' => $d['id'] ?? null]];
}

/** canCombine(): mutual combination check; two shipping rules never stack. */
function mvp_can_combine(array $a, array $b): bool
{
    if ($a['k'] === $b['k']) return false;
    $ca = $a['cls'];
    $cb = $b['cls'];
    if ($ca === 'shipping' && $cb === 'shipping') return false;
    $fa = $a['d']['combines'] ?? null;
    $fb = $b['d']['combines'] ?? null;
    $key = fn(string $c): string => $c[0] === "\0" ? substr($c, 1) : $c;
    return is_array($fa) && mvp_truthy($fa[$key($cb)] ?? null) && is_array($fb) && mvp_truthy($fb[$key($ca)] ?? null);
}

/** compatible() */
function mvp_compatible(array $set): bool
{
    $n = count($set);
    for ($a = 0; $a < $n; $a++) for ($b = $a + 1; $b < $n; $b++) if (!mvp_can_combine($set[$a], $set[$b])) return false;
    return true;
}

/** minimumFail() */
function mvp_minimum_fail(array $d, float $amountCents, float $qty): ?array
{
    $m = $d['minimum'] ?? null;
    if (!mvp_truthy($m) || !is_array($m)) return null;
    $type = $m['type'] ?? null;
    if ($type === 'none') return null;
    $val = mvp_numk($m, 'value');
    if (!($val > 0)) return null;
    if ($type === 'amount') {
        $need = mvp_to_cents($m['value']);
        return $amountCents >= $need ? null : ['reason' => 'minimum', 'minimumType' => 'amount', 'missing' => ($need - $amountCents) / 100];
    }
    return $qty >= $val ? null : ['reason' => 'minimum', 'minimumType' => 'qty', 'missing' => ceil($val - $qty)];
}

/** give() of evaluate() */
function mvp_give(array &$ev, int $i, array $c, float $cents, string $bucket): void
{
    if ($cents <= 0) return;
    $ev[$bucket][$i] += $cents;
    $k = $c['k'];
    if (isset($ev['alloc'][$i][$k])) $ev['alloc'][$i][$k][2] += $cents;
    else $ev['alloc'][$i][$k] = [$c['own']['has'], $c['own']['id'], $cents];
    $ev['amounts'][$k] = ($ev['amounts'][$k] ?? 0.0) + $cents;
}

/** Union-find "next unused position" with path compression (BXGY unit lists). */
function mvp_next_free(array &$next, int $j): int
{
    $r = $j;
    while ($next[$r] !== $r) $r = $next[$r];
    while ($next[$j] !== $r) {
        $t = $next[$j];
        $next[$j] = $r;
        $j = $t;
    }
    return $r;
}

/**
 * Buy X get Y inside evaluate(). Same result as the TS, which re-filters and re-sorts every unit per application;
 * here both unit orders are sorted once (the comparators are total orders) and used units are skipped.
 */
function mvp_eval_bxgy(array &$ev, array &$owner, array $c, array $lines): void
{
    $d = $c['d'];
    $k = $c['k'];
    $b = $d['bxgy'] ?? null;
    $ok = is_array($b) && mvp_truthy($b);
    $buyQty = $ok ? mvp_numk($b, 'buyQty') : NAN;
    $getQty = $ok ? mvp_numk($b, 'getQty') : NAN;
    if (!($buyQty > 0) || !($getQty > 0)) {
        $ev['fails'][$k] = ['reason' => 'notEligible'];
        return;
    }
    $xT = ['scope' => $b['buyScope'] ?? null, 'ids' => $b['buyIds'] ?? null];
    $yT = ['scope' => $b['getScope'] ?? null, 'ids' => $b['getIds'] ?? null];
    $uLine = [];
    $uPrice = [];
    $uX = [];
    $uY = [];
    foreach ($lines as $i => $l) {
        $count = mvp_max(0.0, floor($l['qty']));
        if (!mvp_truthy($count)) continue;
        $x = mvp_line_matches($xT, $l);
        $y = mvp_line_matches($yT, $l) && $owner[$i] === null;
        if (!$x && !$y) continue;
        $unitBase = floor($l['cents'] / $count);
        $extra = $l['cents'] - $unitBase * $count;
        for ($kk = 0; $kk < $count; $kk++) {
            $uLine[] = $i;
            $uPrice[] = $unitBase + ($kk < $extra ? 1.0 : 0.0);
            $uX[] = $x;
            $uY[] = $y;
        }
    }
    $nU = count($uLine);
    $xTotal = 0;
    foreach ($uX as $x) if ($x) $xTotal++;
    if (!$xTotal) {
        $ev['fails'][$k] = ['reason' => 'notEligible'];
        return;
    }
    if ($xTotal < $buyQty) {
        $ev['fails'][$k] = ['reason' => 'minimum', 'minimumType' => 'qty', 'missing' => $buyQty - $xTotal];
        return;
    }
    // unit index order = (line, k) order, the comparators' last keys
    $ordX = [];
    $ordY = [];
    for ($u = 0; $u < $nU; $u++) {
        if ($uX[$u]) $ordX[] = $u;
        if ($uY[$u]) $ordY[] = $u;
    }
    // X: units that can't be Y first, then the most expensive; Y: the cheapest
    usort($ordX, fn(int $p, int $q): int => ($uY[$p] <=> $uY[$q]) ?: (($uPrice[$q] <=> $uPrice[$p]) ?: ($p <=> $q)));
    usort($ordY, fn(int $p, int $q): int => ($uPrice[$p] <=> $uPrice[$q]) ?: ($p <=> $q));
    $nX = count($ordX);
    $nY = count($ordY);
    $posX = array_flip($ordX);
    $posY = array_flip($ordY);
    $nextX = range(0, $nX);
    $nextY = range(0, $nY);
    // .slice(0, buyQty) takes ToIntegerOrInfinity(buyQty) units at most
    $takeX = $buyQty >= $nX ? $nX : (int) floor($buyQty);
    $takeY = $getQty >= $nY ? $nY : (int) floor($getQty);
    $maxUses = mvp_numk($b, 'maxUses');
    $maxApps = $maxUses > 0 ? $maxUses : INF;
    $apps = 0;
    $isY = [];
    $yUnits = [];
    while ($apps < $maxApps) {
        $xs = [];
        for ($j = mvp_next_free($nextX, 0); count($xs) < $takeX && $j < $nX; $j = mvp_next_free($nextX, $j + 1)) $xs[] = $ordX[$j];
        if (count($xs) < $buyQty) break;
        $xSet = array_flip($xs);
        $ys = [];
        for ($j = mvp_next_free($nextY, 0); count($ys) < $takeY && $j < $nY; $j = mvp_next_free($nextY, $j + 1)) {
            if (!isset($xSet[$ordY[$j]])) $ys[] = $ordY[$j];
        }
        if (count($ys) < $getQty) break;
        foreach ([$xs, $ys] as $group) {
            foreach ($group as $u) {
                if (isset($posX[$u])) $nextX[$posX[$u]] = $posX[$u] + 1;
                if (isset($posY[$u])) $nextY[$posY[$u]] = $posY[$u] + 1;
            }
        }
        foreach ($ys as $u) {
            $isY[$u] = true;
            $yUnits[] = $u;
        }
        $apps++;
    }
    if (!$apps) {
        // enough X but no (cheaper) Y in the cart → manual mode gives nothing
        $ev['fails'][$k] = ['reason' => 'notEligible'];
        return;
    }
    // optional extra minimum on the X items only (Y never counts)
    $xBase = 0.0;
    $xQty = 0.0;
    for ($u = 0; $u < $nU; $u++) {
        if ($uX[$u] && !isset($isY[$u])) {
            $xBase += $uPrice[$u];
            $xQty += 1;
        }
    }
    $mf = mvp_minimum_fail($d, $xBase, $xQty);
    if ($mf !== null) {
        $ev['fails'][$k] = $mf;
        return;
    }
    $free = ($b['getType'] ?? null) === 'free';
    $gp = mvp_pct($b['getValue'] ?? null);
    $perLine = [];
    foreach ($yUnits as $u) {
        $cc = $free ? $uPrice[$u] : mvp_min($uPrice[$u], mvp_round(($uPrice[$u] * $gp) / 100));
        $perLine[$uLine[$u]] = ($perLine[$uLine[$u]] ?? 0.0) + $cc;
    }
    $given = 0.0;
    foreach ($perLine as $i => $cc) {
        $v = mvp_min($lines[$i]['cents'] - $ev['product'][$i], $cc);
        mvp_give($ev, $i, $c, $v, 'product');
        $given += $v;
        if ($v > 0) $owner[$i] = $c['own'];
    }
    if ($given <= 0) $ev['fails'][$k] = ['reason' => 'notEligible'];
}

/** evaluate(): one combination of rules on the cart, in cents. */
function mvp_evaluate(array $set, array $lines, float $shippingCents, $zoneId, array $standalone): array
{
    $n = count($lines);
    $ev = ['product' => array_fill(0, $n, 0.0), 'order' => array_fill(0, $n, 0.0), 'alloc' => array_fill(0, $n, []), 'amounts' => [], 'fails' => [], 'shipping' => 0.0, 'saving' => 0.0];
    $owner = array_fill(0, $n, null);

    /* ---------- 2. product discounts (best standalone first) ---------- */
    $productSet = [];
    foreach ($set as $c) if ($c['cls'] === 'products') $productSet[] = $c;
    usort($productSet, function (array $a, array $b) use ($standalone): int {
        $d = ($standalone[$b['k']] ?? 0.0) - ($standalone[$a['k']] ?? 0.0);
        return $d < 0 ? -1 : ($d > 0 ? 1 : $a['idx'] <=> $b['idx']);
    });
    foreach ($productSet as $c) {
        $d = $c['d'];
        $k = $c['k'];
        if (($d['kind'] ?? null) !== 'products') {
            mvp_eval_bxgy($ev, $owner, $c, $lines);
            continue;
        }
        $target = $d['appliesTo'] ?? null;
        $matching = [];
        foreach ($lines as $i => $l) if (mvp_line_matches($target, $l)) $matching[] = $i;
        if (!$matching) {
            $ev['fails'][$k] = ['reason' => 'notEligible'];
            continue;
        }
        $free = [];
        foreach ($matching as $i) if ($owner[$i] === null) $free[] = $i;
        if (!$free) {
            $f = ['reason' => 'notCombinable'];
            $o = $owner[$matching[0]];
            if ($o['has'] && $o['id'] !== null) $f['conflictsWith'] = $o['id'];
            $ev['fails'][$k] = $f;
            continue;
        }
        $base = 0.0;
        $qty = 0.0;
        foreach ($free as $i) $base = $base + $lines[$i]['cents'] - $ev['product'][$i];
        foreach ($free as $i) $qty += $lines[$i]['qty'];
        $mf = mvp_minimum_fail($d, $base, $qty);
        if ($mf !== null) {
            $ev['fails'][$k] = $mf;
            continue;
        }
        $given = 0.0;
        if (($d['valueType'] ?? null) === 'percent') {
            $p = mvp_pct($d['value'] ?? null);
            foreach ($free as $i) {
                $cents = mvp_min($lines[$i]['cents'], mvp_round(($lines[$i]['cents'] * $p) / 100));
                mvp_give($ev, $i, $c, $cents, 'product');
                $given += $cents;
            }
        } elseif (mvp_truthy($d['perItem'] ?? null)) {
            $per = mvp_to_cents($d['value'] ?? null);
            foreach ($free as $i) {
                $cents = mvp_min($lines[$i]['cents'], $per * mvp_max(0.0, floor($lines[$i]['qty'])));
                mvp_give($ev, $i, $c, $cents, 'product');
                $given += $cents;
            }
        } else {
            $weights = [];
            foreach ($free as $i) $weights[] = $lines[$i]['cents'];
            $shares = mvp_allocate_cents(mvp_min(mvp_to_cents($d['value'] ?? null), $base), $weights);
            foreach ($free as $j => $i) {
                mvp_give($ev, $i, $c, $shares[$j], 'product');
                $given += $shares[$j];
            }
        }
        if ($given <= 0) $ev['fails'][$k] = ['reason' => 'notEligible'];
        else foreach ($free as $i) if (($ev['alloc'][$i][$k][2] ?? 0.0) > 0) $owner[$i] = $c['own'];
    }

    /* ---------- 3. order discounts on the revised subtotal ---------- */
    $revised = [];
    $revisedTotal = 0.0;
    foreach ($lines as $i => $l) $revised[$i] = $l['cents'] - $ev['product'][$i];
    foreach ($revised as $v) $revisedTotal += $v;
    $orderSet = [];
    foreach ($set as $c) if (($c['d']['kind'] ?? null) === 'order') $orderSet[] = $c;
    // percentages first (same base), fixed amounts after
    usort($orderSet, fn(array $a, array $b): int => ((int) (($a['d']['valueType'] ?? null) === 'fixed') <=> (int) (($b['d']['valueType'] ?? null) === 'fixed')) ?: ($a['idx'] <=> $b['idx']));
    foreach ($orderSet as $c) {
        $d = $c['d'];
        $k = $c['k'];
        $target = $d['appliesTo'] ?? null;
        $idxs = [];
        foreach ($lines as $i => $l) if (mvp_line_matches($target, $l)) $idxs[] = $i;
        $base = 0.0;
        foreach ($idxs as $i) $base += $revised[$i];
        if (!$idxs || $base <= 0) {
            $ev['fails'][$k] = ['reason' => 'notEligible'];
            continue;
        }
        $qty = 0.0;
        foreach ($idxs as $i) $qty += $lines[$i]['qty'];
        $mf = mvp_minimum_fail($d, $base, $qty);
        if ($mf !== null) {
            $ev['fails'][$k] = $mf;
            continue;
        }
        $cap = [];
        $capTotal = 0.0;
        foreach ($idxs as $i) $cap[] = $revised[$i] - $ev['order'][$i];
        foreach ($cap as $v) $capTotal += $v;
        $want = ($d['valueType'] ?? null) === 'percent' ? mvp_round(($base * mvp_pct($d['value'] ?? null)) / 100) : mvp_to_cents($d['value'] ?? null);
        $amount = mvp_min($want, $capTotal);
        if ($amount <= 0) {
            $ev['fails'][$k] = ['reason' => 'notEligible'];
            continue;
        }
        $shares = mvp_allocate_cents($amount, $cap);
        foreach ($idxs as $j => $i) mvp_give($ev, $i, $c, $shares[$j], 'order');
    }

    /* ---------- 4. shipping (one rule) ---------- */
    $shipping = 0.0;
    $ship = null;
    foreach ($set as $c) {
        if (($c['d']['kind'] ?? null) === 'shipping') {
            $ship = $c;
            break;
        }
    }
    if ($ship !== null) {
        $d = $ship['d'];
        $k = $ship['k'];
        $qty = 0.0;
        foreach ($lines as $l) $qty += $l['qty'];
        $mf = mvp_minimum_fail($d, $revisedTotal, $qty);
        $sh = is_array($d['shipping'] ?? null) ? $d['shipping'] : [];
        $zoneIds = $sh['zoneIds'] ?? null;
        $zoneLen = is_string($zoneIds) ? strlen($zoneIds) : count(mvp_list($zoneIds));
        $zoneIn = is_string($zoneIds) ? str_contains($zoneIds, mvp_str($zoneId)) : mvp_includes($zoneIds, $zoneId);
        $maxRate = $sh['maxRate'] ?? null;
        if ($shippingCents <= 0) $ev['fails'][$k] = ['reason' => 'notEligible'];
        elseif ($zoneLen > 0 && (!mvp_truthy($zoneId) || !$zoneIn)) $ev['fails'][$k] = ['reason' => 'notEligible'];
        elseif ($maxRate !== null && mvp_num($maxRate) > 0 && $shippingCents > mvp_to_cents($maxRate)) $ev['fails'][$k] = ['reason' => 'notEligible'];
        elseif ($mf !== null) $ev['fails'][$k] = $mf;
        else {
            $shipping = ($d['valueType'] ?? null) === 'percent'
                ? mvp_min($shippingCents, mvp_round(($shippingCents * mvp_pct($d['value'] ?? null)) / 100))
                : mvp_min($shippingCents, mvp_to_cents($d['value'] ?? null));
            if ($shipping > 0) $ev['amounts'][$k] = $shipping;
            else $ev['fails'][$k] = ['reason' => 'notEligible'];
        }
    }

    $p = 0.0;
    $o = 0.0;
    foreach ($ev['product'] as $v) $p += $v;
    foreach ($ev['order'] as $v) $o += $v;
    $ev['saving'] = $p + $o + $shipping;
    $ev['shipping'] = $shipping;
    return $ev;
}

/** A rejection entry: { code, id, title, kind, auto, ...fail } (undefined keys left out). */
function mvp_rejection(string $code, ?array $d, bool $auto, array $f): array
{
    $r = ['code' => $code];
    if ($d !== null) foreach (['id', 'title', 'kind'] as $p) if (array_key_exists($p, $d)) $r[$p] = $d[$p];
    $r['auto'] = $auto;
    return $r + $f;
}

/**
 * applyDiscounts(): automatic rules + entered codes on the cart, best combination, reasons for the rest.
 * Returns the parts priceCart() reads: lines[] {discount, allocations}, productDiscount, orderDiscount,
 * shippingDiscount, discountTotal, shipping, applied, rejected (EUR).
 */
function mvp_apply_discounts(array $lines, array $all, array $codes, $shipping, $zoneId, $customer, float $now): array
{
    $shippingCents = mvp_max(0.0, mvp_to_cents($shipping ?? 0));
    $rejected = [];

    /* ---------- candidates ---------- */
    $raw = [];
    foreach ($all as $d) if (($d['method'] ?? null) === 'auto' && mvp_discount_state($d, $now) === 'active') $raw[] = mvp_candidate($d, '', true);
    $seen = [];
    $codeOf = [];
    foreach ($codes as $entered) {
        $code = mvp_normalize_code(mvp_code_str($entered));
        if ($code === '' || isset($seen[$code])) continue;
        $seen[$code] = true;
        $d = null;
        foreach ($all as $i => $x) {
            if (($x['method'] ?? null) !== 'code') continue;
            $codeOf[$i] ??= mvp_normalize_code(mvp_code_str($x['code'] ?? null));
            if ($codeOf[$i] === $code) {
                $d = $x;
                break;
            }
        }
        if ($d === null) {
            $rejected[] = mvp_rejection($code, null, false, ['reason' => 'notfound']);
            continue;
        }
        $st = mvp_discount_state($d, $now);
        if ($st === 'draft' || $st === 'paused') $rejected[] = mvp_rejection($code, $d, false, ['reason' => 'inactive']);
        elseif ($st === 'scheduled' || $st === 'expired') $rejected[] = mvp_rejection($code, $d, false, ['reason' => $st]);
        else $raw[] = mvp_candidate($d, $code, false);
    }
    $usedIds = is_array($customer) ? ($customer['usedDiscountIds'] ?? null) : null;
    $segments = is_array($customer) ? ($customer['segmentIds'] ?? null) : null;
    $cands = [];
    foreach ($raw as $c) {
        $d = $c['d'];
        $limit = $d['usageLimit'] ?? null;
        $limitHit = $limit !== null && mvp_num($limit) > 0 && mvp_numk($d, 'uses') >= mvp_num($limit);
        $onceHit = mvp_truthy($d['oncePerCustomer'] ?? null) && $c['own']['has'] && mvp_includes($usedIds, $d['id']);
        $aud = is_array($d['audience'] ?? null) ? $d['audience'] : [];
        if ($limitHit || $onceHit) $rejected[] = mvp_rejection($c['code'], $d, $c['auto'], ['reason' => 'usageLimit']);
        elseif (($aud['type'] ?? null) === 'segment' && !(mvp_truthy($aud['segmentId'] ?? null) && mvp_includes($segments, $aud['segmentId']))) {
            $rejected[] = mvp_rejection($c['code'], $d, $c['auto'], ['reason' => 'audience']);
        } else {
            $c['idx'] = count($cands);
            $cands[] = $c;
        }
    }

    /* ---------- choose the best combination ---------- */
    $standalone = [];
    $empty = mvp_evaluate([], $lines, $shippingCents, $zoneId, $standalone);
    $singles = [];
    foreach ($cands as $c) {
        $ev = mvp_evaluate([$c], $lines, $shippingCents, $zoneId, $standalone);
        $singles[$c['k']] = $ev;
        $standalone[$c['k']] = $ev['saving'];
    }
    $bestSet = [];
    $bestEv = $empty;
    $n = count($cands);
    if ($n <= 12) {
        for ($mask = 1; $mask < (1 << $n); $mask++) {
            $set = [];
            foreach ($cands as $i => $c) if ($mask & (1 << $i)) $set[] = $c;
            if (!mvp_compatible($set)) continue;
            $ev = count($set) === 1 ? $singles[$set[0]['k']] : mvp_evaluate($set, $lines, $shippingCents, $zoneId, $standalone);
            if ($ev['saving'] > $bestEv['saving']) {
                $bestSet = $set;
                $bestEv = $ev;
            }
        }
    } else {
        // large rule sets: greedy by standalone saving (still mutual-combination safe)
        $order = $cands;
        usort($order, function (array $a, array $b) use ($standalone): int {
            $d = ($standalone[$b['k']] ?? 0.0) - ($standalone[$a['k']] ?? 0.0);
            return $d < 0 ? -1 : ($d > 0 ? 1 : $a['idx'] <=> $b['idx']);
        });
        $set = [];
        foreach ($order as $c) {
            $next = [...$set, $c];
            if (!mvp_compatible($next)) continue;
            $ev = mvp_evaluate($next, $lines, $shippingCents, $zoneId, $standalone);
            if ($ev['saving'] > ($set ? mvp_evaluate($set, $lines, $shippingCents, $zoneId, $standalone)['saving'] : 0.0)) $set = $next;
        }
        if ($set) {
            $bestSet = $set;
            $bestEv = mvp_evaluate($set, $lines, $shippingCents, $zoneId, $standalone);
        }
    }

    /* ---------- explain the ones that did not make it ---------- */
    $appliedSet = [];
    foreach ($bestSet as $c) if (($bestEv['amounts'][$c['k']] ?? 0.0) > 0) $appliedSet[] = $c;
    $isApplied = [];
    $isBest = [];
    foreach ($appliedSet as $c) $isApplied[$c['idx']] = true;
    foreach ($bestSet as $c) $isBest[$c['idx']] = true;
    foreach ($cands as $c) {
        if (isset($isApplied[$c['idx']])) continue;
        if (isset($isBest[$c['idx']])) {
            $rejected[] = mvp_rejection($c['code'], $c['d'], $c['auto'], $bestEv['fails'][$c['k']] ?? ['reason' => 'notEligible']);
            continue;
        }
        $blocker = null;
        foreach ($appliedSet as $a) {
            if (!mvp_can_combine($a, $c)) {
                $blocker = $a;
                break;
            }
        }
        if ($blocker !== null) {
            $f = ['reason' => 'notCombinable'];
            if ($blocker['own']['has']) $f['conflictsWith'] = $blocker['own']['id'];
            $rejected[] = mvp_rejection($c['code'], $c['d'], $c['auto'], $f);
            continue;
        }
        // compatible with the winners: try it alongside them to find out why it gives nothing extra
        $trial = mvp_evaluate([...$appliedSet, $c], $lines, $shippingCents, $zoneId, $standalone);
        $f = $trial['fails'][$c['k']] ?? null;
        if ($f === null) {
            $f = ['reason' => 'notCombinable'];
            foreach ($appliedSet as $a) {
                if ($a['cls'] === $c['cls']) {
                    if ($a['own']['has']) $f['conflictsWith'] = $a['own']['id'];
                    break;
                }
            }
        }
        $rejected[] = mvp_rejection($c['code'], $c['d'], $c['auto'], $f);
    }

    /* ---------- result in EUR ---------- */
    $rank = fn(array $d): float => is_string($d['kind'] ?? null) ? (float) (['products' => 0, 'bxgy' => 1, 'order' => 2, 'shipping' => 3][$d['kind']] ?? NAN) : NAN;
    $sorted = $appliedSet;
    usort($sorted, function (array $a, array $b) use ($rank): int {
        $x = $rank($a['d']) - $rank($b['d']);
        return $x < 0 ? -1 : ($x > 0 ? 1 : $a['idx'] <=> $b['idx']);
    });
    $applied = [];
    foreach ($sorted as $c) {
        $d = $c['d'];
        $a = [];
        foreach (['id', 'title', 'kind'] as $p) if (array_key_exists($p, $d)) $a[$p] = $d[$p];
        if ($c['code'] !== '') $a['code'] = $c['code'];
        elseif (mvp_truthy($d['code'] ?? null)) $a['code'] = mvp_normalize_code(mvp_code_str($d['code']));
        $a['amount'] = ($bestEv['amounts'][$c['k']] ?? 0.0) / 100;
        $applied[] = $a;
    }
    $outLines = [];
    $productCents = 0.0;
    $orderCents = 0.0;
    foreach ($lines as $i => $l) {
        $al = [];
        foreach ($bestEv['alloc'][$i] as [$has, $id, $cents]) {
            if (!($cents > 0)) continue;
            $e = [];
            if ($has) $e['discountId'] = $id;
            $e['amount'] = $cents / 100;
            $al[] = $e;
        }
        $outLines[] = ['discount' => ($bestEv['product'][$i] + $bestEv['order'][$i]) / 100, 'allocations' => $al];
    }
    foreach ($bestEv['product'] as $v) $productCents += $v;
    foreach ($bestEv['order'] as $v) $orderCents += $v;
    return [
        'lines' => $outLines,
        'productDiscount' => $productCents / 100,
        'orderDiscount' => $orderCents / 100,
        'shippingDiscount' => $bestEv['shipping'] / 100,
        'discountTotal' => ($productCents + $orderCents) / 100,
        'shipping' => ($shippingCents - $bestEv['shipping']) / 100,
        'applied' => $applied,
        'rejected' => $rejected,
    ];
}

/* ================================================================== */
/* priceCart()                                                         */
/* ================================================================== */

/**
 * priceCart() of src/lib/pricing.ts. Lines carry `productId` instead of the embedded product.
 *
 * @param array $cart     CartItem[] (key, productId, qty, options, installation)
 * @param array $products Product[]
 * @param array $settings Settings (shippingZones, vatRate, ext.localDelivery)
 * @param array $opts     PriceCartOptions
 */
function mvp_price_cart(array $cart, array $products, array $settings, array $opts): array
{
    $lang = array_key_exists('lang', $opts) ? mvp_str($opts['lang']) : 'undefined';
    $byId = [];
    foreach ($products as $p) {
        if (!is_array($p)) continue;
        $byId[mvp_key($p)] ??= $p;
    }

    $lines = [];
    foreach ($cart as $item) {
        if (!is_array($item)) continue;
        $p = $byId[mvp_key($item, 'productId')] ?? null;
        if ($p === null) continue;
        $options = is_array($item['options'] ?? null) ? $item['options'] : [];
        $up = mvp_unit_price($p, $options);
        $qtyHas = array_key_exists('qty', $item);
        $qty = $qtyHas ? mvp_num($item['qty']) : NAN;
        $m2 = ($p['unit'] ?? null) === 'm2' && mvp_truthy($p['packSize'] ?? null);
        $units = $m2 ? mvp_round2($qty * mvp_num($p['packSize'])) : $qty;
        $inst = $p['installation'] ?? null;
        $instOn = mvp_truthy($item['installation'] ?? null) && is_array($inst) && mvp_truthy($inst['available'] ?? null);
        $instHas = !$instOn || array_key_exists('price', $inst);
        $instRaw = $instOn ? ($inst['price'] ?? null) : 0;
        $line = ['item' => $item];
        if (array_key_exists('id', $p)) $line['productId'] = $p['id'];
        $line['unitPrice'] = $up;
        $line['regularUnitPrice'] = mvp_regular_unit_price($p, $options);
        if ($m2) $line['units'] = $units;
        elseif ($qtyHas) $line['units'] = $item['qty'];
        $line['lineTotal'] = mvp_round2($up * $units);
        if ($instHas) $line['installationUnitPrice'] = $instRaw;
        $line['installationTotal'] = mvp_round2(($instHas ? mvp_num($instRaw) : NAN) * $units);
        $line['optionsLabel'] = mvp_options_label($p, $options, $lang);
        $lines[] = ['line' => $line, 'p' => $p, 'item' => $item];
    }
    $subtotal = 0.0;
    $installationTotal = 0.0;
    foreach ($lines as $l) $subtotal += $l['line']['lineTotal'];
    foreach ($lines as $l) $installationTotal += $l['line']['installationTotal'];
    $subtotal = mvp_round2($subtotal);
    $installationTotal = mvp_round2($installationTotal);
    $hasInstallation = $installationTotal > 0;

    /* ---------- shipping fee before discounts (business rules first) ---------- */
    $fee = 0.0;
    $feeHas = true;
    $shippingEstimate = false;
    $city = $opts['city'] ?? null;
    $zone = mvp_zone_for_city($settings, $city);
    $local = mvp_local_delivery_for($settings, $city);
    $delivery = $opts['delivery'] ?? null;
    if ($lines && $delivery !== 'pickup' && !$hasInstallation) {
        if ($local !== null) $fee = $local;
        elseif ($zone !== null) {
            $feeHas = array_key_exists('fee', $zone);
            $fee = $zone['fee'] ?? null;
        } else {
            $zones = mvp_list($settings['shippingZones'] ?? null);
            $fee = $zones ? mvp_min_list(array_map(fn($z) => is_array($z) ? mvp_numk($z, 'fee') : NAN, $zones)) : 0.0;
            $shippingEstimate = true;
        }
    }

    /* ---------- discount engine ---------- */
    $discounts = isset($opts['discounts']) ? mvp_list($opts['discounts']) : array_map('mvp_coupon_to_discount', array_values(array_filter(mvp_list($opts['coupons'] ?? null), 'is_array')));
    $discounts = array_values(array_filter($discounts, 'is_array'));
    $collections = mvp_list($opts['collections'] ?? null);
    $entered = [$opts['couponCode'] ?? null];
    $more = $opts['codes'] ?? null;
    if (is_string($more)) $more = preg_split('//u', $more, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    foreach (mvp_list($more) as $c) $entered[] = $c;
    $codes = [];
    foreach ($entered as $c) {
        $c = mvp_normalize_code(mvp_code_str($c));
        if ($c !== '' && !in_array($c, $codes, true)) $codes[] = $c;
    }
    $engineLines = [];
    foreach ($lines as $l) {
        $q = $l['item']['qty'] ?? null;
        $engineLines[] = [
            'productId' => $l['p']['id'] ?? null,
            'pidHas' => array_key_exists('id', $l['p']),
            'qty' => mvp_max(0.0, mvp_truthy($q) ? mvp_num($q) : 0.0),
            'cents' => mvp_max(0.0, mvp_to_cents($l['line']['lineTotal'])),
            'collectionIds' => $collections ? mvp_collection_ids_for($l['p'], $collections) : [],
        ];
    }
    $now = mvp_now($opts);
    $zoneId = $zone !== null ? ($zone['id'] ?? null) : null;
    $res = mvp_apply_discounts($engineLines, $discounts, $codes, $fee, $zoneId, $opts['customer'] ?? null, $now);
    $priced = [];
    foreach ($lines as $i => $l) $priced[] = $l['line'] + $res['lines'][$i];
    $discount = $res['discountTotal'];
    $shipping = $res['shipping'];

    /* ---------- free shipping reason & progress ---------- */
    $freeShippingReason = null;
    if ($lines) {
        if ($delivery === 'pickup') $freeShippingReason = 'pickup';
        elseif ($hasInstallation) $freeShippingReason = 'installation';
        elseif (mvp_num($fee) > 0 && $shipping == 0.0) {
            foreach ($res['applied'] as $a) {
                if (($a['kind'] ?? null) === 'shipping') {
                    $freeShippingReason = 'threshold';
                    break;
                }
            }
        }
    }
    // an item-count rule has no amount to show progress towards (the engine still applies it)
    [$thresholdHas, $threshold] = mvp_free_shipping_from(mvp_active_shipping_rule($discounts, $now));
    // threshold base = subtotal after product discounts (same as the engine)
    $freeShippingRemaining = $threshold !== null ? mvp_max(0.0, mvp_round2(mvp_num($threshold) - ($subtotal - $res['productDiscount']))) : 0.0;

    /* ---------- legacy single-coupon view ---------- */
    $first = $codes[0] ?? null;
    $firstApplied = null;
    if ($first !== null) {
        foreach ($res['applied'] as $a) {
            if (($a['code'] ?? null) === $first) {
                $firstApplied = $a;
                break;
            }
        }
    }
    $firstRule = null;
    if ($firstApplied !== null) {
        foreach ($discounts as $d) {
            if (mvp_same_prop($d, $firstApplied, 'id')) {
                $firstRule = $d;
                break;
            }
        }
    }
    $coupon = $firstApplied !== null && $firstRule !== null ? mvp_coupon_view($firstRule, $firstApplied) : null;
    $firstRejected = null;
    if ($first !== null && $coupon === null) {
        foreach ($res['rejected'] as $r) {
            if ($r['code'] === $first) {
                $firstRejected = $r;
                break;
            }
        }
    }
    $couponMinimum = null;
    if ($firstRejected !== null && $firstRejected['reason'] === 'minimum') {
        $d = null;
        foreach ($discounts as $x) {
            if (mvp_same_prop($x, $firstRejected, 'id')) {
                $d = $x;
                break;
            }
        }
        $mv = $d !== null && is_array($d['minimum'] ?? null) ? ($d['minimum']['value'] ?? null) : null;
        $couponMinimum = ['value' => $mv ?? 0, 'missing' => $firstRejected['missing'] ?? 0, 'type' => $firstRejected['minimumType'] ?? 'amount'];
    }

    $total = mvp_round2($subtotal + $installationTotal - $discount + $shipping);
    $vat = mvp_round2($total - $total / (1 + mvp_numk($settings, 'vatRate') / 100));
    $count = 0.0;
    foreach ($lines as $l) {
        $u = $l['p']['unit'] ?? null;
        $count += ($u === 'kom' || $u === 'set') ? (array_key_exists('qty', $l['item']) ? mvp_num($l['item']['qty']) : NAN) : 1.0;
    }
    $out = [
        'lines' => $priced,
        'count' => $count,
        'subtotal' => $subtotal,
        'installationTotal' => $installationTotal,
        'discount' => $discount,
        'shipping' => $shipping,
        'shippingEstimate' => $shippingEstimate && $shipping > 0,
        'freeShippingReason' => $freeShippingReason,
        'freeShippingRemaining' => $freeShippingRemaining,
        'total' => $total,
        'vat' => $vat,
        'hasInstallation' => $hasInstallation,
        'coupon' => $coupon,
    ];
    if ($firstRejected !== null) $out['couponError'] = $firstRejected['reason'] === 'minimum' ? 'min' : $firstRejected['reason'];
    $out['codes'] = $codes;
    $out['applied'] = $res['applied'];
    $out['rejected'] = $res['rejected'];
    $out['productDiscount'] = $res['productDiscount'];
    $out['orderDiscount'] = $res['orderDiscount'];
    $out['shippingDiscount'] = $res['shippingDiscount'];
    if ($feeHas) $out['shippingBeforeDiscount'] = $fee;
    if ($thresholdHas) $out['freeShippingThreshold'] = $threshold;
    if ($couponMinimum !== null) $out['couponMinimum'] = $couponMinimum;
    return mvp_jsonish($out);
}

/* ================================================================== */
/* Unicode tables (generated)                                          */
/* ================================================================== */
// <fold-tables>
/** c → c.normalize('NFD') without U+0300–036F — 967 entries, generated by server/tests/pricing/gen-fold-tables.mjs (Node 24.19.0, Unicode 17.0). */
function mvp_nfd_map(): array
{
    static $m = null;
    return $m ??= [
        "\u{C0}"=>'A', "\u{C1}"=>'A', "\u{C2}"=>'A', "\u{C3}"=>'A', "\u{C4}"=>'A', "\u{C5}"=>'A', "\u{C7}"=>'C', "\u{C8}"=>'E',
        "\u{C9}"=>'E', "\u{CA}"=>'E', "\u{CB}"=>'E', "\u{CC}"=>'I', "\u{CD}"=>'I', "\u{CE}"=>'I', "\u{CF}"=>'I', "\u{D1}"=>'N',
        "\u{D2}"=>'O', "\u{D3}"=>'O', "\u{D4}"=>'O', "\u{D5}"=>'O', "\u{D6}"=>'O', "\u{D9}"=>'U', "\u{DA}"=>'U', "\u{DB}"=>'U',
        "\u{DC}"=>'U', "\u{DD}"=>'Y', "\u{E0}"=>'a', "\u{E1}"=>'a', "\u{E2}"=>'a', "\u{E3}"=>'a', "\u{E4}"=>'a', "\u{E5}"=>'a',
        "\u{E7}"=>'c', "\u{E8}"=>'e', "\u{E9}"=>'e', "\u{EA}"=>'e', "\u{EB}"=>'e', "\u{EC}"=>'i', "\u{ED}"=>'i', "\u{EE}"=>'i',
        "\u{EF}"=>'i', "\u{F1}"=>'n', "\u{F2}"=>'o', "\u{F3}"=>'o', "\u{F4}"=>'o', "\u{F5}"=>'o', "\u{F6}"=>'o', "\u{F9}"=>'u',
        "\u{FA}"=>'u', "\u{FB}"=>'u', "\u{FC}"=>'u', "\u{FD}"=>'y', "\u{FF}"=>'y', "\u{100}"=>'A', "\u{101}"=>'a', "\u{102}"=>'A',
        "\u{103}"=>'a', "\u{104}"=>'A', "\u{105}"=>'a', "\u{106}"=>'C', "\u{107}"=>'c', "\u{108}"=>'C', "\u{109}"=>'c', "\u{10A}"=>'C',
        "\u{10B}"=>'c', "\u{10C}"=>'C', "\u{10D}"=>'c', "\u{10E}"=>'D', "\u{10F}"=>'d', "\u{112}"=>'E', "\u{113}"=>'e', "\u{114}"=>'E',
        "\u{115}"=>'e', "\u{116}"=>'E', "\u{117}"=>'e', "\u{118}"=>'E', "\u{119}"=>'e', "\u{11A}"=>'E', "\u{11B}"=>'e', "\u{11C}"=>'G',
        "\u{11D}"=>'g', "\u{11E}"=>'G', "\u{11F}"=>'g', "\u{120}"=>'G', "\u{121}"=>'g', "\u{122}"=>'G', "\u{123}"=>'g', "\u{124}"=>'H',
        "\u{125}"=>'h', "\u{128}"=>'I', "\u{129}"=>'i', "\u{12A}"=>'I', "\u{12B}"=>'i', "\u{12C}"=>'I', "\u{12D}"=>'i', "\u{12E}"=>'I',
        "\u{12F}"=>'i', "\u{130}"=>'I', "\u{134}"=>'J', "\u{135}"=>'j', "\u{136}"=>'K', "\u{137}"=>'k', "\u{139}"=>'L', "\u{13A}"=>'l',
        "\u{13B}"=>'L', "\u{13C}"=>'l', "\u{13D}"=>'L', "\u{13E}"=>'l', "\u{143}"=>'N', "\u{144}"=>'n', "\u{145}"=>'N', "\u{146}"=>'n',
        "\u{147}"=>'N', "\u{148}"=>'n', "\u{14C}"=>'O', "\u{14D}"=>'o', "\u{14E}"=>'O', "\u{14F}"=>'o', "\u{150}"=>'O', "\u{151}"=>'o',
        "\u{154}"=>'R', "\u{155}"=>'r', "\u{156}"=>'R', "\u{157}"=>'r', "\u{158}"=>'R', "\u{159}"=>'r', "\u{15A}"=>'S', "\u{15B}"=>'s',
        "\u{15C}"=>'S', "\u{15D}"=>'s', "\u{15E}"=>'S', "\u{15F}"=>'s', "\u{160}"=>'S', "\u{161}"=>'s', "\u{162}"=>'T', "\u{163}"=>'t',
        "\u{164}"=>'T', "\u{165}"=>'t', "\u{168}"=>'U', "\u{169}"=>'u', "\u{16A}"=>'U', "\u{16B}"=>'u', "\u{16C}"=>'U', "\u{16D}"=>'u',
        "\u{16E}"=>'U', "\u{16F}"=>'u', "\u{170}"=>'U', "\u{171}"=>'u', "\u{172}"=>'U', "\u{173}"=>'u', "\u{174}"=>'W', "\u{175}"=>'w',
        "\u{176}"=>'Y', "\u{177}"=>'y', "\u{178}"=>'Y', "\u{179}"=>'Z', "\u{17A}"=>'z', "\u{17B}"=>'Z', "\u{17C}"=>'z', "\u{17D}"=>'Z',
        "\u{17E}"=>'z', "\u{1A0}"=>'O', "\u{1A1}"=>'o', "\u{1AF}"=>'U', "\u{1B0}"=>'u', "\u{1CD}"=>'A', "\u{1CE}"=>'a', "\u{1CF}"=>'I',
        "\u{1D0}"=>'i', "\u{1D1}"=>'O', "\u{1D2}"=>'o', "\u{1D3}"=>'U', "\u{1D4}"=>'u', "\u{1D5}"=>'U', "\u{1D6}"=>'u', "\u{1D7}"=>'U',
        "\u{1D8}"=>'u', "\u{1D9}"=>'U', "\u{1DA}"=>'u', "\u{1DB}"=>'U', "\u{1DC}"=>'u', "\u{1DE}"=>'A', "\u{1DF}"=>'a', "\u{1E0}"=>'A',
        "\u{1E1}"=>'a', "\u{1E2}"=>"\u{C6}", "\u{1E3}"=>"\u{E6}", "\u{1E6}"=>'G', "\u{1E7}"=>'g', "\u{1E8}"=>'K', "\u{1E9}"=>'k', "\u{1EA}"=>'O',
        "\u{1EB}"=>'o', "\u{1EC}"=>'O', "\u{1ED}"=>'o', "\u{1EE}"=>"\u{1B7}", "\u{1EF}"=>"\u{292}", "\u{1F0}"=>'j', "\u{1F4}"=>'G', "\u{1F5}"=>'g',
        "\u{1F8}"=>'N', "\u{1F9}"=>'n', "\u{1FA}"=>'A', "\u{1FB}"=>'a', "\u{1FC}"=>"\u{C6}", "\u{1FD}"=>"\u{E6}", "\u{1FE}"=>"\u{D8}", "\u{1FF}"=>"\u{F8}",
        "\u{200}"=>'A', "\u{201}"=>'a', "\u{202}"=>'A', "\u{203}"=>'a', "\u{204}"=>'E', "\u{205}"=>'e', "\u{206}"=>'E', "\u{207}"=>'e',
        "\u{208}"=>'I', "\u{209}"=>'i', "\u{20A}"=>'I', "\u{20B}"=>'i', "\u{20C}"=>'O', "\u{20D}"=>'o', "\u{20E}"=>'O', "\u{20F}"=>'o',
        "\u{210}"=>'R', "\u{211}"=>'r', "\u{212}"=>'R', "\u{213}"=>'r', "\u{214}"=>'U', "\u{215}"=>'u', "\u{216}"=>'U', "\u{217}"=>'u',
        "\u{218}"=>'S', "\u{219}"=>'s', "\u{21A}"=>'T', "\u{21B}"=>'t', "\u{21E}"=>'H', "\u{21F}"=>'h', "\u{226}"=>'A', "\u{227}"=>'a',
        "\u{228}"=>'E', "\u{229}"=>'e', "\u{22A}"=>'O', "\u{22B}"=>'o', "\u{22C}"=>'O', "\u{22D}"=>'o', "\u{22E}"=>'O', "\u{22F}"=>'o',
        "\u{230}"=>'O', "\u{231}"=>'o', "\u{232}"=>'Y', "\u{233}"=>'y', "\u{300}"=>'', "\u{301}"=>'', "\u{302}"=>'', "\u{303}"=>'',
        "\u{304}"=>'', "\u{305}"=>'', "\u{306}"=>'', "\u{307}"=>'', "\u{308}"=>'', "\u{309}"=>'', "\u{30A}"=>'', "\u{30B}"=>'',
        "\u{30C}"=>'', "\u{30D}"=>'', "\u{30E}"=>'', "\u{30F}"=>'', "\u{310}"=>'', "\u{311}"=>'', "\u{312}"=>'', "\u{313}"=>'',
        "\u{314}"=>'', "\u{315}"=>'', "\u{316}"=>'', "\u{317}"=>'', "\u{318}"=>'', "\u{319}"=>'', "\u{31A}"=>'', "\u{31B}"=>'',
        "\u{31C}"=>'', "\u{31D}"=>'', "\u{31E}"=>'', "\u{31F}"=>'', "\u{320}"=>'', "\u{321}"=>'', "\u{322}"=>'', "\u{323}"=>'',
        "\u{324}"=>'', "\u{325}"=>'', "\u{326}"=>'', "\u{327}"=>'', "\u{328}"=>'', "\u{329}"=>'', "\u{32A}"=>'', "\u{32B}"=>'',
        "\u{32C}"=>'', "\u{32D}"=>'', "\u{32E}"=>'', "\u{32F}"=>'', "\u{330}"=>'', "\u{331}"=>'', "\u{332}"=>'', "\u{333}"=>'',
        "\u{334}"=>'', "\u{335}"=>'', "\u{336}"=>'', "\u{337}"=>'', "\u{338}"=>'', "\u{339}"=>'', "\u{33A}"=>'', "\u{33B}"=>'',
        "\u{33C}"=>'', "\u{33D}"=>'', "\u{33E}"=>'', "\u{33F}"=>'', "\u{340}"=>'', "\u{341}"=>'', "\u{342}"=>'', "\u{343}"=>'',
        "\u{344}"=>'', "\u{345}"=>'', "\u{346}"=>'', "\u{347}"=>'', "\u{348}"=>'', "\u{349}"=>'', "\u{34A}"=>'', "\u{34B}"=>'',
        "\u{34C}"=>'', "\u{34D}"=>'', "\u{34E}"=>'', "\u{34F}"=>'', "\u{350}"=>'', "\u{351}"=>'', "\u{352}"=>'', "\u{353}"=>'',
        "\u{354}"=>'', "\u{355}"=>'', "\u{356}"=>'', "\u{357}"=>'', "\u{358}"=>'', "\u{359}"=>'', "\u{35A}"=>'', "\u{35B}"=>'',
        "\u{35C}"=>'', "\u{35D}"=>'', "\u{35E}"=>'', "\u{35F}"=>'', "\u{360}"=>'', "\u{361}"=>'', "\u{362}"=>'', "\u{363}"=>'',
        "\u{364}"=>'', "\u{365}"=>'', "\u{366}"=>'', "\u{367}"=>'', "\u{368}"=>'', "\u{369}"=>'', "\u{36A}"=>'', "\u{36B}"=>'',
        "\u{36C}"=>'', "\u{36D}"=>'', "\u{36E}"=>'', "\u{36F}"=>'', "\u{374}"=>"\u{2B9}", "\u{37E}"=>';', "\u{385}"=>"\u{A8}", "\u{386}"=>"\u{391}",
        "\u{387}"=>"\u{B7}", "\u{388}"=>"\u{395}", "\u{389}"=>"\u{397}", "\u{38A}"=>"\u{399}", "\u{38C}"=>"\u{39F}", "\u{38E}"=>"\u{3A5}", "\u{38F}"=>"\u{3A9}", "\u{390}"=>"\u{3B9}",
        "\u{3AA}"=>"\u{399}", "\u{3AB}"=>"\u{3A5}", "\u{3AC}"=>"\u{3B1}", "\u{3AD}"=>"\u{3B5}", "\u{3AE}"=>"\u{3B7}", "\u{3AF}"=>"\u{3B9}", "\u{3B0}"=>"\u{3C5}", "\u{3CA}"=>"\u{3B9}",
        "\u{3CB}"=>"\u{3C5}", "\u{3CC}"=>"\u{3BF}", "\u{3CD}"=>"\u{3C5}", "\u{3CE}"=>"\u{3C9}", "\u{3D3}"=>"\u{3D2}", "\u{3D4}"=>"\u{3D2}", "\u{400}"=>"\u{415}", "\u{401}"=>"\u{415}",
        "\u{403}"=>"\u{413}", "\u{407}"=>"\u{406}", "\u{40C}"=>"\u{41A}", "\u{40D}"=>"\u{418}", "\u{40E}"=>"\u{423}", "\u{419}"=>"\u{418}", "\u{439}"=>"\u{438}", "\u{450}"=>"\u{435}",
        "\u{451}"=>"\u{435}", "\u{453}"=>"\u{433}", "\u{457}"=>"\u{456}", "\u{45C}"=>"\u{43A}", "\u{45D}"=>"\u{438}", "\u{45E}"=>"\u{443}", "\u{476}"=>"\u{474}", "\u{477}"=>"\u{475}",
        "\u{4C1}"=>"\u{416}", "\u{4C2}"=>"\u{436}", "\u{4D0}"=>"\u{410}", "\u{4D1}"=>"\u{430}", "\u{4D2}"=>"\u{410}", "\u{4D3}"=>"\u{430}", "\u{4D6}"=>"\u{415}", "\u{4D7}"=>"\u{435}",
        "\u{4DA}"=>"\u{4D8}", "\u{4DB}"=>"\u{4D9}", "\u{4DC}"=>"\u{416}", "\u{4DD}"=>"\u{436}", "\u{4DE}"=>"\u{417}", "\u{4DF}"=>"\u{437}", "\u{4E2}"=>"\u{418}", "\u{4E3}"=>"\u{438}",
        "\u{4E4}"=>"\u{418}", "\u{4E5}"=>"\u{438}", "\u{4E6}"=>"\u{41E}", "\u{4E7}"=>"\u{43E}", "\u{4EA}"=>"\u{4E8}", "\u{4EB}"=>"\u{4E9}", "\u{4EC}"=>"\u{42D}", "\u{4ED}"=>"\u{44D}",
        "\u{4EE}"=>"\u{423}", "\u{4EF}"=>"\u{443}", "\u{4F0}"=>"\u{423}", "\u{4F1}"=>"\u{443}", "\u{4F2}"=>"\u{423}", "\u{4F3}"=>"\u{443}", "\u{4F4}"=>"\u{427}", "\u{4F5}"=>"\u{447}",
        "\u{4F8}"=>"\u{42B}", "\u{4F9}"=>"\u{44B}", "\u{1E00}"=>'A', "\u{1E01}"=>'a', "\u{1E02}"=>'B', "\u{1E03}"=>'b', "\u{1E04}"=>'B', "\u{1E05}"=>'b',
        "\u{1E06}"=>'B', "\u{1E07}"=>'b', "\u{1E08}"=>'C', "\u{1E09}"=>'c', "\u{1E0A}"=>'D', "\u{1E0B}"=>'d', "\u{1E0C}"=>'D', "\u{1E0D}"=>'d',
        "\u{1E0E}"=>'D', "\u{1E0F}"=>'d', "\u{1E10}"=>'D', "\u{1E11}"=>'d', "\u{1E12}"=>'D', "\u{1E13}"=>'d', "\u{1E14}"=>'E', "\u{1E15}"=>'e',
        "\u{1E16}"=>'E', "\u{1E17}"=>'e', "\u{1E18}"=>'E', "\u{1E19}"=>'e', "\u{1E1A}"=>'E', "\u{1E1B}"=>'e', "\u{1E1C}"=>'E', "\u{1E1D}"=>'e',
        "\u{1E1E}"=>'F', "\u{1E1F}"=>'f', "\u{1E20}"=>'G', "\u{1E21}"=>'g', "\u{1E22}"=>'H', "\u{1E23}"=>'h', "\u{1E24}"=>'H', "\u{1E25}"=>'h',
        "\u{1E26}"=>'H', "\u{1E27}"=>'h', "\u{1E28}"=>'H', "\u{1E29}"=>'h', "\u{1E2A}"=>'H', "\u{1E2B}"=>'h', "\u{1E2C}"=>'I', "\u{1E2D}"=>'i',
        "\u{1E2E}"=>'I', "\u{1E2F}"=>'i', "\u{1E30}"=>'K', "\u{1E31}"=>'k', "\u{1E32}"=>'K', "\u{1E33}"=>'k', "\u{1E34}"=>'K', "\u{1E35}"=>'k',
        "\u{1E36}"=>'L', "\u{1E37}"=>'l', "\u{1E38}"=>'L', "\u{1E39}"=>'l', "\u{1E3A}"=>'L', "\u{1E3B}"=>'l', "\u{1E3C}"=>'L', "\u{1E3D}"=>'l',
        "\u{1E3E}"=>'M', "\u{1E3F}"=>'m', "\u{1E40}"=>'M', "\u{1E41}"=>'m', "\u{1E42}"=>'M', "\u{1E43}"=>'m', "\u{1E44}"=>'N', "\u{1E45}"=>'n',
        "\u{1E46}"=>'N', "\u{1E47}"=>'n', "\u{1E48}"=>'N', "\u{1E49}"=>'n', "\u{1E4A}"=>'N', "\u{1E4B}"=>'n', "\u{1E4C}"=>'O', "\u{1E4D}"=>'o',
        "\u{1E4E}"=>'O', "\u{1E4F}"=>'o', "\u{1E50}"=>'O', "\u{1E51}"=>'o', "\u{1E52}"=>'O', "\u{1E53}"=>'o', "\u{1E54}"=>'P', "\u{1E55}"=>'p',
        "\u{1E56}"=>'P', "\u{1E57}"=>'p', "\u{1E58}"=>'R', "\u{1E59}"=>'r', "\u{1E5A}"=>'R', "\u{1E5B}"=>'r', "\u{1E5C}"=>'R', "\u{1E5D}"=>'r',
        "\u{1E5E}"=>'R', "\u{1E5F}"=>'r', "\u{1E60}"=>'S', "\u{1E61}"=>'s', "\u{1E62}"=>'S', "\u{1E63}"=>'s', "\u{1E64}"=>'S', "\u{1E65}"=>'s',
        "\u{1E66}"=>'S', "\u{1E67}"=>'s', "\u{1E68}"=>'S', "\u{1E69}"=>'s', "\u{1E6A}"=>'T', "\u{1E6B}"=>'t', "\u{1E6C}"=>'T', "\u{1E6D}"=>'t',
        "\u{1E6E}"=>'T', "\u{1E6F}"=>'t', "\u{1E70}"=>'T', "\u{1E71}"=>'t', "\u{1E72}"=>'U', "\u{1E73}"=>'u', "\u{1E74}"=>'U', "\u{1E75}"=>'u',
        "\u{1E76}"=>'U', "\u{1E77}"=>'u', "\u{1E78}"=>'U', "\u{1E79}"=>'u', "\u{1E7A}"=>'U', "\u{1E7B}"=>'u', "\u{1E7C}"=>'V', "\u{1E7D}"=>'v',
        "\u{1E7E}"=>'V', "\u{1E7F}"=>'v', "\u{1E80}"=>'W', "\u{1E81}"=>'w', "\u{1E82}"=>'W', "\u{1E83}"=>'w', "\u{1E84}"=>'W', "\u{1E85}"=>'w',
        "\u{1E86}"=>'W', "\u{1E87}"=>'w', "\u{1E88}"=>'W', "\u{1E89}"=>'w', "\u{1E8A}"=>'X', "\u{1E8B}"=>'x', "\u{1E8C}"=>'X', "\u{1E8D}"=>'x',
        "\u{1E8E}"=>'Y', "\u{1E8F}"=>'y', "\u{1E90}"=>'Z', "\u{1E91}"=>'z', "\u{1E92}"=>'Z', "\u{1E93}"=>'z', "\u{1E94}"=>'Z', "\u{1E95}"=>'z',
        "\u{1E96}"=>'h', "\u{1E97}"=>'t', "\u{1E98}"=>'w', "\u{1E99}"=>'y', "\u{1E9B}"=>"\u{17F}", "\u{1EA0}"=>'A', "\u{1EA1}"=>'a', "\u{1EA2}"=>'A',
        "\u{1EA3}"=>'a', "\u{1EA4}"=>'A', "\u{1EA5}"=>'a', "\u{1EA6}"=>'A', "\u{1EA7}"=>'a', "\u{1EA8}"=>'A', "\u{1EA9}"=>'a', "\u{1EAA}"=>'A',
        "\u{1EAB}"=>'a', "\u{1EAC}"=>'A', "\u{1EAD}"=>'a', "\u{1EAE}"=>'A', "\u{1EAF}"=>'a', "\u{1EB0}"=>'A', "\u{1EB1}"=>'a', "\u{1EB2}"=>'A',
        "\u{1EB3}"=>'a', "\u{1EB4}"=>'A', "\u{1EB5}"=>'a', "\u{1EB6}"=>'A', "\u{1EB7}"=>'a', "\u{1EB8}"=>'E', "\u{1EB9}"=>'e', "\u{1EBA}"=>'E',
        "\u{1EBB}"=>'e', "\u{1EBC}"=>'E', "\u{1EBD}"=>'e', "\u{1EBE}"=>'E', "\u{1EBF}"=>'e', "\u{1EC0}"=>'E', "\u{1EC1}"=>'e', "\u{1EC2}"=>'E',
        "\u{1EC3}"=>'e', "\u{1EC4}"=>'E', "\u{1EC5}"=>'e', "\u{1EC6}"=>'E', "\u{1EC7}"=>'e', "\u{1EC8}"=>'I', "\u{1EC9}"=>'i', "\u{1ECA}"=>'I',
        "\u{1ECB}"=>'i', "\u{1ECC}"=>'O', "\u{1ECD}"=>'o', "\u{1ECE}"=>'O', "\u{1ECF}"=>'o', "\u{1ED0}"=>'O', "\u{1ED1}"=>'o', "\u{1ED2}"=>'O',
        "\u{1ED3}"=>'o', "\u{1ED4}"=>'O', "\u{1ED5}"=>'o', "\u{1ED6}"=>'O', "\u{1ED7}"=>'o', "\u{1ED8}"=>'O', "\u{1ED9}"=>'o', "\u{1EDA}"=>'O',
        "\u{1EDB}"=>'o', "\u{1EDC}"=>'O', "\u{1EDD}"=>'o', "\u{1EDE}"=>'O', "\u{1EDF}"=>'o', "\u{1EE0}"=>'O', "\u{1EE1}"=>'o', "\u{1EE2}"=>'O',
        "\u{1EE3}"=>'o', "\u{1EE4}"=>'U', "\u{1EE5}"=>'u', "\u{1EE6}"=>'U', "\u{1EE7}"=>'u', "\u{1EE8}"=>'U', "\u{1EE9}"=>'u', "\u{1EEA}"=>'U',
        "\u{1EEB}"=>'u', "\u{1EEC}"=>'U', "\u{1EED}"=>'u', "\u{1EEE}"=>'U', "\u{1EEF}"=>'u', "\u{1EF0}"=>'U', "\u{1EF1}"=>'u', "\u{1EF2}"=>'Y',
        "\u{1EF3}"=>'y', "\u{1EF4}"=>'Y', "\u{1EF5}"=>'y', "\u{1EF6}"=>'Y', "\u{1EF7}"=>'y', "\u{1EF8}"=>'Y', "\u{1EF9}"=>'y', "\u{1F00}"=>"\u{3B1}",
        "\u{1F01}"=>"\u{3B1}", "\u{1F02}"=>"\u{3B1}", "\u{1F03}"=>"\u{3B1}", "\u{1F04}"=>"\u{3B1}", "\u{1F05}"=>"\u{3B1}", "\u{1F06}"=>"\u{3B1}", "\u{1F07}"=>"\u{3B1}", "\u{1F08}"=>"\u{391}",
        "\u{1F09}"=>"\u{391}", "\u{1F0A}"=>"\u{391}", "\u{1F0B}"=>"\u{391}", "\u{1F0C}"=>"\u{391}", "\u{1F0D}"=>"\u{391}", "\u{1F0E}"=>"\u{391}", "\u{1F0F}"=>"\u{391}", "\u{1F10}"=>"\u{3B5}",
        "\u{1F11}"=>"\u{3B5}", "\u{1F12}"=>"\u{3B5}", "\u{1F13}"=>"\u{3B5}", "\u{1F14}"=>"\u{3B5}", "\u{1F15}"=>"\u{3B5}", "\u{1F18}"=>"\u{395}", "\u{1F19}"=>"\u{395}", "\u{1F1A}"=>"\u{395}",
        "\u{1F1B}"=>"\u{395}", "\u{1F1C}"=>"\u{395}", "\u{1F1D}"=>"\u{395}", "\u{1F20}"=>"\u{3B7}", "\u{1F21}"=>"\u{3B7}", "\u{1F22}"=>"\u{3B7}", "\u{1F23}"=>"\u{3B7}", "\u{1F24}"=>"\u{3B7}",
        "\u{1F25}"=>"\u{3B7}", "\u{1F26}"=>"\u{3B7}", "\u{1F27}"=>"\u{3B7}", "\u{1F28}"=>"\u{397}", "\u{1F29}"=>"\u{397}", "\u{1F2A}"=>"\u{397}", "\u{1F2B}"=>"\u{397}", "\u{1F2C}"=>"\u{397}",
        "\u{1F2D}"=>"\u{397}", "\u{1F2E}"=>"\u{397}", "\u{1F2F}"=>"\u{397}", "\u{1F30}"=>"\u{3B9}", "\u{1F31}"=>"\u{3B9}", "\u{1F32}"=>"\u{3B9}", "\u{1F33}"=>"\u{3B9}", "\u{1F34}"=>"\u{3B9}",
        "\u{1F35}"=>"\u{3B9}", "\u{1F36}"=>"\u{3B9}", "\u{1F37}"=>"\u{3B9}", "\u{1F38}"=>"\u{399}", "\u{1F39}"=>"\u{399}", "\u{1F3A}"=>"\u{399}", "\u{1F3B}"=>"\u{399}", "\u{1F3C}"=>"\u{399}",
        "\u{1F3D}"=>"\u{399}", "\u{1F3E}"=>"\u{399}", "\u{1F3F}"=>"\u{399}", "\u{1F40}"=>"\u{3BF}", "\u{1F41}"=>"\u{3BF}", "\u{1F42}"=>"\u{3BF}", "\u{1F43}"=>"\u{3BF}", "\u{1F44}"=>"\u{3BF}",
        "\u{1F45}"=>"\u{3BF}", "\u{1F48}"=>"\u{39F}", "\u{1F49}"=>"\u{39F}", "\u{1F4A}"=>"\u{39F}", "\u{1F4B}"=>"\u{39F}", "\u{1F4C}"=>"\u{39F}", "\u{1F4D}"=>"\u{39F}", "\u{1F50}"=>"\u{3C5}",
        "\u{1F51}"=>"\u{3C5}", "\u{1F52}"=>"\u{3C5}", "\u{1F53}"=>"\u{3C5}", "\u{1F54}"=>"\u{3C5}", "\u{1F55}"=>"\u{3C5}", "\u{1F56}"=>"\u{3C5}", "\u{1F57}"=>"\u{3C5}", "\u{1F59}"=>"\u{3A5}",
        "\u{1F5B}"=>"\u{3A5}", "\u{1F5D}"=>"\u{3A5}", "\u{1F5F}"=>"\u{3A5}", "\u{1F60}"=>"\u{3C9}", "\u{1F61}"=>"\u{3C9}", "\u{1F62}"=>"\u{3C9}", "\u{1F63}"=>"\u{3C9}", "\u{1F64}"=>"\u{3C9}",
        "\u{1F65}"=>"\u{3C9}", "\u{1F66}"=>"\u{3C9}", "\u{1F67}"=>"\u{3C9}", "\u{1F68}"=>"\u{3A9}", "\u{1F69}"=>"\u{3A9}", "\u{1F6A}"=>"\u{3A9}", "\u{1F6B}"=>"\u{3A9}", "\u{1F6C}"=>"\u{3A9}",
        "\u{1F6D}"=>"\u{3A9}", "\u{1F6E}"=>"\u{3A9}", "\u{1F6F}"=>"\u{3A9}", "\u{1F70}"=>"\u{3B1}", "\u{1F71}"=>"\u{3B1}", "\u{1F72}"=>"\u{3B5}", "\u{1F73}"=>"\u{3B5}", "\u{1F74}"=>"\u{3B7}",
        "\u{1F75}"=>"\u{3B7}", "\u{1F76}"=>"\u{3B9}", "\u{1F77}"=>"\u{3B9}", "\u{1F78}"=>"\u{3BF}", "\u{1F79}"=>"\u{3BF}", "\u{1F7A}"=>"\u{3C5}", "\u{1F7B}"=>"\u{3C5}", "\u{1F7C}"=>"\u{3C9}",
        "\u{1F7D}"=>"\u{3C9}", "\u{1F80}"=>"\u{3B1}", "\u{1F81}"=>"\u{3B1}", "\u{1F82}"=>"\u{3B1}", "\u{1F83}"=>"\u{3B1}", "\u{1F84}"=>"\u{3B1}", "\u{1F85}"=>"\u{3B1}", "\u{1F86}"=>"\u{3B1}",
        "\u{1F87}"=>"\u{3B1}", "\u{1F88}"=>"\u{391}", "\u{1F89}"=>"\u{391}", "\u{1F8A}"=>"\u{391}", "\u{1F8B}"=>"\u{391}", "\u{1F8C}"=>"\u{391}", "\u{1F8D}"=>"\u{391}", "\u{1F8E}"=>"\u{391}",
        "\u{1F8F}"=>"\u{391}", "\u{1F90}"=>"\u{3B7}", "\u{1F91}"=>"\u{3B7}", "\u{1F92}"=>"\u{3B7}", "\u{1F93}"=>"\u{3B7}", "\u{1F94}"=>"\u{3B7}", "\u{1F95}"=>"\u{3B7}", "\u{1F96}"=>"\u{3B7}",
        "\u{1F97}"=>"\u{3B7}", "\u{1F98}"=>"\u{397}", "\u{1F99}"=>"\u{397}", "\u{1F9A}"=>"\u{397}", "\u{1F9B}"=>"\u{397}", "\u{1F9C}"=>"\u{397}", "\u{1F9D}"=>"\u{397}", "\u{1F9E}"=>"\u{397}",
        "\u{1F9F}"=>"\u{397}", "\u{1FA0}"=>"\u{3C9}", "\u{1FA1}"=>"\u{3C9}", "\u{1FA2}"=>"\u{3C9}", "\u{1FA3}"=>"\u{3C9}", "\u{1FA4}"=>"\u{3C9}", "\u{1FA5}"=>"\u{3C9}", "\u{1FA6}"=>"\u{3C9}",
        "\u{1FA7}"=>"\u{3C9}", "\u{1FA8}"=>"\u{3A9}", "\u{1FA9}"=>"\u{3A9}", "\u{1FAA}"=>"\u{3A9}", "\u{1FAB}"=>"\u{3A9}", "\u{1FAC}"=>"\u{3A9}", "\u{1FAD}"=>"\u{3A9}", "\u{1FAE}"=>"\u{3A9}",
        "\u{1FAF}"=>"\u{3A9}", "\u{1FB0}"=>"\u{3B1}", "\u{1FB1}"=>"\u{3B1}", "\u{1FB2}"=>"\u{3B1}", "\u{1FB3}"=>"\u{3B1}", "\u{1FB4}"=>"\u{3B1}", "\u{1FB6}"=>"\u{3B1}", "\u{1FB7}"=>"\u{3B1}",
        "\u{1FB8}"=>"\u{391}", "\u{1FB9}"=>"\u{391}", "\u{1FBA}"=>"\u{391}", "\u{1FBB}"=>"\u{391}", "\u{1FBC}"=>"\u{391}", "\u{1FBE}"=>"\u{3B9}", "\u{1FC1}"=>"\u{A8}", "\u{1FC2}"=>"\u{3B7}",
        "\u{1FC3}"=>"\u{3B7}", "\u{1FC4}"=>"\u{3B7}", "\u{1FC6}"=>"\u{3B7}", "\u{1FC7}"=>"\u{3B7}", "\u{1FC8}"=>"\u{395}", "\u{1FC9}"=>"\u{395}", "\u{1FCA}"=>"\u{397}", "\u{1FCB}"=>"\u{397}",
        "\u{1FCC}"=>"\u{397}", "\u{1FCD}"=>"\u{1FBF}", "\u{1FCE}"=>"\u{1FBF}", "\u{1FCF}"=>"\u{1FBF}", "\u{1FD0}"=>"\u{3B9}", "\u{1FD1}"=>"\u{3B9}", "\u{1FD2}"=>"\u{3B9}", "\u{1FD3}"=>"\u{3B9}",
        "\u{1FD6}"=>"\u{3B9}", "\u{1FD7}"=>"\u{3B9}", "\u{1FD8}"=>"\u{399}", "\u{1FD9}"=>"\u{399}", "\u{1FDA}"=>"\u{399}", "\u{1FDB}"=>"\u{399}", "\u{1FDD}"=>"\u{1FFE}", "\u{1FDE}"=>"\u{1FFE}",
        "\u{1FDF}"=>"\u{1FFE}", "\u{1FE0}"=>"\u{3C5}", "\u{1FE1}"=>"\u{3C5}", "\u{1FE2}"=>"\u{3C5}", "\u{1FE3}"=>"\u{3C5}", "\u{1FE4}"=>"\u{3C1}", "\u{1FE5}"=>"\u{3C1}", "\u{1FE6}"=>"\u{3C5}",
        "\u{1FE7}"=>"\u{3C5}", "\u{1FE8}"=>"\u{3A5}", "\u{1FE9}"=>"\u{3A5}", "\u{1FEA}"=>"\u{3A5}", "\u{1FEB}"=>"\u{3A5}", "\u{1FEC}"=>"\u{3A1}", "\u{1FED}"=>"\u{A8}", "\u{1FEE}"=>"\u{A8}",
        "\u{1FEF}"=>'`', "\u{1FF2}"=>"\u{3C9}", "\u{1FF3}"=>"\u{3C9}", "\u{1FF4}"=>"\u{3C9}", "\u{1FF6}"=>"\u{3C9}", "\u{1FF7}"=>"\u{3C9}", "\u{1FF8}"=>"\u{39F}", "\u{1FF9}"=>"\u{39F}",
        "\u{1FFA}"=>"\u{3A9}", "\u{1FFB}"=>"\u{3A9}", "\u{1FFC}"=>"\u{3A9}", "\u{1FFD}"=>"\u{B4}", "\u{2000}"=>"\u{2002}", "\u{2001}"=>"\u{2003}", "\u{2126}"=>"\u{3A9}", "\u{212A}"=>'K',
        "\u{212B}"=>'A', "\u{219A}"=>"\u{2190}", "\u{219B}"=>"\u{2192}", "\u{21AE}"=>"\u{2194}", "\u{21CD}"=>"\u{21D0}", "\u{21CE}"=>"\u{21D4}", "\u{21CF}"=>"\u{21D2}", "\u{2204}"=>"\u{2203}",
        "\u{2209}"=>"\u{2208}", "\u{220C}"=>"\u{220B}", "\u{2224}"=>"\u{2223}", "\u{2226}"=>"\u{2225}", "\u{2241}"=>"\u{223C}", "\u{2244}"=>"\u{2243}", "\u{2247}"=>"\u{2245}", "\u{2249}"=>"\u{2248}",
        "\u{2260}"=>'=', "\u{2262}"=>"\u{2261}", "\u{226D}"=>"\u{224D}", "\u{226E}"=>'<', "\u{226F}"=>'>', "\u{2270}"=>"\u{2264}", "\u{2271}"=>"\u{2265}", "\u{2274}"=>"\u{2272}",
        "\u{2275}"=>"\u{2273}", "\u{2278}"=>"\u{2276}", "\u{2279}"=>"\u{2277}", "\u{2280}"=>"\u{227A}", "\u{2281}"=>"\u{227B}", "\u{2284}"=>"\u{2282}", "\u{2285}"=>"\u{2283}", "\u{2288}"=>"\u{2286}",
        "\u{2289}"=>"\u{2287}", "\u{22AC}"=>"\u{22A2}", "\u{22AD}"=>"\u{22A8}", "\u{22AE}"=>"\u{22A9}", "\u{22AF}"=>"\u{22AB}", "\u{22E0}"=>"\u{227C}", "\u{22E1}"=>"\u{227D}", "\u{22E2}"=>"\u{2291}",
        "\u{22E3}"=>"\u{2292}", "\u{22EA}"=>"\u{22B2}", "\u{22EB}"=>"\u{22B3}", "\u{22EC}"=>"\u{22B4}", "\u{22ED}"=>"\u{22B5}", "\u{2329}"=>"\u{3008}", "\u{232A}"=>"\u{3009}",
    ];
}

/** c → c.normalize('NFKD') without U+0300–036F — 1560 entries, generated by server/tests/pricing/gen-fold-tables.mjs (Node 24.19.0, Unicode 17.0). */
function mvp_nfkd_map(): array
{
    static $m = null;
    return $m ??= [
        "\u{A0}"=>' ', "\u{A8}"=>' ', "\u{AA}"=>'a', "\u{AF}"=>' ', "\u{B2}"=>'2', "\u{B3}"=>'3', "\u{B4}"=>' ', "\u{B5}"=>"\u{3BC}",
        "\u{B8}"=>' ', "\u{B9}"=>'1', "\u{BA}"=>'o', "\u{BC}"=>"1\u{2044}4", "\u{BD}"=>"1\u{2044}2", "\u{BE}"=>"3\u{2044}4", "\u{C0}"=>'A', "\u{C1}"=>'A',
        "\u{C2}"=>'A', "\u{C3}"=>'A', "\u{C4}"=>'A', "\u{C5}"=>'A', "\u{C7}"=>'C', "\u{C8}"=>'E', "\u{C9}"=>'E', "\u{CA}"=>'E',
        "\u{CB}"=>'E', "\u{CC}"=>'I', "\u{CD}"=>'I', "\u{CE}"=>'I', "\u{CF}"=>'I', "\u{D1}"=>'N', "\u{D2}"=>'O', "\u{D3}"=>'O',
        "\u{D4}"=>'O', "\u{D5}"=>'O', "\u{D6}"=>'O', "\u{D9}"=>'U', "\u{DA}"=>'U', "\u{DB}"=>'U', "\u{DC}"=>'U', "\u{DD}"=>'Y',
        "\u{E0}"=>'a', "\u{E1}"=>'a', "\u{E2}"=>'a', "\u{E3}"=>'a', "\u{E4}"=>'a', "\u{E5}"=>'a', "\u{E7}"=>'c', "\u{E8}"=>'e',
        "\u{E9}"=>'e', "\u{EA}"=>'e', "\u{EB}"=>'e', "\u{EC}"=>'i', "\u{ED}"=>'i', "\u{EE}"=>'i', "\u{EF}"=>'i', "\u{F1}"=>'n',
        "\u{F2}"=>'o', "\u{F3}"=>'o', "\u{F4}"=>'o', "\u{F5}"=>'o', "\u{F6}"=>'o', "\u{F9}"=>'u', "\u{FA}"=>'u', "\u{FB}"=>'u',
        "\u{FC}"=>'u', "\u{FD}"=>'y', "\u{FF}"=>'y', "\u{100}"=>'A', "\u{101}"=>'a', "\u{102}"=>'A', "\u{103}"=>'a', "\u{104}"=>'A',
        "\u{105}"=>'a', "\u{106}"=>'C', "\u{107}"=>'c', "\u{108}"=>'C', "\u{109}"=>'c', "\u{10A}"=>'C', "\u{10B}"=>'c', "\u{10C}"=>'C',
        "\u{10D}"=>'c', "\u{10E}"=>'D', "\u{10F}"=>'d', "\u{112}"=>'E', "\u{113}"=>'e', "\u{114}"=>'E', "\u{115}"=>'e', "\u{116}"=>'E',
        "\u{117}"=>'e', "\u{118}"=>'E', "\u{119}"=>'e', "\u{11A}"=>'E', "\u{11B}"=>'e', "\u{11C}"=>'G', "\u{11D}"=>'g', "\u{11E}"=>'G',
        "\u{11F}"=>'g', "\u{120}"=>'G', "\u{121}"=>'g', "\u{122}"=>'G', "\u{123}"=>'g', "\u{124}"=>'H', "\u{125}"=>'h', "\u{128}"=>'I',
        "\u{129}"=>'i', "\u{12A}"=>'I', "\u{12B}"=>'i', "\u{12C}"=>'I', "\u{12D}"=>'i', "\u{12E}"=>'I', "\u{12F}"=>'i', "\u{130}"=>'I',
        "\u{132}"=>'IJ', "\u{133}"=>'ij', "\u{134}"=>'J', "\u{135}"=>'j', "\u{136}"=>'K', "\u{137}"=>'k', "\u{139}"=>'L', "\u{13A}"=>'l',
        "\u{13B}"=>'L', "\u{13C}"=>'l', "\u{13D}"=>'L', "\u{13E}"=>'l', "\u{13F}"=>"L\u{B7}", "\u{140}"=>"l\u{B7}", "\u{143}"=>'N', "\u{144}"=>'n',
        "\u{145}"=>'N', "\u{146}"=>'n', "\u{147}"=>'N', "\u{148}"=>'n', "\u{149}"=>"\u{2BC}n", "\u{14C}"=>'O', "\u{14D}"=>'o', "\u{14E}"=>'O',
        "\u{14F}"=>'o', "\u{150}"=>'O', "\u{151}"=>'o', "\u{154}"=>'R', "\u{155}"=>'r', "\u{156}"=>'R', "\u{157}"=>'r', "\u{158}"=>'R',
        "\u{159}"=>'r', "\u{15A}"=>'S', "\u{15B}"=>'s', "\u{15C}"=>'S', "\u{15D}"=>'s', "\u{15E}"=>'S', "\u{15F}"=>'s', "\u{160}"=>'S',
        "\u{161}"=>'s', "\u{162}"=>'T', "\u{163}"=>'t', "\u{164}"=>'T', "\u{165}"=>'t', "\u{168}"=>'U', "\u{169}"=>'u', "\u{16A}"=>'U',
        "\u{16B}"=>'u', "\u{16C}"=>'U', "\u{16D}"=>'u', "\u{16E}"=>'U', "\u{16F}"=>'u', "\u{170}"=>'U', "\u{171}"=>'u', "\u{172}"=>'U',
        "\u{173}"=>'u', "\u{174}"=>'W', "\u{175}"=>'w', "\u{176}"=>'Y', "\u{177}"=>'y', "\u{178}"=>'Y', "\u{179}"=>'Z', "\u{17A}"=>'z',
        "\u{17B}"=>'Z', "\u{17C}"=>'z', "\u{17D}"=>'Z', "\u{17E}"=>'z', "\u{17F}"=>'s', "\u{1A0}"=>'O', "\u{1A1}"=>'o', "\u{1AF}"=>'U',
        "\u{1B0}"=>'u', "\u{1C4}"=>'DZ', "\u{1C5}"=>'Dz', "\u{1C6}"=>'dz', "\u{1C7}"=>'LJ', "\u{1C8}"=>'Lj', "\u{1C9}"=>'lj', "\u{1CA}"=>'NJ',
        "\u{1CB}"=>'Nj', "\u{1CC}"=>'nj', "\u{1CD}"=>'A', "\u{1CE}"=>'a', "\u{1CF}"=>'I', "\u{1D0}"=>'i', "\u{1D1}"=>'O', "\u{1D2}"=>'o',
        "\u{1D3}"=>'U', "\u{1D4}"=>'u', "\u{1D5}"=>'U', "\u{1D6}"=>'u', "\u{1D7}"=>'U', "\u{1D8}"=>'u', "\u{1D9}"=>'U', "\u{1DA}"=>'u',
        "\u{1DB}"=>'U', "\u{1DC}"=>'u', "\u{1DE}"=>'A', "\u{1DF}"=>'a', "\u{1E0}"=>'A', "\u{1E1}"=>'a', "\u{1E2}"=>"\u{C6}", "\u{1E3}"=>"\u{E6}",
        "\u{1E6}"=>'G', "\u{1E7}"=>'g', "\u{1E8}"=>'K', "\u{1E9}"=>'k', "\u{1EA}"=>'O', "\u{1EB}"=>'o', "\u{1EC}"=>'O', "\u{1ED}"=>'o',
        "\u{1EE}"=>"\u{1B7}", "\u{1EF}"=>"\u{292}", "\u{1F0}"=>'j', "\u{1F1}"=>'DZ', "\u{1F2}"=>'Dz', "\u{1F3}"=>'dz', "\u{1F4}"=>'G', "\u{1F5}"=>'g',
        "\u{1F8}"=>'N', "\u{1F9}"=>'n', "\u{1FA}"=>'A', "\u{1FB}"=>'a', "\u{1FC}"=>"\u{C6}", "\u{1FD}"=>"\u{E6}", "\u{1FE}"=>"\u{D8}", "\u{1FF}"=>"\u{F8}",
        "\u{200}"=>'A', "\u{201}"=>'a', "\u{202}"=>'A', "\u{203}"=>'a', "\u{204}"=>'E', "\u{205}"=>'e', "\u{206}"=>'E', "\u{207}"=>'e',
        "\u{208}"=>'I', "\u{209}"=>'i', "\u{20A}"=>'I', "\u{20B}"=>'i', "\u{20C}"=>'O', "\u{20D}"=>'o', "\u{20E}"=>'O', "\u{20F}"=>'o',
        "\u{210}"=>'R', "\u{211}"=>'r', "\u{212}"=>'R', "\u{213}"=>'r', "\u{214}"=>'U', "\u{215}"=>'u', "\u{216}"=>'U', "\u{217}"=>'u',
        "\u{218}"=>'S', "\u{219}"=>'s', "\u{21A}"=>'T', "\u{21B}"=>'t', "\u{21E}"=>'H', "\u{21F}"=>'h', "\u{226}"=>'A', "\u{227}"=>'a',
        "\u{228}"=>'E', "\u{229}"=>'e', "\u{22A}"=>'O', "\u{22B}"=>'o', "\u{22C}"=>'O', "\u{22D}"=>'o', "\u{22E}"=>'O', "\u{22F}"=>'o',
        "\u{230}"=>'O', "\u{231}"=>'o', "\u{232}"=>'Y', "\u{233}"=>'y', "\u{2B0}"=>'h', "\u{2B1}"=>"\u{266}", "\u{2B2}"=>'j', "\u{2B3}"=>'r',
        "\u{2B4}"=>"\u{279}", "\u{2B5}"=>"\u{27B}", "\u{2B6}"=>"\u{281}", "\u{2B7}"=>'w', "\u{2B8}"=>'y', "\u{2D8}"=>' ', "\u{2D9}"=>' ', "\u{2DA}"=>' ',
        "\u{2DB}"=>' ', "\u{2DC}"=>' ', "\u{2DD}"=>' ', "\u{2E0}"=>"\u{263}", "\u{2E1}"=>'l', "\u{2E2}"=>'s', "\u{2E3}"=>'x', "\u{2E4}"=>"\u{295}",
        "\u{300}"=>'', "\u{301}"=>'', "\u{302}"=>'', "\u{303}"=>'', "\u{304}"=>'', "\u{305}"=>'', "\u{306}"=>'', "\u{307}"=>'',
        "\u{308}"=>'', "\u{309}"=>'', "\u{30A}"=>'', "\u{30B}"=>'', "\u{30C}"=>'', "\u{30D}"=>'', "\u{30E}"=>'', "\u{30F}"=>'',
        "\u{310}"=>'', "\u{311}"=>'', "\u{312}"=>'', "\u{313}"=>'', "\u{314}"=>'', "\u{315}"=>'', "\u{316}"=>'', "\u{317}"=>'',
        "\u{318}"=>'', "\u{319}"=>'', "\u{31A}"=>'', "\u{31B}"=>'', "\u{31C}"=>'', "\u{31D}"=>'', "\u{31E}"=>'', "\u{31F}"=>'',
        "\u{320}"=>'', "\u{321}"=>'', "\u{322}"=>'', "\u{323}"=>'', "\u{324}"=>'', "\u{325}"=>'', "\u{326}"=>'', "\u{327}"=>'',
        "\u{328}"=>'', "\u{329}"=>'', "\u{32A}"=>'', "\u{32B}"=>'', "\u{32C}"=>'', "\u{32D}"=>'', "\u{32E}"=>'', "\u{32F}"=>'',
        "\u{330}"=>'', "\u{331}"=>'', "\u{332}"=>'', "\u{333}"=>'', "\u{334}"=>'', "\u{335}"=>'', "\u{336}"=>'', "\u{337}"=>'',
        "\u{338}"=>'', "\u{339}"=>'', "\u{33A}"=>'', "\u{33B}"=>'', "\u{33C}"=>'', "\u{33D}"=>'', "\u{33E}"=>'', "\u{33F}"=>'',
        "\u{340}"=>'', "\u{341}"=>'', "\u{342}"=>'', "\u{343}"=>'', "\u{344}"=>'', "\u{345}"=>'', "\u{346}"=>'', "\u{347}"=>'',
        "\u{348}"=>'', "\u{349}"=>'', "\u{34A}"=>'', "\u{34B}"=>'', "\u{34C}"=>'', "\u{34D}"=>'', "\u{34E}"=>'', "\u{34F}"=>'',
        "\u{350}"=>'', "\u{351}"=>'', "\u{352}"=>'', "\u{353}"=>'', "\u{354}"=>'', "\u{355}"=>'', "\u{356}"=>'', "\u{357}"=>'',
        "\u{358}"=>'', "\u{359}"=>'', "\u{35A}"=>'', "\u{35B}"=>'', "\u{35C}"=>'', "\u{35D}"=>'', "\u{35E}"=>'', "\u{35F}"=>'',
        "\u{360}"=>'', "\u{361}"=>'', "\u{362}"=>'', "\u{363}"=>'', "\u{364}"=>'', "\u{365}"=>'', "\u{366}"=>'', "\u{367}"=>'',
        "\u{368}"=>'', "\u{369}"=>'', "\u{36A}"=>'', "\u{36B}"=>'', "\u{36C}"=>'', "\u{36D}"=>'', "\u{36E}"=>'', "\u{36F}"=>'',
        "\u{374}"=>"\u{2B9}", "\u{37A}"=>' ', "\u{37E}"=>';', "\u{384}"=>' ', "\u{385}"=>' ', "\u{386}"=>"\u{391}", "\u{387}"=>"\u{B7}", "\u{388}"=>"\u{395}",
        "\u{389}"=>"\u{397}", "\u{38A}"=>"\u{399}", "\u{38C}"=>"\u{39F}", "\u{38E}"=>"\u{3A5}", "\u{38F}"=>"\u{3A9}", "\u{390}"=>"\u{3B9}", "\u{3AA}"=>"\u{399}", "\u{3AB}"=>"\u{3A5}",
        "\u{3AC}"=>"\u{3B1}", "\u{3AD}"=>"\u{3B5}", "\u{3AE}"=>"\u{3B7}", "\u{3AF}"=>"\u{3B9}", "\u{3B0}"=>"\u{3C5}", "\u{3CA}"=>"\u{3B9}", "\u{3CB}"=>"\u{3C5}", "\u{3CC}"=>"\u{3BF}",
        "\u{3CD}"=>"\u{3C5}", "\u{3CE}"=>"\u{3C9}", "\u{3D0}"=>"\u{3B2}", "\u{3D1}"=>"\u{3B8}", "\u{3D2}"=>"\u{3A5}", "\u{3D3}"=>"\u{3A5}", "\u{3D4}"=>"\u{3A5}", "\u{3D5}"=>"\u{3C6}",
        "\u{3D6}"=>"\u{3C0}", "\u{3F0}"=>"\u{3BA}", "\u{3F1}"=>"\u{3C1}", "\u{3F2}"=>"\u{3C2}", "\u{3F4}"=>"\u{398}", "\u{3F5}"=>"\u{3B5}", "\u{3F9}"=>"\u{3A3}", "\u{400}"=>"\u{415}",
        "\u{401}"=>"\u{415}", "\u{403}"=>"\u{413}", "\u{407}"=>"\u{406}", "\u{40C}"=>"\u{41A}", "\u{40D}"=>"\u{418}", "\u{40E}"=>"\u{423}", "\u{419}"=>"\u{418}", "\u{439}"=>"\u{438}",
        "\u{450}"=>"\u{435}", "\u{451}"=>"\u{435}", "\u{453}"=>"\u{433}", "\u{457}"=>"\u{456}", "\u{45C}"=>"\u{43A}", "\u{45D}"=>"\u{438}", "\u{45E}"=>"\u{443}", "\u{476}"=>"\u{474}",
        "\u{477}"=>"\u{475}", "\u{4C1}"=>"\u{416}", "\u{4C2}"=>"\u{436}", "\u{4D0}"=>"\u{410}", "\u{4D1}"=>"\u{430}", "\u{4D2}"=>"\u{410}", "\u{4D3}"=>"\u{430}", "\u{4D6}"=>"\u{415}",
        "\u{4D7}"=>"\u{435}", "\u{4DA}"=>"\u{4D8}", "\u{4DB}"=>"\u{4D9}", "\u{4DC}"=>"\u{416}", "\u{4DD}"=>"\u{436}", "\u{4DE}"=>"\u{417}", "\u{4DF}"=>"\u{437}", "\u{4E2}"=>"\u{418}",
        "\u{4E3}"=>"\u{438}", "\u{4E4}"=>"\u{418}", "\u{4E5}"=>"\u{438}", "\u{4E6}"=>"\u{41E}", "\u{4E7}"=>"\u{43E}", "\u{4EA}"=>"\u{4E8}", "\u{4EB}"=>"\u{4E9}", "\u{4EC}"=>"\u{42D}",
        "\u{4ED}"=>"\u{44D}", "\u{4EE}"=>"\u{423}", "\u{4EF}"=>"\u{443}", "\u{4F0}"=>"\u{423}", "\u{4F1}"=>"\u{443}", "\u{4F2}"=>"\u{423}", "\u{4F3}"=>"\u{443}", "\u{4F4}"=>"\u{427}",
        "\u{4F5}"=>"\u{447}", "\u{4F8}"=>"\u{42B}", "\u{4F9}"=>"\u{44B}", "\u{1D2C}"=>'A', "\u{1D2D}"=>"\u{C6}", "\u{1D2E}"=>'B', "\u{1D30}"=>'D', "\u{1D31}"=>'E',
        "\u{1D32}"=>"\u{18E}", "\u{1D33}"=>'G', "\u{1D34}"=>'H', "\u{1D35}"=>'I', "\u{1D36}"=>'J', "\u{1D37}"=>'K', "\u{1D38}"=>'L', "\u{1D39}"=>'M',
        "\u{1D3A}"=>'N', "\u{1D3C}"=>'O', "\u{1D3D}"=>"\u{222}", "\u{1D3E}"=>'P', "\u{1D3F}"=>'R', "\u{1D40}"=>'T', "\u{1D41}"=>'U', "\u{1D42}"=>'W',
        "\u{1D43}"=>'a', "\u{1D44}"=>"\u{250}", "\u{1D45}"=>"\u{251}", "\u{1D46}"=>"\u{1D02}", "\u{1D47}"=>'b', "\u{1D48}"=>'d', "\u{1D49}"=>'e', "\u{1D4A}"=>"\u{259}",
        "\u{1D4B}"=>"\u{25B}", "\u{1D4C}"=>"\u{25C}", "\u{1D4D}"=>'g', "\u{1D4F}"=>'k', "\u{1D50}"=>'m', "\u{1D51}"=>"\u{14B}", "\u{1D52}"=>'o', "\u{1D53}"=>"\u{254}",
        "\u{1D54}"=>"\u{1D16}", "\u{1D55}"=>"\u{1D17}", "\u{1D56}"=>'p', "\u{1D57}"=>'t', "\u{1D58}"=>'u', "\u{1D59}"=>"\u{1D1D}", "\u{1D5A}"=>"\u{26F}", "\u{1D5B}"=>'v',
        "\u{1D5C}"=>"\u{1D25}", "\u{1D5D}"=>"\u{3B2}", "\u{1D5E}"=>"\u{3B3}", "\u{1D5F}"=>"\u{3B4}", "\u{1D60}"=>"\u{3C6}", "\u{1D61}"=>"\u{3C7}", "\u{1D62}"=>'i', "\u{1D63}"=>'r',
        "\u{1D64}"=>'u', "\u{1D65}"=>'v', "\u{1D66}"=>"\u{3B2}", "\u{1D67}"=>"\u{3B3}", "\u{1D68}"=>"\u{3C1}", "\u{1D69}"=>"\u{3C6}", "\u{1D6A}"=>"\u{3C7}", "\u{1D78}"=>"\u{43D}",
        "\u{1D9B}"=>"\u{252}", "\u{1D9C}"=>'c', "\u{1D9D}"=>"\u{255}", "\u{1D9E}"=>"\u{F0}", "\u{1D9F}"=>"\u{25C}", "\u{1DA0}"=>'f', "\u{1DA1}"=>"\u{25F}", "\u{1DA2}"=>"\u{261}",
        "\u{1DA3}"=>"\u{265}", "\u{1DA4}"=>"\u{268}", "\u{1DA5}"=>"\u{269}", "\u{1DA6}"=>"\u{26A}", "\u{1DA7}"=>"\u{1D7B}", "\u{1DA8}"=>"\u{29D}", "\u{1DA9}"=>"\u{26D}", "\u{1DAA}"=>"\u{1D85}",
        "\u{1DAB}"=>"\u{29F}", "\u{1DAC}"=>"\u{271}", "\u{1DAD}"=>"\u{270}", "\u{1DAE}"=>"\u{272}", "\u{1DAF}"=>"\u{273}", "\u{1DB0}"=>"\u{274}", "\u{1DB1}"=>"\u{275}", "\u{1DB2}"=>"\u{278}",
        "\u{1DB3}"=>"\u{282}", "\u{1DB4}"=>"\u{283}", "\u{1DB5}"=>"\u{1AB}", "\u{1DB6}"=>"\u{289}", "\u{1DB7}"=>"\u{28A}", "\u{1DB8}"=>"\u{1D1C}", "\u{1DB9}"=>"\u{28B}", "\u{1DBA}"=>"\u{28C}",
        "\u{1DBB}"=>'z', "\u{1DBC}"=>"\u{290}", "\u{1DBD}"=>"\u{291}", "\u{1DBE}"=>"\u{292}", "\u{1DBF}"=>"\u{3B8}", "\u{1E00}"=>'A', "\u{1E01}"=>'a', "\u{1E02}"=>'B',
        "\u{1E03}"=>'b', "\u{1E04}"=>'B', "\u{1E05}"=>'b', "\u{1E06}"=>'B', "\u{1E07}"=>'b', "\u{1E08}"=>'C', "\u{1E09}"=>'c', "\u{1E0A}"=>'D',
        "\u{1E0B}"=>'d', "\u{1E0C}"=>'D', "\u{1E0D}"=>'d', "\u{1E0E}"=>'D', "\u{1E0F}"=>'d', "\u{1E10}"=>'D', "\u{1E11}"=>'d', "\u{1E12}"=>'D',
        "\u{1E13}"=>'d', "\u{1E14}"=>'E', "\u{1E15}"=>'e', "\u{1E16}"=>'E', "\u{1E17}"=>'e', "\u{1E18}"=>'E', "\u{1E19}"=>'e', "\u{1E1A}"=>'E',
        "\u{1E1B}"=>'e', "\u{1E1C}"=>'E', "\u{1E1D}"=>'e', "\u{1E1E}"=>'F', "\u{1E1F}"=>'f', "\u{1E20}"=>'G', "\u{1E21}"=>'g', "\u{1E22}"=>'H',
        "\u{1E23}"=>'h', "\u{1E24}"=>'H', "\u{1E25}"=>'h', "\u{1E26}"=>'H', "\u{1E27}"=>'h', "\u{1E28}"=>'H', "\u{1E29}"=>'h', "\u{1E2A}"=>'H',
        "\u{1E2B}"=>'h', "\u{1E2C}"=>'I', "\u{1E2D}"=>'i', "\u{1E2E}"=>'I', "\u{1E2F}"=>'i', "\u{1E30}"=>'K', "\u{1E31}"=>'k', "\u{1E32}"=>'K',
        "\u{1E33}"=>'k', "\u{1E34}"=>'K', "\u{1E35}"=>'k', "\u{1E36}"=>'L', "\u{1E37}"=>'l', "\u{1E38}"=>'L', "\u{1E39}"=>'l', "\u{1E3A}"=>'L',
        "\u{1E3B}"=>'l', "\u{1E3C}"=>'L', "\u{1E3D}"=>'l', "\u{1E3E}"=>'M', "\u{1E3F}"=>'m', "\u{1E40}"=>'M', "\u{1E41}"=>'m', "\u{1E42}"=>'M',
        "\u{1E43}"=>'m', "\u{1E44}"=>'N', "\u{1E45}"=>'n', "\u{1E46}"=>'N', "\u{1E47}"=>'n', "\u{1E48}"=>'N', "\u{1E49}"=>'n', "\u{1E4A}"=>'N',
        "\u{1E4B}"=>'n', "\u{1E4C}"=>'O', "\u{1E4D}"=>'o', "\u{1E4E}"=>'O', "\u{1E4F}"=>'o', "\u{1E50}"=>'O', "\u{1E51}"=>'o', "\u{1E52}"=>'O',
        "\u{1E53}"=>'o', "\u{1E54}"=>'P', "\u{1E55}"=>'p', "\u{1E56}"=>'P', "\u{1E57}"=>'p', "\u{1E58}"=>'R', "\u{1E59}"=>'r', "\u{1E5A}"=>'R',
        "\u{1E5B}"=>'r', "\u{1E5C}"=>'R', "\u{1E5D}"=>'r', "\u{1E5E}"=>'R', "\u{1E5F}"=>'r', "\u{1E60}"=>'S', "\u{1E61}"=>'s', "\u{1E62}"=>'S',
        "\u{1E63}"=>'s', "\u{1E64}"=>'S', "\u{1E65}"=>'s', "\u{1E66}"=>'S', "\u{1E67}"=>'s', "\u{1E68}"=>'S', "\u{1E69}"=>'s', "\u{1E6A}"=>'T',
        "\u{1E6B}"=>'t', "\u{1E6C}"=>'T', "\u{1E6D}"=>'t', "\u{1E6E}"=>'T', "\u{1E6F}"=>'t', "\u{1E70}"=>'T', "\u{1E71}"=>'t', "\u{1E72}"=>'U',
        "\u{1E73}"=>'u', "\u{1E74}"=>'U', "\u{1E75}"=>'u', "\u{1E76}"=>'U', "\u{1E77}"=>'u', "\u{1E78}"=>'U', "\u{1E79}"=>'u', "\u{1E7A}"=>'U',
        "\u{1E7B}"=>'u', "\u{1E7C}"=>'V', "\u{1E7D}"=>'v', "\u{1E7E}"=>'V', "\u{1E7F}"=>'v', "\u{1E80}"=>'W', "\u{1E81}"=>'w', "\u{1E82}"=>'W',
        "\u{1E83}"=>'w', "\u{1E84}"=>'W', "\u{1E85}"=>'w', "\u{1E86}"=>'W', "\u{1E87}"=>'w', "\u{1E88}"=>'W', "\u{1E89}"=>'w', "\u{1E8A}"=>'X',
        "\u{1E8B}"=>'x', "\u{1E8C}"=>'X', "\u{1E8D}"=>'x', "\u{1E8E}"=>'Y', "\u{1E8F}"=>'y', "\u{1E90}"=>'Z', "\u{1E91}"=>'z', "\u{1E92}"=>'Z',
        "\u{1E93}"=>'z', "\u{1E94}"=>'Z', "\u{1E95}"=>'z', "\u{1E96}"=>'h', "\u{1E97}"=>'t', "\u{1E98}"=>'w', "\u{1E99}"=>'y', "\u{1E9A}"=>"a\u{2BE}",
        "\u{1E9B}"=>'s', "\u{1EA0}"=>'A', "\u{1EA1}"=>'a', "\u{1EA2}"=>'A', "\u{1EA3}"=>'a', "\u{1EA4}"=>'A', "\u{1EA5}"=>'a', "\u{1EA6}"=>'A',
        "\u{1EA7}"=>'a', "\u{1EA8}"=>'A', "\u{1EA9}"=>'a', "\u{1EAA}"=>'A', "\u{1EAB}"=>'a', "\u{1EAC}"=>'A', "\u{1EAD}"=>'a', "\u{1EAE}"=>'A',
        "\u{1EAF}"=>'a', "\u{1EB0}"=>'A', "\u{1EB1}"=>'a', "\u{1EB2}"=>'A', "\u{1EB3}"=>'a', "\u{1EB4}"=>'A', "\u{1EB5}"=>'a', "\u{1EB6}"=>'A',
        "\u{1EB7}"=>'a', "\u{1EB8}"=>'E', "\u{1EB9}"=>'e', "\u{1EBA}"=>'E', "\u{1EBB}"=>'e', "\u{1EBC}"=>'E', "\u{1EBD}"=>'e', "\u{1EBE}"=>'E',
        "\u{1EBF}"=>'e', "\u{1EC0}"=>'E', "\u{1EC1}"=>'e', "\u{1EC2}"=>'E', "\u{1EC3}"=>'e', "\u{1EC4}"=>'E', "\u{1EC5}"=>'e', "\u{1EC6}"=>'E',
        "\u{1EC7}"=>'e', "\u{1EC8}"=>'I', "\u{1EC9}"=>'i', "\u{1ECA}"=>'I', "\u{1ECB}"=>'i', "\u{1ECC}"=>'O', "\u{1ECD}"=>'o', "\u{1ECE}"=>'O',
        "\u{1ECF}"=>'o', "\u{1ED0}"=>'O', "\u{1ED1}"=>'o', "\u{1ED2}"=>'O', "\u{1ED3}"=>'o', "\u{1ED4}"=>'O', "\u{1ED5}"=>'o', "\u{1ED6}"=>'O',
        "\u{1ED7}"=>'o', "\u{1ED8}"=>'O', "\u{1ED9}"=>'o', "\u{1EDA}"=>'O', "\u{1EDB}"=>'o', "\u{1EDC}"=>'O', "\u{1EDD}"=>'o', "\u{1EDE}"=>'O',
        "\u{1EDF}"=>'o', "\u{1EE0}"=>'O', "\u{1EE1}"=>'o', "\u{1EE2}"=>'O', "\u{1EE3}"=>'o', "\u{1EE4}"=>'U', "\u{1EE5}"=>'u', "\u{1EE6}"=>'U',
        "\u{1EE7}"=>'u', "\u{1EE8}"=>'U', "\u{1EE9}"=>'u', "\u{1EEA}"=>'U', "\u{1EEB}"=>'u', "\u{1EEC}"=>'U', "\u{1EED}"=>'u', "\u{1EEE}"=>'U',
        "\u{1EEF}"=>'u', "\u{1EF0}"=>'U', "\u{1EF1}"=>'u', "\u{1EF2}"=>'Y', "\u{1EF3}"=>'y', "\u{1EF4}"=>'Y', "\u{1EF5}"=>'y', "\u{1EF6}"=>'Y',
        "\u{1EF7}"=>'y', "\u{1EF8}"=>'Y', "\u{1EF9}"=>'y', "\u{1F00}"=>"\u{3B1}", "\u{1F01}"=>"\u{3B1}", "\u{1F02}"=>"\u{3B1}", "\u{1F03}"=>"\u{3B1}", "\u{1F04}"=>"\u{3B1}",
        "\u{1F05}"=>"\u{3B1}", "\u{1F06}"=>"\u{3B1}", "\u{1F07}"=>"\u{3B1}", "\u{1F08}"=>"\u{391}", "\u{1F09}"=>"\u{391}", "\u{1F0A}"=>"\u{391}", "\u{1F0B}"=>"\u{391}", "\u{1F0C}"=>"\u{391}",
        "\u{1F0D}"=>"\u{391}", "\u{1F0E}"=>"\u{391}", "\u{1F0F}"=>"\u{391}", "\u{1F10}"=>"\u{3B5}", "\u{1F11}"=>"\u{3B5}", "\u{1F12}"=>"\u{3B5}", "\u{1F13}"=>"\u{3B5}", "\u{1F14}"=>"\u{3B5}",
        "\u{1F15}"=>"\u{3B5}", "\u{1F18}"=>"\u{395}", "\u{1F19}"=>"\u{395}", "\u{1F1A}"=>"\u{395}", "\u{1F1B}"=>"\u{395}", "\u{1F1C}"=>"\u{395}", "\u{1F1D}"=>"\u{395}", "\u{1F20}"=>"\u{3B7}",
        "\u{1F21}"=>"\u{3B7}", "\u{1F22}"=>"\u{3B7}", "\u{1F23}"=>"\u{3B7}", "\u{1F24}"=>"\u{3B7}", "\u{1F25}"=>"\u{3B7}", "\u{1F26}"=>"\u{3B7}", "\u{1F27}"=>"\u{3B7}", "\u{1F28}"=>"\u{397}",
        "\u{1F29}"=>"\u{397}", "\u{1F2A}"=>"\u{397}", "\u{1F2B}"=>"\u{397}", "\u{1F2C}"=>"\u{397}", "\u{1F2D}"=>"\u{397}", "\u{1F2E}"=>"\u{397}", "\u{1F2F}"=>"\u{397}", "\u{1F30}"=>"\u{3B9}",
        "\u{1F31}"=>"\u{3B9}", "\u{1F32}"=>"\u{3B9}", "\u{1F33}"=>"\u{3B9}", "\u{1F34}"=>"\u{3B9}", "\u{1F35}"=>"\u{3B9}", "\u{1F36}"=>"\u{3B9}", "\u{1F37}"=>"\u{3B9}", "\u{1F38}"=>"\u{399}",
        "\u{1F39}"=>"\u{399}", "\u{1F3A}"=>"\u{399}", "\u{1F3B}"=>"\u{399}", "\u{1F3C}"=>"\u{399}", "\u{1F3D}"=>"\u{399}", "\u{1F3E}"=>"\u{399}", "\u{1F3F}"=>"\u{399}", "\u{1F40}"=>"\u{3BF}",
        "\u{1F41}"=>"\u{3BF}", "\u{1F42}"=>"\u{3BF}", "\u{1F43}"=>"\u{3BF}", "\u{1F44}"=>"\u{3BF}", "\u{1F45}"=>"\u{3BF}", "\u{1F48}"=>"\u{39F}", "\u{1F49}"=>"\u{39F}", "\u{1F4A}"=>"\u{39F}",
        "\u{1F4B}"=>"\u{39F}", "\u{1F4C}"=>"\u{39F}", "\u{1F4D}"=>"\u{39F}", "\u{1F50}"=>"\u{3C5}", "\u{1F51}"=>"\u{3C5}", "\u{1F52}"=>"\u{3C5}", "\u{1F53}"=>"\u{3C5}", "\u{1F54}"=>"\u{3C5}",
        "\u{1F55}"=>"\u{3C5}", "\u{1F56}"=>"\u{3C5}", "\u{1F57}"=>"\u{3C5}", "\u{1F59}"=>"\u{3A5}", "\u{1F5B}"=>"\u{3A5}", "\u{1F5D}"=>"\u{3A5}", "\u{1F5F}"=>"\u{3A5}", "\u{1F60}"=>"\u{3C9}",
        "\u{1F61}"=>"\u{3C9}", "\u{1F62}"=>"\u{3C9}", "\u{1F63}"=>"\u{3C9}", "\u{1F64}"=>"\u{3C9}", "\u{1F65}"=>"\u{3C9}", "\u{1F66}"=>"\u{3C9}", "\u{1F67}"=>"\u{3C9}", "\u{1F68}"=>"\u{3A9}",
        "\u{1F69}"=>"\u{3A9}", "\u{1F6A}"=>"\u{3A9}", "\u{1F6B}"=>"\u{3A9}", "\u{1F6C}"=>"\u{3A9}", "\u{1F6D}"=>"\u{3A9}", "\u{1F6E}"=>"\u{3A9}", "\u{1F6F}"=>"\u{3A9}", "\u{1F70}"=>"\u{3B1}",
        "\u{1F71}"=>"\u{3B1}", "\u{1F72}"=>"\u{3B5}", "\u{1F73}"=>"\u{3B5}", "\u{1F74}"=>"\u{3B7}", "\u{1F75}"=>"\u{3B7}", "\u{1F76}"=>"\u{3B9}", "\u{1F77}"=>"\u{3B9}", "\u{1F78}"=>"\u{3BF}",
        "\u{1F79}"=>"\u{3BF}", "\u{1F7A}"=>"\u{3C5}", "\u{1F7B}"=>"\u{3C5}", "\u{1F7C}"=>"\u{3C9}", "\u{1F7D}"=>"\u{3C9}", "\u{1F80}"=>"\u{3B1}", "\u{1F81}"=>"\u{3B1}", "\u{1F82}"=>"\u{3B1}",
        "\u{1F83}"=>"\u{3B1}", "\u{1F84}"=>"\u{3B1}", "\u{1F85}"=>"\u{3B1}", "\u{1F86}"=>"\u{3B1}", "\u{1F87}"=>"\u{3B1}", "\u{1F88}"=>"\u{391}", "\u{1F89}"=>"\u{391}", "\u{1F8A}"=>"\u{391}",
        "\u{1F8B}"=>"\u{391}", "\u{1F8C}"=>"\u{391}", "\u{1F8D}"=>"\u{391}", "\u{1F8E}"=>"\u{391}", "\u{1F8F}"=>"\u{391}", "\u{1F90}"=>"\u{3B7}", "\u{1F91}"=>"\u{3B7}", "\u{1F92}"=>"\u{3B7}",
        "\u{1F93}"=>"\u{3B7}", "\u{1F94}"=>"\u{3B7}", "\u{1F95}"=>"\u{3B7}", "\u{1F96}"=>"\u{3B7}", "\u{1F97}"=>"\u{3B7}", "\u{1F98}"=>"\u{397}", "\u{1F99}"=>"\u{397}", "\u{1F9A}"=>"\u{397}",
        "\u{1F9B}"=>"\u{397}", "\u{1F9C}"=>"\u{397}", "\u{1F9D}"=>"\u{397}", "\u{1F9E}"=>"\u{397}", "\u{1F9F}"=>"\u{397}", "\u{1FA0}"=>"\u{3C9}", "\u{1FA1}"=>"\u{3C9}", "\u{1FA2}"=>"\u{3C9}",
        "\u{1FA3}"=>"\u{3C9}", "\u{1FA4}"=>"\u{3C9}", "\u{1FA5}"=>"\u{3C9}", "\u{1FA6}"=>"\u{3C9}", "\u{1FA7}"=>"\u{3C9}", "\u{1FA8}"=>"\u{3A9}", "\u{1FA9}"=>"\u{3A9}", "\u{1FAA}"=>"\u{3A9}",
        "\u{1FAB}"=>"\u{3A9}", "\u{1FAC}"=>"\u{3A9}", "\u{1FAD}"=>"\u{3A9}", "\u{1FAE}"=>"\u{3A9}", "\u{1FAF}"=>"\u{3A9}", "\u{1FB0}"=>"\u{3B1}", "\u{1FB1}"=>"\u{3B1}", "\u{1FB2}"=>"\u{3B1}",
        "\u{1FB3}"=>"\u{3B1}", "\u{1FB4}"=>"\u{3B1}", "\u{1FB6}"=>"\u{3B1}", "\u{1FB7}"=>"\u{3B1}", "\u{1FB8}"=>"\u{391}", "\u{1FB9}"=>"\u{391}", "\u{1FBA}"=>"\u{391}", "\u{1FBB}"=>"\u{391}",
        "\u{1FBC}"=>"\u{391}", "\u{1FBD}"=>' ', "\u{1FBE}"=>"\u{3B9}", "\u{1FBF}"=>' ', "\u{1FC0}"=>' ', "\u{1FC1}"=>' ', "\u{1FC2}"=>"\u{3B7}", "\u{1FC3}"=>"\u{3B7}",
        "\u{1FC4}"=>"\u{3B7}", "\u{1FC6}"=>"\u{3B7}", "\u{1FC7}"=>"\u{3B7}", "\u{1FC8}"=>"\u{395}", "\u{1FC9}"=>"\u{395}", "\u{1FCA}"=>"\u{397}", "\u{1FCB}"=>"\u{397}", "\u{1FCC}"=>"\u{397}",
        "\u{1FCD}"=>' ', "\u{1FCE}"=>' ', "\u{1FCF}"=>' ', "\u{1FD0}"=>"\u{3B9}", "\u{1FD1}"=>"\u{3B9}", "\u{1FD2}"=>"\u{3B9}", "\u{1FD3}"=>"\u{3B9}", "\u{1FD6}"=>"\u{3B9}",
        "\u{1FD7}"=>"\u{3B9}", "\u{1FD8}"=>"\u{399}", "\u{1FD9}"=>"\u{399}", "\u{1FDA}"=>"\u{399}", "\u{1FDB}"=>"\u{399}", "\u{1FDD}"=>' ', "\u{1FDE}"=>' ', "\u{1FDF}"=>' ',
        "\u{1FE0}"=>"\u{3C5}", "\u{1FE1}"=>"\u{3C5}", "\u{1FE2}"=>"\u{3C5}", "\u{1FE3}"=>"\u{3C5}", "\u{1FE4}"=>"\u{3C1}", "\u{1FE5}"=>"\u{3C1}", "\u{1FE6}"=>"\u{3C5}", "\u{1FE7}"=>"\u{3C5}",
        "\u{1FE8}"=>"\u{3A5}", "\u{1FE9}"=>"\u{3A5}", "\u{1FEA}"=>"\u{3A5}", "\u{1FEB}"=>"\u{3A5}", "\u{1FEC}"=>"\u{3A1}", "\u{1FED}"=>' ', "\u{1FEE}"=>' ', "\u{1FEF}"=>'`',
        "\u{1FF2}"=>"\u{3C9}", "\u{1FF3}"=>"\u{3C9}", "\u{1FF4}"=>"\u{3C9}", "\u{1FF6}"=>"\u{3C9}", "\u{1FF7}"=>"\u{3C9}", "\u{1FF8}"=>"\u{39F}", "\u{1FF9}"=>"\u{39F}", "\u{1FFA}"=>"\u{3A9}",
        "\u{1FFB}"=>"\u{3A9}", "\u{1FFC}"=>"\u{3A9}", "\u{1FFD}"=>' ', "\u{1FFE}"=>' ', "\u{2000}"=>' ', "\u{2001}"=>' ', "\u{2002}"=>' ', "\u{2003}"=>' ',
        "\u{2004}"=>' ', "\u{2005}"=>' ', "\u{2006}"=>' ', "\u{2007}"=>' ', "\u{2008}"=>' ', "\u{2009}"=>' ', "\u{200A}"=>' ', "\u{2011}"=>"\u{2010}",
        "\u{2017}"=>' ', "\u{2024}"=>'.', "\u{2025}"=>'..', "\u{2026}"=>'...', "\u{202F}"=>' ', "\u{2033}"=>"\u{2032}\u{2032}", "\u{2034}"=>"\u{2032}\u{2032}\u{2032}", "\u{2036}"=>"\u{2035}\u{2035}",
        "\u{2037}"=>"\u{2035}\u{2035}\u{2035}", "\u{203C}"=>'!!', "\u{203E}"=>' ', "\u{2047}"=>'??', "\u{2048}"=>'?!', "\u{2049}"=>'!?', "\u{2057}"=>"\u{2032}\u{2032}\u{2032}\u{2032}", "\u{205F}"=>' ',
        "\u{2070}"=>'0', "\u{2071}"=>'i', "\u{2074}"=>'4', "\u{2075}"=>'5', "\u{2076}"=>'6', "\u{2077}"=>'7', "\u{2078}"=>'8', "\u{2079}"=>'9',
        "\u{207A}"=>'+', "\u{207B}"=>"\u{2212}", "\u{207C}"=>'=', "\u{207D}"=>'(', "\u{207E}"=>')', "\u{207F}"=>'n', "\u{2080}"=>'0', "\u{2081}"=>'1',
        "\u{2082}"=>'2', "\u{2083}"=>'3', "\u{2084}"=>'4', "\u{2085}"=>'5', "\u{2086}"=>'6', "\u{2087}"=>'7', "\u{2088}"=>'8', "\u{2089}"=>'9',
        "\u{208A}"=>'+', "\u{208B}"=>"\u{2212}", "\u{208C}"=>'=', "\u{208D}"=>'(', "\u{208E}"=>')', "\u{2090}"=>'a', "\u{2091}"=>'e', "\u{2092}"=>'o',
        "\u{2093}"=>'x', "\u{2094}"=>"\u{259}", "\u{2095}"=>'h', "\u{2096}"=>'k', "\u{2097}"=>'l', "\u{2098}"=>'m', "\u{2099}"=>'n', "\u{209A}"=>'p',
        "\u{209B}"=>'s', "\u{209C}"=>'t', "\u{20A8}"=>'Rs', "\u{2100}"=>'a/c', "\u{2101}"=>'a/s', "\u{2102}"=>'C', "\u{2103}"=>"\u{B0}C", "\u{2105}"=>'c/o',
        "\u{2106}"=>'c/u', "\u{2107}"=>"\u{190}", "\u{2109}"=>"\u{B0}F", "\u{210A}"=>'g', "\u{210B}"=>'H', "\u{210C}"=>'H', "\u{210D}"=>'H', "\u{210E}"=>'h',
        "\u{210F}"=>"\u{127}", "\u{2110}"=>'I', "\u{2111}"=>'I', "\u{2112}"=>'L', "\u{2113}"=>'l', "\u{2115}"=>'N', "\u{2116}"=>'No', "\u{2119}"=>'P',
        "\u{211A}"=>'Q', "\u{211B}"=>'R', "\u{211C}"=>'R', "\u{211D}"=>'R', "\u{2120}"=>'SM', "\u{2121}"=>'TEL', "\u{2122}"=>'TM', "\u{2124}"=>'Z',
        "\u{2126}"=>"\u{3A9}", "\u{2128}"=>'Z', "\u{212A}"=>'K', "\u{212B}"=>'A', "\u{212C}"=>'B', "\u{212D}"=>'C', "\u{212F}"=>'e', "\u{2130}"=>'E',
        "\u{2131}"=>'F', "\u{2133}"=>'M', "\u{2134}"=>'o', "\u{2135}"=>"\u{5D0}", "\u{2136}"=>"\u{5D1}", "\u{2137}"=>"\u{5D2}", "\u{2138}"=>"\u{5D3}", "\u{2139}"=>'i',
        "\u{213B}"=>'FAX', "\u{213C}"=>"\u{3C0}", "\u{213D}"=>"\u{3B3}", "\u{213E}"=>"\u{393}", "\u{213F}"=>"\u{3A0}", "\u{2140}"=>"\u{2211}", "\u{2145}"=>'D', "\u{2146}"=>'d',
        "\u{2147}"=>'e', "\u{2148}"=>'i', "\u{2149}"=>'j', "\u{2150}"=>"1\u{2044}7", "\u{2151}"=>"1\u{2044}9", "\u{2152}"=>"1\u{2044}10", "\u{2153}"=>"1\u{2044}3", "\u{2154}"=>"2\u{2044}3",
        "\u{2155}"=>"1\u{2044}5", "\u{2156}"=>"2\u{2044}5", "\u{2157}"=>"3\u{2044}5", "\u{2158}"=>"4\u{2044}5", "\u{2159}"=>"1\u{2044}6", "\u{215A}"=>"5\u{2044}6", "\u{215B}"=>"1\u{2044}8", "\u{215C}"=>"3\u{2044}8",
        "\u{215D}"=>"5\u{2044}8", "\u{215E}"=>"7\u{2044}8", "\u{215F}"=>"1\u{2044}", "\u{2160}"=>'I', "\u{2161}"=>'II', "\u{2162}"=>'III', "\u{2163}"=>'IV', "\u{2164}"=>'V',
        "\u{2165}"=>'VI', "\u{2166}"=>'VII', "\u{2167}"=>'VIII', "\u{2168}"=>'IX', "\u{2169}"=>'X', "\u{216A}"=>'XI', "\u{216B}"=>'XII', "\u{216C}"=>'L',
        "\u{216D}"=>'C', "\u{216E}"=>'D', "\u{216F}"=>'M', "\u{2170}"=>'i', "\u{2171}"=>'ii', "\u{2172}"=>'iii', "\u{2173}"=>'iv', "\u{2174}"=>'v',
        "\u{2175}"=>'vi', "\u{2176}"=>'vii', "\u{2177}"=>'viii', "\u{2178}"=>'ix', "\u{2179}"=>'x', "\u{217A}"=>'xi', "\u{217B}"=>'xii', "\u{217C}"=>'l',
        "\u{217D}"=>'c', "\u{217E}"=>'d', "\u{217F}"=>'m', "\u{2189}"=>"0\u{2044}3", "\u{219A}"=>"\u{2190}", "\u{219B}"=>"\u{2192}", "\u{21AE}"=>"\u{2194}", "\u{21CD}"=>"\u{21D0}",
        "\u{21CE}"=>"\u{21D4}", "\u{21CF}"=>"\u{21D2}", "\u{2204}"=>"\u{2203}", "\u{2209}"=>"\u{2208}", "\u{220C}"=>"\u{220B}", "\u{2224}"=>"\u{2223}", "\u{2226}"=>"\u{2225}", "\u{222C}"=>"\u{222B}\u{222B}",
        "\u{222D}"=>"\u{222B}\u{222B}\u{222B}", "\u{222F}"=>"\u{222E}\u{222E}", "\u{2230}"=>"\u{222E}\u{222E}\u{222E}", "\u{2241}"=>"\u{223C}", "\u{2244}"=>"\u{2243}", "\u{2247}"=>"\u{2245}", "\u{2249}"=>"\u{2248}", "\u{2260}"=>'=',
        "\u{2262}"=>"\u{2261}", "\u{226D}"=>"\u{224D}", "\u{226E}"=>'<', "\u{226F}"=>'>', "\u{2270}"=>"\u{2264}", "\u{2271}"=>"\u{2265}", "\u{2274}"=>"\u{2272}", "\u{2275}"=>"\u{2273}",
        "\u{2278}"=>"\u{2276}", "\u{2279}"=>"\u{2277}", "\u{2280}"=>"\u{227A}", "\u{2281}"=>"\u{227B}", "\u{2284}"=>"\u{2282}", "\u{2285}"=>"\u{2283}", "\u{2288}"=>"\u{2286}", "\u{2289}"=>"\u{2287}",
        "\u{22AC}"=>"\u{22A2}", "\u{22AD}"=>"\u{22A8}", "\u{22AE}"=>"\u{22A9}", "\u{22AF}"=>"\u{22AB}", "\u{22E0}"=>"\u{227C}", "\u{22E1}"=>"\u{227D}", "\u{22E2}"=>"\u{2291}", "\u{22E3}"=>"\u{2292}",
        "\u{22EA}"=>"\u{22B2}", "\u{22EB}"=>"\u{22B3}", "\u{22EC}"=>"\u{22B4}", "\u{22ED}"=>"\u{22B5}", "\u{2329}"=>"\u{3008}", "\u{232A}"=>"\u{3009}", "\u{2460}"=>'1', "\u{2461}"=>'2',
        "\u{2462}"=>'3', "\u{2463}"=>'4', "\u{2464}"=>'5', "\u{2465}"=>'6', "\u{2466}"=>'7', "\u{2467}"=>'8', "\u{2468}"=>'9', "\u{2469}"=>'10',
        "\u{246A}"=>'11', "\u{246B}"=>'12', "\u{246C}"=>'13', "\u{246D}"=>'14', "\u{246E}"=>'15', "\u{246F}"=>'16', "\u{2470}"=>'17', "\u{2471}"=>'18',
        "\u{2472}"=>'19', "\u{2473}"=>'20', "\u{2474}"=>'(1)', "\u{2475}"=>'(2)', "\u{2476}"=>'(3)', "\u{2477}"=>'(4)', "\u{2478}"=>'(5)', "\u{2479}"=>'(6)',
        "\u{247A}"=>'(7)', "\u{247B}"=>'(8)', "\u{247C}"=>'(9)', "\u{247D}"=>'(10)', "\u{247E}"=>'(11)', "\u{247F}"=>'(12)', "\u{2480}"=>'(13)', "\u{2481}"=>'(14)',
        "\u{2482}"=>'(15)', "\u{2483}"=>'(16)', "\u{2484}"=>'(17)', "\u{2485}"=>'(18)', "\u{2486}"=>'(19)', "\u{2487}"=>'(20)', "\u{2488}"=>'1.', "\u{2489}"=>'2.',
        "\u{248A}"=>'3.', "\u{248B}"=>'4.', "\u{248C}"=>'5.', "\u{248D}"=>'6.', "\u{248E}"=>'7.', "\u{248F}"=>'8.', "\u{2490}"=>'9.', "\u{2491}"=>'10.',
        "\u{2492}"=>'11.', "\u{2493}"=>'12.', "\u{2494}"=>'13.', "\u{2495}"=>'14.', "\u{2496}"=>'15.', "\u{2497}"=>'16.', "\u{2498}"=>'17.', "\u{2499}"=>'18.',
        "\u{249A}"=>'19.', "\u{249B}"=>'20.', "\u{249C}"=>'(a)', "\u{249D}"=>'(b)', "\u{249E}"=>'(c)', "\u{249F}"=>'(d)', "\u{24A0}"=>'(e)', "\u{24A1}"=>'(f)',
        "\u{24A2}"=>'(g)', "\u{24A3}"=>'(h)', "\u{24A4}"=>'(i)', "\u{24A5}"=>'(j)', "\u{24A6}"=>'(k)', "\u{24A7}"=>'(l)', "\u{24A8}"=>'(m)', "\u{24A9}"=>'(n)',
        "\u{24AA}"=>'(o)', "\u{24AB}"=>'(p)', "\u{24AC}"=>'(q)', "\u{24AD}"=>'(r)', "\u{24AE}"=>'(s)', "\u{24AF}"=>'(t)', "\u{24B0}"=>'(u)', "\u{24B1}"=>'(v)',
        "\u{24B2}"=>'(w)', "\u{24B3}"=>'(x)', "\u{24B4}"=>'(y)', "\u{24B5}"=>'(z)', "\u{24B6}"=>'A', "\u{24B7}"=>'B', "\u{24B8}"=>'C', "\u{24B9}"=>'D',
        "\u{24BA}"=>'E', "\u{24BB}"=>'F', "\u{24BC}"=>'G', "\u{24BD}"=>'H', "\u{24BE}"=>'I', "\u{24BF}"=>'J', "\u{24C0}"=>'K', "\u{24C1}"=>'L',
        "\u{24C2}"=>'M', "\u{24C3}"=>'N', "\u{24C4}"=>'O', "\u{24C5}"=>'P', "\u{24C6}"=>'Q', "\u{24C7}"=>'R', "\u{24C8}"=>'S', "\u{24C9}"=>'T',
        "\u{24CA}"=>'U', "\u{24CB}"=>'V', "\u{24CC}"=>'W', "\u{24CD}"=>'X', "\u{24CE}"=>'Y', "\u{24CF}"=>'Z', "\u{24D0}"=>'a', "\u{24D1}"=>'b',
        "\u{24D2}"=>'c', "\u{24D3}"=>'d', "\u{24D4}"=>'e', "\u{24D5}"=>'f', "\u{24D6}"=>'g', "\u{24D7}"=>'h', "\u{24D8}"=>'i', "\u{24D9}"=>'j',
        "\u{24DA}"=>'k', "\u{24DB}"=>'l', "\u{24DC}"=>'m', "\u{24DD}"=>'n', "\u{24DE}"=>'o', "\u{24DF}"=>'p', "\u{24E0}"=>'q', "\u{24E1}"=>'r',
        "\u{24E2}"=>'s', "\u{24E3}"=>'t', "\u{24E4}"=>'u', "\u{24E5}"=>'v', "\u{24E6}"=>'w', "\u{24E7}"=>'x', "\u{24E8}"=>'y', "\u{24E9}"=>'z',
        "\u{24EA}"=>'0', "\u{2C7C}"=>'j', "\u{2C7D}"=>'V', "\u{3000}"=>' ', "\u{A770}"=>"\u{A76F}", "\u{A7F1}"=>'S', "\u{A7F2}"=>'C', "\u{A7F3}"=>'F',
        "\u{A7F4}"=>'Q', "\u{A7F8}"=>"\u{126}", "\u{A7F9}"=>"\u{153}", "\u{FB00}"=>'ff', "\u{FB01}"=>'fi', "\u{FB02}"=>'fl', "\u{FB03}"=>'ffi', "\u{FB04}"=>'ffl',
        "\u{FB05}"=>'st', "\u{FB06}"=>'st', "\u{FF01}"=>'!', "\u{FF02}"=>'"', "\u{FF03}"=>'#', "\u{FF04}"=>'$', "\u{FF05}"=>'%', "\u{FF06}"=>'&',
        "\u{FF07}"=>'\'', "\u{FF08}"=>'(', "\u{FF09}"=>')', "\u{FF0A}"=>'*', "\u{FF0B}"=>'+', "\u{FF0C}"=>',', "\u{FF0D}"=>'-', "\u{FF0E}"=>'.',
        "\u{FF0F}"=>'/', "\u{FF10}"=>'0', "\u{FF11}"=>'1', "\u{FF12}"=>'2', "\u{FF13}"=>'3', "\u{FF14}"=>'4', "\u{FF15}"=>'5', "\u{FF16}"=>'6',
        "\u{FF17}"=>'7', "\u{FF18}"=>'8', "\u{FF19}"=>'9', "\u{FF1A}"=>':', "\u{FF1B}"=>';', "\u{FF1C}"=>'<', "\u{FF1D}"=>'=', "\u{FF1E}"=>'>',
        "\u{FF1F}"=>'?', "\u{FF20}"=>'@', "\u{FF21}"=>'A', "\u{FF22}"=>'B', "\u{FF23}"=>'C', "\u{FF24}"=>'D', "\u{FF25}"=>'E', "\u{FF26}"=>'F',
        "\u{FF27}"=>'G', "\u{FF28}"=>'H', "\u{FF29}"=>'I', "\u{FF2A}"=>'J', "\u{FF2B}"=>'K', "\u{FF2C}"=>'L', "\u{FF2D}"=>'M', "\u{FF2E}"=>'N',
        "\u{FF2F}"=>'O', "\u{FF30}"=>'P', "\u{FF31}"=>'Q', "\u{FF32}"=>'R', "\u{FF33}"=>'S', "\u{FF34}"=>'T', "\u{FF35}"=>'U', "\u{FF36}"=>'V',
        "\u{FF37}"=>'W', "\u{FF38}"=>'X', "\u{FF39}"=>'Y', "\u{FF3A}"=>'Z', "\u{FF3B}"=>'[', "\u{FF3C}"=>'\\', "\u{FF3D}"=>']', "\u{FF3E}"=>'^',
        "\u{FF3F}"=>'_', "\u{FF40}"=>'`', "\u{FF41}"=>'a', "\u{FF42}"=>'b', "\u{FF43}"=>'c', "\u{FF44}"=>'d', "\u{FF45}"=>'e', "\u{FF46}"=>'f',
        "\u{FF47}"=>'g', "\u{FF48}"=>'h', "\u{FF49}"=>'i', "\u{FF4A}"=>'j', "\u{FF4B}"=>'k', "\u{FF4C}"=>'l', "\u{FF4D}"=>'m', "\u{FF4E}"=>'n',
        "\u{FF4F}"=>'o', "\u{FF50}"=>'p', "\u{FF51}"=>'q', "\u{FF52}"=>'r', "\u{FF53}"=>'s', "\u{FF54}"=>'t', "\u{FF55}"=>'u', "\u{FF56}"=>'v',
        "\u{FF57}"=>'w', "\u{FF58}"=>'x', "\u{FF59}"=>'y', "\u{FF5A}"=>'z', "\u{FF5B}"=>'{', "\u{FF5C}"=>'|', "\u{FF5D}"=>'}', "\u{FF5E}"=>'~',
    ];
}
// </fold-tables>
