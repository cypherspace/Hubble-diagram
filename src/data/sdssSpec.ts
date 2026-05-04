// Live SDSS spectrum resolver. The Tempel et al. 2021 galaxy catalog
// (J/A+A/648/A122) — which we use for the "Search SDSS" feature —
// exposes the SDSS objID but not the (plate, mjd, fiber) triple our
// SpectrumPanel needs to download a spec-lite CSV. This module bridges
// that gap at runtime:
//
//   1. lookupSdssSpec(objId) hits SDSS SkyServer's REST API to find
//      the SpecObj row matching that bestObjID, returning plate /
//      mjd / fiber.
//   2. fetchSdssSpectrumCsv(plate, mjd, fiber) hits the dr17.sdss.org
//      "spec=lite" CSV endpoint to download wavelength/flux pairs.
//
// Both calls are cached in-memory by id so repeated panel opens for
// the same galaxy don't re-hit SDSS.
//
// CORS:
//   - SkyServer's `SqlSearch` endpoint serves CORS headers — confirmed
//     reachable from the browser during item 8 implementation.
//   - dr17.sdss.org's spec-lite CSV endpoint does NOT serve CORS
//     headers AND is slow (10-15 seconds for a single galaxy). We
//     route those requests through the public CORS proxy
//     `corsproxy.io` as an interim bridge. The plan's documented
//     production fix is a small Firebase Function under `functions/`
//     that proxies dr17.sdss.org from the same Firebase project; the
//     code below picks the Function URL automatically once it's
//     deployed (see SDSS_PROXY_BASE).

import type { SdssSpectrumPointer, SpectrumPoint } from "../types";
import { parseSpectrumCsv } from "./spectra";

const POINTER_CACHE = new Map<string, SdssSpectrumPointer | null>();
const SPECTRUM_CACHE = new Map<string, SpectrumPoint[]>();

// CORS bridge for the dr17 spec-lite CSV endpoint. When a Firebase
// Function under `functions/sdssSpec` is deployed, point this at it
// (e.g. "https://us-central1-mrwoodphysics-hubble.cloudfunctions.net/sdssSpec?url=").
// Until then, fall back to corsproxy.io.
const SDSS_PROXY_BASE = "https://corsproxy.io/?";

/**
 * Resolve an SDSS bestObjID (the integer ID Tempel+ 2021 hands us)
 * to a (plate, mjd, fiber) pointer. Returns `null` if SkyServer has
 * no spectroscopic record for the object.
 */
export async function lookupSdssSpec(
  objId: string,
  signal?: AbortSignal,
): Promise<SdssSpectrumPointer | null> {
  if (POINTER_CACHE.has(objId)) return POINTER_CACHE.get(objId)!;
  const sql = `SELECT TOP 1 plate, mjd, fiberID FROM SpecObj WHERE bestObjID = ${objId}`;
  const url =
    "https://skyserver.sdss.org/dr17/SkyServerWS/SearchTools/SqlSearch?" +
    new URLSearchParams({ cmd: sql, format: "csv" }).toString();
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch {
    POINTER_CACHE.set(objId, null);
    return null;
  }
  if (!res.ok) {
    POINTER_CACHE.set(objId, null);
    return null;
  }
  const text = await res.text();
  // SkyServer SQL response format:
  //   #Table1
  //   plate,mjd,fiberID
  //   1605,53062,451
  const lines = text.split(/\r?\n/);
  let dataLine = "";
  for (const line of lines) {
    const trim = line.trim();
    if (!trim || trim.startsWith("#") || /[a-z]/i.test(trim[0] ?? "")) continue;
    dataLine = trim;
    break;
  }
  if (!dataLine) {
    POINTER_CACHE.set(objId, null);
    return null;
  }
  const parts = dataLine.split(",");
  if (parts.length < 3) {
    POINTER_CACHE.set(objId, null);
    return null;
  }
  const plate = Number(parts[0]);
  const mjd = Number(parts[1]);
  const fiber = Number(parts[2]);
  if (!Number.isFinite(plate) || !Number.isFinite(mjd) || !Number.isFinite(fiber)) {
    POINTER_CACHE.set(objId, null);
    return null;
  }
  const pointer: SdssSpectrumPointer = { plate, mjd, fiber };
  POINTER_CACHE.set(objId, pointer);
  return pointer;
}

/**
 * Fetch a spec-lite CSV from dr17.sdss.org, parse to SpectrumPoints.
 * Throws if the CSV is empty / unparseable (the SpectrumPanel
 * already knows how to render that as "spectrum unavailable").
 */
export async function fetchSdssSpectrumCsv(
  pointer: SdssSpectrumPointer,
  signal?: AbortSignal,
): Promise<SpectrumPoint[]> {
  const key = `${pointer.plate}-${pointer.mjd}-${pointer.fiber}`;
  if (SPECTRUM_CACHE.has(key)) return SPECTRUM_CACHE.get(key)!;
  const target =
    `https://dr17.sdss.org/optical/spectrum/view/data/format=csv/spec=lite` +
    `?plateid=${pointer.plate}&mjd=${pointer.mjd}&fiberid=${pointer.fiber}`;
  const url = SDSS_PROXY_BASE + encodeURIComponent(target);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`SDSS spec-lite returned HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text || /<html|<body/i.test(text) || text.length < 200) {
    throw new Error("SDSS returned an empty or invalid spectrum.");
  }
  const points = parseSpectrumCsv(text);
  if (points.length < 50) {
    throw new Error("SDSS spectrum has too few rows to plot.");
  }
  SPECTRUM_CACHE.set(key, points);
  return points;
}

/**
 * One-shot helper: given an SDSS objID, look up its spec pointer
 * then fetch the spectrum points. Returns null if no spectrum
 * exists for that objID.
 */
export async function loadLiveSdssSpectrum(
  objId: string,
  signal?: AbortSignal,
): Promise<SpectrumPoint[] | null> {
  const pointer = await lookupSdssSpec(objId, signal);
  if (!pointer) return null;
  return fetchSdssSpectrumCsv(pointer, signal);
}
