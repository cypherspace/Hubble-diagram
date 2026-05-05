import { describe, expect, it } from "vitest";
import {
  angularDistanceDeg,
  cf3MethodLabel,
  mergeByPosition,
  type SearchedGalaxy,
} from "./galaxySearch";

describe("Cosmicflows-3 method codes", () => {
  it("maps single-letter codes to method names", () => {
    expect(cf3MethodLabel("C")).toMatch(/Cepheid/);
    expect(cf3MethodLabel("T")).toMatch(/red giant/);
    expect(cf3MethodLabel("S")).toMatch(/Surface-brightness/);
    expect(cf3MethodLabel("L")).toMatch(/Tully/);
    expect(cf3MethodLabel("F")).toMatch(/Fundamental/);
    expect(cf3MethodLabel("N")).toMatch(/supernova/);
  });
  it("falls back to a generic label for unknown or empty codes", () => {
    expect(cf3MethodLabel(undefined)).toMatch(/Cosmicflows-3/);
    expect(cf3MethodLabel("")).toMatch(/Cosmicflows-3/);
    expect(cf3MethodLabel("Z")).toMatch(/Cosmicflows-3/);
  });
  it("only inspects the first character of multi-letter codes", () => {
    // CF3 sometimes lists composite methods like "CT" — the leading
    // character is the primary method.
    expect(cf3MethodLabel("CT")).toMatch(/Cepheid/);
    expect(cf3MethodLabel("TC")).toMatch(/red giant/);
  });
});

describe("angular distance helper", () => {
  it("returns ~0 for identical sky positions", () => {
    expect(angularDistanceDeg(180, 0, 180, 0)).toBeLessThan(1e-9);
  });
  it("recovers a 1-arcsecond offset along declination", () => {
    const oneArcsec = 1 / 3600;
    const d = angularDistanceDeg(45, 10, 45, 10 + oneArcsec);
    expect(d).toBeCloseTo(oneArcsec, 6);
  });
  it("compresses RA distance by cos(dec) at high latitudes", () => {
    // 1° of RA at dec = 60° corresponds to 0.5° of great-circle arc.
    const d = angularDistanceDeg(0, 60, 1, 60);
    expect(d).toBeGreaterThan(0.45);
    expect(d).toBeLessThan(0.55);
  });
});

function row(
  partial: Partial<SearchedGalaxy> & { ra: number; dec: number; source: SearchedGalaxy["source"] },
): SearchedGalaxy {
  return {
    catalogId: partial.catalogId ?? "x",
    z: partial.z ?? 0.01,
    vRecKmS: partial.vRecKmS ?? 3000,
    distanceMpc: partial.distanceMpc ?? 40,
    distanceTag: partial.distanceTag ?? "direct",
    distanceMethodLabel: partial.distanceMethodLabel ?? "test",
    ...partial,
  } as SearchedGalaxy;
}

describe("mergeByPosition", () => {
  it("preserves CF3 priority when SDSS reports the same galaxy", () => {
    const cf3 = [row({ source: "cf3", catalogId: "M81", ra: 148.888, dec: 69.065 })];
    const sdss = [row({ source: "sdss", catalogId: "abc", ra: 148.888, dec: 69.065, distanceTag: "extrapolated" })];
    const merged = mergeByPosition(cf3, sdss);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("cf3");
    expect(merged[0].distanceTag).toBe("direct");
  });
  it("keeps a row that's farther than the dedup tolerance away", () => {
    // 30 arcseconds — well outside the 5 arcsec tolerance.
    const cf3 = [row({ source: "cf3", ra: 100.0, dec: 20.0 })];
    const sdss = [row({ source: "sdss", ra: 100.0, dec: 20.0 + 30 / 3600 })];
    const merged = mergeByPosition(cf3, sdss);
    expect(merged).toHaveLength(2);
  });
  it("drops a near-duplicate within the dedup tolerance", () => {
    // 1 arcsecond — well within the 5 arcsec tolerance.
    const cf3 = [row({ source: "cf3", ra: 200.0, dec: 0.0 })];
    const sdss = [row({ source: "sdss", ra: 200.0, dec: 0.0 + 1 / 3600 })];
    const merged = mergeByPosition(cf3, sdss);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("cf3");
  });
  it("returns extra unchanged when existing is empty", () => {
    const merged = mergeByPosition(
      [],
      [row({ source: "2mrs", ra: 10, dec: 10 })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("2mrs");
  });
});
