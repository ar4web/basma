# Start Here

Read this first. It takes ten minutes and covers everything you need to get
the site live and run it afterwards.

Two other documents go deeper:
- `PROJECT_GUIDE.md` — file structure, security model, troubleshooting
- `BLUEPRINT.md` — how the site is architected and how to extend it

---

## 1. Is the CR number important?

**Yes. It is a legal requirement, not a design choice.**

Saudi law requires a business website to disclose the trade name, working
contact details and the **commercial registration number**. Under the
E-Commerce Law a service provider's site must show its full name, address,
contact information, CR number and tax registration number [5](https://www.tamimi.com/law-update-articles/theres-something-in-your-cart-an-update-on-e-commerce-in-saudi-arabia). Disclosure obligations
cover the trade name, a working contact, and the commercial registration
number [10](https://origami.sa/en/blog/saudi-ecommerce-law-2026-maroof-compliance/). Company law also requires the registered entity name and CR
number to appear in Arabic on letterheads, and for limited liability
companies the legal form and capital as well [2](https://www.ghazzawilawfirm.com/insights/commercial-register-law-and-tradenames-law/).

Beyond the legal point, it is a trust signal. A Saudi HR manager can paste
your CR into the Ministry of Commerce portal and confirm you are real and
active in about thirty seconds. A site without one looks unverifiable.

### Where the CR now appears

The number is currently the placeholder `1010XXXXXX` in **two** places:

| Location | File | What to search for |
|---|---|---|
| Credentials strip | `index.html` | `CR No. 1010XXXXXX` |
| Footer legal line, all 10 pages | every `.html` | `CR No. 1010XXXXXX` |

**To replace it everywhere at once**, from the project folder run:

```bash
sed -i 's/1010XXXXXX/YOUR-REAL-CR-NUMBER/g' *.html
```

On Windows, use Find and Replace across all files in your editor.

Then delete the HTML comment above the footer line that says
`replace 1010XXXXXX with the real CR number before launch`.

### Also worth adding when you have them

- **VAT number** — required if you are VAT registered
- **MHRSD recruitment licence number** — the strongest credential you have
  in this sector, and clients look for it
- **Maroof registration** — if you take any payment or enquiry online

---

## 2. Before you go live

Work down this list. Nothing here is optional.

### Legal and content
- [ ] Replace `1010XXXXXX` with your real CR number
- [ ] Replace the six placeholder certificates in `assets/img/certificates/`
      (see the README in that folder — keep the same filenames)
- [ ] Replace or remove the ten placeholder client logos in
      `assets/img/clients/` (see that folder's README)
- [ ] Delete the amber placeholder notice in `index.html` — search for
      `cert-placeholder-note`
- [ ] Confirm the "1,200+ personnel" figure on `portfolio-details.html`
- [ ] Confirm the "12 years of experience" line in the blog author bio
- [ ] Add real social media URLs, or leave the icons removed

### Technical
- [ ] Upload everything except `.git/`, `node_modules/` and the `.md` guides
- [ ] `chmod 755 data` so PHP can write the vacancy file
- [ ] Open `/admin/` and **create your account immediately**
- [ ] Add your live domain to `$ALLOWED_HOSTS` in `forms/apply.php`
      and `forms/contact.php`
- [ ] Turn on HTTPS, then uncomment the HSTS line and the HTTPS redirect
      in `.htaccess`
- [ ] Compress `assets/video/ads.mov.mp4` from 25 MB to 4–6 MB
      (settings in `assets/video/PRODUCTION_PACK.md`)

### Test
- [ ] Submit the contact form, confirm the email arrives
- [ ] Submit a job application with a CV attached
- [ ] Confirm the reference code appears, format `BMC2631080306`
- [ ] Post a test vacancy in the admin panel, check it shows on careers
- [ ] Open the site on a phone

### After launch
- [ ] Submit `sitemap.xml` to Google Search Console
- [ ] Register on **Maroof** if you handle enquiries or payment online

---

## 3. Running the site day to day

### Post a job
`yoursite.com/admin/` → sign in → **Add Vacancy** → **Save**.
Live on the careers page immediately.

**Duplicate** clones a similar role. **Pause** hides a filled vacancy
without deleting its history.

### Read applications
Every application does three things at once:
1. Emails `info@basmat-almawared.com` with the CV attached
2. Appends a row to `applicants.csv`, which opens in Excel
3. Issues the candidate a reference code

### Understand a reference code
```
BMC2631080306
BMC │ 26 │ 31 │ 08 │ 03 │ 06
      year day month hour minute   (Riyadh time)
```
So that one is 31 August 2026 at 03:06. A second application in the same
minute ends in `B`, the third `C`. The reference *is* the timestamp, so you
can always tell when someone applied without opening anything.

### Forgot the admin password
Delete `data/admin.json` and reopen `/admin/`. It will ask you to create the
account again. No email recovery exists by design — one less attack surface.

---

## 4. The five things that most often go wrong

| Symptom | Cause | Fix |
|---|---|---|
| Admin will not save | `data/` not writable | `chmod 755 data` |
| Careers page empty | `jobs.json` unreadable or invalid | Check the file exists and is valid JSON |
| Forms do nothing | Domain missing from `$ALLOWED_HOSTS` | Add it in both PHP files |
| No email arrives | Host blocks `mail()` | Applications still save to CSV; switch to SMTP |
| CSS changes invisible | Browser cached the old file | Bump `?v=19` to `?v=20` in every page |

---

## 5. What is deliberately not built

Being straight with you about the gaps, so nothing is a surprise later.

- **No Arabic version of the site.** The voiceover is bilingual, the site is
  English only. A proper Arabic version means RTL layout and translated
  content across all ten pages — a real project, not a toggle.
- **No applications tab in the admin panel.** Candidates arrive by email and
  CSV. Reviewing them in the panel is the single biggest time-saver still
  available.
- **No privacy policy.** The cookie policy covers cookies only. Collecting
  Iqama numbers and CVs needs a broader notice under PDPL.
- **No analytics.** Nothing tracks visitors. `cookie-consent.js` has a
  commented block showing where to add it lawfully.
- **The company video is not compressed.** 25 MB is heavy even click-to-play.
- **Blog posts are placeholder-quality.** Six real titles with generic bodies.
  They will not rank as written.
