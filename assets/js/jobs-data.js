/**
 * =============================================================================
 * BASMAT AL MAWARED — VACANCY LOADER
 * =============================================================================
 * Job postings are managed in the admin panel at /admin/ and stored in
 * data/jobs.json. You should not need to edit this file.
 *
 *   To add, edit, pause or delete a vacancy:  open  yoursite.com/admin/
 *
 * This file fetches data/jobs.json and hands the result to the careers page.
 * The list below is only a fallback, used if the JSON file cannot be read
 * (for example when previewing the site straight from the file system).
 * =============================================================================
 */

window.BAM_JOBS = [];

/** Fallback used only if data/jobs.json is unreachable. */
const BAM_JOBS_FALLBACK = [
  {
    id: "WH-104",
    title: "Warehouse Operative",
    category: "Logistics",
    location: "Riyadh",
    type: "Full-time",
    experience: "1+ years",
    salary: "SAR 2,000 - 2,600 + accommodation",
    vacancies: 25,
    urgent: true,
    posted: "2026-08-26",
    active: true,
    summary: "Picking, packing and dispatch for a large distribution centre in Riyadh. Uniform, transport and accommodation provided.",
    requirements: [
      "Transferable Iqama or eligible for sponsorship transfer",
      "Able to lift up to 25 kg repeatedly through a shift",
      "Willing to work rotating shifts including nights"
    ],
    benefits: [
      "Shared accommodation and daily transport provided",
      "Overtime paid at the statutory rate through WPS",
      "Medical insurance and GOSI registration"
    ]
  }
];

/**
 * Loads the vacancy list, then runs the careers page renderer.
 * A cache-busting timestamp is added so an edit in the admin panel shows up
 * immediately rather than being served from the browser cache.
 */
window.BAM_JOBS_READY = (async function loadJobs() {
  try {
    const res = await fetch('data/jobs.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const jobs = Array.isArray(data) ? data : (data.jobs || []);
    window.BAM_JOBS = jobs;
    window.BAM_JOBS_UPDATED = data.updated || null;
  } catch (e) {
    // File missing or unreadable: fall back so the page is never empty by accident.
    window.BAM_JOBS = BAM_JOBS_FALLBACK;
    window.BAM_JOBS_SOURCE = 'fallback';
    if (window.console) {
      console.warn('[Basmat] Could not load data/jobs.json, using the built-in fallback list.', e.message);
    }
  }
  return window.BAM_JOBS;
})();
