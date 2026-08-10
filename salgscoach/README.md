# green light · Salgscoach

Et internt salgsudviklingssystem, hvor hver sælger kan træne med stemmen mod en
krævende AI-salgsdirektør — bygget oven på **green lights egen salgsmanual (V3)**.

> Det er ikke en chatbot med salgsviden. Det er et system, der kender manualen,
> kender virksomheden, kender sælgeren og husker, hvordan han udvikler sig.

---

## Hvad det gør

| Område | Indhold |
|---|---|
| **Talt træning** | 15 træningsformer — kunderollespil, behovsafdækning, indvendinger, salgsmøde, telefon, kvalificering, næste skridt, forhandling, mødeforberedelse, debriefing, tilbudsopfølgning, lynild, manualeksamen, fri coaching og præsentation af eget materiale |
| **Rigtig samtale** | Realtime-stemme over WebRTC: man kan afbryde, blive afbrudt, holde pause og høre kundens tøven, skepsis og utålmodighed |
| **Salgsmanualen** | 20 kapitler, 36 strukturerede principper med manualens **ordrette** danske replikker, plus de tre salgschecklister |
| **Materialeanalyse** | Upload et rigtigt tilbud, en PowerPoint eller en business case — og få den gennemgået på indhold, ikke i generelle vendinger. Bagefter kan præsentationen øves mod en AI-kunde |
| **Udviklingshukommelse** | Coachen leder efter **gentagne** mønstre på tværs af sessioner og presser bevidst på dem næste gang |
| **Ledelsesoverblik** | Teamets tilbagevendende svagheder, anbefalet fælles træning og hvor teamet driver væk fra manualen |

---

## Kom i gang

```bash
cd salgscoach
npm install
npm run dev          # http://localhost:5174
npm run build        # produktionsbuild i ./dist
npm run lint         # typetjek
```

Appen er **selvstændig**: egen `package.json`, eget build, egen `dist`. Den deler
hverken kode, afhængigheder eller byggetrin med estimatværktøjet i `/src` — den
kan brydes, ombygges eller fjernes uden at røre de eksisterende værktøjer.

På GitHub Pages ligger den under `/salgscoach/`. Byggetrinnet i
`.github/workflows/deploy.yml` kører med `continue-on-error`, så et brud her
aldrig kan vælte deployet af estimatet, tidsregistreringen eller dokumenttjekket.

---

## Arkitektur

```
salgscoach/                 (browser — indeholder INGEN manualtekst)
├── src/voice/              Stemmemotor: realtime (WebRTC) + reservestemme
├── src/pages/              Skærmbilleder
├── src/ui/                 Designsystem
├── src/lib/                Typer, API-klient, datalag, login
└── src/app/                Ruter og skal

api/                        (server — Vercel-funktioner)
├── _manual.mjs             ★ Salgsmanualen som strukturerede principper
├── _coachprompt.mjs        Coachens adfærd, træningsformer, feedback-skemaer
├── _personas.mjs           Kundepersonaer med SKJULT information
├── _greenlight.mjs         Produkt-, teknik- og casesviden
├── _coach.mjs              Modelkald, kryptering, realtime-nøgler, filudtræk
├── coach.js                Samtale · analyse · profil · materiale · team
├── coach-session.js        Udsteder midlertidig realtime-nøgle
└── coach-speak.js          Tale-syntese (reservestemmen)

supabase/salescoach-schema.sql   Tabeller + adgangskontrol (RLS)
```

### Hvorfor manualen ligger på serveren

Sitet på GitHub Pages er offentligt tilgængeligt. Alt der importeres af
browser-koden, ender i en JavaScript-fil, som enhver kan hente. Manualen er
green lights interne metodik, og den skal derfor **aldrig** importeres fra
`salgscoach/src`.

Browseren får kun et **manifest** — kapitel- og princip-titler til visning.
Selve teksten forlader aldrig serveren; den bages ind i modellens instruktion,
før modellen svarer.

Samme princip gælder rollespillet: kundens **skjulte** oplysninger krypteres
server-side (AES-GCM) til en uigennemsigtig `hiddenBlob`. Sælgeren kan altså
ikke åbne udviklerværktøjerne og læse, hvad kunden gemmer på — informationen
skal graves frem med spørgsmål, præcis som hos en rigtig kunde.

---

## Konfiguration

### Vercel (server) — Project → Settings → Environment Variables

| Variabel | Påkrævet | Standard | Forklaring |
|---|---|---|---|
| `OPENAI_API_KEY` | ja | – | Deles med de eksisterende værktøjer |
| `SUPABASE_URL` | ja | – | Håndhæver login. Mangler den, er alt lukket |
| `SUPABASE_ANON_KEY` | ja | – | do. |
| `COACH_SECRET` | anbefalet | udledes af API-nøglen | Krypterer kundens skjulte oplysninger |
| `ALLOWED_EMAIL_DOMAIN` | valgfri | – | Fx `green-light.dk` |
| `COACH_MODEL` | valgfri | `gpt-5` | Analyse, feedback, profil, materiale |
| `COACH_FAST_MODEL` | valgfri | `gpt-5-mini` | Tekstsamtale (lavere svartid) |
| `COACH_REALTIME_MODEL` | valgfri | `gpt-realtime` | Stemmen |
| `COACH_TRANSCRIBE_MODEL` | valgfri | `gpt-4o-mini-transcribe` | Transskription |
| `COACH_TTS_MODEL` | valgfri | `gpt-4o-mini-tts` | Reservestemmen |
| `RATE_LIMIT_PER_HOUR` | valgfri | 20 | Forbrugsbremse pr. bruger |

### GitHub Actions Variables (build)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_COACH_API_BASE`
(fx `https://website-test-gl.vercel.app/api`) og `VITE_COACH_MANAGERS`
(kommasepareret liste af ledere, fx `mkj@green-light.dk`).

### Supabase

Kør `supabase/salescoach-schema.sql` én gang i SQL Editor. Scriptet er
idempotent og rører **ikke** de eksisterende tabeller. Nederst i filen ligger
en klar-til-brug skabelon, der opretter JAS, ALH, KMA, HRN og MKJ — og giver
MKJ rollen `leder`.

---

## Adgang og fortrolighed

| | Sælger | Leder |
|---|---|---|
| Egne sessioner og feedback | læs / skriv | **læs** |
| Egen udviklingsprofil | læs / skriv | **læs** |
| Andres sessioner og profiler | nej | læs |
| **Uploadet kundemateriale** | kun eget | **nej — heller ikke lederen** |
| Salgsmanualen | læs | læs / opdatér |

Materialet er bevidst privat for sælgeren. Skal en sælger turde uploade et
rigtigt kundetilbud, må han ikke skulle overveje, hvem der kigger med — ellers
uploader han kun det harmløse, og analysen bliver værdiløs.

Ledelsesoverblikket er et **coachingværktøj**, ikke overvågning: ingen
rangliste, ingen point, ingen 0-100-score. Det svarer på fire spørgsmål — hvad
skal jeg coache denne sælger på, hvad skal vi træne som team, hvilke mønstre
tegner sig, og hvor driver vi væk fra salgsmanualen.

---

## Når salgsmanualen opdateres

Manualen findes strukturereret i `api/_manual.mjs` (kapitler, principper,
ordrette replikker, checklister). Ved en ny version er der to veje:

1. **Redigér `api/_manual.mjs`** — tilføj eller ret principper. Hvert princip
   har `statement`, `rationale`, `inPractice`, `questions`, `antiPatterns` og
   `modes`; det er `antiPatterns`, coachen bruger som radar for, hvornår et
   princip *ikke* efterleves.
2. **Upload en ny manual** fra ledelsesoverblikket. Den lægges i
   `coach_manual` i Supabase og lægger sig oven på den indbyggede.

Coachen dumper aldrig hele manualen ind i en samtale — den vælger de relevante
principper for øvelsen og bruger manualens egne formuleringer.

---

## Stemmen

Primærvejen er realtime over WebRTC. Serveren udsteder en kortlivet nøgle
(`ek_…`), som kun gælder den ene session; den rigtige API-nøgle forlader aldrig
serveren.

Kan realtime ikke nås — manglende nøgle, blokeret netværk, en browser der ikke
kan WebRTC — falder appen automatisk tilbage til browserens talegenkendelse
plus tale-syntese fra serveren, og **siger det ærligt på skærmen**. Kan browseren
heller ikke det, kører øvelsen på skrift. Sælgeren står aldrig i en blindgyde.
