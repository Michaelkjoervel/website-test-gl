// =============================================================================
// pages/Home · Forsiden
// -----------------------------------------------------------------------------
// Forsiden har ét formål: at få sælgeren til at tale med coachen. Derfor er der
// hverken målere, point eller aktivitetsgrafer her — kun spørgsmålet, det
// salgsdirektøren anbefaler lige nu, og øvelserne man kan vælge imellem.
//
// Træningsformerne hentes fra manifestet (serveren), så listen kun findes ét
// sted. Fejler hentningen, siger vi det ligeud og tilbyder at prøve igen.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { getProfile, listSessions } from "../lib/store";
import { formatMinuteRange, plural, relativeTime, truncate } from "../lib/format";
import { Icon, type IconName } from "../ui/icons";
import { ErrorNote, SectionHeader } from "../ui/primitives";
import type {
  RecommendedTraining,
  Seller,
  SellerProfile,
  TrainingMode,
  TrainingModeId,
  TrainingSession,
} from "../lib/types";

/* ------------------------------------------------------------------ Lager */
//
// Begge kald sker uden sælger-id: lageret ved selv, hvem der kigger, og et
// eksplicit id ville kun kunne blive forkert. Profilen og historikken er
// tilføjelser til forsiden — fejler de, mangler der en linje tekst, ikke andet.

async function hentProfil(): Promise<SellerProfile | null> {
  try {
    return (await getProfile()) ?? null;
  } catch {
    return null;
  }
}

async function hentSessioner(): Promise<TrainingSession[]> {
  try {
    return await listSessions();
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ Ikoner */

/** Ikonnavnet kommer fra serveren; her oversættes det til vores eget sæt. */
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

function ikonFor(navn: string | undefined, modeId?: TrainingModeId) {
  const raw = String(navn ?? "").trim().toLowerCase();
  const direkte = IKON_NAVNE.find((k) => k.toLowerCase() === raw);
  if (direkte) return Icon[direkte];
  const efterOevelse = modeId ? IKON_PR_OEVELSE[modeId] : undefined;
  return Icon[efterOevelse ?? "Mic"];
}

/* -------------------------------------------------------------- Småting */

function fornavnAf(seller: Seller | null | undefined): string {
  const navn = (seller?.name ?? "").trim();
  const foerste = navn.split(/\s+/)[0] ?? "";
  const erInitialer = /^[A-ZÆØÅ]{2,4}$/.test(foerste);
  if (foerste && !erInitialer) return foerste;
  return (seller?.initials ?? foerste).trim();
}

function fejltekst(e: unknown): string {
  const besked = e instanceof Error ? e.message : String(e ?? "");
  return besked.trim() || "Ukendt fejl.";
}

function paentModeNavn(id: string): string {
  const t = id.replace(/-/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Øvelse";
}

/* =========================================================================== */

export function Home() {
  const navigate = useNavigate();
  const { seller } = useAuth();

  const [modes, setModes] = useState<TrainingMode[] | null>(null);
  const [modesFejl, setModesFejl] = useState<string | null>(null);
  const [profil, setProfil] = useState<SellerProfile | null>(null);
  const [sessioner, setSessioner] = useState<TrainingSession[]>([]);
  const [historikKlar, setHistorikKlar] = useState(false);

  const levende = useRef(true);
  useEffect(() => {
    levende.current = true;
    return () => {
      levende.current = false;
    };
  }, []);

  const hentManifest = useCallback(async () => {
    setModesFejl(null);
    setModes(null);
    try {
      const manifest = await api.getManifest();
      if (!levende.current) return;
      setModes(Array.isArray(manifest?.modes) ? manifest.modes : []);
    } catch (e) {
      if (!levende.current) return;
      setModesFejl(fejltekst(e));
    }
  }, []);

  useEffect(() => {
    void hentManifest();
  }, [hentManifest]);

  useEffect(() => {
    let stoppet = false;
    setHistorikKlar(false);
    void (async () => {
      const [p, s] = await Promise.all([hentProfil(), hentSessioner()]);
      if (stoppet) return;
      setProfil(p);
      setSessioner(s);
      setHistorikKlar(true);
    })();
    return () => {
      stoppet = true;
    };
  }, [seller?.id, seller?.initials]);

  /* ------------------------------------------------------------- Afledt */

  const synligeModes = useMemo(
    () => (modes ?? []).filter((m) => !m.hidden).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [modes],
  );

  const modeEfterId = useMemo(() => {
    const kort = new Map<string, TrainingMode>();
    for (const m of modes ?? []) kort.set(m.id, m);
    return kort;
  }, [modes]);

  const sidsteSession = useMemo(() => {
    let nyeste: string | undefined;
    for (const s of sessioner) {
      const t = s.startedAt;
      if (t && (!nyeste || t > nyeste)) nyeste = t;
    }
    return nyeste;
  }, [sessioner]);

  const antalSessioner = profil?.sessionsCount ?? sessioner.length;
  const sidstTraenet = profil?.lastSessionAt ?? sidsteSession;

  const anbefalinger = useMemo(
    () => [...(profil?.recommended ?? [])].sort((a, b) => a.priority - b.priority).slice(0, 3),
    [profil],
  );

  const foersteGang = historikKlar && antalSessioner === 0 && !profil;

  const kontekstlinje = (() => {
    if (!historikKlar) return "";
    if (antalSessioner > 0) {
      const antal = plural(antalSessioner, "gennemført samtale", "gennemførte samtaler");
      return sidstTraenet ? `${antal} · sidst ${relativeTime(sidstTraenet)}` : antal;
    }
    return "Ingen samtaler endnu.";
  })();

  const navn = fornavnAf(seller);

  const start = (modeId: TrainingModeId | string) => navigate(`/traening/${modeId}`);

  /* ------------------------------------------------------------- Render */

  return (
    <div className="space-y-10 md:space-y-12">
      {/* -------------------------------------------------------- Spørgsmålet */}
      <header className="animate-fade-up">
        <h1 className="title-xl max-w-2xl">
          Hvad vil du arbejde med i dag{navn ? `, ${navn}` : ""}?
        </h1>
        <p className="body-mute mt-2 min-h-[20px]">{kontekstlinje}</p>
      </header>

      {/* ------------------------------------------------------- Første gang */}
      {foersteGang && (
        <section className="panel-quiet border-l-2 border-l-brand-600 p-5 md:p-6">
          <h2 className="title-md">Første gang her</h2>
          <p className="body mt-2 max-w-2xl">
            Du taler dig igennem en salgssituation med din egen stemme — enten med en kunde,
            der ikke giver noget væk gratis, eller med salgsdirektøren, der går dig efter i
            sømmene. Bagefter får du en ærlig vurdering af det, du faktisk sagde, og coachen
            er ikke høflig for høflighedens skyld.
          </p>
        </section>
      )}

      {/* ------------------------------------------------------- Anbefalinger */}
      {anbefalinger.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="Fra salgsdirektøren"
            title="Fortsæt hvor du slap"
            desc="Valgt ud fra dine seneste samtaler — ikke ud fra hvad der er behageligst at træne."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {anbefalinger.map((r, i) => (
              <AnbefalingKort
                key={`${r.modeId}-${i}`}
                rec={r}
                mode={modeEfterId.get(r.modeId)}
                onStart={() => start(r.modeId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- Øvelserne */}
      <section>
        <SectionHeader
          eyebrow="Træningsformer"
          title="Alle øvelser"
          desc="Vælg en, og du er i gang. Opsætningen bagefter er valgfri."
        />

        {modesFejl && (
          <ErrorNote onRetry={() => void hentManifest()}>
            Træningsformerne kunne ikke hentes. {truncate(modesFejl, 140)}
          </ErrorNote>
        )}

        {!modesFejl && modes === null && <OevelseSkelet />}

        {!modesFejl && modes !== null && synligeModes.length === 0 && (
          <div className="panel-quiet p-6 text-center">
            <div className="title-md">Ingen træningsformer tilgængelige</div>
            <p className="body-mute mx-auto mt-1.5 max-w-md">
              Serveren svarede uden øvelser. Prøv at hente listen igen.
            </p>
            <button type="button" className="btn-outline mt-5" onClick={() => void hentManifest()}>
              Hent igen
            </button>
          </div>
        )}

        {!modesFejl && synligeModes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {synligeModes.map((m) => (
              <OevelseKort key={m.id} mode={m} onStart={() => start(m.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ Delkomponenter */

function ModpartMaerke({ mode }: { mode: TrainingMode | undefined }) {
  if (!mode) return null;
  return mode.counterpart === "salgsdirektoer" ? (
    <span className="chip-brand">Salgsdirektøren</span>
  ) : (
    <span className="chip-client">Kunden</span>
  );
}

function AnbefalingKort({
  rec,
  mode,
  onStart,
}: {
  rec: RecommendedTraining;
  mode: TrainingMode | undefined;
  onStart: () => void;
}) {
  const I = ikonFor(mode?.icon, rec.modeId);
  return (
    <button
      type="button"
      onClick={onStart}
      className="tile group border-brand-900 bg-brand-950/30 hover:border-brand-600"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-800 bg-brand-950 text-brand-400">
          <I width={17} height={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="title-md truncate">{mode?.title ?? paentModeNavn(rec.modeId)}</h3>
          {mode && <p className="mt-0.5 text-xs text-ink-mute">{formatMinuteRange(mode.minutes)}</p>}
        </div>
      </div>

      <p className="body mt-1">{rec.why}</p>

      <div className="panel-inset mt-1 px-3 py-2.5">
        <div className="eyebrow mb-1">Coachen presser på</div>
        <p className="text-sm leading-relaxed text-ink">{rec.focus}</p>
      </div>

      {rec.scenarioHint && (
        <p className="text-xs leading-relaxed text-ink-mute">{truncate(rec.scenarioHint, 120)}</p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-2">
        <ModpartMaerke mode={mode} />
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400">
          Start
          <Icon.Arrow width={15} height={15} />
        </span>
      </div>
    </button>
  );
}

function OevelseKort({ mode, onStart }: { mode: TrainingMode; onStart: () => void }) {
  const I = ikonFor(mode.icon, mode.id);
  return (
    <button type="button" onClick={onStart} className="tile group h-full">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-base-line2 bg-base-panel2 text-ink-soft transition-colors group-hover:border-brand-700 group-hover:text-brand-400">
          <I width={18} height={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xs font-semibold tabular-nums text-ink-faint">
              {String(mode.order ?? 0).padStart(2, "0")}
            </span>
            <h3 className="title-md truncate">{mode.title}</h3>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-mute">{mode.tagline}</p>
        </div>
      </div>

      <p className="body-mute line-clamp-2">{truncate(mode.description, 130)}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <ModpartMaerke mode={mode} />
        <span className="text-xs text-ink-mute">{formatMinuteRange(mode.minutes)}</span>
        <Icon.Arrow
          width={16}
          height={16}
          className="ml-auto text-brand-500 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </button>
  );
}

function OevelseSkelet() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Henter træningsformer">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="panel p-5" aria-hidden="true">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-base-panel2" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-base-panel2" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-base-panel2" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-2.5 w-full animate-pulse rounded bg-base-panel2" />
            <div className="h-2.5 w-4/5 animate-pulse rounded bg-base-panel2" />
          </div>
          <div className="mt-5 h-5 w-24 animate-pulse rounded-full bg-base-panel2" />
        </div>
      ))}
    </div>
  );
}
