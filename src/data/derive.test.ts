import { describe, expect, it } from "vitest";
import {
  C_KM_S,
  PL_CALIBRATIONS,
  absoluteMagnitudeFromPeriod,
  distanceFromMagnitudes,
  distanceMpcFromCepheid,
  fitHubbleSlope,
  foldLightCurve,
  meanMagFromFolded,
  redshiftFromWavelengths,
  redshiftToVelocity,
  redshiftToVelocityRelativistic,
  velocityToRedshift,
  suggestPeriod,
} from "./derive";

describe("PL relation", () => {
  it("absolute mag of a 10-day Cepheid equals the calibration intercept", () => {
    const M = absoluteMagnitudeFromPeriod(10, PL_CALIBRATIONS.nirF160W);
    expect(M).toBeCloseTo(PL_CALIBRATIONS.nirF160W.b, 6);
  });
  it("distance modulus inverse: m - M back to distance", () => {
    const M = -5;
    const m = M + 5; // d = 100 pc
    expect(distanceFromMagnitudes(m, M)).toBeCloseTo(100, 4);
  });
  it("end-to-end Cepheid distance for a 30-day Cepheid at apparent mag 25 (NIR cal)", () => {
    const d = distanceMpcFromCepheid(30, 25, PL_CALIBRATIONS.nirF160W);
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(60);
  });
});

describe("redshift / velocity conversions", () => {
  it("z from wavelengths", () => {
    expect(redshiftFromWavelengths(7000, 6562.8)).toBeCloseTo(0.0667, 3);
  });
  it("v = c·z low-z roundtrip", () => {
    const z = 0.05;
    expect(velocityToRedshift(redshiftToVelocity(z))).toBeCloseTo(z, 8);
  });
  it("relativistic Doppler is < c·z at non-trivial z", () => {
    const z = 0.5;
    expect(redshiftToVelocityRelativistic(z)).toBeLessThan(C_KM_S * z);
  });
});

describe("Hubble fit", () => {
  it("recovers a forced slope from clean synthetic data", () => {
    const points = Array.from({ length: 10 }, (_, i) => ({
      d: i + 1,
      v: 70 * (i + 1),
    }));
    const fit = fitHubbleSlope(points);
    expect(fit.h0).toBeCloseTo(70, 6);
    expect(fit.rms).toBeLessThan(1e-6);
  });
});

describe("light-curve folding", () => {
  it("folding at the true period puts identical-phase points adjacent", () => {
    // Sinusoid with period 5 days, sampled densely.
    const points = Array.from({ length: 100 }, (_, i) => {
      const jd = i * 0.3;
      return { jd, mag: 10 + Math.sin((2 * Math.PI * jd) / 5) };
    });
    const folded = foldLightCurve(points, 5);
    expect(folded.length).toBe(100);
    expect(folded[0].phase).toBeLessThanOrEqual(folded[1].phase);
  });
  it("median magnitude of a densely-sampled sinusoid is near its DC offset", () => {
    // Dense, near-uniform phase coverage — 1000 points across 200
    // periods. The median of a symmetric distribution converges to
    // its centre.
    const points = Array.from({ length: 1000 }, (_, i) => {
      const jd = (i * 7) / 5;
      return { jd, mag: 15 + Math.sin((2 * Math.PI * jd) / 7) };
    });
    const folded = foldLightCurve(points, 7);
    // Sinusoid median ≈ DC offset to within ~0.05 mag at this density.
    expect(Math.abs(meanMagFromFolded(folded) - 15)).toBeLessThan(0.05);
  });
  it("suggestPeriod recovers a 5-day period to within 0.1 days", () => {
    const period = 5;
    const points = Array.from({ length: 60 }, () => {
      const jd = Math.random() * 200;
      return { jd, mag: 14 + Math.sin((2 * Math.PI * jd) / period) };
    });
    const found = suggestPeriod(points, 1, 20, 0.05);
    // Period-finding on noisy data is approximate — within 5%.
    expect(Math.abs(found - period) / period).toBeLessThan(0.1);
  });
});
