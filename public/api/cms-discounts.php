<?php
declare(strict_types=1);

function om_cents($amount): int
{
    return (int) round((float) $amount * 100, 0, PHP_ROUND_HALF_UP);
}

// Largest-remainder allocation: exact cents with a stable line-index tie break.
function om_allocate_cents(int $amount, array $weights): array
{
    $sum = array_sum($weights);
    $amount = min(max(0, $amount), $sum);
    $out = array_fill(0, count($weights), 0);
    if ($sum <= 0 || $amount === 0) return $out;
    $remainders = [];
    foreach ($weights as $i => $weight) {
        $numerator = $amount * $weight;
        $out[$i] = intdiv($numerator, $sum);
        $remainders[$i] = $numerator % $sum;
    }
    $left = $amount - array_sum($out);
    $indexes = array_keys($weights);
    usort($indexes, static fn($a, $b) => ($remainders[$b] <=> $remainders[$a]) ?: ($a <=> $b));
    foreach (array_slice($indexes, 0, $left) as $i) $out[$i]++;
    return $out;
}

function om_discount_amount(array $rule, int $base, int $quantity = 1): int
{
    if (($rule['valueType'] ?? 'percent') === 'percent') return min($base, intdiv($base * (int) ($rule['value'] ?? 0) + 5000, 10000));
    return min($base, max(0, (int) ($rule['value'] ?? 0)) * (($rule['fixedPerUnit'] ?? false) ? $quantity : 1));
}

function om_discount_evaluate(array $lines, int $shipping, array $rules, array $context = []): array
{
    $now = (int) ($context['now'] ?? time());
    $codes = array_values(array_unique(array_map('strtoupper', (array) ($context['codes'] ?? []))));
    $eligible = []; $reasons = [];
    foreach ($rules as $rule) {
        $id = (string) ($rule['id'] ?? '');
        if (($rule['method'] ?? 'code') === 'code' && !in_array(strtoupper((string) ($rule['code'] ?? '')), $codes, true)) continue;
        $reason = '';
        if (!om_cms_active($rule, $now)) $reason = 'Rregulli nuk është aktiv në këtë datë.';
        elseif (!empty($rule['countries']) && !in_array($context['country'] ?? '', $rule['countries'], true)) $reason = 'Nuk vlen për këtë destinacion.';
        elseif (!empty($rule['customerIds']) && !in_array($context['customerId'] ?? '', $rule['customerIds'], true)) $reason = 'Nuk vlen për këtë llogari.';
        elseif (!empty($rule['perCustomerLimit']) && empty($context['customerId'])) $reason = 'Hyni në llogari për këtë zbritje.';
        elseif (!empty($rule['usageLimit']) && ($context['usage'][$id] ?? 0) >= $rule['usageLimit']) $reason = 'Kufiri i përdorimeve është arritur.';
        elseif (!empty($rule['perCustomerLimit']) && ($context['customerUsage'][$id] ?? 0) >= $rule['perCustomerLimit']) $reason = 'Kufiri për llogarinë tuaj është arritur.';
        if ($reason) $reasons[$id] = $reason;
        else $eligible[] = $rule;
    }
    // Publishing is bounded as well; a corrupt store cannot trigger exponential work.
    $eligible = array_slice($eligible, 0, 10);
    usort($eligible, static fn($a, $b) => strcmp($a['id'], $b['id']));
    $base = array_map(static fn($line) => max(0, (int) $line['amountCents']), $lines);
    $best = ['discountCents' => 0, 'shippingDiscountCents' => 0, 'lineDiscountCents' => array_fill(0, count($lines), 0), 'allocations' => [], 'applied' => []];
    $bestValue = 0;
    for ($mask = 1; $mask < (1 << count($eligible)); $mask++) {
        $selected = [];
        foreach ($eligible as $i => $rule) if ($mask & (1 << $i)) $selected[] = $rule;
        $valid = true;
        foreach ($selected as $i => $a) foreach ($selected as $j => $b) {
            if ($i >= $j) continue;
            $aClass = $a['type'] === 'buyXGetY' ? 'product' : $a['type'];
            $bClass = $b['type'] === 'buyXGetY' ? 'product' : $b['type'];
            if (($aClass === 'shipping' && $bClass === 'shipping') || !in_array($bClass, $a['combinesWith'] ?? [], true) || !in_array($aClass, $b['combinesWith'] ?? [], true)) $valid = false;
        }
        if (!$valid) continue;
        usort($selected, static fn($a, $b) => ((['product'=>0,'buyXGetY'=>0,'order'=>1,'shipping'=>2][$a['type']] ?? 3) <=> (['product'=>0,'buyXGetY'=>0,'order'=>1,'shipping'=>2][$b['type']] ?? 3)) ?: strcmp($a['id'], $b['id']));
        $remaining = $base; $allocations = []; $applied = []; $used = []; $shipDiscount = 0; $orderRules = [];
        foreach ($selected as $rule) {
            if ($rule['type'] === 'order') { $orderRules[] = $rule; continue; }
            $indexes = [];
            foreach ($lines as $i => $line) if (empty($rule['productIds']) || in_array($line['productId'], $rule['productIds'], true)) $indexes[] = $i;
            $thresholdBase = array_sum(array_map(static fn($i) => $remaining[$i], $indexes));
            $thresholdQty = array_sum(array_map(static fn($i) => $lines[$i]['quantity'], $indexes));
            if ($rule['type'] === 'shipping') { $thresholdBase = array_sum($remaining); $thresholdQty = array_sum(array_column($lines, 'quantity')); }
            if ($thresholdBase < (int) ($rule['minimumCents'] ?? 0) || $thresholdQty < (int) ($rule['minimumQuantity'] ?? 0)) { $valid = false; break; }
            if ($rule['type'] === 'shipping') {
                if (!empty($rule['maximumShippingCents']) && $shipping > $rule['maximumShippingCents']) { $valid = false; break; }
                $shipDiscount = $shipping;
                if ($shipping > 0) $applied[] = $rule['id'];
                continue;
            }
            $lineSavings = array_fill(0, count($lines), 0);
            if ($rule['type'] === 'buyXGetY') {
                $units = []; $xCount = 0;
                foreach ($lines as $i => $line) {
                    for ($u = 0; $u < min(100, $line['quantity']); $u++) $units[] = ['line' => $i, 'unit' => $u,
                        'price' => intdiv($remaining[$i], max(1, $line['quantity'])),
                        'x' => empty($rule['productIds']) || in_array($line['productId'], $rule['productIds'], true),
                        'y' => in_array($line['productId'], $rule['rewardProductIds'] ?? [], true)];
                }
                // Reserve X from the most expensive eligible units, then discount
                // the cheapest remaining Y. No unit can qualify as both X and Y.
                usort($units, static fn($a, $b) => (($a['y'] && $a['x']) <=> ($b['y'] && $b['x'])) ?: ($b['price'] <=> $a['price']) ?: ($a['line'] <=> $b['line']) ?: ($a['unit'] <=> $b['unit']));
                $applications = 0; $limit = max(1, (int) ($rule['maxApplications'] ?? 1));
                while ($applications < $limit) {
                    $xs = []; $ys = [];
                    foreach ($units as $k => $unit) if ($unit['x'] && count($xs) < $rule['buyQuantity']) $xs[] = $k;
                    if (count($xs) < $rule['buyQuantity']) break;
                    $rewardKeys = array_keys($units);
                    usort($rewardKeys, static fn($a,$b) => ($units[$a]['price'] <=> $units[$b]['price']) ?: ($a <=> $b));
                    foreach ($rewardKeys as $k) if ($units[$k]['y'] && !in_array($k, $xs, true) && count($ys) < $rule['getQuantity']) $ys[] = $k;
                    if (count($ys) < $rule['getQuantity']) break;
                    foreach ($ys as $k) $lineSavings[$units[$k]['line']] += om_discount_amount($rule, $units[$k]['price']);
                    foreach (array_merge($xs, $ys) as $k) unset($units[$k]);
                    $applications++;
                }
            } else {
                $weights = array_map(static fn($i) => in_array($i, $indexes, true) ? $remaining[$i] : 0, array_keys($remaining));
                if (($rule['valueType'] ?? '') === 'fixed' && empty($rule['fixedPerUnit'])) $lineSavings = om_allocate_cents(om_discount_amount($rule, array_sum($weights)), $weights);
                else foreach ($indexes as $i) $lineSavings[$i] = om_discount_amount($rule, $remaining[$i], $lines[$i]['quantity']);
            }
            foreach ($lineSavings as $i => $saving) {
                if ($saving <= 0) continue;
                if (isset($used[$i])) { $valid = false; break; }
                $used[$i] = true; $remaining[$i] -= $saving;
                $allocations[] = ['ruleId' => $rule['id'], 'line' => $i, 'amountCents' => $saving];
            }
            if (array_sum($lineSavings) > 0) $applied[] = $rule['id']; else { $valid = false; break; }
        }
        if (!$valid) continue;
        $orderBase = array_sum($remaining); $orderSavings = 0; $orderWeights = $remaining;
        usort($orderRules, static fn($a, $b) => (($a['valueType'] === 'fixed') <=> ($b['valueType'] === 'fixed')) ?: strcmp($a['id'], $b['id']));
        foreach ($orderRules as $rule) {
            if ($orderBase < (int) ($rule['minimumCents'] ?? 0) || array_sum(array_column($lines, 'quantity')) < (int) ($rule['minimumQuantity'] ?? 0)) { $valid = false; break; }
            $saving = min(array_sum($remaining), om_discount_amount($rule, $rule['valueType'] === 'percent' ? $orderBase : array_sum($remaining)));
            $distribution = om_allocate_cents($saving, $remaining);
            foreach ($distribution as $i => $amount) { $remaining[$i] -= $amount; if ($amount) $allocations[] = ['ruleId' => $rule['id'], 'line' => $i, 'amountCents' => $amount]; }
            if ($saving) $applied[] = $rule['id'];
        }
        if (!$valid) continue;
        $saving = array_sum($base) - array_sum($remaining);
        if ($saving + $shipDiscount > $bestValue) {
            $bestValue = $saving + $shipDiscount;
            $best = ['discountCents' => $saving, 'shippingDiscountCents' => $shipDiscount,
                'lineDiscountCents' => array_map(static fn($i) => $base[$i] - $remaining[$i], array_keys($base)),
                'allocations' => $allocations, 'applied' => $applied];
        }
    }
    foreach ($eligible as $rule) if (!in_array($rule['id'], $best['applied'], true)) $reasons[$rule['id']] = 'Kushtet nuk plotësohen ose është zgjedhur kombinimi me përfitimin më të mirë.';
    return $best + ['reasons' => $reasons, 'totalCents' => array_sum($base) + $shipping - $bestValue];
}

function om_cms_discount_context(array $input): array
{
    $customerId = om_current_customer_id(); $usage = []; $customerUsage = [];
    foreach (om_read('orders', []) as $order) {
        // Reservation holds a use. Confirmed consumption survives cancellation.
        if (($order['inventoryState'] ?? '') === 'Released' && empty($order['discountConsumedAt'])) continue;
        foreach (($order['appliedRuleIds'] ?? []) as $id) {
            $usage[$id] = ($usage[$id] ?? 0) + 1;
            if ($customerId !== '' && ($order['accountId'] ?? '') === $customerId) $customerUsage[$id] = ($customerUsage[$id] ?? 0) + 1;
        }
    }
    return ['codes' => array_slice(array_filter(array_map(static fn($v) => strtoupper(om_clean($v, 40)), array_merge((array) ($input['discountCodes'] ?? []), [$input['discountCode'] ?? '']))), 0, 5),
        'customerId' => $customerId, 'country' => om_clean($input['country'] ?? '', 5), 'usage' => $usage, 'customerUsage' => $customerUsage];
}
