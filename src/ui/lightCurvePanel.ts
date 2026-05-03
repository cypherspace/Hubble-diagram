import * as d3 from "d3";
import type { CepheidLightCurve, Galaxy } from "../types";
import { loadLightCurves } from "../data/lightCurves";
import {
  PL_CALIBRATIONS,
  absoluteMagnitudeFromPeriod,
  distanceFromMagnitudes,
  foldLightCurve,
  meanMagFromFolded,
  parsecsToMegaparsecs,
} from "../data/derive";
import { openModal } from "./modal";

export interface LightCurvePanelOptions {
  galaxy: Galaxy;
  onAccept: (galaxyId: string, distanceMpc: number) => void;
}

export class LightCurvePanel {
  private opts: LightCurvePanelOptions;
  constructor(opts: LightCurvePanelOptions) {
    this.opts = opts;
  }

  async open(): Promise<void> {
    const { inner } = openModal(
      `Find ${this.opts.galaxy.name}'s distance by folding a light curve`,
    );

    const intro = document.createElement("p");
    intro.innerHTML = `
      Cepheid stars in nearby galaxies have been monitored for decades by
      surveys like OGLE. The data below shows one star's brightness over
      thousands of nights of observation. Drag the slider to find a
      "trial period" — when you hit the right value, the points line up
      into a single repeating shape.
    `;
    inner.appendChild(intro);

    const status = document.createElement("p");
    status.className = "hint";
    status.textContent = "Loading light curves…";
    inner.appendChild(status);

    let curves: CepheidLightCurve[];
    try {
      curves = await loadLightCurves(this.opts.galaxy.id);
    } catch (e) {
      status.textContent =
        e instanceof Error ? `Couldn't load light curves: ${e.message}` : "Couldn't load light curves.";
      return;
    }
    if (curves.length === 0) {
      status.textContent = "No light curves bundled for this galaxy.";
      return;
    }
    status.remove();

    inner.appendChild(this.makeBody(curves));
  }

  private makeBody(curves: CepheidLightCurve[]): HTMLElement {
    const wrap = document.createElement("div");

    const select = document.createElement("select");
    for (const c of curves) {
      const o = document.createElement("option");
      o.value = c.cepheidId;
      o.textContent = `${c.cepheidId} (${c.points.length} measurements)`;
      select.appendChild(o);
    }

    const pickStep = document.createElement("div");
    pickStep.className = "step";
    pickStep.innerHTML = `<span class="step-num">1</span><strong>Pick a Cepheid:</strong> `;
    pickStep.appendChild(select);
    wrap.appendChild(pickStep);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0.5";
    slider.max = "100";
    slider.step = "0.05";
    slider.value = "10";
    slider.style.width = "100%";

    const sliderStep = document.createElement("div");
    sliderStep.className = "step";
    sliderStep.innerHTML = `<span class="step-num">2</span><strong>Find the period</strong>
      <p>Drag this slider until the folded curve forms a single clean loop.</p>`;
    const sliderRow = document.createElement("div");
    sliderRow.style.display = "flex";
    sliderRow.style.alignItems = "center";
    sliderRow.style.gap = "8px";
    const periodReadout = document.createElement("span");
    periodReadout.style.minWidth = "80px";
    periodReadout.style.fontFamily = "monospace";
    sliderRow.append(slider, periodReadout);
    sliderStep.appendChild(sliderRow);
    const hintBtn = document.createElement("button");
    hintBtn.type = "button";
    hintBtn.style.marginTop = "6px";
    hintBtn.textContent = "Show me a hint";
    sliderStep.appendChild(hintBtn);
    wrap.appendChild(sliderStep);

    const rawHost = document.createElement("div");
    rawHost.style.minHeight = "180px";
    wrap.appendChild(rawHost);
    const foldedHost = document.createElement("div");
    foldedHost.style.minHeight = "180px";
    wrap.appendChild(foldedHost);

    const result = document.createElement("div");
    result.className = "step";
    result.innerHTML = `<span class="step-num">3</span><strong>Read off the mean brightness</strong>
      <div id="lc-out"></div>`;
    wrap.appendChild(result);

    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "primary";
    accept.style.marginTop = "10px";
    accept.textContent = "Use this distance on the Hubble diagram";
    wrap.appendChild(accept);

    let lastDistanceMpc = NaN;

    const redraw = () => {
      const curve = curves.find((c) => c.cepheidId === select.value)!;
      const trial = parseFloat(slider.value);
      periodReadout.textContent = `${trial.toFixed(2)} d`;
      drawRaw(rawHost, curve.points);
      const folded = foldLightCurve(curve.points, trial);
      drawFolded(foldedHost, folded);

      const meanMag = meanMagFromFolded(folded);
      // We use the OPTICAL V-band calibration here, since OGLE data
      // is V/I band, not the SH0ES NIR F160W band.
      const M = absoluteMagnitudeFromPeriod(trial, PL_CALIBRATIONS.opticalV);
      const d_pc = distanceFromMagnitudes(meanMag, M);
      lastDistanceMpc = parsecsToMegaparsecs(d_pc);

      const out = document.getElementById("lc-out") as HTMLElement;
      // Compare to true period to give the student feedback on whether
      // they've actually found the right answer (this is meant to be
      // educational, not a guessing game).
      const periodOff = Math.abs(trial - curve.truePeriodDays) / curve.truePeriodDays;
      const fbColor = periodOff < 0.02 ? "#6dd58c" : periodOff < 0.1 ? "#ffb74d" : "#ff7b7b";
      out.innerHTML = `
        <div class="formula">P = ${trial.toFixed(2)} d → M = ${M.toFixed(2)}</div>
        <div class="formula">m (median of folded curve) = ${meanMag.toFixed(2)}
          → d ≈ ${lastDistanceMpc.toFixed(3)} Mpc</div>
        <p style="color:${fbColor}">${
          periodOff < 0.02
            ? "✓ Excellent match to the published period."
            : periodOff < 0.1
              ? "Close — fine-tune the slider."
              : "Period looks off — try other values."
        }</p>
        <p class="hint">Catalogue distance: ${this.opts.galaxy.distanceMpc.toFixed(3)} Mpc.
          Published period for this Cepheid: ${curve.truePeriodDays.toFixed(2)} d.</p>
      `;
    };

    select.addEventListener("change", redraw);
    slider.addEventListener("input", redraw);
    hintBtn.addEventListener("click", () => {
      const curve = curves.find((c) => c.cepheidId === select.value)!;
      // Drop the slider near the right answer and redraw.
      slider.value = String(curve.truePeriodDays);
      redraw();
    });
    accept.addEventListener("click", () => {
      if (Number.isFinite(lastDistanceMpc)) {
        this.opts.onAccept(this.opts.galaxy.id, lastDistanceMpc);
      }
    });
    setTimeout(redraw, 0);
    return wrap;
  }
}

function drawRaw(
  host: HTMLElement,
  points: { jd: number; mag: number }[],
): void {
  host.replaceChildren();
  const w = host.clientWidth || 600;
  const h = 180;
  const margin = { top: 10, right: 16, bottom: 30, left: 50 };
  const svg = d3.select(host).append("svg").attr("width", w).attr("height", h);
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;
  const xExt = d3.extent(points, (p) => p.jd) as [number, number];
  const xScale = d3.scaleLinear().domain(xExt).range([0, innerW]);
  const yScale = d3
    .scaleLinear()
    .domain([
      (d3.max(points, (p) => p.mag) ?? 20) + 0.1,
      (d3.min(points, (p) => p.mag) ?? 19) - 0.1,
    ])
    .range([innerH, 0]);
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(5));
  g.append("g").call(d3.axisLeft(yScale).ticks(4));
  g.append("text")
    .attr("x", 4)
    .attr("y", 12)
    .attr("fill", "#9aa6c2")
    .attr("font-size", 11)
    .text("Raw light curve (Julian Date vs apparent magnitude)");
  g.selectAll("circle")
    .data(points)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.jd))
    .attr("cy", (d) => yScale(d.mag))
    .attr("r", 1.5)
    .attr("fill", "#9bd3ff")
    .attr("opacity", 0.6);
}

function drawFolded(
  host: HTMLElement,
  folded: { phase: number; mag: number }[],
): void {
  host.replaceChildren();
  const w = host.clientWidth || 600;
  const h = 180;
  const margin = { top: 10, right: 16, bottom: 30, left: 50 };
  const svg = d3.select(host).append("svg").attr("width", w).attr("height", h);
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;
  const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
  const yScale = d3
    .scaleLinear()
    .domain([
      (d3.max(folded, (p) => p.mag) ?? 20) + 0.1,
      (d3.min(folded, (p) => p.mag) ?? 19) - 0.1,
    ])
    .range([innerH, 0]);
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(5));
  g.append("g").call(d3.axisLeft(yScale).ticks(4));
  g.append("text")
    .attr("x", 4)
    .attr("y", 12)
    .attr("fill", "#9aa6c2")
    .attr("font-size", 11)
    .text("Folded light curve (phase 0–1)");
  g.selectAll("circle")
    .data(folded)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.phase))
    .attr("cy", (d) => yScale(d.mag))
    .attr("r", 2)
    .attr("fill", "#6dd58c")
    .attr("opacity", 0.85);
}
