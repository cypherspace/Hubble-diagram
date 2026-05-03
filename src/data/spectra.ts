import type { SpectrumPoint } from "../types";

// Loads a pre-fetched SDSS DR17 spec-lite CSV from Firebase Hosting.
// The build-data script writes these as 2-column CSV (wavelength,flux)
// to public/data/spectra/{galaxyId}.csv. The same on-disk format also
// makes it trivial to bundle additional spectra later.

const CACHE = new Map<string, SpectrumPoint[]>();

export async function loadSpectrum(
  galaxyId: string,
  signal?: AbortSignal,
): Promise<SpectrumPoint[]> {
  if (CACHE.has(galaxyId)) return CACHE.get(galaxyId)!;
  const r = await fetch(`./data/spectra/${galaxyId}.csv`, { signal });
  if (!r.ok) {
    throw new Error(
      `Spectrum for ${galaxyId} hasn't been fetched yet — run \`npm run build:data\`.`,
    );
  }
  const text = await r.text();
  const points = parseSpectrumCsv(text);
  CACHE.set(galaxyId, points);
  return points;
}

export function parseSpectrumCsv(text: string): SpectrumPoint[] {
  const out: SpectrumPoint[] = [];
  const lines = text.split(/\r?\n/);
  // Skip header if present.
  let start = 0;
  if (lines[0] && /[a-z]/i.test(lines[0])) start = 1;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 2) continue;
    const w = Number(parts[0]);
    const f = Number(parts[1]);
    if (Number.isFinite(w) && Number.isFinite(f)) {
      out.push({ wavelengthAngstroms: w, flux: f });
    }
  }
  return out;
}
