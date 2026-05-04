import type { Galaxy } from "../types";

// Build a CDS Hips2FITS thumbnail URL for a galaxy. Picks an
// appropriate HiPS based on the galaxy's catalog source and a sane
// FOV based on type / catalog (Local Group galaxies need a wider
// view than distant SDSS-search galaxies).
//
// Hips2FITS docs: https://alasky.cds.unistra.fr/hips-image-services/hips2fits

const HIPS2FITS_BASE =
  "https://alasky.cds.unistra.fr/hips-image-services/hips2fits";

function pickHips(galaxy: Galaxy): string {
  if (galaxy.id.startsWith("sdss-")) return "P/SDSS9/color";
  if (galaxy.type === "deep-field") return "P/PanSTARRS/DR1/color-z-zg-g";
  return "P/DSS2/color";
}

// Field of view in degrees. Picked so the galaxy is recognisably
// framed at 200 px square.
function pickFovDeg(galaxy: Galaxy): number {
  // Local Group: large angular size — Andromeda is ~3°, dwarfs 0.5°.
  if (galaxy.distanceMpc < 1) return 1.2;
  if (galaxy.distanceMpc < 5) return 0.5;
  if (galaxy.distanceMpc < 30) return 0.15;
  if (galaxy.distanceMpc < 100) return 0.06;
  return 0.04; // deep-field, quasar
}

export function thumbnailUrl(galaxy: Galaxy, sizePx = 200): string {
  const hips = pickHips(galaxy);
  const fov = pickFovDeg(galaxy);
  const params = new URLSearchParams({
    hips,
    ra: galaxy.ra.toFixed(6),
    dec: galaxy.dec.toFixed(6),
    fov: fov.toString(),
    width: String(sizePx),
    height: String(sizePx),
    format: "jpg",
    projection: "TAN",
  });
  return `${HIPS2FITS_BASE}?${params.toString()}`;
}

/** Build the <img> element with a graceful fallback if the cutout
 *  service is unreachable. */
export function buildThumbnail(galaxy: Galaxy, sizePx = 200): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "galaxy-thumb";
  wrap.style.width = `${sizePx}px`;
  wrap.style.height = `${sizePx}px`;

  const img = document.createElement("img");
  img.alt = `${galaxy.name} (${pickHips(galaxy).replace("P/", "")})`;
  img.src = thumbnailUrl(galaxy, sizePx);
  img.width = sizePx;
  img.height = sizePx;
  img.loading = "lazy";
  img.style.display = "block";
  img.style.borderRadius = "4px";
  img.onerror = () => {
    // Replace with a "no image" placeholder — keeps layout stable.
    wrap.replaceChildren();
    wrap.classList.add("galaxy-thumb-fallback");
    wrap.textContent = "image unavailable";
  };
  wrap.appendChild(img);
  return wrap;
}
