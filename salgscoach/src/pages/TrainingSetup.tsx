// =============================================================================
// pages/TrainingSetup · Broen mellem valget og samtalen
// -----------------------------------------------------------------------------
// Siden har én vigtig knap: "Start øvelsen". Alt andet — coachtilstand,
// scenarie, forhåndsviden — er valgfrit og kan springes helt over. Det er et
// bevidst valg: værktøjet skal presse sælgeren ud i at TALE, ikke ud i at
// udfylde en formular.
//
// Sværhedsgraden kan skrues op, aldrig ned til noget behageligt: standarden er
// hård, og det står der.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { getProfile, listSessions, saveSession } from "../lib/store";
import { newId } from "../lib/ids";
import { config as appConfig } from "../config";
import { formatMinuteRange, truncate } from "../lib/format";
import { Icon, type IconName } from "../ui/icons";
import { ChipGroup, ErrorNote, Field, Notice } from "../ui/primitives";
import type {
  CoachMode,
  CoachModeSpec,
  Difficulty,
  Scenario,
  ScenarioConfig,
  SellerProfile,
  TrainingMode,
  TrainingModeId,
  TrainingSession,
} from "../lib/types";

type Manifest = Awaited<ReturnType<typeof api.getManifest>>;

/**
 * Sidens tilstande. Formularen vises i klar/bygger/gemmer/startfejl — de tre
 * sidste låser knapperne, men fjerner aldrig det man har skrevet.
 */
type Fase =
  | { kind: "henter" }
  | { kind: "manifestfejl"; besked: string }
  | { kind: "ukendt" }
  | { kind: "klar" }
  | { kind: "bygger" }
  | { kind: "gemmer" }
  | { kind: "startfejl"; besked: string; kanStarteUden: boolean };

/* ------------------------------------------------------------------ Ikoner */

const IKON_PR_OEVELSE: Partial<Record<TrainingModeId, IconName>> = {
  kunderollespil: "Users",
  afdaekning: "Search",
  indvendinger: "Shield",
  salgsmoede: "Handshake",
  telefon: "Phone",
  kvalificering: "Target",
  "naeste-skridt": "Arrow",
  forhandling: "Handshake",
  forberedelse: "Book",
  debriefing: "History",
  tilbudsopfoelgning: "Doc",
  lynild: "Lightning",
  manualeksamen: "Book",
  "fri-coaching": "Spark",
  materialepraesentation: "Doc",
};

const IKON_NAVNE = Object.keys(Icon) as IconName[];

function ikonFor(navn: string | undefined, modeId?: string) {
  const raw = String(navn ?? "").trim().toLowerCase();
  const direkte = IKON_NAVNE.find((k) => k.toLowerCase() === raw);
  if (direkte) return Icon[direkte];
  const efterOevelse = modeId ? IKON_PR_OEVELSE[modeId as TrainingModeId] : undefined;
  return Icon[efterOevelse ?? "Mic"];
}

/* ------------------------------------------------------- Coachtilstandene */

/** Bruges kun hvis manifestet ikke selv beskriver tilstandene. */
const COACH_FALLBACK: CoachModeSpec[] = [
  {
    id: "realistisk",
    title: "Realistisk",
    short: "Kunden spiller sig selv. Ingen hjælp undervejs — al feedback til sidst.",
    description: "Kunden spiller sig selv. Ingen hjælp undervejs — al feedback til sidst.",
    instruction: "",
  },
  {
    id: "coach",
    title: "Coach",
    short: "Salgsdirektøren stopper dig undervejs og retter kursen med det samme.",
    description: "Salgsdirektøren stopper dig undervejs og retter kursen med det samme.",
    instruction: "",
  },
  {
    id: "hybrid",
    title: "Hybrid",
    short: "Rollespil med korte indgreb, når du er på vej galt afsted. Resten til debriefingen.",
    description: "Rollespil med korte indgreb, når du er på vej galt afsted.",
    instruction: "",
  },
];

/* ------------------------------------------------------- Scenarievalgene */

const SVAERHED: { id: Difficulty; label: string; note: string }[] = [
  {
    id: "moderat",
    label: "Moderat",
    note: "Kunden vil gerne tale med dig, men giver ikke noget væk uopfordret.",
  },
  {
    id: "haard",
    label: "Hård",
    note: "Kunden har travlt, er skeptisk og presser på pris. Standard.",
  },
  {
    id: "braendende",
    label: "Brændende",
    note: "Tidspres, en konkurrent er allerede inde, og historikken er dårlig.",
  },
];

const FALLBACK = {
  brancher: [
    "Produktion",
    "Lager og logistik",
    "Fødevareindustri",
    "Detailkæde",
    "Kontor og administration",
    "Sundhed og pleje",
    "Uddannelse",
    "Kommune",
    "Ejendomsdrift",
    "Sportsanlæg",
  ],
  stoerrelser: [
    "Under 50 ansatte",
    "50-250 ansatte",
    "250-1.000 ansatte",
    "Over 1.000 ansatte",
    "Flere lokationer",
  ],
  roller: [
    "Facility Manager",
    "Teknisk chef",
    "Driftsleder",
    "Indkøbschef",
    "Økonomichef",
    "Adm. direktør",
    "Projektleder",
    "Elinstallatør",
  ],
  moedetyper: [
    "Første møde",
    "Opfølgende møde",
    "Teknisk gennemgang",
    "Præsentation for ledelsen",
    "Tilbudsgennemgang",
    "Forhandlingsmøde",
    "Telefonmøde",
  ],
  faser: [
    "Første kontakt",
    "Afdækning",
    "Løsningsforslag",
    "Tilbud afgivet",
    "Forhandling",
    "Eksisterende kunde",
  ],
  holdninger: [
    "Åben og nysgerrig",
    "Travl og kortfattet",
    "Skeptisk",
    "Prisfokuseret",
    "Tilfreds med nuværende leverandør",
    "Presset af ledelsen",
    "Afvisende",
  ],
  leverandoerer: [
    "Ingen fast leverandør",
    "Lokal elinstallatør",
    "Grossist",
    "Konkurrerende lysleverandør",
    "green light i forvejen",
  ],
  prisfoelsomhed: [
    "Pris er sekundær",
    "Balanceret",
    "Prisfokuseret",
    "Kun laveste pris tæller",
  ],
};

function unikke(vaerdier: (string | undefined)[], maks: number): string[] {
  const set = new Set<string>();
  const ud: string[] = [];
  for (const v of vaerdier) {
    const t = (v ?? "").trim();
    if (!t || set.has(t.toLowerCase())) continue;
    set.add(t.toLowerCase());
    ud.push(t);
    if (ud.length >= maks) break;
  }
  return ud;
}

function foerste(...lister: string[][]): string[] {
  for (const l of lister) if (l.length) return l;
  return [];
}

/* -------------------------------------------------------------- Småting */

function fejltekst(e: unknown): string {
  const besked = e instanceof Error ? e.message : String(e ?? "");
  return besked.trim() || "Ukendt fejl.";
}

/* =========================================================================== */

export function TrainingSetup() {
  const { modeId = "" } = useParams<{ modeId: string }>();
  const navigate = useNavigate();
  const { seller } = useAuth();

  const [fase, setFase] = useState<Fase>({ kind: "henter" });
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [profil, setProfil] = useState<SellerProfile | null>(null);
  const [sessioner, setSessioner] = useState<TrainingSession[]>([]);

  // Formular
  const [coachMode, setCoachMode] = useState<CoachMode | null>(null);
  const [intake, setIntake] = useState("");
  const [aabenTilpas, setAabenTilpas] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("haard");
  const [industry, setIndustry] = useState<string | undefined>();
  const [companySize, setCompanySize] = useState<string | undefined>();
  const [customerRole, setCustomerRole] = useState<string | undefined>();
  const [meetingType, setMeetingType] = useState<string | undefined>();
  const [salesStage, setSalesStage] = useState<string | undefined>();
  const [attitude, setAttitude] = useState<string | undefined>();
  const [existingSupplier, setExistingSupplier] = useState<string | undefined>();
  const [priceSensitivity, setPriceSensitivity] = useState<string | undefined>();
  const [knownInformation, setKnownInformation] = useState("");

  const levende = useRef(true);
  const igang = useRef(false);
  useEffect(() => {
    levende.current = true;
    return () => {
      levende.current = false;
    };
  }, []);

  /* ------------------------------------------------------------ Hentning */

  const hentManifest = useCallback(async () => {
    setFase({ kind: "henter" });
    try {
      const m = await api.getManifest();
      if (!levende.current) return;
      setManifest(m);
      const fundet = (m?.modes ?? []).find((x) => x.id === modeId);
      setFase(fundet ? { kind: "klar" } : { kind: "ukendt" });
    } catch (e) {
      if (!levende.current) return;
      setFase({ kind: "manifestfejl", besked: fejltekst(e) });
    }
  }, [modeId]);

  useEffect(() => {
    void hentManifest();
  }, [hentManifest]);

  // Profil og historik bruges kun til sælgerkonteksten. Fejler de, kører
  // øvelsen alligevel — coachen har bare mindre hukommelse med sig.
  useEffect(() => {
    let stoppet = false;
    void (async () => {
      const p = await getProfile().catch(() => undefined);
      const s = await listSessions().catch(() => [] as TrainingSession[]);
      if (stoppet) return;
      setProfil(p ?? null);
      setSessioner(s);
    })();
    return () => {
      stoppet = true;
    };
  }, [seller?.id]);

  /* -------------------------------------------------------------- Afledt */

  const mode: TrainingMode | undefined = useMemo(
    () => (manifest?.modes ?? []).find((m) => m.id === modeId),
    [manifest, modeId],
  );

  const coachModes: CoachModeSpec[] = useMemo(() => {
    const fra = manifest?.coachModes ?? [];
    return fra.length ? fra : COACH_FALLBACK;
  }, [manifest]);

  // Standardtilstanden kommer fra øvelsen selv (hybrid for de fleste).
  useEffect(() => {
    if (!mode || coachMode) return;
    const oensket = mode.defaultCoachMode;
    const findes = coachModes.some((c) => c.id === oensket);
    setCoachMode(findes ? oensket : (coachModes[0]?.id ?? "hybrid"));
  }, [mode, coachModes, coachMode]);

  const valg = useMemo(() => {
    const personas = manifest?.personas ?? [];
    return {
      brancher: foerste(unikke(personas.map((p) => p.industry), 12), FALLBACK.brancher),
      roller: foerste(unikke(personas.map((p) => p.role), 12), FALLBACK.roller),
      stoerrelser: FALLBACK.stoerrelser,
      moedetyper: FALLBACK.moedetyper,
      faser: FALLBACK.faser,
      holdninger: FALLBACK.holdninger,
      leverandoerer: FALLBACK.leverandoerer,
      prisfoelsomhed: FALLBACK.prisfoelsomhed,
    };
  }, [manifest]);

  const brugerScenarie = Boolean(mode?.usesScenario);
  const optaget = fase.kind === "bygger" || fase.kind === "gemmer";
  const manglerIntake = Boolean(mode?.intakePrompt) && intake.trim().length === 0;

  const scenarieConfig = useCallback((): ScenarioConfig => {
    const valgt = [
      industry,
      companySize,
      customerRole,
      meetingType,
      salesStage,
      attitude,
      existingSupplier,
      priceSensitivity,
      knownInformation.trim() || undefined,
    ].some(Boolean);

    return {
      industry,
      companySize,
      customerRole,
      meetingType,
      salesStage,
      attitude,
      difficulty,
      existingSupplier,
      priceSensitivity,
      knownInformation: knownInformation.trim() || undefined,
      auto: !valgt,
    };
  }, [
    industry,
    companySize,
    customerRole,
    meetingType,
    salesStage,
    attitude,
    difficulty,
    existingSupplier,
    priceSensitivity,
    knownInformation,
  ]);

  /* --------------------------------------------------------------- Start */

  const start = useCallback(
    async (opts: { medScenarie: boolean }) => {
      if (!mode || igang.current) return;
      igang.current = true;

      let scenario: Scenario | undefined;
      let hiddenBlob: string | undefined;

      if (brugerScenarie && opts.medScenarie) {
        setFase({ kind: "bygger" });
        try {
          const svar = await api.generateScenario({
            modeId: mode.id,
            config: scenarieConfig(),
            sellerContext: api.buildSellerContext(profil, seller, sessioner),
            language: appConfig.defaultLanguage,
          });
          scenario = svar.scenario;
          hiddenBlob = svar.hiddenBlob || undefined;
        } catch (e) {
          igang.current = false;
          if (!levende.current) return;
          setFase({ kind: "startfejl", besked: fejltekst(e), kanStarteUden: true });
          return;
        }
      }

      setFase({ kind: "gemmer" });

      // hiddenBlob er serverens forseglede pakke. Den følger sessionen videre
      // til samtalen og analysen, og den vises aldrig for sælgeren.
      const session: TrainingSession & { hiddenBlob?: string } = {
        id: newId("ses"),
        sellerId: seller?.id ?? "",
        sellerInitials: seller?.initials ?? "",
        modeId: mode.id,
        coachMode: coachMode ?? mode.defaultCoachMode,
        language: appConfig.defaultLanguage,
        voiceEngine: "realtime",
        scenario,
        intake: intake.trim() || undefined,
        status: "aktiv",
        startedAt: new Date().toISOString(),
        durationSec: 0,
        transcript: [],
        developmentFocus: [],
      };
      if (hiddenBlob) session.hiddenBlob = hiddenBlob;

      try {
        await saveSession(session);
      } catch (e) {
        igang.current = false;
        if (!levende.current) return;
        setFase({ kind: "startfejl", besked: fejltekst(e), kanStarteUden: false });
        return;
      }

      igang.current = false;
      navigate(`/session/${session.id}`);
    },
    [
      mode,
      brugerScenarie,
      scenarieConfig,
      profil,
      seller,
      sessioner,
      coachMode,
      intake,
      navigate,
    ],
  );

  /* -------------------------------------------------------------- Render */

  if (fase.kind === "henter") return <Skelet />;

  if (fase.kind === "manifestfejl") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <TilbageLink />
        <ErrorNote onRetry={() => void hentManifest()}>
          Øvelsen kunne ikke hentes. {truncate(fase.besked, 140)}
        </ErrorNote>
      </div>
    );
  }

  if (fase.kind === "ukendt" || !mode) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <TilbageLink />
        <div className="panel p-6 md:p-8">
          <h1 className="title-lg">Den øvelse findes ikke</h1>
          <p className="body mt-2">
            Der er ingen træningsform der hedder “{truncate(modeId, 40)}”. Den kan være
            omdøbt eller fjernet fra manifestet.
          </p>
          <Link to="/" className="btn-primary mt-6">
            Se alle øvelser
          </Link>
        </div>
      </div>
    );
  }

  const I = ikonFor(mode.icon, mode.id);
  const modpart =
    mode.counterpart === "salgsdirektoer" ? (
      <span className="chip-brand">Du taler med salgsdirektøren</span>
    ) : (
      <span className="chip-client">Du taler med en kunde</span>
    );

  const startKnap = (fuld: boolean) => (
    <button
      type="button"
      className={`btn-primary btn-lg ${fuld ? "w-full" : ""}`}
      onClick={() => void start({ medScenarie: true })}
      disabled={optaget}
    >
      {optaget ? (
        <>
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black/70" />
          {fase.kind === "bygger" ? "Bygger scenariet…" : "Starter…"}
        </>
      ) : (
        <>
          <Icon.Mic width={18} height={18} />
          Start øvelsen
        </>
      )}
    </button>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <TilbageLink />

      {/* ------------------------------------------------------------ Hero */}
      <section className="panel p-5 md:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-base-line2 bg-base-panel2 text-brand-400">
                <I width={19} height={19} />
              </span>
              <div className="min-w-0">
                <div className="eyebrow">Øvelse {String(mode.order ?? 0).padStart(2, "0")}</div>
                <h1 className="title-lg mt-0.5">{mode.title}</h1>
              </div>
            </div>

            <p className="body mt-4">{mode.description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {modpart}
              <span className="chip">{formatMinuteRange(mode.minutes)}</span>
              {brugerScenarie && <span className="chip">Scenarie genereres</span>}
            </div>
          </div>

          {/* Knappen står før alt sekundært — også på mobil. */}
          <div className="shrink-0 md:w-64">
            {startKnap(true)}
            <p className="mt-2.5 text-xs leading-relaxed text-ink-mute">
              Du kan starte nu. Alt herunder er valgfrit — vælger du intet, bygger coachen
              scenariet selv.
            </p>
            {fase.kind === "bygger" && (
              <p className="mt-2 text-xs text-ink-mute">Det tager typisk 5-10 sekunder.</p>
            )}
          </div>
        </div>

        {mode.trains.length > 0 && (
          <div className="panel-inset mt-6 px-4 py-3.5 md:max-w-2xl">
            <div className="eyebrow mb-2">Du træner</div>
            <ul className="space-y-1.5">
              {mode.trains.slice(0, 4).map((t, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-600" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fase.kind === "startfejl" && (
          <div className="mt-5 space-y-3">
            <ErrorNote>
              {fase.kanStarteUden ? "Scenariet kunne ikke bygges." : "Øvelsen kunne ikke startes."}{" "}
              {truncate(fase.besked, 160)}
            </ErrorNote>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => void start({ medScenarie: true })}
              >
                <Icon.Repeat width={16} height={16} />
                Prøv igen
              </button>
              {fase.kanStarteUden && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void start({ medScenarie: false })}
                >
                  Start uden genereret scenarie
                </button>
              )}
            </div>
            {fase.kanStarteUden && (
              <p className="text-xs leading-relaxed text-ink-mute">
                Uden scenarie improviserer coachen situationen undervejs. Øvelsen bliver mere
                løs, men den bliver ikke lettere.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- Oplæg */}
      {mode.intakePrompt && (
        <section className="panel p-5 md:p-6">
          <Field
            label={mode.intakePrompt}
            htmlFor="intake"
            hint="Skriv i stikord. Jo mere konkret, jo mere konkret bliver coachen."
          >
            <textarea
              id="intake"
              className="textarea"
              rows={5}
              value={intake}
              onChange={(e) => setIntake(e.target.value)}
              placeholder="Kunde, situation, hvad der er sagt indtil nu, og hvad du vil opnå."
            />
          </Field>
          {manglerIntake && (
            <div className="mt-4">
              <Notice>
                Du kan sagtens starte uden. Men coachen har så kun det, du siger undervejs, at
                gå efter — og feedbacken bliver tilsvarende generel.
              </Notice>
            </div>
          )}
        </section>
      )}

      {/* --------------------------------------------------- Coachtilstand */}
      <section className="panel p-5 md:p-6">
        <div className="mb-4">
          <h2 className="title-md">Hvordan skal coachen opføre sig?</h2>
          <p className="body-mute mt-1">
            Standarden er valgt til netop denne øvelse. Skift kun, hvis du ved hvorfor.
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Coachtilstand">
          {coachModes.map((c) => {
            const valgt = coachMode === c.id;
            return (
              <label key={c.id} className="block cursor-pointer">
                <input
                  type="radio"
                  name="coachtilstand"
                  className="peer sr-only"
                  value={c.id}
                  checked={valgt}
                  onChange={() => setCoachMode(c.id)}
                  disabled={optaget}
                />
                <span
                  className={`flex h-full flex-col gap-1.5 rounded-xl border p-4 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 ${
                    valgt
                      ? "border-brand-600 bg-brand-950"
                      : "border-base-line bg-base/60 hover:border-base-line2"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                        valgt ? "border-brand-400" : "border-base-line2"
                      }`}
                    >
                      {valgt && <span className="h-2 w-2 rounded-full bg-brand-400" />}
                    </span>
                    <span className={`text-sm font-semibold ${valgt ? "text-ink" : "text-ink-soft"}`}>
                      {c.title}
                    </span>
                  </span>
                  <span className="text-xs leading-relaxed text-ink-mute">
                    {truncate(c.short || c.description, 120)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------ Tilpas scenariet */}
      {brugerScenarie && (
        <section className="panel p-5 md:p-6">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-expanded={aabenTilpas}
            aria-controls="tilpas"
            onClick={() => setAabenTilpas((v) => !v)}
          >
            <span className="min-w-0 flex-1">
              <span className="title-md block">Tilpas scenariet</span>
              <span className="body-mute mt-0.5 block">
                Valgfrit. Uden valg bygger coachen selv en situation, der ligner jeres
                virkelighed. Sværhedsgraden er hård som standard og blødes ikke op.
              </span>
            </span>
            <span className={`shrink-0 text-ink-mute transition-transform ${aabenTilpas ? "rotate-90" : ""}`}>
              <Icon.Arrow width={18} height={18} />
            </span>
          </button>

          {aabenTilpas && (
            <div id="tilpas" className="mt-6 space-y-7">
              {/* Sværhedsgrad */}
              <div role="group" aria-label="Sværhedsgrad">
                <div className="label mb-2">Sværhedsgrad</div>
                <ChipGroup
                  options={SVAERHED.map((s) => s.label)}
                  value={SVAERHED.find((s) => s.id === difficulty)?.label}
                  allowClear={false}
                  onChange={(v) => {
                    const fundet = SVAERHED.find((s) => s.label === v);
                    if (fundet) setDifficulty(fundet.id);
                  }}
                />
                <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                  {SVAERHED.find((s) => s.id === difficulty)?.note}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  Scenarier blødes ikke op, fordi du er erfaren. Der findes ingen let udgave.
                </p>
              </div>

              <div className="divider" />

              <div className="grid gap-6 sm:grid-cols-2">
                <Valg label="Branche" options={valg.brancher} value={industry} onChange={setIndustry} />
                <Valg
                  label="Virksomhedsstørrelse"
                  options={valg.stoerrelser}
                  value={companySize}
                  onChange={setCompanySize}
                />
                <Valg
                  label="Kundens rolle"
                  options={valg.roller}
                  value={customerRole}
                  onChange={setCustomerRole}
                />
                <Valg
                  label="Mødetype"
                  options={valg.moedetyper}
                  value={meetingType}
                  onChange={setMeetingType}
                />
                <Valg label="Salgsfase" options={valg.faser} value={salesStage} onChange={setSalesStage} />
                <Valg
                  label="Kundens holdning"
                  options={valg.holdninger}
                  value={attitude}
                  onChange={setAttitude}
                />
                <Valg
                  label="Nuværende leverandør"
                  options={valg.leverandoerer}
                  value={existingSupplier}
                  onChange={setExistingSupplier}
                />
                <Valg
                  label="Prisfølsomhed"
                  options={valg.prisfoelsomhed}
                  value={priceSensitivity}
                  onChange={setPriceSensitivity}
                />
              </div>

              <Field
                label="Hvad ved du allerede om sagen?"
                htmlFor="kendt"
                hint="Fx anlæggets alder, hvem der har været inde over, eller hvad kunden sagde sidst."
              >
                <textarea
                  id="kendt"
                  className="textarea"
                  rows={3}
                  value={knownInformation}
                  onChange={(e) => setKnownInformation(e.target.value)}
                  placeholder="Valgfrit."
                />
              </Field>
            </div>
          )}
        </section>
      )}

      {/* -------------------------------------------------- Sådan foregår det */}
      <section className="panel-quiet p-5 md:p-6">
        <h2 className="title-md mb-4">Sådan foregår det</h2>
        <ul className="space-y-3">
          <Linje icon={<Icon.Mic width={16} height={16} />}>
            Du taler med din egen stemme. Du kan afbryde, og du bliver afbrudt — præcis som i et
            rigtigt møde.
          </Linje>
          <Linje icon={<Icon.Warn width={16} height={16} />}>
            Vage svar bliver ikke accepteret. Bliver du upræcis, spørger modparten videre.
          </Linje>
          <Linje icon={<Icon.Check width={16} height={16} />}>
            Når du afslutter, får du en vurdering af det, du faktisk sagde — med citater fra
            samtalen.
          </Linje>
        </ul>
      </section>

      {/* ----------------------------------------------------------- Start */}
      <section className="panel p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="title-md">Klar?</div>
            <p className="body-mute mt-1">
              {brugerScenarie
                ? "Coachen bygger scenariet, og så går samtalen i gang."
                : "Samtalen går i gang med det samme."}
            </p>
          </div>
          <div className="sm:w-64">{startKnap(true)}</div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ Delkomponenter */

function TilbageLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 text-sm font-medium text-ink-mute transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-lg"
    >
      <Icon.Back width={16} height={16} />
      Alle øvelser
    </Link>
  );
}

function Valg({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div role="group" aria-label={label}>
      <div className="label mb-2">{label}</div>
      <ChipGroup options={options} value={value} onChange={onChange} />
    </div>
  );
}

function Linje({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-base-line bg-base-panel text-brand-500">
        {icon}
      </span>
      <span className="body pt-1">{children}</span>
    </li>
  );
}

function Skelet() {
  return (
    <div className="space-y-6" role="status" aria-label="Henter øvelsen">
      <div className="h-4 w-28 animate-pulse rounded bg-base-panel2" aria-hidden="true" />
      <div className="panel p-6" aria-hidden="true">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-base-panel2" />
          <div className="space-y-2">
            <div className="h-2.5 w-16 animate-pulse rounded bg-base-panel2" />
            <div className="h-4 w-48 animate-pulse rounded bg-base-panel2" />
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-2.5 w-full animate-pulse rounded bg-base-panel2" />
          <div className="h-2.5 w-3/4 animate-pulse rounded bg-base-panel2" />
        </div>
        <div className="mt-6 h-12 w-full animate-pulse rounded-xl bg-base-panel2 md:w-64" />
      </div>
      <div className="panel h-40 animate-pulse" aria-hidden="true" />
    </div>
  );
}
