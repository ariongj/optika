<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
if (!om_same_origin()) om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
om_session_start();
om_rate_limit('quote', 180, 300);
$input = om_input();
$quote = om_quote_order($input);
unset($quote['requestedByProduct'], $quote['campaign']);
om_json(['ok' => true, 'quote' => $quote]);
