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
├── appConfig.ts           – Offentlig klient-config (Supabase + proxy-URL)
├── components/            – Genbrugelige UI-komponenter
│   ├── AppShell.tsx       – Sidebar + header layout
│   ├── Confidence.tsx     – Sikkerhedsindikatorer
│   ├── Field.tsx          – Felt-wrapper med tooltips
│   ├── Stepper.tsx        – Wizard-stepper
│   ├── ImageDropzone.tsx  – Klik/træk billed-upload (auto-nedskalering)
│   ├── BeforeAfterSlider.tsx – Før/efter-slider
│   ├── PlacementEditor.tsx   – Interaktiv armaturplacering på rumbillede
│   ├── FixtureForm.tsx    – Opret/redigér armatur i universet
│   ├── FixtureImport.tsx  – Bulk-import (CSV/JSON) af armaturer
│   ├── AuthProvider.tsx   – Supabase-session (context)
│   └── RequireAuth.tsx    – Login-spærring + login-skærm
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
    ├── visualizationStorage.ts  – Lokalt repository (localStorage-bagende)
    ├── vizData.ts         – Fælles datalag: Supabase (delt) m. lokal fallback
    ├── fixtureSeed.ts     – Realistiske pladsholder-armaturer
    ├── visualizationProvider.ts – AI-motor (mock + proxy) + prompt-bygger
    ├── visualizationConfig.ts   – Runtime-konfig af live-AI-proxyens URL
    ├── fixtureImporter.ts – Bulk-import parser (CSV/JSON → armaturer)
    ├── supabase.ts        – Supabase-klient + access-token (login)
    └── image.ts           – Billed-nedskalering til localStorage

api/
├── _core.mjs             – Delt proxy-logik (billed-generering + datablad-læsning)
├── visualize.js          – Vercel-adapter: AI-visualisering
└── extract.js            – Vercel-adapter: PDF-datablad → armaturdata
server/
└── proxy.mjs             – Node-server-udgave (fx til GitHub Codespaces)
supabase/
└── schema.sql            – Tabeller + RLS til fælles katalog/visualiseringer
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

**Bulk-import:** knappen *Importér* på universet-siden læser mange armaturer på én
gang fra **CSV** eller **JSON** (kun `name` er påkrævet; billeder angives som URL i
`productImage`). Hent skabelon/eksempel direkte i import-vinduet. Import er
**dublet-sikker**: armaturer med samme SKU (eller navn) som et eksisterende
springes over, så samme fil kan importeres igen uden kopier. Parseren ligger i
[`src/lib/fixtureImporter.ts`](src/lib/fixtureImporter.ts).

**Auto-udfyld fra PDF-datablad:** i *Tilføj/redigér armatur*-formularen kan man
uploade et **PDF-datablad**, hvorefter AI læser det (inkl. tabeller og grafik)
og udfylder felterne automatisk — navn, SKU, kategori, montering, lumen, watt,
kelvin, CRI, spredning, IP, UGR, levetid, mål, beskrivelse og lyskarakter.
Felter, der ikke fremgår af databladet, røres ikke, og man gennemgår altid
resultatet før *Gem*. Teknisk: PDF'en sendes til proxyens `/api/extract`
(`api/extract.js` → `runExtract` i `_core.mjs`), som kalder en billig
OpenAI-model (default `gpt-5-mini`, override med `EXTRACT_MODEL`-env) med
fil-input + strengt JSON-schema. Kræver login og kører på sin egen
rate-limit-spand; typisk pris under 10 øre pr. datablad.

### Visualiserings-flow · `/ny-visualisering`

En 6-trins wizard:

1. **Projekt** – kunde, lokale, rumtype, valgfri kobling til et estimat.
2. **Rum** – upload et billede af kundens lokale (+ valgfri **plantegning**).
3. **Armaturer** – vælg fra universet og sæt antal.
4. **Placering** – **AI foreslår** placeringen automatisk; uploades en
   plantegning, **styrer den** placeringen; eller **markér selv** punkter på
   billedet.
5. **Generér** – vælg lysscenarie (dag/aften/nat), motor og **kvalitet**
   (udkast/standard/høj – styrer også prisen pr. AI-billede); se den præcise
   AI-prompt.
6. **Resultat** – **før/efter-slider**, forbehold, gem, download.

Rummet bevares (samme vægge, møbler, perspektiv) – kun belysningen ændres.

Wizarden **autosaver en kladde** løbende (inkl. genererede billeder), så et
reload eller lukket vindue aldrig koster et betalt AI-billede — kladden
gendannes ved næste besøg og ryddes ved gem. Før hver generering tjekkes der
desuden, at der er **plads i browserens lager** til at gemme resultatet, så
der aldrig genereres (og betales) forgæves. Live-AI-billeder **AI-mærkes**
automatisk med et lille badge i hjørnet.

### AI-motoren (pluggbar)

Motoren ligger bag en provider-grænseflade i
[`src/lib/visualizationProvider.ts`](src/lib/visualizationProvider.ts), så den kan
skiftes uden at røre UI'et:

| Motor | Hvad den gør |
|-------|--------------|
| **Demo-simulering** (standard) | Simulerer "lys tændt" direkte i browseren via canvas. Ingen backend, ingen nøgle. Til at afprøve flowet og vise før/efter. **Ikke fotometrisk eksakt** (stemplet som simulering). |
| **Live AI (proxy)** | POST'er rumbillede + prompt til en server-funktion, der redigerer fotoet med et rigtigt billed-API og bevarer rummet. Aktiveres ved at indsætte proxy-URL'en i appen (eller via `VITE_VISUALIZATION_ENDPOINT`). |

`buildVisualizationPrompt()` samler en struktureret **brief** (armaturer, antal,
scenarie, placering). Før genereringen lader serveren en **AI-lysdesigner**
(vision-model, default `gpt-5-mini`, override med `PROMPT_MODEL`-env) SE selve
rumbilledet og skrive den optimale redigerings-prompt ud fra briefen – præcis
som ChatGPT gør internt. Fejler trinnet, bruges briefen direkte (genereringen
blokeres aldrig). Uploadede **produktbilleder** sendes desuden med som visuelle
referencer (op til 3), så det genkendelige armatur rendres. Standardkvaliteten
er **høj** (kundemøde-niveau); rumfotos sendes i op til 2000 px, og resultatet
gemmes i op til 2048 px.

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
3. **Tjek status** (gratis, genererer intet billede): åbn funktions-URL'en i en
   browser (et **GET**-kald). Når login er slået til, svarer den
   `{"authRequired":true,"keyConfigured":true/false}` — nøglens *gyldighed*
   røbes bevidst ikke uden login (ellers er endpointet et orakel for
   angribere). Loggede-ind kald (eller `ALLOW_ANONYMOUS=1` lokalt) får det
   fulde `{"keyValid":…}`-tjek.
4. **Kobl appen på**: i visualiserings-wizardens trin *Generér* → **"Live AI-opsætning"**
   → indsæt funktions-URL'en → *Gem & slå til*. Motoren skifter til "Live AI".
   (URL'en gemmes i browseren; ingen genbygning nødvendig. Alternativt sæt
   `VITE_VISUALIZATION_ENDPOINT` ved build.)

API-nøglen lever **kun** i Vercel — aldrig i browseren eller i repoet.

#### Alternativ: kør proxyen i GitHub Codespaces

Vil man holde nøglen samme sted som andre projekter — som en **Codespaces-secret**
— kan proxyen køres som en almindelig Node-server ([`server/proxy.mjs`](server/proxy.mjs))
i stedet for på Vercel:

1. **Læg nøglen som Codespaces-secret**: GitHub → *Settings → Codespaces →
   Secrets* (eller repoets *Settings → Secrets and variables → Codespaces*) →
   tilføj `OPENAI_API_KEY`. Den bliver en miljøvariabel i Codespacet.
2. **Åbn et Codespace** på repoet og kør:
   ```bash
   npm install
   npm run proxy        # starter på port 8787
   ```
3. **Gør porten offentlig**: i *Ports*-fanen → højreklik på port 8787 →
   *Port Visibility → Public*. Kopiér den forwardede URL
   (`https://<codespace>-8787.app.github.dev`).
4. **Kobl appen på**: indsæt URL'en + `/api/visualize` i appens
   *"Live AI-opsætning"*.

> **Bemærk:** et Codespace er et *udviklingsmiljø* — det går i dvale efter
> inaktivitet og skal køre, for at live-AI virker. Perfekt til at **teste og få
> det op at køre nu**. Til et altid-tilgængeligt værktøj for flere sælgere er en
> rigtig vært (Vercel m.fl.) eller en altid-kørende server bedre. Den offentlige
> port er desuden åben for alle med URL'en, så brug den kun internt/afskærmet.

Begge veje bruger samme kerne ([`api/_core.mjs`](api/_core.mjs)) og er
provider-agnostiske: vil man bruge en anden model (Flux, Gemini m.fl.), ændrer
man blot kernen til at kalde det API — kontrakten ud mod appen (`{ imageData }`)
er den samme.

### Fælles katalog & backup (Supabase-database)

Når en sælger er logget ind, gemmes **armaturkataloget og alle visualiseringer i
en fælles Supabase-database** i stedet for browserens localStorage. Det betyder:

- **Hele teamet ser det samme katalog** — ét sted at vedligeholde armaturer.
- **Ingen datatab** ved ryddet browser, nyt device eller ny telefon.
- **Ingen 5 MB-grænse** — kvote-tjekket før generering gælder kun lokal tilstand.
- **Migration:** første gang en logget-ind bruger åbner værktøjet mod en tom
  database, uploades de eksisterende lokale data (katalog + visualiseringer)
  automatisk, så intet går tabt ved skiftet.
- Skriv-semantik: sidste-skriver-vinder **pr. element** (upsert på id).

**Engangsopsætning:** kør [`supabase/schema.sql`](supabase/schema.sql) i
Supabase → **SQL Editor** → New query → indsæt filen → **Run**. Scriptet
opretter to tabeller (`viz_fixtures`, `viz_visualizations`) med Row Level
Security, så **kun loggede-ind brugere** kan læse/skrive — anonyme kald afvises,
selvom anon-nøglen er offentlig. Scriptet kan køres igen uden skade.

Siderne viser en lille badge — **☁ Fælles** (databasen) eller **Kun denne
browser** (lokal tilstand, fx testbuilds) — så man altid ved, hvor data bor.
Datalaget ligger i [`src/lib/vizData.ts`](src/lib/vizData.ts); uden login falder
det automatisk tilbage til det hidtidige localStorage-repository.

Billeder gemmes inline i rækkerne (nedskaleret JPEG, typisk 200–500 KB pr.
billede). Supabase' gratis plan har 500 MB database — rigeligt til at starte;
ved stor volumen kan billederne senere flyttes til Supabase Storage uden at
ændre resten.

### Adgangskontrol (login med Supabase)

Visualiseringen kan låses, så kun green light-brugere har adgang — og så kun
loggede-ind brugere kan bruge jeres OpenAI-credits. Beskyttelsen sker **to steder**:

- **Frontend**: visualiserings-siderne kræver login (Supabase Auth). Til lokal
  test kan login slås fra med `VITE_SUPABASE_URL=off` ved build.
- **Proxy (server)**: proxyen verificerer brugerens Supabase-token mod
  `/auth/v1/user`, *før* den kalder OpenAI. Uden gyldigt login → `401`. Det er den
  rigtige beskyttelse — en frontend-lås alene kan omgås.

Proxyen **fejler lukket**: mangler `SUPABASE_URL`/`SUPABASE_ANON_KEY` i miljøet,
afvises *alle* kald med `503` (en glemt env-variabel efterlader aldrig et
betalings-endpoint åbent). Til lokal test kan `ALLOW_ANONYMOUS=1` sættes
eksplicit. Derudover er der en **forbrugsbremse**: maks.
`RATE_LIMIT_PER_HOUR` (default 20) genereringer pr. bruger pr. time og
`RATE_LIMIT_GLOBAL_PER_DAY` (default 300) i alt pr. dag (best effort pr.
serverless-instans — sæt desuden et hårdt forbrugsloft + budget-alarm direkte
hos OpenAI som sidste bremse). CORS er som standard begrænset til appens egne
adresser; `ALLOWED_ORIGIN` kan tilføje én ekstra (eller `*` til lokal test).
Billeder over 8 MB og ikke-billed-payloads afvises før OpenAI kaldes.

Opsætning:

1. **Supabase-projekt**: brug et eksisterende eller opret et. Notér *Project URL*
   og *anon/publishable key* (Settings → API). Slå offentlig signup fra og opret
   sælgernes brugere (Authentication → Users), evt. begræns til jeres domæne.
2. **Frontend-config**: de offentlige klient-værdier (Supabase URL + anon-nøgle +
   proxy-endpoint) ligger i [`src/appConfig.ts`](src/appConfig.ts). Er de sat der
   (eller via `VITE_*` build-env, som vinder), er login slået til for hele holdet
   ved næste deploy — ingen GitHub Variables nødvendige.
3. **Proxy-config** (i Vercel → Environment Variables):
   - `SUPABASE_URL` = samme projekt-URL
   - `SUPABASE_ANON_KEY` = samme anon-nøgle
   - `ALLOWED_EMAIL_DOMAIN` = fx `green-light.dk` (valgfri – kun disse e-mails får adgang)
   - `OPENAI_API_KEY` (den hemmelige – kun her, aldrig i klienten)
   - *Redeploy* bagefter.

Anon-nøglen er offentlig og sikker i klienten; den er ikke en hemmelighed.

### Udrulning til hele teamet

De offentlige klient-værdier er bygget ind i [`src/appConfig.ts`](src/appConfig.ts),
så alle sælgere får **Live AI + login** automatisk ved næste deploy — uden manuel
opsætning pr. bruger. Vil man i stedet styre dem uden at commite værdier, kan de
sættes som GitHub *Actions Variables* (`VITE_VISUALIZATION_ENDPOINT`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — build-env vinder over `appConfig`.
Det eneste, der SKAL sættes i et dashboard, er proxyens server-miljø i Vercel
(ovenfor), fordi `OPENAI_API_KEY` er hemmelig.

### Vigtigt / forbehold

- Visualiseringen er **illustrativ**, ikke en garanteret gengivelse – samme
  forbeholdslinje som estimatet ("kvalificeret estimat, ikke bindende tilbud").
- Logget ind gemmes data i den **fælles Supabase-database** (se ovenfor);
  uden login (testbuilds) bruges browserens `localStorage` (~5 MB, nedskalerede
  billeder).
- Kundefotos er forretnings-/persondata – opbevaring (Supabase-region),
  samtykke og sletning skal håndteres (GDPR), og fotos sendes til OpenAI (USA)
  ved live-AI-generering.

---

## Hvor beregningsdata kan ændres

Alle satser ligger samlet i [`src/lib/pricingConfig.ts`](src/lib/pricingConfig.ts).

```ts
// fokusområder i v1 (flere aktiveres ved at udvide listen)
focusAreas: ["Kontor", "Industri"],

// armaturprodukter pr. område – pris pr. stk. er materialeprisen
luminaireProducts: {
  Kontor:   [ { id: "vivid", name: "Vivid", pricePerUnit: 1500 },
              { id: "rio2",  name: "Rio 2", pricePerUnit: 1000 } ],
  Industri: [ { id: "foxx",  name: "Foxx",  pricePerUnit: 1000 },
              { id: "linda", name: "Linda", pricePerUnit: 1400 },
              { id: "forte", name: "Forte", pricePerUnit: 1200 } ],
},

// styringsformer. Systemerne (DALI, DALI-2, DALI+, Casambi,
// MasterConnect, SmartScan…) er INKLUDERET i armaturprisen (0 kr) og
// udelukker hinanden (exclusive: true). Tilvalg koster ekstra og kan
// kombineres: sensor og dagslysstyring – samt gateway via Tunable White
controlSurcharge: {
  MasterConnect:    { perLuminaire: 0,   fixed: 0, exclusive: true },
  Bevægelsessensor: { perLuminaire: 220, fixed: 0, exclusive: false },
  Dagslysstyring:   { perLuminaire: 180, fixed: 0, exclusive: false },
  // …
},

// kelvin-tillæg – kun Tunable White (især med gateway) flytter prisen
luminaireByKelvin: { "Tunable White": 250, "Tunable White + Gateway": 700, … },

// installationspris pr. armatur
installationPerLuminaire: 520,

// områdefaktorer (multiplikator på installationen)
areaFactor: { Kontor: 1.05, Industri: 1.15, … },

// lux-/watt-tabeller – lux flytter mest på energi, minimalt på pris
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
