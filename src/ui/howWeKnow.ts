import katex from "katex";
import "katex/dist/katex.min.css";
import { openModal } from "./modal";
import {
  buildDopplerDiagram,
  buildGalaxyRedshiftDiagram,
  buildBalmerDiagram,
  buildLineShiftDiagram,
} from "./diagrams";

// "How we know" — the physics behind every number. Aimed at a sixth-
// form / A-Level audience: assumes basic logarithms and exponents,
// defines everything else inline. Copy is the user-edited round-2
// draft from the IMPROVEMENTS plan; the [INSERT DIAGRAM] markers
// from that draft are realised here as inline SVG components from
// `src/ui/diagrams/`.
//
// Each section is wrapped in a collapsible `<details class="info-section">`
// so the student can scan headings then dive into the topic that's
// relevant to their current question — same UX as h-r-diagram's
// "How we know" modal.

export class HowWeKnow {
  open(): void {
    const { inner } = openModal(
      "How we know — the physics behind the numbers",
    );
    inner.appendChild(this.build());
  }

  private build(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.appendChild(p(`Every value the app shows is computed from real
      measurements using the formulas below. These formulas have been
      derived by astronomers, mostly in the last 120 years. We use real
      data and the same formulas to do exactly the same calculations
      that professional astronomers can do.`));

    // 1. Cepheid period-luminosity ----------------------------------
    {
      const body = section(
        wrap,
        "Why do longer Cepheid Variable Star pulses mean brighter stars?",
        true,
      );
      body.appendChild(p(`A Cepheid is a star that pulsates. This
        happens because of an instability in its outer layers: helium
        gas alternately ionises and recombines, making the star
        expand and contract on a regular schedule. Bigger stars have
        more material to move, so their pulsation cycle takes longer
        — but bigger stars also put out more light. So the schedule
        (period) is set by the size, and the size sets the
        brightness. This means that by measuring the period, we know
        the brightness of the star. Then we can compare it to how
        bright it <em>appears</em> to be, and that will tell us the
        distance to the star.`));
      body.appendChild(p(`This means that if we can find Cepheid
        variable stars in other galaxies (and we can!) they can be
        used to find out the distance to those galaxies.`));
      body.appendChild(p(`In 1908 Henrietta Leavitt noticed this in
        Cepheids inside the Small Magellanic Cloud — a nearby galaxy.
        Because the SMC is far enough that all its Cepheids are
        roughly the same distance from us, the brightness they
        appear to have is also their relative real brightness — and
        Leavitt could see the pattern directly. Today the
        relationship is well calibrated:`));
      body.appendChild(
        katexBlock(String.raw`M = a \, (\log_{10}(P / \text{days}) - 1) + b`),
      );
      body.appendChild(p(`The constants <em>a</em> and <em>b</em>
        come from a small number of "anchor" Cepheids whose distances
        we know geometrically — such as <strong>Polaris, the Pole
        Star</strong>. This is actually the closest Cepheid to Earth,
        and its distance has been measured precisely by the European
        Space Agency's Gaia spacecraft using <em>parallax</em> (the
        same method we use for any star closer than about 1000
        parsecs). The other anchor is a special galaxy called NGC
        4258 whose distance was measured from radio observations of
        some very unusual phenomena
        (<a href="https://en.wikipedia.org/wiki/NGC_4258" target="_blank" rel="noopener">read about it on Wikipedia</a>).`));
    }

    // 2. Distance modulus -------------------------------------------
    {
      const body = section(wrap, "Distance from how dim something looks");
      body.appendChild(p(`Light spreads out as it travels — twice as
        far away means a quarter the brightness, ten times as far
        means a hundredth. If you know how bright something
        <em>really</em> is (M, called absolute magnitude) and how
        bright it <em>looks</em> from Earth (m, called apparent
        magnitude), you can solve for the distance:`));
      body.appendChild(
        katexBlock(String.raw`d \,(\text{parsecs}) = 10^{(m - M + 5)/5}`),
      );
      body.appendChild(p(`The "+5 ÷ 5" comes from how astronomical
        magnitudes are defined — a difference of 5 magnitudes
        corresponds to a brightness ratio of exactly 100. One parsec
        ≈ 3.26 light-years, ≈ 3.1 × 10¹⁶ metres.`));
    }

    // 3. Wesenheit / dust correction --------------------------------
    {
      const body = section(wrap, "Why we correct for dust");
      body.appendChild(p(`Dust (hydrogen and any other elements)
        between us and a Cepheid star scatters its light unevenly.
        Blue and yellow are scattered more than red, so we see less
        of those colours. That means the star looks both
        <em>dimmer</em> and <em>redder</em> than it really is.
        Without correction, dusty Cepheids look further away than
        they are.`));
      body.appendChild(p(`The trick is to measure the Cepheid in two
        colours. The redder it appears, the more dust there is in
        front of it. We can subtract a precise amount of brightness
        to compensate for this:`));
      body.appendChild(
        katexBlock(String.raw`m_{\text{corrected}} = m - R \, (V - I)`),
      );
      body.appendChild(p(`where R ≈ 0.386 is a calibration constant
        from physics experiments on dust, and V−I is the colour
        difference. The corrected magnitude is called the
        <strong>Wesenheit magnitude</strong>. It cancels out the
        dust effect cleanly.`));
    }

    // 4. Redshift / Doppler -----------------------------------------
    {
      const body = section(wrap, "Why redshift means motion");
      body.appendChild(p(`Imagine an ambulance siren as it drives
        past — the pitch sounds higher coming toward you, lower
        going away.`));
      body.appendChild(diagramFrame(buildDopplerDiagram()));
      body.appendChild(p(`Light does the same thing. A galaxy moving
        away has the colours of its light slightly shifted toward
        the red end of the rainbow.`));
      body.appendChild(diagramFrame(buildGalaxyRedshiftDiagram()));
      body.appendChild(p(`The size of the shift is called the
        <em>redshift</em>, which is usually given the letter
        <em>z</em>:`));
      body.appendChild(
        katexBlock(
          String.raw`z = \frac{\lambda_{\text{observed}} - \lambda_{\text{rest}}}{\lambda_{\text{rest}}}`,
        ),
      );
      body.appendChild(p(`where λ<sub>rest</sub> is the original
        wavelength of radiation, and λ<sub>observed</sub> is the
        wavelength that we see from the galaxy.`));
      body.appendChild(p(`We can measure the change in wavelength
        because of spectral lines. A <em>spectral line</em> is a
        bright, or dark, line in a spectrum. When we split up light
        (e.g. the Sun's white light can be split into a rainbow by a
        prism), we can see that some colours in that spectrum are
        brighter or darker than others.`));
      body.appendChild(p(`The spectral lines exist because of
        specific elements. For example, hydrogen <em>always</em>
        produces lines at:`));
      const balmerList = document.createElement("ul");
      for (const [name, nm] of [
        ["Hα", 656.3],
        ["Hβ", 486.1],
        ["Hγ", 434.0],
        ["Hδ", 410.2],
      ] as const) {
        const li = document.createElement("li");
        li.innerHTML = `${name} = ${nm} nm`;
        balmerList.appendChild(li);
      }
      body.appendChild(balmerList);
      body.appendChild(diagramFrame(buildBalmerDiagram()));
      body.appendChild(p(`When a galaxy is moving away from us, the
        lines appear to shift position.`));
      body.appendChild(diagramFrame(buildLineShiftDiagram()));
      body.appendChild(p(`To turn z into a velocity, for slow
        galaxies (z ≪ 1):`));
      body.appendChild(katexBlock(String.raw`v = c \, z`));
      body.appendChild(p(`where c = 299 792 km/s is the speed of
        light. For high redshifts (z > 0.1), the simple formula
        doesn't work precisely, so we use:`));
      body.appendChild(
        katexBlock(String.raw`v = c \, \frac{(1+z)^2 - 1}{(1+z)^2 + 1}`),
      );
    }

    // 5. The slope is H₀ --------------------------------------------
    {
      const body = section(wrap, "Why the slope is H₀");
      body.appendChild(p(`Hubble found the relationship that
        recession velocity is proportional to distance (v ∝ d). He
        turned it into an equation, a <em>law</em>, by introducing a
        constant of proportionality (v = k × d) which we now call
        the <strong>Hubble constant</strong>, and give the symbol H₀
        — so Hubble's Law is now written:`));
      body.appendChild(katexBlock(String.raw`v = H_0 \, d`));
      body.appendChild(p(`If you plot v on the y-axis against d on
        the x-axis, the slope of a straight line through the data
        <em>is</em> H₀. The line will pass through the origin of the
        graph. The units of H₀ work out to km/s per megaparsec.`));
      body.appendChild(p(`The current best published value is around
        70 km/s/Mpc (this means a galaxy at a distance of 1 Mpc away
        will be moving away from the Milky Way at 70 km/s; a galaxy
        at 20 Mpc away will be moving at 20 times this speed —
        1,400 km/s — and so on). Different methods of measuring it
        disagree by a few km/s — that disagreement is called the
        <strong>"Hubble tension"</strong> and is one of the hottest
        open questions in cosmology right now. When you measure H₀
        in this app, you'll see the same kind of scatter that
        astronomers fight with in real life.`));
    }

    // 6. Why some galaxies don't fit --------------------------------
    {
      const body = section(wrap, "Why some galaxies don't fit");
      body.appendChild(p(`Hubble's law is a <em>cosmological</em>
        effect — it describes the universe's overall expansion. But
        within a galaxy group, gravity pulls members toward each
        other faster than the universe is pushing them apart. The
        Local Group galaxies (Andromeda, the Magellanic Clouds, M33)
        are caught by the Milky Way's gravity, so their motion is
        mostly orbital, not cosmological — and Andromeda is actually
        moving toward us, not away.`));
      body.appendChild(p(`At the other end, the highest-redshift
        galaxies in the Hubble Deep Field show light that has been
        travelling for over 10 billion years. These also don't fit
        the chart — and that actually tells us something even more
        important — that the universe's expansion rate has
        <em>changed over time</em>.`));
    }

    return wrap;
  }
}

function p(html: string): HTMLElement {
  const el = document.createElement("p");
  el.innerHTML = html;
  return el;
}

// Build a collapsible info-section, append it to `host`, and return
// the inner body element so the caller can append paragraphs /
// equations / diagrams into it.
function section(
  host: HTMLElement,
  title: string,
  open = false,
): HTMLElement {
  const det = document.createElement("details");
  det.className = "info-section";
  if (open) det.open = true;
  const sum = document.createElement("summary");
  sum.textContent = title;
  det.appendChild(sum);
  const body = document.createElement("div");
  body.className = "info-section-body";
  det.appendChild(body);
  host.appendChild(det);
  return body;
}

function katexBlock(tex: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "formula formula-katex";
  katex.render(tex, el, { throwOnError: false, displayMode: true });
  return el;
}

function diagramFrame(svg: SVGElement): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "hwk-diagram";
  wrap.appendChild(svg);
  return wrap;
}
