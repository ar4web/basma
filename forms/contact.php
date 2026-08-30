<?php
/**
 * Basmat Al Mawared — secure contact / manpower demand handler
 * Self-contained: no third-party library required.
 *
 * Security controls implemented:
 *  - POST-only, same-origin enforcement
 *  - Honeypot + time-trap bot rejection
 *  - Per-IP rate limiting (filesystem based)
 *  - Strict input validation and length caps
 *  - Email header-injection prevention (CRLF stripping)
 *  - Output encoding for the HTML mail body
 *  - Generic error messages (no internal detail leaked to the client)
 */

declare(strict_types=1);

// ---------------------------------------------------------------------------
// CONFIGURATION — edit these values
// ---------------------------------------------------------------------------
const RECIPIENT_EMAIL = 'info@basmat-almawared.com';
const SITE_NAME       = 'Basmat Al Mawared';

// Domains permitted to POST to this endpoint. Add your production host(s).
const ALLOWED_HOSTS = [
    'basmat-almawared.com',
    'www.basmat-almawared.com',
    'localhost',
    '127.0.0.1',
];

const MAX_PER_HOUR       = 5;    // submissions allowed per IP per hour
const MIN_SECONDS_ON_FORM = 3;   // faster than this is a bot

// ---------------------------------------------------------------------------

header('Content-Type: text/plain; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

/** Terminate with a generic message; log the real reason server-side only. */
function fail(string $publicMessage, string $logReason = ''): never
{
    if ($logReason !== '') {
        error_log('[contact.php] ' . $logReason);
    }
    http_response_code(400);
    echo $publicMessage;
    exit;
}

// --- 1. Method ---------------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit('Method not allowed.');
}

// --- 2. Same-origin check ----------------------------------------------------
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
if ($origin !== '') {
    $host = parse_url($origin, PHP_URL_HOST) ?: '';
    if ($host !== '' && !in_array($host, ALLOWED_HOSTS, true)) {
        fail('Request rejected.', 'cross-origin POST from ' . $host);
    }
}

// --- 3. Honeypot + time trap -------------------------------------------------
// A hidden field real users never see. Bots fill it in.
if (trim((string)($_POST['website'] ?? '')) !== '') {
    // Pretend success so the bot does not retry with a different strategy.
    echo 'OK';
    exit;
}

$renderedAt = (int)($_POST['form_time'] ?? 0);
if ($renderedAt > 0 && (time() - $renderedAt) < MIN_SECONDS_ON_FORM) {
    echo 'OK';
    exit;
}

// --- 4. Rate limiting --------------------------------------------------------
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
    $ip = '0.0.0.0';
}

$throttleDir = sys_get_temp_dir() . '/bam_contact_throttle';
if (!is_dir($throttleDir)) {
    @mkdir($throttleDir, 0700, true);
}
$throttleFile = $throttleDir . '/' . hash('sha256', $ip) . '.json';

$now     = time();
$window  = 3600;
$history = [];

if (is_readable($throttleFile)) {
    $decoded = json_decode((string)file_get_contents($throttleFile), true);
    if (is_array($decoded)) {
        $history = array_filter($decoded, static fn($t): bool => is_int($t) && ($t > $now - $window));
    }
}

if (count($history) >= MAX_PER_HOUR) {
    http_response_code(429);
    exit('Too many submissions. Please try again later, or call us directly.');
}

$history[] = $now;
@file_put_contents($throttleFile, json_encode(array_values($history)), LOCK_EX);

// --- 5. Collect + validate input --------------------------------------------
/** Strip CR/LF so user input can never inject additional mail headers. */
function singleLine(string $value, int $maxLength): string
{
    $value = str_replace(["\r", "\n", "\0", '%0a', '%0d', '%0A', '%0D'], ' ', $value);
    $value = trim(preg_replace('/\s+/', ' ', $value) ?? '');
    return mb_substr($value, 0, $maxLength);
}

$name    = singleLine((string)($_POST['name'] ?? ''), 100);
$email   = singleLine((string)($_POST['email'] ?? ''), 150);
$subject = singleLine((string)($_POST['subject'] ?? ''), 150);
$phone   = singleLine((string)($_POST['phone'] ?? ''), 40);
$message = trim((string)($_POST['message'] ?? ''));
$message = mb_substr(str_replace("\0", '', $message), 0, 5000);

$errors = [];

if (mb_strlen($name) < 2) {
    $errors[] = 'Please enter your name.';
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Please enter a valid email address.';
}
if (mb_strlen($subject) < 2) {
    $errors[] = 'Please describe your requirement.';
}
if (mb_strlen($message) < 10) {
    $errors[] = 'Please give us a little more detail (at least 10 characters).';
}
if ($phone !== '' && !preg_match('/^[0-9+()\s.-]{6,40}$/', $phone)) {
    $errors[] = 'Please enter a valid phone number.';
}

if ($errors !== []) {
    http_response_code(422);
    exit(implode(' ', $errors));
}

// --- 6. Build and send the mail ---------------------------------------------
$safeSubject = '[Manpower Demand] ' . $subject;

$rows = [
    'Name'        => $name,
    'Email'       => $email,
    'Phone'       => $phone !== '' ? $phone : '—',
    'Requirement' => $subject,
    'Received'    => date('Y-m-d H:i:s T'),
    'Source IP'   => $ip,
];

$body  = '<html><body style="font-family:Arial,Helvetica,sans-serif;color:#27200c">';
$body .= '<h2 style="color:#8b6c38;margin:0 0 16px">New manpower demand — ' . htmlspecialchars(SITE_NAME, ENT_QUOTES, 'UTF-8') . '</h2>';
$body .= '<table cellpadding="8" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px">';
foreach ($rows as $label => $value) {
    $body .= '<tr>'
        . '<td style="background:#f5f4ef;font-weight:bold;white-space:nowrap">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</td>'
        . '<td>' . htmlspecialchars($value, ENT_QUOTES, 'UTF-8') . '</td>'
        . '</tr>';
}
$body .= '</table>';
$body .= '<h3 style="color:#8b6c38;margin:20px 0 8px">Message</h3>';
$body .= '<div style="font-size:14px;line-height:1.6">' . nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8')) . '</div>';
$body .= '</body></html>';

// The From address must be a domain we control, otherwise SPF/DKIM will fail.
$fromDomain = $_SERVER['SERVER_NAME'] ?? 'basmat-almawared.com';
$fromDomain = preg_replace('/[^a-zA-Z0-9.\-]/', '', $fromDomain) ?: 'basmat-almawared.com';

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: ' . SITE_NAME . ' Website <no-reply@' . $fromDomain . '>',
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion(),
];

$sent = @mail(
    RECIPIENT_EMAIL,
    '=?UTF-8?B?' . base64_encode($safeSubject) . '?=',
    $body,
    implode("\r\n", $headers)
);

if (!$sent) {
    error_log('[contact.php] mail() failed for ' . $email);
    http_response_code(500);
    exit('We could not send your message right now. Please email info@basmat-almawared.com or call +966 56 999 0576.');
}

echo 'OK';
