import "./style.css";
import { CURATED_GALAXIES, GALAXY_SETS, findGalaxyById } from "./data/galaxies";
import { C_KM_S } from "./data/derive";
import {
  searchGalaxies,
  searchedGalaxyToGalaxy,
  type SearchedGalaxy,
} from "./data/galaxySearch";
import { VizierError } from "./data/vizier";
import { HubbleDiagram } from "./ui/hubbleDiagram";
import { Controls } from "./ui/controls";
import { DataPanel } from "./ui/dataPanel";
import { SkyViewer } from "./ui/skyViewer";
import { CepheidPanel } from "./ui/cepheidPanel";
import { LightCurvePanel } from "./ui/lightCurvePanel";
import { SpectrumPanel } from "./ui/spectrumPanel";
import { HowItWorks } from "./ui/howItWorks";
import { HowWeKnow } from "./ui/howWeKnow";
import { DiagramGuide } from "./ui/diagramGuide";
import { Walkthrough } from "./ui/walkthrough";
import { Hubble1929Tour } from "./ui/hubble1929Tour";
import { openModal } from "./ui/modal";
import { loadDiagram, saveDiagram } from "./store/diagrams";
import type { AxisConfig, Galaxy, PlottedGalaxy } from "./types";

const defaultAxes: AxisConfig = {
  yMode: "velocity",
  range: "auto",
  showNegative: false,
};

class App {
  private axes: AxisConfig = defaultAxes;
  private plotted = new Map<string, PlottedGalaxy>();
  private selectedId: string | null = null;
  private diagram: HubbleDiagram;
  private dataPanel: DataPanel;
  private controls: Controls;
  private skyViewer: SkyViewer;
  private galaxySetsContainer: HTMLElement;
  private skyStatusEl: HTMLElement;
  // Galaxies returned by the most recent SDSS / 2MRS search. Live in-
  // memory only — they're shown as candidate markers on the sky and
  // merged into `findGalaxyById` lookups via `searchResults`.
  private searchResults = new Map<string, Galaxy>();
  private inflightSearch: AbortController | null = null;

  constructor() {
    const diagramEl = mustGet("diagram");
    const controlsEl = mustGet("diagram-controls");
    const dataEl = mustGet("data-panel");
    const aladinEl = mustGet("aladin-lite-div");
    this.skyStatusEl = mustGet("sky-status");
    this.galaxySetsContainer = mustGet("galaxy-sets");

    this.dataPanel = new DataPanel(dataEl, {
      onAddToChart: (g) => this.addCurated(g),
      onDeriveDistance: (g) =>
        new CepheidPanel({
          galaxy: g,
          onAccept: (id, dMpc) => this.acceptDerivedDistance(id, dMpc, "cepheid-pl"),
        }).open(),
      onDeriveLightCurveDistance: (g) =>
        new LightCurvePanel({
          galaxy: g,
          onAccept: (id, dMpc) =>
            this.acceptDerivedDistance(id, dMpc, "cepheid-lightcurve"),
        }).open(),
      onDeriveRedshift: (g) =>
        new SpectrumPanel({
          galaxy: g,
          onAccept: (id, vKmS) => this.acceptDerivedVelocity(id, vKmS),
        }).open(),
    });
    this.dataPanel.showEmpty();

    this.diagram = new HubbleDiagram({
      container: diagramEl,
      axes: this.axes,
      onPointClick: (g) => this.select(g.id),
    });

    this.controls = new Controls(controlsEl, this.axes, {
      onAxesChange: (axes) => {
        this.axes = axes;
        this.diagram.setAxes(axes);
      },
      onClearAll: () => this.clearAll(),
      onClearSelected: () => this.clearSelected(),
      onResetZoom: () => this.diagram.resetZoom(),
      onSave: (name) => this.save(name),
      onLoad: (name) => this.load(name),
    });

    this.skyViewer = new SkyViewer({
      container: aladinEl,
      initialTarget: "Andromeda",
      initialSurvey: "P/DSS2/color",
      initialFov: 30,
      onGalaxyClick: (g) => this.select(g.id),
      onCandidateClick: (g) => this.commitCandidate(g),
      onStatus: (msg) => {
        this.skyStatusEl.textContent = msg;
      },
    });
    void this.skyViewer.registerSets(GALAXY_SETS, CURATED_GALAXIES);

    this.wireSkyControls();
    this.renderGalaxySets();
    this.wireHubble1929Button();
    this.refresh();
  }

  private wireSkyControls(): void {
    const gotoInput = mustGet("goto-input") as HTMLInputElement;
    const gotoBtn = mustGet("goto-btn") as HTMLButtonElement;
    const surveySelect = mustGet("survey-select") as HTMLSelectElement;
    const searchBtn = mustGet("search-btn") as HTMLButtonElement;
    const addAllBtn = mustGet("add-all-btn") as HTMLButtonElement;
    const clearCandidatesBtn = mustGet("clear-candidates-btn") as HTMLButtonElement;
    const regionLimit = mustGet("region-limit") as HTMLInputElement;
    const showMarkers = mustGet("opt-show-markers") as HTMLInputElement;
    const showMapInfo = mustGet("opt-show-mapinfo") as HTMLInputElement;

    const fire = () => {
      const target = gotoInput.value.trim();
      if (target) void this.skyViewer.goto(target);
    };
    gotoBtn.addEventListener("click", fire);
    gotoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fire();
    });
    // Restore the user's last-chosen sky picture, if any.
    try {
      const saved = localStorage.getItem("hubble-diagram.survey");
      if (saved) {
        const opt = surveySelect.querySelector(
          `option[value="${CSS.escape(saved)}"]`,
        );
        if (opt) {
          surveySelect.value = saved;
          void this.skyViewer.setSurvey(saved);
        }
      }
    } catch {
      /* localStorage may be unavailable in some embedding contexts */
    }
    surveySelect.addEventListener("change", () => {
      const v = surveySelect.value;
      void this.skyViewer.setSurvey(v);
      try {
        localStorage.setItem("hubble-diagram.survey", v);
      } catch {
        /* ignore */
      }
    });
    searchBtn.addEventListener("click", () => {
      const limit = clamp(parseInt(regionLimit.value, 10) || 50, 1, 500);
      void this.searchVisibleRegion(limit);
    });
    addAllBtn.addEventListener("click", () => this.addAllCandidates());
    clearCandidatesBtn.addEventListener("click", () => {
      this.skyViewer.clearCandidates();
      this.searchResults.clear();
      this.skyStatusEl.textContent = "Search results cleared.";
    });
    showMarkers.addEventListener("change", () => {
      this.skyViewer.setAllMarkersVisible(showMarkers.checked);
    });
    showMapInfo.addEventListener("change", () => {
      document.body.classList.toggle("view-info-open", showMapInfo.checked);
    });

    // HST overlay checkbox.
    const hstOverlay = document.getElementById(
      "opt-hst-overlay",
    ) as HTMLInputElement | null;
    hstOverlay?.addEventListener("change", () => {
      void this.skyViewer.setHstOverlayVisible(hstOverlay.checked);
    });

    // "Jump to" preset buttons. FOV values chosen so the deep fields
    // fill roughly half the panel; cluster jumps are zoomed out
    // enough to see member galaxies.
    const presets: Array<[string, number, number, number, string]> = [
      ["goto-hdfn-btn", 189.21, 62.22, 0.1, "Hubble Deep Field North"],
      ["goto-hudf-btn", 53.16, -27.79, 0.1, "Hubble Ultra Deep Field"],
      ["goto-coma-btn", 194.94, 27.94, 1.5, "Coma Cluster"],
      ["goto-virgo-btn", 187.7, 12.39, 4.0, "Virgo Cluster"],
    ];
    for (const [id, ra, dec, fov, name] of presets) {
      const btn = document.getElementById(id);
      btn?.addEventListener("click", () => {
        void this.skyViewer.gotoRaDecFov(ra, dec, fov);
        this.skyStatusEl.textContent = `Centred on ${name}.`;
      });
    }

    // "What is this?" tooltip explaining the Jump to shortcuts.
    const jumpHelp = document.getElementById("jumpto-help-btn");
    jumpHelp?.addEventListener("click", () => {
      const { inner } = openModal("Jump-to shortcuts");
      inner.innerHTML = `
        <p>These shortcuts will take you directly to some interesting
        areas of the night sky containing visible galaxies.</p>
        <p>The <strong>Virgo cluster</strong> is a group of galaxies in
        relatively close proximity to each other, and relatively close
        to Earth. Edwin Hubble observed these and used some of them in
        his original graph.</p>
	<p>The <strong>Coma cluster</strong> is a group of over 1000 
	identified galaxies. Along with the Leo cluster it makes the 
	Coma Supercluster.
        <p><strong>HDF-N</strong> refers to the Hubble Deep Field —
        North, a very small area of sky that the Hubble Space Telescope
        explored in great detail, taking photos over a continuous
        period of 11 days, finding over 3000 galaxies in a patch of
        sky that otherwise looks empty. Some of the light from these
        galaxies is over 13 billion years old.</p>
        <p><strong>HUDF</strong> is the Hubble <em>Ultra</em> Deep
        Field, an even more closely explored patch of sky containing
        over 10,000 galaxies, including the most distant galaxy ever
        detected.</p>
        <p>We don't have redshift data for all of these, but try
        looking at them in the DSS2 (colour) sky map, and then in the
        HST Press Release Imagery, just to compare what a normal
        telescope can pick out, compared to the Hubble Space
        Telescope.</p>
      `;
    });
  }

  private wireHubble1929Button(): void {
    const btn = document.getElementById("hubble1929-btn");
    btn?.addEventListener("click", () => {
      const tour = new Hubble1929Tour({
        skyViewer: this.skyViewer,
        plotGalaxy: (g) => {
          this.plotted.set(g.id, g);
          this.refresh();
        },
        clearHubble1929: () => {
          for (const id of Array.from(this.plotted.keys())) {
            if (id.startsWith("hubble1929-")) this.plotted.delete(id);
          }
          this.refresh();
        },
        getAxes: () => this.axes,
        setAxes: (axes) => {
          this.axes = axes;
          this.controls.setAxes(axes);
          this.diagram.setAxes(axes);
        },
        getPlotted: () => Array.from(this.plotted.values()),
        onClose: () => {
          this.skyStatusEl.textContent = "Hubble's 1929 tour finished.";
        },
      });
      void tour.start();
    });
  }

  private renderGalaxySets(): void {
    // Render the per-category galaxy lists using the same class names
    // as h-r-diagram's STAR_SETS (.star-set / .set-stars / .set-label)
    // so the two apps can share styles.
    this.galaxySetsContainer.replaceChildren();
    for (const set of GALAXY_SETS) {
      const details = document.createElement("details");
      details.className = "star-set";
      const summary = document.createElement("summary");
      const swatch = document.createElement("span");
      swatch.className = "set-swatch";
      swatch.style.background = set.markerColor;
      const label = document.createElement("span");
      label.className = "set-label";
      label.textContent = set.label;
      const count = document.createElement("span");
      count.className = "set-count";
      count.textContent = String(set.galaxyIds.length);
      summary.append(swatch, label, count);
      details.appendChild(summary);

      const desc = document.createElement("p");
      desc.className = "set-description";
      desc.textContent = set.description;
      details.appendChild(desc);

      const setActions = document.createElement("div");
      setActions.className = "set-actions";
      const addAll = document.createElement("button");
      addAll.type = "button";
      addAll.textContent = "Add all to chart";
      addAll.addEventListener("click", () => {
        for (const id of set.galaxyIds) {
          const g = findGalaxyById(id);
          if (g) this.addCurated(g);
        }
      });
      const visToggle = document.createElement("label");
      visToggle.className = "set-vis";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.addEventListener("change", () => {
        this.skyViewer.setSetVisibility(set.id, cb.checked);
      });
      visToggle.append(cb, document.createTextNode(" Show on sky"));
      setActions.append(addAll, visToggle);
      details.appendChild(setActions);

      const list = document.createElement("ul");
      list.className = "set-stars";
      for (const id of set.galaxyIds) {
        const g = findGalaxyById(id);
        if (!g) continue;
        const li = document.createElement("li");
        li.dataset.id = id;
        const name = document.createElement("span");
        name.textContent = g.name;
        const meta = document.createElement("span");
        meta.className = "hint";
        meta.textContent = g.type;
        li.append(name, meta);
        li.addEventListener("click", () => this.select(g.id));
        list.appendChild(li);
      }
      details.appendChild(list);
      this.galaxySetsContainer.appendChild(details);
    }
  }

  private resolveGalaxy(id: string): Galaxy | undefined {
    return findGalaxyById(id) ?? this.searchResults.get(id);
  }

  private select(id: string): void {
    this.selectedId = id;
    const g = this.resolveGalaxy(id);
    if (!g) return;
    const plotted = this.plotted.get(id) ?? null;
    this.dataPanel.show(g, plotted);
    this.diagram.setSelected(id);
    // Re-centre the sky map on the selected galaxy. Single source of
    // truth for "user picked a galaxy" — diagram clicks, sky-marker
    // clicks, and curated-list clicks all funnel through here, so the
    // three entry points behave identically.
    void this.skyViewer.gotoRaDec(g.ra, g.dec);
  }

  private addCurated(galaxy: Galaxy): void {
    if (this.plotted.has(galaxy.id)) return;
    const plotted: PlottedGalaxy = {
      ...galaxy,
      plottedDistanceMpc: galaxy.distanceMpc,
      plottedVelocityKmS: galaxy.vRecKmS,
      distanceSource: "curated",
      velocitySource: "curated",
    };
    this.plotted.set(galaxy.id, plotted);
    this.refresh();
    this.skyStatusEl.textContent = `Added ${galaxy.name}.`;
  }

  private acceptDerivedDistance(
    galaxyId: string,
    distanceMpc: number,
    source: "cepheid-pl" | "cepheid-lightcurve",
  ): void {
    const g = this.resolveGalaxy(galaxyId);
    if (!g) return;
    const existing = this.plotted.get(galaxyId);
    const plotted: PlottedGalaxy = {
      ...g,
      plottedDistanceMpc: distanceMpc,
      plottedVelocityKmS:
        existing?.plottedVelocityKmS ?? g.vRecKmS,
      distanceSource: source,
      velocitySource: existing?.velocitySource ?? "curated",
      derivedAt: Date.now(),
    };
    this.plotted.set(galaxyId, plotted);
    this.select(galaxyId);
    this.refresh();
  }

  private acceptDerivedVelocity(galaxyId: string, vKmS: number): void {
    const g = this.resolveGalaxy(galaxyId);
    if (!g) return;
    const existing = this.plotted.get(galaxyId);
    const plotted: PlottedGalaxy = {
      ...g,
      plottedDistanceMpc:
        existing?.plottedDistanceMpc ?? g.distanceMpc,
      plottedVelocityKmS: vKmS,
      distanceSource: existing?.distanceSource ?? "curated",
      velocitySource: "spectrum",
      derivedAt: Date.now(),
    };
    this.plotted.set(galaxyId, plotted);
    this.select(galaxyId);
    this.refresh();
  }

  private clearAll(): void {
    this.plotted.clear();
    this.selectedId = null;
    this.dataPanel.showEmpty();
    this.refresh();
  }

  private clearSelected(): void {
    if (!this.selectedId) return;
    this.plotted.delete(this.selectedId);
    this.refresh();
  }

  private async searchVisibleRegion(limit: number): Promise<void> {
    const center = await this.skyViewer.getCenter();
    const fov = await this.skyViewer.getFov();
    if (!center || !fov) {
      this.skyStatusEl.textContent = "Sky viewer not ready.";
      return;
    }
    const [ra, dec] = center;
    // Cap the search radius — catalog cone-searches get dense fast and
    // VizieR slows down at larger radii. 1.5° is plenty for a single
    // screenful of galaxies.
    const radius = Math.min(Math.max(fov[0], fov[1]) / 2, 1.5);
    this.inflightSearch?.abort();
    const ctrl = new AbortController();
    this.inflightSearch = ctrl;
    this.skyStatusEl.textContent = `Searching for galaxies (radius ${radius.toFixed(2)}°, top ${limit})…`;
    try {
      const result = await searchGalaxies(ra, dec, radius, {
        topN: limit,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      const candidates = result.galaxies
        .map((row) => searchedGalaxyToGalaxy(row))
        .filter((g) => !this.plotted.has(g.id));
      this.searchResults.clear();
      for (const g of candidates) this.searchResults.set(g.id, g);
      await this.skyViewer.setCandidates(candidates);
      const sourcesLabel = formatSourceList(result.sourcesUsed);
      this.skyStatusEl.textContent =
        candidates.length > 0
          ? `Found ${candidates.length} galaxies ${sourcesLabel}. Click a marker to add one, or "Add all".`
          : "No galaxies found in that region. Try panning to a different patch.";

      // Background CF4 enrichment: when CF4 lands, merge any new direct
      // distances in. CF4 is fired in parallel with CF3, so this often
      // resolves within a second of the foreground search completing.
      if (result.cf4Pending) {
        void this.mergeCf4Background(result.cf4Pending, ctrl);
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const msg =
        e instanceof VizierError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      this.skyStatusEl.textContent = `Search failed: ${msg}`;
    } finally {
      if (this.inflightSearch === ctrl) this.inflightSearch = null;
    }
  }

  private async mergeCf4Background(
    pending: Promise<SearchedGalaxy[]>,
    ctrl: AbortController,
  ): Promise<void> {
    this.skyStatusEl.textContent = `${this.skyStatusEl.textContent} (Looking for more direct distances in Cosmicflows-4…)`;
    let cf4Rows: SearchedGalaxy[];
    try {
      cf4Rows = await pending;
    } catch {
      return;
    }
    if (ctrl.signal.aborted) return;
    if (cf4Rows.length === 0) {
      this.skyStatusEl.textContent =
        this.skyStatusEl.textContent.replace(
          / \(Looking for more direct distances in Cosmicflows-4…\)$/,
          "",
        );
      return;
    }
    let added = 0;
    for (const row of cf4Rows) {
      const g = searchedGalaxyToGalaxy(row);
      if (this.plotted.has(g.id) || this.searchResults.has(g.id)) continue;
      // Sky-position dedup against existing search results so we don't
      // double up the same galaxy under a different catalog id.
      const dup = Array.from(this.searchResults.values()).some(
        (existing) =>
          Math.abs(existing.ra - g.ra) < 1e-3 &&
          Math.abs(existing.dec - g.dec) < 1e-3,
      );
      if (dup) continue;
      this.searchResults.set(g.id, g);
      added++;
    }
    if (added > 0) {
      await this.skyViewer.setCandidates(
        Array.from(this.searchResults.values()),
      );
      this.skyStatusEl.textContent = `Cosmicflows-4 added ${added} more direct distance${added === 1 ? "" : "s"}.`;
    } else {
      this.skyStatusEl.textContent =
        this.skyStatusEl.textContent.replace(
          / \(Looking for more direct distances in Cosmicflows-4…\)$/,
          "",
        );
    }
  }

  private commitCandidate(galaxy: Galaxy): void {
    if (!this.searchResults.has(galaxy.id)) {
      this.searchResults.set(galaxy.id, galaxy);
    }
    this.select(galaxy.id);
    if (!this.plotted.has(galaxy.id)) {
      this.addCurated(galaxy);
    }
    this.skyViewer.removeCandidate(galaxy.id);
  }

  private addAllCandidates(): void {
    const candidates = this.skyViewer.getCandidates();
    if (candidates.length === 0) {
      this.skyStatusEl.textContent = "No search results to add. Press Search catalogs first.";
      return;
    }
    let added = 0;
    for (const galaxy of candidates) {
      if (!this.plotted.has(galaxy.id)) {
        this.addCurated(galaxy);
        added++;
      }
    }
    this.skyViewer.clearCandidates();
    this.skyStatusEl.textContent = `Added ${added} galaxies from search results.`;
  }

  private save(name: string): void {
    saveDiagram(name, Array.from(this.plotted.values()), this.axes);
    this.skyStatusEl.textContent = `Saved diagram "${name}".`;
  }

  private load(name: string): void {
    const saved = loadDiagram(name);
    if (!saved) return;
    this.plotted.clear();
    for (const p of saved.galaxies) this.plotted.set(p.id, p);
    this.axes = saved.axes;
    this.controls.setAxes(saved.axes);
    this.diagram.setAxes(saved.axes);
    this.refresh();
  }

  private refresh(): void {
    this.diagram.setGalaxies(Array.from(this.plotted.values()));
    this.diagram.setSelected(this.selectedId);
    this.refreshGalaxyListStates();
    this.refreshGuideButton();
  }

  private refreshGalaxyListStates(): void {
    for (const li of Array.from(
      this.galaxySetsContainer.querySelectorAll<HTMLLIElement>("li"),
    )) {
      li.classList.toggle("added", this.plotted.has(li.dataset.id ?? ""));
    }
  }

  private static readonly GUIDE_THRESHOLD = 8;

  private refreshGuideButton(): void {
    const btn = document.getElementById(
      "diagram-guide-btn",
    ) as HTMLButtonElement | null;
    if (!btn) return;
    const have = this.plotted.size;
    const need = App.GUIDE_THRESHOLD;
    if (have >= need) {
      btn.disabled = false;
      btn.title = "A guide to the regions of the Hubble diagram.";
    } else {
      btn.disabled = true;
      const remaining = need - have;
      btn.title = `Plot ${remaining} more galax${remaining === 1 ? "y" : "ies"} to unlock this guide (${have} / ${need}).`;
    }
  }
}

// Sanity-check c·z formula at startup so the developer console flags
// type drift early. (Vitest covers this too — see derive.test.ts.)
if (Math.abs(C_KM_S * 0.001 - 299.79) > 0.5) {
  // eslint-disable-next-line no-console
  console.warn("c·z sanity check failed", C_KM_S);
}

function wireStaticButtons(): void {
  document.getElementById("how-btn")?.addEventListener("click", () => {
    new HowItWorks().open();
  });
  document.getElementById("how-we-know-btn")?.addEventListener("click", () => {
    new HowWeKnow().open();
  });
  document.getElementById("diagram-guide-btn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    if (btn.disabled) return;
    new DiagramGuide().open();
  });
  document.getElementById("tour-btn")?.addEventListener("click", () => {
    Walkthrough.reset();
    new Walkthrough().start();
  });
  // First-time auto-tour, with a small delay so Aladin has rendered.
  if (!Walkthrough.hasBeenSeen()) {
    setTimeout(() => new Walkthrough().start(), 800);
  }
}

function mustGet(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function formatSourceList(sources: ("cf3" | "cf4" | "sdss" | "2mrs")[]): string {
  const labels: Record<string, string> = {
    cf3: "Cosmicflows-3",
    cf4: "Cosmicflows-4",
    sdss: "Sloan Digital Sky Survey",
    "2mrs": "2MASS Redshift Survey",
  };
  const names = sources.map((s) => labels[s]).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return `from ${names[0]}`;
  if (names.length === 2) return `from ${names[0]} + ${names[1]}`;
  return `from ${names.slice(0, -1).join(", ")} + ${names[names.length - 1]}`;
}

new App();
wireStaticButtons();
