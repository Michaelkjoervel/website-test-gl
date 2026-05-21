// =============================================================================
// learningModel
// -----------------------------------------------------------------------------
// Forberedt til fremtidig AI/ML-træning.
//
// I version 1 bruger vi en simpel regelbaseret matching mellem nyt estimat
// og historiske projekter (estimat ↔ faktisk pris). Når der er nok data,
// kan denne fil erstattes af f.eks.:
//   - en regressionsmodel pr. områdetype
//   - et embedding-baseret similarity-look-up
//   - et eksternt ML-endpoint (POST projektdata, modtag justeringspct.)
//
//   --> ERSTAT findSimilar() med en rigtig ML-inference når data er klar.
// =============================================================================

import type { CustomerEstimate, HistoricalOffer, TechnicalInput } from "./types";

export interface SimilarMatch {
  source: "historisk" | "estimat";
  projectName: string;
  similarityScore: number; // 0..1
  estimated: number;
  actual: number;
  deltaPct: number; // (actual - estimated) / estimated
}

export interface LearningSuggestion {
  count: number; // antal lignende fundet
  averageDeltaPct: number; // gennemsnitlig afvigelse i procent
  maturity: "Ingen" | "Begrænset" | "Brugbar" | "Stærk";
  message: string;
  matches: SimilarMatch[];
}

// Konverter et CustomerEstimate (med actual) til samme form som HistoricalOffer.
export function estimatesToHistoricalShape(
  estimates: CustomerEstimate[],
): HistoricalOffer[] {
  return estimates
    .filter((e) => e.actual && e.actual.actualTotal && e.actual.actualTotal > 0)
    .map((e) => ({
      projectName: e.projectName,
      areaType: e.technical.areaType,
      luminaireCount: e.technical.luminaireCount,
      controlType: e.technical.controlType,
      luxLevel:
        typeof e.technical.luxLevel === "number" ? e.technical.luxLevel : 300,
      kelvin: typeof e.technical.kelvin === "number" ? e.technical.kelvin : 4000,
      annualBurnHours: e.technical.annualBurnHours,
      electricityPrice: e.technical.electricityPrice,
      estimatedPrice: e.pricing.totalCost,
      actualPrice: e.actual!.actualTotal!,
      status: e.actual?.finalStatus ?? e.status,
    }));
}

function scoreSimilarity(a: TechnicalInput, b: HistoricalOffer): number {
  // Vægtet ligheds-score 0..1. Højeste vægt på områdetype og styring.
  let score = 0;
  let weight = 0;

  const add = (w: number, ok: number) => {
    score += w * ok;
    weight += w;
  };

  add(0.3, a.areaType === b.areaType ? 1 : 0);
  add(0.25, a.controlType === b.controlType ? 1 : 0);

  const countDiff =
    Math.abs(a.luminaireCount - b.luminaireCount) /
    Math.max(a.luminaireCount, b.luminaireCount, 1);
  add(0.2, Math.max(0, 1 - countDiff));

  const luxA = typeof a.luxLevel === "number" ? a.luxLevel : 300;
  const luxDiff = Math.abs(luxA - b.luxLevel) / Math.max(luxA, b.luxLevel, 1);
  add(0.1, Math.max(0, 1 - luxDiff));

  const burnDiff =
    Math.abs(a.annualBurnHours - b.annualBurnHours) /
    Math.max(a.annualBurnHours, b.annualBurnHours, 1);
  add(0.15, Math.max(0, 1 - burnDiff));

  return weight === 0 ? 0 : score / weight;
}

function maturityFor(n: number): LearningSuggestion["maturity"] {
  if (n < 10) return "Ingen";
  if (n < 30) return "Begrænset";
  if (n < 100) return "Brugbar";
  return "Stærk";
}

/**
 * Hovedfunktionen: returnerer en justeringsanbefaling baseret på lignende
 * historiske projekter. Når en ML-model implementeres, kan den kaldes her
 * og denne logik bruges som fallback.
 */
export function suggestAdjustment(
  input: TechnicalInput,
  historical: HistoricalOffer[],
  ownEstimates: CustomerEstimate[],
): LearningSuggestion {
  const datapoints = [
    ...historical,
    ...estimatesToHistoricalShape(ownEstimates),
  ];

  const scored: SimilarMatch[] = datapoints
    .map((d) => {
      const sim = scoreSimilarity(input, d);
      const delta =
        d.estimatedPrice > 0
          ? (d.actualPrice - d.estimatedPrice) / d.estimatedPrice
          : 0;
      return {
        source: "historisk" as const,
        projectName: d.projectName,
        similarityScore: sim,
        estimated: d.estimatedPrice,
        actual: d.actualPrice,
        deltaPct: delta,
      };
    })
    .filter((m) => m.similarityScore >= 0.55)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 8);

  const count = scored.length;
  const avg =
    count === 0 ? 0 : scored.reduce((s, m) => s + m.deltaPct, 0) / count;

  const maturity = maturityFor(datapoints.length);

  let message: string;
  if (datapoints.length === 0) {
    message =
      "Datagrundlaget er begrænset. Estimatet er udelukkende baseret på placeholder-priser.";
  } else if (count === 0) {
    message =
      "Ingen lignende historiske projekter fundet endnu – estimatet bruger placeholder-priser.";
  } else {
    const pct = (avg * 100).toFixed(1);
    const sign = avg >= 0 ? "+" : "";
    message = `Baseret på lignende projekter anbefales en justering på ${sign}${pct}% (fundet ${count} lignende projekter).`;
  }

  return {
    count,
    averageDeltaPct: avg,
    maturity,
    message,
    matches: scored,
  };
}
