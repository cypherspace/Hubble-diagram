import type { Galaxy } from "../types";
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

interface AladinCatalog {
  addSources: (sources: AladinSource[]) => void;
  removeAll: () => void;
  show: () => void;
  hide: () => void;
}

interface AladinInstance {
  setImageSurvey: (survey: string) => void;
  gotoObject: (
    name: string,
    options?: {
      success?: () => void;
      error?: (err: unknown) => void;
    },
  ) => void;
  gotoRaDec: (ra: number, dec: number) => void;
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
  private candidateCatalog?: AladinCatalog;
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

    this.candidateCatalog = A.catalog({
      name: "SDSS search results",
      sourceSize: 12,
      color: "#ffd166",
      shape: "plus",
    });
    this.aladin.addCatalog(this.candidateCatalog);

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
    if (!this.candidateCatalog || !window.A) return;
    this.candidatesById.clear();
    const sources = candidates.map((g) => {
      this.candidatesById.set(g.id, g);
      return window.A!.source(g.ra, g.dec, {
        id: g.id,
        name: g.name,
      });
    });
    this.candidateCatalog.removeAll();
    if (sources.length > 0) this.candidateCatalog.addSources(sources);
  }

  removeCandidate(id: string): void {
    this.candidatesById.delete(id);
    void this.setCandidates(Array.from(this.candidatesById.values()));
  }

  clearCandidates(): void {
    this.candidatesById.clear();
    this.candidateCatalog?.removeAll();
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
}

async function waitForAladin(timeoutMs = 8000): Promise<AladinNamespace | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.A) return window.A;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
