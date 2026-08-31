# Basmat Al Mawared — Project Guide

How the site is built, how to run it day to day, and how to extend it safely.

---

## 1. What this site is

A static HTML site (Bootstrap 5, no build step, no framework) with a small
amount of PHP for the parts that need a server: the contact form, job
applications, and the admin panel.

**There is nothing to compile.** Edit a file, upload it, done.

---

## 2. Structure

```
basma/
├── index.html                 Homepage
├── careers.html               Vacancy listings (reads data/jobs.json)
├── apply.html                 4-step application form
├── cv-builder.html            Free ATS CV builder
├── cookie-policy.html         PDPL cookie policy
├── blog.html  blog-details.html
├── service-details.html  portfolio-details.html  starter-page.html
│
├── admin/                     ── VACANCY MANAGER (password protected)
│   ├── index.html             Login + dashboard
│   ├── admin.js  admin.css
│   ├── api.php                Backend: auth, CRUD, backups
│   └── .htaccess              Denies .json/.txt, noindex, no framing
│
├── data/                      ── DATA STORE (must be writable by PHP)
│   ├── jobs.json              THE vacancy list. Public read, admin write.
│   ├── admin.json             Your login hash. Created on first use. Gitignored.
│   ├── admin-log.txt          Audit log. Gitignored.
│   ├── backups/               Last 20 snapshots of jobs.json. Gitignored.
│   └── .htaccess              Denies everything except jobs.json
│
├── forms/
│   ├── contact.php            Contact form handler
│   ├── apply.php              Application handler + CV upload
│   └── uploads/               Fallback CV storage, denied by .htaccess
│
├── assets/
│   ├── css/  main.css (theme) + careers.css, cookie.css, cv-print.css
│   ├── js/   main.js, careers.js, apply.js, cv-builder.js,
│   │         cookie-consent.js, jobs-data.js (loader)
│   ├── img/  All imagery
│   ├── video/ Company video, voiceovers, end frames, production pack
│   └── vendor/ Bootstrap, AOS, Swiper, GLightbox, Isotope
│
├── .htaccess                  Security headers, CSP, caching, compression
├── .gitignore                 Blocks credentials and candidate data
├── robots.txt  sitemap.xml
└── PROJECT_GUIDE.md           This file
```

---

## 3. Daily operations

### Post or edit a job
1. Go to `yoursite.com/admin/`
2. Sign in (first visit asks you to create the account)
3. **Add Vacancy** → fill the form → **Save**

Live on the careers page immediately. **Duplicate** clones a similar role.
**Pause** hides a filled vacancy without deleting it.

### See applications
- Email arrives at `info@basmat-almawared.com` with the CV attached
- Every application also appends to `applicants.csv` in the storage directory,
  which opens directly in Excel
- Each carries a reference like `BMC2631080306`

### Reference format
```
BMC2631080306
BMC │26│31│08│03│06   =  2026, 31 August, 03:06  (Riyadh time)
```
Generated at the moment of submission. A second application in the same minute
becomes `...306B`, the third `...306C`.

---

## 4. Going live — deployment checklist

**Requirements:** PHP 8.0+, Apache with `mod_rewrite`, `mod_headers`, HTTPS.

1. Upload everything except `.git/`, `node_modules/`, `PROJECT_GUIDE.md`.
2. Make `data/` writable: `chmod 755 data` (or `775` if saving fails).
3. Open `/admin/` and create your account. **Do this immediately** — until you
   do, anyone reaching that page could create it.
4. In `forms/apply.php` and `forms/contact.php`, add your live domain to
   `$ALLOWED_HOSTS`.
5. Once HTTPS is confirmed working, uncomment the HSTS line and the HTTPS
   redirect block in `.htaccess`.
6. Test: submit the contact form, submit an application, check the email
   arrives and `applicants.csv` is written.
7. Submit `sitemap.xml` to Google Search Console.

---

## 5. Security model

| Layer | What protects it |
|---|---|
| **Admin login** | bcrypt hash, no default credentials, 15-min lockout after 5 failures |
| **Admin session** | HttpOnly + SameSite=Strict cookie, 1-hour idle timeout, id regenerated on login |
| **Admin writes** | CSRF token required on every write |
| **Forms** | Honeypot, timing trap, per-IP rate limiting, same-origin check |
| **Uploads** | Real MIME check via `finfo`, 5 MB cap, randomised filename, stored outside web root, `.htaccess` deny as backup |
| **Header injection** | CR/LF stripped from every value entering a mail header |
| **XSS** | Every dynamic value escaped before output, in PHP and JS |
| **Data files** | `data/` and `admin/` denied by `.htaccess`; only `jobs.json` public |
| **Secrets in git** | `.gitignore` blocks `admin.json`, logs, backups, CVs, `.env` |
| **Data loss** | Atomic writes (temp + rename) with 20 rolling backups |
| **Browser** | CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| **Privacy** | PDPL opt-in consent; no analytics, no ad pixels, no tracking |

**No database** — everything is file-based, so there is no SQL injection surface.

### Things you must do
- Create the admin account the moment the site goes live.
- Use a long, unique admin password. Change it from the panel, not by hand.
- Keep HTTPS on. The session cookie only sets its Secure flag over HTTPS.
- Never commit `data/admin.json` or anything from `forms/uploads/`.

---

## 6. Extending the site

### Add a page
Copy `starter-page.html` — it already has the header, footer, nav and scripts.
Change the title, meta description and the `<main>` content. Add it to
`sitemap.xml` and to the nav in every page's `<nav id="navmenu">`.

### Add a nav item
The nav is duplicated in each HTML file (no templating). Update all of them, or
run a `sed` across `*.html`.

### Change colours
One place only: `assets/css/main.css`, the `:root` block at the top.
`--color-brand: #8b6c38` drives headings, buttons and accents.

### Add a job category
Just type a new category in the admin panel. The careers page creates the
filter button automatically.

### Add analytics later
`assets/js/cookie-consent.js` has a commented block inside `applyConsent()`.
Put the loader there so it can only run after consent, then bump `VERSION` to
`2` so every visitor is asked again. **Do not paste a tag into the HTML head** —
that would fire before consent and breach PDPL.

### Cache busting
CSS and JS are linked with `?v=17`. **Bump that number whenever you edit a CSS
or JS file**, otherwise returning visitors keep the old cached copy.

---

## 7. Known limits and next steps

**Waiting on you**
- CR number on the homepage is a placeholder: `CR No. 1010XXXXXX`
- MHRSD licence number not shown — send it and it goes in
- Social links in the footer are still empty
- The 10 vacancies are realistic examples, not your real client roles

**Worth doing next**
- **Applications tab in the admin panel** — review candidates and filter by job
  without opening your inbox. The biggest remaining time-saver.
- **Privacy Policy** — the cookie policy covers cookies; collecting Iqama
  numbers and CVs needs a broader notice under PDPL
- **Compress the company video** to 4–6 MB before it goes on the homepage
  (currently 25.5 MB — see `assets/video/PRODUCTION_PACK.md`)
- **Image alt text** is at 34 % — free SEO and an accessibility gap
- ~9 MB of `assets/vendor/` is source maps and unused RTL builds, safe to delete

---

## 8. Troubleshooting

| Problem | Cause and fix |
|---|---|
| Admin will not save | `data/` not writable. `chmod 755 data` |
| Careers page empty | `data/jobs.json` unreadable. Check it exists and is valid JSON |
| Forms do nothing | PHP not running, or the domain is missing from `$ALLOWED_HOSTS` |
| No email arrives | Host blocks `mail()`. Applications are still saved to CSV — switch to SMTP |
| CSS changes not showing | Bump `?v=17` to `?v=18` in every page |
| Forgot admin password | Delete `data/admin.json` and reopen `/admin/` |
| Video will not play | Confirm `assets/video/ads.mov.mp4` uploaded fully (25.5 MB) |
