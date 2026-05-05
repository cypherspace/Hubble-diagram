// Core data types for Hubble-diagram. The shapes here intentionally
// mirror h-r-diagram's `Star` / `PlottedStar` split so the SkyViewer
// adaptation can be mechanical: anything carrying ra/dec is sky-pluggable.

export type GalaxyType =
  | "spiral"
  | "barred-spiral"
  | "elliptical"
  | "irregular"
  | "dwarf"
  | "agn"
  | "quasar"
  | "deep-field"
  | "merger";

// Whether the galaxy's distance was measured by a redshift-independent
// method (Cepheid PL, TRGB, SBF, Tully-Fisher, SN Ia, fundamental plane,
// parallax) or extrapolated from its redshift via cz / H₀ or a
// catalog-fitted luminosity distance assuming a cosmology. Drives both
// visual styling (colour on the sky map and Hubble diagram) and best-fit
// inclusion: extrapolated points always sit on a perfect Hubble rail by
// construction, so they're plotted but excluded from the slope fit.
export type DistanceTag = "direct" | "extrapolated";

// One Cepheid star inside a host galaxy. Source for SH0ES hosts is
// VizieR J/ApJ/826/56/table4 (Riess+ 2016); for Local Group hosts it's
// the bundled OGLE-IV catalog. Period in days; magnitude is whatever
// band the host's catalog publishes (HST F160W for SH0ES; OGLE V or I
// for Local Group).
export interface Cepheid {
  id: string;
  galaxyId: string;
  ra: number;
  dec: number;
  periodDays: number;
  meanMag: number;
  magBand: "F160W" | "V" | "I";
  magUncertainty?: number;
  // Optional reddening / colour information used in some PL fits.
  vMinusI?: number;
  // Provenance string for the data panel.
  source: "SH0ES" | "OGLE-IV";
}

// One photometric measurement on a Cepheid (light-curve mode only —
// Local Group galaxies bundle these as JSON).
export interface PhotometryPoint {
  jd: number; // Julian Date
  mag: number;
  err?: number;
}

export interface CepheidLightCurve {
  cepheidId: string;
  band: "V" | "I";
  points: PhotometryPoint[];
  // The published true period, used to mark the answer on the slider
  // once the student commits.
  truePeriodDays: number;
  trueMeanMag: number;
}

// Pointer to the SDSS DR17 spec-lite file for a galaxy. The build-data
// script pre-fetches the CSV under public/data/spectra/{id}.csv so the
// browser only ever talks to Firebase Hosting at runtime.
export interface SdssSpectrumPointer {
  plate: number;
  mjd: number;
  fiber: number;
}

export interface SpectrumPoint {
  wavelengthAngstroms: number;
  flux: number;
}

export interface Galaxy {
  id: string;
  name: string;
  altNames: string[];
  ra: number;
  dec: number;
  type: GalaxyType;
  // Curated, published values. Always shown.
  distanceMpc: number;
  distanceMpcErr: number;
  z: number;
  vRecKmS: number; // = c·z, pre-computed (allow negative for blueshift).
  // What students can do with this galaxy.
  capabilities: {
    cepheidPL: boolean;     // SH0ES catalog has Cepheids here
    lightCurves: boolean;   // bundled OGLE time series available
    sdssSpectrum: boolean;
  };
  sdssSpec?: SdssSpectrumPointer;
  // 1-3 sentences for the data panel; written for a 14-18 year-old.
  claimToFame: string;
  wikipedia?: string; // en.wikipedia.org page slug
  isAnomaly?: boolean;
  anomalyExplanation?: string;
  distanceTag: DistanceTag;
  // Free-form, human-readable description of how the distance was
  // measured, surfaced in the data panel (e.g. "Cepheid period–luminosity
  // (Cosmicflows-3)" or "Redshift × Hubble's law (2MASS Redshift Survey)").
  distanceMethodLabel: string;
}

// A galaxy that's been added to the Hubble chart, with a "source of
// truth" tag for distance/velocity (curated vs derived-by-student).
export interface PlottedGalaxy extends Galaxy {
  // Whatever distance + velocity drove this point onto the chart.
  plottedDistanceMpc: number;
  plottedVelocityKmS: number;
  distanceSource: "curated" | "cepheid-pl" | "cepheid-lightcurve";
  velocitySource: "curated" | "spectrum";
  // Stamp so a "you derived this yourself" pill can render in the data
  // panel after a derivation completes.
  derivedAt?: number;
}

export type YAxisMode = "velocity" | "redshift";
// "auto"     — show every plotted galaxy (default, post-improvements).
// "localOnly" — clamp to <= 200 Mpc (quick way to hide deep-field outliers).
export type AxisRange = "auto" | "localOnly";

export interface AxisConfig {
  yMode: YAxisMode;
  range: AxisRange;
  // When true, the y-axis dips below zero so blueshifted Local Group
  // galaxies (Andromeda, M33 etc.) are visible. Off by default — the
  // basic Hubble's-law story is that v ≥ 0.
  showNegative?: boolean;
  // When true, the published H₀ = 70 km/s/Mpc reference line is
  // overlaid on the chart and the readout shows "X% above/below
  // published value." Off by default so the student finds the value
  // themselves first.
  showRefLine?: boolean;
}

export interface SavedDiagram {
  name: string;
  savedAt: number;
  galaxies: PlottedGalaxy[];
  axes: AxisConfig;
}
