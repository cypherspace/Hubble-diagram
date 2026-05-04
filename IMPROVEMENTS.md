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

### 3. Sky map flicker on search / add

**Symptom:** the Aladin sky-map panel resizes (briefly) when search
results arrive or galaxies are added to the chart, causing a flicker.

**Likely cause:** the status text below the controls (`#sky-status`)
grows and shrinks as messages change ("Searching SDSS…", "Found 50
galaxies…", "Added 12 SDSS galaxies…"). The grid track for the
sky-controls block is content-sized, so the Aladin div re-flows.

**Plan:** give `#sky-controls` (or specifically the status row) a
fixed min-height so longer/shorter messages don't push Aladin around.
Verify by triggering Search → Add all repeatedly and watching the
sky-map dimensions in DevTools.

### 4. Candidate-marker colour clash

**Symptom:** the `+` candidate markers for SDSS search results are
yellow (`#ffd166`), which sits very close to the orange anomaly
markers and yellowish galaxy backgrounds on PanSTARRS imagery —
they're hard to see.

**Plan:** change the candidate colour to something distinctive — e.g.
bright magenta `#ff4ec9` or cyan `#00e6ff` — and bump the marker size
slightly. Update both `skyViewer.ts` (`A.catalog({color: …})`) and the
button caption / legend if any.

### 5. Hubble Deep Field overlay

**User question:** can we see the Hubble Deep Field in the sky map?
Ideally overlaid on SDSS in the right location, or selectable under
"Sky Picture".

**Yes — both work.** Aladin Lite supports HiPS (Hierarchical
Progressive Surveys), which is exactly what the existing "Sky picture"
dropdown uses. Two paths:

- **Add HST surveys to the dropdown.** CDS hosts several HiPS that
  cover the deep fields:
  - `P/HST/PHAT/F814W` — the M31 PHAT survey (Andromeda only, but
    extremely high resolution, useful for the M31 "more on this
    galaxy" experience too).
  - `P/HST/EPO` — Hubble's EPO (Education / Public Outreach) HiPS,
    covering many famous Hubble images at the resolution of the
    original press releases.
  - `P/HST/PR2014-13` and similar "press release" HiPS for specific
    deep fields.
  - There's also a community-built HUDF HiPS in the Aladin gallery.
  - Action: pick the best 1–2 HST HiPS, add them as new options in
    `#survey-select` ("Hubble Space Telescope", "HUDF"). Switching
    to one of these centres on a region with HST coverage shows
    real HST imagery; outside HST footprints the panel shows blank
    and we surface a hint.
- **Layer HST as an overlay on top of SDSS.** Aladin Lite's
  `setOverlayImageLayer` API lets you stack a second HiPS on top of
  the base survey at a tunable opacity. Action: add an "HST overlay"
  toggle to "Map options"; when on, the relevant HST HiPS is layered
  on top of whatever the user has selected as the base. Outside HST
  footprints the overlay is transparent so the base survey shows
  through.

Either is feasible inside an afternoon. **Recommended:** do both —
add a couple of HST HiPS to the dropdown for full-screen Hubble
viewing, and a separate "HST overlay" checkbox for the layered case.

Also worth adding: preset "Find" buttons for "Hubble Deep Field
North", "Hubble Ultra Deep Field", "Hubble eXtreme Deep Field" that
auto-zoom to the right scale.

### 6. Hubble diagram fills its panel

**Symptom:** the chart only takes up the upper half of its panel.

**Likely cause:** `#diagram` has `flex: 1` but inside the panel the
`<details>` graph-options block plus the H₀ readout are eating
height. `HubbleDiagram` measures `chartHost.clientHeight` once and
isn't recomputing as flex layout shakes out.

**Plan:** verify that the chart host has the correct height after
all sibling elements render; either give the chart host an explicit
flex grow with min-height: 0, or trigger a re-draw on a
`ResizeObserver`. Also add a `window.resize` debounce so resizing
the window cleanly resizes the chart.

### 7. Linear axes from zero + auto-scaling

**Two requests in one:**

- **Axes start from zero.** Linear axes on Hubble's law should
  always anchor to the origin: H₀ × 0 = 0, by construction. Currently
  the y-axis can dip negative when blueshifted Local Group galaxies
  are present; the x-axis is fine. Action: pin both axes to start at
  zero by default (with a separate "show negative velocities"
  checkbox for users who want to see Local Group blueshifts at the
  bottom).
- **Auto-scaling for distant galaxies.** Today there's a "Range"
  radio (Local universe / Include deep-field) that filters out
  galaxies > 200 Mpc. The user prefers auto-scaling: the chart
  should detect the largest distance currently plotted and scale
  the axis accordingly, removing the need for a manual toggle. Keep
  the radio as an optional "snap to local universe" override but
  make auto the default.

**Plan:** rewrite `filteredGalaxies()` and the domain logic to:
- Start from data domain (no hard cap).
- Add a small head-room margin (5%).
- Floor x and y at 0 (with the negative-velocity escape valve).
- Optionally clamp to "Local universe" only when the user explicitly
  sets the range.

### 8. Spectrum panel: 4000–8000 Å range, plot in nanometres

**User feedback:** identifying lines is harder than expected. Two
adjustments:

- **Restrict the wavelength view to 4000–8000 Å** (assuming z < 1).
  At z = 1, Hα at rest 6562.8 Å lands at 13125 Å — outside this
  range, so this restriction implicitly assumes the local-universe
  use case. For high-z galaxies (deep field, quasars) we'd need to
  adjust, but those don't have the λ badge in the curated set
  anyway.
- **Plot in nanometres, not Ångströms** — so x-axis range becomes
  400–800 nm. Students see nm in physics class far more often than
  Å.

**Plan:** update `spectrumPanel.ts` to:
- Convert wavelength to nm in `drawSpectrum` (divide by 10).
- Set the x-axis domain to [400, 800] nm.
- Update line catalog labels in `LINE_CATALOG` so the dropdown shows
  "Hα (656.3 nm)" and the formula displays nm too.
- Keep the underlying redshift math identical (it's unitless).

### 9. SDSS searched galaxies should have spectra

**User question:** most SDSS galaxies seem to lack spectra in the
app. Is that true?

**No — it's an artefact of how we plumb data.** Every galaxy in the
Tempel+ 2021 catalog (J/A+A/648/A122) has an SDSS spectrum, because
the redshift `z` we use *was measured from a spectrum*. The catalog
exposes the SDSS `objID` but not the (plate, mjd, fiber) triple our
SpectrumPanel needs to download the spec-lite CSV.

Two ways to bridge:

- **SDSS SkyServer SQL.** A POST to
  `https://skyserver.sdss.org/dr17/SkyServerWS/SearchTools/SqlSearch`
  with `cmd=SELECT plate,mjd,fiberID FROM SpecObj WHERE bestObjID = …`
  returns the plate/mjd/fiber for any given SDSS objID. Verified
  reachable from the build host today. **CORS on the browser is
  unverified** — needs a check, with a Firebase Function fallback
  proxy if it fails.
- **VizieR alternate catalog.** Some VizieR mirrors of the SDSS
  spectroscopic catalog include plate/mjd/fiber columns directly.
  Could swap our Tempel-based search for a Tempel-with-plate-info
  table or do a join.

**Plan:**
- At runtime, when a searched-galaxy's "Find redshift from spectrum"
  is clicked, hit SDSS SkyServer to look up plate/mjd/fiber, then
  fetch the spec-lite CSV. Cache results.
- If browser-side CORS blocks SDSS, deploy a tiny Firebase Function
  that proxies both calls. Same Firebase project; minimal latency.
- Once that's in, set `capabilities.sdssSpectrum = true` for
  search-result galaxies and surface the λ badge.

### 10. Cepheid imagery

**User question:** when the student picks a Cepheid, can we show
its image?

**Yes, partially.** The Cepheid catalog gives us each Cepheid's
RA/Dec. We can either:

- Embed a small Aladin viewer inside the Cepheid panel centred on
  the Cepheid's RA/Dec at high zoom on PanSTARRS imagery — the
  Cepheid will appear as a single pixel-or-two source unresolved
  from neighbours, but you'll see the host galaxy structure around
  it. Cheap to add.
- Use the HST / archival imagery via MAST cutout service for actual
  Cepheid-resolution images. Would require a cutout API call and
  likely a Firebase Function. Heavier.

**Plan:** start with the embedded mini-Aladin (~30 lines of code).
Show a "(Cepheid position centre)" caption. If the user wants higher
resolution later, escalate to MAST.

### 11. Cepheid panel: LaTeX + collapsible sections

**Symptom:** the dialog is hard to read. Equations rendered as
plain text aren't ideal; once the student knows the workflow, they
shouldn't have to scroll past every step's prose to reach "Use this
distance".

**Plan:**
- Render maths with KaTeX (small, fast, no server). Add `katex` as
  a dep, render every `formula` block via `katex.render`.
- Make each step a `<details>` element. Step 1 (Pick a Cepheid) and
  the final answer + "Use this distance" stay open by default; the
  intermediate maths defaults to collapsed but can be expanded for
  the curious.
- Move the "Use this distance" button to the top of the modal so
  it's always reachable without scrolling.

### 12. Highlight selected-galaxy numbers like H-R diagram

**User feedback:** the H-R diagram app has a particular visual
treatment for highlighted values (temperature, diameter, etc.).
The Hubble app's data panel should do the same for distance,
redshift, and recession velocity.

**Plan:** read the H-R diagram's `dataPanel.ts` styling, port the
visual treatment (likely a coloured pill / highlighted span) and
apply to the three numbers in `dataPanel.ts:show()` here.

### 13. Button colours match H-R diagram

**Plan:** same as #12. Read h-r-diagram's CSS for `#action-bar`
and `header-buttons`, copy the colours / borders / hover styles
into Hubble-diagram's `style.css`.

### 14. Galaxy image thumbnail in data panel

**User goal:** show a picture of the galaxy in the data panel —
SDSS imagery for SDSS-catalogued galaxies, DSS2 for everything
else. Properly scaled so the galaxy is visible at a reasonable
size; low resolution is fine.

**Plan:**
- Use a HiPS cutout service to render a thumbnail. Two viable
  endpoints:
  - **Hips2FITS** (CDS): returns a JPEG cutout for any RA/Dec at a
    chosen FOV. Stable, CORS-friendly. Example:
    `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=P/DSS2/color&ra=10.6847&dec=41.2687&fov=1.5&width=200&height=200&format=jpg`
  - **STScI cutout** for higher quality on HST-covered fields.
- Pick the FOV per galaxy: well-known galaxies are catalogued with
  their angular size (NED has D25) — use ~1.5× D25 to frame the
  galaxy nicely. For SDSS catalog galaxies (small, distant),
  default to a fixed 0.05° FOV (~3 arcmin).
- Render the thumbnail in the data panel header, click-through to
  open the full Aladin view at the same scale.

### 15. "Hubble's original 1929" guided walkthrough

**User goal:** a step-by-step walkthrough that rebuilds Hubble's
original 1929 graph from the ground up — find each of the 24
galaxies he used in the sky one by one, plot them on the graph,
then hand off to the student to extend it via the normal app
controls.

**Plan:**
- Compile the list of the 24 galaxies Hubble used in the 1929
  paper (NGC numbers, his published distances, his published
  velocities). Most are in the Local Group / Virgo Cluster /
  Ursa Major Group: NGC 6822, M31, M33, NGC 598, M81, M101, M51,
  NGC 4486 (M87), NGC 4649 (M60), and so on.
- Add a `hubble1929.ts` module that defines a sequence of steps:
  goto galaxy → Aladin centres → status text shows Hubble's value
  vs published modern value → marker auto-added to the chart.
- Each step uses the existing Walkthrough overlay component
  (extend it to accept a step that performs an action rather than
  just showing a tooltip).
- After step 24, the chart shows Hubble's 1929 fit (~500 km/s/Mpc
  — way off because his distances were systematically too low!),
  with a tooltip explaining the discrepancy and inviting the
  student to extend the chart with the modern data.

This is a meaty feature on its own — probably the biggest item in
this branch. Worth doing last so other UX fixes don't clash with
it.

### 16. Further items — TBC

Append new directives here as the user adds them.

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
