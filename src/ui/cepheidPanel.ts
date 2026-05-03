import * as d3 from "d3";
import type { Cepheid, Galaxy } from "../types";
import { loadCepheidCatalog } from "../data/cepheids";
import {
  PL_CALIBRATIONS,
  REDDENING_COEFF,
  absoluteMagnitudeFromPeriod,
  distanceFromMagnitudes,
  parsecsToMegaparsecs,
  wesenheitMagnitude,
} from "../data/derive";
import { openModal } from "./modal";

export interface CepheidPanelOptions {
  galaxy: Galaxy;
  // Called when the student clicks "Use this distance on the chart."
  onAccept: (galaxyId: string, distanceMpc: number) => void;
}

export class CepheidPanel {
  private opts: CepheidPanelOptions;
  constructor(opts: CepheidPanelOptions) {
    this.opts = opts;
  }

  async open(): Promise<void> {
    const { inner, close } = openModal(
      `Find ${this.opts.galaxy.name}'s distance from Cepheids`,
    );
    inner.appendChild(makeIntro());

    const status = document.createElement("p");
    status.className = "hint";
    status.textContent = "Loading Cepheid catalogue…";
    inner.appendChild(status);

    let cepheids: Cepheid[];
    try {
      cepheids = await loadCepheidCatalog(this.opts.galaxy.id);
    } catch (e) {
      status.textContent =
        e instanceof Error
          ? `Couldn't load the Cepheid catalogue: ${e.message}`
          : "Couldn't load the Cepheid catalogue.";
      return;
    }
    if (cepheids.length === 0) {
      status.textContent = "No Cepheids found for this galaxy.";
      return;
    }
    status.textContent = `Loaded ${cepheids.length} Cepheids.`;

    inner.appendChild(this.makeBody(cepheids, close));
  }

  private makeBody(cepheids: Cepheid[], _close: () => void): HTMLElement {
    const wrap = document.createElement("div");

    // Step 1 — pick a Cepheid (or "all of them" → median)
    const step1 = document.createElement("div");
    step1.className = "step";
    step1.innerHTML = `<span class="step-num">1</span><strong>Pick a Cepheid</strong>`;
    const select = document.createElement("select");
    select.style.marginLeft = "8px";
    select.appendChild(option("__median", `Use the median of all ${cepheids.length} Cepheids`));
    for (const c of cepheids) {
      const lbl = `P = ${c.periodDays.toFixed(2)} d, m = ${c.meanMag.toFixed(2)}`;
      select.appendChild(option(c.id, lbl));
    }
    step1.appendChild(select);
    wrap.appendChild(step1);

    // Step 2 — show the period and the absolute-magnitude lookup.
    const step2 = document.createElement("div");
    step2.className = "step";
    step2.innerHTML = `<span class="step-num">2</span><strong>Look up how bright it really is</strong>
      <p>Cepheid stars with longer pulses are intrinsically brighter. Riess+ 2022 measured
      the relationship using infrared light from the Hubble Space Telescope:</p>
      <div class="formula">M = a × (log<sub>10</sub>(P) − 1) + b
        <br><span class="hint">a = ${PL_CALIBRATIONS.nirF160W.a}, b = ${PL_CALIBRATIONS.nirF160W.b}, band = ${PL_CALIBRATIONS.nirF160W.band}</span>
      </div>`;
    const step2Out = document.createElement("div");
    step2.appendChild(step2Out);
    wrap.appendChild(step2);

    // Step 3 — apparent magnitude, dust-corrected.
    const step3 = document.createElement("div");
    step3.className = "step";
    step3.innerHTML = `<span class="step-num">3</span><strong>Correct for dust, then compare with how bright it looks from Earth</strong>
      <p>Dust between us and the Cepheid dims its light, making it look further away than it is.
      We can spot dusty Cepheids because dust reddens their colour. Subtracting
      a small amount of brightness based on the star's redness (V − I)
      cancels out the dust dimming — this is called the "Wesenheit" correction:</p>
      <div class="formula">m<sub>corrected</sub> = m − ${REDDENING_COEFF} × (V − I)</div>
      <p>Then the dimmer the star looks compared to its real brightness, the further away it must be:</p>
      <div class="formula">d (parsecs) = 10 ^ ((m<sub>corrected</sub> − M + 5) ÷ 5)</div>`;
    const step3Out = document.createElement("div");
    step3.appendChild(step3Out);
    wrap.appendChild(step3);

    // Step 4 — answer.
    const step4 = document.createElement("div");
    step4.className = "step";
    step4.innerHTML = `<span class="step-num">4</span><strong>Convert to megaparsecs</strong>
      <p>Galaxy distances are usually quoted in megaparsecs (Mpc) — millions of parsecs.</p>`;
    const step4Out = document.createElement("div");
    step4.appendChild(step4Out);
    wrap.appendChild(step4);

    // Plot of period vs apparent magnitude — visualises the PL relation.
    const plot = document.createElement("div");
    plot.style.marginTop = "12px";
    plot.id = "cepheid-plot";
    wrap.appendChild(plot);

    // Accept button.
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "primary";
    accept.style.marginTop = "10px";
    accept.textContent = "Use this distance on the Hubble diagram";
    wrap.appendChild(accept);

    let lastDistanceMpc = NaN;

    const recompute = () => {
      const id = select.value;
      const cal = PL_CALIBRATIONS.nirF160W;
      // Apply the Wesenheit dust correction to a single Cepheid.
      const corrected = (c: Cepheid): number =>
        c.vMinusI != null
          ? wesenheitMagnitude(c.meanMag, c.vMinusI)
          : c.meanMag;

      let period: number;
      let mag: number;       // raw mean magnitude
      let magCorr: number;   // dust-corrected magnitude
      let vmi: number;
      let label: string;
      if (id === "__median") {
        const dists = cepheids.map((c) =>
          parsecsToMegaparsecs(
            distanceFromMagnitudes(
              corrected(c),
              absoluteMagnitudeFromPeriod(c.periodDays, cal),
            ),
          ),
        );
        const sorted = [...dists].sort((a, b) => a - b);
        const median =
          sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];
        lastDistanceMpc = median;
        period = median2(cepheids.map((c) => c.periodDays));
        mag = median2(cepheids.map((c) => c.meanMag));
        vmi = median2(cepheids.map((c) => c.vMinusI ?? 1));
        magCorr = median2(cepheids.map((c) => corrected(c)));
        label = `${cepheids.length} Cepheids combined`;
      } else {
        const c = cepheids.find((x) => x.id === id);
        if (!c) return;
        period = c.periodDays;
        mag = c.meanMag;
        vmi = c.vMinusI ?? 1;
        magCorr = corrected(c);
        label = `Cepheid ${c.id}`;
      }

      const M = absoluteMagnitudeFromPeriod(period, cal);
      const d_pc = distanceFromMagnitudes(magCorr, M);
      const d_mpc = parsecsToMegaparsecs(d_pc);
      if (id !== "__median") lastDistanceMpc = d_mpc;

      step2Out.innerHTML = `
        <div class="formula">P = ${period.toFixed(2)} days
          → log<sub>10</sub>(P) = ${Math.log10(period).toFixed(3)}
          → M = ${M.toFixed(2)}</div>
      `;
      step3Out.innerHTML = `
        <div class="formula">m = ${mag.toFixed(2)}, V−I = ${vmi.toFixed(2)}
          → m<sub>corrected</sub> = ${mag.toFixed(2)} − ${REDDENING_COEFF} × ${vmi.toFixed(2)} = ${magCorr.toFixed(2)}</div>
        <div class="formula">d = 10 ^ ((${magCorr.toFixed(2)} − ${M.toFixed(2)} + 5) ÷ 5)
          ≈ ${(d_pc / 1e6).toFixed(2)} × 10⁶ parsecs</div>
      `;
      step4Out.innerHTML = `
        <div class="answer">Distance ≈ ${lastDistanceMpc.toFixed(2)} Mpc</div>
        <p class="hint">Catalogue value: ${this.opts.galaxy.distanceMpc.toFixed(2)} ± ${this.opts.galaxy.distanceMpcErr.toFixed(2)} Mpc.
          You used ${label}.</p>
      `;

      drawCepheidPlot(plot, cepheids, id === "__median" ? null : id);
    };

    select.addEventListener("change", recompute);
    accept.addEventListener("click", () => {
      if (Number.isFinite(lastDistanceMpc)) {
        this.opts.onAccept(this.opts.galaxy.id, lastDistanceMpc);
      }
    });
    recompute();
    return wrap;
  }
}

function makeIntro(): HTMLElement {
  const p = document.createElement("p");
  p.innerHTML = `
    Cepheid stars pulsate on a regular schedule — the longer the schedule,
    the more total light they actually put out. Once you time the pulse,
    you can work out how bright the star truly is, then compare with how
    bright it looks from Earth to get a distance.
  `;
  return p;
}

function option(value: string, text: string): HTMLOptionElement {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = text;
  return o;
}

function median2(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function drawCepheidPlot(
  host: HTMLElement,
  cepheids: Cepheid[],
  highlightId: string | null,
): void {
  host.replaceChildren();
  const w = host.clientWidth || 600;
  const h = 220;
  const margin = { top: 10, right: 16, bottom: 36, left: 56 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;
  const svg = d3
    .select(host)
    .append("svg")
    .attr("width", w)
    .attr("height", h);
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const periods = cepheids.map((c) => c.periodDays).filter((p) => p > 0);
  const mags = cepheids.map((c) => c.meanMag);
  const xScale = d3
    .scaleLog()
    .domain([
      Math.max(0.5, (d3.min(periods) ?? 1) * 0.9),
      (d3.max(periods) ?? 100) * 1.1,
    ])
    .range([0, innerW]);
  const yScale = d3
    .scaleLinear()
    .domain([
      (d3.max(mags) ?? 30) + 0.3,
      (d3.min(mags) ?? 20) - 0.3,
    ])
    .range([innerH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(6, "~g"))
    .call((s) =>
      s
        .append("text")
        .attr("x", innerW / 2)
        .attr("y", 32)
        .attr("fill", "#9aa6c2")
        .attr("text-anchor", "middle")
        .text("Period (days, log scale)"),
    );
  g.append("g")
    .call(d3.axisLeft(yScale).ticks(6))
    .call((s) =>
      s
        .append("text")
        .attr("transform", `rotate(-90)`)
        .attr("x", -innerH / 2)
        .attr("y", -42)
        .attr("fill", "#9aa6c2")
        .attr("text-anchor", "middle")
        .text("Apparent magnitude"),
    );

  g.selectAll("circle")
    .data(cepheids)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.periodDays))
    .attr("cy", (d) => yScale(d.meanMag))
    .attr("r", (d) => (d.id === highlightId ? 5 : 2.5))
    .attr("fill", (d) => (d.id === highlightId ? "#ffb74d" : "#6cc4ff"))
    .attr("opacity", 0.85)
    .append("title")
    .text(
      (d) =>
        `P = ${d.periodDays.toFixed(2)} d\nm = ${d.meanMag.toFixed(2)}`,
    );
}
