// Physics helpers. Every function is named after the student-facing
// step so the Cepheid / Spectrum / Hubble-fit panels can call the
// helpers in plain order with no jargon translation in the UI layer.

// Speed of light, km/s. Used to convert redshift z into recession
// velocity v_rec = c·z (low-z approximation; the comments in
// `redshiftToVelocity` say what to use beyond z ≈ 0.1).
export const C_KM_S = 299_792.458;

// Published Hubble constant from Planck 2018 + Riess+ 2022 SH0ES.
// We display the student's best-fit slope alongside this so they can
// see whether their answer lands in the "Hubble tension" range.
export const H0_PUBLISHED_KM_S_MPC = 70;

// One parsec in metres — only used when we want to express distance
// in metres or if a future panel quotes Hubble's law in SI.
export const PARSEC_M = 3.0857e16;

// =============================================================
//  Cepheid period–luminosity (Leavitt) relation
// =============================================================

// Two calibrations of the Leavitt law are bundled. Both have the form
//   M = a · (log10(P_days) - 1) + b
// where M is the absolute magnitude (how bright the star really is)
// and P is the period in days.
//
// The "(log10 P) - 1" pivot just centres the relation on a 10-day
// Cepheid (typical), so the constants `b` are easier to interpret —
// `b` is the absolute magnitude of a 10-day Cepheid in that band.
//
// `nirF160W` covers the SH0ES sample (Riess+ 2022, near-infrared
// HST/WFC3 F160W band). `opticalV` covers OGLE-IV's V-band time-
// series for Local Group hosts. Different bands need different
// calibrations because Cepheid pulsation amplitudes and reddening
// behave differently with wavelength.
export interface PLCalibration {
  a: number; // slope (mag per dex of period)
  b: number; // intercept (mag of 10-day Cepheid)
  band: "F160W" | "V";
  // Plain-English provenance for the data panel.
  reference: string;
}

export const PL_CALIBRATIONS: Record<"nirF160W" | "opticalV", PLCalibration> = {
  nirF160W: {
    a: -3.299,
    b: -5.894,
    band: "F160W",
    reference: "Riess et al. 2022 (SH0ES, HST/WFC3 NIR)",
  },
  opticalV: {
    a: -2.78,
    b: -4.21,
    band: "V",
    reference: "Madore & Freedman 1991 (Galactic + LMC, V-band)",
  },
};

// "If a Cepheid takes P days to repeat, how bright does it really
//  shine?" Returns absolute magnitude.
export function absoluteMagnitudeFromPeriod(
  periodDays: number,
  calibration: PLCalibration,
): number {
  if (periodDays <= 0) throw new Error("period must be positive");
  return calibration.a * (Math.log10(periodDays) - 1) + calibration.b;
}

// "If a star really shines at M but looks like m from Earth, how far
//  away is it?" Returns distance in parsecs.
export function distanceFromMagnitudes(
  apparentMag: number,
  absoluteMag: number,
): number {
  // d = 10 ^ ((m - M + 5) / 5), in parsecs.
  return Math.pow(10, (apparentMag - absoluteMag + 5) / 5);
}

// Convert parsecs → megaparsecs, the unit used on the Hubble diagram.
export function parsecsToMegaparsecs(distancePc: number): number {
  return distancePc / 1e6;
}

// One-shot: from period + apparent magnitude to a megaparsec distance.
// This is the "default Cepheid mode" pipeline, end to end.
export function distanceMpcFromCepheid(
  periodDays: number,
  apparentMag: number,
  calibration: PLCalibration,
): number {
  const M = absoluteMagnitudeFromPeriod(periodDays, calibration);
  const d_pc = distanceFromMagnitudes(apparentMag, M);
  return parsecsToMegaparsecs(d_pc);
}

// Wesenheit dust correction. Cepheid light gets dimmed and reddened
// by dust between us and the star — the dimming makes the star look
// further away than it is. The Wesenheit magnitude is a clever
// combination of the star's brightness in two colours that cancels
// out the dust effect:
//
//   m_W = m_NIR − R · (m_V − m_I)
//
// where R ≈ 0.386 is the standard SH0ES reddening coefficient (Riess
// et al. 2016). The redder a star looks (V − I bigger), the more
// dust there is in front of it, so we trim more brightness off.
//
// For students: "we use two different colours of light from the same
// star to figure out how much dust is dimming it, and we subtract
// that out before measuring distance."
export const REDDENING_COEFF = 0.386;
export function wesenheitMagnitude(
  apparentMagNIR: number,
  vMinusI: number,
): number {
  return apparentMagNIR - REDDENING_COEFF * vMinusI;
}

// Average a set of per-Cepheid distances. Use the median (robust to
// outliers — sometimes a single Cepheid in a published catalogue is
// crowded with a neighbour, or its apparent magnitude is biased high).
export function medianDistance(distancesMpc: number[]): number {
  if (distancesMpc.length === 0) return NaN;
  const sorted = [...distancesMpc].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// =============================================================
//  Redshift ↔ velocity
// =============================================================

// Spectrum derivation: the student drags a marker to an observed line
// position and picks which atom it is. We compute z from the ratio.
export function redshiftFromWavelengths(
  observedAngstroms: number,
  restAngstroms: number,
): number {
  if (restAngstroms <= 0) throw new Error("rest wavelength must be positive");
  return (observedAngstroms - restAngstroms) / restAngstroms;
}

// Convert redshift to recession velocity. Below z ≈ 0.1 the simple
// linear formula is fine; above that we'd switch to the special-
// relativistic Doppler formula. The Hubble diagram's main story
// (Hubble's law) lives entirely in the low-z regime, so the linear
// formula is what we show by default.
export function redshiftToVelocity(z: number): number {
  return C_KM_S * z;
}

export function velocityToRedshift(vKmS: number): number {
  return vKmS / C_KM_S;
}

// Special-relativistic version, only used for the highest-z anomaly
// galaxies (3C 273 quasar at z ≈ 0.16; deep-field galaxies at z > 1).
// The formula is symmetric: if you start with a measured velocity and
// want the "what z would Doppler give us?" answer, you'd invert this.
export function redshiftToVelocityRelativistic(z: number): number {
  const oneZ = 1 + z;
  const num = oneZ * oneZ - 1;
  const den = oneZ * oneZ + 1;
  return C_KM_S * (num / den);
}

// =============================================================
//  Hubble-diagram best-fit line
// =============================================================

// Least-squares fit of v = H0 · d, forced through the origin. Returns
// the slope (H0 in km/s/Mpc) and a reduced χ² so we can give the
// student a feel for how well their points line up.
//
// Why through the origin? Because Hubble's law is
//   v = H0 · d
// — there's no constant term in the original 1929 paper. Forcing the
// fit through the origin highlights the few galaxies that don't fit
// (Local Group blueshifts; quasars; deep-field galaxies) because they
// pull the slope around.
export function fitHubbleSlope(points: { d: number; v: number }[]): {
  h0: number;
  rms: number;
  n: number;
} {
  if (points.length === 0) return { h0: NaN, rms: NaN, n: 0 };
  let sum_dd = 0;
  let sum_dv = 0;
  for (const p of points) {
    sum_dd += p.d * p.d;
    sum_dv += p.d * p.v;
  }
  const h0 = sum_dd > 0 ? sum_dv / sum_dd : NaN;
  let ss = 0;
  for (const p of points) {
    const r = p.v - h0 * p.d;
    ss += r * r;
  }
  const rms = points.length > 0 ? Math.sqrt(ss / points.length) : NaN;
  return { h0, rms, n: points.length };
}

// =============================================================
//  Period folding (light-curve mode)
// =============================================================

// Given a list of (time, brightness) measurements and a trial period,
// "fold" the timeline by replacing each time with `time mod period`.
// Returns the folded points sorted by phase (0…1). When the trial
// period equals the true period, the folded points cluster onto a
// single repeating shape; otherwise they spread into a noisy cloud.
//
// This is exactly what the LightCurvePanel's slider does live as the
// student drags it, so the UX matches the algorithm.
export function foldLightCurve(
  points: { jd: number; mag: number }[],
  trialPeriodDays: number,
): { phase: number; mag: number }[] {
  if (trialPeriodDays <= 0) return [];
  const out = points.map((p) => ({
    phase: ((p.jd % trialPeriodDays) + trialPeriodDays) / trialPeriodDays % 1,
    mag: p.mag,
  }));
  out.sort((a, b) => a.phase - b.phase);
  return out;
}

// "How clean is this fold?" — a string-length metric. The folded
// points are sorted by phase and we sum the distances between
// consecutive points in (phase, mag) space. The right period
// minimises this sum: the curve is a single connected loop, no
// criss-crossing. Used to (a) give the student a "freshness" colour
// behind the slider, and (b) seed the LightCurvePanel's "show me a
// good period" hint.
export function foldStringLength(
  folded: { phase: number; mag: number }[],
  magRange: number,
): number {
  if (folded.length < 2 || magRange <= 0) return Infinity;
  let s = 0;
  for (let i = 1; i < folded.length; i++) {
    const dp = folded[i].phase - folded[i - 1].phase;
    const dm = (folded[i].mag - folded[i - 1].mag) / magRange;
    s += Math.sqrt(dp * dp + dm * dm);
  }
  return s;
}

// Search a coarse grid of trial periods and return the one with the
// shortest "string length" — a simple, slow but transparent
// alternative to Lomb–Scargle. For a Cepheid time series of ~50
// points and a 0.5–100 day range with 0.01-day resolution, this is
// a few thousand evaluations and well under a second in the browser.
export function suggestPeriod(
  points: { jd: number; mag: number }[],
  minDays: number,
  maxDays: number,
  stepDays: number,
): number {
  if (points.length < 5 || maxDays <= minDays) return NaN;
  const mags = points.map((p) => p.mag);
  const range = Math.max(...mags) - Math.min(...mags);
  let bestP = NaN;
  let bestS = Infinity;
  for (let p = minDays; p <= maxDays; p += stepDays) {
    const folded = foldLightCurve(points, p);
    const s = foldStringLength(folded, range);
    if (s < bestS) {
      bestS = s;
      bestP = p;
    }
  }
  return bestP;
}

// Median magnitude of a folded curve — what the student reads off
// once they've found the right period.
export function meanMagFromFolded(
  folded: { phase: number; mag: number }[],
): number {
  if (folded.length === 0) return NaN;
  const mags = folded.map((p) => p.mag).sort((a, b) => a - b);
  const mid = Math.floor(mags.length / 2);
  return mags.length % 2 === 0
    ? (mags[mid - 1] + mags[mid]) / 2
    : mags[mid];
}
