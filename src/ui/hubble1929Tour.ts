import {
  HUBBLE_1929,
  hubble1929GalaxyRecord,
  hubble1929ModernRecord,
  type Hubble1929Galaxy,
} from "../data/hubble1929";
import {
  C_KM_S,
  H0_PUBLISHED_KM_S_MPC,
  fitHubbleSlope,
} from "../data/derive";
import type { AxisConfig, Galaxy, PlottedGalaxy } from "../types";
import type { SkyViewer } from "./skyViewer";

// Hubble's-1929-graph guided walkthrough.
//
// Sequence:
//   1. Intro modal (large, centred) — long context paragraph about
//      Hubble's 1924/1929 work and what we're about to do.
//   2. 24 galaxy steps. For each:
//        - Aladin animates a slow pan + zoom-out + zoom-in to the
//          target (3-5 s for the very first transition, 2-3 s for
//          subsequent ones). The transition runs in the background;
//          the bottom-right tooltip with Hubble's value pops up
//          immediately.
//        - Galaxy is plotted on the chart at Hubble's 1929 values.
//        - First "close-to-modern" galaxy gets one short note;
//          first "way off" galaxy gets a deferred-explanation note;
//          all other galaxies just show the values, no commentary.
//   3. Closing panel A (large modal): "That's it!" + side-by-side
//      with Hubble's original 1929 figure, age-of-Universe paradox.
//   4. Closing panel B (large modal): explains the 1952 Cepheid fix
//      and re-plots all 24 galaxies with their modern values.
//   5. Closing panel C (large modal): reads off the modern H₀ from
//      the re-plotted fit, gives age = 13.7 Gyr ± uncertainty, and
//      hands off to the student to add more galaxies.
//
// The tour overrides the chart axes to (showNegative: true,
// showRefLine: false, range: auto) so all 24 galaxies fit on screen
// without the student having to fiddle. Original axes are restored
// when the tour exits or completes.

const FIRST_TRANSITION_MS = 4000;
const NEXT_TRANSITION_MS = 2400;
const REPLOT_PER_GALAXY_MS = 110;

export interface Hubble1929TourOptions {
  skyViewer: SkyViewer;
  /** Plot a galaxy onto the Hubble diagram. Same Map.set semantics as
   *  the rest of the app — calling with the same id replaces. */
  plotGalaxy: (galaxy: PlottedGalaxy) => void;
  /** Drop every `hubble1929-*` entry from the chart. Used between the
   *  Hubble-values phase and the modern-values re-plot. */
  clearHubble1929: () => void;
  /** Save / restore the chart axes around the tour so we can force
   *  showNegative:true / showRefLine:false / range:auto without
   *  losing the user's prior choices. */
  getAxes: () => AxisConfig;
  setAxes: (axes: AxisConfig) => void;
  /** Read the current set of plotted galaxies — used to compute the
   *  fit-line slope shown in the calibration-fix and final panels. */
  getPlotted: () => PlottedGalaxy[];
  /** Called when the tour finishes (or the student clicks Exit). */
  onClose: () => void;
}

export class Hubble1929Tour {
  private opts: Hubble1929TourOptions;
  private overlay?: HTMLElement;
  private modal?: HTMLElement;
  private cancelled = false;
  // True after we successfully apply the tour's preferred axes;
  // saveAxes holds the user's prior config so we can restore on exit.
  private savedAxes?: AxisConfig;

  constructor(opts: Hubble1929TourOptions) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    this.cancelled = false;
    this.savedAxes = { ...this.opts.getAxes() };
    // Force axes that show every Hubble galaxy without the student
    // touching anything: include negative velocities (some galaxies
    // are blueshifted in 1929 numbers), no published-H₀ reference
    // line (we want them to find it themselves), auto-scale.
    this.opts.setAxes({
      ...this.savedAxes,
      yMode: "velocity",
      range: "auto",
      showNegative: true,
      showRefLine: false,
    });

    try {
      const startedReally = await this.showIntroPanel();
      if (!startedReally || this.cancelled) return;
      for (let i = 0; i < HUBBLE_1929.length; i++) {
        if (this.cancelled) return;
        const cont = await this.runGalaxyStep(i);
        if (!cont) return;
      }
      const cont1 = await this.showOriginalGraphPanel();
      if (!cont1 || this.cancelled) return;
      const cont2 = await this.showCalibrationFixPanel();
      if (!cont2 || this.cancelled) return;
      await this.showFinalRevealPanel();
    } finally {
      this.cleanup();
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.cleanup();
  }

  private cleanup(): void {
    this.overlay?.remove();
    this.overlay = undefined;
    this.modal?.remove();
    this.modal = undefined;
    if (this.savedAxes) {
      this.opts.setAxes(this.savedAxes);
      this.savedAxes = undefined;
    }
  }

  // -----------------------------------------------------------------
  //  Galaxy step. Returns true to continue, false if exited.
  // -----------------------------------------------------------------

  private async runGalaxyStep(idx: number): Promise<boolean> {
    const g = HUBBLE_1929[idx];
    const ms = idx === 0 ? FIRST_TRANSITION_MS : NEXT_TRANSITION_MS;

    // 1. Show overlay immediately. Tooltip pops up as soon as the
    //    Next button on the previous step (or Begin on the intro)
    //    was clicked.
    const cont = this.showGalaxyTooltip(g, idx);

    // 2. Plot the galaxy at Hubble's 1929 values immediately too —
    //    the chart needs to be ready when the student looks at it.
    const galaxyData = hubble1929GalaxyRecord(g);
    this.opts.plotGalaxy(asPlotted(galaxyData));

    // 3. Animate Aladin in the background — fire and forget. The
    //    student can keep reading the tooltip while the sky map
    //    pans + zooms. Don't await it; we don't want to block the
    //    Next button on the animation finishing.
    void this.opts.skyViewer.animateRaDecFov(g.ra, g.dec, 1.5, ms);

    return cont;
  }

  /** Build + display the bottom-right galaxy tooltip and resolve when
   *  the student clicks Next (true) or Exit (false). Captures the
   *  "first-time only" explanation flags so subsequent galaxies stay
   *  uncluttered. */
  private showGalaxyTooltip(
    g: Hubble1929Galaxy,
    idx: number,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.overlay?.remove();
      const overlay = document.createElement("div");
      overlay.className = "h1929-overlay";
      overlay.style.position = "fixed";
      overlay.style.right = "16px";
      overlay.style.bottom = "16px";
      overlay.style.maxWidth = "440px";
      overlay.style.background = "var(--panel)";
      overlay.style.border = "1px solid var(--accent-coral)";
      overlay.style.borderRadius = "6px";
      overlay.style.padding = "12px 14px";
      overlay.style.color = "var(--fg)";
      overlay.style.fontSize = "13px";
      overlay.style.boxShadow = "0 4px 18px rgba(0,0,0,0.45)";
      overlay.style.zIndex = "2000";

      const heading = document.createElement("div");
      heading.style.fontWeight = "600";
      heading.style.fontSize = "14px";
      heading.style.color = "var(--accent-coral)";
      heading.textContent = `Step ${idx + 1} / ${HUBBLE_1929.length}: ${g.displayName}`;
      overlay.appendChild(heading);

      const hubbleLine = document.createElement("p");
      hubbleLine.style.margin = "8px 0 4px";
      hubbleLine.innerHTML = `<strong>Hubble (1929) said:</strong>
        d = ${g.hubbleDistanceMpc} Mpc, v = ${g.hubbleVelocityKmS} km/s.`;
      overlay.appendChild(hubbleLine);

      const modernV = Math.round(g.modernZ * C_KM_S);
      const modernLine = document.createElement("p");
      modernLine.style.margin = "0 0 8px";
      modernLine.innerHTML = `<strong>Modern value:</strong>
        d = ${g.modernDistanceMpc} Mpc, v = ${modernV} km/s.`;
      overlay.appendChild(modernLine);

      // First-time-only explanation. Decide which case this galaxy
      // hits, and whether it's the FIRST galaxy of that case. We
      // count "way off" as ratio > 3.
      const ratio = g.modernDistanceMpc / Math.max(0.01, g.hubbleDistanceMpc);
      const isWayOff = ratio > 3;
      const isFirstClose = !isWayOff && this.firstCloseShown === false;
      const isFirstWayOff = isWayOff && this.firstWayOffShown === false;
      if (isFirstClose) {
        this.firstCloseShown = true;
        const explainer = document.createElement("p");
        explainer.className = "hint";
        explainer.style.margin = "0 0 10px";
        explainer.textContent =
          "Hubble's value is close to the modern one — this is a nearby galaxy and the observations were quite accurate.";
        overlay.appendChild(explainer);
      } else if (isFirstWayOff) {
        this.firstWayOffShown = true;
        const explainer = document.createElement("p");
        explainer.className = "hint";
        explainer.style.margin = "0 0 10px";
        explainer.textContent =
          `Hubble's distance is about ${ratio.toFixed(1)}× too small. We'll explain why this is later — but for the moment, we're going to do exactly what Hubble did.`;
        overlay.appendChild(explainer);
      }

      const buttons = document.createElement("div");
      buttons.style.display = "flex";
      buttons.style.gap = "6px";
      buttons.style.justifyContent = "space-between";
      const exit = document.createElement("button");
      exit.type = "button";
      exit.textContent = "Exit tour";
      exit.addEventListener("click", () => {
        this.cancelled = true;
        overlay.remove();
        this.overlay = undefined;
        this.opts.onClose();
        resolve(false);
      });
      const next = document.createElement("button");
      next.type = "button";
      next.className = "primary";
      next.textContent =
        idx === HUBBLE_1929.length - 1
          ? "See the result"
          : `Next galaxy →`;
      next.addEventListener("click", () => {
        overlay.remove();
        if (this.overlay === overlay) this.overlay = undefined;
        resolve(true);
      });
      buttons.append(exit, next);
      overlay.appendChild(buttons);

      document.body.appendChild(overlay);
      this.overlay = overlay;
    });
  }

  // First-time-only explanation tracking.
  private firstCloseShown = false;
  private firstWayOffShown = false;

  // -----------------------------------------------------------------
  //  Large modal panels (intro + 3 closing).
  // -----------------------------------------------------------------

  private showIntroPanel(): Promise<boolean> {
    const html = `
      <p>In 1929, Edwin Hubble published a scientific paper called
        <em>"A relation between distance and radial velocity among
        extra-galactic nebulae"</em>.</p>
      <p>It wasn't an exciting title, but it's not an exaggeration to
        say that this paper changed our understanding of the
        Universe. Astrophysics, and indeed much other physics
        research, would never be the same again.</p>
      <p>You can read the paper here:
        <a href="https://www.pnas.org/doi/10.1073/pnas.15.3.168"
          target="_blank" rel="noopener">
          pnas.org/doi/10.1073/pnas.15.3.168
        </a> — but we're about to recreate exactly what Hubble did at
        the time.</p>
      <p>The first thing to note here is Hubble's title, and
        specifically the last three words — <em>"extra-galactic
        nebulae"</em>.</p>
      <p>These "nebulae" are other galaxies. But before the 1920s, we
        didn't know that; they just looked like patches of light in
        the sky with many stars in them. It was Hubble himself, in
        1924, who proved that nebulae — like the "Andromeda
        Nebula" — were not parts of the Milky Way at all, but much
        further away.</p>
      <p>The original term for these was 'extra-galactic' nebulae. It
        still wasn't known that they were actually galaxies. In 1929,
        Hubble measured the redshift of these nebulae (which told him
        the speed they were moving towards or away from Earth). He
        also calculated their distance from Earth. And then he
        <em>compared</em> the distance to the speed.</p>
      <p>He did this for 24 galaxies. We're going to do the same
        thing — with the same galaxies.</p>
      <p>Let's look at the first galaxy in his paper.</p>
    `;
    return this.showLargeModal(
      "Hubble's 1929 graph",
      html,
      [{ label: "Begin", primary: true, value: true }, { label: "Cancel", value: false }],
    );
  }

  private showOriginalGraphPanel(): Promise<boolean> {
    // Use the actual scanned figure from Hubble's 1929 PNAS paper
    // (Figure 1), shipped as public/data/hubble1929-original.jpeg.
    const html = `
      <p>That's it! We now have a graph between speed and distance.
        Here's Hubble's <em>original</em> 1929 graph:</p>
      <figure style="margin: 12px 0; text-align: center">
        <img src="./data/hubble1929-original.jpeg"
             alt="Figure 1 from Hubble (1929): radial velocity plotted against distance for 24 extra-galactic nebulae"
             style="max-width: 100%; height: auto; background: #fff; padding: 6px; border-radius: 4px" />
        <figcaption style="color: var(--muted); margin-top: 6px; font-size: 0.85rem; font-style: italic">
          Figure 1 from Hubble (1929),
          <a href="https://www.pnas.org/doi/10.1073/pnas.15.3.168"
             target="_blank" rel="noopener">PNAS 15, 168</a>.
        </figcaption>
      </figure>
      <p>You can see that it shows a proportional relationship between
        the distance a galaxy is away from us, and the speed it is
        moving. Our graph shows the same thing.</p>
      <p>This discovery showed that the Universe was expanding. And if
        it was expanding, it must have been smaller in the past… and
        could have actually come from a single point! Hubble used his
        discovery to calculate an age for the Universe — about
        2 billion years.</p>
      <p>You might notice that this isn't how old we currently think
        the Universe is. At the time, geologists already thought the
        Earth was 4 billion years old — so how could the Universe
        only be 2 billion years?</p>
    `;
    return this.showLargeModal(
      "Hubble's original 1929 graph",
      html,
      [{ label: "Continue →", primary: true, value: true }, { label: "Exit", value: false }],
    );
  }

  private async showCalibrationFixPanel(): Promise<boolean> {
    const html = `
      <p>Hubble's distances were all too small. He'd actually used
        information about Cepheid stars which confused two
        populations of variable stars. Once that was sorted out (in
        1952), all Hubble's distances got bigger.</p>
      <p>Let's re-plot the graph using the more accurate distances.</p>
    `;
    const cont = await this.showLargeModal(
      "The 1952 calibration fix",
      html,
      [
        { label: "Re-plot the graph", primary: true, value: true },
        { label: "Exit", value: false },
      ],
    );
    if (!cont) return false;
    // Clear the 1929 plot and re-plot one galaxy at a time, using
    // the modern values. Quick enough that the chart visibly redraws
    // but not so quick that the student misses the swap.
    this.opts.clearHubble1929();
    for (const g of HUBBLE_1929) {
      const modern = hubble1929ModernRecord(g);
      this.opts.plotGalaxy(asPlotted(modern));
      await sleep(REPLOT_PER_GALAXY_MS);
      if (this.cancelled) return false;
    }
    return true;
  }

  private showFinalRevealPanel(): Promise<boolean> {
    // Compute the modern fit slope from whatever's currently plotted
    // (the freshly re-plotted hubble1929-* points + anything the
    // student had added before starting the tour).
    const points = this.opts
      .getPlotted()
      .filter((p) => p.id.startsWith("hubble1929-"))
      .map((p) => ({ d: p.plottedDistanceMpc, v: p.plottedVelocityKmS }));
    const fit = fitHubbleSlope(points);
    const h0 = Number.isFinite(fit.h0) ? fit.h0 : H0_PUBLISHED_KM_S_MPC;
    // Age = 1 / H0 in seconds, converted to years. H0 in km/s/Mpc;
    //   1 Mpc = 3.0857e19 km, 1 year = 3.156e7 s.
    //   age (Gyr) ≈ 977.8 / H0 — a textbook one-liner.
    const ageGyr = 977.8 / h0;
    const html = `
      <p>This now gives us the value of <strong>${h0.toFixed(1)} km/s/Mpc</strong>
        for Hubble's constant. Using this value gives us the age of the
        Universe to be about <strong>${ageGyr.toFixed(1)} billion years</strong>.</p>
      <p>In the years since, astronomers have discovered many more
        galaxies and calculated many more distances and redshifts,
        which has given us a more accurate value for Hubble's constant
        — although there are still methods that give different
        values. The generally accepted range is
        <strong>67–73 km/s/Mpc</strong>, which gives us an age of the
        Universe of about <strong>13.7 billion years</strong>, plus or
        minus a few hundred million years.</p>
      <p>Now it's your turn, if you haven't already. Can you find some
        galaxies, plot them on the graph, and find a value for the
        Hubble constant?</p>
    `;
    return this.showLargeModal(
      "Hubble's constant, found",
      html,
      [{ label: "Done", primary: true, value: true }],
    );
  }

  // -----------------------------------------------------------------
  //  Generic large-modal helper. Returns the chosen button's value.
  // -----------------------------------------------------------------

  private showLargeModal(
    title: string,
    bodyHtml: string,
    buttons: Array<{ label: string; primary?: boolean; value: boolean }>,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // Close any previous modal first.
      this.modal?.remove();
      // Hide the bottom-right galaxy tooltip while the modal is up.
      this.overlay?.remove();
      this.overlay = undefined;

      const backdrop = document.createElement("div");
      backdrop.className = "h1929-modal-backdrop";
      backdrop.style.position = "fixed";
      backdrop.style.inset = "0";
      backdrop.style.background = "rgba(11, 16, 32, 0.9)";
      backdrop.style.zIndex = "3000";
      backdrop.style.display = "flex";
      backdrop.style.alignItems = "center";
      backdrop.style.justifyContent = "center";
      backdrop.style.padding = "1rem";

      const modal = document.createElement("div");
      modal.style.background = "var(--panel)";
      modal.style.border = "1px solid var(--accent-coral)";
      modal.style.borderRadius = "8px";
      modal.style.padding = "1.5rem 1.75rem";
      modal.style.maxWidth = "min(720px, 96vw)";
      modal.style.maxHeight = "92vh";
      modal.style.overflowY = "auto";
      modal.style.color = "var(--fg)";
      modal.style.boxShadow = "0 20px 50px rgba(0, 0, 0, 0.65)";

      const heading = document.createElement("h3");
      heading.style.margin = "0 0 0.6rem";
      heading.style.color = "var(--accent-coral)";
      heading.style.fontSize = "1.25rem";
      heading.textContent = title;
      modal.appendChild(heading);

      const body = document.createElement("div");
      body.innerHTML = bodyHtml;
      body.style.lineHeight = "1.55";
      modal.appendChild(body);

      const btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.gap = "0.5rem";
      btnRow.style.justifyContent = "flex-end";
      btnRow.style.marginTop = "1rem";
      for (const b of buttons) {
        const el = document.createElement("button");
        el.type = "button";
        el.textContent = b.label;
        if (b.primary) el.className = "primary";
        el.addEventListener("click", () => {
          backdrop.remove();
          if (this.modal === backdrop) this.modal = undefined;
          resolve(b.value);
        });
        btnRow.appendChild(el);
      }
      modal.appendChild(btnRow);

      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      this.modal = backdrop;
    });
  }
}

function asPlotted(g: Galaxy): PlottedGalaxy {
  return {
    ...g,
    plottedDistanceMpc: g.distanceMpc,
    plottedVelocityKmS: g.vRecKmS,
    distanceSource: "curated",
    velocitySource: "curated",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

