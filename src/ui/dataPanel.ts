import type { Galaxy, PlottedGalaxy } from "../types";

export interface DataPanelCallbacks {
  onAddToChart?: (galaxy: Galaxy) => void;
  onDeriveDistance?: (galaxy: Galaxy) => void;
  onDeriveLightCurveDistance?: (galaxy: Galaxy) => void;
  onDeriveRedshift?: (galaxy: Galaxy) => void;
}

export class DataPanel {
  private host: HTMLElement;
  private cb: DataPanelCallbacks;

  constructor(host: HTMLElement, cb: DataPanelCallbacks) {
    this.host = host;
    this.cb = cb;
  }

  showEmpty(): void {
    this.host.innerHTML = `<p class="hint">Click a galaxy marker on the sky.</p>`;
  }

  show(galaxy: Galaxy, plotted: PlottedGalaxy | null): void {
    const wrap = document.createElement("div");

    const heading = document.createElement("div");
    heading.style.fontSize = "16px";
    heading.style.fontWeight = "600";
    heading.textContent = galaxy.name;
    if (galaxy.altNames.length) {
      const sub = document.createElement("span");
      sub.className = "hint";
      sub.style.marginLeft = "8px";
      sub.textContent = galaxy.altNames.join(", ");
      heading.appendChild(sub);
    }
    wrap.appendChild(heading);

    // Capability badges
    const badges = document.createElement("div");
    badges.className = "cap-badges";
    badges.style.marginBottom = "6px";
    badges.append(
      badge(
        "✦ Cepheids",
        galaxy.capabilities.cepheidPL,
        "Hubble Space Telescope has measured Cepheid stars in this galaxy — you can derive a distance.",
      ),
      badge(
        "λ Spectrum",
        galaxy.capabilities.sdssSpectrum,
        "An SDSS optical spectrum is available — you can measure the redshift yourself.",
      ),
    );
    if (galaxy.isAnomaly) {
      badges.append(badge("⚠ Anomaly", true, galaxy.anomalyExplanation ?? "", "anomaly"));
    }
    wrap.appendChild(badges);

    const claim = document.createElement("p");
    claim.style.marginTop = "4px";
    claim.style.marginBottom = "8px";
    claim.textContent = galaxy.claimToFame;
    wrap.appendChild(claim);

    // Numbers
    const numbers = document.createElement("div");
    numbers.style.fontSize = "13px";
    numbers.style.lineHeight = "1.6";
    numbers.innerHTML = `
      <div>Type: <strong>${galaxy.type}</strong></div>
      <div>Distance: <strong>${galaxy.distanceMpc.toFixed(2)} Mpc</strong> ± ${galaxy.distanceMpcErr.toFixed(2)}</div>
      <div>Redshift z: <strong>${galaxy.z.toExponential(3)}</strong></div>
      <div>Recession velocity: <strong>${galaxy.vRecKmS} km/s</strong></div>
    `;
    wrap.appendChild(numbers);

    if (plotted) {
      const stamp = document.createElement("div");
      stamp.className = "hint";
      stamp.style.marginTop = "6px";
      const dSrc =
        plotted.distanceSource === "curated"
          ? "curated"
          : plotted.distanceSource === "cepheid-pl"
            ? "you derived this from a Cepheid period"
            : "you derived this by folding a light curve";
      const vSrc =
        plotted.velocitySource === "curated"
          ? "curated"
          : "you derived this from a spectrum";
      stamp.innerHTML = `Plotted at <strong>${plotted.plottedDistanceMpc.toFixed(2)} Mpc</strong> (${dSrc}), <strong>${plotted.plottedVelocityKmS.toFixed(0)} km/s</strong> (${vSrc}).`;
      wrap.appendChild(stamp);
    }

    if (galaxy.isAnomaly && galaxy.anomalyExplanation) {
      const note = document.createElement("p");
      note.style.background = "rgba(255, 183, 77, 0.1)";
      note.style.border = "1px solid #ffb74d";
      note.style.borderRadius = "4px";
      note.style.padding = "6px";
      note.style.marginTop = "8px";
      note.style.fontSize = "12px";
      note.textContent = "⚠ " + galaxy.anomalyExplanation;
      wrap.appendChild(note);
    }

    // Actions
    const actions = document.createElement("div");
    actions.style.marginTop = "10px";
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "6px";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "primary";
    addBtn.textContent = plotted ? "On chart ✓" : "Add to chart";
    addBtn.disabled = !!plotted;
    addBtn.addEventListener("click", () => this.cb.onAddToChart?.(galaxy));
    actions.appendChild(addBtn);

    if (galaxy.capabilities.cepheidPL) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Find distance from Cepheids";
      b.addEventListener("click", () => this.cb.onDeriveDistance?.(galaxy));
      actions.appendChild(b);
    }
    if (galaxy.capabilities.lightCurves) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Find distance from a light curve";
      b.addEventListener("click", () =>
        this.cb.onDeriveLightCurveDistance?.(galaxy),
      );
      actions.appendChild(b);
    }
    if (galaxy.capabilities.sdssSpectrum) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Find redshift from spectrum";
      b.addEventListener("click", () => this.cb.onDeriveRedshift?.(galaxy));
      actions.appendChild(b);
    }
    wrap.appendChild(actions);

    if (galaxy.wikipedia) {
      const link = document.createElement("p");
      link.style.marginTop = "8px";
      link.style.fontSize = "12px";
      link.innerHTML = `<a href="https://en.wikipedia.org/wiki/${galaxy.wikipedia}" target="_blank" rel="noopener">More on Wikipedia ↗</a>`;
      wrap.appendChild(link);
    }

    this.host.replaceChildren(wrap);
  }
}

function badge(
  text: string,
  on: boolean,
  title: string,
  extraClass = "",
): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = `cap-badge ${on ? "on" : ""} ${extraClass}`.trim();
  s.title = title;
  s.textContent = text + (on ? "" : " (n/a)");
  return s;
}
