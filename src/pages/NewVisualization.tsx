import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "../components/Stepper";
import { Field } from "../components/Field";
import { ImageDropzone } from "../components/ImageDropzone";
import { PlacementEditor } from "../components/PlacementEditor";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { newVizId, StorageQuotaError, hasStorageRoom } from "../lib/visualizationStorage";
import { vizData, type DataMode } from "../lib/vizData";
import { storage } from "../lib/storage";
import { num } from "../lib/format";
import type {
  Fixture,
  LightingScenario,
  PlacementMode,
  PlacementPoint,
  Visualization,
  VisualizationRoomType,
} from "../lib/visualizationTypes";
import {
  availableProviders,
  buildVisualizationPrompt,
  defaultProvider,
  VISUALIZATION_DISCLAIMER,
  type RenderQuality,
  type SelectedFixtureRef,
  type VizRenderInput,
} from "../lib/visualizationProvider";
import { getEndpoint, setEndpoint } from "../lib/visualizationConfig";

const STEPS = [
  { id: 1, label: "Projekt" },
  { id: 2, label: "Rum" },
  { id: 3, label: "Armaturer" },
  { id: 4, label: "Placering" },
  { id: 5, label: "Generér" },
  { id: 6, label: "Resultat" },
];

const ROOM_TYPES: VisualizationRoomType[] = [
  "Reception",
  "Administration / kontor",
  "Kontorlandskab",
  "Mødelokale",
  "Gang / fællesareal",
  "Kantine",
  "Lager",
  "Produktion",
  "Højlager",
  "Andet",
];

const SCENARIOS: LightingScenario[] = [
  "Dagslys, tændt",
  "Aften, tændt",
  "Nat, tændt",
  "Slukket (reference)",
];

const iso = () => new Date().toISOString();

// Kladde-autosave: wizard-tilstanden gemmes løbende, så et reload/lukket vindue
// aldrig smider indtastninger eller allerede-betalte AI-renders væk.
const DRAFT_KEY = "gl.viz.draft.v1";

interface WizardDraft {
  viz: Visualization;
  step: number;
  quality: RenderQuality;
}

function freshViz(): Visualization {
  return {
    id: newVizId("viz"),
    createdAt: iso(),
    updatedAt: iso(),
    customerName: "",
    projectName: "",
    roomType: "Reception",
    selectedFixtures: [],
    placements: [],
    placementMode: "ai",
    scenario: "Dagslys, tændt",
    renders: [],
    status: "Kladde",
  };
}

function readDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as WizardDraft;
    if (!d?.viz?.id) return null;
    // En helt urørt kladde er ikke værd at gendanne.
    const touched = d.viz.customerName || d.viz.projectName || d.viz.roomPhoto || d.viz.renders.length;
    return touched ? d : null;
  } catch {
    return null;
  }
}

export function NewVisualization() {
  const navigate = useNavigate();
  const [library, setLibrary] = useState<Fixture[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("local");
  const estimates = useMemo(() => storage.listEstimates(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, lib] = await Promise.all([vizData.mode(), vizData.listFixtures()]);
        if (!alive) return;
        setDataMode(m);
        setLibrary(lib);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Kunne ikke hente kataloget.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  // Genberegnes når live-AI-opsætningen ændres (cfgTick).
  const [cfgTick, setCfgTick] = useState(0);
  const providers = useMemo(() => availableProviders(), [cfgTick]);

  const draft = useMemo(readDraft, []);
  const [step, setStep] = useState(() => draft?.step ?? 1);
  const [viz, setViz] = useState<Visualization>(() => draft?.viz ?? freshViz());
  const [quality, setQuality] = useState<RenderQuality>(() => draft?.quality ?? "high");
  const [draftRestored, setDraftRestored] = useState(() => draft !== null);
  const [providerId, setProviderId] = useState(() => defaultProvider().id);
  const [showPrompt, setShowPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpointInput, setEndpointInput] = useState(() => getEndpoint());
  const [showAiSetup, setShowAiSetup] = useState(false);

  // Autosave (best effort – kvotefejl må aldrig vælte selve wizarden).
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ viz, step, quality } satisfies WizardDraft));
    } catch {
      /* lager fuldt – kladden må vige */
    }
  }, [viz, step, quality]);

  const discardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setViz(freshViz());
    setStep(1);
    setQuality("medium");
    setDraftRestored(false);
    setError(null);
  };

  const saveEndpoint = () => {
    setEndpoint(endpointInput);
    setCfgTick((t) => t + 1);
    setProviderId(endpointInput.trim() ? "proxy" : "mock");
  };
  const clearEndpoint = () => {
    setEndpoint("");
    setEndpointInput("");
    setCfgTick((t) => t + 1);
    setProviderId("mock");
  };

  const set = (patch: Partial<Visualization>) => setViz((v) => ({ ...v, ...patch }));

  const fixtureRefs: SelectedFixtureRef[] = useMemo(
    () =>
      viz.selectedFixtures
        .map((sf) => {
          const fixture = library.find((f) => f.id === sf.fixtureId);
          return fixture ? { fixture, quantity: sf.quantity } : null;
        })
        .filter((x): x is SelectedFixtureRef => x !== null),
    [viz.selectedFixtures, library],
  );

  const renderInput: VizRenderInput = {
    roomPhoto: viz.roomPhoto ?? "",
    floorPlan: viz.floorPlan,
    fixtures: fixtureRefs,
    placements: viz.placements,
    placementMode: viz.placementMode,
    roomType: viz.roomType,
    scenario: viz.scenario,
    quality,
  };
  const prompt = buildVisualizationPrompt(renderInput);

  const setQty = (fixtureId: string, qty: number) => {
    setViz((v) => {
      const others = v.selectedFixtures.filter((s) => s.fixtureId !== fixtureId);
      return qty > 0
        ? { ...v, selectedFixtures: [...others, { fixtureId, quantity: qty }] }
        : { ...v, selectedFixtures: others };
    });
  };
  const qtyOf = (fixtureId: string) =>
    viz.selectedFixtures.find((s) => s.fixtureId === fixtureId)?.quantity ?? 0;

  const latestRender = viz.renders[viz.renders.length - 1];

  // Validering pr. trin
  const canNext = (() => {
    if (step === 1) return viz.customerName.trim() !== "" && viz.projectName.trim() !== "";
    if (step === 2) return !!viz.roomPhoto;
    if (step === 3) return viz.selectedFixtures.length > 0;
    return true;
  })();

  const generate = async () => {
    setError(null);
    if (!viz.roomPhoto) {
      setError("Upload et rumbillede først (trin Rum).");
      return;
    }
    if (fixtureRefs.length === 0) {
      setError("Vælg mindst ét armatur først (trin Armaturer).");
      return;
    }
    // Kvote-tjek FØR den betalte generering (kun relevant når der gemmes
    // lokalt – i delt tilstand gemmes i databasen uden browserkvote).
    if (dataMode === "local" && !hasStorageRoom()) {
      setError(
        "Browserens lager er næsten fuldt – et nyt billede ville ikke kunne gemmes. Slet en eller flere gamle visualiseringer (under Visualiseringer), og prøv igen.",
      );
      return;
    }
    const provider = providers.find((p) => p.id === providerId) ?? defaultProvider();
    setGenerating(true);
    try {
      const result = await provider.generate({ ...renderInput, prompt });
      const render = {
        id: newVizId("rnd"),
        createdAt: iso(),
        imageData: result.imageData,
        prompt: result.prompt,
        provider: result.provider,
        scenario: viz.scenario,
      };
      setViz((v) => ({ ...v, renders: [...v.renders, render], status: "Genereret" }));
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Genereringen fejlede. Prøv igen.");
    } finally {
      setGenerating(false);
    }
  };

  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await vizData.saveVisualization({ ...viz, updatedAt: iso() });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      navigate(`/visualisering/${viz.id}`);
    } catch (e) {
      setError(
        e instanceof StorageQuotaError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Kunne ikke gemme.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {draftRestored && (
        <div className="mb-4 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm text-brand-800 flex-1">
            Din kladde fra sidst er gendannet{viz.renders.length > 0 ? " – inklusive genererede billeder" : ""}.
          </span>
          <div className="flex gap-2 shrink-0">
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setDraftRestored(false)}>Fortsæt kladden</button>
            <button className="btn-outline px-3 py-1.5 text-xs" onClick={discardDraft}>Kassér & start forfra</button>
          </div>
        </div>
      )}
      <Stepper current={step} steps={STEPS} />

      <div className="card p-5 md:p-7">
        {/* --- Trin 1: Projekt --- */}
        {step === 1 && (
          <div className="space-y-5">
            <StepHead title="Projekt & lokale" desc="Hvem er kunden, og hvilken slags rum visualiserer vi?" />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Kunde" required>
                <input className="input" value={viz.customerName} onChange={(e) => set({ customerName: e.target.value })} placeholder="fx Nordvirk A/S" />
              </Field>
              <Field label="Projekt / lokale" required>
                <input className="input" value={viz.projectName} onChange={(e) => set({ projectName: e.target.value })} placeholder="fx Reception, Hovedkontor" />
              </Field>
              <Field label="Rumtype">
                <select className="select" value={viz.roomType} onChange={(e) => set({ roomType: e.target.value as VisualizationRoomType })}>
                  {ROOM_TYPES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Kobl til estimat" hint="Valgfrit – knyt visualiseringen til et eksisterende estimat.">
                <select className="select" value={viz.estimateId ?? ""} onChange={(e) => set({ estimateId: e.target.value || undefined })}>
                  <option value="">Ingen</option>
                  {estimates.map((es) => (
                    <option key={es.id} value={es.id}>{es.projectName} · {es.customerName}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* --- Trin 2: Rum --- */}
        {step === 2 && (
          <div className="space-y-5">
            <StepHead title="Kundens lokale" desc="Upload et billede af rummet. Visualiseringen bevarer rummet – vi ændrer kun belysningen." />
            <ImageDropzone
              label="Rumbillede (før)"
              value={viz.roomPhoto}
              onChange={(url) => set({ roomPhoto: url })}
              hint="Tag et billede i god opløsning, hvor loftet er synligt."
              maxDim={2000}
              quality={0.88}
            />
            <ImageDropzone
              label="Plantegning (valgfrit)"
              value={viz.floorPlan}
              onChange={(url) =>
                set({
                  floorPlan: url,
                  placementMode: url ? "floorplan" : viz.placementMode === "floorplan" ? "ai" : viz.placementMode,
                })
              }
              hint="Uploader du en plantegning med armaturplacering, styrer den placeringen i visualiseringen."
              maxDim={1600}
            />
          </div>
        )}

        {/* --- Trin 3: Armaturer --- */}
        {step === 3 && (
          <div className="space-y-4">
            <StepHead title="Vælg armaturer" desc="Vælg fra universet, og sæt antal. De indgår i visualiseringen og i prompten til AI'en." />
            <div className="grid sm:grid-cols-2 gap-3">
              {library.map((f) => (
                <FixturePick key={f.id} fx={f} qty={qtyOf(f.id)} onQty={(q) => setQty(f.id, q)} />
              ))}
            </div>
          </div>
        )}

        {/* --- Trin 4: Placering --- */}
        {step === 4 && (
          <div className="space-y-4">
            <StepHead title="Placering" desc="Standard: 1:1-udskiftning — AI sætter et nyt armatur på hver eksisterende plads i billedet. Har du en plantegning, styrer den. Eller markér selv punkter." />
            <PlacementModePicker
              mode={viz.placementMode}
              hasFloorPlan={!!viz.floorPlan}
              onMode={(m) => set({ placementMode: m })}
            />

            {viz.placementMode === "floorplan" && viz.floorPlan && (
              <div className="space-y-2">
                <div className="text-sm text-ink-soft">Placeringen følger denne plantegning:</div>
                <img src={viz.floorPlan} alt="Plantegning" className="rounded-2xl border border-surface-line max-h-[420px] mx-auto" />
              </div>
            )}

            {viz.placementMode === "manual" && viz.roomPhoto && (
              <div className="space-y-2">
                <PlacementEditor photo={viz.roomPhoto} placements={viz.placements} onChange={(p) => set({ placements: p })} />
                <div className="flex items-center justify-between text-[12px] text-ink-mute">
                  <span>{num.format(viz.placements.length)} punkter sat</span>
                  {viz.placements.length > 0 && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => set({ placements: [] })}>Ryd alle</button>
                  )}
                </div>
              </div>
            )}

            {viz.placementMode === "ai" && viz.roomPhoto && (
              <div className="relative">
                <img src={viz.roomPhoto} alt="Rum" className="rounded-2xl border border-surface-line w-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="chip bg-white/85 text-ink-soft">AI udskifter de eksisterende armaturer 1:1</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Trin 5: Generér --- */}
        {step === 5 && (
          <div className="space-y-5">
            <StepHead title="Generér visualisering" desc="Vælg lysscenarie, motor og kvalitet, og lav visualiseringen." />
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Lysscenarie">
                <select className="select" value={viz.scenario} onChange={(e) => set({ scenario: e.target.value as LightingScenario })}>
                  {SCENARIOS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Motor">
                <select className="select" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Kvalitet" hint="Styrer også prisen pr. AI-billede.">
                <select className="select" value={quality} onChange={(e) => setQuality(e.target.value as RenderQuality)}>
                  <option value="high">Høj (anbefalet til kundemøder)</option>
                  <option value="medium">Standard (billigere)</option>
                  <option value="low">Udkast (hurtig & billig)</option>
                </select>
              </Field>
            </div>

            <div className="rounded-xl bg-surface-soft border border-surface-line p-4 text-[13px] text-ink-soft">
              {providers.find((p) => p.id === providerId)?.description}
            </div>

            {/* Live AI-opsætning */}
            <div className="rounded-xl border border-surface-line">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-ink-soft"
                onClick={() => setShowAiSetup((s) => !s)}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getEndpoint() ? "bg-brand-500" : "bg-surface-line"}`} />
                  Live AI-opsætning {getEndpoint() ? "· aktiv" : "· ikke koblet på (bruger demo)"}
                </span>
                <span className="text-ink-mute">{showAiSetup ? "▲" : "▼"}</span>
              </button>
              {showAiSetup && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-line pt-3">
                  <p className="text-[12px] text-ink-mute">
                    Indsæt adressen på jeres proxy-funktion (fx <span className="font-mono">https://…vercel.app/api/visualize</span>).
                    Den kalder OpenAI og holder API-nøglen skjult. Se README for opsætning.
                  </p>
                  <input
                    className="input font-mono text-[12px]"
                    placeholder="https://green-light-viz.vercel.app/api/visualize"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={saveEndpoint} disabled={!endpointInput.trim()}>Gem & slå til</button>
                    {getEndpoint() && <button className="btn-ghost text-ink-mute" onClick={clearEndpoint}>Fjern</button>}
                  </div>
                </div>
              )}
            </div>

            <div>
              <button className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setShowPrompt((s) => !s)}>
                {showPrompt ? "Skjul" : "Vis"} AI-brief ({num.format(prompt.length)} tegn)
              </button>
              <span className="block text-[11px] text-ink-mute mt-1">
                Briefen forfines automatisk af en AI-lysdesigner, der ser selve rumbilledet, før billedet genereres.
              </span>
              {showPrompt && (
                <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-soft bg-ink/5 rounded-xl p-4 max-h-64 overflow-auto">{prompt}</pre>
              )}
            </div>

            {error && <ErrorBox msg={error} />}

            <button className="btn-primary w-full py-3 disabled:opacity-50" onClick={generate} disabled={generating}>
              {generating ? "Genererer… (høj kvalitet tager typisk 1–2 minutter)" : viz.renders.length ? "Generér igen" : "Generér visualisering"}
            </button>
            {generating && (
              <div className="flex items-center gap-3 rounded-xl bg-surface-soft border border-surface-line px-4 py-3">
                <span className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin shrink-0" />
                <span className="text-[13px] text-ink-soft">AI'en arbejder på billedet – lad siden være åben imens.</span>
              </div>
            )}

            {latestRender && (
              <div className="pt-2">
                <div className="label mb-1.5">Seneste resultat</div>
                <img src={latestRender.imageData} alt="Visualisering" className="rounded-2xl border border-surface-line w-full" />
              </div>
            )}
          </div>
        )}

        {/* --- Trin 6: Resultat --- */}
        {step === 6 && (
          <div className="space-y-5">
            <StepHead title="Før / efter" desc="Træk i håndtaget for at vise kunden forskellen." />
            {viz.roomPhoto && latestRender ? (
              <BeforeAfterSlider before={viz.roomPhoto} after={latestRender.imageData} />
            ) : (
              <div className="card p-8 text-center text-ink-mute">Der er ingen visualisering endnu. Gå tilbage til trin Generér.</div>
            )}

            <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-[12px] text-brand-800">{VISUALIZATION_DISCLAIMER}</div>

            <Field label="Note (valgfrit)">
              <textarea className="textarea" rows={2} value={viz.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="fx forbehold, ønsker fra kunden, næste skridt" />
            </Field>

            {error && <ErrorBox msg={error} />}

            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn-outline flex-1" onClick={() => setStep(5)}>← Justér & generér igen</button>
              {latestRender && (
                <a
                  href={latestRender.imageData}
                  download={`${viz.customerName || "visualisering"}-${viz.projectName || viz.id}.jpg`}
                  className="btn-outline flex-1 justify-center"
                >
                  Download billede
                </a>
              )}
              <button className="btn-primary flex-1 py-3" onClick={save} disabled={!latestRender || saving}>
                {saving ? "Gemmer…" : "Gem visualisering"}
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step < 6 && (
          <div className="flex items-center justify-between mt-7 pt-5 border-t border-surface-line">
            <button className="btn-ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>← Tilbage</button>
            {step < 5 ? (
              <button className="btn-primary disabled:opacity-40" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Videre →</button>
            ) : (
              <button className="btn-outline" onClick={() => setStep(6)} disabled={!latestRender}>Se før/efter →</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="text-sm text-ink-soft mt-1">{desc}</p>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{msg}</div>;
}

function FixturePick({ fx, qty, onQty }: { fx: Fixture; qty: number; onQty: (q: number) => void }) {
  const active = qty > 0;
  return (
    <div className={`rounded-2xl border p-3 flex gap-3 items-center transition-colors ${active ? "border-brand-400 bg-brand-50" : "border-surface-line bg-white"}`}>
      <div className="w-16 h-16 rounded-xl bg-surface-soft border border-surface-line shrink-0 flex items-center justify-center overflow-hidden">
        {fx.productImage ? <img src={fx.productImage} alt={fx.name} className="w-full h-full object-contain p-1" /> : <span className="text-[10px] text-ink-mute">—</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink text-sm truncate">{fx.name}</div>
        <div className="text-[11px] text-ink-mute">{num.format(fx.specs.lumen)} lm · {fx.specs.watt} W · {fx.specs.tunableWhite ? "Tunable" : `${fx.specs.kelvin}K`}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button className="w-7 h-7 rounded-lg border border-surface-line text-ink-soft hover:border-brand-400 disabled:opacity-30" onClick={() => onQty(Math.max(0, qty - 1))} disabled={qty === 0} aria-label="Færre">−</button>
        <input
          className="w-12 text-center input px-1 py-1"
          type="number"
          min={0}
          value={qty}
          onChange={(e) => onQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        />
        <button className="w-7 h-7 rounded-lg border border-surface-line text-ink-soft hover:border-brand-400" onClick={() => onQty(qty + 1)} aria-label="Flere">+</button>
      </div>
    </div>
  );
}

function PlacementModePicker({
  mode,
  hasFloorPlan,
  onMode,
}: {
  mode: PlacementMode;
  hasFloorPlan: boolean;
  onMode: (m: PlacementMode) => void;
}) {
  const opts: { id: PlacementMode; label: string; desc: string; disabled?: boolean }[] = [
    { id: "ai", label: "1:1-udskiftning (standard)", desc: "Nyt armatur på hver eksisterende plads i billedet" },
    { id: "manual", label: "Markér selv", desc: "Klik hvor armaturerne skal sidde" },
    { id: "floorplan", label: "Fra plantegning", desc: hasFloorPlan ? "Følger din uploadede plantegning" : "Upload en plantegning i trin Rum", disabled: !hasFloorPlan },
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-2">
      {opts.map((o) => (
        <button
          key={o.id}
          disabled={o.disabled}
          onClick={() => onMode(o.id)}
          className={`text-left rounded-2xl border p-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
            ${mode === o.id ? "border-brand-400 bg-brand-50" : "border-surface-line bg-white hover:border-brand-300"}`}
        >
          <div className="font-semibold text-ink text-sm">{o.label}</div>
          <div className="text-[11px] text-ink-mute mt-0.5">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}
