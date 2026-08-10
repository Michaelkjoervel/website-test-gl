// =============================================================================
// pages/ManualLibrary · green lights salgsmanual som opslagsværk
// -----------------------------------------------------------------------------
// VIGTIG PRÆMIS: browseren får kun manifestet — kapitler, principtitler,
// kategorier, træningsformer og checklister. Selve manualteksten forlader
// aldrig green lights server; den bruges af coachen under træningen.
//
// Derfor er denne skærm bygget som en NAVIGATOR, ikke som en læser. Man kan
// ikke læse princippet her — man kan finde det, og gå direkte ind i den øvelse
// hvor det hører hjemme, eller spørge salgsdirektøren om det.
//
// Checklisterne er den ene undtagelse: deres punkter ER i manifestet, og de er
// designet til at blive åbnet på en telefon lige før et møde.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "../lib/api";
import type { ManualChecklistRef, ManualManifest, ManualPrincipleRef } from "../lib/api";
import { plural } from "../lib/format";
import { ErrorNote, Notice, Panel, SectionHeader, Spinner } from "../ui/primitives";
import { Icon } from "../ui/icons";
import type { TrainingModeId } from "../lib/types";

/* -------------------------------------------------------------------------- */
/* Etiketter                                                                   */
/* -------------------------------------------------------------------------- */

const CATEGORY_LABEL: Record<string, string> = {
  filosofi: "Filosofi",
  metode: "Metode",
  kvalificering: "Kvalificering",
  spoergeteknik: "Spørgeteknik",
  moedestruktur: "Mødestruktur",
  opportunity: "Opportunity",
  kundetilgang: "Kundetilgang",
  opfoelgning: "Opfølgning",
  forhandling: "Forhandling",
  adfaerd: "Adfærd",
  terminologi: "Terminologi",
  faldgruber: "Faldgruber",
  indvendinger: "Indvendinger",
};

/** Manifestet kan indeholde kategorier der ikke er i typen endnu — vis dem pænt. */
function categoryLabel(value: string): string {
  const known = CATEGORY_LABEL[value];
  if (known) return known;
  const pretty = String(value).replace(/-/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

const MODE_FALLBACK_TITLE: Record<TrainingModeId, string> = {
  kunderollespil: "Kunderollespil",
  afdaekning: "Behovsafdækning",
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

/** Tåler æ/ø/å skrevet som ae/oe/aa, så søgning ikke kræver præcis stavning. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* -------------------------------------------------------------------------- */
/* Skærmen                                                                     */
/* -------------------------------------------------------------------------- */

type View = "principper" | "checklister";

export function ManualLibrary() {
  const location = useLocation();
  const incoming = (location.state ?? null) as {
    focusPrincipleId?: string;
    focusTitle?: string;
  } | null;

  const [manual, setManual] = useState<ManualManifest | null>(null);
  const [modeTitles, setModeTitles] = useState<Partial<Record<TrainingModeId, string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [view, setView] = useState<View>("principper");
  const [query, setQuery] = useState(incoming?.focusTitle ?? "");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const manifest = await api.getManifest();
        if (!alive) return;
        setManual(manifest?.manual ?? null);
        const map: Partial<Record<TrainingModeId, string>> = {};
        for (const m of manifest?.modes ?? []) if (m?.id && m.title) map[m.id] = m.title;
        setModeTitles(map);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Manualens indeks kunne ikke hentes.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [attempt]);

  const modeTitle = useCallback(
    (id: TrainingModeId): string => modeTitles[id] ?? MODE_FALLBACK_TITLE[id] ?? id,
    [modeTitles],
  );

  const chapters = useMemo(
    () => [...(manual?.chapters ?? [])].sort((a, b) => a.no - b.no),
    [manual],
  );
  const principles = useMemo(() => manual?.principles ?? [], [manual]);
  const checklists = useMemo(() => manual?.checklists ?? [], [manual]);
  const meta = manual?.meta;

  /* --------------------------------------------------------- Filtrering */

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const p of principles) if (p.category) seen.add(String(p.category));
    return [...seen].map(categoryLabel).sort((a, b) => a.localeCompare(b, "da-DK"));
  }, [principles]);

  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    const chapterTitle = new Map(chapters.map((c) => [c.no, c.title]));
    return principles.filter((p) => {
      if (category && categoryLabel(String(p.category)) !== category) return false;
      if (!needle) return true;
      const hay = fold(
        `${p.title} ${chapterTitle.get(p.chapter ?? -1) ?? ""} ${categoryLabel(String(p.category))}`,
      );
      return hay.includes(needle);
    });
  }, [principles, chapters, query, category]);

  const isFiltering = Boolean(query.trim() || category);

  /**
   * Kapitelnummeret er valgfrit i manifestet. Et princip uden et kendt kapitel
   * må ikke forsvinde ud af indekset — det havner i "Øvrige principper".
   */
  const grouped = useMemo(() => {
    const known = new Set(chapters.map((c) => c.no));
    const map = new Map<number, ManualPrincipleRef[]>();
    const loose: ManualPrincipleRef[] = [];
    for (const p of filtered) {
      const no = typeof p.chapter === "number" && known.has(p.chapter) ? p.chapter : null;
      if (no === null) {
        loose.push(p);
        continue;
      }
      const list = map.get(no) ?? [];
      list.push(p);
      map.set(no, list);
    }
    return { map, loose };
  }, [filtered, chapters]);

  const visibleChapters = useMemo(
    () =>
      isFiltering ? chapters.filter((c) => (grouped.map.get(c.no)?.length ?? 0) > 0) : chapters,
    [chapters, grouped, isFiltering],
  );

  /* ------------------------------------------------------------- Render */

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20 text-ink-mute">
        <Spinner /> Henter manualens indeks…
      </div>
    );
  }

  // Uden indeks har siden intet at navigere i. Så siger vi det — frem for at
  // vise en tom manual, der ligner en manual uden indhold.
  if (!manual) {
    return (
      <div className="space-y-6 pb-8">
        <header>
          <div className="eyebrow">green light · intern metodik</div>
          <h1 className="title-xl mt-1.5">Salgsmanualen</h1>
        </header>
        {error ? (
          <ErrorNote onRetry={() => setAttempt((n) => n + 1)}>
            {error} Indekset er ikke indlæst.
          </ErrorNote>
        ) : (
          <Notice>
            Manualens indeks er tomt lige nu. Selve manualteksten ligger på green lights server —
            den vises aldrig her — men kapitler og principtitler burde være tilgængelige. Prøv igen
            om lidt.
          </Notice>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* ------------------------------------------------------- Overskrift */}
      <header>
        <div className="eyebrow">green light · intern metodik</div>
        <h1 className="title-xl mt-1.5">Salgsmanualen</h1>
        <p className="body mt-2 max-w-2xl">
          {meta?.subtitle ?? "B2B belysningsløsninger direkte til slutbrugeren"}
          {meta?.version ? ` · ${meta.version}` : ""} ·{" "}
          {plural(meta?.chapters ?? chapters.length, "kapitel", "kapitler")} ·{" "}
          {plural(principles.length, "princip", "principper")}
        </p>
      </header>

      {error && (
        <ErrorNote onRetry={() => setAttempt((n) => n + 1)}>
          {error} Indekset er ikke indlæst.
        </ErrorNote>
      )}

      {/* ------------------------------------------------------- Konklusionen */}
      {meta?.northStar && (
        <Panel className="border-brand-800 bg-brand-950/40">
          <div className="eyebrow">Manualens egen konklusion</div>
          <blockquote className="mt-2.5 text-lg font-semibold leading-snug text-ink md:text-2xl md:leading-snug">
            <span aria-hidden="true">»</span>
            {meta.northStar}
            <span aria-hidden="true">«</span>
          </blockquote>
          <p className="body-mute mt-3">
            Alt andet i manualen hænger på den sætning. Kan du ikke sige den i et møde og mene den,
            er resten teknik uden retning.
          </p>
        </Panel>
      )}

      {/* --------------------------------------------------------- Ærlig linje */}
      <Notice>
        Manualens fulde tekst ligger på green lights server og bliver aldrig sendt til browseren.
        Det er ikke en fejl eller en mangel — teksten er green lights egen metodik, og den bruges af
        salgsdirektøren, mens du træner. Det, du ser her, er indekset: kapitler, principper og
        checklister — og den korteste vej ind i den øvelse, hvor princippet faktisk bliver brugt.
      </Notice>

      {/* ------------------------------------------------------------ Visning */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-base-line bg-base-raise p-1">
          <ViewButton active={view === "principper"} onClick={() => setView("principper")}>
            <Icon.Book width={16} height={16} />
            Principper
          </ViewButton>
          <ViewButton active={view === "checklister"} onClick={() => setView("checklister")}>
            <Icon.Check width={16} height={16} />
            Checklister
          </ViewButton>
        </div>
        {view === "principper" && (
          <span className="text-xs text-ink-mute">
            Checklisterne er lavet til at blive åbnet på telefonen lige før et møde.
          </span>
        )}
      </div>

      {view === "principper" ? (
        <section>
          <SectionHeader
            eyebrow={`${plural(principles.length, "princip", "principper")} · ${plural(chapters.length, "kapitel", "kapitler")}`}
            title="Principper"
            desc="Find princippet, og gå direkte ind i den træning, hvor det hører hjemme. Vil du have det forklaret, tager salgsdirektøren det i en fri coaching-samtale."
          />

          {/* ------------------------------------------------------ Søgning */}
          <div className="mb-6 space-y-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
                <Icon.Search width={17} height={17} />
              </span>
              <label htmlFor="manual-soeg" className="sr-only">
                Søg i manualens principper
              </label>
              <input
                id="manual-soeg"
                type="search"
                className="input pl-11"
                placeholder="Søg i principtitler og kapitler"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {categoryOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow mr-1">Kategori</span>
                <div className="flex flex-wrap gap-1.5">
                  {categoryOptions.map((c) => {
                    const on = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        data-on={on}
                        aria-pressed={on}
                        className="chip-select"
                        onClick={() => setCategory(on ? undefined : c)}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isFiltering && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-ink-mute">
                  {plural(filtered.length, "princip", "principper")} matcher
                </span>
                <button
                  type="button"
                  className="btn-ghost btn-sm -ml-1"
                  onClick={() => {
                    setQuery("");
                    setCategory(undefined);
                  }}
                >
                  <Icon.X width={14} height={14} />
                  Ryd søgning
                </button>
              </div>
            )}
          </div>

          {/* ----------------------------------------------------- Kapitler */}
          {visibleChapters.length === 0 && grouped.loose.length === 0 ? (
            <Notice>
              Ingen principper matcher søgningen. Prøv et bredere ord — indekset indeholder kun
              titler, ikke manualens tekst, så et enkelt nøgleord rammer bedre end en sætning.
            </Notice>
          ) : (
            <div className="space-y-4">
              {visibleChapters.map((ch) => {
                const list = grouped.map.get(ch.no) ?? [];
                return (
                  <Panel key={ch.id} as="section" className="p-4 md:p-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-xs text-ink-faint" aria-hidden="true">
                        {String(ch.no).padStart(2, "0")}
                      </span>
                      <h3 className="title-md min-w-0">
                        <span className="sr-only">{`Kapitel ${ch.no}: `}</span>
                        {ch.title}
                      </h3>
                      <span className="ml-auto shrink-0 text-xs text-ink-mute">
                        {plural(list.length, "princip", "principper")}
                      </span>
                    </div>

                    {list.length === 0 ? (
                      <p className="body-mute mt-3">
                        Kapitlet har ingen selvstændige principper i indekset. Indholdet — scripts og
                        ordrette formuleringer — ligger på serveren og bruges direkte af coachen
                        under træningen.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-base-line">
                        {list.map((p) => (
                          <li key={p.id}>
                            <PrincipleRow
                              principle={p}
                              modeTitle={modeTitle}
                              highlighted={incoming?.focusPrincipleId === p.id}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                );
              })}

              {grouped.loose.length > 0 && (
                <Panel as="section" className="p-4 md:p-5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="title-md min-w-0">Øvrige principper</h3>
                    <span className="ml-auto shrink-0 text-xs text-ink-mute">
                      {plural(grouped.loose.length, "princip", "principper")}
                    </span>
                  </div>
                  <p className="body-mute mt-1">
                    Principper uden et kapitelnummer i indekset. De virker præcis som de øvrige.
                  </p>
                  <ul className="mt-3 divide-y divide-base-line">
                    {grouped.loose.map((p) => (
                      <li key={p.id}>
                        <PrincipleRow
                          principle={p}
                          modeTitle={modeTitle}
                          highlighted={incoming?.focusPrincipleId === p.id}
                        />
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          )}
        </section>
      ) : (
        <section>
          <SectionHeader
            eyebrow="Kapitel 20"
            title="Checklister"
            desc="Tre lister fra manualen. De er lavet til at blive åbnet lige før — ikke læst bagefter. Punkterne krydses af lokalt og gemmes ikke."
          />
          <Notice>
            Et nej på en af listerne er ikke en detalje, man kører videre henover. Det er stedet,
            hvor arbejdet mangler.
          </Notice>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {checklists.map((c) => (
              <ChecklistCard
                key={c.id}
                list={c}
                ticked={ticked}
                onToggle={(key) => setTicked((s) => ({ ...s, [key]: !s[key] }))}
                onReset={() =>
                  setTicked((s) => {
                    const next = { ...s };
                    for (const k of Object.keys(next)) if (k.startsWith(`${c.id}:`)) delete next[k];
                    return next;
                  })
                }
              />
            ))}
          </div>
          {checklists.length === 0 && <Notice>Der er ingen checklister i indekset lige nu.</Notice>}
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Delkomponenter                                                              */
/* -------------------------------------------------------------------------- */

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`btn btn-sm px-3.5 py-2 ${
        active ? "bg-base-panel2 text-ink ring-1 ring-inset ring-brand-800" : "text-ink-mute hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function PrincipleRow({
  principle,
  modeTitle,
  highlighted,
}: {
  principle: ManualPrincipleRef;
  modeTitle: (id: TrainingModeId) => string;
  highlighted: boolean;
}) {
  const modes = principle.modes ?? [];
  const primary = modes[0];
  const others = modes.slice(1);

  return (
    <div className={`py-4 ${highlighted ? "-mx-2 rounded-xl bg-brand-950/50 px-2 ring-1 ring-inset ring-brand-800" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h4 className="min-w-0 text-[15px] font-semibold leading-snug text-ink">
          {principle.title}
        </h4>
        <span className="chip shrink-0">{categoryLabel(String(principle.category))}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {primary ? (
          <Link
            to={`/traening/${primary}`}
            className="btn-primary btn-sm"
            aria-label={`Træn "${principle.title}" i ${modeTitle(primary)}`}
          >
            Træn det her
            <Icon.Arrow width={15} height={15} />
          </Link>
        ) : (
          <span className="text-xs text-ink-mute">
            Princippet hører ikke til én bestemt øvelse — tag det i fri coaching.
          </span>
        )}
        <Link
          to="/traening/fri-coaching"
          state={{
            topic: principle.title,
            principleId: principle.id,
            principleTitle: principle.title,
          }}
          className="btn-outline btn-sm"
          aria-label={`Spørg salgsdirektøren om "${principle.title}"`}
        >
          <Icon.Mic width={15} height={15} />
          Spørg salgsdirektøren om det
        </Link>
      </div>

      {primary && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-mute">
          <span>Træningsform: {modeTitle(primary)}</span>
          {others.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>Indgår også i</span>
              {others.map((m) => (
                <Link
                  key={m}
                  to={`/traening/${m}`}
                  className="chip-select"
                  aria-label={`Træn "${principle.title}" i ${modeTitle(m)}`}
                >
                  {modeTitle(m)}
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistCard({
  list,
  ticked,
  onToggle,
  onReset,
}: {
  list: ManualChecklistRef;
  ticked: Record<string, boolean>;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const anyTicked = list.items.some((_, i) => ticked[`${list.id}:${i}`]);

  return (
    <Panel as="section" className="flex flex-col p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="title-md min-w-0">{list.title}</h3>
        {anyTicked && (
          <button type="button" className="btn-ghost btn-sm -mr-2 shrink-0" onClick={onReset}>
            Ryd
          </button>
        )}
      </div>

      <ul className="mt-2 divide-y divide-base-line">
        {list.items.map((item, i) => {
          const key = `${list.id}:${i}`;
          const on = Boolean(ticked[key]);
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 py-3.5">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(key)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border border-base-line2 bg-base accent-brand-500"
                />
                <span
                  className={`text-[15px] leading-snug ${
                    on ? "text-ink-mute line-through" : "text-ink"
                  }`}
                >
                  {item}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {list.ifNo && (
        <p className="mt-4 border-t border-base-line pt-4 text-sm leading-relaxed text-ink-soft">
          Er svaret nej: {list.ifNo}
        </p>
      )}
    </Panel>
  );
}
