import type { SpectrumPoint } from "../types";

// Loads a pre-fetched SDSS DR17 spec-lite CSV from Firebase Hosting.
// The build-data script writes these as 2-column CSV (wavelength,flux)
// to public/data/spectra/{galaxyId}.csv. When SDSS doesn't have a
// spectrum at the catalogued (plate, mjd, fiber) — or it returns an
// HTML error / empty body — the build-data script writes a sentinel
// `{galaxyId}.empty` file instead, and we surface a clear "no
// spectrum" error here.

const CACHE = new Map<string, SpectrumPoint[]>();

export class SpectrumUnavailableError extends Error {
  constructor(public readonly galaxyId: string) {
    super(
      `No SDSS spectrum is available for ${galaxyId}. ` +
        `This galaxy's redshift was set from a different source.`,
    );
    this.name = "SpectrumUnavailableError";
  }
}

export async function loadSpectrum(
  galaxyId: string,
  signal?: AbortSignal,
): Promise<SpectrumPoint[]> {
  if (CACHE.has(galaxyId)) return CACHE.get(galaxyId)!;

  // Sentinel file from the build-data script — fast-path "no data".
  const sentinel = await fetch(`./data/spectra/${galaxyId}.empty`, {
    signal,
    method: "HEAD",
  }).catch(() => undefined);
  if (sentinel?.ok) throw new SpectrumUnavailableError(galaxyId);

  const r = await fetch(`./data/spectra/${galaxyId}.csv`, { signal });
  if (!r.ok) {
    throw new SpectrumUnavailableError(galaxyId);
  }
  const text = await r.text();
  const points = parseSpectrumCsv(text);
  if (points.length < 50) {
    // CSV existed but is empty / corrupt. Treat as unavailable.
    throw new SpectrumUnavailableError(galaxyId);
  }
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
