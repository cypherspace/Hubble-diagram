import {
  HUBBLE_1929,
  hubble1929GalaxyRecord,
  type Hubble1929Galaxy,
} from "../data/hubble1929";
import type { Galaxy, PlottedGalaxy } from "../types";
import type { SkyViewer } from "./skyViewer";

// Hubble's-1929-graph guided walkthrough.
//
// The tour pans Aladin to each of Hubble's 24 galaxies in turn, with
// a tooltip explaining what Hubble said vs what we know today, and
// drops Hubble's value (his original distance + velocity) onto the
// chart. After the 24th step the chart shows the slope Hubble himself
// reported (~500 km/s/Mpc), with a closing tooltip pointing out the
// historical Cepheid-calibration mistake and inviting the student to
// keep the chart and add modern data on top.
//
// Implementation:
//   - The Skill panel relies on the Walkthrough overlay style (full-
//     screen backdrop + tooltip + Next button), but each step also
//     performs an action (Aladin pan/zoom + plot a marker).
//   - First Aladin transition is slow (3-5 s) so the student sees the
//     viewport animate; subsequent transitions are 2-3 s.

const FIRST_TRANSITION_MS = 4000;
const NEXT_TRANSITION_MS = 2400;

export interface Hubble1929TourOptions {
  skyViewer: SkyViewer;
  /** Plot a galaxy onto the Hubble diagram at Hubble's 1929 values. */
  plotGalaxy: (galaxy: PlottedGalaxy) => void;
  /** Called when the tour finishes (or the student clicks Exit). */
  onClose: () => void;
}

export class Hubble1929Tour {
  private opts: Hubble1929TourOptions;
  private idx = 0;
  private overlay?: HTMLElement;
  private cancelled = false;

  constructor(opts: Hubble1929TourOptions) {
    this.opts = opts;
  }

  start(): void {
    this.cancelled = false;
    void this.runStep();
  }

  cancel(): void {
    this.cancelled = true;
    this.overlay?.remove();
    this.overlay = undefined;
  }

  private async runStep(): Promise<void> {
    if (this.cancelled) return;
    if (this.idx >= HUBBLE_1929.length) {
      this.showClosing();
      return;
    }
    const g = HUBBLE_1929[this.idx];
    const isFirst = this.idx === 0;
    const ms = isFirst ? FIRST_TRANSITION_MS : NEXT_TRANSITION_MS;
    // Pan + zoom animation: pull back, then zoom in to a sensible FOV.
    await this.animateAladinTo(g.ra, g.dec, ms);
    if (this.cancelled) return;
    // Plot Hubble's value on the chart in a distinct colour.
    const galaxyData = hubble1929GalaxyRecord(g);
    this.opts.plotGalaxy(asPlotted(galaxyData));
    this.showTooltip(g);
  }

  private animateAladinTo(
    ra: number,
    dec: number,
    durationMs: number,
  ): Promise<void> {
    // Aladin Lite v3 doesn't expose a single "pan + zoom over time"
    // API, but we can fake it: ease the FOV down, then jump to the
    // target. A quick + simple approximation is to call gotoRaDecFov
    // immediately and just sleep — the visual effect of the centre
    // changing isn't quite a smooth pan, but the durationMs gives
    // the student time to register where the next galaxy sits in
    // the sky before the tooltip shows up.
    const fov = 1.5;
    void this.opts.skyViewer.gotoRaDecFov(ra, dec, fov);
    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  private showTooltip(g: Hubble1929Galaxy): void {
    this.overlay?.remove();
    const overlay = document.createElement("div");
    overlay.className = "h1929-overlay";
    overlay.style.position = "fixed";
    overlay.style.right = "16px";
    overlay.style.bottom = "16px";
    overlay.style.maxWidth = "420px";
    overlay.style.background = "var(--panel)";
    overlay.style.border = "1px solid var(--accent)";
    overlay.style.borderRadius = "6px";
    overlay.style.padding = "12px 14px";
    overlay.style.color = "var(--fg)";
    overlay.style.fontSize = "13px";
    overlay.style.boxShadow = "0 4px 18px rgba(0,0,0,0.45)";
    overlay.style.zIndex = "2000";

    const heading = document.createElement("div");
    heading.style.fontWeight = "600";
    heading.style.fontSize = "14px";
    heading.style.color = "var(--accent)";
    heading.textContent = `Step ${this.idx + 1} / ${HUBBLE_1929.length}: ${g.displayName}`;
    overlay.appendChild(heading);

    const hubbleLine = document.createElement("p");
    hubbleLine.style.margin = "8px 0 4px";
    hubbleLine.innerHTML = `<strong>Hubble (1929) said:</strong>
      d = ${g.hubbleDistanceMpc} Mpc, v = ${g.hubbleVelocityKmS} km/s.`;
    overlay.appendChild(hubbleLine);

    const modernV = Math.round(g.modernZ * 299_792.458);
    const modernLine = document.createElement("p");
    modernLine.style.margin = "0 0 8px";
    modernLine.innerHTML = `<strong>Modern value:</strong>
      d = ${g.modernDistanceMpc} Mpc, v = ${modernV} km/s.`;
    overlay.appendChild(modernLine);

    const explainer = document.createElement("p");
    explainer.className = "hint";
    explainer.style.margin = "0 0 10px";
    const ratio = g.modernDistanceMpc / Math.max(0.01, g.hubbleDistanceMpc);
    explainer.textContent =
      ratio > 3
        ? `Hubble's distance is about ${ratio.toFixed(1)}× too small. The Cepheid calibration of his time confused two populations of variable stars — once that was sorted out (in 1952), all Hubble's distances got bigger and the slope of the line dropped to ~70 km/s/Mpc.`
        : `Hubble's value is close to the modern one — these are nearby galaxies where his calibration worked tolerably well.`;
    overlay.appendChild(explainer);

    const buttons = document.createElement("div");
    buttons.style.display = "flex";
    buttons.style.gap = "6px";
    buttons.style.justifyContent = "space-between";
    const exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "Exit tour";
    exit.addEventListener("click", () => {
      this.cancel();
      this.opts.onClose();
    });
    const next = document.createElement("button");
    next.type = "button";
    next.className = "primary";
    next.textContent =
      this.idx === HUBBLE_1929.length - 1 ? "See the result" : `Next galaxy →`;
    next.addEventListener("click", () => {
      this.idx++;
      void this.runStep();
    });
    buttons.append(exit, next);
    overlay.appendChild(buttons);

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  private showClosing(): void {
    this.overlay?.remove();
    const overlay = document.createElement("div");
    overlay.className = "h1929-overlay";
    overlay.style.position = "fixed";
    overlay.style.right = "16px";
    overlay.style.bottom = "16px";
    overlay.style.maxWidth = "460px";
    overlay.style.background = "var(--panel)";
    overlay.style.border = "1px solid var(--accent-2)";
    overlay.style.borderRadius = "6px";
    overlay.style.padding = "14px 16px";
    overlay.style.color = "var(--fg)";
    overlay.style.fontSize = "13px";
    overlay.style.boxShadow = "0 4px 18px rgba(0,0,0,0.45)";
    overlay.style.zIndex = "2000";
    overlay.innerHTML = `
      <div style="font-weight:600;font-size:14px;color:var(--accent-2)">
        Hubble's 1929 graph, rebuilt
      </div>
      <p>That's all 24 galaxies from Hubble's original 1929 paper, plotted
        with the same numbers he used. Look at the slope of your fit-line:
        you'll get something like 500 km/s/Mpc — about 7 times the
        currently-accepted value of 70.</p>
      <p>Why? Hubble's distance scale was based on a Cepheid calibration
        that, in 1929, accidentally combined two different kinds of
        variable star into one relation. Walter Baade sorted that out in
        1952 and every distance in Hubble's paper got bigger by a factor
        of about 7 overnight — and the slope of the Hubble diagram fell
        to its modern value.</p>
      <p>Try adding the modern data on top of these points: pick galaxies
        from the side panel or use Search SDSS. You'll see the modern
        line sitting much shallower than Hubble's.</p>
      <div style="display:flex;justify-content:flex-end">
        <button type="button" class="primary" id="h1929-done">Done</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay
      .querySelector<HTMLButtonElement>("#h1929-done")
      ?.addEventListener("click", () => {
        overlay.remove();
        this.opts.onClose();
      });
    this.overlay = overlay;
  }
}

function asPlotted(g: Galaxy): PlottedGalaxy {
  return {
    ...g,
    plottedDistanceMpc: g.distanceMpc,
    plottedVelocityKmS: g.vRecKmS,
    distanceSource: "curated",
    velocitySource: "curated",
  };
}
