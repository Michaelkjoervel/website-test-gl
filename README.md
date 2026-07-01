# green light · Estimatværktøj

En webbaseret beregner som green lights sælgere kan bruge til at lave et
hurtigt, professionelt **overslag** på en belysningsløsning ude hos kunden.

> Værktøjet leverer et **kvalificeret estimat** — ikke et bindende tilbud.
> Sikkerhed og præcision vokser i takt med, at green light tilfører
> historiske data og produktinformation.

---

## Hvad systemet gør

- Opretter nye estimater via et **trinvist flow** (Projekt → Installatør → Energi → Teknisk → Resultat).
- Beregner overslag på materiale, installation, styring, samlet pris, pris pr. armatur og budgetinterval.
- Estimerer årligt energiforbrug og el-omkostning.
- **Energibesparelse · før/efter**: sammenligner nuværende anlæg (antal armaturer, watt, brændetimer) med en ny 1:1-løsning og lægger en anslået styringsbesparelse oveni (styring 50%, dagslysstyring yderligere 20%). Resultatet vises i estimatet og i PDF'en.
- **Forretningscase (ROI & CO₂)**: tilbagebetalingstid, nettogevinst, afkast og CO₂-besparelse beregnes live i energitrinnet og på resultattrinnet. Hvert gemt estimat har desuden en fuldskærms, kundevendt præsentation på `/forretningscase/:id` (cash-flow-graf med break-even, før/efter-søjler, CO₂ omsat til træer/biler/flyrejser, følsomheds-slider for el-prisstigning). Prøv demoen på `/forretningscase/demo`. Antagelserne ligger i `pricingConfig.businessCase`, og beregningen i `src/lib/businessCase.ts`.
- Viser et **sikkerhedsniveau** (Lav / Middel / Høj) baseret på hvor godt brugeren har udfyldt felterne.
- Genererer en **professionel PDF** med green light branding, klar til at sende eller vise kunden.
- Gemmer estimathistorik lokalt i browseren.
- Tillader registrering af **faktisk resultat** (tilbud / endelig pris) så systemet kan måle afvigelse.
- Tilbyder en **import-side** der kan læse historiske tilbud i CSV/JSON.
- Indeholder et **dashboard** med KPI'er og datagrundlagets modenhed.
- Har en separat **læringsmodul-fil** som er forberedt til AI/ML-træning.

## Tech-stack & valg

| Lag | Valg | Begrundelse |
|------|------|-------------|
| Build | Vite | Hurtig dev-loop, ingen unødig SSR-kompleksitet til et lokalt værktøj |
| Sprog | TypeScript | Typesikker datamodel, krav i opgaven |
| UI | React 18 + React Router | Stabil og letvægts SPA |
| Styling | Tailwind CSS | Hurtig brand-tuning via `tailwind.config.ts` |
| PDF | jsPDF + jspdf-autotable | Klient-side generering, ingen server nødvendig |
| Data | `localStorage` via `src/lib/storage.ts` | Repository-pattern – byttes til API/DB senere |

Hvis green light senere foretrækker en backend (Next.js, Express, Postgres),
kan `storage.ts` udskiftes uden at røre UI eller beregninger – samme
interface.

---

## Kom i gang

```bash
npm install
npm run dev          # starter på http://localhost:5173
npm run build        # produktionsbuild i ./dist
npm run preview      # forhåndsvisning af build
```

Node 18+ kræves. Ingen miljøvariabler kræves.

---

## Projektstruktur

```
src/
├── main.tsx               – Router og app-bootstrap
├── components/            – Genbrugelige UI-komponenter
│   ├── AppShell.tsx       – Sidebar + header layout
│   ├── Confidence.tsx     – Sikkerhedsindikatorer
│   ├── Field.tsx          – Felt-wrapper med tooltips
│   ├── Stepper.tsx        – Wizard-stepper
│   ├── ImageDropzone.tsx  – Klik/træk billed-upload (auto-nedskalering)
│   ├── BeforeAfterSlider.tsx – Før/efter-slider
│   ├── PlacementEditor.tsx   – Interaktiv armaturplacering på rumbillede
│   └── FixtureForm.tsx    – Opret/redigér armatur i universet
├── pages/                 – Routede sider
│   ├── Dashboard.tsx
│   ├── NewEstimate.tsx    – Trinvist flow
│   ├── EstimateDetail.tsx – Visning + faktisk resultat + PDF-download
│   ├── History.tsx
│   ├── ImportPage.tsx
│   ├── Univers.tsx        – Produktbibliotek af armaturer
│   ├── NewVisualization.tsx  – Visualiserings-wizard (6 trin)
│   ├── Visualizations.tsx    – Galleri af gemte visualiseringer
│   └── VisualizationDetail.tsx – Før/efter + specs + download
└── lib/                   – Adskilt logik
    ├── types.ts           – Datamodel (estimat)
    ├── pricingConfig.ts   – Central prisconfig (PLACEHOLDER)
    ├── estimateEngine.ts  – Pris-, energi- og sikkerhedsberegning
    ├── learningModel.ts   – Læringsmodul / forberedt til AI
    ├── storage.ts         – Repository for localStorage (estimater)
    ├── importer.ts        – CSV/JSON-parser
    ├── pdf.ts             – PDF-generering
    ├── mockData.ts        – Demo historiske tilbud
    ├── format.ts          – Dansk talformat & dato
    ├── visualizationTypes.ts    – Datamodel (armatur + visualisering)
    ├── visualizationStorage.ts  – Repository for universet + visualiseringer
    ├── fixtureSeed.ts     – Realistiske pladsholder-armaturer
    ├── visualizationProvider.ts – AI-motor (mock + proxy) + prompt-bygger
    ├── visualizationConfig.ts   – Runtime-konfig af live-AI-proxyens URL
    └── image.ts           – Billed-nedskalering til localStorage

api/
└── visualize.js          – Serverless proxy → OpenAI gpt-image-1 (holder nøglen skjult)
vercel.json               – Funktions-timeout (60 s) til proxyen
```

UI, beregning og data er **bevidst adskilt**, så hver del kan udskiftes
uafhængigt.

---

## Visualiseringsunivers

Et modul til at vise kunden, hvordan en belysningsløsning kommer til at se ud i
**deres eget lokale** – *før* den er sat op. Findes i sidebaren under
**Visualisering**.

### Universet (produktbibliotek) · `/univers`

Green lights armaturer med **produktbillede, datablad, fotometri (IES/LDT) og
specs** (lumen, watt, lm/W, kelvin, CRI, spredning, IP, UGR, montering, pris).
Seedes med 6 realistiske pladsholder-armaturer første gang (reception,
administration/kontor, kontorlandskab, industri/lager). Tilføj, redigér og slet
frit – gemmes lokalt via samme repository-mønster som estimatværktøjet.

### Visualiserings-flow · `/ny-visualisering`

En 6-trins wizard:

1. **Projekt** – kunde, lokale, rumtype, valgfri kobling til et estimat.
2. **Rum** – upload et billede af kundens lokale (+ valgfri **plantegning**).
3. **Armaturer** – vælg fra universet og sæt antal.
4. **Placering** – **AI foreslår** placeringen automatisk; uploades en
   plantegning, **styrer den** placeringen; eller **markér selv** punkter på
   billedet.
5. **Generér** – vælg lysscenarie (dag/aften/nat) og motor; se den præcise
   AI-prompt.
6. **Resultat** – **før/efter-slider**, forbehold, gem, download.

Rummet bevares (samme vægge, møbler, perspektiv) – kun belysningen ændres.

### AI-motoren (pluggbar)

Motoren ligger bag en provider-grænseflade i
[`src/lib/visualizationProvider.ts`](src/lib/visualizationProvider.ts), så den kan
skiftes uden at røre UI'et:

| Motor | Hvad den gør |
|-------|--------------|
| **Demo-simulering** (standard) | Simulerer "lys tændt" direkte i browseren via canvas. Ingen backend, ingen nøgle. Til at afprøve flowet og vise før/efter. **Ikke fotometrisk eksakt** (stemplet som simulering). |
| **Live AI (proxy)** | POST'er rumbillede + prompt til en server-funktion, der redigerer fotoet med et rigtigt billed-API og bevarer rummet. Aktiveres ved at indsætte proxy-URL'en i appen (eller via `VITE_VISUALIZATION_ENDPOINT`). |

`buildVisualizationPrompt()` samler en præcis prompt, der beder modellen om at
**bevare rummet** og kun ændre belysningen ud fra de valgte armaturers specs og
lyskarakter.

### Slå ægte fotorealistisk AI til (OpenAI gpt-image-1)

Proxyen ligger klar i [`api/visualize.js`](api/visualize.js). Den holder
OpenAI-nøglen skjult og kalder `gpt-image-1`'s **billed-redigerings**-endpoint
(`/v1/images/edits`) med kundens rumfoto + `input_fidelity: high`, så rummet
bevares og kun belysningen ændres.

**Bemærk:** det kræver en OpenAI **API**-konto (platform.openai.com) — ikke et
ChatGPT-abonnement. API'et afregnes særskilt pr. billede, og nogle konti skal
verificere organisationen for at få adgang til `gpt-image-1`.

Opsætning (engangsarbejde):

1. **Deploy proxyen** til Vercel: importér repoet på [vercel.com](https://vercel.com)
   → New Project. `vercel.json` sætter allerede funktionens timeout (60 s).
2. **Sæt miljøvariabel** i Vercel → Project → Settings → Environment Variables:
   - `OPENAI_API_KEY` = din OpenAI API-nøgle (påkrævet)
   - `ALLOWED_ORIGIN` = `https://michaelkjoervel.github.io` (valgfri, strammer CORS)
   - Deploy. Din funktion får en URL som `https://<projekt>.vercel.app/api/visualize`.
3. **Kobl appen på**: i visualiserings-wizardens trin *Generér* → **"Live AI-opsætning"**
   → indsæt funktions-URL'en → *Gem & slå til*. Motoren skifter til "Live AI".
   (URL'en gemmes i browseren; ingen genbygning nødvendig. Alternativt sæt
   `VITE_VISUALIZATION_ENDPOINT` ved build.)

API-nøglen lever **kun** i Vercel — aldrig i browseren eller i repoet.

Proxyen er provider-agnostisk: vil man bruge en anden model (Flux, Gemini m.fl.),
ændrer man blot `api/visualize.js` til at kalde det API — kontrakten ud mod appen
(`{ imageData }`) er den samme.

### Vigtigt / forbehold

- Visualiseringen er **illustrativ**, ikke en garanteret gengivelse – samme
  forbeholdslinje som estimatet ("kvalificeret estimat, ikke bindende tilbud").
- Billeder gemmes **nedskaleret** i browserens `localStorage` (~5 MB). Til
  mange/store visualiseringer bør data flyttes til en backend (samme
  repository-skift som `storage.ts`).
- Kundefotos er forretnings-/persondata – ved en backend skal opbevaring,
  adgang, samtykke og sletning håndteres (GDPR).

---

## Hvor beregningsdata kan ændres

Alle satser ligger samlet i [`src/lib/pricingConfig.ts`](src/lib/pricingConfig.ts).

```ts
// pris pr. armatur, basis
luminaireBaseCost: 1450,

// pr.-armatur tillæg pr. styringstype + fast tillæg
controlSurcharge: {
  MasterConnect: { perLuminaire: 290, fixed: 5500 },
  // …
},

// installationspris pr. armatur
installationPerLuminaire: 520,

// områdefaktorer (multiplikator på installationen)
areaFactor: { Lager: 1.0, Produktion: 1.15, … },

// lux-/watt-tabeller
luxFactor:        [{ lux: 300, factor: 1.0 }, …],
wattLuxMultiplier:[{ lux: 300, multiplier: 1.0 }, …],

// energibesparelse ved styring (før/efter-beregner)
energySavings: { control: 0.50, daylightControl: 0.20 },

// standard-watt i energi-sammenligningen
energyDefaults: { currentWattPerLuminaire: 58, newWattPerLuminaire: 35 },
```

Når green light leverer rigtige priser, behøver man **kun** at ændre denne
fil. Beregningsmotoren i `estimateEngine.ts` behøver ikke at blive rørt,
fordi den udelukkende læser fra konfigurationen.

---

## Datamodel

Alle persisterede objekter er typede i [`src/lib/types.ts`](src/lib/types.ts):

- `CustomerEstimate` – ét fuldt estimat (rod-typen)
- `InstallerInfo` – kontaktinformation
- `TechnicalInput` – tekniske valg
- `PricingResult` – beregnede priser
- `EnergyCalculation` – energiresultater
- `EstimateConfidence` – sikkerhedsniveau (score + level + manglende felter)
- `ActualResult` – det indtastede faktiske resultat
- `HistoricalOffer` – importeret historisk tilbud
- `EstimateStatus` – Kladde / Sendt / Vundet / Tabt / Opdateret til faktisk tilbud

---

## Sådan importeres historiske tilbud

På siden **Importér data** kan en CSV- eller JSON-fil uploades. Den
forventede struktur for JSON er en liste af objekter:

```json
[
  {
    "projectName": "Eksempelprojekt",
    "areaType": "Lager",
    "luminaireCount": 120,
    "controlType": "MasterConnect",
    "luxLevel": 300,
    "kelvin": 4000,
    "annualBurnHours": 3500,
    "electricityPrice": 2.1,
    "estimatedPrice": 450000,
    "actualPrice": 472000,
    "status": "Vundet"
  }
]
```

CSV-filer bruger samme felter som kolonneoverskrifter. **Ukendte kolonner
bevares automatisk** som metadata på objektet, så fremtidig ML-træning kan
bruge dem uden at parseren skal ændres først.

Klik "Download eksempel-JSON" på importsiden for at få en starterskabelon.

---

## PDF-generering

PDF'en bygges i [`src/lib/pdf.ts`](src/lib/pdf.ts) med jsPDF og indeholder:

- top-accent + brand-mark
- projektnavn, kunde, dato, sikkerhedspille
- installatørblok
- forudsætninger (tabel)
- fremhævet samlet prisoverslag + interval + pris pr. armatur
- prisopdeling (materiale / installation / styring)
- energiblok (effekt, kWh, omkostning, evt. besparelse)
- bemærkninger
- forbeholdsblok med standarddisclaimer
- footer med sideantal

PDF'en downloades fra **Estimat-detaljevisningen** via knappen "Download PDF".

For at ændre branding (logo-mark, farver, layout) redigér konstanten `BRAND`
øverst i `pdf.ts`.

---

## Sikkerhedsniveau (confidence)

Confidence beregnes i `estimateEngine.ts` ud fra hvilke felter brugeren har
udfyldt (vægtet). Score 0–100 mappes til:

- **Lav** (< 55) – datagrundlaget er for tyndt
- **Middel** (55-79) – brugbar første indikation
- **Høj** (80+) – alle væsentlige felter udfyldt

Tomme felter listes som "Manglende: …" i sidebaren og i Estimat-visningen.

---

## Læringsmodulet og AI-forberedelse

[`src/lib/learningModel.ts`](src/lib/learningModel.ts) implementerer i denne
version en **regelbaseret** similarity-matcher:

1. Sammenligner det aktuelle input med både historiske importer og
   tidligere estimater med faktisk resultat.
2. Vægter ligheden på områdetype, styring, antal armaturer, lux og brændetid.
3. Beregner den gennemsnitlige afvigelse `(actual − estimated) / estimated`
   over matchene og returnerer en justeringsanbefaling.

`suggestAdjustment()` returnerer også datagrundlagets **modenhed**:

| Modenhed | Datapunkter |
|----------|-------------|
| Ingen | 0–9 |
| Begrænset | 10–29 |
| Brugbar | 30–99 |
| Stærk | 100+ |

> **Sådan kobles en rigtig AI-model på senere:** Erstat selve `scoreSimilarity`
> og aggregeringsdelen i `suggestAdjustment()` med et POST-kald til et
> ML-endpoint. Returstrukturen (`LearningSuggestion`) er allerede den UI'et
> forventer, så ingen øvrige filer skal ændres.

---

## Sådan udvides systemet senere

| Tema | Hvor | Hvordan |
|------|------|---------|
| Rigtige armatur- og styringspriser | `src/lib/pricingConfig.ts` | Erstat konstanter, evt. opdel pr. produktkategori |
| Cloud database / brugerlogin | `src/lib/storage.ts` | Skift implementation til `fetch(...)` mod API – bevar interface |
| AI-baseret estimering | `src/lib/learningModel.ts` | Kald ML-endpoint inden returnering, behold `LearningSuggestion`-formen |
| CRM-integration | Nyt modul (fx `src/lib/crm.ts`) | Send `CustomerEstimate` til CRM ved status "Sendt" |
| Detaljeret lysberegning | Nyt modul + område-input udvidet | Brug allerede eksisterende `areaSqm` felt |
| Brugerlogin | Tilføj `auth/` modul | Beskyt routes i `main.tsx` |

---

## Vigtigt forbehold (også i UI'et)

> Dette estimat er vejledende og baseret på de indtastede oplysninger samt
> green lights interne beregningsgrundlag. Estimatet er ikke et bindende
> tilbud og kan ændre sig efter nærmere gennemgang, lysberegning, teknisk
> afklaring og endelig projektering.

---

## Deployment

Estimatet og tidsregistreringsværktøjet bor i samme repo og udgives via
`.github/workflows/deploy.yml` til ét fælles GitHub Pages-site:

- `…/website-test-gl/` og `…/website-test-gl/app.html` → tidsregistreringen
  (serveres uændret fra branchen `claude/time-tracking-tool-aTwpD`, som
  workflowen henter og lægger i roden)
- `…/website-test-gl/estimat/` → dette estimatværktøj (Vite-build under
  undermappen `/estimat/`)

Workflowen bygger estimatet, henter tidsregistreringens statiske filer og
samler dem i ét `_site/`, der udgives samlet. Estimatet bruger relativ Vite
`base` og HashRouter, så det fungerer uændret under undermappen.

Den oprindelige hero-side ligger under `public/hero.html` og serveres på
`…/website-test-gl/estimat/hero.html`.
