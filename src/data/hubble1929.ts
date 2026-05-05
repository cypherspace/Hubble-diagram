// Hubble's 1929 sample: 24 galaxies (he called them "extra-galactic
// nebulae") that he plotted in his original PNAS paper, "A Relation
// Between Distance and Radial Velocity Among Extra-Galactic Nebulae"
// (1929, PNAS 15, 168). Distances were derived using a mix of
// Cepheids, brightest stars, and a fall-back "average galaxy
// luminosity" — and were systematically too low because the
// pre-1952 Cepheid calibration confused two populations of variable
// stars. That's why Hubble's original H₀ came out around 500 km/s/Mpc
// when the modern value is ~70.
//
// We carry both Hubble's published values and the modern values for
// comparison. Coordinates are J2000.

import type { Galaxy } from "../types";
import { C_KM_S } from "./derive";

export interface Hubble1929Galaxy {
  /** ID matching `CURATED_GALAXIES` where one exists, otherwise a
   *  synthetic id used only by the 1929 tour. */
  id: string;
  /** Display name as Hubble used it (e.g. "M31 / NGC 224"). */
  displayName: string;
  ra: number;
  dec: number;
  /** Hubble's 1929 published distance, in megaparsecs.
   *  Source: Hubble 1929 Table 1 (column 2). */
  hubbleDistanceMpc: number;
  /** Hubble's 1929 published radial velocity, in km/s.
   *  Source: Hubble 1929 Table 1 (column 3). */
  hubbleVelocityKmS: number;
  /** Modern distance + redshift, for the contrast tooltip. */
  modernDistanceMpc: number;
  modernZ: number;
}

// Hubble's 1929 Table 1, top-to-bottom. Distances and velocities come
// directly from his published paper (in Mpc and km/s respectively).
// Modern values are from NED / Wikipedia for the same objects, used
// only to teach the "Hubble's calibration was off by ~7×" lesson.
//
// (Some of his entries are individual galaxies; some are mean values
// of a small group. Where the entry is a group, we pick a single
// member with a known position for the Aladin pan target, and note
// the group-mean distance/velocity in the tour copy.)
export const HUBBLE_1929: Hubble1929Galaxy[] = [
  { id: "smc",      displayName: "Small Magellanic Cloud", ra: 13.16,  dec: -72.80, hubbleDistanceMpc: 0.032, hubbleVelocityKmS: 170,  modernDistanceMpc: 0.062, modernZ: 0.000527 },
  { id: "lmc",      displayName: "Large Magellanic Cloud", ra: 80.89,  dec: -69.76, hubbleDistanceMpc: 0.034, hubbleVelocityKmS: 290,  modernDistanceMpc: 0.050, modernZ: 0.000927 },
  { id: "ngc6822",  displayName: "NGC 6822 (Barnard's)",  ra: 296.24, dec: -14.81, hubbleDistanceMpc: 0.214, hubbleVelocityKmS: -130, modernDistanceMpc: 0.50,  modernZ: -0.000193 },
  { id: "ngc598",   displayName: "M33 / NGC 598",          ra: 23.46,  dec: 30.66,  hubbleDistanceMpc: 0.263, hubbleVelocityKmS: -70,  modernDistanceMpc: 0.86,  modernZ: -0.0006 },
  { id: "ngc224",   displayName: "M31 / NGC 224 (Andromeda)", ra: 10.68, dec: 41.27, hubbleDistanceMpc: 0.275, hubbleVelocityKmS: -185, modernDistanceMpc: 0.778, modernZ: -0.001 },
  { id: "ngc5457",  displayName: "M101 / NGC 5457",        ra: 210.80, dec: 54.35,  hubbleDistanceMpc: 0.45,  hubbleVelocityKmS: 200,  modernDistanceMpc: 6.4,   modernZ: 0.000804 },
  { id: "ngc4736",  displayName: "M94 / NGC 4736",         ra: 192.72, dec: 41.12,  hubbleDistanceMpc: 0.5,   hubbleVelocityKmS: 290,  modernDistanceMpc: 4.66,  modernZ: 0.001027 },
  { id: "ngc5194",  displayName: "M51 / NGC 5194",         ra: 202.47, dec: 47.20,  hubbleDistanceMpc: 0.5,   hubbleVelocityKmS: 270,  modernDistanceMpc: 8.58,  modernZ: 0.001544 },
  { id: "ngc4449",  displayName: "NGC 4449",                ra: 187.05, dec: 44.10,  hubbleDistanceMpc: 0.63,  hubbleVelocityKmS: 200,  modernDistanceMpc: 4.2,   modernZ: 0.000694 },
  { id: "ngc4214",  displayName: "NGC 4214",                ra: 183.91, dec: 36.33,  hubbleDistanceMpc: 0.8,   hubbleVelocityKmS: 300,  modernDistanceMpc: 3.0,   modernZ: 0.000970 },
  { id: "ngc3031",  displayName: "M81 / NGC 3031",          ra: 148.89, dec: 69.07,  hubbleDistanceMpc: 0.9,   hubbleVelocityKmS: -30,  modernDistanceMpc: 3.63,  modernZ: -0.000113 },
  { id: "ngc3627",  displayName: "M66 / NGC 3627",          ra: 170.06, dec: 12.99,  hubbleDistanceMpc: 0.9,   hubbleVelocityKmS: 650,  modernDistanceMpc: 11.3,  modernZ: 0.002425 },
  { id: "ngc4826",  displayName: "M64 / NGC 4826",          ra: 194.18, dec: 21.68,  hubbleDistanceMpc: 0.9,   hubbleVelocityKmS: 150,  modernDistanceMpc: 5.27,  modernZ: 0.001361 },
  { id: "ngc5236",  displayName: "M83 / NGC 5236",          ra: 204.25, dec: -29.87, hubbleDistanceMpc: 0.9,   hubbleVelocityKmS: 500,  modernDistanceMpc: 4.61,  modernZ: 0.001711 },
  { id: "ngc1068",  displayName: "M77 / NGC 1068",          ra: 40.67,  dec: -0.01,  hubbleDistanceMpc: 1.0,   hubbleVelocityKmS: 920,  modernDistanceMpc: 14.4,  modernZ: 0.003793 },
  { id: "ngc5055",  displayName: "M63 / NGC 5055",          ra: 198.96, dec: 42.03,  hubbleDistanceMpc: 1.1,   hubbleVelocityKmS: 450,  modernDistanceMpc: 8.99,  modernZ: 0.001681 },
  { id: "ngc7331",  displayName: "NGC 7331",                ra: 339.27, dec: 34.42,  hubbleDistanceMpc: 1.1,   hubbleVelocityKmS: 500,  modernDistanceMpc: 14.7,  modernZ: 0.002722 },
  { id: "ngc4258",  displayName: "M106 / NGC 4258",         ra: 184.74, dec: 47.30,  hubbleDistanceMpc: 1.4,   hubbleVelocityKmS: 500,  modernDistanceMpc: 7.58,  modernZ: 0.00149 },
  { id: "ngc5866",  displayName: "M102 / NGC 5866",         ra: 226.62, dec: 55.76,  hubbleDistanceMpc: 1.7,   hubbleVelocityKmS: 960,  modernDistanceMpc: 15.1,  modernZ: 0.002518 },
  { id: "virgo",    displayName: "Virgo Cluster (NGC 4486 / M87)", ra: 187.71, dec: 12.39, hubbleDistanceMpc: 2.0, hubbleVelocityKmS: 890, modernDistanceMpc: 16.4, modernZ: 0.004283 },
  { id: "ngc4649",  displayName: "M60 / NGC 4649",          ra: 190.92, dec: 11.55,  hubbleDistanceMpc: 2.0,   hubbleVelocityKmS: 1090, modernDistanceMpc: 16.5,  modernZ: 0.003726 },
  { id: "ngc4501",  displayName: "M88 / NGC 4501",          ra: 187.99, dec: 14.42,  hubbleDistanceMpc: 2.0,   hubbleVelocityKmS: 1240, modernDistanceMpc: 16.7,  modernZ: 0.007609 },
  { id: "ngc4374",  displayName: "M84 / NGC 4374",          ra: 186.27, dec: 12.89,  hubbleDistanceMpc: 2.0,   hubbleVelocityKmS: 1340, modernDistanceMpc: 18.4,  modernZ: 0.003392 },
  { id: "ngc4382",  displayName: "M85 / NGC 4382",          ra: 186.35, dec: 18.19,  hubbleDistanceMpc: 2.0,   hubbleVelocityKmS: 730,  modernDistanceMpc: 17.9,  modernZ: 0.002432 },
];

// Build a Galaxy record for plotting Hubble's 1929 measurement on the
// chart. distinct from the curated/derived data — uses Hubble's
// 1929 distance + velocity, a special id (`hubble1929-…`) and a
// dedicated marker colour. Type/anomaly fields are stubbed because
// these aren't really anomalies in the modern sense; they're a
// historical reproduction.
export function hubble1929GalaxyRecord(g: Hubble1929Galaxy): Galaxy {
  return {
    id: `hubble1929-${g.id}`,
    name: g.displayName,
    altNames: [],
    ra: g.ra,
    dec: g.dec,
    type: "spiral",
    distanceMpc: g.hubbleDistanceMpc,
    distanceMpcErr: g.hubbleDistanceMpc * 0.2,
    z: g.hubbleVelocityKmS / C_KM_S,
    vRecKmS: g.hubbleVelocityKmS,
    capabilities: { cepheidPL: false, lightCurves: false, sdssSpectrum: false },
    claimToFame: `Plotted by Hubble in 1929 at d = ${g.hubbleDistanceMpc} Mpc, v = ${g.hubbleVelocityKmS} km/s. Modern values: d = ${g.modernDistanceMpc} Mpc, v = ${(g.modernZ * C_KM_S).toFixed(0)} km/s.`,
    distanceTag: "direct",
    distanceMethodLabel: "Cepheid period–luminosity (Hubble 1929)",
  };
}

/** Same id as hubble1929GalaxyRecord (so it replaces the 1929 entry
 *  in the plotted Map) but uses modern distance + velocity. Used by
 *  the walkthrough's "let's re-plot with the corrected calibration"
 *  panel. */
export function hubble1929ModernRecord(g: Hubble1929Galaxy): Galaxy {
  const v = +(g.modernZ * C_KM_S).toFixed(0);
  return {
    id: `hubble1929-${g.id}`,
    name: g.displayName,
    altNames: [],
    ra: g.ra,
    dec: g.dec,
    type: "spiral",
    distanceMpc: g.modernDistanceMpc,
    distanceMpcErr: g.modernDistanceMpc * 0.05,
    z: g.modernZ,
    vRecKmS: v,
    capabilities: { cepheidPL: false, lightCurves: false, sdssSpectrum: false },
    claimToFame: `Modern measurement of a galaxy from Hubble's 1929 paper. d = ${g.modernDistanceMpc} Mpc, v = ${v} km/s.`,
    distanceTag: "direct",
    distanceMethodLabel: "Modern Cepheid / TRGB / SBF (textbook value)",
  };
}
