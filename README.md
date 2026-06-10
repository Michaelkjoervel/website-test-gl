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
│   └── Stepper.tsx        – Wizard-stepper
├── pages/                 – Routede sider
│   ├── Dashboard.tsx
│   ├── NewEstimate.tsx    – Trinvist flow
│   ├── EstimateDetail.tsx – Visning + faktisk resultat + PDF-download
│   ├── History.tsx
│   └── ImportPage.tsx
└── lib/                   – Adskilt logik
    ├── types.ts           – Datamodel (TypeScript interfaces)
    ├── pricingConfig.ts   – Central prisconfig (PLACEHOLDER)
    ├── estimateEngine.ts  – Pris-, energi- og sikkerhedsberegning
    ├── learningModel.ts   – Læringsmodul / forberedt til AI
    ├── storage.ts         – Repository for localStorage
    ├── importer.ts        – CSV/JSON-parser
    ├── pdf.ts             – PDF-generering
    ├── mockData.ts        – Demo historiske tilbud
    └── format.ts          – Dansk talformat & dato
```

UI, beregning og data er **bevidst adskilt**, så hver del kan udskiftes
uafhængigt.

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
