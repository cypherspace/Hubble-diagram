import { openModal } from "./modal";

// "How we know" — the physics behind every number in the app. Aimed at
// a sixth-form / A-Level audience: assumes basic logarithms and
// exponents, defines everything else inline.

export class HowWeKnow {
  open(): void {
    const { inner } = openModal("How we know — the physics behind the numbers");
    inner.innerHTML = `
      <p>Every value the app shows is computed from real measurements
      using the formulas below. None of it is magic — astronomers solve
      the same equations.</p>

      <h4 style="margin-top:18px">Why do longer Cepheid pulses mean brighter stars?</h4>
      <p>A Cepheid is a star that pulsates because of a thermostat-like
      instability in its outer layers: helium gas alternately ionises and
      recombines, making the star expand and contract on a regular
      schedule. Bigger stars have more material to move, so their
      pulsation cycle takes longer — but bigger stars also put out more
      light. So the schedule (period) is set by the size, and the size
      sets the brightness.</p>
      <p>In 1908 Henrietta Leavitt noticed this in Cepheids inside the
      Small Magellanic Cloud. Because the SMC is far enough that all its
      Cepheids are roughly the same distance from us, the brightness
      they appear to have is also their relative real brightness — and
      Leavitt could see the pattern directly. Today the relationship is
      well calibrated:</p>
      <div class="formula">
        Real brightness M = a × (log<sub>10</sub>(P/days) − 1) + b
      </div>
      <p>The constants a and b come from a small number of "anchor"
      Cepheids whose distances we know geometrically — the Milky Way's
      own Cepheids (Gaia parallaxes), and a special galaxy called NGC
      4258 whose distance was measured from radio observations of water
      masers orbiting its central black hole.</p>

      <h4 style="margin-top:18px">Distance from how dim something looks</h4>
      <p>Light spreads out as it travels — twice as far away means a
      quarter the brightness, ten times as far means a hundredth. If you
      know how bright something <em>really</em> is (M, called absolute
      magnitude) and how bright it <em>looks</em> from Earth (m, called
      apparent magnitude), you can solve for the distance:</p>
      <div class="formula">d (parsecs) = 10 ^ ((m − M + 5) ÷ 5)</div>
      <p>The "+5 ÷ 5" comes from how astronomical magnitudes are defined
      — a difference of 5 magnitudes corresponds to a brightness ratio
      of exactly 100. One parsec ≈ 3.26 light-years, ≈ 3.1 × 10¹⁶ metres.</p>

      <h4 style="margin-top:18px">Why we correct for dust</h4>
      <p>Dust between us and a Cepheid scatters its light unevenly: blue
      and yellow are scattered more than red, so the star looks both
      <em>dimmer</em> and <em>redder</em> than it really is. Without
      correction, dusty Cepheids look further away than they are.</p>
      <p>The trick is to measure the Cepheid in two colours. The redder
      it appears, the more dust there is in front of it — and we can
      subtract a precise amount of brightness:</p>
      <div class="formula">m<sub>corrected</sub> = m − R × (V − I)</div>
      <p>where R ≈ 0.386 is a calibration constant from physics
      experiments on dust, and V−I is the colour difference. The
      corrected magnitude is called the <strong>Wesenheit magnitude</strong>.
      It cancels out the dust effect cleanly.</p>

      <h4 style="margin-top:18px">Why redshift means motion</h4>
      <p>Imagine an ambulance siren as it drives past — the pitch sounds
      higher coming toward you, lower going away. Light does the same
      thing. A galaxy moving away has the colours of its light slightly
      shifted toward the red end of the rainbow. The size of the shift
      is called the <strong>redshift</strong> z:</p>
      <div class="formula">
        z = (λ<sub>observed</sub> − λ<sub>rest</sub>) ÷ λ<sub>rest</sub>
      </div>
      <p>where λ<sub>rest</sub> is the wavelength a spectral line has
      when it isn't moving (measured in a lab) and λ<sub>observed</sub>
      is what we see from the galaxy. To turn z into a velocity, for
      slow galaxies (z ≪ 1):</p>
      <div class="formula">v = c × z</div>
      <p>where c = 299 792 km/s is the speed of light. For high redshifts
      (z > 0.1), the simple formula overestimates velocity because of
      special relativity, and we use:</p>
      <div class="formula">
        v = c × ((1+z)² − 1) ÷ ((1+z)² + 1)
      </div>

      <h4 style="margin-top:18px">Why the slope is H₀</h4>
      <p>Hubble's law says recession velocity is proportional to
      distance:</p>
      <div class="formula">v = H₀ × d</div>
      <p>If you plot v on the y-axis against d on the x-axis, the slope
      of a straight line through the data <em>is</em> H₀. The line is
      forced through the origin (a galaxy at zero distance has zero
      recession velocity by definition) and the units of H₀ work out to
      km/s per megaparsec.</p>
      <p>The current best published value is around 70 km/s/Mpc, but
      different methods of measuring it disagree by a few km/s — that
      disagreement is called the "Hubble tension" and is one of the
      hottest open questions in cosmology right now. When you measure
      H₀ in this app, you'll see the same kind of scatter that
      astronomers fight with in real life.</p>

      <h4 style="margin-top:18px">Why some galaxies don't fit</h4>
      <p>Hubble's law is a <em>cosmological</em> effect — it describes
      the universe's overall expansion. Within a galaxy group, gravity
      pulls members toward each other faster than the universe is
      pushing them apart. The Local Group galaxies (Andromeda, the
      Magellanic Clouds, M33) are caught by the Milky Way's gravity, so
      their motion is mostly orbital, not cosmological — and Andromeda
      is actually moving toward us, not away.</p>
      <p>At the other end, the highest-redshift galaxies in the Hubble
      Deep Field show light that has been travelling for over 10
      billion years. The simple linear law breaks down because the
      universe's expansion rate has changed over time. For those, you
      need a full general-relativistic cosmological model.</p>
    `;
  }
}
