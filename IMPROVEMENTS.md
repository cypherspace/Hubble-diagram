# Hubble-diagram — improvements branch

## Status

The `main` branch is deployed at <https://mrwoodphysics-hubble.web.app>
and pinned to commit `22df22b`. This branch (`improvements`) collects
follow-up changes that will land together as a single PR.

## In scope

The user has confirmed the following items so far. **More to come — the
user will add items by prompting; append them to this file as they
come in.**

### 1. Fix empty SDSS spectra

**Symptom:** the SpectrumPanel for UGC 9391 (and possibly others)
renders empty axes — flux trace and rest-line ticks are missing.

**Likely root cause:** `scripts/build-data.ts` wrote a header-only or
near-empty `public/data/spectra/{id}.csv` for some galaxies when the
SDSS DR17 endpoint returned an unparseable response. The fetch returned
HTTP 200 (so the script logged "Wrote …") but the body was an HTML
error page or a CSV with the expected columns missing.

**Plan of attack:**

- Audit `public/data/spectra/*.csv` — for each file:
  - Count non-header rows.
  - Reject and re-fetch any file with fewer than ~100 rows or no
    matching `wavelength` / `flux` columns.
- Improve `scripts/build-data.ts` to:
  - Detect HTML / error responses (look for `<html` in the body,
    or a row count below a sane threshold) and treat them as a
    failed fetch rather than a successful one.
  - Try the SDSS spec-lite SAS endpoint
    (`https://dr17.sdss.org/sas/dr17/sdss/spectro/redux/v5_13_2/spectra/lite/{plate}/spec-{plate}-{mjd}-{fiber}.fits`)
    as a fallback when the CSV endpoint returns junk. FITS parsing
    in Node would need a small library, or we could use Python's
    astroquery via a build-time subprocess.
  - On confirmed failure, write a sentinel
    `public/data/spectra/{id}.empty` so the runtime knows there's no
    spectrum and shows a "spectrum unavailable" state without falsely
    advertising the λ badge.
- Update `src/data/spectra.ts` `loadSpectrum` to surface a clear
  "spectrum unavailable" error when fewer than ~50 valid points come
  back, so the SpectrumPanel can render an explicit fallback instead
  of an empty chart.
- Update `Galaxy.capabilities.sdssSpectrum` for any galaxy whose
  spectrum was found to be unavailable so the badge / "Find redshift"
  button never appears for a galaxy we can't actually serve.
- Verify in the browser: open the SpectrumPanel for every galaxy with
  the λ badge and confirm a real flux trace renders.

### 2. More curated galaxies + UI polish

**Galaxy seed list growth:** the current 28 entries are a solid start
but the plan called for ~40-50. Targets to add:

- More SH0ES Cepheid hosts that are CORS-friendly via the existing
  build-data pipeline (we have `SHOES_GAL` mapping for ~20 galaxies;
  some are missing from `CURATED_GALAXIES`).
- More Local Group dwarfs that show up well in DSS2 (Sextans A,
  Sextans B, NGC 3109, WLM, Pegasus).
- More named galaxies students will recognise (NGC 891, NGC 4565,
  NGC 4565, M77, NGC 1068, NGC 5907).
- Stephan's Quintet partner galaxies (NGC 7317, NGC 7318a, NGC 7318b,
  NGC 7319) so the NGC 7320 anomaly story is clearer with neighbours
  on the chart.
- More anomaly cases: Mrk 421 (BL Lac, z=0.03), Mrk 501.

**UI polish (catch-all — fine-tune as feedback comes in):**

- The `region-limit` input in the search-controls bar wraps awkwardly
  on narrow screens.
- Walkthrough tooltip placement near the right edge clips on smaller
  viewports.
- The "diagram-guide-btn" tooltip phrasing changes from "Plot 8 more"
  to "Plot 7 more" etc. — make sure the dynamic count handles the
  singular/plural case in all wordings.
- Mobile responsiveness — at < 1100 px the layout collapses to a
  single column but Aladin and the chart end up tiny.
- Save/Load inputs are unlabeled until you click them; consider
  inline help text.
- Survey selector should remember user's choice across sessions
  (localStorage).

### 3. Further items — TBC

The user will add these by prompting. As each new directive comes in,
append it to this file with:

- Short title.
- One-paragraph description of the symptom or goal.
- Bullet list of the tactical steps.

Keep this file as the durable reference for everything in scope on
the `improvements` branch.

## Out of scope (for now)

- Live SDSS spectra for searched galaxies (would need a Firebase
  Function CORS proxy).
- Pantheon+ SN Ia overlay layer (mentioned in the original plan but
  not requested for this round).
- Light-curve distance calibration fix (LMC comes out ~40% low).
- Tour copy improvements / additional pedagogical scaffolding.

These remain candidates for a future branch.

## Workflow

- Each fix or feature gets its own commit on `improvements`.
- Verify in the browser via the existing dev server on port 5176
  before committing.
- Tests stay green throughout: `npm test` and `npx tsc --noEmit`
  pass on every commit.
- When the work-stream is complete (user signals "ready to merge"),
  open a PR `improvements` → `main`, review, merge, redeploy via
  `npm run deploy`.
