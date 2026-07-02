// =============================================================================
// visualizationStorage
// -----------------------------------------------------------------------------
// Lokal persistens for visualiseringsuniverset (armaturer + visualiseringer).
// Samme repository-mønster som src/lib/storage.ts, så det uden videre kan
// byttes til en backend/API senere (bevar signaturer).
//
// Bemærk: billeder gemmes som nedskalerede dataURLs. localStorage har ~5 MB,
// så setItem er pakket ind i try/catch og kaster en læsbar fejl ved overløb.
// =============================================================================

import type { Fixture, Visualization } from "./visualizationTypes";
import { seedFixtures } from "./fixtureSeed";

const FIXTURES_KEY = "gl.viz.fixtures.v1";
const VISUALIZATIONS_KEY = "gl.viz.visualizations.v1";
const SEEDED_FLAG = "gl.viz.seeded.v1";

export class StorageQuotaError extends Error {
  constructor() {
    super(
      "Lageret i browseren er fyldt. Slet en gammel visualisering, eller brug færre/mindre billeder.",
    );
    this.name = "StorageQuotaError";
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeKey(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new StorageQuotaError();
    }
    throw err;
  }
}

export const vizStorage = {
  // --- Armaturer ("Universet") --------------------------------------------
  listFixtures(): Fixture[] {
    const raw = localStorage.getItem(FIXTURES_KEY);
    if (raw === null && !localStorage.getItem(SEEDED_FLAG)) {
      // Første besøg: seed universet med realistiske pladsholdere.
      const seeded = seedFixtures();
      writeKey(FIXTURES_KEY, seeded);
      localStorage.setItem(SEEDED_FLAG, "1");
      return seeded;
    }
    return safeParse<Fixture[]>(raw, []);
  },

  getFixture(id: string): Fixture | undefined {
    return this.listFixtures().find((f) => f.id === id);
  },

  saveFixture(fx: Fixture): void {
    const all = this.listFixtures();
    const idx = all.findIndex((f) => f.id === fx.id);
    fx.updatedAt = new Date().toISOString();
    if (idx >= 0) all[idx] = fx;
    else all.unshift(fx);
    writeKey(FIXTURES_KEY, all);
  },

  deleteFixture(id: string): void {
    const all = this.listFixtures().filter((f) => f.id !== id);
    writeKey(FIXTURES_KEY, all);
  },

  // Bulk-tilføj (import). Nye armaturer lægges forrest. Returnerer antal tilføjet.
  addFixtures(fixtures: Fixture[]): number {
    if (!fixtures.length) return 0;
    const all = [...fixtures, ...this.listFixtures()];
    writeKey(FIXTURES_KEY, all);
    localStorage.setItem(SEEDED_FLAG, "1");
    return fixtures.length;
  },

  resetFixtures(): Fixture[] {
    const seeded = seedFixtures();
    writeKey(FIXTURES_KEY, seeded);
    localStorage.setItem(SEEDED_FLAG, "1");
    return seeded;
  },

  // --- Visualiseringer -----------------------------------------------------
  listVisualizations(): Visualization[] {
    return safeParse<Visualization[]>(
      localStorage.getItem(VISUALIZATIONS_KEY),
      [],
    );
  },

  getVisualization(id: string): Visualization | undefined {
    return this.listVisualizations().find((v) => v.id === id);
  },

  saveVisualization(viz: Visualization): void {
    const all = this.listVisualizations();
    const idx = all.findIndex((v) => v.id === viz.id);
    viz.updatedAt = new Date().toISOString();
    if (idx >= 0) all[idx] = viz;
    else all.unshift(viz);
    writeKey(VISUALIZATIONS_KEY, all);
  },

  deleteVisualization(id: string): void {
    const all = this.listVisualizations().filter((v) => v.id !== id);
    writeKey(VISUALIZATIONS_KEY, all);
  },
};

export function newVizId(prefix: "fx" | "viz" | "pt" | "rnd"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
