<?php
/**
 * =============================================================================
 * BASMAT AL MAWARED — ADMIN API
 * =============================================================================
 * Backend for the vacancy manager. Handles login, session, and CRUD on
 * data/jobs.json.
 *
 * SECURITY
 *   - Password stored as a bcrypt hash, never in plain text
 *   - Session cookie is HttpOnly, SameSite=Strict, Secure over HTTPS
 *   - Every write requires a valid CSRF token
 *   - Login is rate limited and lockout applies after repeated failures
 *   - Session times out after inactivity
 *   - Writes are atomic (temp file + rename) with a timestamped backup,
 *     so a crash mid-save can never corrupt the live job list
 *
 * FIRST RUN
 *   Open admin/ in a browser. If no account exists you will be asked to
 *   create one. That form disables itself permanently once used.
 * =============================================================================
 */

declare(strict_types=1);

session_name('BAMADMIN');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Strict',
    'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// -----------------------------------------------------------------------------
// PATHS
// -----------------------------------------------------------------------------

const DATA_DIR   = __DIR__ . '/../data';
const JOBS_FILE  = DATA_DIR . '/jobs.json';
const AUTH_FILE  = DATA_DIR . '/admin.json';
const LOG_FILE   = DATA_DIR . '/admin-log.txt';
const BACKUP_DIR = DATA_DIR . '/backups';

const SESSION_TIMEOUT = 3600;   // 1 hour of inactivity
const MAX_ATTEMPTS    = 5;      // failed logins before lockout
const LOCKOUT_SECONDS = 900;    // 15 minutes

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function out(array $payload, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

function ok(array $extra = []): void
{
    out(array_merge(['ok' => true], $extra));
}

function err(string $msg, int $code = 400): void
{
    out(['ok' => false, 'error' => $msg], $code);
}

function client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

function audit(string $event, string $detail = ''): void
{
    $line = sprintf(
        "%s\t%s\t%s\t%s\n",
        date('Y-m-d H:i:s'),
        client_ip(),
        $event,
        str_replace(["\r", "\n", "\t"], ' ', $detail)
    );
    @file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

function read_json(string $path, $fallback)
{
    if (!is_file($path)) return $fallback;
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') return $fallback;
    $d = json_decode($raw, true);
    return is_array($d) ? $d : $fallback;
}

/** Atomic write: temp file then rename, so readers never see a half-written file. */
function write_json_atomic(string $path, array $data): bool
{
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) return false;

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) return false;

    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        @unlink($tmp);
        return false;
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }
    @chmod($path, 0640);
    return true;
}

function backup_jobs(): void
{
    if (!is_file(JOBS_FILE)) return;
    if (!is_dir(BACKUP_DIR)) @mkdir(BACKUP_DIR, 0750, true);
    if (!is_dir(BACKUP_DIR)) return;

    @copy(JOBS_FILE, BACKUP_DIR . '/jobs-' . date('Ymd-His') . '.json');

    // Keep only the 20 most recent backups.
    $files = glob(BACKUP_DIR . '/jobs-*.json') ?: [];
    if (count($files) > 20) {
        usort($files, static fn($a, $b) => filemtime($a) <=> filemtime($b));
        foreach (array_slice($files, 0, count($files) - 20) as $old) {
            @unlink($old);
        }
    }
}

function logged_in(): bool
{
    if (empty($_SESSION['bam_admin'])) return false;
    if ((time() - ($_SESSION['bam_seen'] ?? 0)) > SESSION_TIMEOUT) {
        session_unset();
        session_destroy();
        return false;
    }
    $_SESSION['bam_seen'] = time();
    return true;
}

function require_login(): void
{
    if (!logged_in()) err('Your session has expired. Please sign in again.', 401);
}

function csrf_token(): string
{
    if (empty($_SESSION['bam_csrf'])) {
        $_SESSION['bam_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['bam_csrf'];
}

function require_csrf(array $in): void
{
    $sent = (string) ($in['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
    if ($sent === '' || empty($_SESSION['bam_csrf']) || !hash_equals($_SESSION['bam_csrf'], $sent)) {
        audit('CSRF_FAIL');
        err('Security token mismatch. Please reload the page.', 403);
    }
}

/** Trim, strip control chars, cap length. */
function s($v, int $max = 300): string
{
    if (!is_string($v)) $v = (string) $v;
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v);
    return mb_substr(trim($v), 0, $max);
}

function s_lines($v, int $max = 3000): array
{
    if (is_array($v)) {
        $lines = $v;
    } else {
        $lines = preg_split('/\r\n|\r|\n/', (string) $v) ?: [];
    }
    $outLines = [];
    foreach ($lines as $l) {
        $l = s($l, 300);
        if ($l !== '') $outLines[] = $l;
        if (count($outLines) >= 25) break;
    }
    return $outLines;
}

// -----------------------------------------------------------------------------
// INPUT
// -----------------------------------------------------------------------------

$raw = file_get_contents('php://input');
$in  = json_decode($raw ?: '[]', true);
if (!is_array($in)) $in = [];
$action = s($in['action'] ?? ($_GET['action'] ?? ''), 40);

$auth = read_json(AUTH_FILE, null);
$hasAccount = is_array($auth) && !empty($auth['hash']);

// -----------------------------------------------------------------------------
// ACTIONS
// -----------------------------------------------------------------------------

switch ($action) {

    // ---------------------------------------------------------------- status
    case 'status':
        ok([
            'installed' => $hasAccount,
            'auth'      => logged_in(),
            'csrf'      => logged_in() ? csrf_token() : null,
            'user'      => logged_in() ? ($_SESSION['bam_user'] ?? '') : null,
        ]);
        break;

    // ---------------------------------------------------------------- setup
    case 'setup':
        if ($hasAccount) err('An account already exists.', 409);

        $user = s($in['username'] ?? '', 60);
        $pass = (string) ($in['password'] ?? '');

        if (mb_strlen($user) < 3)  err('Username must be at least 3 characters.');
        if (strlen($pass) < 10)    err('Password must be at least 10 characters.');
        if (!preg_match('/[A-Za-z]/', $pass) || !preg_match('/\d/', $pass)) {
            err('Password must contain both letters and numbers.');
        }

        if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0750, true);

        $record = [
            'username' => $user,
            'hash'     => password_hash($pass, PASSWORD_DEFAULT),
            'created'  => date('c'),
        ];
        if (!write_json_atomic(AUTH_FILE, $record)) {
            err('Could not save the account. Check that the data directory is writable.', 500);
        }
        audit('SETUP', $user);

        session_regenerate_id(true);
        $_SESSION['bam_admin'] = true;
        $_SESSION['bam_user']  = $user;
        $_SESSION['bam_seen']  = time();
        ok(['csrf' => csrf_token(), 'user' => $user]);
        break;

    // ---------------------------------------------------------------- login
    case 'login':
        if (!$hasAccount) err('No account exists yet.', 409);

        // Lockout check
        $fails = $_SESSION['bam_fails'] ?? 0;
        $until = $_SESSION['bam_lock'] ?? 0;
        if ($fails >= MAX_ATTEMPTS && time() < $until) {
            audit('LOCKED_OUT');
            err('Too many failed attempts. Try again in ' . ceil(($until - time()) / 60) . ' minutes.', 429);
        }

        $user = s($in['username'] ?? '', 60);
        $pass = (string) ($in['password'] ?? '');

        $userOk = hash_equals((string) $auth['username'], $user);
        $passOk = password_verify($pass, (string) $auth['hash']);

        if (!$userOk || !$passOk) {
            $_SESSION['bam_fails'] = $fails + 1;
            if ($_SESSION['bam_fails'] >= MAX_ATTEMPTS) {
                $_SESSION['bam_lock'] = time() + LOCKOUT_SECONDS;
            }
            audit('LOGIN_FAIL', $user);
            usleep(400000);   // slow down brute force
            err('Incorrect username or password.', 401);
        }

        unset($_SESSION['bam_fails'], $_SESSION['bam_lock']);
        session_regenerate_id(true);
        $_SESSION['bam_admin'] = true;
        $_SESSION['bam_user']  = $auth['username'];
        $_SESSION['bam_seen']  = time();
        audit('LOGIN_OK', $auth['username']);
        ok(['csrf' => csrf_token(), 'user' => $auth['username']]);
        break;

    // ---------------------------------------------------------------- logout
    case 'logout':
        audit('LOGOUT', $_SESSION['bam_user'] ?? '');
        session_unset();
        session_destroy();
        ok();
        break;

    // ---------------------------------------------------------------- list
    case 'list':
        require_login();
        $store = read_json(JOBS_FILE, ['updated' => null, 'jobs' => []]);
        ok([
            'jobs'    => $store['jobs'] ?? [],
            'updated' => $store['updated'] ?? null,
            'csrf'    => csrf_token(),
        ]);
        break;

    // ---------------------------------------------------------------- save
    // Creates or updates a single vacancy.
    case 'save':
        require_login();
        require_csrf($in);

        $j = is_array($in['job'] ?? null) ? $in['job'] : [];

        $id = strtoupper(s($j['id'] ?? '', 24));
        if (!preg_match('/^[A-Z0-9\-]{2,24}$/', $id)) {
            err('Reference must be 2-24 characters, letters, numbers and hyphens only.');
        }
        $title = s($j['title'] ?? '', 120);
        if ($title === '') err('Job title is required.');

        $category = s($j['category'] ?? '', 60);
        if ($category === '') err('Category is required.');

        $posted = s($j['posted'] ?? '', 10);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $posted)) {
            $posted = date('Y-m-d');
        }

        $clean = [
            'id'           => $id,
            'title'        => $title,
            'category'     => $category,
            'location'     => s($j['location'] ?? '', 80),
            'type'         => s($j['type'] ?? 'Full-time', 40),
            'experience'   => s($j['experience'] ?? '', 60),
            'salary'       => s($j['salary'] ?? 'Competitive', 80),
            'vacancies'    => max(1, min(9999, (int) ($j['vacancies'] ?? 1))),
            'urgent'       => !empty($j['urgent']),
            'posted'       => $posted,
            'active'       => !isset($j['active']) || !empty($j['active']),
            'summary'      => s($j['summary'] ?? '', 600),
            'requirements' => s_lines($j['requirements'] ?? []),
            'benefits'     => s_lines($j['benefits'] ?? []),
        ];

        $store = read_json(JOBS_FILE, ['updated' => null, 'jobs' => []]);
        $jobs  = $store['jobs'] ?? [];

        $originalId = strtoupper(s($in['originalId'] ?? '', 24));
        $found = false;

        foreach ($jobs as $k => $existing) {
            $existingId = strtoupper((string) ($existing['id'] ?? ''));
            if ($originalId !== '' ? $existingId === $originalId : $existingId === $id) {
                $jobs[$k] = $clean;
                $found = true;
                break;
            }
        }

        if (!$found) {
            // Reject a duplicate reference on create.
            foreach ($jobs as $existing) {
                if (strtoupper((string) ($existing['id'] ?? '')) === $id) {
                    err('Reference "' . $id . '" is already used by another vacancy.');
                }
            }
            $jobs[] = $clean;
        }

        backup_jobs();
        if (!write_json_atomic(JOBS_FILE, ['updated' => date('c'), 'jobs' => array_values($jobs)])) {
            err('Could not save. Check that the data directory is writable by PHP.', 500);
        }
        audit($found ? 'JOB_UPDATE' : 'JOB_CREATE', $id . ' ' . $title);
        ok(['job' => $clean, 'created' => !$found]);
        break;

    // ---------------------------------------------------------------- toggle
    case 'toggle':
        require_login();
        require_csrf($in);

        $id = strtoupper(s($in['id'] ?? '', 24));
        $store = read_json(JOBS_FILE, ['updated' => null, 'jobs' => []]);
        $jobs = $store['jobs'] ?? [];
        $hit = null;

        foreach ($jobs as $k => $j) {
            if (strtoupper((string) ($j['id'] ?? '')) === $id) {
                $jobs[$k]['active'] = empty($j['active']);
                $hit = $jobs[$k]['active'];
                break;
            }
        }
        if ($hit === null) err('Vacancy not found.', 404);

        backup_jobs();
        if (!write_json_atomic(JOBS_FILE, ['updated' => date('c'), 'jobs' => array_values($jobs)])) {
            err('Could not save.', 500);
        }
        audit('JOB_TOGGLE', $id . ' -> ' . ($hit ? 'active' : 'paused'));
        ok(['active' => $hit]);
        break;

    // ---------------------------------------------------------------- delete
    case 'delete':
        require_login();
        require_csrf($in);

        $id = strtoupper(s($in['id'] ?? '', 24));
        $store = read_json(JOBS_FILE, ['updated' => null, 'jobs' => []]);
        $before = count($store['jobs'] ?? []);
        $jobs = array_values(array_filter(
            $store['jobs'] ?? [],
            static fn($j) => strtoupper((string) ($j['id'] ?? '')) !== $id
        ));
        if (count($jobs) === $before) err('Vacancy not found.', 404);

        backup_jobs();
        if (!write_json_atomic(JOBS_FILE, ['updated' => date('c'), 'jobs' => $jobs])) {
            err('Could not save.', 500);
        }
        audit('JOB_DELETE', $id);
        ok();
        break;

    // ---------------------------------------------------------------- reorder
    case 'reorder':
        require_login();
        require_csrf($in);

        $order = is_array($in['order'] ?? null) ? $in['order'] : [];
        $store = read_json(JOBS_FILE, ['updated' => null, 'jobs' => []]);
        $byId = [];
        foreach ($store['jobs'] ?? [] as $j) {
            $byId[strtoupper((string) ($j['id'] ?? ''))] = $j;
        }
        $sorted = [];
        foreach ($order as $id) {
            $id = strtoupper(s($id, 24));
            if (isset($byId[$id])) {
                $sorted[] = $byId[$id];
                unset($byId[$id]);
            }
        }
        foreach ($byId as $leftover) $sorted[] = $leftover;   // anything not listed

        if (!write_json_atomic(JOBS_FILE, ['updated' => date('c'), 'jobs' => $sorted])) {
            err('Could not save.', 500);
        }
        ok();
        break;

    // ---------------------------------------------------------------- password
    case 'password':
        require_login();
        require_csrf($in);

        $cur = (string) ($in['current'] ?? '');
        $new = (string) ($in['new'] ?? '');

        if (!password_verify($cur, (string) $auth['hash'])) {
            audit('PASSWORD_FAIL');
            err('Your current password is incorrect.', 401);
        }
        if (strlen($new) < 10 || !preg_match('/[A-Za-z]/', $new) || !preg_match('/\d/', $new)) {
            err('New password must be at least 10 characters and contain letters and numbers.');
        }

        $auth['hash'] = password_hash($new, PASSWORD_DEFAULT);
        $auth['changed'] = date('c');
        if (!write_json_atomic(AUTH_FILE, $auth)) err('Could not save the new password.', 500);

        audit('PASSWORD_CHANGED', (string) $auth['username']);
        ok();
        break;

    // ---------------------------------------------------------------- default
    default:
        err('Unknown action.', 400);
}
