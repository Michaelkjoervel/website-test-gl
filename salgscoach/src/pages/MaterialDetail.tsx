// =============================================================================
// pages/MaterialDetail · Salgsdirektørens gennemgang af materialet
// -----------------------------------------------------------------------------
// Siden skal læses som om en krævende salgsdirektør har siddet med sælgerens
// eget dokument foran sig: citater fra materialet, hvad der er galt, og —
// vigtigst — hvordan afsnittene skal skrives om.
//
// Rækkefølgen er bevidst: konklusion → hvem materialet reelt taler til →
// dimensionerne → omskrivningerne → kundens spørgsmål → næste skridt. Kritikken
// er aldrig destinationen. Omskrivningerne og næste skridt er.
//
// Den primære handling er altid inden for rækkevidde: øv præsentationen højt.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { api, buildSellerContext } from "../lib/api";
import { getDocument, getProfile, saveDocument, saveSession } from "../lib/store";
import { formatBytes, formatWhen, plural, truncate } from "../lib/format";
import { config } from "../config";
import { Icon } from "../ui/icons";
import {
  ErrorNote,
  Notice,
  Panel,
  RatingPill,
  Spinner,
  useToast,
} from "../ui/primitives";
import {
  AnalysisProgress,
  KIND_LABEL,
  belongsToSeller,
  buildMaterialSession,
  isQuotaError,
  storageErrorMessage,
} from "./Materials";
import type {
  ManualReference,
  MaterialDimension,
  MaterialFinding,
  MaterialRewrite,
  MaterialSection,
  SalesDocument,
} from "../lib/types";

/* --------------------------------------------------------- Dimensionerne */

interface DimensionMeta {
  key: MaterialDimension;
  title: string;
  lead: string;
}

/** Rækkefølgen er den samme som i types.ts — og den samme hver gang. */
const DIMENSIONS: readonly DimensionMeta[] = [
  {
    key: "svagheder",
    title: "Svagheder i materialet",
    lead: "Det der ikke holder, hvis kunden læser materialet kritisk igennem.",
  },
  {
    key: "kundevaerdi",
    title: "Kundeværdi",
    lead: "Handler materialet om kundens udbytte — eller om vores produkt?",
  },
  {
    key: "manglende-info",
    title: "Manglende information",
    lead: "Det kunden skal bruge for at kunne sige ja, og som ikke står der.",
  },
  {
    key: "antagelser",
    title: "Antagelser",
    lead: "Det materialet tager for givet uden dækning i noget kunden har sagt.",
  },
  {
    key: "argumentation",
    title: "Argumentation",
    lead: "Hænger påstand, bevis og konsekvens sammen hele vejen igennem?",
  },
  {
    key: "business-case",
    title: "Business case",
    lead: "Regnestykket: forudsætninger, tal, tidshorisont og troværdighed.",
  },
  {
    key: "differentiering",
    title: "Differentiering",
    lead: "Hvad kan green light, som de andre ikke kan — og står det der?",
  },
  {
    key: "beslutningsstoette",
    title: "Beslutningsstøtte",
    lead: "Gør materialet det nemt at træffe beslutningen, også for dem der ikke var med til mødet?",
  },
  {
    key: "naeste-skridt",
    title: "Næste skridt i materialet",
    lead: "Er der et konkret næste skridt, eller slutter materialet i luften?",
  },
  {
    key: "praesentationskvalitet",
    title: "Præsentationskvalitet",
    lead: "Struktur, sprog og rækkefølge — hvad ser kunden først?",
  },
  {
    key: "forbedringer",
    title: "Forbedringer",
    lead: "Det der løfter materialet mest med mindst arbejde.",
  },
];

const APPLIED_STYLE: Record<ManualReference["applied"], { label: string; chip: string }> = {
  ja: { label: "Fulgt", chip: "chip-brand" },
  delvist: { label: "Delvist fulgt", chip: "chip-warn" },
  nej: { label: "Ikke fulgt", chip: "chip-danger" },
};

/* ------------------------------------------------------------- Hjælpere */

/** Den udtrukne tekst som en data-URL, så en ny analyse kan køre uden filen. */
function textToDataUrl(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:text/plain;base64,${btoa(binary)}`;
}

/* ----------------------------------------------------------------- Siden */

export function MaterialDetail() {
  const { documentId } = useParams<{ documentId: string }>();
  const { seller } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [doc, setDoc] = useState<SalesDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rerunOpen, setRerunOpen] = useState(false);
  const [context, setContext] = useState("");
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const rewritesRef = useRef<HTMLElement>(null);

  /* ---------------------------------------------------------- Indlæsning */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const found = await getDocument(documentId ?? "");
      setDoc(found ?? null);
      setContext(found?.customerContext ?? "");
    } catch (err) {
      setDoc(null);
      setLoadError(
        (err as Error)?.message
          ? `Materialet kunne ikke hentes: ${(err as Error).message}`
          : "Materialet kunne ikke hentes. Prøv at genindlæse siden.",
      );
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* -------------------------------------------------------- Kopiér tekst */

  const copy = useCallback(
    async (text: string, key: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        toast("Teksten er kopieret.");
        window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2200);
      } catch {
        toast("Teksten kunne ikke kopieres. Markér den, og kopiér manuelt.", "fejl");
      }
    },
    [toast],
  );

  /* ------------------------------------------------------------- Øvelser */

  const startSession = useCallback(
    async (modeId: "materialepraesentation" | "fri-coaching") => {
      if (!doc || !seller) return;
      setStarting(true);
      const session = buildMaterialSession({ doc, seller, modeId });
      try {
        await saveSession(session);
        navigate(`/session/${session.id}`);
      } catch (err) {
        setStarting(false);
        toast(storageErrorMessage(err, "øvelsen"), "fejl");
      }
    },
    [doc, navigate, seller, toast],
  );

  /* --------------------------------------------------------- Ny analyse */

  const rerun = useCallback(async () => {
    if (!doc || !seller) return;
    const text = (doc.extractedText ?? "").trim();
    if (!text) {
      setRerunError(
        "Der er ingen udtrukket tekst at analysere igen. Upload materialet forfra på materialesiden.",
      );
      return;
    }

    setRerunError(null);
    setRerunning(true);
    try {
      type Profile = Awaited<ReturnType<typeof getProfile>>;
      let profile: Profile | null = null;
      try {
        profile = (await getProfile(seller.id)) ?? null;
      } catch {
        profile = null;
      }

      const result = await api.analyseMaterial({
        // Filen findes ikke længere — og skal ikke findes. Den nye analyse
        // kører på den tekst vi allerede har udtrukket.
        file: { name: `${doc.name} (udtrukket tekst).txt`, dataUrl: textToDataUrl(text) },
        customerContext: context.trim(),
        sellerContext: buildSellerContext(seller, profile),
        language: config.defaultLanguage,
        text,
      });

      const updated: SalesDocument = {
        ...doc,
        customerContext: context.trim() || undefined,
        extractedText: result.extractedText || doc.extractedText,
        pages: result.pages ?? doc.pages,
        analysis: result.analysis,
      };

      // Lageret kan afkorte den udtrukne tekst for at spare plads — vis det
      // der faktisk blev gemt, ikke det vi håbede at gemme.
      const saved = await saveDocument(updated);
      setDoc(saved ?? updated);
      setRerunOpen(false);
      toast("Analysen er kørt igen.");
    } catch (err) {
      setRerunError(
        isQuotaError(err)
          ? storageErrorMessage(err, "analyser")
          : (err as Error)?.message ||
              "Analysen kunne ikke køres. Tjek din forbindelse, og prøv igen.",
      );
    } finally {
      setRerunning(false);
    }
  }, [context, doc, seller, toast]);

  /* ----------------------------------------------------- Afledte værdier */

  const analysis = doc?.analysis;

  const blocks = useMemo(() => {
    const sections = analysis?.sections ?? [];
    const byKey = new Map<string, MaterialSection>();
    for (const s of sections) byKey.set(s.key, s);

    const known = DIMENSIONS.flatMap((meta) => {
      const section = byKey.get(meta.key);
      return section ? [{ meta, section }] : [];
    });

    // Dimensioner serveren måtte finde på ud over dem vi kender — de skal
    // stadig vises, bare til sidst.
    const extra = sections
      .filter((s) => !DIMENSIONS.some((d) => d.key === s.key))
      .map((s) => ({
        meta: { key: s.key, title: s.title || "Øvrige observationer", lead: "" },
        section: s,
      }));

    return [...known, ...extra];
  }, [analysis]);

  /* ------------------------------------------------------------- Visning */

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-1 py-10 text-sm text-ink-mute">
        <Spinner /> Henter materialet …
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorNote onRetry={() => void load()}>{loadError}</ErrorNote>
      </div>
    );
  }

  if (!doc || !seller || !belongsToSeller(doc, seller)) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Notice>
          Materialet findes ikke — eller det tilhører en anden sælger. Du kan kun se dit eget
          materiale.
        </Notice>
      </div>
    );
  }

  const pages = doc.pages ? plural(doc.pages, "side", "sider") : null;
  const extracted = (doc.extractedText ?? "").trim();

  return (
    <div className="space-y-8 animate-fade-up pb-2">
      <BackLink />

      {/* ------------------------------------------------------------ Hoved */}
      <header className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
            <span className="chip">{KIND_LABEL[doc.kind]}</span>
            {pages && <span>{pages}</span>}
            {pages && <span aria-hidden="true">·</span>}
            <span>{formatBytes(doc.sizeBytes)}</span>
            <span aria-hidden="true">·</span>
            <span>Uploadet {formatWhen(doc.uploadedAt)}</span>
          </div>
          <h1 className="title-xl break-words">{doc.name}</h1>
        </div>

        {analysis ? (
          <Panel className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <RatingPill rating={analysis.overall} />
              <span className="eyebrow">Salgsdirektørens samlede vurdering</span>
            </div>

            <p className="text-lg font-semibold leading-snug text-ink md:text-2xl">
              {analysis.headline}
            </p>

            {analysis.readsAsWrittenFor && (
              <div className="rounded-xl border border-warn-600/40 bg-warn-900/40 p-4">
                <div className="eyebrow text-warn-300">Sådan læses materialet, som det står nu</div>
                <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-warn-300">
                  {analysis.readsAsWrittenFor}
                </p>
              </div>
            )}

            {doc.customerContext && (
              <div className="panel-inset p-4">
                <div className="eyebrow">Din kundekontekst</div>
                <p className="body mt-1.5">{doc.customerContext}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {(analysis.rewrites ?? []).length > 0 && (
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() =>
                    rewritesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  <Icon.Arrow width={15} height={15} />
                  Gå til omskrivningerne
                </button>
              )}
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setRerunError(null);
                  setRerunOpen((v) => !v);
                }}
                aria-expanded={rerunOpen}
                aria-controls="ny-analyse"
              >
                <Icon.Repeat width={15} height={15} />
                Kør analysen igen
              </button>
              <span className="text-xs text-ink-mute">
                Analyseret {formatWhen(analysis.generatedAt)}
              </span>
            </div>
          </Panel>
        ) : (
          <Notice tone="warn">
            Der ligger ingen analyse på materialet endnu. Kør analysen på den udtrukne tekst
            herunder — du behøver ikke uploade filen igen.
          </Notice>
        )}
      </header>

      {/* ------------------------------------------------------- Ny analyse */}
      {(rerunOpen || !analysis) && (
        <section id="ny-analyse">
          <Panel>
            <h2 className="title-md">Kør analysen igen</h2>
            <p className="body mt-1.5 max-w-2xl">
              Analysen køres på den tekst der allerede er udtrukket af materialet. Skriv hvad du
              ved om kunden nu — det er dét, der gør vurderingen konkret frem for generel.
            </p>

            {rerunning ? (
              <div className="mt-4">
                <AnalysisProgress fileName={doc.name} running />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="label block" htmlFor="ny-kundekontekst">
                    Hvem er materialet til, og hvad ved du om deres situation?
                  </label>
                  <textarea
                    id="ny-kundekontekst"
                    className="textarea"
                    rows={4}
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Fx: Driftschef i en produktionsvirksomhed. To haller står med gamle armaturer, og der er sat penge af til vedligehold, men ikke til investering."
                  />
                </div>

                {rerunError && <ErrorNote>{rerunError}</ErrorNote>}

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-primary" onClick={() => void rerun()}>
                    <Icon.Repeat width={16} height={16} />
                    Kør analysen igen
                  </button>
                  {analysis && (
                    <button type="button" className="btn-ghost" onClick={() => setRerunOpen(false)}>
                      Luk
                    </button>
                  )}
                </div>
              </div>
            )}
          </Panel>
        </section>
      )}

      {analysis && (
        <>
          {/* ------------------------------------------------- Dimensionerne */}
          {blocks.length > 0 && (
            <section className="space-y-4">
              <h2 className="title-lg">Gennemgangen</h2>
              <div className="space-y-4">
                {blocks.map(({ meta, section }, i) => (
                  <DimensionBlock key={`${section.key}-${i}`} index={i + 1} meta={meta} section={section} />
                ))}
              </div>
            </section>
          )}

          {/* ------------------------------------------------ Omskrivningerne */}
          <section ref={rewritesRef} className="space-y-4">
            <div>
              <h2 className="title-lg">Omskrivninger</h2>
              <p className="body mt-1.5 max-w-2xl">
                Det er ikke nok at vide hvad der er galt. Her står dit eget afsnit ved siden af
                salgsdirektørens udgave — tag den, ret den til med kundens ord, og send materialet
                videre.
              </p>
            </div>

            {(analysis.rewrites ?? []).length === 0 ? (
              <Notice>
                Der er ingen omskrivninger til dette materiale. Kør analysen igen med kundekontekst,
                hvis du vil have konkrete forslag til formuleringer.
              </Notice>
            ) : (
              <div className="space-y-4">
                {(analysis.rewrites ?? []).map((rw, i) => (
                  <RewriteCard
                    key={`${rw.where}-${i}`}
                    rewrite={rw}
                    copied={copied === `rw-${i}`}
                    onCopy={() => void copy(rw.after, `rw-${i}`)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ------------------------------------------------ Kundens reaktion */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ListPanel
              title="Det kunden med sikkerhed spørger om"
              lead="Har du ikke et svar klar på hvert enkelt, er materialet ikke færdigt."
              items={analysis.customerWillAsk ?? []}
              empty="Ingen spørgsmål udpeget."
              marker="?"
              tone="client"
            />
            <ListPanel
              title="Det der mangler, før kunden kan sælge det internt"
              lead="Din kontaktperson skal kunne forsvare beslutningen i et lokale, du ikke er i."
              items={analysis.internalSellingGaps ?? []}
              empty="Ingen huller udpeget."
              marker="–"
              tone="warn"
            />
          </div>

          {/* ----------------------------------------------------- Næste skridt */}
          {(analysis.nextStep ?? []).length > 0 && (
            <Panel as="section" className="border-brand-800 bg-brand-950/40">
              <h2 className="title-lg">Næste skridt</h2>
              <p className="body mt-1.5 max-w-2xl">
                Gør det her, inden materialet går videre til kunden.
              </p>
              <ol className="mt-4 space-y-3">
                {(analysis.nextStep ?? []).map((step, i) => (
                  <li key={`${step}-${i}`} className="flex gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-brand-700 bg-brand-950 text-xs font-bold text-brand-300">
                      {i + 1}
                    </span>
                    <span className="text-[15px] leading-relaxed text-ink">{step}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {/* ------------------------------------------------------- Manualen */}
          {(analysis.manualReferences ?? []).length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="title-lg">Manualen om det her</h2>
                <p className="body mt-1.5 max-w-2xl">
                  De principper fra green lights salgsmanual der gælder for netop dette materiale —
                  og om materialet lever op til dem.
                </p>
              </div>
              <ul className="space-y-3">
                {(analysis.manualReferences ?? []).map((ref, i) => (
                  <li key={`${ref.id}-${i}`}>
                    <ManualRefRow reference={ref} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* --------------------------------------------------- Udtrukket tekst */}
      <section className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-base-line bg-base-panel px-5 py-4 text-left transition-colors hover:border-base-line2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          onClick={() => setShowText((v) => !v)}
          aria-expanded={showText}
          aria-controls="udtrukket-tekst"
        >
          <span className="min-w-0">
            <span className="title-md block">Udtrukket tekst</span>
            <span className="body-mute mt-0.5 block">
              Det AI'en faktisk læste. Tjek at det er det rigtige dokument — og at teksten kom med.
              {extracted ? ` ${plural(extracted.length, "tegn", "tegn")}.` : ""}
            </span>
          </span>
          <span className="shrink-0 text-ink-mute">
            <Icon.Arrow
              width={18}
              height={18}
              className={`transition-transform ${showText ? "rotate-90" : ""}`}
            />
          </span>
        </button>

        {showText && (
          <div id="udtrukket-tekst" className="panel p-5">
            {extracted ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="eyebrow">{truncate(doc.name, 60)}</span>
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={() => void copy(extracted, "extracted")}
                  >
                    {copied === "extracted" ? (
                      <Icon.Check width={14} height={14} />
                    ) : (
                      <Icon.Doc width={14} height={14} />
                    )}
                    {copied === "extracted" ? "Kopieret" : "Kopiér teksten"}
                  </button>
                </div>
                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-base-line bg-base/60 p-4 font-mono text-xs leading-relaxed text-ink-soft">
                  {extracted}
                </pre>
              </>
            ) : (
              <Notice tone="warn">
                Der blev ikke udtrukket nogen tekst af materialet. Er PDF'en scannet ind som
                billeder, kan den ikke læses — eksportér dokumentet på ny fra det program det er
                lavet i, og upload det igen.
              </Notice>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------- Primær handling */}
      <div className="pad-b-safe sticky bottom-0 z-20 -mx-5 border-t border-base-line bg-base/90 px-5 pt-3 backdrop-blur md:-mx-10 md:px-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="btn-primary btn-lg"
            onClick={() => void startSession("materialepraesentation")}
            disabled={starting}
          >
            {starting ? <Spinner size={16} /> : <Icon.Mic width={18} height={18} />}
            Øv præsentationen
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => void startSession("fri-coaching")}
            disabled={starting}
          >
            <Icon.Handshake width={16} height={16} />
            Tal med salgsdirektøren om materialet
          </button>
          <p className="body-mute sm:ml-1">
            AI'en spiller kunden, får materialet med — og udfordrer din præsentation.
          </p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Delene */

function BackLink() {
  const navigate = useNavigate();
  return (
    <button type="button" className="btn-ghost btn-sm -ml-2" onClick={() => navigate("/materiale")}>
      <Icon.Back width={16} height={16} />
      Alle materialer
    </button>
  );
}

function DimensionBlock({
  index,
  meta,
  section,
}: {
  index: number;
  meta: DimensionMeta;
  section: MaterialSection;
}) {
  const findings = section.findings ?? [];
  return (
    <Panel as="section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow mb-1">Del {index}</div>
          <h3 className="title-lg">{section.title || meta.title}</h3>
          {meta.lead && <p className="body mt-1.5 max-w-2xl">{meta.lead}</p>}
        </div>
        <RatingPill rating={section.verdict} size="sm" />
      </div>

      {findings.length === 0 ? (
        <p className="body-mute mt-4">
          Ingen bemærkninger på dette punkt. Vurderingen står stadig ved magt.
        </p>
      ) : (
        <ol className="mt-5 space-y-4">
          {findings.map((f, i) => (
            <li key={`${f.where}-${i}`}>
              <FindingCard finding={f} />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function FindingCard({ finding }: { finding: MaterialFinding }) {
  return (
    <div className="rounded-xl border border-base-line bg-base-raise p-4">
      {finding.where && (
        <div className="mb-2">
          <span className="chip font-mono text-2xs">{finding.where}</span>
        </div>
      )}

      {finding.quote && (
        <blockquote className="border-l-2 border-base-line2 pl-3.5">
          <p className="text-sm italic leading-relaxed text-ink-soft">
            <span aria-hidden="true">»</span>
            {finding.quote}
            <span aria-hidden="true">«</span>
          </p>
        </blockquote>
      )}

      <p className={`text-[15px] leading-relaxed text-ink ${finding.quote ? "mt-3" : ""}`}>
        {finding.finding}
      </p>

      {finding.soWhat && (
        <div className="mt-3 rounded-lg border-l-2 border-brand-600 bg-brand-950/60 py-2.5 pl-3.5 pr-3">
          <div className="eyebrow text-brand-400">Hvad det koster dig</div>
          <p className="mt-1 text-sm leading-relaxed text-brand-100">{finding.soWhat}</p>
        </div>
      )}
    </div>
  );
}

function RewriteCard({
  rewrite,
  copied,
  onCopy,
}: {
  rewrite: MaterialRewrite;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Panel as="article">
      {rewrite.where && <h3 className="title-md">{rewrite.where}</h3>}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {/* Før */}
        <div className="flex flex-col rounded-xl border border-base-line bg-base-raise p-4">
          <div className="eyebrow mb-2">Sådan står der nu</div>
          <blockquote className="flex-1 border-l-2 border-base-line2 pl-3.5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {rewrite.before}
            </p>
          </blockquote>
        </div>

        {/* Efter */}
        <div className="flex flex-col rounded-xl border border-brand-800 bg-brand-950/50 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="eyebrow text-brand-400">Skriv det sådan i stedet</div>
            <button
              type="button"
              className="btn-outline btn-sm border-brand-800 bg-transparent text-brand-300 hover:border-brand-600"
              onClick={onCopy}
            >
              {copied ? <Icon.Check width={14} height={14} /> : <Icon.Doc width={14} height={14} />}
              {copied ? "Kopieret" : "Kopiér"}
            </button>
          </div>
          <p className="flex-1 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-ink">
            {rewrite.after}
          </p>
        </div>
      </div>

      {rewrite.why && (
        <div className="mt-3 flex gap-2.5 rounded-xl border border-base-line bg-base-panel2 px-4 py-3">
          <Icon.Spark className="mt-0.5 shrink-0 text-ink-mute" width={16} height={16} />
          <p className="body">{rewrite.why}</p>
        </div>
      )}
    </Panel>
  );
}

function ListPanel({
  title,
  lead,
  items,
  empty,
  marker,
  tone,
}: {
  title: string;
  lead: string;
  items: string[];
  empty: string;
  marker: string;
  tone: "client" | "warn";
}) {
  const markerCls =
    tone === "client"
      ? "border-client-600/40 bg-client-900 text-client-300"
      : "border-warn-600/40 bg-warn-900 text-warn-300";

  return (
    <Panel as="section" className="h-full">
      <h2 className="title-md">{title}</h2>
      <p className="body-mute mt-1.5">{lead}</p>

      {items.length === 0 ? (
        <p className="body-mute mt-4">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-xs font-bold ${markerCls}`}
              >
                {marker}
              </span>
              <span className="text-[15px] leading-relaxed text-ink-soft">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ManualRefRow({ reference }: { reference: ManualReference }) {
  const style = APPLIED_STYLE[reference.applied] ?? APPLIED_STYLE.delvist;
  const IconFor =
    reference.applied === "ja" ? Icon.Check : reference.applied === "nej" ? Icon.X : Icon.Warn;

  return (
    <div className="panel-quiet p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon.Book className="mt-0.5 shrink-0 text-ink-mute" width={17} height={17} />
          <h3 className="title-md">{reference.title}</h3>
        </div>
        <span className={style.chip}>
          <IconFor width={13} height={13} />
          {style.label}
        </span>
      </div>
      <p className="body mt-2">{reference.relevance}</p>
    </div>
  );
}
