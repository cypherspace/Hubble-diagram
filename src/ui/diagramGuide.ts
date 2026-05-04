import { openModal } from "./modal";

// Unlocked once the student has plotted enough galaxies (8) that the
// shape of the Hubble diagram is actually visible. Walks through the
// regions of the chart and what each tells you. Copy is the user-
// edited round-2 draft from the IMPROVEMENTS plan.

export class DiagramGuide {
  open(): void {
    const { inner } = openModal("A guide to your Hubble diagram");
    inner.innerHTML = `
      <p>Now that you have several galaxies plotted, take a moment
      to read what your chart is actually saying.</p>

      <h4 style="margin-top:18px">The straight line</h4>
      <p>The blue line is your best fit through the points. Its
      slope is your measured Hubble constant H₀. The grey dashed
      line is the currently-accepted published value of 70 km/s/Mpc.
      If your line is steeper, you've measured a faster expansion;
      shallower, a slower one. You're not aiming for an exact match,
      and you probably won't get one. The value changes depending on
      which galaxies you have plotted and how you've measured them —
      even professional astronomers disagree by ±5 km/s/Mpc
      depending on which galaxies they use.</p>

      <h4 style="margin-top:18px">Galaxies above the line</h4>
      <p>A galaxy plotted above your best-fit line is moving away
      faster than its distance suggests. There are two common
      reasons:</p>
      <ul>
        <li><strong>Peculiar velocity</strong>. The galaxy has its
          own motion through space, on top of the universe's
          expansion. A galaxy falling toward a massive cluster, for
          example, would look like it's receding faster than
          Hubble's law predicts.</li>
        <li><strong>You over-estimated the redshift.</strong> This
          process is quite difficult. It's sometimes difficult to
          determine the right spectral lines to pick or their exact
          position. Some redshifts are very small, so the spectrum
          panel is sensitive to where exactly you click — a tiny
          error in λ<sub>observed</sub> changes the velocity by a
          big number.</li>
      </ul>

      <h4 style="margin-top:18px">Galaxies below the line</h4>
      <p>Slower than expected — the same physics in reverse. Most
      strikingly, the Local Group galaxies (Andromeda, M33, the
      Magellanic Clouds) plot at or below v = 0. They're not
      following Hubble's law at all because gravity binds them to
      the Milky Way.</p>

      <h4 style="margin-top:18px">Galaxies far from the line: anomalies</h4>
      <p>Click the ⚠ badge on any galaxy to read why it doesn't fit.
      Known cases:</p>
      <ul>
        <li><strong>Foreground galaxies</strong>: NGC 7320 looks
          like part of Stephan's Quintet but its redshift puts it
          ten times closer than the others — they're just visually
          superimposed from our viewpoint.</li>
        <li><strong>Quasars</strong>: 3C 273 looks bright because
          its central black hole is feeding voraciously, not
          because it's nearby. At z ≈ 0.16 it's about 750 Mpc
          away.</li>
        <li><strong>Deep-field galaxies</strong>: at z > 1, the
          simple v = c·z formula breaks down. Switch on "Include
          deep-field" in the graph options to see how they fall
          away from the Hubble's-law line at extreme distances.</li>
      </ul>

      <h4 style="margin-top:18px">What this all means</h4>
      <p>Hubble's law is the simplest description of an expanding
      universe. The fact that it works at all — that distant
      galaxies really do recede faster, in a roughly proportional
      way — is the strongest evidence we have that space itself is
      stretching. Every anomaly you see is either a story about
      local gravity (the Local Group) or a hint about the more
      sophisticated cosmological model that takes over at high
      redshift.</p>
    `;
  }
}
