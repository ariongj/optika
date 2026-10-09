<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
    om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}
if (!om_same_origin()) {
    om_json(['ok' => false, 'error' => 'origin_not_allowed'], 403);
}
om_rate_limit('analytics_events', 240, 3600);
$input = om_input();
$eventName = om_clean($input['event'] ?? '', 80);
if ($eventName === '') om_json(['ok' => false, 'error' => 'event_required'], 422);
$events = om_read('events', []);
array_unshift($events, [
    'id' => om_id('EVT'),
    'time' => gmdate('c'),
    'event' => $eventName,
    'path' => om_clean($input['path'] ?? '', 240),
    'label' => om_clean($input['label'] ?? '', 240),
    'device' => om_clean($input['device'] ?? '', 40),
    'language' => om_clean($input['language'] ?? '', 30),
]);
om_write('events', array_slice($events, 0, 5000));
om_json(['ok' => true], 202);
