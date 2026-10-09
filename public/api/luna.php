<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/luna-core.php';

if (!om_same_origin()) om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
$key = om_luna_key();
$ready = $key !== '' && getenv('OPTIKA_LUNA_ENABLED') !== '0' && function_exists('curl_init');
om_session_start();
if (empty($_SESSION['luna_csrf'])) $_SESSION['luna_csrf'] = bin2hex(random_bytes(24));
$csrf = (string) $_SESSION['luna_csrf'];
session_write_close();
if ($method === 'GET') om_json(['ok' => true, 'available' => $ready, 'csrf' => $csrf, 'model' => OM_LUNA_MODEL]);
if (!hash_equals($csrf, (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) om_json(['ok' => false, 'error' => 'invalid_csrf_token'], 403);
if (!$ready) om_json(['ok' => false, 'error' => 'configuration_required'], 503);
if (!str_starts_with(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json')) om_json(['ok' => false, 'error' => 'invalid_input'], 415);
$raw = file_get_contents('php://input', false, null, 0, 4097);
if ($raw === false || strlen($raw) > 4096) om_json(['ok' => false, 'error' => 'request_too_large'], 413);
$input = json_decode($raw, true);
if (!is_array($input)) om_json(['ok' => false, 'error' => 'invalid_input'], 422);
try { $input = om_luna_input($input); }
catch (InvalidArgumentException $error) { om_json(['ok' => false, 'error' => $error->getMessage()], 422); }
if (!om_luna_reserve()) om_json(['ok' => false, 'error' => 'usage_limit'], 429);

$payload = om_luna_payload($input, om_products());
$curl = curl_init('https://api.openai.com/v1/responses');
// Use the operating system trust store on the Windows local runtime, never disable TLS verification.
if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) curl_setopt($curl, CURLOPT_SSL_OPTIONS, CURLSSLOPT_NATIVE_CA);
curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 25, CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2]);
$rawResponse = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_errno($curl);
unset($curl);
if ($curlError || $status !== 200 || !is_string($rawResponse)) {
    // Do not return/log raw provider messages, headers, user text, or secrets.
    om_json(['ok' => false, 'error' => $curlError === 28 ? 'provider_timeout' : ($status === 429 ? 'provider_busy' : 'provider_unavailable')], 503);
}
$response = json_decode($rawResponse, true);
$answer = is_array($response) ? om_luna_output($response) : '';
if ($answer === '') om_json(['ok' => false, 'error' => 'answer_unavailable'], 502);
om_json(['ok' => true, 'model' => OM_LUNA_MODEL, 'answer' => $answer]);
