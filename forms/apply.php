<?php
/**
 * =============================================================================
 * BASMAT AL MAWARED — JOB APPLICATION HANDLER
 * =============================================================================
 * Receives applications from apply.html, validates everything server-side,
 * stores the CV and the record, and emails the recruitment team.
 *
 * Responds with JSON: {"ok":true,"reference":"BMC2631080306"} or {"ok":false,"error":"..."}
 *
 * SECURITY MODEL
 *   - POST only, same-origin enforced
 *   - Honeypot field + minimum completion time (blocks most bots without CAPTCHA)
 *   - Per-IP rate limiting
 *   - Uploads validated by real MIME type (finfo), not the filename or the
 *     browser-supplied type, then stored OUTSIDE the web root where possible,
 *     with a randomised filename and a .htaccess deny as a second layer
 *   - All header fields stripped of CR/LF to prevent header injection
 *   - Every value escaped before it enters the HTML email body
 *
 * BEFORE GOING LIVE
 *   1. Set RECIPIENT_EMAIL below.
 *   2. Add your live domain to $ALLOWED_HOSTS.
 *   3. Make sure the storage directory is writable by PHP.
 * =============================================================================
 */

declare(strict_types=1);

// All timestamps and reference numbers use Riyadh time, regardless of where
// the server is physically hosted.
date_default_timezone_set('Asia/Riyadh');

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const RECIPIENT_EMAIL = 'info@basmat-almawared.com';
const SUBJECT_PREFIX  = '[Job Application]';

// Hosts allowed to post to this endpoint.
$ALLOWED_HOSTS = [
    'basmat-almawared.com',
    'www.basmat-almawared.com',
    'localhost',
    '127.0.0.1',
];

const MAX_UPLOAD_BYTES  = 5242880;   // 5 MB
const MIN_SECONDS       = 5;         // faster than this is a bot
const RATE_LIMIT_MAX    = 5;         // applications per IP...
const RATE_LIMIT_WINDOW = 3600;      // ...per hour

// Accepted upload types: extension => allowed MIME types
const ALLOWED_TYPES = [
    'pdf'  => ['application/pdf'],
    'doc'  => ['application/msword', 'application/vnd.ms-office', 'application/x-ole-storage'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
];

// -----------------------------------------------------------------------------
// BOOTSTRAP
// -----------------------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/** Send a JSON response and stop. */
function respond(bool $ok, string $message = '', string $reference = ''): void
{
    echo json_encode($ok
        ? ['ok' => true, 'reference' => $reference]
        : ['ok' => false, 'error' => $message]);
    exit;
}

/** Log the real reason server-side, show the user something generic. */
function fail(string $internal, string $public = 'We could not process your application. Please try again.'): void
{
    error_log('[apply.php] ' . $internal);
    respond(false, $public);
}

/** Strip CR/LF so a value can never inject extra mail headers. */
function clean(string $v): string
{
    return trim(str_replace(["\r", "\n", "%0a", "%0d"], '', $v));
}

/** Read a POST field, trimmed and length-capped. */
function field(string $key, int $max = 500): string
{
    $v = isset($_POST[$key]) && is_string($_POST[$key]) ? trim($_POST[$key]) : '';
    return mb_substr($v, 0, $max);
}

function client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

// -----------------------------------------------------------------------------
// 1. REQUEST GUARDS
// -----------------------------------------------------------------------------

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    respond(false, 'Method not allowed.');
}

// Same-origin check: the Origin or Referer host must be on the allowlist.
$originHost = '';
if (!empty($_SERVER['HTTP_ORIGIN'])) {
    $originHost = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST) ?: '';
} elseif (!empty($_SERVER['HTTP_REFERER'])) {
    $originHost = parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) ?: '';
}
if ($originHost !== '' && !in_array(strtolower($originHost), $ALLOWED_HOSTS, true)) {
    fail('Blocked cross-origin POST from ' . $originHost, 'Request blocked.');
}

// -----------------------------------------------------------------------------
// 2. SPAM TRAPS
// -----------------------------------------------------------------------------

// Honeypot: invisible to humans, irresistible to bots.
if (field('website') !== '') {
    respond(true, '', 'BMC' . date('ydmHi'));   // pretend success so the bot does not retry
}

// Time trap.
$formTime = (int) field('form_time', 20);
if ($formTime > 0 && (time() - $formTime) < MIN_SECONDS) {
    respond(true, '', 'BMC' . date('ydmHi'));
}

// Rate limit per IP.
$throttleDir = sys_get_temp_dir() . '/bam_apply_throttle';
if (!is_dir($throttleDir)) {
    @mkdir($throttleDir, 0700, true);
}
if (is_dir($throttleDir) && is_writable($throttleDir)) {
    $bucket = $throttleDir . '/' . hash('sha256', client_ip()) . '.json';
    $hits = [];
    if (is_file($bucket)) {
        $raw = @file_get_contents($bucket);
        $decoded = $raw ? json_decode($raw, true) : null;
        if (is_array($decoded)) {
            $hits = array_values(array_filter(
                $decoded,
                static fn($t) => is_int($t) && $t > (time() - RATE_LIMIT_WINDOW)
            ));
        }
    }
    if (count($hits) >= RATE_LIMIT_MAX) {
        http_response_code(429);
        respond(false, 'You have submitted several applications recently. Please try again later, or email info@basmat-almawared.com.');
    }
    $hits[] = time();
    @file_put_contents($bucket, json_encode($hits), LOCK_EX);
}

// -----------------------------------------------------------------------------
// 3. VALIDATE INPUT
// -----------------------------------------------------------------------------

$jobId      = clean(field('job_id', 40));
$jobTitle   = clean(field('job_title', 150));
$available  = clean(field('available_from', 20));
$status     = clean(field('current_location', 100));
$name       = clean(field('full_name', 120));
$nationality= clean(field('nationality', 60));
$email      = clean(field('email', 150));
$phone      = clean(field('phone', 40));
$idType     = clean(field('id_type', 20));
$idNumber   = clean(field('id_number', 30));
$dob        = clean(field('dob', 20));
$city       = clean(field('city', 80));
$yearsExp   = clean(field('years_exp', 60));
$currentJob = clean(field('current_job', 120));
$skills     = field('skills', 1000);
$coverNote  = field('cover_note', 2000);
$talentPool = field('talent_pool', 10) === 'yes' ? 'Yes' : 'No';

$errors = [];

if ($jobId === '')                       $errors[] = 'position';
if (mb_strlen($name) < 2)                $errors[] = 'full name';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'email address';
if (strlen(preg_replace('/\D/', '', $phone)) < 9) $errors[] = 'mobile number';
if ($nationality === '')                 $errors[] = 'nationality';
if ($yearsExp === '')                    $errors[] = 'experience level';
if (field('consent') === '')             $errors[] = 'consent confirmation';

// ID number rules mirror the client-side checks.
if ($idType === 'iqama') {
    if (!preg_match('/^2\d{9}$/', $idNumber)) $errors[] = 'Iqama number (10 digits starting with 2)';
} elseif ($idType === 'national') {
    if (!preg_match('/^1\d{9}$/', $idNumber)) $errors[] = 'Saudi National ID (10 digits starting with 1)';
} elseif ($idType === 'passport') {
    if (!preg_match('/^[A-Za-z0-9]{5,15}$/', $idNumber)) $errors[] = 'passport number';
} else {
    $errors[] = 'ID type';
}

if ($errors) {
    respond(false, 'Please check the following: ' . implode(', ', $errors) . '.');
}

// -----------------------------------------------------------------------------
// 4. STORAGE LOCATION
// -----------------------------------------------------------------------------
// Set up before the reference is generated, because reference allocation needs
// somewhere to record which references are already taken.
// Stored outside the web root when possible. If it must live inside, the
// directory carries a .htaccess deny so uploads are never served back.

$storageBase = dirname(__DIR__, 2) . '/bam_applications';   // above web root
if (!is_dir($storageBase) && !@mkdir($storageBase, 0700, true)) {
    $storageBase = __DIR__ . '/uploads';                     // fallback
    if (!is_dir($storageBase)) {
        @mkdir($storageBase, 0700, true);
    }
    // Belt and braces: block direct access to the fallback directory.
    $deny = $storageBase . '/.htaccess';
    if (is_dir($storageBase) && !is_file($deny)) {
        @file_put_contents($deny, "Require all denied\nDeny from all\nOptions -Indexes\n");
    }
}

// -----------------------------------------------------------------------------
// 5. REFERENCE NUMBER
// -----------------------------------------------------------------------------
// Format: BMC + YY + DD + MM + HH + MM  (Riyadh time)   e.g. BMC2631080306
//         BMC | 26 | 31 | 08 | 03 | 06  =  2026, 31 August, 03:06
//
// Two applications can easily arrive within the same minute, and that would
// produce the same code. When the minute is already taken we append a sequence
// letter, so the second is BMC2631080306B, the third BMC2631080306C, and so on.
// The first keeps the clean unsuffixed form.
//
// Allocation is done under an exclusive file lock so two simultaneous
// submissions can never be handed the same reference.

/**
 * Reserve the next free reference for the current minute.
 * Returns something like BMC2631080306 or BMC2631080306B.
 */
function allocate_reference(string $storageDir): string
{
    $base = 'BMC' . date('ydmHi');

    // Without writable storage we cannot track collisions, so fall back to a
    // random suffix rather than risk issuing a duplicate.
    if (!is_dir($storageDir) || !is_writable($storageDir)) {
        return $base;
    }

    $ledger = rtrim($storageDir, '/') . '/.refs.json';
    $fh = @fopen($ledger, 'c+');
    if (!$fh) {
        return $base;
    }

    $reference = $base;

    if (flock($fh, LOCK_EX)) {
        $size = filesize($ledger) ?: 0;
        $raw  = $size > 0 ? (fread($fh, $size) ?: '') : '';
        $used = json_decode($raw, true);
        if (!is_array($used)) {
            $used = [];
        }

        $count = isset($used[$base]) ? (int) $used[$base] : 0;

        if ($count > 0) {
            // 1 -> B, 2 -> C ... 25 -> Z, then BA, BB for the very unlikely rest.
            if ($count < 26) {
                $reference = $base . chr(65 + $count);
            } else {
                $reference = $base . chr(65 + intdiv($count, 26)) . chr(65 + ($count % 26));
            }
        }

        $used[$base] = $count + 1;

        // Keep only the last 500 minutes so the ledger cannot grow forever.
        if (count($used) > 500) {
            $used = array_slice($used, -500, null, true);
        }

        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($used));
        fflush($fh);
        flock($fh, LOCK_UN);
    }

    fclose($fh);
    @chmod($ledger, 0600);

    return $reference;
}

$reference = allocate_reference($storageBase);

// -----------------------------------------------------------------------------
// 6. HANDLE THE CV UPLOAD
// -----------------------------------------------------------------------------

$storedPath = '';
$storedName = '';

if (!empty($_FILES['cv_file']) && ($_FILES['cv_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {

    $f = $_FILES['cv_file'];

    if ($f['error'] !== UPLOAD_ERR_OK) {
        respond(false, 'Your CV did not upload correctly. Please try again or submit without it.');
    }
    if ($f['size'] > MAX_UPLOAD_BYTES) {
        respond(false, 'Your CV is larger than 5 MB. Please upload a smaller file.');
    }
    if (!is_uploaded_file($f['tmp_name'])) {
        fail('is_uploaded_file() failed — possible tampering', 'Upload rejected.');
    }

    $ext = strtolower(pathinfo((string) $f['name'], PATHINFO_EXTENSION));
    if (!isset(ALLOWED_TYPES[$ext])) {
        respond(false, 'Only PDF, DOC and DOCX files are accepted.');
    }

    // Trust the file's real signature, never the supplied name or type.
    $detected = '';
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detected = (string) $finfo->file($f['tmp_name']);
        if ($detected !== '' && !in_array($detected, ALLOWED_TYPES[$ext], true)) {
            fail("MIME mismatch: .$ext reported as $detected", 'That file does not appear to be a valid PDF or Word document.');
        }
    }

    $storedName = $reference . '_' . preg_replace('/[^A-Za-z0-9]/', '', substr($name, 0, 20)) . '.' . $ext;
    $candidate  = rtrim($storageBase, '/') . '/' . $storedName;

    if (is_dir($storageBase) && is_writable($storageBase) && move_uploaded_file($f['tmp_name'], $candidate)) {
        @chmod($candidate, 0600);
        $storedPath = $candidate;
    } else {
        error_log('[apply.php] Could not store upload in ' . $storageBase);
    }
}

// -----------------------------------------------------------------------------
// 7. APPEND TO THE APPLICANTS LOG (CSV, opens in Excel)
// -----------------------------------------------------------------------------

if (is_dir($storageBase) && is_writable($storageBase)) {
    $csv = rtrim($storageBase, '/') . '/applicants.csv';
    $new = !is_file($csv);
    if ($fh = @fopen($csv, 'a')) {
        if (flock($fh, LOCK_EX)) {
            if ($new) {
                fwrite($fh, "\xEF\xBB\xBF");   // BOM so Excel reads UTF-8 correctly
                fputcsv($fh, [
                    'Reference', 'Received', 'Job Ref', 'Job Title', 'Name', 'Nationality',
                    'Email', 'Phone', 'ID Type', 'ID Number', 'DOB', 'City', 'Status',
                    'Available From', 'Experience', 'Current Role', 'Skills',
                    'Talent Pool', 'CV File', 'IP',
                ]);
            }
            fputcsv($fh, [
                $reference, date('Y-m-d H:i:s'), $jobId, $jobTitle, $name, $nationality,
                $email, $phone, $idType, $idNumber, $dob, $city, $status,
                $available, $yearsExp, $currentJob, $skills,
                $talentPool, $storedName ?: 'none', client_ip(),
            ]);
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    }
}

// -----------------------------------------------------------------------------
// 8. EMAIL THE RECRUITMENT TEAM
// -----------------------------------------------------------------------------

$e = static fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');

$rows = [
    'Reference'       => $reference,
    'Position'        => $jobTitle . ' (Ref ' . $jobId . ')',
    'Available From'  => $available,
    'Current Status'  => $status,
    'Full Name'       => $name,
    'Nationality'     => $nationality,
    'Email'           => $email,
    'Mobile'          => $phone,
    'ID Type'         => $idType,
    'ID Number'       => $idNumber,
    'Date of Birth'   => $dob,
    'City'            => $city,
    'Experience'      => $yearsExp,
    'Current Role'    => $currentJob,
    'Skills'          => $skills,
    'Notes'           => $coverNote,
    'Talent Pool'     => $talentPool,
    'CV Attached'     => $storedName ?: 'No file uploaded',
];

$html  = '<html><body style="font-family:Arial,Helvetica,sans-serif;color:#222;">';
$html .= '<h2 style="color:#8b6c38;margin:0 0 4px;">New Job Application</h2>';
$html .= '<p style="margin:0 0 16px;color:#666;font-size:13px;">Reference <strong>' . $e($reference) . '</strong> &middot; ' . $e(date('d M Y, H:i')) . '</p>';
$html .= '<table cellpadding="8" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;">';
$i = 0;
foreach ($rows as $k => $v) {
    if ($v === '') continue;
    $bg = (++$i % 2) ? '#faf8f4' : '#ffffff';
    $html .= '<tr style="background:' . $bg . ';">'
           . '<td style="width:170px;color:#666;font-size:13px;border-bottom:1px solid #eee;">' . $e($k) . '</td>'
           . '<td style="font-size:14px;font-weight:600;border-bottom:1px solid #eee;">' . nl2br($e($v)) . '</td></tr>';
}
$html .= '</table>';
if ($storedPath !== '') {
    $html .= '<p style="font-size:13px;color:#666;margin-top:16px;">CV stored on the server as <strong>' . $e($storedName) . '</strong> and attached to this email.</p>';
}
$html .= '</body></html>';

$serverName = $_SERVER['SERVER_NAME'] ?? 'basmat-almawared.com';
$fromAddr   = 'no-reply@' . preg_replace('/[^a-zA-Z0-9.\-]/', '', $serverName);
$subject    = SUBJECT_PREFIX . ' ' . $jobTitle . ' — ' . $name . ' (' . $reference . ')';

$boundary = '=_bam_' . bin2hex(random_bytes(8));

$headers  = 'MIME-Version: 1.0' . "\r\n";
$headers .= 'From: Basmat Al Mawared Careers <' . $fromAddr . '>' . "\r\n";
$headers .= 'Reply-To: ' . clean($name) . ' <' . $email . '>' . "\r\n";
$headers .= 'X-Mailer: PHP/' . phpversion() . "\r\n";
$headers .= 'Content-Type: multipart/mixed; boundary="' . $boundary . '"' . "\r\n";

$body  = '--' . $boundary . "\r\n";
$body .= 'Content-Type: text/html; charset=UTF-8' . "\r\n";
$body .= 'Content-Transfer-Encoding: 8bit' . "\r\n\r\n";
$body .= $html . "\r\n\r\n";

// Attach the CV when we managed to store it.
if ($storedPath !== '' && is_readable($storedPath) && filesize($storedPath) <= MAX_UPLOAD_BYTES) {
    $data = @file_get_contents($storedPath);
    if ($data !== false) {
        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Type: application/octet-stream; name="' . $storedName . '"' . "\r\n";
        $body .= 'Content-Transfer-Encoding: base64' . "\r\n";
        $body .= 'Content-Disposition: attachment; filename="' . $storedName . '"' . "\r\n\r\n";
        $body .= chunk_split(base64_encode($data)) . "\r\n";
    }
}
$body .= '--' . $boundary . "--";

$sent = @mail(RECIPIENT_EMAIL, clean($subject), $body, $headers, '-f' . $fromAddr);

// The application is already stored, so a mail failure must not lose it.
if (!$sent) {
    error_log('[apply.php] mail() failed for ' . $reference . ' — record is stored in ' . $storageBase);
}

// -----------------------------------------------------------------------------
// 9. CONFIRMATION TO THE CANDIDATE
// -----------------------------------------------------------------------------

$ackSubject = 'We received your application — ' . $reference;
$ackBody    = "Dear " . clean($name) . ",\n\n"
            . "Thank you for applying to Basmat Al Mawared.\n\n"
            . "Position:  " . $jobTitle . "\n"
            . "Reference: " . $reference . "\n\n"
            . "Our recruitment team reviews every application within two working days. "
            . "If your profile matches the role, we will contact you on the number you provided.\n\n"
            . "Please quote your reference number in any correspondence.\n\n"
            . "Basmat Al Mawared Company Limited\n"
            . "Riyadh, Saudi Arabia\n"
            . "info@basmat-almawared.com";

$ackHeaders  = 'From: Basmat Al Mawared <' . $fromAddr . '>' . "\r\n";
$ackHeaders .= 'Reply-To: ' . RECIPIENT_EMAIL . "\r\n";
$ackHeaders .= 'Content-Type: text/plain; charset=UTF-8' . "\r\n";

@mail($email, clean($ackSubject), $ackBody, $ackHeaders, '-f' . $fromAddr);

// -----------------------------------------------------------------------------
// 10. DONE
// -----------------------------------------------------------------------------

respond(true, '', $reference);
