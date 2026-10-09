<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') om_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
om_json(['ok' => true, 'placements' => om_cms_public_placements(), 'collections' => om_cms_public_collections()]);
