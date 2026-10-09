<?php
declare(strict_types=1);
require __DIR__ . '/../public/api/luna-core.php';
$root = __DIR__ . '/../output/qa/luna-activation-20261005/config-' . bin2hex(random_bytes(6));
mkdir($root . '/public_html', 0700, true);
mkdir($root . '/optika-miftari-data', 0700, true);
$file = $root . '/optika-miftari-data/luna.env';
$synthetic = 'synthetic_TEST_value_not_a_real_key';
$checks = 0;
function check_config(bool $ok, string $name): void { global $checks; if (!$ok) throw new RuntimeException($name); echo "PASS $name\n"; $checks++; }
try {
    $_SERVER['DOCUMENT_ROOT'] = realpath($root . '/public_html');
    check_config(om_luna_private_key($root . '/public_html') === '', 'Missing config remains unavailable');
    file_put_contents($file, "OPENAI_API_KEY=$synthetic\n"); chmod($file, 0600);
    check_config(om_luna_private_key($root . '/public_html') === $synthetic, 'Private sibling file loads');
    $_SERVER['DOCUMENT_ROOT'] = realpath($root);
    check_config(om_luna_private_key($root . '/public_html') === '', 'Config inside actual document root rejected');
    $_SERVER['DOCUMENT_ROOT'] = realpath($root . '/public_html');
    file_put_contents($file, str_repeat('x', 8193));
    check_config(om_luna_private_key($root . '/public_html') === '', 'Oversized file rejected');
    file_put_contents($file, "OPENAI_API_KEY=$synthetic\nOTHER=unexpected");
    check_config(om_luna_private_key($root . '/public_html') === '', 'Unexpected configuration rejected');
    putenv('OPENAI_API_KEY=' . $synthetic);
    check_config(om_luna_key() === $synthetic, 'Environment still takes priority');
    putenv('OPENAI_API_KEY');
    echo "$checks checks passed\n";
} finally {
    if (is_file($file)) unlink($file);
    rmdir($root . '/optika-miftari-data'); rmdir($root . '/public_html'); rmdir($root);
}
