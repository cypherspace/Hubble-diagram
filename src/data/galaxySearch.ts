import type { Galaxy } from "../types";
import { num, parseCsv, runAdql } from "./vizier";
import { C_KM_S } from "./derive";

// Cone-search galaxies in the visible part of the sky. Two catalogs
// in priority order:
//
//   1. SDSS via Tempel+ 2021 (J/A+A/648/A122) — ~316k galaxies with
//      spectroscopic redshift AND pre-computed luminosity distance.
//      Best when available because we get distance + redshift from
//      one row, no joins. BUT: only covers the SDSS spectroscopic
//      footprint (north galactic cap + equatorial strip). Returns
//      zero rows for fields like Andromeda or anywhere near the
//      galactic plane.
//
//   2. 2MASS Redshift Survey (J/ApJS/199/26/table3) — ~45k galaxies
//      ALL-SKY. Provides cz (recession velocity, km/s) but no
//      precomputed distance, so we estimate distance from cz using
//      Hubble's law with H₀ = 70: d_Mpc = cz / H₀. Since the user is
//      *trying* to measure H₀, this is a tiny bit circular, but the
//      goal of the search is to seed the chart with points — and
//      2MRS distances done this way come out within ~10% of
//      published distances for galaxies in Hubble flow.
//
// SearchVisibleRegion (in main.ts) calls `searchGalaxies` which tries
// SDSS, falls back to 2MRS if SDSS returns nothing.

export interface SearchedGalaxy {
  /** Source catalog. */
  source: "sdss" | "2mrs";
  /** Catalog-specific id (SDSS objID or 2MRS designation). */
  catalogId: string;
  ra: number;
  dec: number;
  /** Apparent magnitude in the catalog's primary band. */
  mag: number;
  magBand: "r" | "Kt";
  /** Recession velocity in km/s. */
  vRecKmS: number;
  /** Redshift z (= v / c). */
  z: number;
  /** Distance in Mpc. From the catalog where available, else from
   *  cz / H₀. */
  distanceMpc: number;
  distanceFrom: "catalog" | "hubble-law";
  /** Optional cross-id from SIMBAD (only present for 2MRS rows
   *  whose `SimbadName` field happens to be a recognisable name). */
  simbadName?: string;
}

export interface SearchOptions {
  topN?: number;
  signal?: AbortSignal;
}

/** Try SDSS first; if it returns no rows, fall back to 2MRS. */
export async function searchGalaxies(
  raDeg: number,
  decDeg: number,
  radiusDeg: number,
  options: SearchOptions = {},
): Promise<{ galaxies: SearchedGalaxy[]; sourceUsed: "sdss" | "2mrs" | "none" }> {
  const sdss = await searchSdss(raDeg, decDeg, radiusDeg, options);
  if (sdss.length > 0) return { galaxies: sdss, sourceUsed: "sdss" };
  const two = await search2mrs(raDeg, decDeg, radiusDeg, options);
  if (two.length > 0) return { galaxies: two, sourceUsed: "2mrs" };
  return { galaxies: [], sourceUsed: "none" };
}

async function searchSdss(
  raDeg: number,
  decDeg: number,
  radiusDeg: number,
  options: SearchOptions,
): Promise<SearchedGalaxy[]> {
  const topN = options.topN ?? 50;
  const adql = `SELECT TOP ${topN}
  "objID", "RAJ2000", "DEJ2000", "rmag", "z", "DL"
FROM "J/A+A/648/A122/catalog"
WHERE 1 = CONTAINS(POINT('ICRS', "RAJ2000", "DEJ2000"), CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg}))
  AND "z" IS NOT NULL AND "z" > 0.001 AND "z" < 0.5
  AND "rmag" IS NOT NULL AND "rmag" < 19
ORDER BY "rmag" ASC`;
  const csv = await runAdql(adql, options.signal);
  const rows = parseCsv(csv);
  const out: SearchedGalaxy[] = [];
  for (const r of rows) {
    const ra = num(r["RAJ2000"]);
    const dec = num(r["DEJ2000"]);
    const z = num(r["z"]);
    const dl = num(r["DL"]);
    const rmag = num(r["rmag"]);
    if (ra == null || dec == null || z == null || dl == null || rmag == null) continue;
    out.push({
      source: "sdss",
      catalogId: (r["objID"] ?? "").trim(),
      ra, dec,
      mag: rmag, magBand: "r",
      z,
      vRecKmS: +(C_KM_S * z).toFixed(0),
      distanceMpc: +dl.toFixed(2),
      distanceFrom: "catalog",
    });
  }
  return out;
}

async function search2mrs(
  raDeg: number,
  decDeg: number,
  radiusDeg: number,
  options: SearchOptions,
): Promise<SearchedGalaxy[]> {
  const topN = options.topN ?? 50;
  // 2MRS columns we need: ID, RAJ2000, DEJ2000, Ktmag, cz, SimbadName
  // cz is in km/s; some Local Group galaxies have negative cz.
  const adql = `SELECT TOP ${topN}
  "ID", "RAJ2000", "DEJ2000", "Ktmag", "cz", "SimbadName"
FROM "J/ApJS/199/26/table3"
WHERE 1 = CONTAINS(POINT('ICRS', "RAJ2000", "DEJ2000"), CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg}))
  AND "cz" IS NOT NULL
ORDER BY "Ktmag" ASC`;
  const csv = await runAdql(adql, options.signal);
  const rows = parseCsv(csv);
  const out: SearchedGalaxy[] = [];
  for (const r of rows) {
    const ra = num(r["RAJ2000"]);
    const dec = num(r["DEJ2000"]);
    const cz = num(r["cz"]);
    const k = num(r["Ktmag"]);
    if (ra == null || dec == null || cz == null) continue;
    const z = cz / C_KM_S;
    // Estimate distance from Hubble's law for cz > 0; for blueshifted
    // Local Group members fall back to a small fixed near-distance
    // (so the dot lands near the y-axis, not at -∞).
    const dMpc = cz > 100 ? cz / 70 : Math.max(0.01, Math.abs(cz) / 70);
    out.push({
      source: "2mrs",
      catalogId: (r["ID"] ?? "").trim(),
      ra, dec,
      mag: k ?? NaN, magBand: "Kt",
      z,
      vRecKmS: cz,
      distanceMpc: +dMpc.toFixed(2),
      distanceFrom: "hubble-law",
      simbadName: (r["SimbadName"] ?? "").trim() || undefined,
    });
  }
  return out;
}

export function searchedGalaxyToGalaxy(g: SearchedGalaxy): Galaxy {
  const id =
    g.source === "sdss"
      ? `sdss-${g.catalogId}`
      : `mrs-${g.catalogId.replace(/\s+/g, "")}`;
  // For 2MRS, prefer a SIMBAD name if the catalog gives one. Otherwise
  // synthesise a short label from the 2MASS designation.
  const niceName = g.simbadName?.replace(/_/g, " ");
  const fallbackName =
    g.source === "sdss"
      ? `SDSS J${g.catalogId.slice(-8)}`
      : `2MASS J${g.catalogId}`;
  const name = niceName || fallbackName;
  const altNames =
    g.source === "sdss"
      ? [`SDSS objID ${g.catalogId}`]
      : g.simbadName
        ? [`2MASS J${g.catalogId}`]
        : [];
  const claim =
    g.source === "sdss"
      ? `A galaxy from the Sloan Digital Sky Survey at redshift z = ${g.z.toFixed(4)}, r-band magnitude ${g.mag.toFixed(2)}.`
      : `A galaxy from the 2MASS Redshift Survey, recession velocity ${g.vRecKmS} km/s${Number.isFinite(g.mag) ? `, K-band magnitude ${g.mag.toFixed(2)}` : ""}.`;
  return {
    id,
    name,
    altNames,
    ra: g.ra,
    dec: g.dec,
    type: "spiral",
    distanceMpc: g.distanceMpc,
    distanceMpcErr: +(g.distanceMpc * (g.distanceFrom === "catalog" ? 0.05 : 0.15)).toFixed(2),
    z: +g.z.toFixed(6),
    vRecKmS: g.vRecKmS,
    capabilities: {
      cepheidPL: false,
      lightCurves: false,
      // Only SDSS galaxies have linkable spec-lite CSVs we can fetch.
      sdssSpectrum: g.source === "sdss",
    },
    claimToFame: claim,
  };
}
