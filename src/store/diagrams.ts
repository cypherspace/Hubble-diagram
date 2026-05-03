import type { AxisConfig, PlottedGalaxy, SavedDiagram } from "../types";

const STORAGE_KEY = "hubble-diagram.saved";

interface StoredEnvelope {
  version: 1;
  diagrams: Record<string, SavedDiagram>;
}

function readAll(): StoredEnvelope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, diagrams: {} };
    const parsed = JSON.parse(raw) as StoredEnvelope;
    if (parsed.version !== 1) return { version: 1, diagrams: {} };
    return parsed;
  } catch {
    return { version: 1, diagrams: {} };
  }
}

function writeAll(env: StoredEnvelope): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
}

export function saveDiagram(
  name: string,
  galaxies: PlottedGalaxy[],
  axes: AxisConfig,
): void {
  const env = readAll();
  env.diagrams[name] = {
    name,
    savedAt: Date.now(),
    galaxies,
    axes,
  };
  writeAll(env);
}

export function loadDiagram(name: string): SavedDiagram | undefined {
  return readAll().diagrams[name];
}

export function deleteDiagram(name: string): void {
  const env = readAll();
  delete env.diagrams[name];
  writeAll(env);
}

export function listDiagrams(): SavedDiagram[] {
  return Object.values(readAll().diagrams);
}
