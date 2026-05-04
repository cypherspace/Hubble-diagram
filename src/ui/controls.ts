import type { AxisConfig } from "../types";

export interface ControlsCallbacks {
  onAxesChange: (axes: AxisConfig) => void;
  onClearAll: () => void;
  onClearSelected: () => void;
  onResetZoom: () => void;
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
}

// Linear axes only. Auto-scaling on by default; the radio-style range
// toggle is now a "Local universe" override that clamps to <= 200 Mpc.
// "Show negative velocities" lets blueshifted Local Group galaxies
// drop below the y=0 line.
export class Controls {
  private el: HTMLElement;
  private axes: AxisConfig;
  private cb: ControlsCallbacks;

  constructor(host: HTMLElement, axes: AxisConfig, cb: ControlsCallbacks) {
    this.el = host;
    this.axes = axes;
    this.cb = cb;
    this.render();
  }

  setAxes(axes: AxisConfig): void {
    this.axes = axes;
    this.render();
  }

  private render(): void {
    this.el.replaceChildren();

    const yGroup = group("Y axis");
    const yVel = radio("y-mode", "velocity", "Velocity (km/s)", this.axes.yMode === "velocity");
    const yZ = radio("y-mode", "redshift", "Redshift z", this.axes.yMode === "redshift");
    yVel.input.addEventListener("change", () => {
      this.axes = { ...this.axes, yMode: "velocity" };
      this.cb.onAxesChange(this.axes);
    });
    yZ.input.addEventListener("change", () => {
      this.axes = { ...this.axes, yMode: "redshift" };
      this.cb.onAxesChange(this.axes);
    });
    yGroup.append(yVel.label, yZ.label);
    this.el.appendChild(yGroup);

    const rangeGroup = group("Range");
    const rangeAuto = radio(
      "range",
      "auto",
      "Auto-scale",
      this.axes.range === "auto",
    );
    const rangeLocal = radio(
      "range",
      "localOnly",
      "Local universe (≤200 Mpc)",
      this.axes.range === "localOnly",
    );
    rangeAuto.input.addEventListener("change", () => {
      this.axes = { ...this.axes, range: "auto" };
      this.cb.onAxesChange(this.axes);
    });
    rangeLocal.input.addEventListener("change", () => {
      this.axes = { ...this.axes, range: "localOnly" };
      this.cb.onAxesChange(this.axes);
    });
    rangeGroup.append(rangeAuto.label, rangeLocal.label);
    this.el.appendChild(rangeGroup);

    const visGroup = group("Show");
    const showNeg = checkbox(
      "show-negative",
      "Negative velocities (blueshifts)",
      this.axes.showNegative === true,
    );
    showNeg.input.addEventListener("change", () => {
      this.axes = { ...this.axes, showNegative: showNeg.input.checked };
      this.cb.onAxesChange(this.axes);
    });
    const showRef = checkbox(
      "show-ref-line",
      "Accepted H₀ line (70 km/s/Mpc)",
      this.axes.showRefLine === true,
    );
    showRef.input.addEventListener("change", () => {
      this.axes = { ...this.axes, showRefLine: showRef.input.checked };
      this.cb.onAxesChange(this.axes);
    });
    visGroup.append(showNeg.label, showRef.label);
    this.el.appendChild(visGroup);

    const actionGroup = group("Diagram");
    const clearAll = button("Clear all", () => this.cb.onClearAll());
    const clearOne = button("Clear selected", () => this.cb.onClearSelected());
    const resetZoom = button("Reset zoom", () => this.cb.onResetZoom());
    actionGroup.append(clearAll, clearOne, resetZoom);
    this.el.appendChild(actionGroup);

    const saveGroup = group("Save / load");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Diagram name";
    nameInput.size = 14;
    const saveBtn = button("Save", () => {
      const n = nameInput.value.trim();
      if (n) this.cb.onSave(n);
    });
    const loadBtn = button("Load", () => {
      const n = nameInput.value.trim();
      if (n) this.cb.onLoad(n);
    });
    saveGroup.append(nameInput, saveBtn, loadBtn);
    this.el.appendChild(saveGroup);
  }
}

function group(heading: string): HTMLElement {
  const g = document.createElement("div");
  g.className = "control-group";
  const h = document.createElement("span");
  h.className = "control-group-heading";
  h.textContent = heading;
  g.appendChild(h);
  return g;
}

function radio(
  name: string,
  value: string,
  text: string,
  checked: boolean,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement("label");
  label.className = "control-pair";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  label.append(input, document.createTextNode(" " + text));
  return { label, input };
}

function checkbox(
  name: string,
  text: string,
  checked: boolean,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement("label");
  label.className = "control-pair";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.checked = checked;
  label.append(input, document.createTextNode(" " + text));
  return { label, input };
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
