// =============================================================================
// visualizationProvider
// -----------------------------------------------------------------------------
// AI-visualiseringen bag en pluggbar "provider"-grænseflade, så motoren kan
// skiftes uden at røre UI'et:
//
//   • MockProvider  – kører 100 % i browseren (ingen backend). Simulerer et
//                     "lys tændt"-billede oven på kundens rumfoto via canvas,
//                     så før/efter-flowet virker og kan demonstreres i dag.
//
//   • ProxyProvider – POST'er request + prompt til en lille server-funktion
//                     (VITE_VISUALIZATION_ENDPOINT), der holder API-nøglen til
//                     et rigtigt inpainting-billed-API skjult. Slås til med
//                     én env-variabel, når green light er klar til live-AI.
//
// buildVisualizationPrompt() laver den præcise prompt, der beder modellen om at
// BEVARE kundens rum og kun ændre belysningen – kernen i "fotorealistisk +
// samme rum (før/efter)".
// =============================================================================

import type {
  Fixture,
  LightingScenario,
  PlacementMode,
  PlacementPoint,
} from "./visualizationTypes";
import { loadImage, downscaleImage, stampBadge } from "./image";
import { getEndpoint } from "./visualizationConfig";
import { getAccessToken } from "./supabase";

export type RenderQuality = "low" | "medium" | "high";

export interface SelectedFixtureRef {
  fixture: Fixture;
  quantity: number;
}

export interface VizRenderInput {
  roomPhoto: string; // dataURL – kundens "før"-billede
  floorPlan?: string; // valgfri plantegning
  fixtures: SelectedFixtureRef[];
  placements: PlacementPoint[];
  placementMode: PlacementMode;
  roomType: string;
  scenario: LightingScenario;
  quality?: RenderQuality; // AI-kvalitet (styrer også prisen pr. billede)
}

export interface GeneratedRenderResult {
  imageData: string; // dataURL af "efter"-billedet
  provider: string;
  prompt: string;
}

export interface VisualizationProvider {
  id: string;
  label: string;
  description: string;
  available: boolean;
  generate(
    input: VizRenderInput & { prompt: string },
  ): Promise<GeneratedRenderResult>;
}

// ---------------------------------------------------------------------------
// Prompt-bygger
// ---------------------------------------------------------------------------

const SCENARIO_EN: Record<LightingScenario, string> = {
  "Dagslys, tændt": "daytime with the new luminaires switched on and some natural daylight",
  "Aften, tændt": "evening, exterior dark, the new luminaires are the main light source",
  "Nat, tændt": "night, fully dark outside, dramatic lighting from the new luminaires only",
  "Slukket (reference)": "luminaires switched off, existing/ambient light only (reference)",
};

const PLACEMENT_EN: Record<PlacementMode, string> = {
  ai: "Position the luminaires in a realistic, professional layout appropriate for this room type.",
  manual:
    "Place the luminaires exactly at the marked positions provided (normalized x/y coordinates).",
  floorplan:
    "Follow the supplied floor plan for the exact luminaire positions, count and spacing.",
};

export function buildVisualizationPrompt(input: VizRenderInput): string {
  const fixtureLines = input.fixtures.map((f) => {
    const s = f.fixture.specs;
    const cct = s.tunableWhite ? "tunable white" : `${s.kelvin}K`;
    return `- ${f.quantity}× ${f.fixture.name} (${f.fixture.category}, ${f.fixture.mounting}): ${s.lumen} lm, ${s.watt} W, ${cct}, CRI ${s.cri}, ${s.beamAngle}° beam${
      s.ip ? `, ${s.ip}` : ""
    } — ${f.fixture.lightCharacter ?? "professional lighting"}`;
  });

  const placementNote =
    input.placementMode === "manual" && input.placements.length
      ? `Marked positions (x%, y% of image): ${input.placements
          .map((p) => `(${Math.round(p.xPct)},${Math.round(p.yPct)})`)
          .join(", ")}.`
      : "";

  return [
    `Photorealistic architectural lighting visualization for a ${input.roomType.toLowerCase()}.`,
    `IMPORTANT: Keep the room EXACTLY as in the provided photo — same walls, furniture, layout, camera angle and perspective. Do NOT redesign the space. Only add/replace the ceiling and wall luminaires and render their realistic light effect.`,
    `REMOVE all existing luminaires AND every trace of their light (glow, hotspots, ceiling halos, reflections) before adding the new ones. New luminaires must sit perfectly straight, aligned with the ceiling's lines and evenly spaced.`,
    ``,
    `Luminaires to install:`,
    ...fixtureLines,
    ``,
    `Placement: ${PLACEMENT_EN[input.placementMode]} ${placementNote}`.trim(),
    `Scene: ${SCENARIO_EN[input.scenario]}.`,
    `Render physically plausible illumination: correct light pools on floor/walls, soft shadows, colour temperature matching the fixtures, no visible glare hotspots. Photorealistic, high detail, true-to-product luminaire shapes.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Farvetemperatur → RGB (tilnærmet, til lys-simulering)
// ---------------------------------------------------------------------------

function kelvinToRgb(kelvin: number): [number, number, number] {
  if (kelvin <= 3000) return [255, 197, 143];
  if (kelvin <= 3500) return [255, 216, 177];
  if (kelvin <= 4000) return [255, 233, 210];
  if (kelvin <= 4500) return [255, 244, 233];
  if (kelvin <= 5000) return [244, 246, 255];
  return [222, 234, 255];
}

function averageKelvin(fixtures: SelectedFixtureRef[]): number {
  let sum = 0;
  let qty = 0;
  for (const f of fixtures) {
    const k = f.fixture.specs.tunableWhite ? 4000 : f.fixture.specs.kelvin;
    sum += k * f.quantity;
    qty += f.quantity;
  }
  return qty > 0 ? sum / qty : 4000;
}

function totalQuantity(fixtures: SelectedFixtureRef[]): number {
  return fixtures.reduce((n, f) => n + f.quantity, 0);
}

// Automatisk placeringsgitter i loftzonen (øverste bånd af billedet).
function autoGrid(count: number, w: number, h: number): { x: number; y: number }[] {
  const n = Math.max(1, Math.min(count, 24));
  const cols = Math.ceil(Math.sqrt(n * (w / Math.max(h, 1)) * 1.4));
  const rows = Math.ceil(n / cols);
  const points: { x: number; y: number }[] = [];
  const yTop = h * 0.14;
  const yBottom = h * 0.46;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols && points.length < n; c++) {
      const x = w * ((c + 1) / (cols + 1));
      const y = rows === 1 ? (yTop + yBottom) / 2 : yTop + ((yBottom - yTop) * r) / (rows - 1);
      points.push({ x, y });
    }
  }
  return points;
}

// ---------------------------------------------------------------------------
// Mock-renderer (canvas) – "lys tændt" oven på kundens rumfoto
// ---------------------------------------------------------------------------

interface ScenarioTuning {
  dim: number; // hvor meget rummet mørklægges først (0..1)
  dimColor: string;
  glowAlpha: number; // intensitet af hvert armatur-glow
  fillAlpha: number; // generelt "udfyldnings"-lys
  showGlows: boolean;
}

function scenarioTuning(scenario: LightingScenario): ScenarioTuning {
  switch (scenario) {
    case "Dagslys, tændt":
      return { dim: 0.0, dimColor: "10,16,30", glowAlpha: 0.5, fillAlpha: 0.1, showGlows: true };
    case "Aften, tændt":
      return { dim: 0.34, dimColor: "8,12,28", glowAlpha: 0.85, fillAlpha: 0.12, showGlows: true };
    case "Nat, tændt":
      return { dim: 0.55, dimColor: "6,9,22", glowAlpha: 1.0, fillAlpha: 0.1, showGlows: true };
    case "Slukket (reference)":
      return { dim: 0.5, dimColor: "10,12,20", glowAlpha: 0, fillAlpha: 0, showGlows: false };
  }
}

export async function renderMockVisualization(
  input: VizRenderInput,
): Promise<string> {
  if (!input.roomPhoto) throw new Error("Der mangler et rumbillede at visualisere ud fra.");
  const img = await loadImage(input.roomPhoto);
  const w = img.naturalWidth || 1200;
  const h = img.naturalHeight || 800;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return input.roomPhoto;

  // 1) Kundens rum som grundlag.
  ctx.drawImage(img, 0, 0, w, h);

  const tune = scenarioTuning(input.scenario);
  const [r, g, b] = kelvinToRgb(averageKelvin(input.fixtures));

  // 2) Mørklæg let, så "lyset tændt" bliver tydeligt (aften/nat).
  if (tune.dim > 0) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = `rgba(${tune.dimColor},${tune.dim})`;
    ctx.fillRect(0, 0, w, h);
  }

  // 3) Blødt udfyldningslys i armaturets farvetone (kun når lyset er tændt).
  if (tune.fillAlpha > 0) {
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(${r},${g},${b},${tune.fillAlpha})`;
    ctx.fillRect(0, 0, w, h);
  }

  // 4) Armatur-glow + nedadrettet lyskegle ved hver placering.
  if (tune.showGlows) {
    const positions =
      input.placementMode === "manual" && input.placements.length
        ? input.placements.map((p) => ({ x: (p.xPct / 100) * w, y: (p.yPct / 100) * h }))
        : autoGrid(totalQuantity(input.fixtures) || 6, w, h);

    const unit = Math.hypot(w, h);
    const glowR = unit * 0.16;

    ctx.globalCompositeOperation = "lighter";
    for (const p of positions) {
      // Selve armaturet (lille, skarpt lyspunkt).
      const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR * 0.28);
      core.addColorStop(0, `rgba(255,255,255,${0.9 * tune.glowAlpha})`);
      core.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Blødt lysglow i armaturets tone.
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      glow.addColorStop(0, `rgba(${r},${g},${b},${0.55 * tune.glowAlpha})`);
      glow.addColorStop(0.5, `rgba(${r},${g},${b},${0.18 * tune.glowAlpha})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Nedadrettet lyskegle mod gulvet.
      const coneH = h - p.y;
      const cone = ctx.createLinearGradient(0, p.y, 0, p.y + coneH);
      cone.addColorStop(0, `rgba(${r},${g},${b},${0.22 * tune.glowAlpha})`);
      cone.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(p.x - glowR * 0.35, p.y);
      ctx.lineTo(p.x + glowR * 0.35, p.y);
      ctx.lineTo(p.x + glowR * 0.95, p.y + coneH);
      ctx.lineTo(p.x - glowR * 0.95, p.y + coneH);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 5) Nulstil og stempl som simulering (ærlig demo-mærkning).
  ctx.globalCompositeOperation = "source-over";
  const pad = Math.max(8, Math.round(Math.min(w, h) * 0.02));
  const fs = Math.max(12, Math.round(Math.min(w, h) * 0.022));
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  const label = "AI-SIMULERING · demo";
  const tw = ctx.measureText(label).width;
  const boxW = tw + pad * 1.4;
  const boxH = fs + pad;
  ctx.fillStyle = "rgba(15,26,10,0.55)";
  ctx.fillRect(w - boxW - pad, h - boxH - pad, boxW, boxH);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(label, w - boxW - pad + pad * 0.7, h - pad - pad * 0.5);

  return canvas.toDataURL("image/jpeg", 0.85);
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const mockProvider: VisualizationProvider = {
  id: "mock",
  label: "Demo-simulering (browser)",
  description:
    "Simulerer belysningen direkte i browseren – ingen backend. Perfekt til at afprøve flowet og vise før/efter. Ikke fotometrisk eksakt.",
  available: true,
  async generate(input) {
    const imageData = await renderMockVisualization(input);
    return { imageData, provider: this.id, prompt: input.prompt };
  },
};

export const proxyProvider: VisualizationProvider = {
  id: "proxy",
  label: "Live AI (fotorealistisk · via proxy)",
  description:
    "Sender rumbillede + prompt til green lights server-funktion (fx OpenAI gpt-image-1), der redigerer fotoet og bevarer rummet. Konfigureres i “Live AI-opsætning” nedenfor.",
  // Dynamisk: tilgængelig når en proxy-URL er sat (localStorage eller build-env).
  get available() {
    return getEndpoint().length > 0;
  },
  async generate(input) {
    const endpoint = getEndpoint();
    if (!endpoint) throw new Error("Live-AI er ikke konfigureret. Indsæt proxy-URL under “Live AI-opsætning”.");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: input.prompt,
          roomPhoto: input.roomPhoto,
          quality: input.quality ?? "high",
          // AI-lysdesigner: serveren lader en vision-model se rummet og
          // skrive den optimale prompt (som ChatGPT gør internt).
          autoPrompt: true,
          // Produktreferencer: uploadede produktbilleder (dataURLs) sendes
          // med, så det GENKENDELIGE armatur rendres. Eksterne URL'er kan
          // ikke sendes (CORS) og springes over.
          fixtureImages: [
            ...new Set(
              input.fixtures
                .map((f) => f.fixture.productImage || "")
                .filter((u) => u.startsWith("data:image/")),
            ),
          ].slice(0, 3),
          floorPlan: input.floorPlan,
          placementMode: input.placementMode,
          placements: input.placements,
          scenario: input.scenario,
          roomType: input.roomType,
          fixtures: input.fixtures.map((f) => ({
            name: f.fixture.name,
            category: f.fixture.category,
            quantity: f.quantity,
            specs: f.fixture.specs,
          })),
        }),
      });
    } catch (e) {
      throw new Error(`Kunne ikke nå proxyen. Tjek URL'en. (${e instanceof Error ? e.message : "netværksfejl"})`);
    }
    if (!res.ok) {
      let msg = `Live-AI svarede ${res.status}.`;
      try {
        const err = (await res.json()) as { error?: string };
        if (err?.error) msg += ` ${err.error}`;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const data = (await res.json()) as { imageData?: string; image?: string; prompt?: string };
    const raw = data.imageData ?? data.image;
    if (!raw) throw new Error("Live-AI returnerede intet billede.");
    // Komprimér skånsomt (2048 px, høj JPEG-kvalitet) og AI-mærk billedet
    // (kundevendte AI-billeder skal kunne kendes som AI-genererede).
    const compact = await downscaleImage(raw, 2048, 0.9, "image/jpeg").catch(() => raw);
    const imageData = await stampBadge(compact, "AI-visualisering").catch(() => compact);
    // Gem den prompt serveren FAKTISK brugte (AI-lysdesignerens version).
    return { imageData, provider: this.id, prompt: data.prompt ?? input.prompt };
  },
};

export function availableProviders(): VisualizationProvider[] {
  return [proxyProvider, mockProvider].filter((p) => p.available);
}

export function defaultProvider(): VisualizationProvider {
  return proxyProvider.available ? proxyProvider : mockProvider;
}

export const VISUALIZATION_DISCLAIMER =
  "AI-genereret visualisering til inspiration – ikke en garanteret, fotometrisk gengivelse. Faktisk lysvirkning, produktudseende og armaturplacering kan afvige fra det viste.";
