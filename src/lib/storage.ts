// =============================================================================
// storage
// -----------------------------------------------------------------------------
// Lokal persistens for estimater og historiske tilbud.
// Bygget som et "repository" for nem udskiftning med en backend senere.
//
// Når cloud-database tilføjes:
//   - erstat funktionerne nedenfor med fetch-kald til API'et
//   - bevar samme signatur (returner Promises) så UI ikke skal ændres
// =============================================================================

import type { CustomerEstimate, HistoricalOffer } from "./types";

const ESTIMATES_KEY = "gl.estimator.estimates.v1";
const HISTORICAL_KEY = "gl.estimator.historical.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const storage = {
  listEstimates(): CustomerEstimate[] {
    return safeParse<CustomerEstimate[]>(
      localStorage.getItem(ESTIMATES_KEY),
      [],
    );
  },

  getEstimate(id: string): CustomerEstimate | undefined {
    return this.listEstimates().find((e) => e.id === id);
  },

  saveEstimate(est: CustomerEstimate): void {
    const all = this.listEstimates();
    const idx = all.findIndex((e) => e.id === est.id);
    est.updatedAt = new Date().toISOString();
    if (idx >= 0) all[idx] = est;
    else all.unshift(est);
    localStorage.setItem(ESTIMATES_KEY, JSON.stringify(all));
  },

  deleteEstimate(id: string): void {
    const all = this.listEstimates().filter((e) => e.id !== id);
    localStorage.setItem(ESTIMATES_KEY, JSON.stringify(all));
  },

  listHistorical(): HistoricalOffer[] {
    return safeParse<HistoricalOffer[]>(
      localStorage.getItem(HISTORICAL_KEY),
      [],
    );
  },

  saveHistorical(offers: HistoricalOffer[]): void {
    localStorage.setItem(HISTORICAL_KEY, JSON.stringify(offers));
  },

  appendHistorical(newOffers: HistoricalOffer[]): number {
    const all = [...this.listHistorical(), ...newOffers];
    this.saveHistorical(all);
    return all.length;
  },

  clearAll(): void {
    localStorage.removeItem(ESTIMATES_KEY);
    localStorage.removeItem(HISTORICAL_KEY);
  },
};

export function newId(): string {
  return `est_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
