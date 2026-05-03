// Async SIMBAD lookup for Gaia DR3 stars. SIMBAD (CDS Strasbourg) is the
// standard astronomy cross-identification database. For Gaia stars that
// correspond to a previously-named star, SIMBAD gives back its main
// identifier — typically the proper name ("Alnitak") or a Bayer
// designation ("* zet Ori A"). We fetch the plain-text "ASCII" output
// and parse the `Object` line.

const GREEK_LETTERS: Record<string, string> = {
  alf: "α",
  bet: "β",
  gam: "γ",
  del: "δ",
  eps: "ε",
  zet: "ζ",
  eta: "η",
  the: "θ",
  iot: "ι",
  kap: "κ",
  lam: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  omi: "ο",
  pi: "π",
  rho: "ρ",
  sig: "σ",
  tau: "τ",
  ups: "υ",
  phi: "φ",
  chi: "χ",
  psi: "ψ",
  ome: "ω",
};

export interface SimbadIdentity {
  // Pretty form for display (e.g. "ζ Ori A" or "Alnitak").
  display: string;
  // The raw SIMBAD main identifier ("* zet Ori A").
  raw: string;
}

/**
 * Look up a Gaia DR3 source ID in SIMBAD and return a friendlier name
 * if one exists (proper name, Bayer designation, etc.). Returns null if
 * SIMBAD has no entry for that source or the network call fails — the
 * caller should treat that as "no improvement available" and keep the
 * Gaia ID.
 */
export async function lookupSimbadName(
  gaiaSourceId: string,
  signal?: AbortSignal,
): Promise<SimbadIdentity | null> {
  const ident = encodeURIComponent(`Gaia DR3 ${gaiaSourceId}`);
  const url =
    `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${ident}` +
    `&output.format=ASCII&obj.bibsel=off&obj.notesel=off&obj.mesdisp=N`;
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const text = await res.text();
  // SIMBAD's ASCII output starts with: "Object <main id>  ---  <type> ..."
  const match = text.match(/^Object\s+(.+?)\s+---/m);
  if (!match) return null;
  const raw = match[1].trim();
  return { raw, display: prettify(raw) };
}

/**
 * Convert SIMBAD's main_id formats to something more readable:
 *   "* zet Ori A"   → "ζ Ori A"
 *   "** STT 412"    → "STT 412"
 *   "V* TX Cam"     → "TX Cam"
 *   "HD 12345"      → "HD 12345" (unchanged)
 *   "NAME Alnitak"  → "Alnitak"
 */
export function prettify(simbadId: string): string {
  let s = simbadId.trim();
  s = s.replace(/^NAME\s+/, "");
  s = s.replace(/^V\*\s+/, "");
  s = s.replace(/^\*\*\s+/, "");
  s = s.replace(/^\*\s+/, "");

  // Bayer letter abbreviation followed by 3-letter constellation code.
  const bayerRe = new RegExp(
    `^(${Object.keys(GREEK_LETTERS).join("|")})(\\d*)\\b`,
  );
  const m = s.match(bayerRe);
  if (m) {
    const greek = GREEK_LETTERS[m[1]];
    const sup = m[2] ? superscript(m[2]) : "";
    s = s.replace(bayerRe, `${greek}${sup}`);
  }
  return s;
}

function superscript(digits: string): string {
  const map: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return [...digits].map((d) => map[d] ?? d).join("");
}
