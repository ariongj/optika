<?php
// Isolated localhost emulator for the release's Apache route rules.
declare(strict_types=1);
$root = realpath(__DIR__ . '/../dist');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$route = trim($path, '/');
$registry = json_decode((string) file_get_contents($root . '/seo-pages.json'), true);
$known = isset($registry['pages']['/' . $route]);
if ($path !== '/' && $known && !str_ends_with($path, '/')) { http_response_code(301); $query = parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY); header('Location: ' . $path . '/' . ($query ? '?' . $query : '')); exit; }
if ($known || $route === 'sitemap.xml' || preg_match('#^syze-(dielli|optike)/[^/]+/?$#', $route)) { require $root . '/api/seo.php'; exit; }
$candidate = realpath($root . $path);
if ($candidate && str_starts_with($candidate, $root . DIRECTORY_SEPARATOR) && is_file($candidate)) return false;
if ($candidate && is_dir($candidate) && is_file($candidate . '/index.html')) return false;
http_response_code(404); header('X-Robots-Tag: noindex, follow'); require $root . '/404.html';
