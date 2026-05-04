import * as d3 from "d3";
import katex from "katex";
import "katex/dist/katex.min.css";
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

// CepheidPanel — rebuilt for items 9 + 10:
//   - Maths rendered via KaTeX so the formulas look like the textbook
//     equations students see in class.
//   - Each step is a <details> element. The two open by default are
//     "Pick a Cepheid" (step 1) and "Result + Use this distance"
//     (final). The intermediate maths is collapsed but expandable.
//   - "Use this distance" button moved to the top of the modal so the
//     student can commit a value without scrolling through every step.
//   - Mini-Aladin viewer in step 1 shows the selected Cepheid's
//     position on PanSTARRS — useful for "where is this star?"
//     intuition.

// Aladin Lite global is already declared in skyViewer.ts as a richer
// AladinNamespace type. We narrow to the bits we need here at the call
// site rather than re-declare the global.
interface MiniAladinFns {
  gotoRaDec: (ra: number, dec: number) => void;
  setFov?: (fov: number) => void;
}

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
    const { inner } = openModal(
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

    inner.appendChild(this.makeBody(cepheids));
  }

  private makeBody(cepheids: Cepheid[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cepheid-panel";

    // --------------------------------------------------------------
    //  Top action bar — accept button visible without scrolling.
    // --------------------------------------------------------------
    const topActions = document.createElement("div");
    topActions.className = "cepheid-top-actions";
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "primary";
    accept.textContent = "Use this distance on the Hubble diagram";
    topActions.appendChild(accept);
    wrap.appendChild(topActions);

    // --------------------------------------------------------------
    //  Step 1 — pick a Cepheid (with mini-Aladin)
    // --------------------------------------------------------------
    const step1 = makeStep(
      "1",
      "Pick a Cepheid",
      true /* open by default */,
    );
    const select = document.createElement("select");
    select.style.marginRight = "8px";
    select.appendChild(
      option("__median", `Use the median of all ${cepheids.length} Cepheids`),
    );
    for (const c of cepheids) {
      const lbl = `P = ${c.periodDays.toFixed(2)} d, m = ${c.meanMag.toFixed(2)}`;
      select.appendChild(option(c.id, lbl));
    }
    step1.body.appendChild(select);

    // Mini-Aladin viewer — small, dedicated, only shows when a single
    // Cepheid is selected (skipped for the median case where there's
    // no single position to centre on).
    const aladinHost = document.createElement("div");
    aladinHost.className = "cepheid-mini-aladin";
    aladinHost.style.width = "200px";
    aladinHost.style.height = "200px";
    aladinHost.style.marginTop = "8px";
    aladinHost.style.borderRadius = "4px";
    aladinHost.style.background = "#0a0d1f";
    const aladinCaption = document.createElement("p");
    aladinCaption.className = "hint";
    aladinCaption.style.fontSize = "11px";
    aladinCaption.textContent = "Cepheid position (PanSTARRS imagery)";
    step1.body.appendChild(aladinHost);
    step1.body.appendChild(aladinCaption);
    wrap.appendChild(step1.details);

    // Aladin instance is created lazily on first single-Cepheid pick.
    let mini: MiniAladinFns | undefined;
    const ensureMini = () => {
      if (mini || !window.A) return;
      const A = window.A as unknown as {
        aladin: (sel: HTMLElement, opts: Record<string, unknown>) => MiniAladinFns;
      };
      mini = A.aladin(aladinHost, {
        survey: "P/PanSTARRS/DR1/color-z-zg-g",
        fov: 0.05,
        target: `${this.opts.galaxy.ra} ${this.opts.galaxy.dec}`,
        showReticle: false,
        showZoomControl: false,
        showFullscreenControl: false,
        showLayersControl: false,
        showGotoControl: false,
        showShareControl: false,
        showCooGrid: false,
        showFrame: false,
        showProjectionControl: false,
        cooFrame: "ICRSd",
      });
    };

    // --------------------------------------------------------------
    //  Step 2 — Look up real brightness (collapsed)
    // --------------------------------------------------------------
    const step2 = makeStep("2", "Look up how bright it really is", false);
    const step2Intro = document.createElement("p");
    step2Intro.innerHTML = `Cepheid stars with longer pulses are intrinsically brighter. Astronomers calibrated this relationship using infrared light from the Hubble Space Telescope:`;
    step2.body.appendChild(step2Intro);
    const step2Formula = document.createElement("div");
    step2Formula.className = "formula formula-katex";
    katex.render(
      String.raw`M = a \, (\log_{10}(P / \mathrm{days}) - 1) + b`,
      step2Formula,
      { throwOnError: false, displayMode: true },
    );
    const step2Calib = document.createElement("p");
    step2Calib.className = "hint";
    const cal = PL_CALIBRATIONS.nirF160W;
    step2Calib.innerHTML = `where <em>a</em> = ${cal.a}, <em>b</em> = ${cal.b}, measured in the ${cal.band} infrared band.`;
    step2.body.appendChild(step2Formula);
    step2.body.appendChild(step2Calib);
    const step2Out = document.createElement("div");
    step2.body.appendChild(step2Out);
    wrap.appendChild(step2.details);

    // --------------------------------------------------------------
    //  Step 3 — Wesenheit + distance modulus (collapsed)
    // --------------------------------------------------------------
    const step3 = makeStep(
      "3",
      "Correct for dust, then compare with how bright it looks from Earth",
      false,
    );
    const step3Intro = document.createElement("p");
    step3Intro.innerHTML = `Dust between us and the Cepheid dims its light. We can spot dusty Cepheids because dust reddens their colour, and subtract a small amount of brightness — this is called the <strong>Wesenheit</strong> correction:`;
    step3.body.appendChild(step3Intro);
    const wesenheitFormula = document.createElement("div");
    wesenheitFormula.className = "formula formula-katex";
    katex.render(
      String.raw`m_{\text{corrected}} = m - ${REDDENING_COEFF} \, (V - I)`,
      wesenheitFormula,
      { throwOnError: false, displayMode: true },
    );
    step3.body.appendChild(wesenheitFormula);
    const step3DistIntro = document.createElement("p");
    step3DistIntro.innerHTML = `The dimmer the star looks compared to its real brightness, the further away it must be:`;
    step3.body.appendChild(step3DistIntro);
    const distFormula = document.createElement("div");
    distFormula.className = "formula formula-katex";
    katex.render(
      String.raw`d \,(\text{parsecs}) = 10^{(m_{\text{corrected}} - M + 5)/5}`,
      distFormula,
      { throwOnError: false, displayMode: true },
    );
    step3.body.appendChild(distFormula);
    const step3Out = document.createElement("div");
    step3.body.appendChild(step3Out);
    wrap.appendChild(step3.details);

    // --------------------------------------------------------------
    //  Step 4 — Result (open)
    // --------------------------------------------------------------
    const step4 = makeStep("4", "Result", true);
    const step4Out = document.createElement("div");
    step4.body.appendChild(step4Out);
    wrap.appendChild(step4.details);

    // --------------------------------------------------------------
    //  Period–luminosity scatter plot — visualises the PL relation.
    // --------------------------------------------------------------
    const plotStep = makeStep("📈", "Period–luminosity scatter plot", false);
    const plot = document.createElement("div");
    plot.className = "cepheid-plot";
    plotStep.body.appendChild(plot);
    wrap.appendChild(plotStep.details);

    let lastDistanceMpc = NaN;

    const recompute = () => {
      const id = select.value;
      const cor = (c: Cepheid): number =>
        c.vMinusI != null ? wesenheitMagnitude(c.meanMag, c.vMinusI) : c.meanMag;

      let period: number;
      let mag: number;
      let magCorr: number;
      let vmi: number;
      let label: string;
      if (id === "__median") {
        const dists = cepheids.map((c) =>
          parsecsToMegaparsecs(
            distanceFromMagnitudes(
              cor(c),
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
        magCorr = median2(cepheids.map((c) => cor(c)));
        label = `${cepheids.length} Cepheids combined`;
      } else {
        const c = cepheids.find((x) => x.id === id);
        if (!c) return;
        period = c.periodDays;
        mag = c.meanMag;
        vmi = c.vMinusI ?? 1;
        magCorr = cor(c);
        label = `Cepheid ${c.id}`;
        // Centre the mini-Aladin on this Cepheid.
        ensureMini();
        if (mini) {
          mini.gotoRaDec(c.ra, c.dec);
          if (mini.setFov) mini.setFov(0.02);
        }
        aladinHost.style.display = "block";
        aladinCaption.style.display = "block";
      }

      if (id === "__median") {
        aladinHost.style.display = "none";
        aladinCaption.style.display = "none";
      }

      const M = absoluteMagnitudeFromPeriod(period, cal);
      const d_pc = distanceFromMagnitudes(magCorr, M);
      const d_mpc = parsecsToMegaparsecs(d_pc);
      if (id !== "__median") lastDistanceMpc = d_mpc;

      // Step 2 numerical readout.
      step2Out.replaceChildren();
      const step2Result = document.createElement("div");
      step2Result.className = "formula formula-katex";
      katex.render(
        String.raw`P = ${period.toFixed(2)} \;\text{d} \;\Rightarrow\; \log_{10}(P) = ${Math.log10(period).toFixed(3)} \;\Rightarrow\; M = ${M.toFixed(2)}`,
        step2Result,
        { throwOnError: false, displayMode: true },
      );
      step2Out.appendChild(step2Result);

      // Step 3 numerical readout.
      step3Out.replaceChildren();
      const step3CorrEq = document.createElement("div");
      step3CorrEq.className = "formula formula-katex";
      katex.render(
        String.raw`m = ${mag.toFixed(2)},\; V - I = ${vmi.toFixed(2)} \;\Rightarrow\; m_{\text{corrected}} = ${magCorr.toFixed(2)}`,
        step3CorrEq,
        { throwOnError: false, displayMode: true },
      );
      const step3DistEq = document.createElement("div");
      step3DistEq.className = "formula formula-katex";
      katex.render(
        String.raw`d = 10^{(${magCorr.toFixed(2)} - (${M.toFixed(2)}) + 5)/5} \approx ${(d_pc / 1e6).toFixed(2)} \times 10^6 \;\text{parsecs}`,
        step3DistEq,
        { throwOnError: false, displayMode: true },
      );
      step3Out.appendChild(step3CorrEq);
      step3Out.appendChild(step3DistEq);

      // Step 4 — final answer + comparison to catalogue.
      step4Out.replaceChildren();
      const answer = document.createElement("div");
      answer.className = "answer";
      answer.textContent = `Distance ≈ ${lastDistanceMpc.toFixed(2)} Mpc`;
      const compare = document.createElement("p");
      compare.className = "hint";
      compare.style.marginTop = "6px";
      compare.textContent = `Catalogue value: ${this.opts.galaxy.distanceMpc.toFixed(2)} ± ${this.opts.galaxy.distanceMpcErr.toFixed(2)} Mpc. You used ${label}.`;
      step4Out.append(answer, compare);

      drawCepheidPlot(plot, cepheids, id === "__median" ? null : id);
    };

    select.addEventListener("change", recompute);
    accept.addEventListener("click", () => {
      if (Number.isFinite(lastDistanceMpc)) {
        this.opts.onAccept(this.opts.galaxy.id, lastDistanceMpc);
      }
    });
    setTimeout(recompute, 0);
    return wrap;
  }
}

interface Step {
  details: HTMLDetailsElement;
  body: HTMLElement;
}

function makeStep(num: string, title: string, openByDefault: boolean): Step {
  const details = document.createElement("details") as HTMLDetailsElement;
  details.className = "cepheid-step";
  if (openByDefault) details.open = true;
  const summary = document.createElement("summary");
  const numEl = document.createElement("span");
  numEl.className = "step-num";
  numEl.textContent = num;
  const titleEl = document.createElement("strong");
  titleEl.textContent = " " + title;
  summary.append(numEl, titleEl);
  details.appendChild(summary);
  const body = document.createElement("div");
  body.className = "cepheid-step-body";
  details.appendChild(body);
  return { details, body };
}

function makeIntro(): HTMLElement {
  const p = document.createElement("p");
  p.className = "cepheid-intro";
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
  const svg = d3.select(host).append("svg").attr("width", w).attr("height", h);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const periods = cepheids.map((c) => c.periodDays).filter((p) => p > 0);
  const mags = cepheids.map((c) => c.meanMag);
  const xScale = d3
    .scaleLog()
    .domain([Math.max(0.5, (d3.min(periods) ?? 1) * 0.9), (d3.max(periods) ?? 100) * 1.1])
    .range([0, innerW]);
  const yScale = d3
    .scaleLinear()
    .domain([(d3.max(mags) ?? 30) + 0.3, (d3.min(mags) ?? 20) - 0.3])
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
    .text((d) => `P = ${d.periodDays.toFixed(2)} d\nm = ${d.meanMag.toFixed(2)}`);
}
