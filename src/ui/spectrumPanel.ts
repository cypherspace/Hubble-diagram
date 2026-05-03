import * as d3 from "d3";
import type { Galaxy, SpectrumPoint } from "../types";
import { LINE_CATALOG, findLine } from "../data/lineCatalog";
import { loadSpectrum } from "../data/spectra";
import {
  C_KM_S,
  redshiftFromWavelengths,
  redshiftToVelocity,
  redshiftToVelocityRelativistic,
} from "../data/derive";
import { openModal } from "./modal";

export interface SpectrumPanelOptions {
  galaxy: Galaxy;
  onAccept: (galaxyId: string, velocityKmS: number, z: number) => void;
}

export class SpectrumPanel {
  private opts: SpectrumPanelOptions;
  // Drag state — student's marker wavelength.
  private markerWavelength = NaN;
  private selectedLineId = "h_alpha";

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
        e instanceof Error ? `Couldn't load spectrum: ${e.message}` : "Couldn't load spectrum.";
      return;
    }
    status.remove();

    inner.appendChild(this.makeBody(points));
  }

  private makeBody(points: SpectrumPoint[]): HTMLElement {
    const wrap = document.createElement("div");

    const dropdown = document.createElement("select");
    for (const line of LINE_CATALOG) {
      const o = document.createElement("option");
      o.value = line.id;
      o.textContent = `${line.label} (${line.restAngstroms.toFixed(1)} Å)`;
      dropdown.appendChild(o);
    }
    dropdown.value = this.selectedLineId;

    const dropdownGroup = document.createElement("div");
    dropdownGroup.className = "step";
    dropdownGroup.innerHTML = `<span class="step-num">1</span><strong>Pick which line you've found:</strong> `;
    dropdownGroup.appendChild(dropdown);
    const lineDescription = document.createElement("p");
    lineDescription.className = "hint";
    lineDescription.style.marginTop = "6px";
    dropdownGroup.appendChild(lineDescription);
    wrap.appendChild(dropdownGroup);

    // Drag instruction
    const dragInstr = document.createElement("div");
    dragInstr.className = "step";
    dragInstr.innerHTML = `<span class="step-num">2</span><strong>Click on the spectrum where you see this line.</strong>
      <p class="hint">Tick marks below show where each lab line <em>would</em> sit if the galaxy weren't moving.
      The line you've selected appears as a vertical guide.</p>`;
    wrap.appendChild(dragInstr);

    const plotHost = document.createElement("div");
    plotHost.style.minHeight = "260px";
    wrap.appendChild(plotHost);

    // Result block
    const result = document.createElement("div");
    result.className = "step";
    result.innerHTML = `<span class="step-num">3</span><strong>Compute the redshift</strong>
      <div id="redshift-out"></div>`;
    wrap.appendChild(result);

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
      const line = findLine(this.selectedLineId);
      if (!line) return;
      lineDescription.textContent = line.description;
      drawSpectrum(plotHost, points, line.restAngstroms, this.markerWavelength, (w) => {
        this.markerWavelength = w;
        redraw();
      });
      const out = document.getElementById("redshift-out") as HTMLElement;
      if (!Number.isFinite(this.markerWavelength)) {
        out.innerHTML = `<p class="hint">Click on the spectrum to mark where you think you see ${line.label}.</p>`;
        accept.disabled = true;
        return;
      }
      lastZ = redshiftFromWavelengths(this.markerWavelength, line.restAngstroms);
      lastVelocityKmS =
        Math.abs(lastZ) > 0.1
          ? redshiftToVelocityRelativistic(lastZ)
          : redshiftToVelocity(lastZ);
      out.innerHTML = `
        <div class="formula">
          λ<sub>observed</sub> = ${this.markerWavelength.toFixed(1)} Å,
          λ<sub>rest</sub> = ${line.restAngstroms.toFixed(1)} Å<br>
          z = (${this.markerWavelength.toFixed(1)} − ${line.restAngstroms.toFixed(1)}) ÷ ${line.restAngstroms.toFixed(1)} = ${lastZ.toExponential(3)}
        </div>
        <div class="answer">v ≈ ${lastVelocityKmS.toFixed(0)} km/s</div>
        <p class="hint">${
          Math.abs(lastZ) > 0.1
            ? "Used relativistic Doppler formula because z &gt; 0.1."
            : `v = c × z, with c = ${C_KM_S.toFixed(0)} km/s.`
        } Catalogue: ${this.opts.galaxy.vRecKmS} km/s (z = ${this.opts.galaxy.z.toExponential(3)}).</p>
      `;
      accept.disabled = false;
    };

    dropdown.addEventListener("change", () => {
      this.selectedLineId = dropdown.value;
      redraw();
    });
    accept.addEventListener("click", () => {
      if (Number.isFinite(lastVelocityKmS)) {
        this.opts.onAccept(this.opts.galaxy.id, lastVelocityKmS, lastZ);
      }
    });

    setTimeout(redraw, 0);
    return wrap;
  }
}

function drawSpectrum(
  host: HTMLElement,
  points: SpectrumPoint[],
  restWavelength: number,
  markerWavelength: number,
  onClick: (wavelength: number) => void,
): void {
  host.replaceChildren();
  const w = host.clientWidth || 700;
  const h = 280;
  const margin = { top: 10, right: 16, bottom: 36, left: 56 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;
  const svg = d3
    .select(host)
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .style("cursor", "crosshair");
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xExt = d3.extent(points, (d) => d.wavelengthAngstroms) as [number, number];
  const xScale = d3.scaleLinear().domain(xExt).range([0, innerW]);
  const fluxes = points.map((p) => p.flux).filter((v) => Number.isFinite(v));
  const yScale = d3
    .scaleLinear()
    .domain([Math.min(0, d3.min(fluxes) ?? 0), (d3.max(fluxes) ?? 1) * 1.05])
    .range([innerH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(8))
    .call((s) =>
      s
        .append("text")
        .attr("x", innerW / 2)
        .attr("y", 30)
        .attr("fill", "#9aa6c2")
        .attr("text-anchor", "middle")
        .text("Wavelength (Å)"),
    );
  g.append("g")
    .call(d3.axisLeft(yScale).ticks(5))
    .call((s) =>
      s
        .append("text")
        .attr("transform", `rotate(-90)`)
        .attr("x", -innerH / 2)
        .attr("y", -42)
        .attr("fill", "#9aa6c2")
        .attr("text-anchor", "middle")
        .text("Flux"),
    );

  // Spectrum trace
  const line = d3
    .line<SpectrumPoint>()
    .x((d) => xScale(d.wavelengthAngstroms))
    .y((d) => yScale(d.flux));
  g.append("path")
    .datum(points)
    .attr("fill", "none")
    .attr("stroke", "#9bd3ff")
    .attr("stroke-width", 1)
    .attr("d", line);

  // Rest-frame line ticks (all lines, dim)
  for (const lineDef of LINE_CATALOG) {
    if (lineDef.restAngstroms < xExt[0] || lineDef.restAngstroms > xExt[1]) continue;
    g.append("line")
      .attr("x1", xScale(lineDef.restAngstroms))
      .attr("x2", xScale(lineDef.restAngstroms))
      .attr("y1", innerH - 8)
      .attr("y2", innerH)
      .attr("stroke", "#6dd58c")
      .attr("opacity", 0.5);
  }

  // Highlight the selected line at its rest position
  if (restWavelength >= xExt[0] && restWavelength <= xExt[1]) {
    g.append("line")
      .attr("x1", xScale(restWavelength))
      .attr("x2", xScale(restWavelength))
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "#6dd58c")
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.7);
    g.append("text")
      .attr("x", xScale(restWavelength))
      .attr("y", -2)
      .attr("text-anchor", "middle")
      .attr("fill", "#6dd58c")
      .attr("font-size", 11)
      .text(`λ_rest = ${restWavelength.toFixed(1)} Å`);
  }

  // Marker (student's choice)
  if (Number.isFinite(markerWavelength)) {
    g.append("line")
      .attr("x1", xScale(markerWavelength))
      .attr("x2", xScale(markerWavelength))
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "#ffb74d")
      .attr("stroke-width", 2);
    g.append("text")
      .attr("x", xScale(markerWavelength))
      .attr("y", 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#ffb74d")
      .attr("font-size", 11)
      .text(`λ_obs = ${markerWavelength.toFixed(1)} Å`);
  }

  // Click handler
  svg.on("click", (event) => {
    const [px] = d3.pointer(event, svg.node());
    const dataX = xScale.invert(px - margin.left);
    if (dataX >= xExt[0] && dataX <= xExt[1]) onClick(dataX);
  });
}
