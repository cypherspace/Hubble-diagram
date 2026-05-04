// Common atomic/molecular lines that students will see in galaxy
// spectra. Wavelengths are stored in Ångströms (the units the source
// catalogues use) but the SpectrumPanel and "How we know" diagrams
// display them in nanometres (Å / 10) since that's the unit students
// see in physics class. Source: NIST atomic spectra database with
// the standard "approximately the value most spectra texts use"
// rounding.
//
// Each entry carries a short student-facing description so the
// SpectrumPanel dropdown can explain *why* this line shows up in a
// galaxy's light.

/** Convert Ångströms to nanometres for display. */
export function angstromsToNm(a: number): number {
  return a / 10;
}

/** Format a wavelength as "656.3 nm". */
export function formatNm(angstroms: number): string {
  return `${(angstroms / 10).toFixed(1)} nm`;
}

export interface SpectralLine {
  id: string;
  // Display label including the line's symbol, with a Unicode α / β
  // / [O III] glyph the student can recognise.
  label: string;
  restAngstroms: number;
  // 'absorption' — appears as a dip in flux. Common in old elliptical
  //   galaxies whose light comes from cool stars (Ca H+K, Mg I, Na D).
  // 'emission' — appears as a spike. Common in star-forming galaxies
  //   (Hα, Hβ, [O III], [N II], [S II]).
  mode: "absorption" | "emission" | "both";
  // 1-sentence "why this line shows up" for the student.
  description: string;
}

export const LINE_CATALOG: SpectralLine[] = [
  {
    id: "ca_k",
    label: "Ca II K",
    restAngstroms: 3933.66,
    mode: "absorption",
    description:
      "Calcium absorption — strong in cool stars, so prominent in old elliptical galaxies.",
  },
  {
    id: "ca_h",
    label: "Ca II H",
    restAngstroms: 3968.47,
    mode: "absorption",
    description:
      "Calcium's partner line, just to the red of Ca K. Together they form a pair.",
  },
  {
    id: "g_band",
    label: "G-band (CH)",
    restAngstroms: 4304.0,
    mode: "absorption",
    description:
      "A blend of CH molecular bands and metal lines, prominent in Sun-like stars.",
  },
  {
    id: "h_beta",
    label: "Hβ",
    restAngstroms: 4861.33,
    mode: "both",
    description:
      "Hydrogen Balmer line. Absorption in cool-star spectra, emission in star-forming gas.",
  },
  {
    id: "oiii_4959",
    label: "[O III] 4959",
    restAngstroms: 4958.91,
    mode: "emission",
    description:
      "Doubly-ionised oxygen — emission spike in galaxies that contain ionised gas (HII regions, AGN).",
  },
  {
    id: "oiii_5007",
    label: "[O III] 5007",
    restAngstroms: 5006.84,
    mode: "emission",
    description:
      "The brighter [O III] partner. Often the most obvious emission line in galaxy spectra.",
  },
  {
    id: "mg_i",
    label: "Mg I b",
    restAngstroms: 5175.3,
    mode: "absorption",
    description:
      "Magnesium triplet — absorption feature dominated by old stellar populations.",
  },
  {
    id: "na_d",
    label: "Na I D",
    restAngstroms: 5895.6,
    mode: "absorption",
    description:
      "Sodium doublet — same line that gives sodium street lamps their orange glow.",
  },
  {
    id: "h_alpha",
    label: "Hα",
    restAngstroms: 6562.8,
    mode: "both",
    description:
      "The brightest hydrogen line in the visible. Strong emission in star-forming galaxies.",
  },
  {
    id: "nii_6584",
    label: "[N II] 6584",
    restAngstroms: 6583.45,
    mode: "emission",
    description:
      "Singly-ionised nitrogen, sitting just to the red of Hα. Helps separate AGN from star formation.",
  },
  {
    id: "sii_6717",
    label: "[S II] 6717",
    restAngstroms: 6716.44,
    mode: "emission",
    description:
      "Singly-ionised sulphur. Used as a density diagnostic together with [S II] 6731.",
  },
];

export function findLine(id: string): SpectralLine | undefined {
  return LINE_CATALOG.find((l) => l.id === id);
}
