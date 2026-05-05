// Lightweight first-time walkthrough. Steps highlight key UI areas
// using a positioned tooltip and a "Next" button. State is persisted
// in localStorage so the tour only auto-runs once.
//
// Adapted (much simplified) from h-r-diagram/src/ui/walkthrough.ts.

const SEEN_KEY = "hubble-diagram.tour.v1";

interface Step {
  // CSS selector for the element to highlight. The tooltip renders
  // next to it using getBoundingClientRect. If omitted, the tooltip is
  // centered on screen with no spotlight (used for intro/outro steps).
  selector?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome!",
    body:
      "This tool helps you explore galaxies and how they fit on " +
      "Hubble's famous diagram comparing recession velocity (how fast " +
      "they are moving away from us) and distance (how far away they are).",
  },
  {
    selector: "#aladin-lite-div",
    title: "The night sky",
    body:
      "This panel shows real telescope imagery, from various different " +
      "telescopes. We've marked some notable galaxies on here to begin " +
      "with — but you can also search for galaxies in an area. You can " +
      "scroll around, zoom in and out, and look wherever you like. " +
      "Press \"Search SDSS\" to see if the Sloan Digital Sky Survey has " +
      "detected any galaxies in the area you're looking at.",
  },
  {
    selector: "#galaxy-sets",
    title: "The galaxy list",
    body:
      "We've chosen some galaxies to get you started — for example, " +
      "the Local Group, our closest galaxies. You can click on any " +
      "galaxy to add it to the chart, see more information about it, " +
      "and see it in the Sky Map.",
  },
  {
    selector: "#data-panel",
    title: "Galaxy details",
    body:
      "When you click a galaxy, its information appears here: type, " +
      "distance, redshift, recession velocity. The distance, redshift " +
      "and velocity have been calculated by astronomers; but if you " +
      "see a Cepheids or Spectrum badge, you can try calculating those " +
      "values yourself (not for the faint-hearted!)",
  },
  {
    selector: "#diagram",
    title: "Your Hubble diagram",
    body:
      "Galaxies you add appear here as dots. Hubble looked at the " +
      "relationship between a galaxy's distance and its speed — and " +
      "as you add more galaxies to the chart, you'll also see that " +
      "relationship happen. Once you've added enough galaxies, you " +
      "can click the \"Diagram Guide\" to get a better explanation of " +
      "what you're seeing.",
  },
];

export class Walkthrough {
  private idx = 0;
  private overlay?: HTMLElement;

  static hasBeenSeen(): boolean {
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  static markSeen(): void {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore quota / privacy mode */
    }
  }

  static reset(): void {
    try {
      localStorage.removeItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
  }

  start(): void {
    if (this.overlay) return;
    this.idx = 0;
    this.renderStep();
  }

  private renderStep(): void {
    this.overlay?.remove();
    if (this.idx >= STEPS.length) {
      Walkthrough.markSeen();
      return;
    }
    const step = STEPS[this.idx];
    const target = step.selector
      ? (document.querySelector(step.selector) as HTMLElement | null)
      : null;
    if (step.selector && !target) {
      this.idx++;
      this.renderStep();
      return;
    }

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(11, 16, 32, 0.55)";
    overlay.style.zIndex = "2000";
    overlay.style.pointerEvents = "auto";

    if (target) {
      const rect = target.getBoundingClientRect();
      const spotlight = document.createElement("div");
      spotlight.style.position = "fixed";
      spotlight.style.left = `${rect.left - 6}px`;
      spotlight.style.top = `${rect.top - 6}px`;
      spotlight.style.width = `${rect.width + 12}px`;
      spotlight.style.height = `${rect.height + 12}px`;
      spotlight.style.border = "2px solid var(--accent)";
      spotlight.style.borderRadius = "6px";
      spotlight.style.boxShadow = "0 0 0 9999px rgba(11, 16, 32, 0.55)";
      spotlight.style.pointerEvents = "none";
      overlay.appendChild(spotlight);
    }

    // Tooltip — placed below the target if there's room, otherwise above.
    // For untargeted (intro) steps, center it on screen.
    const tooltip = document.createElement("div");
    tooltip.style.position = "fixed";
    tooltip.style.maxWidth = "360px";
    tooltip.style.background = "var(--panel)";
    tooltip.style.border = "1px solid var(--accent)";
    tooltip.style.borderRadius = "6px";
    tooltip.style.padding = "12px";
    tooltip.style.color = "var(--text)";
    tooltip.style.fontSize = "13px";
    tooltip.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.4)";
    if (target) {
      const rect = target.getBoundingClientRect();
      const fitsBelow = rect.bottom + 200 < window.innerHeight;
      if (fitsBelow) {
        tooltip.style.top = `${rect.bottom + 12}px`;
      } else {
        tooltip.style.bottom = `${window.innerHeight - rect.top + 12}px`;
      }
      const left = Math.min(rect.left, window.innerWidth - 380);
      tooltip.style.left = `${Math.max(12, left)}px`;
    } else {
      tooltip.style.top = "50%";
      tooltip.style.left = "50%";
      tooltip.style.transform = "translate(-50%, -50%)";
    }
    tooltip.innerHTML = `
      <div style="font-weight:600;font-size:14px;margin-bottom:6px">${step.title}</div>
      <div style="line-height:1.5">${step.body}</div>
    `;
    const buttons = document.createElement("div");
    buttons.style.marginTop = "12px";
    buttons.style.display = "flex";
    buttons.style.gap = "6px";
    buttons.style.justifyContent = "space-between";
    const skip = document.createElement("button");
    skip.type = "button";
    skip.textContent = "Skip tour";
    skip.addEventListener("click", () => {
      Walkthrough.markSeen();
      this.overlay?.remove();
      this.overlay = undefined;
    });
    const next = document.createElement("button");
    next.type = "button";
    next.className = "primary";
    next.textContent =
      this.idx === STEPS.length - 1 ? "Done" : `Next (${this.idx + 1}/${STEPS.length})`;
    next.addEventListener("click", () => {
      this.idx++;
      this.renderStep();
    });
    buttons.append(skip, next);
    tooltip.appendChild(buttons);
    overlay.appendChild(tooltip);

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }
}
