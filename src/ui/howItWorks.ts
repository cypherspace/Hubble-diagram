import { openModal } from "./modal";

// Student-facing primer on what the app does and why. Pitched at a
// 14-18 year-old reading on their own — every astronomical term is
// either avoided or explained inline. Copy is the user-edited round-2
// draft from the IMPROVEMENTS plan.

export class HowItWorks {
  open(): void {
    const { inner } = openModal("How this app works");
    inner.innerHTML = `
      <p>This app lets you reconstruct one of the most important
      graphs in astronomy: the <strong>Hubble diagram</strong>. Edwin
      Hubble first noticed in the 1920s that distant galaxies were
      moving away from Earth. He plotted a graph where he compared
      their distance to their speed. He found a mathematical
      relationship, called <strong>Hubble's Law</strong>. That
      relationship tells us how the Universe began; it's one of the
      most important findings physics has ever made. You're going to
      do the same thing Hubble did, and we expect that you'll find
      the same relationship.</p>

      <h4 style="margin-top:18px">1. Find galaxies on the sky</h4>
      <p>The left panel shows real images of the night sky from
      telescope surveys (DSS2, PanSTARRS, SDSS, 2MASS — switch
      between them at the top).</p>
      <p>We've marked some galaxies for you (but there are many,
      many more to discover). The ones we've marked have specific
      reasons for marking them. You might also see that different
      galaxies have badges on them; this tells you if there's more
      data about the galaxies; this might mean you can calculate the
      distance and speed yourself.</p>
      <ul>
        <li><strong>✦ Cepheids</strong> — the Hubble Space Telescope
          has measured pulsating Cepheid stars in this galaxy, and
          you can use them to derive the distance to the galaxy.</li>
        <li><strong>λ Spectrum</strong> — the Sloan Digital Sky
          Survey (SDSS) has measured the light coming from the
          galaxy and plotted a graph of the spectrum. This means you
          can measure the <em>redshift</em> of the galaxy yourself,
          which tells us the speed.</li>
        <li><strong>⚠ Anomaly</strong> — this galaxy doesn't fit
          Hubble's law for an interesting reason. Click it to find
          out why.</li>
      </ul>

      <h4 style="margin-top:18px">2. Add galaxies to the chart</h4>
      <p>For each galaxy, you have three options:</p>
      <ul>
        <li><strong>Use the values that have been calculated by
          astronomers.</strong> Just click "Add to chart" and the
          chart will use the accepted values for distance and speed
          of that galaxy.</li>
        <li><strong>Find the distance yourself</strong> — for
          galaxies with the ✦ badge, open the Cepheid panel and
          follow the steps to see if you can find the distance,
          using the relationship between the period of a Cepheid
          star's brightening and dimming, and its overall
          brightness.</li>
        <li><strong>Find the redshift yourself</strong> — for
          galaxies with the λ badge, open the spectrum panel,
          identify a spectral line, and calculate the redshift of
          the galaxy.</li>
      </ul>

      <h4 style="margin-top:18px">3. Watch Hubble's law emerge</h4>
      <p>Once you have a few galaxies plotted, the app fits a
      straight line through them and reports the slope. The
      straight-line relationship is known as <strong>Hubble's Law</strong>.
      The gradient of the line is known as <strong>Hubble's
      Constant</strong>. Hubble originally calculated this as
      66 km s⁻¹ Mpc⁻¹; but Hubble didn't see as many galaxies as we
      can today, so you can get a more accurate value by using more
      galaxies at bigger distances.</p>
      <p>As you add more galaxies, you might see that value change.
      That's exactly what has happened over the last 100 years —
      more measurements, and more galaxies, means we get different
      values as we get new measurements.</p>

      <h4 style="margin-top:18px">4. Explore the anomalies</h4>
      <p>Some galaxies will look wrong on the chart. You can click
      on those galaxies to see why they don't quite fit the general
      <em>further = faster</em> relationship.</p>

      <h4 style="margin-top:18px">A short history</h4>
      <p>In 1929, Edwin Hubble published a chart of 24 nearby
      galaxies showing this same straight-line relationship between
      distance and recession velocity. It was the first observational
      evidence that the universe is expanding — and led directly to
      the Big Bang theory. You're rebuilding his discovery with much
      better data.</p>
    `;
  }
}
