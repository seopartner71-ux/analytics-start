<?php
/**
 * Supabase reverse-proxy для Beget (обход блокировки *.supabase.co в РФ).
 *
 * Принимает запросы вида /api/proxy.php?path=/auth/v1/token?grant_type=password
 * и форвардит их в Supabase через cURL.
 *
 * ВАЖНО:
 *  - В Nginx должен быть отключён gzip для этого location, иначе двойное
 *    сжатие сломает бинарные ответы (ERR_CONTENT_DECODING_FAILED).
 *  - Anon key захардкожен ниже — при ротации обновлять вручную.
 */

// === КОНФИГ ===
$SUPABASE_URL = 'https://iigedewmxyqigivsqwqz.supabase.co';
$SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZ2VkZXdteHlxaWdpdnNxd3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDU4MTMsImV4cCI6MjA5MDE4MTgxM30.11sID9y098DL29ocSLP109NuUyjF1I-hxY_1Rb3kKao';
$ALLOWED_PREFIXES = ['/functions/v1/', '/rest/v1/', '/auth/v1/', '/storage/v1/'];

// Отключаем сжатие на стороне PHP — иначе двойной gzip
@ini_set('zlib.output_compression', 'Off');
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
}

// === CORS preflight ===
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, range, accept-profile, content-profile');
header('Access-Control-Expose-Headers: content-range, content-length, content-type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// === Валидация пути ===
$path = $_GET['path'] ?? '';
if ($path === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing path parameter']);
    exit;
}

$pathOnly = strtok($path, '?');
$allowed = false;
foreach ($ALLOWED_PREFIXES as $prefix) {
    if (strpos($pathOnly, $prefix) === 0) {
        $allowed = true;
        break;
    }
}
if (!$allowed) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Path not allowed']);
    exit;
}

$targetUrl = $SUPABASE_URL . $path;

// === Сборка заголовков для апстрима ===
$forwardHeaders = [];
$hasApiKey = false;
$incomingHeaders = function_exists('getallheaders') ? getallheaders() : [];
foreach ($incomingHeaders as $name => $value) {
    $lower = strtolower($name);
    // Пропускаем заголовки, которые управляются cURL/хостом
    if (in_array($lower, ['host', 'content-length', 'connection', 'accept-encoding', 'origin', 'referer', 'cookie'], true)) {
        continue;
    }
    if ($lower === 'apikey') {
        $hasApiKey = true;
    }
    $forwardHeaders[] = $name . ': ' . $value;
}
if (!$hasApiKey) {
    $forwardHeaders[] = 'apikey: ' . $SUPABASE_ANON_KEY;
}
// Запрашиваем у апстрима без сжатия — PHP всё равно не умеет ретранслировать
$forwardHeaders[] = 'Accept-Encoding: identity';

// === cURL-запрос ===
$method = $_SERVER['REQUEST_METHOD'];
$body = file_get_contents('php://input');

$ch = curl_init($targetUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_HEADER => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);
if ($method !== 'GET' && $method !== 'HEAD' && $body !== '') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
if ($response === false) {
    $err = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Upstream request failed', 'detail' => $err]);
    exit;
}

$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

http_response_code($statusCode);

// Прокидываем безопасные заголовки апстрима
$skip = ['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length', 'access-control-allow-origin', 'access-control-allow-credentials', 'access-control-allow-methods', 'access-control-allow-headers'];
foreach (explode("\r\n", $rawHeaders) as $line) {
    if ($line === '' || stripos($line, 'HTTP/') === 0) continue;
    $parts = explode(':', $line, 2);
    if (count($parts) !== 2) continue;
    $hName = trim($parts[0]);
    $hValue = trim($parts[1]);
    if (in_array(strtolower($hName), $skip, true)) continue;
    header($hName . ': ' . $hValue, false);
}

echo $responseBody;
