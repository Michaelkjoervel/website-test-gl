# green light · Dokumenttjek

Et **selvstændigt** værktøj der ensretter tilbud og ordrebekræftelser efter
green lights tjekliste. Det hænger ikke sammen med estimatberegneren – ingen
delt kode, intet build-step, ingen backend.

## Sådan bruges det

1. Åbn værktøjet (`…/website-test-gl/dokumenttjek/` når det er deployet, eller
   åbn `index.html` direkte).
2. Træk et Word-dokument (.docx) eller en tekstfil (.txt) ind – gerne flere ad
   gangen.
3. Programmet retter automatisk alt, der afviger fra tjeklisten, og viser hver
   rettelse med sammenhæng (før → efter).
4. Klik **Hent rettet fil** – formatering, logo, tabeller, sidehoved/sidefod og
   layout er bevaret; kun teksten er rettet.

Fanen **Indsæt tekst** gør det samme for løs tekst (fx en mail-kladde), og
**Tjeklisten** er selve regelsættet.

## Tjeklisten (reglerne)

- Hver regel er én ensretning: *find → erstat*, med valgmulighederne
  **hele ord** (dansk-sikker, forstår æ/ø/å), **store/små bogstaver**,
  **smart case** (bevarer stort begyndelsesbogstav, fx `Ihht.` → `Iht.`) og
  **regulært udtryk** til avancerede mønstre.
- Reglerne køres oppefra og ned; de kan slås til/fra, redigeres, flyttes og
  slettes direkte i programmet, og hver regel kan afprøves på en prøvetekst i
  redigerings-dialogen.
- Ændringer gemmes automatisk i browserens `localStorage`. **Eksportér** giver
  en JSON-fil, som kolleger kan **Importere**, så hele teamet kører samme
  tjekliste.
- **Gendan standardregler** henter listen i [`rules.js`](rules.js) igen. Skal
  jeres egen tjekliste være standard for alle, lægges den ind i `rules.js`.

## Hvad der bevidst IKKE røres

- **Webadresser og e-mails** – `green-light.dk` bliver fx aldrig "rettet" til
  firmanavnets skrivemåde.
- **Track changes** – slettet tekst (`w:delText`) i dokumenter med
  ændringsmarkering står urørt.
- **Al formatering og alle andre dokumentdele** – kun tekstindholdet i
  brødtekst, tabeller, tekstbokse, sidehoveder/-fødder og fod-/slutnoter
  behandles; resten af .docx-filen pakkes uændret med igen.

## Teknik

| Del | Valg |
|-----|------|
| Zip (.docx er en zip) | [JSZip 3.10.1](jszip.min.js), vendored – ingen CDN |
| Tekstrettelse | Regex med unicode-ordgrænser, kørt pr. afsnit hen over alle `<w:t>`-segmenter, så ord som Word har delt over flere "runs" også rammes |
| Data | Kun browserens `localStorage` (reglerne) – **dokumenter forlader aldrig maskinen** (vigtigt: tilbud indeholder kundedata) |
| Hosting | Statiske filer; deployes under `/dokumenttjek/` af `.github/workflows/deploy.yml` |

Kræver en moderne browser (Chrome/Edge 105+, Firefox 121+, Safari 16.4+ –
pga. lookbehind-regex og `<dialog>`).
