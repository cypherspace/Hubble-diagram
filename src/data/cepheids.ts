import type { Cepheid } from "../types";
import { num, parseCsv, runAdql, VizierError } from "./vizier";

// SH0ES Cepheid catalog: VizieR J/ApJ/826/56/table4 (Riess+ 2016).
// Columns we use: Gal, RAJ2000, DEJ2000, ID, Per (period in days),
// V-I (colour), F160W (mean apparent magnitude in HST/WFC3 NIR),
// sigTot (total uncertainty on mean magnitude).

// Map a SH0ES "Gal" string ("N1015 ", "M101  ") to our internal galaxy id.
// The catalog uses "N1015"/"N1309"/"M101" etc.; our IDs are "ngc1015"/
// "m101" etc. Build a tolerant resolver.
function shoeGalToId(gal: string): string | null {
  const g = gal.trim().toUpperCase();
  if (g.startsWith("N")) return "ngc" + g.slice(1);
  if (g.startsWith("M")) return "m" + g.slice(1);
  if (g.startsWith("U")) return "u" + g.slice(1).toLowerCase().replace("gc", "gc");
  return null;
}

const CACHE = new Map<string, Cepheid[]>();

// Try the static pre-built JSON first (Firebase /data/cepheid-catalogs/{id}.json),
// then fall back to a live VizieR query if the static file is missing
// or empty (e.g. when running before `npm run build:data`).
export async function loadCepheidCatalog(
  galaxyId: string,
  signal?: AbortSignal,
): Promise<Cepheid[]> {
  if (CACHE.has(galaxyId)) return CACHE.get(galaxyId)!;
  try {
    const r = await fetch(`./data/cepheid-catalogs/${galaxyId}.json`, { signal });
    if (r.ok) {
      const json = (await r.json()) as Cepheid[];
      if (Array.isArray(json) && json.length > 0) {
        CACHE.set(galaxyId, json);
        return json;
      }
    }
  } catch {
    // fall through to live query
  }
  const live = await fetchCepheidsLive(galaxyId, signal);
  CACHE.set(galaxyId, live);
  return live;
}

export async function fetchCepheidsLive(
  galaxyId: string,
  signal?: AbortSignal,
): Promise<Cepheid[]> {
  // Map our id back to the SH0ES "Gal" code used in the catalog. The
  // catalog uses raw NGC numbers without the "NGC " prefix and a 1-char
  // letter (N/M/U).
  const galCode = idToShoesGal(galaxyId);
  if (!galCode) {
    throw new VizierError(
      `No SH0ES Cepheid catalog mapping for galaxy ${galaxyId}.`,
    );
  }
  // LIKE 'N5584%' rather than TRIM() — VizieR's ADQL parser
  // rejects TRIM in this table's WHERE clause.
  const adql = `SELECT "Gal", "RAJ2000", "DEJ2000", "ID", "Per", "V-I", "F160W", "sigTot"
FROM "J/ApJ/826/56/table4"
WHERE "Gal" LIKE '${galCode}%'`;
  const csv = await runAdql(adql, signal);
  const rows = parseCsv(csv);
  const out: Cepheid[] = [];
  for (const r of rows) {
    const period = num(r["Per"]);
    const mag = num(r["F160W"]);
    const ra = num(r["RAJ2000"]);
    const dec = num(r["DEJ2000"]);
    if (period == null || mag == null || ra == null || dec == null) continue;
    out.push({
      id: `${galaxyId}-${(r["ID"] ?? "").trim()}`,
      galaxyId,
      ra,
      dec,
      periodDays: period,
      meanMag: mag,
      magBand: "F160W",
      magUncertainty: num(r["sigTot"]) ?? undefined,
      vMinusI: num(r["V-I"]) ?? undefined,
      source: "SH0ES",
    });
  }
  return out;
}

// Inverse of `shoeGalToId`. Hard-coded for the curated set so we don't
// have to guess: each galaxy carries the exact "Gal" string the SH0ES
// catalog uses.
function idToShoesGal(id: string): string | null {
  const map: Record<string, string> = {
    ngc1015: "N1015",
    ngc1309: "N1309",
    ngc1365: "N1365",
    ngc1448: "N1448",
    ngc2442: "N2442",
    ngc3370: "N3370",
    ngc3447: "N3447",
    ngc3627: "N3627",
    ngc3972: "N3972",
    ngc3982: "N3982",
    ngc4038: "N4038",
    ngc4424: "N4424",
    ngc4536: "N4536",
    ngc4639: "N4639",
    ngc5584: "N5584",
    ngc5917: "N5917",
    ngc7250: "N7250",
    ugc9391: "U9391",
    m101: "M101 ",
    ngc4258: "N4258",
  };
  return map[id] ?? null;
}

export { shoeGalToId };
