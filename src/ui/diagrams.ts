// SVG diagrams for the "How we know" panel. Each function returns a
// stand-alone SVGElement that can be appended into the modal. Kept
// in one file because they all share visual style (same palette,
// same sizing) and total ~200 lines.
//
// All diagrams are responsive (preserveAspectRatio="xMidYMid meet")
// so they scale cleanly with the modal width.

import { LINE_CATALOG } from "../data/lineCatalog";

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(viewBox: string): SVGSVGElement {
  const s = document.createElementNS(SVG_NS, "svg");
  s.setAttribute("viewBox", viewBox);
  s.setAttribute("preserveAspectRatio", "xMidYMid meet");
  s.setAttribute("width", "100%");
  s.setAttribute("style", "max-width: 540px; display: block;");
  return s;
}

function el(
  parent: SVGElement,
  tag: string,
  attrs: Record<string, string | number>,
): SVGElement {
  const node = document.createElementNS(SVG_NS, tag) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  parent.appendChild(node);
  return node;
}

function text(
  parent: SVGElement,
  x: number,
  y: number,
  txt: string,
  attrs: Record<string, string | number> = {},
): SVGElement {
  const t = el(parent, "text", { x, y, fill: "#e6ecff", "font-size": 11, ...attrs });
  t.textContent = txt;
  return t;
}

// =============================================================
//  1. Doppler / ambulance siren
// =============================================================

export function buildDopplerDiagram(): SVGElement {
  const s = svg("0 0 540 200");
  // Subtle background tile.
  el(s, "rect", { x: 0, y: 0, width: 540, height: 200, fill: "transparent" });

  // Direction-of-travel arrow.
  el(s, "line", {
    x1: 30, y1: 100, x2: 510, y2: 100,
    stroke: "#3a456b", "stroke-width": 1, "stroke-dasharray": "3,3",
  });
  text(s, 270, 92, "→ direction of travel →", {
    "text-anchor": "middle", fill: "#8b95b8", "font-size": 10,
  });

  // Ambulance — a simple rounded rectangle with a flashing light.
  const carX = 270;
  el(s, "rect", {
    x: carX - 30, y: 110, width: 60, height: 30, rx: 5,
    fill: "#9bd3ff", stroke: "#1a2240",
  });
  el(s, "rect", { x: carX - 26, y: 116, width: 12, height: 8, fill: "#1a2240" });
  el(s, "rect", { x: carX + 14, y: 116, width: 12, height: 8, fill: "#1a2240" });
  el(s, "circle", { cx: carX, cy: 109, r: 3, fill: "#ff7b7b" });
  el(s, "circle", { cx: carX - 18, cy: 142, r: 4, fill: "#1a2240" });
  el(s, "circle", { cx: carX + 18, cy: 142, r: 4, fill: "#1a2240" });

  // Compressed waves AHEAD of the ambulance (right side, higher pitch).
  for (let i = 0; i < 5; i++) {
    const cx = carX + 50 + i * 22;
    el(s, "circle", {
      cx, cy: 125, r: 12 + i * 4,
      fill: "none", stroke: "#ffd166", "stroke-width": 1.2, opacity: 0.7,
    });
  }
  text(s, 480, 60, "higher pitch ↑", {
    "text-anchor": "end", fill: "#ffd166", "font-size": 12,
  });

  // Stretched waves BEHIND the ambulance (left side, lower pitch).
  for (let i = 0; i < 4; i++) {
    const cx = carX - 60 - i * 38;
    el(s, "circle", {
      cx, cy: 125, r: 18 + i * 9,
      fill: "none", stroke: "#6dd58c", "stroke-width": 1.2, opacity: 0.7,
    });
  }
  text(s, 60, 60, "lower pitch ↓", {
    "text-anchor": "start", fill: "#6dd58c", "font-size": 12,
  });

  text(s, 270, 190, "Sound waves bunch up in front, stretch out behind.", {
    "text-anchor": "middle", fill: "#8b95b8", "font-size": 10,
  });
  return s;
}

// =============================================================
//  2. Galaxy redshift — same idea, but for light
// =============================================================

export function buildGalaxyRedshiftDiagram(): SVGElement {
  const s = svg("0 0 540 200");
  // Two galaxy "rainbow strips": top = stationary, bottom = receding.
  const labels = ["At rest", "Moving away from us"];
  const ys = [40, 130];
  const shifts = [0, 22];
  for (let i = 0; i < 2; i++) {
    text(s, 30, ys[i] - 5, labels[i], { fill: "#8b95b8", "font-size": 10 });
    drawRainbow(s, 30 + shifts[i], ys[i], 480, 30);
    if (i === 1) {
      // Arrow showing the shift.
      el(s, "line", {
        x1: 30, y1: ys[i] + 50, x2: 30 + shifts[i] + 12, y2: ys[i] + 50,
        stroke: "#ff7b7b", "stroke-width": 1.5, "marker-end": "url(#arrow-rs)",
      });
      // Marker.
      const defs = el(s, "defs", {});
      const marker = el(defs, "marker", {
        id: "arrow-rs", viewBox: "0 0 10 10",
        refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto",
      });
      el(marker, "path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#ff7b7b" });
      text(s, 30 + shifts[i] + 18, ys[i] + 53, "shifted toward red", {
        fill: "#ff7b7b", "font-size": 10,
      });
    }
  }
  return s;
}

function drawRainbow(parent: SVGElement, x: number, y: number, w: number, h: number): void {
  const grad = el(parent, "linearGradient", { id: `rainbow-${x}-${y}` });
  // Use SVG namespace ID — make unique by coords.
  grad.setAttribute("x1", "0%");
  grad.setAttribute("x2", "100%");
  const stops = [
    [0, "#5b3a8a"], [15, "#3a4cd4"], [30, "#3aa6d4"],
    [45, "#3ad48a"], [60, "#d4d43a"], [75, "#d48a3a"], [100, "#d43a3a"],
  ];
  for (const [pct, color] of stops) {
    el(grad, "stop", { offset: `${pct}%`, "stop-color": String(color) });
  }
  el(parent, "rect", { x, y, width: w, height: h, fill: `url(#rainbow-${x}-${y})` });
}

// =============================================================
//  3. Balmer series on the visible spectrum
// =============================================================

export function buildBalmerDiagram(): SVGElement {
  const s = svg("0 0 540 140");
  // Visible band 380-700 nm.
  const xMin = 380;
  const xMax = 700;
  const W = 480;
  const H = 50;
  const x0 = 30;
  const y0 = 30;
  const xOf = (nm: number): number => x0 + ((nm - xMin) / (xMax - xMin)) * W;

  drawRainbow(s, x0, y0, W, H);
  // Tick scale below the rainbow.
  for (let nm = 400; nm <= 700; nm += 50) {
    const x = xOf(nm);
    el(s, "line", { x1: x, y1: y0 + H, x2: x, y2: y0 + H + 5, stroke: "#8b95b8" });
    text(s, x, y0 + H + 18, `${nm}`, {
      "text-anchor": "middle", fill: "#8b95b8", "font-size": 10,
    });
  }
  text(s, x0 + W / 2, 130, "Wavelength (nm)", {
    "text-anchor": "middle", fill: "#8b95b8", "font-size": 11,
  });

  // Balmer series — Hα, Hβ, Hγ, Hδ (in nm).
  const lines = [
    { name: "Hα", nm: 656.3 },
    { name: "Hβ", nm: 486.1 },
    { name: "Hγ", nm: 434.0 },
    { name: "Hδ", nm: 410.2 },
  ];
  for (const ln of lines) {
    const x = xOf(ln.nm);
    el(s, "line", {
      x1: x, y1: y0 - 8, x2: x, y2: y0 + H + 8,
      stroke: "#ffffff", "stroke-width": 1.5, opacity: 0.85,
    });
    text(s, x, y0 - 12, ln.name, {
      "text-anchor": "middle", fill: "#ffffff", "font-size": 11,
      "font-weight": 600,
    });
  }
  return s;
}

// =============================================================
//  4. Lines shifting — rest above, redshifted below, arrows joining
// =============================================================

export function buildLineShiftDiagram(): SVGElement {
  const s = svg("0 0 540 200");
  const xMin = 380;
  const xMax = 800;
  const W = 480;
  const H = 30;
  const x0 = 30;
  const xOf = (nm: number): number => x0 + ((nm - xMin) / (xMax - xMin)) * W;

  // Rest spectrum (top) and redshifted spectrum (bottom).
  drawRainbow(s, x0, 30, W, H);
  drawRainbow(s, x0, 130, W, H);
  text(s, x0 - 5, 25, "Rest frame", {
    "text-anchor": "end", fill: "#8b95b8", "font-size": 10,
  });
  text(s, x0 - 5, 125, "Redshifted (z = 0.1)", {
    "text-anchor": "end", fill: "#ff7b7b", "font-size": 10,
  });

  // Pick a few lines from the catalog that fit in the rest band.
  const z = 0.1;
  const picks = LINE_CATALOG.filter(
    (l) => l.restAngstroms / 10 >= xMin && l.restAngstroms / 10 <= xMax - 80,
  ).slice(0, 5);
  for (const ln of picks) {
    const restNm = ln.restAngstroms / 10;
    const obsNm = restNm * (1 + z);
    const xRest = xOf(restNm);
    const xObs = xOf(obsNm);
    // Rest line.
    el(s, "line", {
      x1: xRest, y1: 22, x2: xRest, y2: 60 + 8,
      stroke: "#ffffff", "stroke-width": 1.4,
    });
    // Redshifted line.
    el(s, "line", {
      x1: xObs, y1: 122, x2: xObs, y2: 160 + 8,
      stroke: "#ffd166", "stroke-width": 1.4,
    });
    // Arrow joining them.
    el(s, "line", {
      x1: xRest, y1: 70, x2: xObs, y2: 120,
      stroke: "#ff7b7b", "stroke-width": 1, "stroke-dasharray": "2,2",
      "marker-end": "url(#arrow-shift)",
    });
    text(s, xRest, 16, ln.label.split(" ")[0], {
      "text-anchor": "middle", fill: "#ffffff", "font-size": 9,
    });
  }
  // Arrow marker.
  const defs = el(s, "defs", {});
  const marker = el(defs, "marker", {
    id: "arrow-shift", viewBox: "0 0 10 10",
    refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto",
  });
  el(marker, "path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#ff7b7b" });

  text(s, x0 + W / 2, 195, "Every line shifts by the same factor (1+z).", {
    "text-anchor": "middle", fill: "#8b95b8", "font-size": 10,
  });
  return s;
}
