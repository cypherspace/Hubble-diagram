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
export type AxisRange = "default" | "extreme"; // toggles inclusion of high-z galaxies

export interface AxisConfig {
  yMode: YAxisMode;
  range: AxisRange;
}

export interface SavedDiagram {
  name: string;
  savedAt: number;
  galaxies: PlottedGalaxy[];
  axes: AxisConfig;
}
