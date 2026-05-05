import type { DistanceTag, Galaxy } from "../types";
import { num, parseCsv, runAdql } from "./vizier";
import { C_KM_S } from "./derive";

// Cone-search galaxies in the visible part of the sky. Four catalogs
// are queried; results are merged with redshift-independent ("direct")
// distances given priority over redshift-derived ("extrapolated") ones:
//
//   1. Cosmicflows-3 (Tully+ 2016, J/AJ/152/50) — ~17,500 galaxies with
//      redshift-independent distances from a mix of methods (Cepheid,
//      TRGB, SBF, SN Ia, Tully-Fisher, fundamental plane). Plotting
//      these on a Hubble diagram shows real scatter around the law,
//      not an artefactual rail. Always tried first.
//
//   2. Cosmicflows-4 (Tully+ 2023, J/ApJ/944/94) — ~56,000 galaxies,
//      same methodology as CF3 with 2× more sky coverage. Fired in
//      parallel with CF3 and merged in opportunistically when it
//      lands; CF3 wins on dedup since it has been more thoroughly
//      vetted in the literature.
//
//   3. SDSS via Tempel+ 2021 (J/A+A/648/A122) — ~316k galaxies with
//      spectroscopic redshift AND a catalog luminosity distance. The
//      DL column is a ΛCDM-derived value, so these points sit on a
//      perfect rail. Used as a fallback when CF3+CF4 thin out, and
//      tagged "extrapolated" so the user can see what's going on.
//
//   4. 2MASS Redshift Survey (J/ApJS/199/26) — all-sky, distance
//      computed as cz / 70. Last-resort fallback. Also "extrapolated".

// Combined-result count below which we keep going down the fallback
// chain. Picked so a moderately populated CF3 field doesn't trigger a
// big SDSS query, but a near-empty one does.
const FALLBACK_THRESHOLD = 20;

// Angular tolerance for the "same galaxy across two catalogs" dedup.
// 5 arcseconds is generous enough to absorb astrometric noise between
// CF3 / CF4 / SDSS / 2MRS without merging genuinely distinct galaxies.
const DEDUP_TOLERANCE_DEG = 5 / 3600;

export interface SearchedGalaxy {
  /** Source catalog. */
  source: "cf3" | "cf4" | "sdss" | "2mrs";
  /** Catalog-specific id. */
  catalogId: string;
  /** Display name from the catalog (CF3/CF4 publish proper names; SDSS
   *  uses an objID; 2MRS uses a 2MASS designation). */
  catalogName?: string;
  ra: number;
  dec: number;
  /** Recession velocity in km/s. */
  vRecKmS: number;
  /** Redshift z (= v / c). */
  z: number;
  /** Distance in Mpc. */
  distanceMpc: number;
  /** Apparent magnitude in the catalog's primary band, when available. */
  mag?: number;
  magBand?: "r" | "Kt";
  /** Whether the distance is redshift-independent (CF3/CF4) or derived
   *  from redshift (SDSS DL column or 2MRS cz/H₀). */
  distanceTag: DistanceTag;
  /** Long-form method label for the data panel. */
  distanceMethodLabel: string;
  /** Optional cross-id from SIMBAD (only present for 2MRS rows whose
   *  `SimbadName` field happens to be a recognisable name). */
  simbadName?: string;
}

export interface SearchOptions {
  topN?: number;
  signal?: AbortSignal;
}

export interface SearchResult {
  /** All galaxies found across the catalogs that ran, after dedup. */
  galaxies: SearchedGalaxy[];
  /** The catalogs whose responses are reflected in `galaxies`. CF4 is
   *  listed only once it has resolved; it is fetched in the
   *  background, so a follow-up call to `awaitCf4` may produce more. */
  sourcesUsed: ("cf3" | "cf4" | "sdss" | "2mrs")[];
  /** A handle to the still-pending CF4 query (or `null` if CF4 is not
   *  in flight). When it resolves, callers should re-merge its rows
   *  into the displayed candidates. */
  cf4Pending: Promise<SearchedGalaxy[]> | null;
}

/** Try Cosmicflows-3 first; fire CF4 in the background; if CF3 returns
 *  fewer than FALLBACK_THRESHOLD rows (or fails), fall through to SDSS,
 *  then 2MRS, merging on sky-position. CF3/CF4 failures are silent
 *  because they're optional: SDSS+2MRS still produce a usable result. */
export async function searchGalaxies(
  raDeg: number,
  decDeg: number,
  radiusDeg: number,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const sourcesUsed: SearchResult["sourcesUsed"] = [];
  // Fire CF3 + CF4 in parallel. Both swallow errors — VizieR sometimes
  // refuses these tables (column-name drift between catalog releases),
  // and we'd rather show SDSS results than fail the whole search.
  const cf3Promise = searchCosmicflows3(raDeg, decDeg, radiusDeg, options).catch(
    () => [] as SearchedGalaxy[],
  );
  const cf4Promise = searchCosmicflows4(raDeg, decDeg, radiusDeg, options).catch(
    () => [] as SearchedGalaxy[],
  );

  let merged: SearchedGalaxy[] = await cf3Promise;
  if (merged.length > 0) sourcesUsed.push("cf3");

  if (merged.length < FALLBACK_THRESHOLD) {
    try {
      const sdss = await searchSdss(raDeg, decDeg, radiusDeg, options);
      merged = mergeByPosition(merged, sdss);
      if (sdss.length > 0) sourcesUsed.push("sdss");
    } catch {
      // SDSS failures are non-fatal; the user still sees 2MRS.
    }
  }

  if (merged.length < FALLBACK_THRESHOLD) {
    try {
      const two = await search2mrs(raDeg, decDeg, radiusDeg, options);
      merged = mergeByPosition(merged, two);
      if (two.length > 0) sourcesUsed.push("2mrs");
    } catch {
      // 2MRS failures are non-fatal.
    }
  }

  return { galaxies: merged, sourcesUsed, cf4Pending: cf4Promise };
}

// ---- catalog-specific queries ------------------------------------------

const CF3_METHOD_LABELS: Record<string, string> = {
  C: "Cepheid period–luminosity (Cosmicflows-3)",
  T: "Tip of the red giant branch (Cosmicflows-3)",
  S: "Surface-brightness fluctuations (Cosmicflows-3)",
  L: "Tully-Fisher (Cosmicflows-3)",
  F: "Fundamental plane (Cosmicflows-3)",
  N: "Type Ia supernova (Cosmicflows-3)",
  M: "Maser geometry (Cosmicflows-3)",
  E: "Eclipsing binary (Cosmicflows-3)",
  P: "Trigonometric parallax (Cosmicflows-3)",
};

export function cf3MethodLabel(code: string | undefined): string {
  if (!code) return "Redshift-independent (Cosmicflows-3)";
  const trimmed = code.trim();
  if (trimmed.length === 0) return "Redshift-independent (Cosmicflows-3)";
  return CF3_METHOD_LABELS[trimmed[0]] ?? "Redshift-independent (Cosmicflows-3)";
}

// Cosmicflows tables publish the distance modulus (`DM` or `Mod`)
// rather than a raw distance column, so we compute Mpc from the modulus
// using the standard formula: d_Mpc = 10^((DM - 25) / 5).
function distanceMpcFromModulus(mod: number): number {
  return Math.pow(10, (mod - 25) / 5);
}

async function searchCosmicflows3(
  raDeg: number,
  decDeg: number,
  radiusDeg: number,
  options: SearchOptions,
): Promise<SearchedGalaxy[]> {
  const topN = options.topN ?? 50;
  // Cosmicflows-3 (Tully+ 2016, J/AJ/152/50). The combined catalog has
  // a per-galaxy distance modulus (`DM`) and CMB-frame velocity (`Vcmb`).
  const adql = `SELECT TOP ${topN}
  "Name", "RAJ2000", "DEJ2000", "DM", "Vcmb"
FROM "J/AJ/152/50/table3"
WHERE 1 = CONTAINS(POINT('ICRS', "RAJ2000", "DEJ2000"), CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg}))
  AND "DM" IS NOT NULL
  AND "Vcmb" IS NOT NULL
ORDER BY "DM" ASC`;
  const csv = await runAdql(adql, options.signal);
  const rows = parseCsv(csv);
  const out: SearchedGalaxy[] = [];
  for (const r of rows) {
    const ra = num(r["RAJ2000"]);
    const dec = num(r["DEJ2000"]);
    const dm = num(r["DM"]);
    const vcmb = num(r["Vcmb"]);
    if (ra == null || dec == null || dm == null || vcmb == null) continue;
    const dist = distanceMpcFromModulus(dm);
    if (!Number.isFinite(dist) || dist <= 0) continue;
    const name = (r["Name"] ?? "").trim();
    out.push({
      source: "cf3",
      catalogId: name || `${ra.toFixed(4)}${dec.toFixed(4)}`,
      catalogName: name || undefined,
      ra,
      dec,
      vRecKmS: vcmb,
      z: vcmb / C_KM_S,
      distanceMpc: +dist.toFixed(2),
      distanceTag: "direct",
      distanceMethodLabel: cf3MethodLabel(r["Mthd"]),
    });
  }
  return out;
}

async function searchCosmicflows4(
  raDeg: number,
  decDeg: number,
  radiusDeg: number,
  options: SearchOptions,
): Promise<SearchedGalaxy[]> {
  const topN = options.topN ?? 50;
  // Cosmicflows-4 (Tully+ 2023, J/ApJ/944/94). Same modulus-based
  // schema as CF3.
  const adql = `SELECT TOP ${topN}
  "Name", "RAJ2000", "DEJ2000", "DM", "Vcmb"
FROM "J/ApJ/944/94/table2"
WHERE 1 = CONTAINS(POINT('ICRS', "RAJ2000", "DEJ2000"), CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg}))
  AND "DM" IS NOT NULL
  AND "Vcmb" IS NOT NULL
ORDER BY "DM" ASC`;
  const csv = await runAdql(adql, options.signal);
  const rows = parseCsv(csv);
  const out: SearchedGalaxy[] = [];
  for (const r of rows) {
    const ra = num(r["RAJ2000"]);
    const dec = num(r["DEJ2000"]);
    const dm = num(r["DM"]);
    const vcmb = num(r["Vcmb"]);
    if (ra == null || dec == null || dm == null || vcmb == null) continue;
    const dist = distanceMpcFromModulus(dm);
    if (!Number.isFinite(dist) || dist <= 0) continue;
    const name = (r["Name"] ?? "").trim();
    out.push({
      source: "cf4",
      catalogId: name || `${ra.toFixed(4)}${dec.toFixed(4)}`,
      catalogName: name || undefined,
      ra,
      dec,
      vRecKmS: vcmb,
      z: vcmb / C_KM_S,
      distanceMpc: +dist.toFixed(2),
      distanceTag: "direct",
      distanceMethodLabel: "Redshift-independent (Cosmicflows-4)",
    });
  }
  return out;
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
      ra,
      dec,
      mag: rmag,
      magBand: "r",
      z,
      vRecKmS: +(C_KM_S * z).toFixed(0),
      distanceMpc: +dl.toFixed(2),
      distanceTag: "extrapolated",
      distanceMethodLabel: "Redshift × cosmological model (SDSS spectroscopic)",
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
      ra,
      dec,
      mag: k ?? undefined,
      magBand: k != null ? "Kt" : undefined,
      z,
      vRecKmS: cz,
      distanceMpc: +dMpc.toFixed(2),
      distanceTag: "extrapolated",
      distanceMethodLabel: "Redshift × Hubble's law (2MASS Redshift Survey)",
      simbadName: (r["SimbadName"] ?? "").trim() || undefined,
    });
  }
  return out;
}

// ---- merge / dedup -----------------------------------------------------

/** Approximate angular distance in degrees, good enough for sub-arcminute
 *  separations between two galaxies in the same field. Uses small-angle
 *  flat-sky approximation with a cosine correction on RA. */
export function angularDistanceDeg(
  raA: number,
  decA: number,
  raB: number,
  decB: number,
): number {
  const dDec = decA - decB;
  const meanDec = ((decA + decB) / 2) * (Math.PI / 180);
  const dRa = (raA - raB) * Math.cos(meanDec);
  return Math.sqrt(dDec * dDec + dRa * dRa);
}

/** Concatenate `extra` onto `existing`, dropping any `extra` row that
 *  sits within DEDUP_TOLERANCE_DEG of a row already in `existing`.
 *  Order is preserved: `existing` rows take priority, so calling this
 *  with CF3 first keeps CF3's "direct" tag when SDSS/2MRS have the
 *  same galaxy. */
export function mergeByPosition(
  existing: SearchedGalaxy[],
  extra: SearchedGalaxy[],
): SearchedGalaxy[] {
  if (existing.length === 0) return [...extra];
  const out = [...existing];
  for (const candidate of extra) {
    let dup = false;
    for (const kept of out) {
      if (
        angularDistanceDeg(candidate.ra, candidate.dec, kept.ra, kept.dec) <
        DEDUP_TOLERANCE_DEG
      ) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(candidate);
  }
  return out;
}

// ---- adaptation to Galaxy ----------------------------------------------

export function searchedGalaxyToGalaxy(g: SearchedGalaxy): Galaxy {
  const idPrefix = g.source;
  const safeCatId = g.catalogId.replace(/\s+/g, "_");
  const id = `${idPrefix}-${safeCatId || `${g.ra.toFixed(4)}_${g.dec.toFixed(4)}`}`;
  const niceName = g.simbadName?.replace(/_/g, " ");
  const fallbackName =
    g.source === "sdss"
      ? `SDSS J${g.catalogId.slice(-8)}`
      : g.source === "2mrs"
        ? `2MASS J${g.catalogId}`
        : g.catalogName || `${g.source.toUpperCase()} ${g.catalogId}`;
  const name = niceName || g.catalogName || fallbackName;
  const altNames =
    g.source === "sdss"
      ? [`SDSS objID ${g.catalogId}`]
      : g.source === "2mrs" && g.simbadName
        ? [`2MASS J${g.catalogId}`]
        : [];
  const claim = buildClaim(g);
  // Distance error: tighter for direct measurements, looser for the
  // redshift-derived rails. (CF3/CF4 catalogs publish per-galaxy errors
  // we could pull through later, but a flat 8% is pedagogically fine.)
  const errFraction = g.distanceTag === "direct" ? 0.08 : 0.15;
  return {
    id,
    name,
    altNames,
    ra: g.ra,
    dec: g.dec,
    type: "spiral",
    distanceMpc: g.distanceMpc,
    distanceMpcErr: +(g.distanceMpc * errFraction).toFixed(2),
    z: +g.z.toFixed(6),
    vRecKmS: g.vRecKmS,
    capabilities: {
      cepheidPL: false,
      lightCurves: false,
      // Only SDSS galaxies have linkable spec-lite CSVs we can fetch.
      sdssSpectrum: g.source === "sdss",
    },
    claimToFame: claim,
    distanceTag: g.distanceTag,
    distanceMethodLabel: g.distanceMethodLabel,
  };
}

function buildClaim(g: SearchedGalaxy): string {
  const magPart =
    g.mag != null && Number.isFinite(g.mag)
      ? `, ${g.magBand}-band magnitude ${g.mag.toFixed(2)}`
      : "";
  switch (g.source) {
    case "cf3":
      return `A galaxy from the Cosmicflows-3 distance compendium (Tully+ 2016) at ${g.distanceMpc} Mpc, recession velocity ${Math.round(g.vRecKmS)} km/s.`;
    case "cf4":
      return `A galaxy from the Cosmicflows-4 distance compendium (Tully+ 2023) at ${g.distanceMpc} Mpc, recession velocity ${Math.round(g.vRecKmS)} km/s.`;
    case "sdss":
      return `A galaxy from the Sloan Digital Sky Survey at redshift z = ${g.z.toFixed(4)}${magPart}.`;
    case "2mrs":
      return `A galaxy from the 2MASS Redshift Survey, recession velocity ${Math.round(g.vRecKmS)} km/s${magPart}.`;
  }
}
