// =============================================================================
// vizData
// -----------------------------------------------------------------------------
// Fælles datalag for visualiseringsuniverset med to bagender:
//
//   • DELT (Supabase)  – når brugeren er logget ind: katalog og visualiseringer
//     læses/skrives i tabellerne viz_fixtures/viz_visualizations, så hele
//     teamet ser det samme, og intet går tabt ved ryddet browser/nyt device.
//     Ved FØRSTE brug (tom tabel) migreres eksisterende lokale data automatisk
//     op, så ingen mister noget ved skiftet.
//
//   • LOKAL (localStorage) – uden login (fx testbuilds med VITE_SUPABASE_URL=off)
//     bruges det hidtidige lokale repository uændret.
//
// Skriv-semantik i delt tilstand: sidste-skriver-vinder pr. ELEMENT (upsert på
// id) – langt mere robust end localStorage-modellens hele-listen-overskrives.
// Tabellerne oprettes med supabase/schema.sql (se README).
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { vizStorage } from "./visualizationStorage";
import { seedFixtures } from "./fixtureSeed";
import type { Fixture, Visualization } from "./visualizationTypes";

const FIXTURES_TABLE = "viz_fixtures";
const VIZ_TABLE = "viz_visualizations";

export type DataMode = "shared" | "local";

function friendly(error: { code?: string; message?: string }): Error {
  if (error?.code === "42P01") {
    return new Error(
      "Databasen mangler tabellerne. Kør supabase/schema.sql i Supabase → SQL Editor (se README), og prøv igen.",
    );
  }
  if (error?.code === "42501" || /row-level security/i.test(error?.message ?? "")) {
    return new Error(
      "Databasen afviste adgangen (Row Level Security). Kør supabase/schema.sql igen, så adgangspolitikkerne oprettes.",
    );
  }
  return new Error(error?.message || "Databasefejl. Prøv igen.");
}

export function createVizData(client: SupabaseClient | null) {
  async function sharedActive(): Promise<boolean> {
    if (!client) return false;
    const { data } = await client.auth.getSession();
    return Boolean(data.session);
  }

  async function upsertFixtures(fixtures: Fixture[]): Promise<void> {
    if (!fixtures.length) return;
    const rows = fixtures.map((f) => ({ id: f.id, data: f }));
    const { error } = await client!.from(FIXTURES_TABLE).upsert(rows);
    if (error) throw friendly(error);
  }

  async function fetchFixtures(): Promise<Fixture[]> {
    const { data, error } = await client!
      .from(FIXTURES_TABLE)
      .select("id,data")
      .order("updated_at", { ascending: false });
    if (error) throw friendly(error);
    return (data ?? []).map((r) => r.data as Fixture);
  }

  async function fetchVisualizations(): Promise<Visualization[]> {
    const { data, error } = await client!
      .from(VIZ_TABLE)
      .select("id,data")
      .order("updated_at", { ascending: false });
    if (error) throw friendly(error);
    return (data ?? []).map((r) => r.data as Visualization);
  }

  return {
    async mode(): Promise<DataMode> {
      return (await sharedActive()) ? "shared" : "local";
    },

    // --- Armaturer ---------------------------------------------------------
    async listFixtures(): Promise<Fixture[]> {
      if (!(await sharedActive())) return vizStorage.listFixtures();
      let rows = await fetchFixtures();
      if (rows.length === 0) {
        // Første brug: migrér lokale armaturer (inkl. seed) op, så teamet
        // starter med det katalog, der allerede findes.
        const local = vizStorage.listFixtures();
        if (local.length) {
          await upsertFixtures(local);
          rows = local;
        }
      }
      return rows;
    },

    async saveFixture(fx: Fixture): Promise<void> {
      fx.updatedAt = new Date().toISOString();
      if (!(await sharedActive())) {
        vizStorage.saveFixture(fx);
        return;
      }
      await upsertFixtures([fx]);
    },

    async deleteFixture(id: string): Promise<void> {
      if (!(await sharedActive())) {
        vizStorage.deleteFixture(id);
        return;
      }
      const { error } = await client!.from(FIXTURES_TABLE).delete().eq("id", id);
      if (error) throw friendly(error);
    },

    // Bulk-import med samme dublet-værn som lokalt (SKU, ellers navn).
    async addFixtures(fixtures: Fixture[]): Promise<{ added: number; skipped: number }> {
      if (!(await sharedActive())) return vizStorage.addFixtures(fixtures);
      const existing = await fetchFixtures();
      const keyOf = (f: Fixture) =>
        f.sku?.trim() ? `sku:${f.sku.trim().toLowerCase()}` : `name:${f.name.trim().toLowerCase()}`;
      const seen = new Set(existing.map(keyOf));
      const fresh: Fixture[] = [];
      let skipped = 0;
      for (const f of fixtures) {
        const k = keyOf(f);
        if (seen.has(k)) {
          skipped++;
          continue;
        }
        seen.add(k);
        fresh.push(f);
      }
      await upsertFixtures(fresh);
      return { added: fresh.length, skipped };
    },

    async resetFixtures(): Promise<Fixture[]> {
      if (!(await sharedActive())) return vizStorage.resetFixtures();
      const { error } = await client!.from(FIXTURES_TABLE).delete().neq("id", "");
      if (error) throw friendly(error);
      const seeded = seedFixtures();
      await upsertFixtures(seeded);
      return seeded;
    },

    // --- Visualiseringer ---------------------------------------------------
    async listVisualizations(): Promise<Visualization[]> {
      if (!(await sharedActive())) return vizStorage.listVisualizations();
      let rows = await fetchVisualizations();
      if (rows.length === 0) {
        const local = vizStorage.listVisualizations();
        if (local.length) {
          const { error } = await client!
            .from(VIZ_TABLE)
            .upsert(local.map((v) => ({ id: v.id, data: v })));
          if (error) throw friendly(error);
          rows = local;
        }
      }
      return rows;
    },

    async getVisualization(id: string): Promise<Visualization | undefined> {
      if (!(await sharedActive())) return vizStorage.getVisualization(id);
      const { data, error } = await client!
        .from(VIZ_TABLE)
        .select("id,data")
        .eq("id", id)
        .maybeSingle();
      if (error) throw friendly(error);
      return (data?.data as Visualization) ?? undefined;
    },

    async saveVisualization(viz: Visualization): Promise<void> {
      viz.updatedAt = new Date().toISOString();
      if (!(await sharedActive())) {
        vizStorage.saveVisualization(viz);
        return;
      }
      const { error } = await client!.from(VIZ_TABLE).upsert([{ id: viz.id, data: viz }]);
      if (error) throw friendly(error);
    },

    async deleteVisualization(id: string): Promise<void> {
      if (!(await sharedActive())) {
        vizStorage.deleteVisualization(id);
        return;
      }
      const { error } = await client!.from(VIZ_TABLE).delete().eq("id", id);
      if (error) throw friendly(error);
    },
  };
}

export const vizData = createVizData(supabase);
