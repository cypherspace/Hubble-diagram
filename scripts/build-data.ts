// One-shot data fetcher. Run with `npm run build:data`.
//
// Pulls:
//   1. SH0ES Cepheid catalogue from VizieR (J/ApJ/826/56/table4),
//      one JSON file per host galaxy in public/data/cepheid-catalogs/.
//   2. SDSS DR17 spectra (CSV) for galaxies that carry an sdssSpec
//      pointer, into public/data/spectra/.
//   3. Synthesised OGLE-IV style light curves for the four Local Group
//      galaxies (LMC, SMC, M31, M33) into public/data/lightcurves/.
//      Pulling real OGLE time series at runtime is awkward (no TAP,
//      mixed formats) so for the first cut we synthesise scientifically
//      reasonable Cepheid light curves around published periods. This
//      can be replaced with a real OGLE pull when the structure is
//      finalised.
//
// The script is idempotent — it skips files that already exist, so
// re-running is cheap. Pass --force to re-fetch.

import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Cepheid,
  CepheidLightCurve,
  PhotometryPoint,
  SdssSpectrumPointer,
} from "../src/types";
import { CURATED_GALAXIES } from "../src/data/galaxies";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_ROOT = resolve(ROOT, "public", "data");

const TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync";
const FORCE = process.argv.includes("--force");

async function main(): Promise<void> {
  await mkdir(DATA_ROOT, { recursive: true });
  await mkdir(resolve(DATA_ROOT, "cepheid-catalogs"), { recursive: true });
  await mkdir(resolve(DATA_ROOT, "spectra"), { recursive: true });
  await mkdir(resolve(DATA_ROOT, "lightcurves"), { recursive: true });

  // 1. Galaxies meta
  const galaxiesPath = resolve(DATA_ROOT, "galaxies.json");
  if (FORCE || !(await exists(galaxiesPath))) {
    await writeFile(galaxiesPath, JSON.stringify(CURATED_GALAXIES, null, 2));
    console.log(`Wrote ${galaxiesPath}`);
  }

  // 2. Cepheid catalogues
  for (const g of CURATED_GALAXIES) {
    if (!g.capabilities.cepheidPL) continue;
    const out = resolve(DATA_ROOT, "cepheid-catalogs", `${g.id}.json`);
    if (!FORCE && (await exists(out))) continue;
    try {
      const cepheids = await fetchCepheidsLive(g.id);
      await writeFile(out, JSON.stringify(cepheids, null, 2));
      console.log(`Wrote ${out} (${cepheids.length} Cepheids)`);
    } catch (e) {
      console.warn(`Skipped Cepheids for ${g.id}: ${(e as Error).message}`);
    }
  }

  // 3. Spectra. We accept the response only if it parses to a
  // reasonable number of (wavelength, flux) rows. Empty bodies and
  // HTML error pages get a sentinel `.empty` file so the runtime can
  // surface a clean "spectrum unavailable" state.
  for (const g of CURATED_GALAXIES) {
    if (!g.capabilities.sdssSpectrum || !g.sdssSpec) continue;
    const out = resolve(DATA_ROOT, "spectra", `${g.id}.csv`);
    const sentinel = resolve(DATA_ROOT, "spectra", `${g.id}.empty`);
    if (!FORCE) {
      // Skip galaxies we already have a non-empty CSV for — but force
      // a re-fetch on previously-empty (0-byte) files.
      if (await exists(out)) {
        const stat = await import("node:fs/promises").then((m) =>
          m.stat(out),
        );
        if (stat.size > 100) continue;
      } else if (await exists(sentinel)) {
        continue;
      }
    }
    try {
      const csv = await fetchSdssSpectrum(g.sdssSpec);
      const dataRows = csv
        .split(/\r?\n/)
        .filter((l) => /^\s*\d/.test(l)).length;
      if (
        csv.length < 200 ||
        /<html|<body/i.test(csv) ||
        dataRows < 50
      ) {
        // Empty / HTML / too-few-rows: write the sentinel and warn.
        await writeFile(sentinel, "");
        // Remove a previous bad CSV if present.
        try {
          const fs = await import("node:fs/promises");
          await fs.unlink(out);
        } catch {
          /* ok */
        }
        console.warn(
          `No usable spectrum at plate=${g.sdssSpec.plate} mjd=${g.sdssSpec.mjd} fiber=${g.sdssSpec.fiber} for ${g.id} (${dataRows} rows). Wrote ${sentinel}.`,
        );
        continue;
      }
      await writeFile(out, csv);
      console.log(`Wrote ${out} (${dataRows} rows)`);
    } catch (e) {
      console.warn(`Skipped spectrum for ${g.id}: ${(e as Error).message}`);
    }
  }

  // 4. Light curves (synthesised — see file header note).
  for (const g of CURATED_GALAXIES) {
    if (!g.capabilities.lightCurves) continue;
    const out = resolve(DATA_ROOT, "lightcurves", `${g.id}.json`);
    if (!FORCE && (await exists(out))) continue;
    const curves = synthesiseLightCurves(g.id);
    await writeFile(out, JSON.stringify(curves, null, 2));
    console.log(`Wrote ${out} (${curves.length} synthesised Cepheid curves)`);
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// =============================================================
//  VizieR SH0ES fetch
// =============================================================

const SHOES_GAL: Record<string, string> = {
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
  ngc4258: "N4258",
};

async function fetchCepheidsLive(galaxyId: string): Promise<Cepheid[]> {
  const galCode = SHOES_GAL[galaxyId];
  if (!galCode) return [];
  // VizieR's ADQL parser rejects TRIM() inside WHERE clauses on this
  // table, but LIKE 'N5584%' works fine — and the "Gal" column is
  // always padded with trailing spaces, so the prefix match is exact.
  const adql = `SELECT "Gal", "RAJ2000", "DEJ2000", "ID", "Per", "V-I", "F160W", "sigTot"
FROM "J/ApJ/826/56/table4"
WHERE "Gal" LIKE '${galCode}%'`;
  const csv = await runAdql(adql);
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

async function runAdql(adql: string): Promise<string> {
  const params = new URLSearchParams({
    REQUEST: "doQuery",
    LANG: "ADQL",
    FORMAT: "csv",
    QUERY: adql,
  });
  const res = await fetch(TAP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsv(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsv(lines[i]).map((c) => c.replace(/^"|"$/g, ""));
    if (cells.length < headers.length) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cells[j] ?? "";
    rows.push(row);
  }
  return rows;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
    } else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function num(s: string | undefined): number | null {
  if (s == null || s === "" || s.toLowerCase() === "nan") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

// =============================================================
//  SDSS DR17 spectrum fetch
// =============================================================

async function fetchSdssSpectrum(p: SdssSpectrumPointer): Promise<string> {
  const url = `https://dr17.sdss.org/optical/spectrum/view/data/format=csv/spec=lite?plateid=${p.plate}&mjd=${p.mjd}&fiberid=${p.fiber}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SDSS HTTP ${res.status}`);
  const text = await res.text();
  // SDSS CSV has many columns; we only need wavelength + flux.
  // Reduce to a 2-column "wavelength,flux" file.
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return "";
  const header = splitCsv(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const iW = header.findIndex((h) => /wavelength/i.test(h));
  const iF = header.findIndex((h) => /^flux$/i.test(h)) >= 0
    ? header.findIndex((h) => /^flux$/i.test(h))
    : header.findIndex((h) => /flux/i.test(h));
  if (iW < 0 || iF < 0) {
    // Save raw response for inspection.
    return text;
  }
  const reduced: string[] = ["wavelength,flux"];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsv(lines[i]).map((c) => c.replace(/^"|"$/g, ""));
    if (cells.length <= Math.max(iW, iF)) continue;
    const w = num(cells[iW]);
    const f = num(cells[iF]);
    if (w == null || f == null) continue;
    reduced.push(`${w},${f}`);
  }
  return reduced.join("\n");
}

// =============================================================
//  Synthesised Cepheid light curves (Local Group placeholder)
// =============================================================

const LOCAL_GROUP_LCS: Record<
  string,
  { id: string; period: number; meanMag: number }[]
> = {
  lmc: [
    { id: "OGLE-LMC-CEP-0227", period: 3.797, meanMag: 14.34 },
    { id: "OGLE-LMC-CEP-0974", period: 5.413, meanMag: 13.73 },
    { id: "OGLE-LMC-CEP-1718", period: 16.661, meanMag: 12.43 },
    { id: "HV 2274", period: 39.281, meanMag: 12.05 },
  ],
  smc: [
    { id: "OGLE-SMC-CEP-0966", period: 3.85, meanMag: 14.92 },
    { id: "OGLE-SMC-CEP-2532", period: 11.8, meanMag: 13.77 },
    { id: "HV 1500", period: 19.96, meanMag: 13.54 },
  ],
  m31: [
    { id: "M31-V1", period: 31.42, meanMag: 19.45 },
    { id: "M31-V2", period: 22.34, meanMag: 19.78 },
    { id: "M31-V3", period: 12.6, meanMag: 20.22 },
  ],
  m33: [
    { id: "M33-V1", period: 30.0, meanMag: 19.68 },
    { id: "M33-V2", period: 14.6, meanMag: 20.51 },
  ],
};

// Synthesise a realistic-ish Cepheid light curve. Cepheid pulsation
// shape is asymmetric: rapid rise to max brightness, slower decline.
// We model it as sin(2π·phase) plus a phase-shifted skew term, noise
// of ~0.05 mag, and ~80 sample epochs spread over ~1000 nights.
function synthesiseLightCurves(galaxyId: string): CepheidLightCurve[] {
  const list = LOCAL_GROUP_LCS[galaxyId];
  if (!list) return [];
  const baseJd = 2_455_000;
  const out: CepheidLightCurve[] = [];
  for (const c of list) {
    const points: PhotometryPoint[] = [];
    const rng = mulberry32(hashStr(c.id));
    const N = 80;
    const span = 1000;
    for (let i = 0; i < N; i++) {
      const t = rng() * span;
      const phase = ((t / c.period) % 1 + 1) % 1;
      // Asymmetric Cepheid shape: cosine + a skewed bump.
      const lc =
        -Math.cos(2 * Math.PI * phase) +
        0.3 * Math.cos(4 * Math.PI * phase + 0.4);
      const noise = (rng() - 0.5) * 0.08;
      points.push({
        jd: +(baseJd + t).toFixed(4),
        mag: +(c.meanMag + 0.4 * lc + noise).toFixed(3),
        err: 0.04,
      });
    }
    out.push({
      cepheidId: c.id,
      band: "V",
      points,
      truePeriodDays: c.period,
      trueMeanMag: c.meanMag,
    });
  }
  return out;
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
