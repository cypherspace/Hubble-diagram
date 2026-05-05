import type { DistanceTag, Galaxy } from "../types";
import type { GalaxySet } from "../data/galaxies";

declare global {
  interface Window {
    A?: AladinNamespace;
  }
}

interface AladinSource {
  data: Record<string, unknown>;
  ra?: number;
  dec?: number;
}

// Distance-tag colours, kept in sync with --accent-good / --accent-2
// in src/style.css. Aladin's catalog options take a CSS colour string,
// not a custom var, so we duplicate the literal hex here.
const TAG_COLOR: Record<DistanceTag, string> = {
  direct: "#9be7c4",        // --accent-good
  extrapolated: "#6cc4ff",  // --accent-2
};

interface AladinCatalog {
  addSources: (sources: AladinSource[]) => void;
  removeAll: () => void;
  show: () => void;
  hide: () => void;
}

interface AladinInstance {
  setImageSurvey: (survey: string) => void;
  // Aladin Lite v3: stack a second HiPS as an overlay layer on top of
  // the base survey. Pass a survey identifier (e.g. "P/HST/EPO") and
  // optional opacity 0..1.
  setOverlayImageLayer?: (
    survey: string | { id?: string; url?: string; name?: string } | null,
    opacity?: number,
  ) => void;
  removeOverlayImageLayer?: (id?: string) => void;
  gotoObject: (
    name: string,
    options?: {
      success?: () => void;
      error?: (err: unknown) => void;
    },
  ) => void;
  gotoRaDec: (ra: number, dec: number) => void;
  setFov?: (fovDeg: number) => void;
  getRaDec: () => [number, number];
  getFov: () => [number, number];
  addCatalog: (cat: AladinCatalog) => void;
  on: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
}

interface AladinNamespace {
  init: Promise<void>;
  aladin: (
    selector: string | HTMLElement,
    opts: Record<string, unknown>,
  ) => AladinInstance;
  catalog: (opts: Record<string, unknown>) => AladinCatalog;
  source: (
    ra: number,
    dec: number,
    data: Record<string, unknown>,
  ) => AladinSource;
}

export interface SkyViewerOptions {
  container: HTMLElement;
  initialTarget?: string;
  initialSurvey?: string;
  initialFov?: number;
  onGalaxyClick?: (galaxy: Galaxy) => void;
  onCandidateClick?: (galaxy: Galaxy) => void;
  onStatus?: (msg: string) => void;
}

// Builds a label string of capability badges that appear next to the
// galaxy name on hover / in the data panel header. Same idea as the
// "✓" decorations in h-r-diagram's star sets, but now per-galaxy.
function buildBadgeText(galaxy: Galaxy): string {
  const parts: string[] = [];
  if (galaxy.capabilities.cepheidPL) parts.push("✦");
  if (galaxy.capabilities.sdssSpectrum) parts.push("λ");
  if (galaxy.isAnomaly) parts.push("⚠");
  return parts.join(" ");
}

export class SkyViewer {
  private aladin?: AladinInstance;
  private setCatalogs = new Map<string, AladinCatalog>();
  // Two candidate catalogs, one per distance tag. Aladin Lite v3 takes
  // a single colour + shape per catalog, so splitting by tag is the
  // simplest way to render direct vs extrapolated search results in
  // distinct colours while staying on the well-tested built-in shape
  // path (the custom-draw `shape: function` route doesn't reposition
  // markers as the sky pans/zooms in v3, so dots stick to the canvas).
  private candidateCatalogDirect?: AladinCatalog;
  private candidateCatalogExtrapolated?: AladinCatalog;
  private candidatesById = new Map<string, Galaxy>();
  private galaxiesById = new Map<string, Galaxy>();
  private opts: SkyViewerOptions;
  private ready: Promise<void>;
  private masterMarkersVisible = true;

  constructor(opts: SkyViewerOptions) {
    this.opts = opts;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    const A = await waitForAladin();
    if (!A) {
      this.opts.onStatus?.(
        "Sky viewer failed to load. Check your internet connection.",
      );
      return;
    }
    await A.init;
    this.aladin = A.aladin(this.opts.container, {
      survey: this.opts.initialSurvey ?? "P/DSS2/color",
      fov: this.opts.initialFov ?? 5,
      target: this.opts.initialTarget ?? "Andromeda",
      cooFrame: "ICRSd",
      showReticle: true,
      showZoomControl: true,
      showFullscreenControl: true,
      showLayersControl: false,
      showGotoControl: false,
      showShareControl: false,
      showCooGrid: false,
      showFrame: false,
      showProjectionControl: false,
    });

    this.candidateCatalogDirect = A.catalog({
      name: "Search results — direct distance",
      sourceSize: 14,
      color: TAG_COLOR.direct,
      shape: "plus",
    });
    this.candidateCatalogExtrapolated = A.catalog({
      name: "Search results — extrapolated",
      sourceSize: 14,
      color: TAG_COLOR.extrapolated,
      shape: "plus",
    });
    this.aladin.addCatalog(this.candidateCatalogDirect);
    this.aladin.addCatalog(this.candidateCatalogExtrapolated);

    this.aladin.on("objectClicked", (...args: unknown[]) => {
      const obj = args[0] as AladinSource | null;
      if (!obj) return;
      const id = obj.data?.id;
      if (typeof id !== "string") return;
      const candidate = this.candidatesById.get(id);
      if (candidate) {
        this.opts.onCandidateClick?.(candidate);
        return;
      }
      const g = this.galaxiesById.get(id);
      if (g) this.opts.onGalaxyClick?.(g);
    });

    const setFullscreen = (on: boolean) => {
      document.body.classList.toggle("aladin-fullscreen", on);
    };
    this.aladin.on("fullScreenToggled", (...args: unknown[]) => {
      setFullscreen(Boolean(args[0]));
    });
    document.addEventListener("fullscreenchange", () => {
      const fs = document.fullscreenElement;
      const inAladin =
        !!fs &&
        (fs === this.opts.container || this.opts.container.contains(fs));
      setFullscreen(inAladin);
    });

    this.opts.onStatus?.(
      "Drag to move, scroll to zoom. Click any marker to learn about that galaxy.",
    );
  }

  registerSets(sets: GalaxySet[], allGalaxies: Galaxy[]): Promise<void> {
    return this.ready.then(() => {
      if (!this.aladin || !window.A) return;
      for (const g of allGalaxies) this.galaxiesById.set(g.id, g);
      for (const set of sets) {
        if (this.setCatalogs.has(set.id)) continue;
        const cat = window.A.catalog({
          name: set.label,
          sourceSize: 16,
          color: set.markerColor,
          shape: set.markerShape,
          displayLabel: true,
          labelColumn: "label",
          labelColor: set.markerColor,
          labelFont: "11px system-ui, sans-serif",
        });
        this.aladin.addCatalog(cat);
        this.setCatalogs.set(set.id, cat);

        const sources: AladinSource[] = [];
        for (const id of set.galaxyIds) {
          const g = allGalaxies.find((x) => x.id === id);
          if (!g) continue;
          const badge = buildBadgeText(g);
          const labelText = badge ? `${g.name}  ${badge}` : g.name;
          sources.push(
            window.A.source(g.ra, g.dec, {
              id: g.id,
              name: g.name,
              label: labelText,
              type: g.type,
            }),
          );
        }
        if (sources.length > 0) cat.addSources(sources);
      }
    });
  }

  setAllMarkersVisible(visible: boolean): void {
    this.masterMarkersVisible = visible;
    for (const cat of this.setCatalogs.values()) {
      if (this.masterMarkersVisible) cat.show();
      else cat.hide();
    }
  }

  setSetVisibility(setId: string, visible: boolean): void {
    const cat = this.setCatalogs.get(setId);
    if (!cat) return;
    if (visible && this.masterMarkersVisible) cat.show();
    else cat.hide();
  }

  async setCandidates(candidates: Galaxy[]): Promise<void> {
    await this.ready;
    if (
      !this.candidateCatalogDirect ||
      !this.candidateCatalogExtrapolated ||
      !window.A
    )
      return;
    this.candidatesById.clear();
    const direct: AladinSource[] = [];
    const extrapolated: AladinSource[] = [];
    for (const g of candidates) {
      this.candidatesById.set(g.id, g);
      const src = window.A.source(g.ra, g.dec, { id: g.id, name: g.name });
      (g.distanceTag === "direct" ? direct : extrapolated).push(src);
    }
    this.candidateCatalogDirect.removeAll();
    this.candidateCatalogExtrapolated.removeAll();
    if (direct.length > 0) this.candidateCatalogDirect.addSources(direct);
    if (extrapolated.length > 0)
      this.candidateCatalogExtrapolated.addSources(extrapolated);
  }

  removeCandidate(id: string): void {
    this.candidatesById.delete(id);
    void this.setCandidates(Array.from(this.candidatesById.values()));
  }

  clearCandidates(): void {
    this.candidatesById.clear();
    this.candidateCatalogDirect?.removeAll();
    this.candidateCatalogExtrapolated?.removeAll();
  }

  getCandidates(): Galaxy[] {
    return Array.from(this.candidatesById.values());
  }

  async getCenter(): Promise<[number, number] | null> {
    await this.ready;
    return this.aladin?.getRaDec() ?? null;
  }

  async getFov(): Promise<[number, number] | null> {
    await this.ready;
    return this.aladin?.getFov() ?? null;
  }

  async goto(target: string): Promise<void> {
    await this.ready;
    if (!this.aladin) return;
    return new Promise((resolve) => {
      this.aladin!.gotoObject(target, {
        success: () => {
          this.opts.onStatus?.(`Centred on ${target}.`);
          resolve();
        },
        error: () => {
          this.opts.onStatus?.(`Could not find "${target}".`);
          resolve();
        },
      });
    });
  }

  async gotoRaDec(ra: number, dec: number): Promise<void> {
    await this.ready;
    this.aladin?.gotoRaDec(ra, dec);
  }

  async setSurvey(survey: string): Promise<void> {
    await this.ready;
    this.aladin?.setImageSurvey(survey);
  }

  /**
   * Toggle a layered Hubble Space Telescope overlay on top of whatever
   * the base survey is. Aladin Lite v3 layers HST tiles transparently
   * outside their footprint, so non-HST regions still show the base
   * survey through the overlay.
   */
  async setHstOverlayVisible(on: boolean): Promise<void> {
    await this.ready;
    if (!this.aladin) return;
    if (on && this.aladin.setOverlayImageLayer) {
      this.aladin.setOverlayImageLayer("P/HST/EPO", 0.7);
    } else if (this.aladin.removeOverlayImageLayer) {
      this.aladin.removeOverlayImageLayer();
    }
  }

  /**
   * Centre the view on (ra, dec) and zoom to a specific field of view.
   * Used by the preset "Jump to" buttons (HDF-N, HUDF etc.) to land at
   * a sensible scale rather than relying on the default zoom.
   */
  async gotoRaDecFov(
    ra: number,
    dec: number,
    fovDeg: number,
  ): Promise<void> {
    await this.ready;
    if (!this.aladin) return;
    this.aladin.gotoRaDec(ra, dec);
    if (this.aladin.setFov) this.aladin.setFov(fovDeg);
  }

  /**
   * Slowly pan + zoom-out + zoom-in to a target. Used by the
   * Hubble's-1929 walkthrough to give the student time to register
   * where the next galaxy lives in the sky.
   *
   * Animation curve:
   *  - First half of duration: zoom out from current FOV to a wide
   *    "context" FOV (max(start, target) × 4, capped at 60°),
   *    panning halfway toward the target.
   *  - Second half: continue panning to the target while zooming
   *    back in to the target FOV.
   *
   * Stepped via requestAnimationFrame at ~60 fps. Returns when the
   * animation is complete; safe to call multiple times in sequence.
   */
  async animateRaDecFov(
    ra: number,
    dec: number,
    fovDeg: number,
    durationMs: number,
  ): Promise<void> {
    await this.ready;
    if (!this.aladin || !this.aladin.setFov) {
      // Fall back to instant goto if animation primitives aren't
      // available.
      this.aladin?.gotoRaDec(ra, dec);
      return;
    }
    const startCenter = this.aladin.getRaDec();
    const startFov = Math.max(0.1, this.aladin.getFov()[0] ?? 30);
    const endRa = ra;
    const endDec = dec;
    const endFov = Math.max(0.05, fovDeg);
    // RA wraps at 360° — pick the shorter direction.
    let raDelta = endRa - startCenter[0];
    if (raDelta > 180) raDelta -= 360;
    if (raDelta < -180) raDelta += 360;
    const wideFov = Math.min(
      60,
      Math.max(startFov, endFov) * 4,
    );

    const start = performance.now();
    return new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        // Ease-in-out cubic.
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const ra = startCenter[0] + raDelta * eased;
        const dec = startCenter[1] + (endDec - startCenter[1]) * eased;
        let fov: number;
        if (eased < 0.5) {
          const u = eased * 2;
          fov = startFov + (wideFov - startFov) * u;
        } else {
          const u = (eased - 0.5) * 2;
          fov = wideFov + (endFov - wideFov) * u;
        }
        this.aladin!.gotoRaDec(ra, dec);
        this.aladin!.setFov!(fov);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
}

async function waitForAladin(timeoutMs = 8000): Promise<AladinNamespace | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.A) return window.A;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
