// =============================================================================
// pages/Materials · Sælgerens eget salgsmateriale
// -----------------------------------------------------------------------------
// Her uploader sælgeren det materiale der faktisk ligger hos kunden: tilbuddet,
// præsentationen, beregningen, business casen. Salgsdirektøren læser det
// igennem — og bagefter kan sælgeren øve præsentationen af det højt.
//
// TO FASTE REGLER I DENNE FIL:
//
//   1. PRIVATLIV. Et materiale hører til én sælger. Listen viser kun den
//      indloggede sælgers egne dokumenter, og der findes ingen vej til andres.
//
//   2. FILEN GEMMES ALDRIG. Base64-udgaven af filen lever i én lokal variabel,
//      lige længe nok til at blive sendt til serveren — den kommer hverken i
//      React-state eller i localStorage. Kun den udtrukne tekst og analysen
//      gemmes. Rå filer sprænger lageret, og de skal ikke ligge i en browser.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DocumentDropzone, extensionOf } from "../components/DocumentDropzone";
import { useAuth } from "../lib/auth";
import { api, buildSellerContext } from "../lib/api";
import { deleteDocument, getProfile, listDocuments, saveDocument, saveSession } from "../lib/store";
import { newId } from "../lib/ids";
import { formatBytes, formatWhen, plural, truncate } from "../lib/format";
import { config } from "../config";
import { Icon } from "../ui/icons";
import {
  Bar,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Modal,
  Notice,
  PageHeader,
  Panel,
  RatingPill,
  SectionHeader,
  Spinner,
  useToast,
} from "../ui/primitives";
import type {
  DocumentKind,
  SalesDocument,
  Seller,
  TrainingSession,
} from "../lib/types";

/* --------------------------------------------------------------- Regler */

/**
 * Grænsen følger den, api-laget selv håndhæver på vejen til serveren
 * (MAX_FILE_BYTES i lib/api). Sælgeren skal få beskeden med det samme frem for
 * efter at have ventet på en upload der alligevel bliver afvist. Er materialet
 * større, er det næsten altid en scannet PDF — og den kan alligevel ikke læses.
 */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Bevidst uden gamle binære Office-formater; dropzonen forklarer hvorfor. */
export const ACCEPTED_EXTENSIONS = [".pdf", ".pptx", ".docx", ".xlsx", ".txt", ".csv", ".md"];

/** Filer vi kan læse direkte i browseren og sende som ren tekst. */
const TEXT_EXTENSIONS = [".txt", ".csv", ".md"];

/** Hvor meget af materialets tekst der følger med ind i en øvelse. */
const MAX_MATERIAL_TEXT = 12000;

export const KIND_LABEL: Record<DocumentKind, string> = {
  pdf: "PDF",
  pptx: "Præsentation",
  docx: "Dokument",
  xlsx: "Regneark",
  tekst: "Tekst",
};

/* ------------------------------------------------------ Delte hjælpere */

export function kindFromName(name: string): DocumentKind {
  switch (extensionOf(name)) {
    case ".pdf":
      return "pdf";
    case ".pptx":
    case ".ppt":
      return "pptx";
    case ".docx":
    case ".doc":
      return "docx";
    // CSV hører hjemme her: i praksis er det altid en beregning der er
    // eksporteret ud af et regneark.
    case ".xlsx":
    case ".xls":
    case ".csv":
      return "xlsx";
    default:
      return "tekst";
  }
}

function isTextLike(name: string): boolean {
  return TEXT_EXTENSIONS.includes(extensionOf(name));
}

/** Er lageret løbet tør? Browsere melder det på tre-fire forskellige måder. */
export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; code?: number; message?: string } | null;
  if (!e) return false;
  if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  if (e.code === 22 || e.code === 1014) return true;
  // Bevidst snæver: "exceeded" alene rammer også fx svar om forbrugsgrænser
  // fra API'et, og de skal ikke ende som en besked om browserens lager.
  return /quota|storage[ _-]?full|lagerplads/i.test(e.message ?? "");
}

/** Én fejlbesked der er til at handle på — også når fejlen er lageret. */
export function storageErrorMessage(err: unknown, what: string): string {
  if (isQuotaError(err)) {
    return `Der er ikke plads til flere ${what} i browserens lager. Slet et ældre materiale, og prøv igen. Selve filerne gemmes aldrig — kun den udtrukne tekst og analysen.`;
  }
  const label = what.charAt(0).toUpperCase() + what.slice(1);
  const msg = (err as Error | null)?.message?.trim();
  return msg ? `${label} kunne ikke gemmes: ${msg}` : `${label} kunne ikke gemmes. Prøv igen.`;
}

/** Hører materialet til den indloggede sælger? Ellers vises det ikke. */
export function belongsToSeller(doc: SalesDocument, seller: Seller): boolean {
  return doc.sellerId === seller.id || doc.sellerInitials === seller.initials;
}

/**
 * Sessionen bærer materialet videre ad tre adskilte veje, fordi de læses af
 * tre forskellige parter:
 *
 *   · documentId   — nøglen tilbage til dokumentet, så en debriefing eller en
 *                    senere øvelse kan hente hele analysen frem igen.
 *   · intake       — briefingen SÆLGEREN ser på skærmen, inden mikrofonen
 *                    åbnes. Kort og læsbar. Aldrig et tekstdump.
 *   · documentText — materialets faktiske tekst plus salgsdirektørens
 *                    konklusioner. Den går til modellen (og til analysen
 *                    bagefter), men vises aldrig for sælgeren. Det er dét, der
 *                    gør, at "kunden" kan udfordre præcis det, der står i
 *                    materialet, frem for at tale generelt om belysning.
 *
 * Feltet documentText findes ikke på TrainingSession endnu; LiveSession læser
 * det som en udvidelse — nøjagtig som hiddenBlob fra TrainingSetup.
 */
export type MaterialSession = TrainingSession & { documentText?: string };

export function buildMaterialSession(opts: {
  doc: SalesDocument;
  seller: Seller;
  modeId: "materialepraesentation" | "fri-coaching";
}): MaterialSession {
  const { doc, seller, modeId } = opts;
  const presenting = modeId === "materialepraesentation";
  const pages = doc.pages ? `, ${plural(doc.pages, "side", "sider")}` : "";
  const heading = `${doc.name} (${KIND_LABEL[doc.kind]}${pages})`;
  const context = doc.customerContext?.trim();
  const a = doc.analysis;

  /* ---- Briefingen sælgeren ser ---- */
  const brief: string[] = [
    presenting
      ? `Du skal præsentere dit eget materiale højt: **${heading}**. Kunden sidder med materialet foran sig og reagerer på det, der faktisk står i det.`
      : `Du taler med salgsdirektøren om **${heading}**. Spørg til det du er i tvivl om — og bliv presset på det, der ikke holder.`,
  ];
  if (context) brief.push(`**Kunden:** ${context}`);
  if (a?.headline) brief.push(`**Salgsdirektørens konklusion:** ${a.headline}`);
  brief.push(
    presenting
      ? "Tag kunden igennem materialet, som du ville gøre på et rigtigt møde. Begynd med hvorfor I sidder der."
      : "Start med at sige, hvad du gerne vil have hjælp til.",
  );

  /* ---- Materialet som modellen får det ---- */
  const material: string[] = [`MATERIALE: ${heading}`];
  if (context) material.push(`KUNDEKONTEKST FRA SÆLGEREN: ${context}`);

  if (a) {
    const lines = [`Samlet vurdering: ${a.overall} — ${a.headline}`];
    if (a.readsAsWrittenFor) lines.push(`Materialet taler som skrevet til: ${a.readsAsWrittenFor}`);

    const asks = a.customerWillAsk ?? [];
    if (asks.length) {
      lines.push(
        presenting
          ? `Stil disse spørgsmål undervejs, når de passer naturligt ind:\n${asks.map((q) => `- ${q}`).join("\n")}`
          : `Spørgsmål kunden med sikkerhed vil stille:\n${asks.map((q) => `- ${q}`).join("\n")}`,
      );
    }
    const gaps = a.internalSellingGaps ?? [];
    if (gaps.length) {
      lines.push(
        `Det materialet mangler, for at kunden kan sælge det internt:\n${gaps.map((g) => `- ${g}`).join("\n")}`,
      );
    }
    material.push(`SALGSDIREKTØRENS ANALYSE (baggrund — citér den ikke):\n${lines.join("\n")}`);
  }

  const text = (doc.extractedText ?? "").trim();
  if (text) {
    const clipped =
      text.length > MAX_MATERIAL_TEXT
        ? `${text.slice(0, MAX_MATERIAL_TEXT)}\n[Teksten er forkortet her.]`
        : text;
    material.push(`--- MATERIALETS TEKST ---\n${clipped}`);
  }

  return {
    id: newId("ses"),
    sellerId: seller.id,
    sellerInitials: seller.initials,
    modeId,
    coachMode: presenting ? "realistisk" : "coach",
    language: config.defaultLanguage,
    voiceEngine: "realtime",
    intake: brief.join("\n\n"),
    documentText: material.join("\n\n"),
    documentId: doc.id,
    status: "kladde",
    startedAt: new Date().toISOString(),
    durationSec: 0,
    transcript: [],
    developmentFocus: [],
  };
}

/* --------------------------------------------------------- Filhåndtering */

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Filen kunne ikke læses. Prøv at gemme den igen, og upload den forfra."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Filen kunne ikke læses."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

/* ------------------------------------------------- Fremdrift under analysen */

/**
 * Ærlig fremdrift. Udtrækning og analyse tager 20-60 sekunder, og en nøgen
 * spinner får det til at føles som om noget er gået i stå. Derfor fortæller vi
 * hvad der faktisk sker, i den rækkefølge det sker.
 */
const STEPS: readonly { at: number; text: string }[] = [
  { at: 0, text: "Læser filen i browseren" },
  { at: 3, text: "Sender materialet til udtrækning — selve filen gemmes ikke" },
  { at: 9, text: "Udtrækker tekst, tal og struktur fra dokumentet" },
  { at: 21, text: "Salgsdirektøren læser materialet igennem" },
  { at: 34, text: "Vurderer kundeværdi, business case og differentiering" },
  { at: 48, text: "Skriver omskrivninger og næste skridt" },
  { at: 66, text: "Samler analysen" },
];

export function AnalysisProgress({ fileName, running }: { fileName: string; running: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const from = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - from) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  let activeIndex = 0;
  for (let i = 0; i < STEPS.length; i++) if (elapsed >= STEPS[i].at) activeIndex = i;

  return (
    <div className="panel-quiet p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="title-md">Analyserer {truncate(fileName, 48)}</h3>
        <span className="text-xs tabular-nums text-ink-mute">{elapsed} sek.</span>
      </div>

      <div className="mt-3">
        <Bar value={Math.min(0.94, 0.06 + elapsed / 75)} />
      </div>

      <ol className="mt-4 space-y-2.5">
        {STEPS.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={step.text} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
                {done ? (
                  <Icon.Check className="text-brand-400" width={15} height={15} />
                ) : active ? (
                  <Spinner size={14} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-base-line2" />
                )}
              </span>
              <span
                className={`text-sm leading-relaxed ${
                  active ? "font-semibold text-ink" : done ? "text-ink-soft" : "text-ink-faint"
                }`}
              >
                {step.text}
                {done && <span className="sr-only"> — færdig</span>}
                {active && <span className="sr-only"> — i gang</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs leading-relaxed text-ink-mute" aria-live="polite">
        {STEPS[activeIndex].text}. Det tager typisk 20-60 sekunder afhængigt af materialets længde.
        Bliv på siden.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- Siden */

type Phase = "tom" | "valgt" | "arbejder";

export function Materials() {
  const { seller } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [docs, setDocs] = useState<SalesDocument[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [phase, setPhase] = useState<Phase>("tom");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SalesDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const contextRef = useRef<HTMLTextAreaElement>(null);

  /* ---------------------------------------------------------- Indlæsning */

  const load = useCallback(async () => {
    if (!seller) return;
    setLoadError(null);
    try {
      const all = await listDocuments(seller.id);
      // Ekstra sikring oven på lagerets egen afgrænsning: intet fra andre
      // sælgere må nogensinde nå skærmen her.
      const mine = (all ?? []).filter((d) => belongsToSeller(d, seller));
      mine.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
      setDocs(mine);
    } catch (err) {
      setDocs([]);
      setLoadError(
        (err as Error)?.message
          ? `Materialerne kunne ikke hentes: ${(err as Error).message}`
          : "Materialerne kunne ikke hentes. Prøv at genindlæse siden.",
      );
    }
  }, [seller]);

  useEffect(() => {
    void load();
  }, [load]);

  /* -------------------------------------------------------------- Upload */

  const chooseFile = useCallback((picked: File) => {
    setUploadError(null);
    setFile(picked);
    setPhase("valgt");
    window.setTimeout(() => contextRef.current?.focus(), 60);
  }, []);

  const cancelFile = useCallback(() => {
    setFile(null);
    setContext("");
    setPhase("tom");
    setUploadError(null);
  }, []);

  const analyse = useCallback(async () => {
    if (!seller || !file) return;
    setUploadError(null);
    setPhase("arbejder");

    // Base64-udgaven af filen. Den lever KUN her, bliver aldrig lagt i state
    // og aldrig gemt. Efter kaldet nulstiller vi den med det samme.
    let dataUrl: string | null = null;

    try {
      dataUrl = await readAsDataUrl(file);
      const plain = isTextLike(file.name) ? await readAsText(file) : "";

      type Profile = Awaited<ReturnType<typeof getProfile>>;
      let profile: Profile | null = null;
      try {
        profile = (await getProfile(seller.id)) ?? null;
      } catch {
        profile = null; // Udviklingsprofilen skærper analysen, men er ikke et krav.
      }

      const result = await api.analyseMaterial({
        file: { name: file.name, dataUrl },
        customerContext: context.trim(),
        sellerContext: buildSellerContext(seller, profile),
        language: config.defaultLanguage,
        text: plain,
      });

      dataUrl = null;

      const doc: SalesDocument = {
        id: newId("mat"),
        sellerId: seller.id,
        sellerInitials: seller.initials,
        name: file.name,
        kind: kindFromName(file.name),
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        customerContext: context.trim() || undefined,
        extractedText: result.extractedText,
        pages: result.pages,
        analysis: result.analysis,
      };

      try {
        await saveDocument(doc);
      } catch (err) {
        if (!isQuotaError(err)) throw err;
        // Sidste udvej før vi giver op: gem analysen, og skær teksten ned.
        const trimmed: SalesDocument = {
          ...doc,
          extractedText: `${(doc.extractedText ?? "").slice(0, 20000)}\n[Den udtrukne tekst er forkortet, fordi browserens lager var ved at være fuldt.]`,
        };
        await saveDocument(trimmed);
        toast("Analysen er gemt, men den udtrukne tekst blev forkortet.", "fejl");
      }

      setFile(null);
      setContext("");
      setPhase("tom");
      navigate(`/materiale/${doc.id}`);
    } catch (err) {
      dataUrl = null;
      setPhase("valgt");
      setUploadError(
        isQuotaError(err)
          ? storageErrorMessage(err, "materialer")
          : (err as Error)?.message ||
              "Materialet kunne ikke analyseres. Tjek din forbindelse, og prøv igen.",
      );
    }
  }, [context, file, navigate, seller, toast]);

  /* ------------------------------------------------------------ Handlinger */

  const practise = useCallback(
    async (doc: SalesDocument) => {
      if (!seller) return;
      const session = buildMaterialSession({ doc, seller, modeId: "materialepraesentation" });
      try {
        await saveSession(session);
        navigate(`/session/${session.id}`);
      } catch (err) {
        toast(storageErrorMessage(err, "øvelsen"), "fejl");
      }
    },
    [navigate, seller, toast],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDocument(pendingDelete.id);
      setDocs((list) => (list ?? []).filter((d) => d.id !== pendingDelete.id));
      toast("Materialet er slettet.");
      setPendingDelete(null);
    } catch (err) {
      toast((err as Error)?.message || "Materialet kunne ikke slettes. Prøv igen.", "fejl");
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, toast]);

  /* ------------------------------------------------------------- Visning */

  if (!seller) {
    return <Notice>Du skal være logget ind for at arbejde med dit salgsmateriale.</Notice>;
  }

  const busy = phase === "arbejder";

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Salgsmateriale"
        title="Dit eget materiale"
        desc="Upload det materiale kunden reelt får: tilbuddet, præsentationen, beregningen. Salgsdirektøren læser det igennem og vurderer det, som en kunde ville."
      />

      <div className="space-y-10 md:space-y-14">

      {/* ------------------------------------------------------------ Upload
          Feltet står selv på siden, når det er tomt. Et stiplet felt inde i et
          kort inde i en side er tre rammer om den samme ene handling. */}
      <section>
        <h2 className="sr-only">Upload materiale</h2>

        {busy && file ? (
          <AnalysisProgress fileName={file.name} running />
        ) : phase === "valgt" && file ? (
          <div className="panel space-y-4 p-5 md:p-6">
            <div className="flex items-start gap-3 rounded-xl border border-base-line bg-base-panel2 px-4 py-3">
              <Icon.Doc className="mt-0.5 shrink-0 text-brand-400" width={20} height={20} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{file.name}</div>
                <div className="text-xs text-ink-mute">
                  {KIND_LABEL[kindFromName(file.name)]} · {formatBytes(file.size)}
                </div>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={cancelFile}>
                Vælg en anden
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="label block" htmlFor="materiale-kontekst">
                Hvem er materialet til, og hvad ved du om deres situation?
              </label>
              <textarea
                id="materiale-kontekst"
                ref={contextRef}
                className="textarea"
                rows={4}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Fx: Teknisk chef på et plejehjem i Aarhus. De har haft to nedbrud i P-anlægget, og driftsbudgettet er lagt for året. Beslutningen skal godkendes af kommunen."
                aria-describedby="materiale-kontekst-hjaelp"
              />
              <p id="materiale-kontekst-hjaelp" className="text-xs leading-relaxed text-ink-mute">
                Valgfrit — men analysen bliver markant skarpere, når salgsdirektøren ved hvem
                materialet skal overbevise, og hvad der står på spil hos dem.
              </p>
            </div>

            {uploadError && <ErrorNote onRetry={() => void analyse()}>{uploadError}</ErrorNote>}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" onClick={() => void analyse()}>
                <Icon.Spark width={17} height={17} />
                Analysér materialet
              </button>
              <button type="button" className="btn-ghost" onClick={cancelFile}>
                Fortryd
              </button>
              <span className="body-mute">Du kan springe kundekonteksten over.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <DocumentDropzone
              onFile={chooseFile}
              accept={ACCEPTED_EXTENSIONS}
              maxBytes={MAX_UPLOAD_BYTES}
              busy={busy}
              hint="Ét materiale ad gangen. Du bliver spurgt om kundekonteksten, inden analysen går i gang. Selve filen gemmes aldrig — kun den udtrukne tekst og analysen, og kun du kan se dem."
            />
            {uploadError && <ErrorNote title="Materialet blev ikke uploadet">{uploadError}</ErrorNote>}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ Listen */}
      <section>
        <SectionHeader
          eyebrow="Arkiv"
          title="Dine materialer"
          desc="Analyserede materialer bliver liggende, så du kan tage præsentationen igen inden mødet."
          right={
            docs && docs.length > 0 ? (
              <span className="text-sm text-ink-mute">
                {plural(docs.length, "materiale", "materialer")}
              </span>
            ) : undefined
          }
        />

        {loadError && (
          <div className="mb-4">
            <ErrorNote title="Materialerne kunne ikke hentes" onRetry={() => void load()}>
              <span className="text-xs text-danger-300/70">{loadError}</span>
            </ErrorNote>
          </div>
        )}

        {docs === null ? (
          <LoadingBlock label="Henter dine materialer" rows={2} />
        ) : docs.length === 0 ? (
          <EmptyState
            icon={<Icon.Doc width={22} height={22} />}
            title="Du har ikke uploadet noget materiale endnu"
            desc="Salgsdirektøren læser materialet linje for linje: hvem det taler til, hvad kunden vil spørge om, og hvor argumentationen ikke holder."
            aside={
              <ul className="space-y-2 border-l border-base-line pl-4">
                {[
                  "Et tilbud du er ved at sende, eller lige har sendt",
                  "En præsentation du skal holde for en kunde",
                  "En energiberegning eller et driftsregnestykke",
                  "En business case der skal godkendes internt hos kunden",
                ].map((t) => (
                  <li key={t} className="text-sm leading-relaxed text-ink-soft">
                    {t}
                  </li>
                ))}
              </ul>
            }
          />
        ) : (
          <ul className="space-y-3">
            {docs.map((doc) => (
              <li key={doc.id}>
                <DocumentRow
                  doc={doc}
                  onOpen={() => navigate(`/materiale/${doc.id}`)}
                  onPractise={() => void practise(doc)}
                  onDelete={() => setPendingDelete(doc)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      {/* ---------------------------------------------------------- Sletning */}
      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => (deleting ? undefined : setPendingDelete(null))}
        title="Slet materialet"
      >
        <p className="body">
          Sletter du <strong className="text-ink">{pendingDelete?.name}</strong>, forsvinder både
          den udtrukne tekst og salgsdirektørens analyse. Det kan ikke fortrydes.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setPendingDelete(null)}
            disabled={deleting}
          >
            Behold
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => void confirmDelete()}
            disabled={deleting}
          >
            {deleting ? <Spinner size={14} /> : <Icon.X width={15} height={15} />}
            Slet materialet
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------- Listerække */

function DocumentRow({
  doc,
  onOpen,
  onPractise,
  onDelete,
}: {
  doc: SalesDocument;
  onOpen: () => void;
  onPractise: () => void;
  onDelete: () => void;
}) {
  const pages = doc.pages ? plural(doc.pages, "side", "sider") : null;

  return (
    <article className="panel p-4 transition-colors hover:border-base-line2 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="title-md break-words">
              <button
                type="button"
                onClick={onOpen}
                className="rounded text-left hover:text-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {doc.name}
              </button>
            </h3>
            {doc.analysis ? (
              <RatingPill rating={doc.analysis.overall} size="sm" />
            ) : (
              <span className="chip-warn">Ikke analyseret</span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-mute">
            <span className="chip">{KIND_LABEL[doc.kind]}</span>
            {pages && <span>{pages}</span>}
            {pages && <span aria-hidden="true">·</span>}
            <span>{formatBytes(doc.sizeBytes)}</span>
            <span aria-hidden="true">·</span>
            <span>Uploadet {formatWhen(doc.uploadedAt)}</span>
          </div>

          {doc.analysis?.headline && (
            <p className="body mt-2.5 max-w-2xl">{truncate(doc.analysis.headline, 200)}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:shrink-0">
          <button type="button" className="btn-outline btn-sm" onClick={onOpen}>
            Åbn analysen
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={onPractise}
            disabled={!doc.extractedText && !doc.analysis}
          >
            <Icon.Mic width={15} height={15} />
            Øv præsentationen
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm text-ink-mute hover:text-danger-300"
            onClick={onDelete}
            aria-label={`Slet ${doc.name}`}
          >
            <Icon.X width={15} height={15} />
            Slet
          </button>
        </div>
      </div>
    </article>
  );
}
