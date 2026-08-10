// =============================================================================
// pages/ManagerSeller · Én sælgers udvikling, set fra ledelsen
// -----------------------------------------------------------------------------
// Skærmen der ligger åben under en 1:1. Den er skrevet til at kunne læses
// oppefra og ned som en samtale: coachens vurdering først, så det der virker,
// så det der skal trænes, og til sidst hvad lederen selv vil tage fat i.
//
// To ting er bevidst holdt ude:
//   · Sælgerens uploadede kundemateriale. Det er privat. Uden den garanti
//     tør ingen øve på en rigtig kundesag — og så mister værktøjet sin værdi.
//   · Alt der ligner en karakter. Ingen score, ingen sammenligning med de
//     andre. Mønstre set én enkelt gang markeres eksplicit som netop det.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { getProfile, listAllSessions, listProfiles, saveProfile } from "../lib/store";
import { listSellers } from "../lib/sellers";
import * as fmt from "../lib/format";

import {
  Avatar,
  CoachText,
  EmptyState,
  ErrorNote,
  Field,
  Notice,
  Panel,
  RatingPill,
  SectionHeader,
  Spinner,
  useToast,
} from "../ui/primitives";
import { Icon } from "../ui/icons";
import { NoManagerAccess } from "./ManagerDashboard";
import type {
  DevelopmentPattern,
  PatternTrend,
  Seller,
  SellerProfile,
  SkillArea,
  SkillSignal,
  TrainingModeId,
  TrainingSession,
} from "../lib/types";

/* ------------------------------------------------------------------ Tekster */

const MODE_LABELS: Record<TrainingModeId, string> = {
  kunderollespil: "Kunderollespil",
  afdaekning: "Afdækning",
  indvendinger: "Indvendinger",
  salgsmoede: "Salgsmøde",
  telefon: "Telefonsamtale",
  kvalificering: "Kvalificering",
  "naeste-skridt": "Næste skridt",
  forhandling: "Forhandling",
  forberedelse: "Mødeforberedelse",
  debriefing: "Debriefing",
  tilbudsopfoelgning: "Tilbudsopfølgning",
  lynild: "Lynild",
  manualeksamen: "Manualeksamen",
  "fri-coaching": "Fri coaching",
  materialepraesentation: "Materialepræsentation",
};

function modeLabel(id: TrainingModeId | string): string {
  return MODE_LABELS[id as TrainingModeId] ?? String(id);
}

const PRIORITY_LABELS: Record<1 | 2 | 3, string> = {
  1: "Først",
  2: "Dernæst",
  3: "Når der er plads",
};

/** Profilen kan bære lederens egen note. Feltet er valgfrit i datamodellen. */
type ProfileWithNote = SellerProfile & { managerNote?: string };

function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Der opstod en uventet fejl.";
}

/* ------------------------------------------- Lokal sikkerhedskopi af noten */

const NOTE_KEY = "gl.coach.ledernote.v1";

function readNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeNote(initials: string, text: string): void {
  try {
    const all = readNotes();
    if (text) all[initials] = text;
    else delete all[initials];
    localStorage.setItem(NOTE_KEY, JSON.stringify(all));
  } catch {
    // Uden lokalt lager lever noten videre i profilen — det er det vigtige.
  }
}

/* --------------------------------------------------------------- Indgangen */

export function ManagerSeller() {
  const { seller, isManager } = useAuth();
  const { initials } = useParams();
  const key = (initials ?? "").trim().toUpperCase();

  // Adgangskontrollen først. Ruten er lederens, uanset om menupunktet er synligt.
  if (!seller) {
    return (
      <div className="flex items-center gap-3 py-16 text-sm text-ink-mute">
        <Spinner /> Henter din adgang
      </div>
    );
  }
  if (!isManager) return <NoManagerAccess />;
  if (!key) return <UnknownSeller initials="" />;

  return <SellerInner initials={key} />;
}

function UnknownSeller({ initials }: { initials: string }) {
  return (
    <div className="space-y-5">
      <BackLink />
      <Panel as="section">
        <EmptyState
          title={initials ? `Ingen sælger med initialerne ${initials}` : "Der er ikke valgt nogen sælger"}
          desc="Gå tilbage til ledelsesoverblikket og vælg en sælger fra oversigten."
          action={
            <Link className="btn-primary btn-sm" to="/ledelse">
              Til ledelsesoverblikket
            </Link>
          }
        />
      </Panel>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/ledelse" className="btn-ghost btn-sm -ml-2 w-fit">
      <Icon.Back width={15} height={15} />
      Ledelsesoverblik
    </Link>
  );
}

/* ---------------------------------------------------------------- Skærmen */

function SellerInner({ initials }: { initials: string }) {
  const toast = useToast();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [profile, setProfile] = useState<ProfileWithNote | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [allSellers, profiles, allSessions] = await Promise.all([
        listSellers(),
        listProfiles(),
        listAllSessions(),
      ]);

      const found = allSellers.find((s) => s.initials.toUpperCase() === initials) ?? null;

      let prof: ProfileWithNote | null =
        profiles.find((p) => p.initials.trim().toUpperCase() === initials) ?? null;
      if (!prof && found) {
        prof = (await getProfile(found.id)) ?? null;
      }

      const mine = allSessions.filter(
        (s) =>
          (s.sellerInitials ?? "").trim().toUpperCase() === initials ||
          (found ? s.sellerId === found.id : false),
      );

      if (!found && !prof && mine.length === 0) {
        setNotFound(true);
        return;
      }

      setSeller(found);
      setProfile(prof);
      setSessions(mine);

      const local = readNotes()[initials] ?? "";
      const current = local || prof?.managerNote || "";
      setNote(current);
      setSavedNote(current);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [initials]);

  useEffect(() => {
    void load();
  }, [load]);

  /* --------------------------------------------------------------- Afledt */

  const orderedSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.status !== "kladde")
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0)),
    [sessions],
  );

  const totalMinutes = useMemo(
    () => orderedSessions.reduce((a, s) => a + Math.max(0, Math.round((s.durationSec ?? 0) / 60)), 0),
    [orderedSessions],
  );

  const strengths = useMemo(
    () => (profile?.strengths ?? []).filter((p) => p.status === "aktiv"),
    [profile],
  );
  const weaknesses = useMemo(
    () => (profile?.weaknesses ?? []).filter((p) => p.status === "aktiv"),
    [profile],
  );
  const resolved = useMemo(
    () => [...(profile?.strengths ?? []), ...(profile?.weaknesses ?? [])].filter((p) => p.status === "loest"),
    [profile],
  );

  const signals = useMemo(() => {
    const entries = Object.entries(profile?.signals ?? {}) as [SkillArea, SkillSignal | undefined][];
    return entries
      .filter((e): e is [SkillArea, SkillSignal] => Boolean(e[1]))
      .sort((a, b) => fmt.ratingScore(a[1].level) - fmt.ratingScore(b[1].level));
  }, [profile]);

  const recommended = useMemo(
    () => [...(profile?.recommended ?? [])].sort((a, b) => a.priority - b.priority),
    [profile],
  );

  /* ----------------------------------------------------------- Ledernoten */

  const saveNote = useCallback(async () => {
    const text = note.trim();
    setSaving(true);
    setSaveError(null);
    try {
      if (profile) {
        // Egen variabel frem for et objektliteral direkte i kaldet: managerNote
        // er en tilføjelse oven på SellerProfile, ikke en del af datamodellen.
        const next: ProfileWithNote = { ...profile, managerNote: text };
        const saved = await saveProfile(next);
        setProfile({ ...saved, managerNote: text });
      }
      writeNote(initials, text);
      setSavedNote(text);
      setSavedAt(new Date().toISOString());
      toast("Din note er gemt");
    } catch (e) {
      // Teksten må aldrig gå tabt, selvom skrivningen til profilen fejler.
      writeNote(initials, text);
      setSavedNote(text);
      setSaveError(errorText(e));
      toast("Noten kunne ikke gemmes på profilen", "fejl");
    } finally {
      setSaving(false);
    }
  }, [note, profile, initials, toast]);

  /* ------------------------------------------------------------------ Render */

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 text-sm text-ink-mute">
        <Spinner /> Henter {initials}
      </div>
    );
  }

  if (notFound) return <UnknownSeller initials={initials} />;

  const name = seller?.name && seller.name !== initials ? seller.name : "";

  return (
    <div className="space-y-6">
      <BackLink />

      {error && <ErrorNote onRetry={() => void load()}>{error}</ErrorNote>}

      {/* ------------------------------------------------------------ Hoved */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar initials={initials} size={52} />
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-1">Udviklingssamtale</div>
            <h1 className="title-xl">{name ? `${name} (${initials})` : initials}</h1>
            <p className="body-mute mt-1">
              {orderedSessions.length === 0
                ? "Ingen sessioner endnu"
                : `${fmt.plural(orderedSessions.length, "session", "sessioner")} · ${fmt.formatMinutes(
                    totalMinutes,
                  )} træning · senest ${fmt.formatDateCompact(orderedSessions[0]?.startedAt)}`}
              {profile ? ` · profil opdateret ${fmt.formatDateCompact(profile.updatedAt)}` : ""}
            </p>
          </div>
        </div>

        <Notice>
          Du ser sælgerens sessioner og udviklingsprofil. Materiale som {initials} selv har uploadet —
          tilbud, præsentationer, kundedokumenter — er privat og vises ikke her. Det er et bevidst valg:
          uden den grænse tør ingen øve på en rigtig kundesag.
        </Notice>
      </header>

      {orderedSessions.length === 0 && !profile ? (
        <Panel as="section">
          <EmptyState
            title={`${initials} har ikke trænet endnu`}
            desc="Der er intet at coache på herfra endnu. Det er en neutral oplysning — værktøjet er ikke taget i brug, og det siger ikke noget om sælgerens arbejde."
          />
        </Panel>
      ) : (
        <>
          {/* --------------------------------------------- Coachens vurdering */}
          <Panel as="section">
            <SectionHeader
              eyebrow="Salgsdirektørens vurdering"
              title="Sådan læser coachen udviklingen"
              desc="Skrevet om efter hver session. Det er en vurdering af samtalerne i værktøjet — ikke af sælgerens resultater."
            />
            {profile?.narrative ? (
              <CoachText text={profile.narrative} />
            ) : (
              <Notice>
                Der er endnu ikke skrevet en samlet vurdering. Den kommer, når der er nok sessioner til at
                sige noget, der holder.
              </Notice>
            )}

            {profile && profile.ownGoals.length > 0 && (
              <div className="mt-5 border-t border-base-line pt-4">
                <h3 className="title-md">{initials} har selv bedt om at blive presset på</h3>
                <ul className="mt-2 space-y-1.5">
                  {profile.ownGoals.map((g, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-ink-soft">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-600" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {/* -------------------------------------------------- Udviklingsmønstre */}
          <Panel as="section">
            <SectionHeader
              eyebrow="Mønstre"
              title="Det der virker"
              desc="Styrker der er set flere gange. Det er dem, man skal bygge videre på i samtalen."
            />
            {strengths.length === 0 ? (
              <Notice>Ingen styrker er slået fast som mønster endnu.</Notice>
            ) : (
              <ul className="space-y-3">
                {strengths.map((p) => (
                  <li key={p.id}>
                    <PatternCard pattern={p} kindTone="brand" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel as="section">
            <SectionHeader
              eyebrow="Mønstre"
              title="Det der skal trænes"
              desc="Coach på det der er set flere gange. Et enkelt tilfælde er markeret som netop det — det er et spørgsmål til samtalen, ikke en konklusion."
            />
            {weaknesses.length === 0 ? (
              <Notice>Ingen udviklingsområder er slået fast som mønster endnu.</Notice>
            ) : (
              <ul className="space-y-3">
                {weaknesses.map((p) => (
                  <li key={p.id}>
                    <PatternCard pattern={p} kindTone="warn" />
                  </li>
                ))}
              </ul>
            )}

            {resolved.length > 0 && (
              <div className="mt-5 border-t border-base-line pt-4">
                <h3 className="title-md">Løst siden sidst</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {resolved.map((p) => (
                    <li key={p.id}>
                      <span className="chip-brand">{p.statement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {/* --------------------------------------------------------- Signaler */}
          {signals.length > 0 && (
            <Panel as="section">
              <SectionHeader
                eyebrow="Kompetencesignaler"
                title="Hvor står de enkelte områder"
                desc="Kvalitative signaler fra samtalerne, sorteret så det der trænger mest til opmærksomhed står først. Der er ingen samlet karakter, og de bruges ikke til at sammenligne sælgere."
              />
              <ul className="grid gap-3 md:grid-cols-2">
                {signals.map(([area, s]) => (
                  <li key={area} className="panel-quiet p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="title-md">{fmt.skillAreaLabel(area)}</h3>
                      <RatingPill rating={s.level} size="sm" />
                    </div>
                    <p className="body mt-2">{s.note}</p>
                    <p className="mt-2 text-xs text-ink-mute">
                      {s.observations <= 1
                        ? "Bygger på én observation"
                        : `Bygger på ${fmt.formatNumber(s.observations)} observationer`}
                      {" · opdateret "}
                      {fmt.formatDateCompact(s.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* ------------------------------------------------------- Manual-huller */}
          {profile && profile.manualGaps.length > 0 && (
            <Panel as="section">
              <SectionHeader
                eyebrow="Salgsmanualen"
                title="Principper der ikke bliver brugt"
                desc="De steder hvor manualen findes, men ikke bliver taget i brug i samtalerne."
              />
              <ul className="space-y-3">
                {profile.manualGaps.map((g, i) => (
                  <li key={`${g.principleId}-${i}`}>
                    <article className="rounded-2xl border border-warn-600/30 bg-warn-900/25 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="title-md">{g.title}</h3>
                        <span className="font-mono text-2xs uppercase tracking-wider text-ink-mute">
                          Princip {g.principleId}
                        </span>
                      </div>
                      <p className="body mt-2">{g.note}</p>
                    </article>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* ---------------------------------------------------- Næste træning */}
          {recommended.length > 0 && (
            <Panel as="section">
              <SectionHeader
                eyebrow="Næste skridt"
                title="Anbefalet træning"
                desc="Hvad coachen vil sætte ind med — og hvad der bevidst skal presses på."
              />
              <ol className="space-y-3">
                {recommended.map((r, i) => (
                  <li key={`${r.modeId}-${i}`}>
                    <article className="panel-quiet p-4 md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="title-md">{modeLabel(r.modeId)}</h3>
                        <span className="chip">{PRIORITY_LABELS[r.priority] ?? "Senere"}</span>
                      </div>
                      <p className="body mt-2.5">{r.why}</p>
                      <dl className="mt-3 space-y-1.5 border-t border-base-line pt-3">
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="eyebrow pt-0.5">Pres på</dt>
                          <dd className="body flex-1">{r.focus}</dd>
                        </div>
                        {r.scenarioHint && (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="eyebrow pt-0.5">Scenarie</dt>
                            <dd className="body flex-1">{r.scenarioHint}</dd>
                          </div>
                        )}
                      </dl>
                    </article>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {/* ------------------------------------------------- Seneste feedback */}
          <Panel as="section">
            <SectionHeader
              eyebrow="Seneste coaching"
              title="De sidste sessioner"
              desc="Åbn en debriefing for at se hele feedbacken sælgeren selv har fået."
            />
            {orderedSessions.length === 0 ? (
              <Notice>Ingen sessioner endnu.</Notice>
            ) : (
              <ul className="space-y-2.5">
                {orderedSessions.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link to={`/debriefing/${s.id}`} className="tile !gap-0 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="title-md">{modeLabel(s.modeId)}</h3>
                          <p className="mt-0.5 text-xs text-ink-mute">
                            {fmt.formatWhen(s.startedAt)}
                            {s.scenario?.title ? ` · ${s.scenario.title}` : ""}
                            {` · ${fmt.formatDuration(s.durationSec)}`}
                          </p>
                        </div>
                        {s.feedback ? (
                          <RatingPill rating={s.feedback.overall} size="sm" />
                        ) : (
                          <span className="chip">Ikke analyseret</span>
                        )}
                      </div>
                      {s.feedback?.headline && <p className="body mt-2.5">{s.feedback.headline}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="body-mute mt-4 border-t border-base-line pt-4">
              Udskrifter af samtalerne og sælgerens eget uploadede materiale vises ikke i ledelsesoverblikket.
            </p>
          </Panel>
        </>
      )}

      {/* ---------------------------------------------------------- Ledernote */}
      <Panel as="section">
        <SectionHeader
          eyebrow="Din egen note"
          title="Det du vil coache på"
          desc="Én til to sætninger til dig selv inden næste 1:1. Noten er ledelsens og indgår ikke i coachens vurdering af sælgeren."
        />

        {saveError && <div className="mb-3"><ErrorNote>{saveError}</ErrorNote></div>}

        <Field label={`Coachingfokus for ${initials}`} htmlFor="ledernote">
          <textarea
            id="ledernote"
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Fx: Skal presses på konsekvensspørgsmål før løsningen nævnes. Tages op på mandag."
            rows={4}
          />
        </Field>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => void saveNote()}
            disabled={saving || note.trim() === savedNote.trim()}
          >
            {saving ? <Spinner size={14} /> : <Icon.Check width={15} height={15} />}
            {saving ? "Gemmer" : "Gem note"}
          </button>
          <span className="text-xs text-ink-mute">
            {note.trim() !== savedNote.trim()
              ? "Ikke gemt endnu"
              : savedAt
                ? `Gemt ${fmt.formatWhen(savedAt)}`
                : savedNote
                  ? "Gemt"
                  : "Ingen note skrevet endnu"}
          </span>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------ Mønsterkortet */

function PatternCard({ pattern, kindTone }: { pattern: DevelopmentPattern; kindTone: "brand" | "warn" }) {
  const [showAll, setShowAll] = useState(false);
  const single = pattern.occurrences <= 1;
  const evidence = showAll ? pattern.evidence : pattern.evidence.slice(0, 2);

  const frame = single
    ? "border-dashed border-base-line2 bg-base-raise"
    : kindTone === "brand"
      ? "border-brand-800/60 bg-brand-950/40"
      : "border-warn-600/30 bg-warn-900/20";

  return (
    <article className={`rounded-2xl border p-4 md:p-5 ${frame}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="title-md min-w-0 flex-1">{pattern.statement}</h3>
        <TrendTag trend={pattern.trend} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="chip">{fmt.skillAreaLabel(pattern.area)}</span>
        {single ? (
          <span className="chip">Enkeltstående observation</span>
        ) : (
          <span className="chip">Set {fmt.formatNumber(pattern.occurrences)} gange</span>
        )}
        <span className="text-xs text-ink-mute">
          {fmt.formatDateCompact(pattern.firstSeen)} – {fmt.formatDateCompact(pattern.lastSeen)}
        </span>
      </div>

      {single && (
        <p className="mt-3 rounded-xl border border-base-line bg-base/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
          Set én gang. Det er endnu ikke et mønster — tag det med som et spørgsmål i samtalen, ikke som en
          konklusion om hvordan sælgeren arbejder.
        </p>
      )}

      {evidence.length > 0 && (
        <div className="mt-3.5 border-t border-base-line/70 pt-3">
          <h4 className="eyebrow mb-2">Fra samtalerne</h4>
          <ul className="space-y-2.5">
            {evidence.map((e, i) => (
              <li key={`${e.sessionId}-${i}`}>
                <blockquote className="border-l-2 border-base-line2 pl-3 text-sm italic leading-relaxed text-ink-soft">
                  {e.quote}
                </blockquote>
                <Link
                  to={`/debriefing/${e.sessionId}`}
                  className="mt-1 inline-block pl-3 text-xs text-ink-mute underline decoration-base-line2 underline-offset-4 hover:text-ink-soft"
                >
                  {fmt.formatDateCompact(e.date)} · åbn debriefingen
                </Link>
              </li>
            ))}
          </ul>
          {pattern.evidence.length > 2 && (
            <button
              type="button"
              className="btn-ghost btn-sm mt-2 -ml-2"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
            >
              {showAll ? "Vis færre eksempler" : `Vis alle ${fmt.formatNumber(pattern.evidence.length)} eksempler`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function TrendTag({ trend }: { trend: PatternTrend }) {
  const t = fmt.trendStyle(trend);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${t.text}`}>
      <span aria-hidden="true">{t.arrow}</span>
      {t.label}
    </span>
  );
}
