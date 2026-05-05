import type { Galaxy, PlottedGalaxy } from "../types";
import { buildThumbnail } from "./galaxyThumbnail";

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

    // Header: thumbnail on the left, name + alt names on the right.
    const header = document.createElement("div");
    header.className = "data-panel-header";
    const thumb = buildThumbnail(galaxy, 110);
    header.appendChild(thumb);

    const headerText = document.createElement("div");
    headerText.className = "data-panel-header-text";
    const heading = document.createElement("div");
    heading.className = "galaxy-title";
    heading.textContent = galaxy.name;
    headerText.appendChild(heading);
    if (galaxy.altNames.length) {
      const sub = document.createElement("div");
      sub.className = "hint";
      sub.textContent = galaxy.altNames.join(", ");
      headerText.appendChild(sub);
    }
    header.appendChild(headerText);
    wrap.appendChild(header);

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

    // Highlighted headline numbers, in the same visual treatment that
    // h-r-diagram uses for temperature / luminosity / distance.
    wrap.appendChild(
      headlineStat(
        "Distance",
        `${galaxy.distanceMpc.toFixed(2)} Mpc ± ${galaxy.distanceMpcErr.toFixed(2)}`,
      ),
    );
    wrap.appendChild(headlineStat("Redshift z", formatRedshift(galaxy.z)));
    wrap.appendChild(
      headlineStat("Recession velocity", `${galaxy.vRecKmS} km/s`),
    );

    // How that distance was actually measured. Two-line block so the
    // tag chip and the long-form method label both fit comfortably.
    const methodRow = document.createElement("div");
    methodRow.className = `method-row tag-${galaxy.distanceTag}`;
    const tagLabel = galaxy.distanceTag === "direct" ? "Direct" : "Extrapolated";
    methodRow.innerHTML = `
      <div class="method-label">Distance method</div>
      <div class="method-value">
        <span class="tag-pill tag-${galaxy.distanceTag}">${tagLabel}</span>
        <span class="method-detail">${galaxy.distanceMethodLabel}</span>
      </div>
    `;
    wrap.appendChild(methodRow);

    // Galaxy type — secondary, smaller.
    const typeRow = document.createElement("div");
    typeRow.className = "secondary-row";
    typeRow.innerHTML = `Type: <strong>${galaxy.type}</strong>`;
    wrap.appendChild(typeRow);

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

// Format redshift as a plain decimal — students read "0.001278" much
// more easily than "1.278e-3". 6 decimal places covers everything
// from blueshifted Local Group galaxies (~−0.001) up to z ≈ 0.999;
// for high-z deep-field galaxies (z ≥ 1) we drop to 4 decimals.
function formatRedshift(z: number): string {
  if (Math.abs(z) >= 1) return z.toFixed(4);
  return z.toFixed(6);
}

// Highlighted headline statistic — same visual treatment as
// h-r-diagram's "Temperature" / "Brightness" cards.
function headlineStat(label: string, value: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "headline-stat";
  const lab = document.createElement("div");
  lab.className = "headline-label";
  lab.textContent = label;
  const val = document.createElement("div");
  val.className = "headline-value";
  val.textContent = value;
  wrap.append(lab, val);
  return wrap;
}
