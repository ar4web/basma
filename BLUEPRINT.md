# Blueprint

How this site is put together, why it was built this way, and how to extend
it without breaking anything.

For day-one setup read `START_HERE.md`.
For file-by-file structure and troubleshooting read `PROJECT_GUIDE.md`.

---

## 1. The architecture in one paragraph

Static HTML pages served directly by Apache, with PHP handling only the three
things that genuinely need a server: sending mail, receiving CV uploads, and
authenticating the admin panel. Data lives in flat JSON files, not a database.
There is no build step, no framework, and no `npm install`. You edit a file,
upload it, and it is live.

```
Browser
   │
   ├── *.html ................ static, served as-is
   ├── assets/css, js, img ... static, cached one year
   │
   ├── forms/contact.php ..... validate → mail()
   ├── forms/apply.php ....... validate → store CV → mail() → CSV → reference
   │
   └── admin/api.php ......... session auth → read/write data/jobs.json
                                    │
                                    └── data/  (JSON files, .htaccess denied)
```

---

## 2. Why it was built this way

Each of these was a deliberate trade-off, and each one has a cost worth
knowing before you change it.

**No database.** A vacancy list of this size is a file. Adding MySQL would
mean credentials to leak, a connection to fail, backups to schedule, and an
injection surface to defend. Flat JSON removes all four. *Cost:* it will not
scale to thousands of records or concurrent writers. At that point, migrate.

**No build step.** Anyone who can use FTP can maintain this. A build step
means Node, a lockfile, and a pipeline that rots the moment it is unattended
for a year. *Cost:* no automatic minification or bundling, and the nav is
duplicated across ten files.

**No framework.** React would add 40 KB before a single word of content, for
a site that is mostly text. *Cost:* shared markup like the header and footer
must be edited in every page.

**Progressive enhancement.** Careers and CV Builder are server-rendered HTML
first, then enhanced by JS. If a script fails, the content is still readable.

**Consent before tracking.** PDPL requires opt-in. Nothing non-essential
loads until the visitor agrees, which is why there is no analytics tag in
the head.

---

## 3. Where the data lives

| File | Written by | Read by | In git? |
|---|---|---|---|
| `data/jobs.json` | Admin panel | Careers page, homepage | Yes |
| `data/admin.json` | First admin login | `api.php` | **No — gitignored** |
| `data/admin-log.txt` | `api.php` | You | **No** |
| `data/backups/*.json` | Every admin save | Recovery | **No** |
| `applicants.csv` | `apply.php` | You, in Excel | **No** |
| Uploaded CVs | `apply.php` | You | **No** |
| `.refs.json` | `apply.php` | Reference allocator | **No** |

Anything containing credentials or candidate personal data is deliberately
kept out of version control. `.gitignore` enforces this.

### The job record

```json
{
  "id": "wh-supervisor-01",
  "title": "Warehouse Supervisor",
  "category": "Logistics",
  "location": "Riyadh",
  "type": "Full-time",
  "experience": "3-5 years",
  "salary": "4,000 - 5,500 SAR",
  "vacancies": 4,
  "urgent": true,
  "posted": "2026-08-20",
  "active": true,
  "summary": "One paragraph shown in the listing.",
  "requirements": ["..."],
  "benefits": ["..."]
}
```

Wrapper: `{ "updated": "ISO date", "jobs": [ ... ] }`.

**Adding a field:** add it to the object, render it in `assets/js/careers.js`,
and add an input in `admin/index.html` plus `admin/admin.js`. Old records
without the field must not break rendering — always provide a fallback.

---

## 4. Request flows

### Job application
```
apply.html
  → client validation (Saudi ID rules, file type, size)
  → POST multipart/form-data to forms/apply.php
      1. Same-origin + method check
      2. Honeypot and timing traps      → fake success if tripped
      3. Rate limit per IP
      4. Field validation
      5. CV: extension AND finfo MIME must agree, max 5 MB
      6. Allocate reference under flock(LOCK_EX)
      7. Store CV as REFERENCE_Name.ext, chmod 0600
      8. Append to applicants.csv
      9. mail() with attachment
  → { "ok": true, "reference": "BMC2631080306" }
```

Bot traps return **fake success**, so a scraper cannot tell it was blocked.

### Admin write
```
admin/index.html
  → POST action=save with CSRF token
      1. Session valid and not idle > 1 h
      2. CSRF token matches (hash_equals)
      3. Validate payload
      4. Copy current jobs.json into data/backups/  (keep 20)
      5. Write temp file, then rename  ← atomic
  → { "ok": true }
```

The temp-then-rename step means a crash mid-write cannot corrupt the live
file. Readers see either the old file or the new one, never a half-written one.

---

## 5. The reference code

```
BMC2631080306
BMC │ 26 │ 31 │ 08 │ 03 │ 06
      year day month hour minute
```

Generated with `date('ydmHi')` in `Asia/Riyadh`. Self-documenting: the code
*is* the submission timestamp, so support can date any application instantly.

Same-minute collisions are resolved by a ledger at `.refs.json` held under
`flock(LOCK_EX)`. First submission in a minute gets the clean code, the second
gets `B`, the third `C`, and past `Z` it goes `BA`, `BB`. The year is included
specifically so 31 August 2026 and 31 August 2027 cannot produce the same code.

---

## 6. The CSS system

**Never edit `main.css` to add a feature.** It is the theme layer. Everything
custom lives in its own file so a theme update cannot silently overwrite your
work, and so any addition can be removed by deleting one file.

| File | Scope |
|---|---|
| `main.css` | Theme. Colours, typography, base components. |
| `careers.css` | Careers listing and filters |
| `clients.css` | Client marquee and certificates grid |
| `cookie.css` | Consent banner and modal |
| `cv-print.css` | Print stylesheet for CV export |
| `admin/admin.css` | Admin panel |

### Colour tokens

All colour comes from `:root` in `main.css`:

```css
--color-brand: #8b6c38;        /* headings, buttons, accents */
--background-color: #f5f4ef;
--surface-color: #ffffff;      /* cards */
--default-color: #27200c;      /* body text */
```

Change the brand colour in that one place and the whole site follows.
Never hardcode `#8b6c38` in a new rule — use `var(--color-brand)`.

For tints and shades use `color-mix`, which is already the convention:
```css
color-mix(in srgb, var(--color-brand), transparent 85%)
```

---

## 7. Adding things

### A page
Copy `starter-page.html` — it already has the header, nav, footer and script
tags. Change the title, meta description and `<main>`. Then add it to
`sitemap.xml` and to the nav in **all ten** HTML files.

### A homepage section
Sections are self-contained `<section id="..." class="... section">` blocks.
Copy an existing one, place it where you want in the order, and put its CSS
in a new file rather than `main.css`. Use `data-aos="fade-up"` to match the
scroll animation of everything around it.

Current order: hero → featured-services → about → credentials → **clients** →
**certificates** → call-to-action → onfocus → features → services →
testimonials → pricing → faq → portfolio → coverage → how-we-work → team →
recent-posts → contact.

### A job category
Type it in the admin panel. The careers page builds its filter buttons from
whatever categories exist in the data — no code change.

### Analytics
`assets/js/cookie-consent.js` has a commented block inside `applyConsent()`.
Put the loader there so it only runs after consent, then bump `VERSION` to `2`
to re-ask everyone. **Do not paste a tag into `<head>`** — it would fire
before consent and breach PDPL.

### A third-party embed
The consent gate is still armed even though the video is now self-hosted. Give
the link `data-bam-href` instead of `href` and it stays blocked until the
visitor allows functional cookies. Also add the domain to `frame-src` in the
CSP in `.htaccess`.

---

## 8. Performance rules

Current homepage: **0.49 MB initial load**, against a 1 MB budget.
Every other page is under 0.9 MB.

Four rules keep it there:

1. **Every image below the fold gets `loading="lazy"`.** 67 of them do.
2. **Always set `width` and `height` on images.** Prevents layout shift.
3. **Heavy media is click-to-play.** The 25 MB video is an `<a>` that opens
   in a lightbox — never a `<video>` tag with `preload`.
4. **Bump `?v=` when you edit CSS or JS.** Assets are cached for a year, so
   without a bump returning visitors keep the stale copy. All 28 references
   currently read `?v=19`.

Before adding anything heavy, check the budget:
```bash
python3 -c "
import re,os,urllib.request
h=urllib.request.urlopen('http://localhost:3000/').read().decode()
t=len(h.encode())
for r in set(re.findall(r'<link[^>]+href=\"([^\"]+\.css[^\"]*)\"',h)
            +re.findall(r'<script[^>]+src=\"([^\"]+)\"',h)
            +re.findall(r'<img(?![^>]*loading=\"lazy\")[^>]+src=\"([^\"]+)\"',h)):
    p=r.split('?')[0].lstrip('/')
    if os.path.exists(p): t+=os.path.getsize(p)
print('%.2f MB'%(t/1024/1024))"
```

---

## 9. Security model

| Layer | Control |
|---|---|
| Admin login | bcrypt, no default account, 15-min lockout after 5 failures |
| Session | HttpOnly + SameSite=Strict, 1 h idle timeout, id regenerated on login |
| Admin writes | CSRF token on every mutating action |
| Forms | Honeypot, timing trap, per-IP rate limit, same-origin check |
| Uploads | finfo MIME + extension must agree, 5 MB cap, stored outside web root, chmod 0600 |
| Mail headers | CR/LF stripped from every value |
| XSS | Everything escaped on output, PHP and JS |
| Data files | `.htaccess` denies `data/`; only `jobs.json` is public |
| Secrets | `.gitignore` blocks credentials, logs, backups, CVs |
| Integrity | Atomic writes, 20 rolling backups |
| Browser | CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| Privacy | PDPL opt-in consent, no analytics, no ad pixels |

No database means no SQL injection surface at all.

**Non-negotiables:** create the admin account the moment you deploy; keep
HTTPS on so the session cookie stays Secure; never commit `data/admin.json`.

---

## 10. When to outgrow this design

Honest thresholds. Below them, the current design is the right one.

| Signal | What to do |
|---|---|
| More than ~200 vacancies | Move `jobs.json` to SQLite or MySQL |
| Two or more admins editing at once | Add per-user accounts and roles |
| More than ~50 applications a week | Build the applications tab; email will not scale |
| You need an Arabic site | RTL layout and translated content, all ten pages |
| Marketing wants landing pages | Add a static site generator so layout stops being duplicated |
| `mail()` starts landing in spam | Move to SMTP with SPF, DKIM and DMARC |

None of these are urgent today. Each one is a real project, not a patch.
