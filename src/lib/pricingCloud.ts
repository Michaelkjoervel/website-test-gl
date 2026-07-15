// =============================================================================
// pricingCloud
// -----------------------------------------------------------------------------
// Henter og gemmer det FORTROLIGE prisgrundlag i Supabase-tabellen
// estimator_pricing (se supabase/schema.sql). Row Level Security sikrer, at
// kun loggede-ind brugere kan læse/skrive – de rigtige priser ligger derfor
// aldrig i den offentlige JS-bundle eller i repoet.
//
// Uden login (eller uden Supabase-config) kører appen videre på de ufarlige
// placeholder-priser i pricingConfig.ts.
// =============================================================================

import { supabase } from "./supabase";
import {
  applyPricingConfig,
  pricingConfig,
  type PricingConfig,
} from "./pricingConfig";

const TABLE = "estimator_pricing";
const CONFIG_ID = "default";

export interface CloudPricingStatus {
  loaded: boolean; // true når cloud-priser er lagt ind
  exists: boolean; // findes der en række i Supabase?
  updatedAt?: string;
  error?: string;
}

/**
 * Hent prisgrundlaget fra Supabase og læg det ind over placeholder-værdierne.
 * Kaldes efter login. Fejl vælter ikke appen – så bruges placeholders.
 */
export async function loadCloudPricing(): Promise<CloudPricingStatus> {
  if (!supabase) return { loaded: false, exists: false };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("config, updated_at")
      .eq("id", CONFIG_ID)
      .maybeSingle();

    if (error) {
      return { loaded: false, exists: false, error: error.message };
    }
    if (!data?.config) {
      // Ingen priser gemt endnu – placeholders bruges, indtil de uploades.
      return { loaded: false, exists: false };
    }
    applyPricingConfig(data.config as Partial<PricingConfig>);
    return { loaded: true, exists: true, updatedAt: data.updated_at };
  } catch (e) {
    return { loaded: false, exists: false, error: (e as Error).message };
  }
}

/** Gem en fuld konfiguration som det fælles prisgrundlag. */
export async function saveCloudPricing(
  config: PricingConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    return { ok: false, error: "Login/Supabase er ikke konfigureret." };
  }
  const { error } = await supabase
    .from(TABLE)
    .upsert({ id: CONFIG_ID, config });
  if (error) return { ok: false, error: error.message };
  applyPricingConfig(config);
  return { ok: true };
}

/** Meget let sanity-tjek af en indsendt konfiguration før gem. */
export function validatePricingConfig(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== "object") {
    return "Konfigurationen skal være et JSON-objekt.";
  }
  const c = candidate as Partial<PricingConfig>;
  if (c.luminaireProducts !== undefined) {
    if (typeof c.luminaireProducts !== "object") {
      return "luminaireProducts skal være et objekt (område → produktliste).";
    }
    for (const [area, list] of Object.entries(c.luminaireProducts)) {
      if (!Array.isArray(list)) {
        return `luminaireProducts.${area} skal være en liste.`;
      }
      for (const p of list) {
        if (!p?.id || !p?.name || typeof p.pricePerUnit !== "number") {
          return `Produkt i ${area} mangler id, name eller pricePerUnit (tal).`;
        }
      }
    }
  }
  if (
    c.installationPerLuminaire !== undefined &&
    typeof c.installationPerLuminaire !== "number"
  ) {
    return "installationPerLuminaire skal være et tal.";
  }
  if (c.controlSurcharge !== undefined && typeof c.controlSurcharge !== "object") {
    return "controlSurcharge skal være et objekt.";
  }
  return null;
}

/** Den aktive konfiguration som pænt formateret JSON (til redigering). */
export function activeConfigAsJson(): string {
  return JSON.stringify(pricingConfig, null, 2);
}
