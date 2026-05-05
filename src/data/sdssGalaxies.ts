import type { Galaxy } from "../types";
import { num, parseCsv, runAdql } from "./vizier";
import { C_KM_S } from "./derive";

// Live cone search against a SDSS galaxy catalog on VizieR TAP.
// Catalog: J/A+A/648/A122/catalog (Tempel et al. 2021, "Galaxy
// distance estimation from SDSS DR16 photometry"), ~316k galaxies
// with RA/Dec, spectroscopic redshift z, and pre-computed luminosity
// distance DL in megaparsecs. Ideal for the Hubble diagram because
// distance and z come from the same row — no joins needed.

export interface SdssGalaxyRow {
  objId: string;
  ra: number;
  dec: number;
  z: number;
  distanceMpc: number; // luminosity distance, Mpc
  rmag: number;        // apparent r-band magnitude
}

export async function searchSdssGalaxies(
  raDeg: number,
  decDeg: number,
  radiusDeg: number,
  options: {
    topN?: number;
    magLimit?: number;
    minZ?: number;
    maxZ?: number;
    signal?: AbortSignal;
  } = {},
): Promise<SdssGalaxyRow[]> {
  const topN = options.topN ?? 50;
  const magLimit = options.magLimit ?? 19;
  const minZ = options.minZ ?? 0.001;
  const maxZ = options.maxZ ?? 0.5;
  // Tempel+ 2021 SDSS galaxy catalog. Columns of interest:
  //   objID, RAJ2000, DEJ2000, rmag, z, DL
  const adql = `SELECT TOP ${topN}
  "objID", "RAJ2000", "DEJ2000", "rmag", "z", "DL"
FROM "J/A+A/648/A122/catalog"
WHERE 1 = CONTAINS(
    POINT('ICRS', "RAJ2000", "DEJ2000"),
    CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg})
  )
  AND "z" IS NOT NULL
  AND "z" > ${minZ}
  AND "z" < ${maxZ}
  AND "rmag" IS NOT NULL
  AND "rmag" < ${magLimit}
ORDER BY "rmag" ASC`;
  const csv = await runAdql(adql, options.signal);
  const rows = parseCsv(csv);
  const out: SdssGalaxyRow[] = [];
  for (const r of rows) {
    const ra = num(r["RAJ2000"]);
    const dec = num(r["DEJ2000"]);
    const z = num(r["z"]);
    const dl = num(r["DL"]);
    const rmag = num(r["rmag"]);
    if (ra == null || dec == null || z == null || dl == null || rmag == null) {
      continue;
    }
    out.push({
      objId: (r["objID"] ?? "").trim(),
      ra,
      dec,
      z,
      distanceMpc: dl,
      rmag,
    });
  }
  return out;
}

// Convert a row into the Galaxy shape the rest of the app uses. These
// galaxies are "search results" so they have no Cepheid/spectrum
// capabilities by default — they're added to the chart as-is from the
// SDSS data.
export function sdssRowToGalaxy(row: SdssGalaxyRow): Galaxy {
  const v = +(C_KM_S * row.z).toFixed(0);
  return {
    id: `sdss-${row.objId}`,
    name: `SDSS J${row.objId.slice(-8)}`,
    altNames: [`SDSS objID ${row.objId}`],
    ra: row.ra,
    dec: row.dec,
    type: "spiral",
    distanceMpc: +row.distanceMpc.toFixed(2),
    distanceMpcErr: +(row.distanceMpc * 0.05).toFixed(2),
    z: +row.z.toFixed(6),
    vRecKmS: v,
    distanceTag: "extrapolated",
    distanceMethodLabel: "Redshift × cosmological model (SDSS spectroscopic)",
    capabilities: {
      cepheidPL: false,
      lightCurves: false,
      // SDSS galaxies all have spectra — that's how their redshift was
      // measured. Item 8 wires up a runtime resolver
      // (lookupSdssSpec → fetchSdssSpectrumCsv) so the SpectrumPanel
      // can fetch the spec-lite CSV on demand. Both SkyServer and
      // dr17.sdss.org serve permissive CORS headers.
      sdssSpectrum: true,
    },
    claimToFame: `An SDSS-catalogued galaxy at redshift z = ${row.z.toFixed(4)}, r-band magnitude ${row.rmag.toFixed(2)}.`,
  };
}
