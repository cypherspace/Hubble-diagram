import type { CepheidLightCurve } from "../types";

const CACHE = new Map<string, CepheidLightCurve[]>();

export async function loadLightCurves(
  galaxyId: string,
  signal?: AbortSignal,
): Promise<CepheidLightCurve[]> {
  if (CACHE.has(galaxyId)) return CACHE.get(galaxyId)!;
  const r = await fetch(`./data/lightcurves/${galaxyId}.json`, { signal });
  if (!r.ok) {
    throw new Error(
      `Light-curve bundle for ${galaxyId} hasn't been built yet — run \`npm run build:data\`.`,
    );
  }
  const json = (await r.json()) as CepheidLightCurve[];
  CACHE.set(galaxyId, json);
  return json;
}
