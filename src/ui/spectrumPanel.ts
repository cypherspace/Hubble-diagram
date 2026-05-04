import * as d3 from "d3";
import type { Galaxy, SpectrumPoint } from "../types";
import { LINE_CATALOG, formatNm, findLine } from "../data/lineCatalog";
import { loadSpectrum } from "../data/spectra";
import {
  C_KM_S,
  redshiftToVelocity,
  redshiftToVelocityRelativistic,
} from "../data/derive";
import { openModal } from "./modal";

// SpectrumPanel — drag-the-line-system redesign.
//
// Pedagogically, all spectral lines from a moving galaxy shift by the
// same factor (1+z). So instead of asking the student to pick "the"
// line and drag a single marker, we show every rest-frame line as a
// faint vertical guide and let the student drag the entire line
// system left or right (equivalently: move a redshift slider). When
// the system aligns with multiple visible peaks at once, that's a
// genuine redshift — far more robust than a single-line guess.
//
// "Single-line mode" toggle keeps the original interaction available
// for users who prefer to identify one specific line.
//
// All wavelengths are displayed in nanometres (Å / 10) — the unit
// students see in physics class.

export interface SpectrumPanelOptions {
  galaxy: Galaxy;
  onAccept: (galaxyId: string, velocityKmS: number, z: number) => void;
}

// Wavelength clip bounds for display, in Å. Anchored to 4000-8000 Å
// (400-800 nm) — the visible band where every important galaxy line
// lives at z < 1.
const WL_MIN_A = 4000;
const WL_MAX_A = 8000;

interface DrawCtx {
  host: HTMLElement;
  points: SpectrumPoint[];
  z: number;
  mode: "system" | "single";
  selectedLineId: string;
  markerNm: number;
  onZChange: (z: number) => void;
  onMarkerChange: (markerNm: number) => void;
}

export class SpectrumPanel {
  private opts: SpectrumPanelOptions;
  private z = 0;
  private mode: "system" | "single" = "system";
  private selectedLineId = "h_alpha";
  // Single-mode marker, stored in nm (matches what the student sees
  // on the axis).
  private markerNm = NaN;

  constructor(opts: SpectrumPanelOptions) {
    this.opts = opts;
  }

  async open(): Promise<void> {
    const { inner } = openModal(
      `Find ${this.opts.galaxy.name}'s redshift from its spectrum`,
    );
    const intro = document.createElement("p");
    intro.innerHTML = `
      A galaxy's light, split through a prism, makes a rainbow with sharp
      lines at specific colours. The colours where these lines appear in a
      lab on Earth are known. If the same lines from a galaxy show up
      shifted toward red, the galaxy is moving away — and the size of the
      shift tells us how fast.
    `;
    inner.appendChild(intro);

    const status = document.createElement("p");
    status.className = "hint";
    status.textContent = "Loading spectrum…";
    inner.appendChild(status);

    let points: SpectrumPoint[];
    try {
      points = await loadSpectrum(this.opts.galaxy.id);
    } catch (e) {
      status.textContent =
        e instanceof Error
          ? `Couldn't load spectrum: ${e.message}`
          : "Couldn't load spectrum.";
      return;
    }
    status.remove();

    inner.appendChild(this.makeBody(points));
  }

  private makeBody(points: SpectrumPoint[]): HTMLElement {
    const wrap = document.createElement("div");

    // ---- Mode toggle: system drag vs single-line pick -----------------
    const modeRow = document.createElement("div");
    modeRow.className = "step";
    modeRow.innerHTML = `<strong>How would you like to find the redshift?</strong>`;
    const modeRadios = document.createElement("div");
    modeRadios.style.display = "flex";
    modeRadios.style.flexWrap = "wrap";
    modeRadios.style.gap = "12px";
    modeRadios.style.marginTop = "6px";
    const sysRadio = makeRadio(
      "spec-mode",
      "system",
      "Drag the whole line system",
      this.mode === "system",
    );
    const singleRadio = makeRadio(
      "spec-mode",
      "single",
      "Pick a single line (advanced)",
      this.mode === "single",
    );
    sysRadio.input.addEventListener("change", () => {
      this.mode = "system";
      redraw();
    });
    singleRadio.input.addEventListener("change", () => {
      this.mode = "single";
      redraw();
    });
    modeRadios.append(sysRadio.label, singleRadio.label);
    modeRow.appendChild(modeRadios);
    wrap.appendChild(modeRow);

    // ---- Single-line dropdown (only shown in "single" mode) -----------
    const singleControls = document.createElement("div");
    singleControls.className = "step";
    singleControls.innerHTML = `<strong>Pick the line you've identified:</strong> `;
    const dropdown = document.createElement("select");
    for (const line of LINE_CATALOG) {
      const o = document.createElement("option");
      o.value = line.id;
      o.textContent = `${line.label} (${formatNm(line.restAngstroms)})`;
      dropdown.appendChild(o);
    }
    dropdown.value = this.selectedLineId;
    singleControls.appendChild(dropdown);
    const lineDesc = document.createElement("p");
    lineDesc.className = "hint";
    lineDesc.style.marginTop = "6px";
    singleControls.appendChild(lineDesc);
    wrap.appendChild(singleControls);
    dropdown.addEventListener("change", () => {
      this.selectedLineId = dropdown.value;
      redraw();
    });

    // ---- Redshift slider (system mode) --------------------------------
    const sliderRow = document.createElement("div");
    sliderRow.className = "step";
    sliderRow.innerHTML = `<strong>Redshift z</strong>`;
    const sliderWrap = document.createElement("div");
    sliderWrap.style.display = "flex";
    sliderWrap.style.alignItems = "center";
    sliderWrap.style.gap = "10px";
    sliderWrap.style.marginTop = "6px";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.0001";
    slider.value = "0";
    slider.style.flex = "1";
    const sliderReadout = document.createElement("span");
    sliderReadout.style.fontFamily = "monospace";
    sliderReadout.style.minWidth = "8em";
    sliderReadout.textContent = "z = 0.0000";
    slider.addEventListener("input", () => {
      this.z = parseFloat(slider.value);
      redraw();
    });
    sliderWrap.append(slider, sliderReadout);
    sliderRow.appendChild(sliderWrap);
    const sliderHint = document.createElement("p");
    sliderHint.className = "hint";
    sliderHint.style.marginTop = "4px";
    sliderHint.textContent =
      "Drag the slider (or drag the green line system on the chart) until the lines line up with peaks in the spectrum.";
    sliderRow.appendChild(sliderHint);
    wrap.appendChild(sliderRow);

    // ---- Plot ---------------------------------------------------------
    const plotHost = document.createElement("div");
    plotHost.style.minHeight = "260px";
    plotHost.style.position = "relative";
    wrap.appendChild(plotHost);

    // ---- Result block + accept ---------------------------------------
    const result = document.createElement("div");
    result.className = "step";
    result.innerHTML = `<strong>Result</strong><div class="redshift-result"></div>`;
    wrap.appendChild(result);
    const resultEl = result.querySelector(".redshift-result") as HTMLElement;

    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "primary";
    accept.style.marginTop = "10px";
    accept.textContent = "Use this redshift on the Hubble diagram";
    accept.disabled = true;
    wrap.appendChild(accept);

    let lastVelocityKmS = NaN;
    let lastZ = NaN;

    const redraw = () => {
      // Visibility of mode-specific controls.
      singleControls.style.display = this.mode === "single" ? "" : "none";
      sliderRow.style.display = this.mode === "system" ? "" : "none";

      const line = findLine(this.selectedLineId);
      if (line) lineDesc.textContent = line.description;

      drawSpectrum({
        host: plotHost,
        points,
        z: this.z,
        mode: this.mode,
        selectedLineId: this.selectedLineId,
        markerNm: this.markerNm,
        onZChange: (newZ) => {
          this.z = clamp(newZ, 0, 1);
          slider.value = String(this.z);
          redraw();
        },
        onMarkerChange: (m) => {
          this.markerNm = m;
          redraw();
        },
      });

      slider.value = String(this.z);
      sliderReadout.textContent = `z = ${this.z.toFixed(4)}`;

      // Compute the result for whichever mode is active.
      let z = NaN;
      let modeNote = "";
      if (this.mode === "system") {
        z = this.z;
        modeNote = "Read directly from the line-system slider.";
      } else if (line && Number.isFinite(this.markerNm)) {
        const restNm = line.restAngstroms / 10;
        z = (this.markerNm - restNm) / restNm;
        modeNote = `From λ<sub>obs</sub> = ${this.markerNm.toFixed(2)} nm vs λ<sub>rest</sub> = ${restNm.toFixed(2)} nm.`;
      }

      if (!Number.isFinite(z) || z === 0) {
        if (this.mode === "system") {
          resultEl.innerHTML = `<p class="hint">Drag the slider or the green lines on the chart to find a redshift where the lines align with visible peaks.</p>`;
        } else {
          resultEl.innerHTML = `<p class="hint">Click on the spectrum to mark where you think you see ${line?.label ?? "the line"}.</p>`;
        }
        accept.disabled = true;
        return;
      }
      lastZ = z;
      lastVelocityKmS =
        Math.abs(z) > 0.1 ? redshiftToVelocityRelativistic(z) : redshiftToVelocity(z);
      const formula =
        Math.abs(z) > 0.1
          ? "Used relativistic Doppler formula because z &gt; 0.1."
          : `v = c × z, with c = ${C_KM_S.toFixed(0)} km/s.`;
      resultEl.innerHTML = `
        <div class="formula">z = ${z.toFixed(4)} (${z.toExponential(3)})</div>
        <div class="answer">v ≈ ${lastVelocityKmS.toFixed(0)} km/s</div>
        <p class="hint">${modeNote} ${formula}<br>
          Catalogue value for ${this.opts.galaxy.name}:
          v = ${this.opts.galaxy.vRecKmS} km/s
          (z = ${this.opts.galaxy.z.toExponential(3)}).</p>
      `;
      accept.disabled = false;
    };

    accept.addEventListener("click", () => {
      if (Number.isFinite(lastVelocityKmS)) {
        this.opts.onAccept(this.opts.galaxy.id, lastVelocityKmS, lastZ);
      }
    });

    setTimeout(redraw, 0);
    return wrap;
  }
}

function makeRadio(
  name: string,
  value: string,
  label: string,
  checked: boolean,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const lbl = document.createElement("label");
  lbl.style.display = "inline-flex";
  lbl.style.gap = "6px";
  lbl.style.alignItems = "center";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  lbl.append(input, document.createTextNode(label));
  return { label: lbl, input };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function drawSpectrum(ctx: DrawCtx): void {
  const host = ctx.host;
  host.replaceChildren();
  const w = host.clientWidth || 700;
  const h = 280;
  const margin = { top: 14, right: 16, bottom: 36, left: 56 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  // X domain in nm, hard-clipped to 400-800.
  const xMinNm = WL_MIN_A / 10;
  const xMaxNm = WL_MAX_A / 10;
  const xScale = d3.scaleLinear().domain([xMinNm, xMaxNm]).range([0, innerW]);

  // Filter spectrum points to the visible window, then build y domain.
  const inWindow = ctx.points.filter(
    (p) =>
      p.wavelengthAngstroms >= WL_MIN_A &&
      p.wavelengthAngstroms <= WL_MAX_A &&
      Number.isFinite(p.flux),
  );
  const fluxes = inWindow.map((p) => p.flux);
  const yMin = Math.min(0, ...fluxes);
  const yMax = (Math.max(...fluxes, 1)) * 1.05;
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

  const svg = d3
    .select(host)
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .style("cursor", ctx.mode === "system" ? "ew-resize" : "crosshair");
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // X axis (nm).
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(8))
    .call((s) =>
      s
        .append("text")
        .attr("x", innerW / 2)
        .attr("y", 30)
        .attr("fill", "#8b95b8")
        .attr("text-anchor", "middle")
        .text("Wavelength (nm)"),
    );
  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale).ticks(5))
    .call((s) =>
      s
        .append("text")
        .attr("transform", `rotate(-90)`)
        .attr("x", -innerH / 2)
        .attr("y", -42)
        .attr("fill", "#8b95b8")
        .attr("text-anchor", "middle")
        .text("Flux"),
    );

  // Spectrum trace (clipped to the window).
  const linePath = d3
    .line<SpectrumPoint>()
    .x((d) => xScale(d.wavelengthAngstroms / 10))
    .y((d) => yScale(d.flux));
  g.append("path")
    .datum(inWindow)
    .attr("fill", "none")
    .attr("stroke", "#9bd3ff")
    .attr("stroke-width", 1)
    .attr("d", linePath);

  // Rest-frame line system, shifted to (1+z)·rest.
  const lineGroup = g.append("g").attr("class", "line-system");
  const visibleLines = LINE_CATALOG.filter(
    (l) =>
      l.restAngstroms >= WL_MIN_A * 0.5 && l.restAngstroms <= WL_MAX_A * 1.5,
  );
  for (const ln of visibleLines) {
    const obsNm = (ln.restAngstroms * (1 + ctx.z)) / 10;
    if (obsNm < xMinNm || obsNm > xMaxNm) continue;
    const isSelected = ctx.mode === "single" && ln.id === ctx.selectedLineId;
    lineGroup
      .append("line")
      .attr("class", "line-guide")
      .attr("x1", xScale(obsNm))
      .attr("x2", xScale(obsNm))
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", isSelected ? "#ffd166" : "#6dd58c")
      .attr(
        "stroke-dasharray",
        isSelected || ctx.mode === "system" ? "0" : "3,3",
      )
      .attr("stroke-width", isSelected ? 2 : 1)
      .attr("opacity", ctx.mode === "system" ? 0.85 : isSelected ? 0.9 : 0.35);
    // Label only the strong, well-known lines so the chart isn't busy.
    if (
      ln.id === "h_alpha" ||
      ln.id === "h_beta" ||
      ln.id === "oiii_5007" ||
      ln.id === "ca_k" ||
      isSelected
    ) {
      lineGroup
        .append("text")
        .attr("x", xScale(obsNm))
        .attr("y", -2)
        .attr("text-anchor", "middle")
        .attr("fill", isSelected ? "#ffd166" : "#6dd58c")
        .attr("font-size", 10)
        .text(ln.label);
    }
  }

  // ---- System-mode drag: drag the line system → adjust z. ----------
  if (ctx.mode === "system") {
    // Invisible drag overlay covering the line area.
    const dragRect = g
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "ew-resize");

    let startPxNm = NaN;
    let startZ = ctx.z;

    const onMove = (event: MouseEvent) => {
      if (!Number.isFinite(startPxNm)) return;
      const [px] = d3.pointer(event, svg.node());
      const nowNm = xScale.invert(px - margin.left);
      // ∂z ≈ ∂λ / λ_rest. Hα (656.3 nm) is the brightest line, so use
      // it as the reference — accurate to within a few % over [400,
      // 800] nm.
      const refNm = 656.3;
      const dNm = nowNm - startPxNm;
      ctx.onZChange(startZ + dNm / refNm);
    };
    const onUp = () => {
      startPxNm = NaN;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    dragRect.on("mousedown", (event: MouseEvent) => {
      const [px] = d3.pointer(event, svg.node());
      startPxNm = xScale.invert(px - margin.left);
      startZ = ctx.z;
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      event.preventDefault();
    });
  }

  // ---- Single-mode click marker --------------------------------------
  if (ctx.mode === "single") {
    if (Number.isFinite(ctx.markerNm)) {
      const mNm = ctx.markerNm;
      if (mNm >= xMinNm && mNm <= xMaxNm) {
        g.append("line")
          .attr("x1", xScale(mNm))
          .attr("x2", xScale(mNm))
          .attr("y1", 0)
          .attr("y2", innerH)
          .attr("stroke", "#ffb74d")
          .attr("stroke-width", 2);
        g.append("text")
          .attr("x", xScale(mNm))
          .attr("y", 12)
          .attr("text-anchor", "middle")
          .attr("fill", "#ffb74d")
          .attr("font-size", 11)
          .text(`λ_obs = ${mNm.toFixed(1)} nm`);
      }
    }
    svg.on("click", (event: MouseEvent) => {
      const [px] = d3.pointer(event, svg.node());
      const nm = xScale.invert(px - margin.left);
      if (nm >= xMinNm && nm <= xMaxNm) ctx.onMarkerChange(nm);
    });
  }
}

