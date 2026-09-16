# AGENTS.md — Basmat Al Mawared site

Static HTML + small PHP backend. No build, no framework, no npm, no tests, no CI.
Edit a file and reload — that is the whole workflow.

## Run locally

PHP is required for forms/admin; plain `python3 -m http.server` is NOT enough:

```bash
php -S localhost:8000
# then: http://localhost:8000/ , /careers.html , /admin/
```

Requires PHP 8.0+. Production additionally needs Apache with `mod_rewrite` + `mod_headers` + HTTPS.

## Architecture

- `*.html` — static pages, served as-is. `index.html` homepage, `careers.html` vacancy listings, `apply.html` 4-step form, `cv-builder.html` ATS builder.
- `forms/contact.php` — contact handler (validate → `mail()`).
- `forms/apply.php` — application handler (validate → store CV → `mail()` → append CSV → reference code). Bot traps return **fake success** — do not "fix" that.
- `admin/api.php` + `admin/index.html` + `admin/admin.js` — session-auth vacancy manager. Backs up `data/jobs.json` (keep 20) and writes temp-then-rename (atomic).
- `data/jobs.json` — the vacancy list, `{ "updated": "...", "jobs": [...] }`. Only public file in `data/`; the rest is denied by `.htaccess`.
- `assets/js/careers.js` renders jobs; `assets/js/jobs-data.js` loads them; `assets/js/cookie-consent.js` gates tracking (PDPL opt-in).

## Gotchas an agent will miss

- **Nav is duplicated in all 10 HTML files** (no templating). New page/nav item → copy `starter-page.html`, update `<nav id="navmenu">` in every file, add to `sitemap.xml`.
- **Cache-bust `?v=` on every CSS/JS edit** or returning visitors get stale files (1-month cache). Current: `?v=70` site-wide, `?v=45` for `admin/admin.css` + `admin.js`. Docs (`PROJECT_GUIDE.md`, `START_HERE.md`, `BLUEPRINT.md`) still quote stale numbers (17/19) — trust the HTML, not the docs.
- **Never add features to `assets/css/main.css`** (theme layer). Put custom CSS in a new file. Brand color: `var(--color-brand)` (`#8b6c38`); tints via `color-mix(...)`, never hardcoded hex.
- **Images:** below-fold → `loading="lazy"` + explicit `width`/`height`. Heavy media → click-to-play link, never `<video preload>`.
- **Analytics/embeds:** never paste a tag into `<head>` (breaches PDPL). Loader goes in the commented block in `applyConsent()` in `cookie-consent.js`, then bump its `VERSION` to re-ask. Third-party embeds: use `data-bam-href` instead of `href` + add domain to `frame-src` CSP in root `.htaccess`.
- **New job field:** add to `data/jobs.json` object + render in `assets/js/careers.js` + input in `admin/index.html` + `admin/admin.js`, with fallback for old records.
- **New job category:** type it in admin only — filter buttons build automatically, no code change.
- Adding a domain? Add to `$ALLOWED_HOSTS`/`ALLOWED_HOSTS` in **both** `forms/apply.php` and `forms/contact.php`, and to CSP `frame-src` if it serves frames.

## Never commit (gitignored, enforced)

`data/admin.json` (bcrypt hash), `data/admin-log.txt`, `data/backups/`, `data/*.tmp*`, `forms/uploads/*`, `applicants.csv`, `bam_applications/`, `.refs.json`, `.env*`, `*.pem`/`*.key`. Candidate CVs and credentials must never enter git.

## Security non-negotiables

- Escape all dynamic output (PHP + JS); strip CR/LF from mail header values.
- Uploads: `finfo` MIME **and** extension must agree, 5 MB cap, `chmod 0600`.
- Admin writes require CSRF token; session is HttpOnly + SameSite=Strict, 1 h idle timeout.
- Keep HSTS/HTTPS-redirect in `.htaccess` commented out until TLS is confirmed live.

## i18n (EN/AR toggle)

- Dicts: `assets/i18n/en.json` + `assets/i18n/ar.json` (641 keys each, 1:1 — keep them in sync). Missing AR falls back to English silently, so always add both.
- Static HTML: `data-i18n="dotted.key"` (innerHTML), `data-i18n-aria/-alt/-title` for attributes, `data-i18n` on inputs for placeholders. Never alter visible English text when hooking.
- Dynamic JS: `window.BAM_t(key, 'English fallback', {n})` + re-render on `document` event `bam:lang`. Job data from `data/jobs.json` stays English (admin-entered).
- `about.tabs.*` must be nested objects — dotted-literal keys (`"tab1.title"`) never resolve.
- Cookie banner (`cookie-consent.js`) rebuilds text on `bam:lang` without touching prefs/visibility; never bump its `VERSION` for translation changes.

## Docs

`START_HERE.md` = launch checklist. `PROJECT_GUIDE.md` = structure/ops/troubleshooting. `BLUEPRINT.md` = architecture, request flows, performance budget (1 MB homepage), extension patterns. Trust executable config (`.htaccess`, PHP, HTML `?v=`) over prose when they conflict.
