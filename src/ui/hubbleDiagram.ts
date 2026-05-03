import * as d3 from "d3";
import type { AxisConfig, PlottedGalaxy } from "../types";
import {
  C_KM_S,
  H0_PUBLISHED_KM_S_MPC,
  fitHubbleSlope,
} from "../data/derive";

// D3 scatter plot of distance (Mpc) vs recession velocity (km/s) or
// redshift z. Linear axes only — Hubble's law is a straight line, and
// the linear axis is the whole pedagogical move. A best-fit line
// through the origin is overlaid in real time and labelled with the
// current slope (the student's measured H₀).

export interface HubbleDiagramOptions {
  container: HTMLElement;
  axes: AxisConfig;
  onPointClick?: (galaxy: PlottedGalaxy) => void;
}

const MARGIN = { top: 16, right: 28, bottom: 48, left: 64 };

export class HubbleDiagram {
  private opts: HubbleDiagramOptions;
  private galaxies: PlottedGalaxy[] = [];
  private selectedId: string | null = null;
  private axes: AxisConfig;
  private h0Readout: HTMLElement;
  private chartHost: HTMLElement;

  constructor(opts: HubbleDiagramOptions) {
    this.opts = opts;
    this.axes = opts.axes;
    opts.container.replaceChildren();

    this.h0Readout = document.createElement("div");
    this.h0Readout.className = "h0-readout";
    this.h0Readout.innerHTML = `<span class="hint">Add galaxies to see your measured Hubble constant.</span>`;
    opts.container.appendChild(this.h0Readout);

    this.chartHost = document.createElement("div");
    this.chartHost.style.flex = "1";
    this.chartHost.style.minHeight = "320px";
    opts.container.appendChild(this.chartHost);

    window.addEventListener("resize", () => this.draw());
  }

  setStars(_unused: PlottedGalaxy[]): void {
    // Backwards-compatible alias from h-r-diagram naming, just in case.
    this.setGalaxies(_unused);
  }

  setGalaxies(g: PlottedGalaxy[]): void {
    this.galaxies = g;
    this.draw();
  }

  setAxes(axes: AxisConfig): void {
    this.axes = axes;
    this.draw();
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.draw();
  }

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
    // Default range hides the high-z deep-field galaxies so the
    // basic linear Hubble's law is the first thing the student sees.
    if (this.axes.range === "extreme") return this.galaxies;
    return this.galaxies.filter(
      (g) => g.plottedDistanceMpc <= 200,
    );
  }

  private draw(): void {
    const data = this.filteredGalaxies();
    const host = this.chartHost;
    host.replaceChildren();
    const w = host.clientWidth || 480;
    const h = host.clientHeight || 360;

    const svg = d3
      .select(host)
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .attr("viewBox", `0 0 ${w} ${h}`);

    const innerW = w - MARGIN.left - MARGIN.right;
    const innerH = h - MARGIN.top - MARGIN.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Domains. Pad the axes so M31's negative velocity has somewhere
    // to live and the deep-field galaxies (when shown) get headroom.
    const xMax = data.length
      ? d3.max(data, (d) => d.plottedDistanceMpc) ?? 1
      : 30;
    const yVals = data.map((d) => this.yValue(d));
    const yMin = data.length ? Math.min(0, d3.min(yVals) ?? 0) : 0;
    const yMax = data.length ? Math.max(d3.max(yVals) ?? 1, 1) : 1;
    const xPad = xMax * 0.05;
    const yPad = (yMax - yMin) * 0.08;
    const xScale = d3
      .scaleLinear()
      .domain([0, xMax + xPad])
      .range([0, innerW]);
    const yScale = d3
      .scaleLinear()
      .domain([yMin - yPad, yMax + yPad])
      .range([innerH, 0]);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .call((sel) =>
        sel
          .append("text")
          .attr("x", innerW / 2)
          .attr("y", 36)
          .attr("fill", "#9aa6c2")
          .attr("text-anchor", "middle")
          .text(this.xLabel()),
      );
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(6))
      .call((sel) =>
        sel
          .append("text")
          .attr("transform", `rotate(-90)`)
          .attr("x", -innerH / 2)
          .attr("y", -48)
          .attr("fill", "#9aa6c2")
          .attr("text-anchor", "middle")
          .text(this.yLabel()),
      );

    // Zero-velocity reference line (matters for blueshifted Local Group).
    if (yMin < 0) {
      g.append("line")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", yScale(0))
        .attr("y2", yScale(0))
        .attr("stroke", "#2a3470")
        .attr("stroke-dasharray", "3,3");
    }

    // Best-fit slope (student's measured H₀).
    if (data.length >= 2) {
      const fit = fitHubbleSlope(
        data.map((d) => ({
          d: d.plottedDistanceMpc,
          v: d.plottedVelocityKmS,
        })),
      );
      if (Number.isFinite(fit.h0)) {
        const yEnd =
          this.axes.yMode === "redshift"
            ? (fit.h0 * (xMax + xPad)) / C_KM_S
            : fit.h0 * (xMax + xPad);
        g.append("line")
          .attr("x1", xScale(0))
          .attr("y1", yScale(0))
          .attr("x2", xScale(xMax + xPad))
          .attr("y2", yScale(yEnd))
          .attr("stroke", "#6cc4ff")
          .attr("stroke-width", 2)
          .attr("opacity", 0.7);
        this.renderH0Readout(fit.h0, fit.rms, fit.n);
      }
    } else {
      this.h0Readout.innerHTML = `<span class="hint">Add at least two galaxies to see your measured Hubble constant.</span>`;
    }

    // Reference line at the published H₀ for comparison.
    {
      const refSlope = H0_PUBLISHED_KM_S_MPC;
      const refYEnd =
        this.axes.yMode === "redshift"
          ? (refSlope * (xMax + xPad)) / C_KM_S
          : refSlope * (xMax + xPad);
      g.append("line")
        .attr("x1", xScale(0))
        .attr("y1", yScale(0))
        .attr("x2", xScale(xMax + xPad))
        .attr("y2", yScale(refYEnd))
        .attr("stroke", "#9aa6c2")
        .attr("stroke-dasharray", "5,4")
        .attr("stroke-width", 1)
        .attr("opacity", 0.6);
      g.append("text")
        .attr("x", innerW - 6)
        .attr("y", yScale(refYEnd) - 6)
        .attr("text-anchor", "end")
        .attr("fill", "#9aa6c2")
        .attr("font-size", 11)
        .text(`H₀ = ${H0_PUBLISHED_KM_S_MPC} (published)`);
    }

    // Points
    const dotsSel = g
      .selectAll("circle.galaxy")
      .data(data, (d) => (d as PlottedGalaxy).id)
      .enter()
      .append("circle")
      .attr("class", "galaxy")
      .attr("cx", (d) => xScale(d.plottedDistanceMpc))
      .attr("cy", (d) => yScale(this.yValue(d)))
      .attr("r", (d) => (d.id === this.selectedId ? 7 : 5))
      .attr("fill", (d) => (d.isAnomaly ? "#ffb74d" : "#9bd3ff"))
      .attr("stroke", (d) =>
        d.id === this.selectedId ? "#ffffff" : "transparent",
      )
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .on("click", (_e, d) => this.opts.onPointClick?.(d as PlottedGalaxy));
    dotsSel.append("title").text((d) => `${d.name}\n${d.claimToFame}`);
  }

  private renderH0Readout(h0: number, rms: number, n: number): void {
    const diff = h0 - H0_PUBLISHED_KM_S_MPC;
    const diffPct = (Math.abs(diff) / H0_PUBLISHED_KM_S_MPC) * 100;
    this.h0Readout.innerHTML = `
      <div>
        Your best-fit slope:
        <span class="h0-value">${h0.toFixed(1)} km/s/Mpc</span>
        &nbsp;<span class="hint">(${n} galaxies, scatter ${rms.toFixed(0)} km/s)</span>
      </div>
      <div class="hint">
        Published value: ${H0_PUBLISHED_KM_S_MPC} km/s/Mpc — you're
        ${diffPct.toFixed(1)}% ${diff > 0 ? "above" : "below"}.
      </div>`;
  }
}
