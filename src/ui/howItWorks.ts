import { openModal } from "./modal";

// Student-facing primer on what the app does and why. Pitched at a 14-18
// year-old reading on their own — no embedded jargon without an inline
// gloss. Read the existing h-r-diagram howItWorks.ts as a stylistic
// template; this version is a complete rewrite for the Hubble app.

export class HowItWorks {
  open(): void {
    const { inner } = openModal("How this app works");
    inner.innerHTML = `
      <p>This app lets you reconstruct one of the most important graphs in
      astronomy: the <strong>Hubble diagram</strong>. Each dot on the chart
      is a galaxy. The further away a galaxy is, the faster it appears to
      be moving away from us — and the slope of the line that fits the
      points is <strong>Hubble's constant H₀</strong>, which tells us how
      quickly the universe is expanding.</p>

      <h4 style="margin-top:18px">1. Find galaxies on the sky</h4>
      <p>The left panel shows real images of the night sky from telescope
      surveys (DSS2, PanSTARRS, SDSS, 2MASS — switch between them at the
      top). Curated galaxies are marked with coloured shapes. Click any
      marker to learn about it; some carry small badges:</p>
      <ul>
        <li><strong>✦ Cepheids</strong> — the Hubble Space Telescope
          has measured pulsating Cepheid stars in this galaxy, and you
          can use them to derive a distance.</li>
        <li><strong>λ Spectrum</strong> — there's an SDSS spectrum
          available, so you can measure the redshift yourself.</li>
        <li><strong>⚠ Anomaly</strong> — this galaxy doesn't fit
          Hubble's law for an interesting reason. Click it to find out
          why.</li>
      </ul>

      <h4 style="margin-top:18px">2. Add galaxies to the chart</h4>
      <p>For each galaxy, you have three options:</p>
      <ul>
        <li><strong>Use the curated values</strong> — just click "Add
          to chart". The published distance and recession velocity are
          plotted directly.</li>
        <li><strong>Find the distance yourself</strong> — for galaxies
          with the ✦ badge, open the Cepheid panel and walk through the
          period–luminosity relation step by step.</li>
        <li><strong>Find the redshift yourself</strong> — for galaxies
          with the λ badge, open the spectrum panel, identify a
          spectral line, and read off the redshift.</li>
      </ul>

      <h4 style="margin-top:18px">3. Watch Hubble's law emerge</h4>
      <p>Once you have a few galaxies plotted, the app fits a straight
      line through them and reports the slope. That slope is your
      measured H₀, in km/s per megaparsec. Compare it to the published
      value (the dashed line). With ~10 galaxies in the local universe
      you should land somewhere between 50 and 90 — the spread tells
      you why measuring H₀ precisely is hard.</p>

      <h4 style="margin-top:18px">4. Explore the anomalies</h4>
      <p>Some galaxies will look wrong on the chart. They are wrong on
      purpose — and they teach important physics. The Local Group
      galaxies (Andromeda, Triangulum, the Magellanic Clouds) are too
      close for Hubble's law to dominate over their gravitational pull
      on each other. NGC 7320 looks like a member of Stephan's Quintet
      but is actually a foreground galaxy. 3C 273 is a quasar — bright
      enough to look nearby, but actually 750 Mpc away.</p>

      <h4 style="margin-top:18px">A short history</h4>
      <p>In 1929, Edwin Hubble published a chart of 24 nearby galaxies
      showing this same straight-line relationship between distance
      and recession velocity. It was the first observational evidence
      that the universe is expanding — and led directly to the Big
      Bang theory. You're rebuilding his discovery with much better
      data.</p>
    `;
  }
}
