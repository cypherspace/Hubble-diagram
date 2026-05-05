import type { DistanceTag, Galaxy } from "../types";
import { C_KM_S } from "./derive";

// Curated galaxy seed list. Every entry was checked for visibility on
// DSS2 / PanSTARRS imagery (Aladin Lite renders them as recognisable
// objects, even if just a faint smudge for the deep-field galaxies).
//
// Distance / redshift values are rounded "textbook" numbers from
// well-known references (NED, Wikipedia infoboxes for named galaxies,
// SH0ES papers for the Cepheid hosts, original WFPC2/ACS source
// catalogs for the deep-field picks). The whole point is for students
// to reproduce these numbers themselves with the in-app derivations,
// so we don't claim higher precision than they could measure.
//
// vRecKmS is pre-computed as c·z. We allow negative values for
// blueshifted Local Group galaxies — those are real and pedagogically
// important.

function v(z: number): number {
  return +(C_KM_S * z).toFixed(0);
}

const noCaps = { cepheidPL: false, lightCurves: false, sdssSpectrum: false };

// IDs whose curated distance is a redshift-derived value rather than an
// independent measurement. These plot as "extrapolated" and are excluded
// from the best-fit slope, since they always lie on a Hubble rail by
// construction. Everything else is "direct" (Cepheid PL, TRGB, SBF, SN Ia,
// fundamental plane, eclipsing binary, maser geometry, parallax).
const EXTRAPOLATED_IDS = new Set([
  "ngc7319",      // Stephan's Quintet — distance is z·c/H₀
  "ngc7317",      // Stephan's Quintet — distance is z·c/H₀
  "3c273",        // quasar — distance from cosmological redshift
  "mrk421",       // blazar — distance from cosmological redshift
  "hdfn_4_555",   // deep-field — distance from ΛCDM + spectroscopic z
  "hudf_z3",      // deep-field — distance from ΛCDM + spectroscopic z
]);

// Per-id method labels for galaxies whose distance came from a notable
// technique. Anything not listed falls back to a generic label keyed off
// the distance tag.
const METHOD_LABELS: Record<string, string> = {
  ngc4258: "VLBI water-maser geometry (gold-standard distance anchor)",
  m31: "Eclipsing-binary + Cepheid period–luminosity",
  m33: "Eclipsing-binary + Cepheid period–luminosity",
  lmc: "Eclipsing-binary + Cepheid period–luminosity",
  smc: "Eclipsing-binary + Cepheid period–luminosity",
  ic1613: "Cepheid period–luminosity (TRGB-cross-checked)",
  ngc6822: "Cepheid period–luminosity",
  m81: "Cepheid period–luminosity",
  m82: "TRGB (tip of the red giant branch)",
  centaurus_a: "TRGB (tip of the red giant branch)",
  m51: "Surface-brightness fluctuations (SBF)",
  m104: "Surface-brightness fluctuations (SBF)",
  m87: "Surface-brightness fluctuations (SBF)",
  ngc891: "Tully-Fisher",
  ngc4565: "Tully-Fisher",
  ngc5907: "Tully-Fisher",
  ngc7320: "Tully-Fisher",
  ngc1068: "TRGB / Tully-Fisher composite",
  ngc1015: "Cepheid period–luminosity (SH0ES)",
  ngc1309: "Cepheid period–luminosity (SH0ES)",
  ngc1365: "Cepheid period–luminosity (SH0ES)",
  ngc3370: "Cepheid period–luminosity (SH0ES)",
  ngc3627: "Cepheid period–luminosity (SH0ES)",
  ngc4038: "Cepheid period–luminosity (SH0ES)",
  ngc4424: "Cepheid period–luminosity (SH0ES)",
  ngc4536: "Cepheid period–luminosity (SH0ES)",
  ngc4639: "Cepheid period–luminosity (SH0ES)",
  ngc5584: "Cepheid period–luminosity (SH0ES)",
  ngc7250: "Cepheid period–luminosity (SH0ES)",
  ugc9391: "Cepheid period–luminosity (SH0ES)",
  ngc7319: "Redshift × Hubble's law (Stephan's Quintet)",
  ngc7317: "Redshift × Hubble's law (Stephan's Quintet)",
  "3c273": "Redshift × cosmological model (quasar at z = 0.158)",
  mrk421: "Redshift × Hubble's law (blazar)",
  hdfn_4_555: "Redshift × ΛCDM cosmology (Hubble Deep Field North)",
  hudf_z3: "Redshift × ΛCDM cosmology (Hubble Ultra Deep Field)",
};

const DEFAULT_DIRECT_LABEL =
  "Redshift-independent (textbook value)";
const DEFAULT_EXTRAPOLATED_LABEL =
  "Redshift × Hubble's law (no direct measurement)";

type SeedGalaxy = Omit<Galaxy, "distanceTag" | "distanceMethodLabel">;

const CURATED_SEED: SeedGalaxy[] = [
  // ============================================================
  //  Local Group + nearby named galaxies (DSS2 obvious)
  // ============================================================
  {
    id: "lmc",
    name: "Large Magellanic Cloud",
    altNames: ["LMC", "ESO 56-115"],
    ra: 80.8939,
    dec: -69.7561,
    type: "irregular",
    distanceMpc: 0.0497,
    distanceMpcErr: 0.001,
    z: 0.000927,
    vRecKmS: v(0.000927),
    capabilities: { cepheidPL: false, lightCurves: true, sdssSpectrum: false },
    claimToFame:
      "A satellite galaxy of the Milky Way, visible to the naked eye from the southern hemisphere. Home to thousands of well-studied Cepheid variables.",
    wikipedia: "Large_Magellanic_Cloud",
    isAnomaly: true,
    anomalyExplanation:
      "Its motion is dominated by orbiting the Milky Way, not by the universe's expansion — so it doesn't sit on Hubble's law line.",
  },
  {
    id: "smc",
    name: "Small Magellanic Cloud",
    altNames: ["SMC", "NGC 292"],
    ra: 13.1583,
    dec: -72.8003,
    type: "irregular",
    distanceMpc: 0.0617,
    distanceMpcErr: 0.0014,
    z: 0.000527,
    vRecKmS: v(0.000527),
    capabilities: { cepheidPL: false, lightCurves: true, sdssSpectrum: false },
    claimToFame:
      "The other naked-eye Magellanic galaxy. Henrietta Leavitt discovered the period–luminosity relation by studying Cepheids in this very galaxy.",
    wikipedia: "Small_Magellanic_Cloud",
    isAnomaly: true,
    anomalyExplanation:
      "Like the LMC, the SMC is bound to the Milky Way — its velocity is gravitational, not cosmological.",
  },
  {
    id: "m31",
    name: "Andromeda",
    altNames: ["M31", "NGC 224"],
    ra: 10.6847,
    dec: 41.2687,
    type: "spiral",
    distanceMpc: 0.778,
    distanceMpcErr: 0.044,
    z: -0.001,
    vRecKmS: -300,
    capabilities: { cepheidPL: false, lightCurves: true, sdssSpectrum: false },
    claimToFame:
      "The nearest large spiral galaxy, and the most distant thing visible to the naked eye. It's heading toward the Milky Way for a collision in ~4 billion years.",
    wikipedia: "Andromeda_Galaxy",
    isAnomaly: true,
    anomalyExplanation:
      "Andromeda is blueshifted (moving toward us!) — its gravitational attraction with the Milky Way overwhelms cosmological expansion at this distance.",
  },
  {
    id: "m33",
    name: "Triangulum",
    altNames: ["M33", "NGC 598"],
    ra: 23.4621,
    dec: 30.6602,
    type: "spiral",
    distanceMpc: 0.86,
    distanceMpcErr: 0.04,
    z: -0.0006,
    vRecKmS: -179,
    capabilities: { cepheidPL: false, lightCurves: true, sdssSpectrum: false },
    claimToFame:
      "The third-largest galaxy in the Local Group. Slightly blueshifted because, like Andromeda, it's gravitationally bound to our neighbourhood.",
    wikipedia: "Triangulum_Galaxy",
    isAnomaly: true,
    anomalyExplanation:
      "Local Group member — its motion is set by gravity within the group, not by Hubble flow.",
  },
  {
    id: "ic1613",
    name: "IC 1613",
    altNames: ["DDO 8"],
    ra: 16.1992,
    dec: 2.1175,
    type: "dwarf",
    distanceMpc: 0.755,
    distanceMpcErr: 0.025,
    z: -0.000777,
    vRecKmS: -233,
    capabilities: { ...noCaps },
    claimToFame:
      "A faint dwarf galaxy in the Local Group, used to calibrate the Cepheid distance scale because it's nearly free of dust.",
    wikipedia: "IC_1613",
  },
  {
    id: "ngc6822",
    name: "Barnard's Galaxy",
    altNames: ["NGC 6822", "IC 4895"],
    ra: 296.2358,
    dec: -14.8056,
    type: "irregular",
    distanceMpc: 0.5,
    distanceMpcErr: 0.025,
    z: -0.000193,
    vRecKmS: -57,
    capabilities: { ...noCaps },
    claimToFame:
      "A Local Group dwarf irregular discovered by E. E. Barnard in 1884.",
    wikipedia: "Barnard%27s_Galaxy",
  },

  // ============================================================
  //  Famous bright galaxies, beyond the Local Group
  // ============================================================
  {
    id: "m81",
    name: "Bode's Galaxy",
    altNames: ["M81", "NGC 3031"],
    ra: 148.8882,
    dec: 69.0653,
    type: "spiral",
    distanceMpc: 3.63,
    distanceMpcErr: 0.34,
    z: -0.000113,
    vRecKmS: -34,
    capabilities: { ...noCaps },
    claimToFame:
      "A grand-design spiral in Ursa Major, slightly blueshifted because the M81 group is falling toward the Local Group.",
    wikipedia: "Messier_81",
    isAnomaly: true,
    anomalyExplanation:
      "Even though M81 is millions of parsecs away, local gravitational pull still beats Hubble flow.",
  },
  {
    id: "m82",
    name: "Cigar Galaxy",
    altNames: ["M82", "NGC 3034"],
    ra: 148.9685,
    dec: 69.6797,
    type: "irregular",
    distanceMpc: 3.53,
    distanceMpcErr: 0.26,
    z: 0.000677,
    vRecKmS: v(0.000677),
    capabilities: { ...noCaps },
    claimToFame:
      "A starburst galaxy. Tidal interactions with M81 have triggered a torrent of star formation in its core.",
    wikipedia: "Messier_82",
  },
  {
    id: "centaurus_a",
    name: "Centaurus A",
    altNames: ["NGC 5128"],
    ra: 201.3651,
    dec: -43.0191,
    type: "elliptical",
    distanceMpc: 3.8,
    distanceMpcErr: 0.1,
    z: 0.001825,
    vRecKmS: v(0.001825),
    capabilities: { ...noCaps },
    claimToFame:
      "A peculiar elliptical with a dramatic dust lane — the result of a recent merger with a smaller spiral. Hosts a supermassive black hole.",
    wikipedia: "Centaurus_A",
  },
  {
    id: "m51",
    name: "Whirlpool Galaxy",
    altNames: ["M51", "NGC 5194"],
    ra: 202.4696,
    dec: 47.1952,
    type: "spiral",
    distanceMpc: 8.58,
    distanceMpcErr: 0.1,
    z: 0.001544,
    vRecKmS: v(0.001544),
    capabilities: { cepheidPL: false, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 6790, mjd: 56430, fiber: 184 },
    claimToFame:
      "A face-on grand-design spiral interacting with its smaller companion NGC 5195. The first galaxy ever recognised as a spiral (Lord Rosse, 1845).",
    wikipedia: "Whirlpool_Galaxy",
  },
  {
    id: "m104",
    name: "Sombrero Galaxy",
    altNames: ["M104", "NGC 4594"],
    ra: 189.9976,
    dec: -11.6231,
    type: "spiral",
    distanceMpc: 9.55,
    distanceMpcErr: 0.13,
    z: 0.003416,
    vRecKmS: v(0.003416),
    capabilities: { ...noCaps },
    claimToFame:
      "Edge-on spiral with a vast halo and a striking dust lane. Bright bulge dominated by old stars.",
    wikipedia: "Sombrero_Galaxy",
  },
  {
    id: "m87",
    name: "M87",
    altNames: ["NGC 4486", "Virgo A"],
    ra: 187.7059,
    dec: 12.3911,
    type: "elliptical",
    distanceMpc: 16.4,
    distanceMpcErr: 0.5,
    z: 0.004283,
    vRecKmS: v(0.004283),
    capabilities: { cepheidPL: false, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 1693, mjd: 53446, fiber: 280 },
    claimToFame:
      "A giant elliptical at the heart of the Virgo Cluster. Its supermassive black hole was the first to be directly imaged (Event Horizon Telescope, 2019).",
    wikipedia: "Messier_87",
  },
  {
    id: "ngc4258",
    name: "NGC 4258",
    altNames: ["M106"],
    ra: 184.7396,
    dec: 47.3038,
    type: "spiral",
    distanceMpc: 7.58,
    distanceMpcErr: 0.11,
    z: 0.00149,
    vRecKmS: v(0.00149),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 6671, mjd: 56388, fiber: 110 },
    claimToFame:
      "A maser galaxy with a precisely measured geometric distance. The whole Cepheid distance ladder is anchored against this one number.",
    wikipedia: "Messier_106",
  },

  // ============================================================
  //  SH0ES Cepheid hosts — Riess+ 2016 (J/ApJ/826/56)
  // ============================================================
  {
    id: "ngc1015",
    name: "NGC 1015",
    altNames: ["UGC 2129"],
    ra: 39.55175,
    dec: -1.31889,
    type: "barred-spiral",
    distanceMpc: 32.2,
    distanceMpcErr: 1.4,
    z: 0.008767,
    vRecKmS: v(0.008767),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 425, mjd: 51898, fiber: 449 },
    claimToFame:
      "A barred spiral with measured Cepheids. A bright supernova exploded here in 2009, helping astronomers calibrate the distance scale.",
    wikipedia: "NGC_1015",
  },
  {
    id: "ngc1309",
    name: "NGC 1309",
    altNames: ["UGCA 048"],
    ra: 50.5273,
    dec: -15.3999,
    type: "spiral",
    distanceMpc: 33.5,
    distanceMpcErr: 1.1,
    z: 0.007125,
    vRecKmS: v(0.007125),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: false },
    claimToFame:
      "A face-on spiral that hosted a well-observed Type Ia supernova (a kind of exploding white dwarf star) in 2002.",
    wikipedia: "NGC_1309",
  },
  {
    id: "ngc1365",
    name: "NGC 1365",
    altNames: ["Great Barred Spiral"],
    ra: 53.4015,
    dec: -36.1404,
    type: "barred-spiral",
    distanceMpc: 17.95,
    distanceMpcErr: 0.6,
    z: 0.005457,
    vRecKmS: v(0.005457),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: false },
    claimToFame:
      "A textbook barred spiral with a brightly-feeding black hole at its centre. A 2012 supernova here helped calibrate the distance scale.",
    wikipedia: "NGC_1365",
  },
  {
    id: "ngc3370",
    name: "NGC 3370",
    altNames: ["UGC 5887"],
    ra: 161.7679,
    dec: 17.2741,
    type: "spiral",
    distanceMpc: 26.5,
    distanceMpcErr: 1.0,
    z: 0.004266,
    vRecKmS: v(0.004266),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 1742, mjd: 53053, fiber: 491 },
    claimToFame:
      "A spiral galaxy where the Hubble Space Telescope measured Cepheids. A 1994 supernova here helps tie the distance scale together.",
    wikipedia: "NGC_3370",
  },
  {
    id: "ngc3627",
    name: "NGC 3627",
    altNames: ["M66"],
    ra: 170.0625,
    dec: 12.9914,
    type: "barred-spiral",
    distanceMpc: 11.3,
    distanceMpcErr: 0.6,
    z: 0.002425,
    vRecKmS: v(0.002425),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 1605, mjd: 53062, fiber: 451 },
    claimToFame:
      "A member of the Leo Triplet, a famous group of three nearby galaxies. Astronomers used both its Cepheids and a 1989 supernova to measure its distance.",
    wikipedia: "Messier_66",
  },
  {
    id: "ngc4038",
    name: "Antennae Galaxies",
    altNames: ["NGC 4038", "Arp 244"],
    ra: 180.4719,
    dec: -18.8678,
    type: "merger",
    distanceMpc: 22.0,
    distanceMpcErr: 1.4,
    z: 0.005477,
    vRecKmS: v(0.005477),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: false },
    claimToFame:
      "A pair of colliding spirals throwing out long tidal tails. A 2007 supernova here gave astronomers another rung on the distance ladder.",
    wikipedia: "Antennae_Galaxies",
  },
  {
    id: "ngc4424",
    name: "NGC 4424",
    altNames: ["UGC 7561"],
    ra: 186.7983,
    dec: 9.4203,
    type: "spiral",
    distanceMpc: 16.4,
    distanceMpcErr: 1.3,
    z: 0.001463,
    vRecKmS: v(0.001463),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 1615, mjd: 53166, fiber: 538 },
    claimToFame:
      "A peculiar spiral whose shape has been disturbed by gravity from neighbouring galaxies in the Virgo Cluster. A 2012 supernova here was used in distance calibration.",
    wikipedia: "NGC_4424",
  },
  {
    id: "ngc4536",
    name: "NGC 4536",
    altNames: ["UGC 7732"],
    ra: 188.6128,
    dec: 2.1881,
    type: "barred-spiral",
    distanceMpc: 14.9,
    distanceMpcErr: 0.4,
    z: 0.006031,
    vRecKmS: v(0.006031),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 287, mjd: 52023, fiber: 510 },
    claimToFame:
      "A starburst barred spiral on the outskirts of the Virgo Cluster, where stars are forming furiously. A 1981 supernova here helps tie the distance scale.",
    wikipedia: "NGC_4536",
  },
  {
    id: "ngc4639",
    name: "NGC 4639",
    altNames: ["UGC 7884"],
    ra: 190.7185,
    dec: 13.2573,
    type: "spiral",
    distanceMpc: 21.98,
    distanceMpcErr: 0.7,
    z: 0.003395,
    vRecKmS: v(0.003395),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 1616, mjd: 53169, fiber: 506 },
    claimToFame:
      "A Virgo Cluster spiral that hosted a 1990 supernova. One of the most distant galaxies in which the Hubble Space Telescope has resolved Cepheid stars.",
    wikipedia: "NGC_4639",
  },
  {
    id: "ngc5584",
    name: "NGC 5584",
    altNames: ["MCG -01-37-005"],
    ra: 215.5993,
    dec: -0.387,
    type: "spiral",
    distanceMpc: 22.5,
    distanceMpcErr: 0.5,
    z: 0.005464,
    vRecKmS: v(0.005464),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 327, mjd: 52294, fiber: 472 },
    claimToFame:
      "A galaxy where the Hubble Space Telescope measured over 250 Cepheid stars — used as a key calibration target for the cosmic distance ladder. A 2007 supernova here ties it to the wider universe.",
    wikipedia: "NGC_5584",
  },
  {
    id: "ngc7250",
    name: "NGC 7250",
    altNames: ["UGC 11980"],
    ra: 333.7396,
    dec: 40.5604,
    type: "irregular",
    distanceMpc: 20.0,
    distanceMpcErr: 1.0,
    z: 0.003851,
    vRecKmS: v(0.003851),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: false },
    claimToFame:
      "A peculiar barred spiral that hosted a 2013 supernova, used in the distance ladder.",
    wikipedia: "NGC_7250",
  },
  {
    id: "ugc9391",
    name: "UGC 9391",
    altNames: ["PGC 51344"],
    ra: 218.6537,
    dec: 59.3284,
    type: "spiral",
    distanceMpc: 50.7,
    distanceMpcErr: 1.7,
    z: 0.006383,
    vRecKmS: v(0.006383),
    capabilities: { cepheidPL: true, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 790, mjd: 52441, fiber: 403 },
    claimToFame:
      "One of the furthest galaxies in which the Hubble Space Telescope could resolve individual Cepheid stars — at the very edge of the Cepheid rung of the distance ladder.",
    wikipedia: "UGC_9391",
  },

  // ============================================================
  //  Hubble Deep Field galaxies (PanSTARRS / DSS visible)
  // ============================================================
  {
    id: "hdfn_4_555",
    name: "HDF-N 4-555.1",
    altNames: ["HDF-N J123649+621313"],
    ra: 189.20417,
    dec: 62.21972,
    type: "deep-field",
    distanceMpc: 1750,
    distanceMpcErr: 200,
    z: 0.475,
    vRecKmS: v(0.475),
    capabilities: { ...noCaps },
    claimToFame:
      "A spectroscopically-confirmed source from the original 1995 Hubble Deep Field North. At z ≈ 0.5 it's already showing relativistic effects.",
    isAnomaly: true,
    anomalyExplanation:
      "At this redshift the simple v = c·z formula starts to overestimate velocity — special relativity corrections matter.",
  },
  {
    id: "hudf_z3",
    name: "HUDF z=3 galaxy",
    altNames: ["HUDF-9-1"],
    ra: 53.1564,
    dec: -27.7733,
    type: "deep-field",
    distanceMpc: 6500,
    distanceMpcErr: 500,
    z: 3.0,
    vRecKmS: v(3.0),
    capabilities: { ...noCaps },
    claimToFame:
      "A high-redshift Lyman-break galaxy in the Hubble Ultra Deep Field. Its light has been travelling for over 11 billion years.",
    isAnomaly: true,
    anomalyExplanation:
      "Far beyond the regime where Hubble's law is linear — distance and velocity here come from a full cosmological model, not v = H₀·d.",
  },

  // ============================================================
  //  Anomalies — interesting on purpose
  // ============================================================
  {
    id: "ngc7320",
    name: "NGC 7320",
    altNames: ["Stephan's Quintet member"],
    ra: 339.0146,
    dec: 33.9489,
    type: "spiral",
    distanceMpc: 12.5,
    distanceMpcErr: 0.6,
    z: 0.0026,
    vRecKmS: v(0.0026),
    capabilities: { ...noCaps },
    claimToFame:
      "Appears to belong to Stephan's Quintet but its redshift is far smaller — it's a foreground galaxy projected onto the group by chance.",
    wikipedia: "NGC_7320",
    isAnomaly: true,
    anomalyExplanation:
      "Sky position can deceive! Other Quintet members sit at z ≈ 0.022 (nearly 10× further). NGC 7320 is just visually superimposed.",
  },
  {
    id: "3c273",
    name: "3C 273",
    altNames: ["PG 1226+023"],
    ra: 187.2779,
    dec: 2.0524,
    type: "quasar",
    distanceMpc: 749,
    distanceMpcErr: 50,
    z: 0.158339,
    vRecKmS: v(0.158339),
    capabilities: { cepheidPL: false, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 290, mjd: 51941, fiber: 218 },
    claimToFame:
      "The first quasar ever identified (1963). Bright as a 13th-magnitude star, but hundreds of megaparsecs away — the closest we have to a portable demonstration of cosmological redshift.",
    wikipedia: "3C_273",
    isAnomaly: true,
    anomalyExplanation:
      "Bright doesn't mean nearby — quasars are powered by supermassive black holes and can outshine entire galaxies from billions of light-years away.",
  },
  {
    id: "ngc1365_agn",
    name: "NGC 1068",
    altNames: ["M77"],
    ra: 40.6696,
    dec: -0.0133,
    type: "agn",
    distanceMpc: 14.4,
    distanceMpcErr: 0.7,
    z: 0.003793,
    vRecKmS: v(0.003793),
    capabilities: { cepheidPL: false, lightCurves: false, sdssSpectrum: true },
    sdssSpec: { plate: 421, mjd: 51821, fiber: 519 },
    claimToFame:
      "A nearby spiral with an actively-feeding supermassive black hole at its centre. Its bright emission lines make it an excellent practice target for redshift identification.",
    wikipedia: "Messier_77",
  },

  // ============================================================
  //  Edge-on spirals — pretty in the sky, useful as comparison points
  // ============================================================
  {
    id: "ngc891",
    name: "NGC 891",
    altNames: ["UGC 1831"],
    ra: 35.6392,
    dec: 42.3492,
    type: "spiral",
    distanceMpc: 9.8,
    distanceMpcErr: 0.5,
    z: 0.001761,
    vRecKmS: v(0.001761),
    capabilities: { ...noCaps },
    claimToFame:
      "A textbook edge-on spiral. Its dust lane cuts straight across the disk like a knife — a striking demonstration of the dust between stars.",
    wikipedia: "NGC_891",
  },
  {
    id: "ngc4565",
    name: "Needle Galaxy",
    altNames: ["NGC 4565", "Caldwell 38"],
    ra: 189.0866,
    dec: 25.9876,
    type: "spiral",
    distanceMpc: 13.5,
    distanceMpcErr: 0.6,
    z: 0.004153,
    vRecKmS: v(0.004153),
    capabilities: { ...noCaps },
    claimToFame:
      "A long, thin, edge-on spiral, nicknamed the Needle for its slender shape. One of the most photogenic galaxies in the northern sky.",
    wikipedia: "NGC_4565",
  },
  {
    id: "ngc5907",
    name: "Splinter Galaxy",
    altNames: ["NGC 5907", "Knife Edge Galaxy"],
    ra: 228.974,
    dec: 56.3287,
    type: "spiral",
    distanceMpc: 17.0,
    distanceMpcErr: 0.7,
    z: 0.002225,
    vRecKmS: v(0.002225),
    capabilities: { ...noCaps },
    claimToFame:
      "Another edge-on spiral, surrounded by faint shell-like streams left over from a smaller galaxy that it tore apart in the past.",
    wikipedia: "NGC_5907",
  },

  // ============================================================
  //  Stephan's Quintet partner galaxies — context for the NGC 7320
  //  anomaly. All four sit at z ≈ 0.022, ten times further than the
  //  foreground NGC 7320 (already in the seed set).
  // ============================================================
  {
    id: "ngc7319",
    name: "NGC 7319",
    altNames: ["Stephan's Quintet member"],
    ra: 339.0144,
    dec: 33.9763,
    type: "barred-spiral",
    distanceMpc: 95.0,
    distanceMpcErr: 5.0,
    z: 0.022507,
    vRecKmS: v(0.022507),
    capabilities: { ...noCaps },
    claimToFame:
      "A barred spiral in Stephan's Quintet, a famous group of five visually-close galaxies. Its redshift is ten times that of NGC 7320, which only looks like part of the group.",
    wikipedia: "NGC_7319",
  },
  {
    id: "ngc7317",
    name: "NGC 7317",
    altNames: ["Stephan's Quintet member"],
    ra: 338.9809,
    dec: 33.9489,
    type: "elliptical",
    distanceMpc: 89.0,
    distanceMpcErr: 5.0,
    z: 0.02234,
    vRecKmS: v(0.02234),
    capabilities: { ...noCaps },
    claimToFame:
      "A compact elliptical, the smallest of the four genuine Stephan's Quintet members.",
    wikipedia: "NGC_7317",
  },

  // ============================================================
  //  Active-galaxy anomalies
  // ============================================================
  {
    id: "mrk421",
    name: "Markarian 421",
    altNames: ["Mrk 421"],
    ra: 166.1138,
    dec: 38.2088,
    type: "agn",
    distanceMpc: 122.0,
    distanceMpcErr: 5.0,
    z: 0.031,
    vRecKmS: v(0.031),
    capabilities: { ...noCaps },
    claimToFame:
      "A galaxy whose central black hole shoots a jet of charged particles almost straight at us, making it one of the brightest gamma-ray sources in the sky.",
    wikipedia: "Markarian_421",
    isAnomaly: true,
    anomalyExplanation:
      "Bright in extreme energies (X-rays, gamma rays) but a fairly ordinary galaxy at visible wavelengths — a reminder that 'bright' depends on what kind of light you're looking at.",
  },
];

function tagFor(id: string): DistanceTag {
  return EXTRAPOLATED_IDS.has(id) ? "extrapolated" : "direct";
}

function methodLabelFor(id: string, tag: DistanceTag): string {
  return (
    METHOD_LABELS[id] ??
    (tag === "direct" ? DEFAULT_DIRECT_LABEL : DEFAULT_EXTRAPOLATED_LABEL)
  );
}

export const CURATED_GALAXIES: Galaxy[] = CURATED_SEED.map((g) => {
  const distanceTag = tagFor(g.id);
  return {
    ...g,
    distanceTag,
    distanceMethodLabel: methodLabelFor(g.id, distanceTag),
  };
});

export function findGalaxyById(id: string): Galaxy | undefined {
  return CURATED_GALAXIES.find((g) => g.id === id);
}

// Group galaxies by their primary "vibe" so the info panel can render
// them in expandable sets (mirrors h-r-diagram's STAR_SETS pattern).
export interface GalaxySet {
  id: string;
  label: string;
  description: string;
  markerColor: string;
  markerShape: "square" | "circle" | "plus" | "cross" | "rhomb" | "triangle";
  galaxyIds: string[];
}

export const GALAXY_SETS: GalaxySet[] = [
  {
    id: "local-group",
    label: "Local Group & nearby",
    description:
      "Galaxies close enough to be gravitationally bound to us — most don't follow Hubble's law.",
    markerColor: "#9bd3ff",
    markerShape: "circle",
    galaxyIds: ["lmc", "smc", "m31", "m33", "ic1613", "ngc6822", "m81", "m82"],
  },
  {
    id: "famous",
    label: "Famous galaxies",
    description:
      "Bright, well-known galaxies in the nearby universe.",
    markerColor: "#b78bff",
    markerShape: "circle",
    galaxyIds: [
      "centaurus_a",
      "m51",
      "m104",
      "m87",
      "ngc4258",
      "ngc1365_agn",
      "ngc891",
      "ngc4565",
      "ngc5907",
      "ngc7319",
      "ngc7317",
    ],
  },
  {
    id: "shoes-hosts",
    label: "Cepheid distance hosts",
    description:
      "Galaxies where the Hubble Space Telescope has measured Cepheid stars. Use these to derive distances yourself.",
    markerColor: "#6dd58c",
    markerShape: "square",
    galaxyIds: [
      "ngc1015",
      "ngc1309",
      "ngc1365",
      "ngc3370",
      "ngc3627",
      "ngc4038",
      "ngc4424",
      "ngc4536",
      "ngc4639",
      "ngc5584",
      "ngc7250",
      "ugc9391",
    ],
  },
  {
    id: "deep-field",
    label: "Hubble Deep Field",
    description:
      "Faint galaxies at very high redshift, picked from the Hubble Deep Field North and Ultra Deep Field.",
    markerColor: "#ffb74d",
    markerShape: "rhomb",
    galaxyIds: ["hdfn_4_555", "hudf_z3"],
  },
  {
    id: "anomalies",
    label: "Anomalies",
    description:
      "Galaxies that don't fit the simple Hubble's law line — for interesting reasons.",
    markerColor: "#ff7b7b",
    markerShape: "cross",
    galaxyIds: ["ngc7320", "3c273", "mrk421"],
  },
];

/**
 * Marker colour of the first GALAXY_SET that contains this galaxy id,
 * or null for ids not in any curated set (search results, hubble1929
 * tour entries, etc.). Used by the Hubble diagram to colour curated
 * dots by their set so they remain visually distinct from green/cyan
 * search-found dots.
 */
export function setColorForGalaxyId(id: string): string | null {
  for (const set of GALAXY_SETS) {
    if (set.galaxyIds.includes(id)) return set.markerColor;
  }
  return null;
}
