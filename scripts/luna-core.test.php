<?php
declare(strict_types=1);
require __DIR__ . '/../public/api/bootstrap.php';
require __DIR__ . '/../public/api/luna-core.php';
$checks = 0;
function verify(bool $condition, string $name): void { global $checks; if (!$condition) throw new RuntimeException($name); $checks++; echo "PASS $name\n"; }
$synthetic = 'synthetic_TEST_value_not_a_real_key';
verify(om_luna_parse_key("OPENAI_API_KEY=$synthetic\n") === $synthetic, 'Literal private key configuration parsed');
verify(om_luna_parse_key("# private\nOPENAI_API_KEY=\"$synthetic\"\n") === $synthetic, 'Quoted private configuration parsed');
foreach (['', 'OTHER=unrelated', "OPENAI_API_KEY=$synthetic\nOPENAI_API_KEY=$synthetic", 'OPENAI_API_KEY=$(command)', 'OPENAI_API_KEY=short', "OPENAI_API_KEY=$synthetic\nOTHER=not_allowed"] as $invalid) {
    verify(om_luna_parse_key($invalid) === '', 'Malformed or unexpected private config rejected');
}
$base = ['question' => 'Si ta përdor kamerën?', 'language' => 'sq', 'mode' => 'live', 'status' => 'denied', 'productId' => 'frame-1', 'consent' => true];
$input = om_luna_input($base);
verify($input['mode'] === 'live' && $input['status'] === 'denied', 'Known context preserved');
foreach ([['consent' => false], ['question' => ''], ['question' => str_repeat('x', 2401)], ['question' => 'https://example.test/private'], ['mode' => 'bad'], ['status' => 'bad'], ['language' => 'bad'], ['question' => []], ['photo' => 'data:image/png;base64,AAA'], ['history' => []], ['productId' => []]] as $change) {
    $rejected = false;
    try { om_luna_input(array_merge($base, $change)); } catch (InvalidArgumentException $e) { $rejected = true; }
    verify($rejected, 'Reject invalid/private input ' . implode(',', array_keys($change)));
}
$payload = om_luna_payload($input, [['id' => 'frame-1', 'name' => 'Example frame', 'frameWidth' => 138, 'costPrice' => 10, 'internalNote' => 'PRIVATE', 'stock' => 90]]);
verify($payload['model'] === 'gpt-6-luna' && $payload['store'] === false, 'Exact model and no response storage');
verify(str_contains($payload['instructions'], 'reset = "Centre the view"') && str_contains($payload['instructions'], 'reset = "Qendërzo pamjen"'), 'Reset labels explicitly provided for both languages');
verify(!str_contains($payload['input'], 'PRIVATE') && !str_contains($payload['input'], 'costPrice') && !str_contains($payload['input'], 'stock'), 'Only safe catalogue fields sent');
verify(json_decode($payload['input'], true)['catalogueFrame']['frameWidth'] === 138, 'Catalogue measurement remains sourced');
$response = ['status' => 'completed', 'model' => 'gpt-6-luna', 'output' => [['type' => 'message', 'role' => 'assistant', 'content' => [['type' => 'output_text', 'text' => 'Use the photo tab.']]]]];
verify(om_luna_output($response) === 'Use the photo tab.', 'Valid provider text accepted');
verify(om_luna_output(array_merge($response, ['status' => 'incomplete'])) === '', 'Incomplete output rejected');
verify(om_luna_output(array_merge($response, ['model' => 'other-model'])) === '', 'Different model rejected');
$response['output'][0]['content'][] = ['type' => 'refusal', 'refusal' => 'No'];
verify(om_luna_output($response) === '', 'Refusal is not a successful answer');
verify(om_luna_output(['status' => 'completed', 'model' => 'gpt-6-luna', 'output' => []]) === '', 'Empty output rejected');
echo "$checks checks passed\n";
