import * as d3 from "d3";
import type { AxisConfig, PlottedGalaxy } from "../types";
import {
  C_KM_S,
  H0_PUBLISHED_KM_S_MPC,
  fitHubbleSlope,
} from "../data/derive";
import { setColorForGalaxyId } from "../data/galaxies";
import { openModal } from "./modal";

// D3 scatter plot of distance (Mpc) vs recession velocity (km/s) or
// redshift z. Linear axes only — Hubble's law is a straight line, and
// the linear axis is the whole pedagogical move.
//
// Zoom / pan model is ported from h-r-diagram's hrDiagram.ts:
//   - Mouse-wheel anywhere in the plot → uniform zoom around cursor.
//   - Mouse-wheel over the y-axis tick area → y-only zoom.
//   - Mouse-wheel over the x-axis tick area → x-only zoom.
//   - Click-and-drag on the plot area → pan.
//   - Click on an axis tick area → "hold" that axis until release.
//   - Reset button restores defaults.
//
// Auto-scaling: by default the x-axis stretches to fit every plotted
// galaxy (no hard 200 Mpc cap). The y-axis is anchored at 0 unless
// `axes.showNegative` is on (then it dips to fit blueshifted Local
// Group galaxies).

export interface HubbleDiagramOptions {
  container: HTMLElement;
  axes: AxisConfig;
  onPointClick?: (galaxy: PlottedGalaxy) => void;
}

const MARGIN = { top: 16, right: 28, bottom: 50, left: 72 } as const;
const MIN_K = 0.5;
const MAX_K = 100;

export class HubbleDiagram {
  private opts: HubbleDiagramOptions;
  private galaxies: PlottedGalaxy[] = [];
  private selectedId: string | null = null;
  private axes: AxisConfig;
  private h0Readout: HTMLElement;
  private legend: HTMLElement;
  private chartHost: HTMLElement;
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private root!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private innerW = 0;
  private innerH = 0;
  private resizeObs: ResizeObserver;

  // Per-axis zoom transforms — same model as h-r-diagram.
  private xTransform: d3.ZoomTransform = d3.zoomIdentity;
  private yTransform: d3.ZoomTransform = d3.zoomIdentity;
  private heldAxis: "x" | "y" | null = null;
  private dragStart: {
    px: number;
    py: number;
    xT: d3.ZoomTransform;
    yT: d3.ZoomTransform;
  } | null = null;

  constructor(opts: HubbleDiagramOptions) {
    this.opts = opts;
    this.axes = opts.axes;
    opts.container.replaceChildren();

    this.h0Readout = document.createElement("div");
    this.h0Readout.className = "h0-readout";
    this.h0Readout.innerHTML = `<span class="hint">Add galaxies to see your measured Hubble constant.</span>`;
    opts.container.appendChild(this.h0Readout);

    this.legend = document.createElement("div");
    this.legend.className = "diagram-legend";
    opts.container.appendChild(this.legend);
    this.renderLegend();

    this.chartHost = document.createElement("div");
    this.chartHost.className = "hubble-chart-host";
    opts.container.appendChild(this.chartHost);

    this.svg = d3
      .select(this.chartHost)
      .append("svg")
      .attr("class", "hubble-svg")
      .attr("preserveAspectRatio", "none");
    this.root = this.svg.append("g");

    // Wheel + drag handlers (replace d3.zoom for fine-grained control).
    this.svg
      .node()
      ?.addEventListener("wheel", this.onWheel, { passive: false });
    this.svg.on("mousedown", (e: MouseEvent) => this.onMouseDown(e));
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);

    this.resizeObs = new ResizeObserver(() => this.draw());
    this.resizeObs.observe(this.chartHost);
  }

  destroy(): void {
    this.resizeObs.disconnect();
    this.svg.node()?.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.svg.remove();
  }

  setStars(_unused: PlottedGalaxy[]): void {
    this.setGalaxies(_unused);
  }

  setGalaxies(g: PlottedGalaxy[]): void {
    this.galaxies = g;
    this.draw();
  }

  setAxes(axes: AxisConfig): void {
    // When switching the y-axis mode (velocity ↔ redshift) the data
    // domain changes scale completely (km/s ↔ unitless ~10⁻³). Any
    // existing y-zoom transform applied to the previous mode would
    // squash the new data out of view, so reset y zoom on a yMode
    // change. Same for showNegative — it changes the y-baseline.
    if (
      axes.yMode !== this.axes.yMode ||
      axes.showNegative !== this.axes.showNegative
    ) {
      this.yTransform = d3.zoomIdentity;
    }
    this.axes = axes;
    this.draw();
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.draw();
  }

  resetZoom(): void {
    this.xTransform = d3.zoomIdentity;
    this.yTransform = d3.zoomIdentity;
    this.draw();
  }

  // ---- event handlers ---------------------------------------------------

  private onMouseUp = (): void => {
    if (this.heldAxis !== null) {
      this.heldAxis = null;
      document.body.style.cursor = "";
    }
    if (this.dragStart) {
      this.dragStart = null;
      document.body.style.cursor = "";
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.dragStart) return;
    const node = this.svg.node();
    if (!node) return;
    const [mx, my] = d3.pointer(e, node);
    const px = mx - MARGIN.left;
    const py = my - MARGIN.top;
    const dx = px - this.dragStart.px;
    const dy = py - this.dragStart.py;
    this.xTransform = d3.zoomIdentity
      .translate(this.dragStart.xT.x + dx, 0)
      .scale(this.dragStart.xT.k);
    this.yTransform = d3.zoomIdentity
      .translate(0, this.dragStart.yT.y + dy)
      .scale(this.dragStart.yT.k);
    this.draw();
  };

  private onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    const node = this.svg.node();
    if (!node) return;
    const [mx, my] = d3.pointer(e, node);
    const px = mx - MARGIN.left;
    const py = my - MARGIN.top;
    if (px < 0 && py >= 0 && py <= this.innerH) {
      this.heldAxis = "y";
      document.body.style.cursor = "ns-resize";
      e.preventDefault();
      return;
    }
    if (py > this.innerH && px >= 0 && px <= this.innerW) {
      this.heldAxis = "x";
      document.body.style.cursor = "ew-resize";
      e.preventDefault();
      return;
    }
    if (px >= 0 && px <= this.innerW && py >= 0 && py <= this.innerH) {
      this.dragStart = {
        px,
        py,
        xT: this.xTransform,
        yT: this.yTransform,
      };
      document.body.style.cursor = "grabbing";
      e.preventDefault();
    }
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const node = this.svg.node();
    if (!node) return;
    const [mx, my] = d3.pointer(e, node);
    const px = mx - MARGIN.left;
    const py = my - MARGIN.top;
    if (px < 0 && this.heldAxis !== "x") this.heldAxis = "y";
    else if (py > this.innerH && this.heldAxis !== "y") this.heldAxis = "x";
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    if (this.heldAxis !== "y") {
      this.xTransform = scaleAroundX(this.xTransform, Math.max(0, px), factor);
    }
    if (this.heldAxis !== "x") {
      this.yTransform = scaleAroundY(this.yTransform, Math.max(0, py), factor);
    }
    // Wheel doesn't sticky-hold the axis — release it once the wheel
    // event finishes.
    if (
      (px < 0 && this.heldAxis === "y") ||
      (py > this.innerH && this.heldAxis === "x")
    ) {
      this.heldAxis = null;
    }
    this.draw();
  };

  // ---- value helpers ----------------------------------------------------

  private yValue(g: PlottedGalaxy): number {
    return this.axes.yMode === "redshift"
      ? g.plottedVelocityKmS / C_KM_S
      : g.plottedVelocityKmS;
  }

  private yLabel(): string {
    return this.axes.yMode === "redshift"
      ? "Redshift z"
      : "Recession velocity (km/s)";
  }

  private xLabel(): string {
    return "Distance (Mpc)";
  }

  private filteredGalaxies(): PlottedGalaxy[] {
    // Auto-scale by default: every plotted galaxy is shown. The
    // "Local universe" range option clamps to <= 200 Mpc as a quick
    // way to hide deep-field outliers.
    if (this.axes.range === "localOnly") {
      return this.galaxies.filter((g) => g.plottedDistanceMpc <= 200);
    }
    return this.galaxies;
  }

  // ---- main draw --------------------------------------------------------

  private draw(): void {
    const data = this.filteredGalaxies();
    const rect = this.chartHost.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(320, rect.height);
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    this.innerW = innerW;
    this.innerH = innerH;

    this.svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
    this.root.attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    this.root.selectAll("*").remove();

    // Domain — anchored at zero on both axes. Grow x to fit data; grow
    // y to fit data, dipping below zero only when showNegative is on.
    const xVals = data.map((d) => d.plottedDistanceMpc);
    const yVals = data.map((d) => this.yValue(d));
    const showNegative = this.axes.showNegative === true;

    // Default empty-chart extents. Velocity mode wants room out to a
    // few thousand km/s; redshift mode wants room out to ~0.05. Pick
    // the placeholder by yMode so the axis ticks read sensibly when
    // there's no data yet.
    const emptyYMax = this.axes.yMode === "redshift" ? 0.05 : 15000;

    let xMax = data.length ? Math.max(...xVals) : 30;
    if (!Number.isFinite(xMax) || xMax <= 0) xMax = 30;
    xMax *= 1.05;

    let yMin = 0;
    let yMax = data.length ? Math.max(...yVals) : emptyYMax;
    if (!Number.isFinite(yMax) || yMax <= 0) yMax = emptyYMax;
    if (showNegative) {
      yMin = Math.min(0, ...yVals);
    }
    const yPad = (yMax - yMin) * 0.08;
    yMax += yPad;
    if (showNegative) yMin -= yPad;

    const baseX = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
    const baseY = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);
    const xScale = this.xTransform.rescaleX(baseX);
    const yScale = this.yTransform.rescaleY(baseY);

    // Clip path so panned points don't escape the plot area.
    const clipId = `hub-clip-${Math.floor(Math.random() * 1e9).toString(36)}`;
    this.root
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH);

    // Background rect — captures drag gestures over empty plot area.
    this.root
      .append("rect")
      .attr("class", "plot-bg")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("pointer-events", "all");

    // Gridlines.
    const gridG = this.root
      .append("g")
      .attr("class", "grid")
      .attr("clip-path", `url(#${clipId})`);
    gridG
      .selectAll("line.gridline-x")
      .data(xScale.ticks(8))
      .join("line")
      .attr("class", "gridline")
      .attr("x1", (d) => xScale(d))
      .attr("x2", (d) => xScale(d))
      .attr("y1", 0)
      .attr("y2", innerH);
    gridG
      .selectAll("line.gridline-y")
      .data(yScale.ticks(8))
      .join("line")
      .attr("class", "gridline")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d));

    // Axes.
    this.root
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(7));
    this.root
      .append("g")
      .attr("class", "axis y-axis")
      .call(d3.axisLeft(yScale).ticks(7));

    // Axis labels.
    this.root
      .append("text")
      .attr("class", "axis-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 38)
      .attr("text-anchor", "middle")
      .text(this.xLabel());
    this.root
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", `translate(-52,${innerH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .text(this.yLabel());

    // Zero-velocity reference line (only meaningful with negative
    // velocities visible).
    if (showNegative && yMin < 0) {
      this.root
        .append("line")
        .attr("class", "zero-line")
        .attr("clip-path", `url(#${clipId})`)
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", yScale(0))
        .attr("y2", yScale(0));
    }

    // Best-fit slope (student's measured H₀).
    const linesG = this.root
      .append("g")
      .attr("class", "fit-lines")
      .attr("clip-path", `url(#${clipId})`);

    // Best-fit slope is computed from "direct" distances only —
    // redshift-derived points sit on a Hubble rail by construction
    // (e.g. SDSS DL = ΛCDM × z, 2MRS d = cz / 70) and would lock the
    // slope onto whatever H₀ those catalogs assumed.
    const directData = data.filter((d) => d.distanceTag === "direct");
    const extrapolatedCount = data.length - directData.length;
    if (directData.length >= 2) {
      const fit = fitHubbleSlope(
        directData.map((d) => ({
          d: d.plottedDistanceMpc,
          v: d.plottedVelocityKmS,
        })),
      );
      if (Number.isFinite(fit.h0)) {
        const xEnd = xScale.invert(innerW);
        const yEnd =
          this.axes.yMode === "redshift" ? (fit.h0 * xEnd) / C_KM_S : fit.h0 * xEnd;
        linesG
          .append("line")
          .attr("class", "best-fit-line")
          .attr("x1", xScale(0))
          .attr("y1", yScale(0))
          .attr("x2", xScale(xEnd))
          .attr("y2", yScale(yEnd));
        this.renderH0Readout(fit.h0, fit.rms, fit.n, extrapolatedCount);
      }
    } else if (data.length === 0) {
      this.h0Readout.innerHTML = `<span class="hint">Add galaxies to see your measured Hubble constant.</span>`;
    } else {
      this.h0Readout.innerHTML =
        `<span class="hint">Add at least two galaxies with directly-measured distances to see your measured Hubble constant. Redshift-extrapolated points are plotted but excluded from the fit.</span>`;
    }
    this.renderLegend();

    // Reference line at the published H₀ — only when explicitly
    // toggled on. Otherwise the student finds the value themselves
    // and we don't telegraph the answer.
    if (this.axes.showRefLine) {
      const xEnd = xScale.invert(innerW);
      const refSlope = H0_PUBLISHED_KM_S_MPC;
      const refYEnd =
        this.axes.yMode === "redshift" ? (refSlope * xEnd) / C_KM_S : refSlope * xEnd;
      linesG
        .append("line")
        .attr("class", "ref-line")
        .attr("x1", xScale(0))
        .attr("y1", yScale(0))
        .attr("x2", xScale(xEnd))
        .attr("y2", yScale(refYEnd));
      linesG
        .append("text")
        .attr("class", "ref-label")
        .attr("x", innerW - 6)
        .attr("y", yScale(refYEnd) - 6)
        .attr("text-anchor", "end")
        .text(`H₀ = ${H0_PUBLISHED_KM_S_MPC} (published)`);
    }

    // Points (clipped so out-of-view dots don't escape the chart area).
    const pointsG = this.root
      .append("g")
      .attr("class", "points")
      .attr("clip-path", `url(#${clipId})`);

    const dots = pointsG
      .selectAll<SVGCircleElement, PlottedGalaxy>("circle.galaxy")
      .data(data, (d) => d.id)
      .enter()
      .append("circle")
      .attr("class", (d) => {
        // Curated galaxies (in any GALAXY_SET) inherit their set's
        // marker colour with a yellow border, so they stay visually
        // distinct from green/cyan search-found dots. Non-curated
        // galaxies (search results, hubble1929 entries) use the
        // tag-based green/cyan fill.
        const curated = setColorForGalaxyId(d.id) != null;
        const baseClass = curated ? "curated" : `tag-${d.distanceTag}`;
        // For curated galaxies the set colour already conveys
        // category, so we don't double up with the anomaly fill —
        // anomalies in curated sets show via the data panel and the
        // `anomalies` set's red colour.
        const anomalyClass = d.isAnomaly && !curated ? " anomaly" : "";
        const selectedClass = d.id === this.selectedId ? " selected" : "";
        return `galaxy ${baseClass}${anomalyClass}${selectedClass}`;
      })
      .style("fill", (d) => setColorForGalaxyId(d.id))
      .attr("cx", (d) => xScale(d.plottedDistanceMpc))
      .attr("cy", (d) => yScale(this.yValue(d)))
      .attr("r", (d) => (d.id === this.selectedId ? 7 : 5))
      .attr("cursor", "pointer")
      .on("click", (_e, d) => this.opts.onPointClick?.(d));
    dots.append("title").text((d) => `${d.name}\n${d.claimToFame}`);
  }

  private renderH0Readout(
    h0: number,
    rms: number,
    n: number,
    extrapolatedCount: number,
  ): void {
    // The "X% above/below the published value" line only appears when
    // the user has explicitly toggled the published-H₀ reference line
    // on. Otherwise we show only the raw slope so the student isn't
    // told the answer before they've measured it.
    const exclusion =
      extrapolatedCount > 0
        ? ` &nbsp;<span class="hint">(${extrapolatedCount} extrapolated point${extrapolatedCount === 1 ? "" : "s"} excluded from fit)</span>`
        : "";
    const slope = `<div>
        Your best-fit slope:
        <span class="h0-value">${h0.toFixed(1)} km/s/Mpc</span>
        &nbsp;<span class="hint">(${n} direct galax${n === 1 ? "y" : "ies"}, scatter ${rms.toFixed(0)} km/s)</span>${exclusion}
      </div>`;
    if (!this.axes.showRefLine) {
      this.h0Readout.innerHTML = slope;
      return;
    }
    const diff = h0 - H0_PUBLISHED_KM_S_MPC;
    const diffPct = (Math.abs(diff) / H0_PUBLISHED_KM_S_MPC) * 100;
    this.h0Readout.innerHTML = `${slope}
      <div class="hint">
        Published value: ${H0_PUBLISHED_KM_S_MPC} km/s/Mpc — you're
        ${diffPct.toFixed(1)}% ${diff > 0 ? "above" : "below"}.
      </div>`;
  }

  private renderLegend(): void {
    const directCount = this.galaxies.filter(
      (g) => g.distanceTag === "direct",
    ).length;
    const extrapolatedCount = this.galaxies.length - directCount;
    this.legend.innerHTML = `
      <span class="legend-item">
        <span class="legend-swatch tag-direct"></span>
        Direct (${directCount})
      </span>
      <span class="legend-item">
        <span class="legend-swatch tag-extrapolated"></span>
        Extrapolated (${extrapolatedCount})
      </span>
      <button type="button" class="legend-help help-btn">what's this?</button>
    `;
    const helpBtn = this.legend.querySelector<HTMLButtonElement>(".legend-help");
    helpBtn?.addEventListener("click", () => this.openMethodsHelp());
  }

  private openMethodsHelp(): void {
    const { inner } = openModal("About these colours");
    inner.innerHTML = `
      <p>Galaxies on this chart come from two kinds of distance
      measurement.</p>
      <p><strong style="color: var(--accent-good)">Direct</strong>
      distances are measured from something physical inside the
      galaxy — pulsating Cepheid stars, the brightness step at the
      tip of the red giant branch, exploding Type Ia supernovae, or
      the way light spreads out from the galaxy as a whole. Each
      method gives an independent estimate, so when you plot them
      they show real scatter around Hubble's law.</p>
      <p><strong style="color: var(--accent-2)">Extrapolated</strong>
      distances aren't really measured at all — they're calculated
      from the galaxy's redshift, assuming Hubble's law in reverse.
      They're useful for filling in regions of the sky where no
      direct measurement exists, but they will always sit exactly
      on a straight line because that's how they were computed, so
      they don't help us prove Hubble's law on this graph. We can
      plot them, but we don't use them in our calculation of our
      best-fit line.</p>
    `;
  }
}

// Same scale-around-pivot helpers as h-r-diagram. Build a new
// ZoomTransform that scales around `pivot` by `factor` (>1 zooms in).
function scaleAroundX(
  t: d3.ZoomTransform,
  pivot: number,
  factor: number,
): d3.ZoomTransform {
  const newK = clampK(t.k * factor);
  const effective = newK / t.k;
  const newX = pivot - effective * (pivot - t.x);
  return d3.zoomIdentity.translate(newX, 0).scale(newK);
}
function scaleAroundY(
  t: d3.ZoomTransform,
  pivot: number,
  factor: number,
): d3.ZoomTransform {
  const newK = clampK(t.k * factor);
  const effective = newK / t.k;
  const newY = pivot - effective * (pivot - t.y);
  return d3.zoomIdentity.translate(0, newY).scale(newK);
}
function clampK(k: number): number {
  return Math.max(MIN_K, Math.min(MAX_K, k));
}
