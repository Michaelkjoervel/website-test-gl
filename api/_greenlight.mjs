// =============================================================================
// api/_greenlight.mjs · green light-viden (produkt, styring, energi, projekt,
// regler, brancher, konkurrence, indvendinger og referencecases)
// -----------------------------------------------------------------------------
// KUN SERVER-SIDE. Filen importeres udelukkende af Vercel-funktionerne og
// bundtes ALDRIG ind i den offentlige browser-JavaScript. Filnavnet starter med
// "_" så Vercel ikke gør den til en HTTP-rute — præcis som _core.mjs og
// _manual.mjs.
//
// Formålet: Salgscoachen skal kunne det faglige stof lige så godt som
// salgsmetoden. Hvert vidensstykke har derfor BÅDE en teknisk korrekt
// beskrivelse (`technical`) OG den samme sag oversat til kundens udbytte
// (`customerOutcome`). Det er ikke pynt — det er manualens kerneregel:
//
//     "Vi sælger ikke armaturer. Vi sælger den rigtige løsning til kunden.
//      Kunden køber ikke LED. Kunden køber et resultat."   (kap. 1)
//
// Coachen må derfor ALDRIG bruge `technical` alene i en kundesamtale, og skal
// slå ned på sælgere, der gør det (manualens antipattern: "Sælgeren beskriver
// DALI, D4i eller Casambi teknisk uden at oversætte til kundens hverdag").
//
// -----------------------------------------------------------------------------
// TAL OG SIKKERHED
// -----------------------------------------------------------------------------
// Alle beregningsantagelser er hentet direkte fra green lights eget
// estimatværktøj, så coachens tal ikke modsiger værktøjets:
//   src/lib/pricingConfig.ts   – energySavings, businessCase, defaults, faktorer
//   src/lib/businessCase.ts    – tilbagebetaling, nettogevinst, afkast, CO₂
//   src/lib/estimateEngine.ts  – før/efter-energisammenligningen
// Konkret genbrugt: styring sparer 70% af det NYE anlægs forbrug,
// dagslysstyring sparer yderligere 20% af det RESTERENDE forbrug,
// CO₂-faktor 0,133 kg/kWh (dansk miljødeklaration), 15 års betragtnings-
// periode, 3% årlig el-prisstigning, montage indgår ikke i tilbagebetalingen.
//
// Alt der er et erfaringstal, et typisk niveau eller en beregningsantagelse —
// og ikke et dokumenteret faktum for den konkrete kunde — er markeret med
// `indicative: true`. Coachen SKAL sige det højt, når den bruger et sådant tal.
//
// -----------------------------------------------------------------------------
// VIGTIGT OM CASES (integritet)
// -----------------------------------------------------------------------------
// Alle cases i `CASES` er ILLUSTRATIVE PLADSHOLDERE — ikke verificerede
// kundereferencer. De er skrevet ud fra typiske danske B2B-belysningsprojekter
// og manualens struktur (Situation → Problem → Konsekvens → Løsning →
// Resultat), så coachen kan træne casebrug realistisk.
//
//   * Ingen case nævner en navngiven kunde. Der bruges generiske beskrivelser
//     ("produktionsvirksomhed på Sjælland, ca. 8.000 m²").
//   * Alle cases har `indicative: true`.
//   * Coachen skal ALTID præsentere dem som "et typisk eksempel" / "sådan ser
//     det typisk ud" — ALDRIG som "vi har lavet det hos X" eller som en
//     reference sælgeren kan citere over for en kunde.
//   * De skal udskiftes med green lights RIGTIGE, godkendte cases (med kundens
//     accept af at blive nævnt). Indtil da må tallene ikke bruges i tilbud,
//     materiale eller kundevendte præsentationer som dokumentation.
//
// Ændres green lights produktprogram, styringsplatforme eller beregnings-
// grundlag, ændres denne fil.
// =============================================================================

/* ------------------------------------------------------------------- Meta */

export const KNOWLEDGE_META = {
  title: "green light-viden",
  language: "da",
  /** Den regel al viden i filen tjener. */
  translationRule:
    "Enhver teknisk egenskab skal oversættes til et kundeudbytte, før den siges højt. Teknik uden udbytte er en produktpræsentation — og produktpræsentationer gør green light sammenlignelig på pris.",
  /** Kilder i repoet, som tallene er hentet fra. */
  calculationSources: [
    "src/lib/pricingConfig.ts",
    "src/lib/businessCase.ts",
    "src/lib/estimateEngine.ts",
  ],
};

/**
 * Beregningsantagelser fra estimatværktøjet — samlet ét sted, så coachen kan
 * citere dem præcist. Ændres pricingConfig.ts, ændres disse tal med.
 */
export const CALC_ASSUMPTIONS = {
  controlSavingShare: 0.7, // styring: 70% af det NYE anlægs basisforbrug
  daylightSavingShareOfRest: 0.2, // dagslys: 20% af det RESTERENDE forbrug
  co2FactorKgPerKwh: 0.133, // dansk miljødeklaration
  horizonYears: 15,
  electricityPriceEscalationPct: 3,
  maintenanceSavingsPerLuminaire: 0, // bevidst konservativt = 0
  defaultBurnHours: 2500,
  defaultElectricityPrice: 2.1,
  defaultLuxLevel: 300,
  defaultKelvin: 4000,
  typicalCurrentWatt: 58, // typisk eksisterende armatur (lysstof)
  typicalNewWatt: 35, // typisk nyt LED-armatur
  budgetRangePct: 12, // estimatets ±-interval
  equivalents: {
    treeKgPerYear: 21,
    carKgPerYear: 2000,
    flightCphLondonReturnKg: 230,
    householdKwhPerYear: 4000,
  },
};

/* -------------------------------------------------------------- Videnbase */
/**
 * KnowledgeItem (jf. salgscoach/src/lib/types.ts):
 *   id, category, title, technical, customerOutcome, useWhen, pitfalls?,
 *   keywords, indicative?
 */
export const KNOWLEDGE = [
  /* =================================================== STYRING (lysstyring) */
  {
    id: "st-hvad-styring-giver",
    category: "styring",
    title: "Hvad lysstyring reelt giver kunden (uanset platform)",
    technical:
      "Styring gør fem ting: zoneopdeling (lys kun der hvor der arbejdes), tilstedeværelsesstyring (bevægelses-/tilstedeværelsessensor tænder, dæmper og slukker), dagslysstyring (armaturet dæmper ned når dagslyset bidrager), tidsplaner/scener (skift, pauser, rengøring, weekend) og overvågning (driftstimer, energidata, fejlmelding). Teknisk sker det ved at driveren kan dæmpes og adresseres individuelt eller i grupper, og at sensorer/tryk/tidsstyring kan sende kommandoer til den enkelte adresse eller gruppe.",
    customerOutcome:
      "Kunden betaler kun for lys, der bliver brugt. Lyset er tændt, hvor der arbejdes, og nede, hvor der ikke er nogen — uden at nogen skal huske en afbryder. Det er den del af projektet, der flytter mest på driftsomkostningen, og den del, der giver kunden mulighed for at ændre lyset senere uden at bygge om.",
    useWhen: [
      "Kunden siger, at armaturskiftet i sig selv er nok",
      "Kunden sammenligner tilbud, hvor styring ikke er med i det billige",
      "Store arealer med ujævn belægning (lager, produktion, kontorlandskab)",
      "Kunden vil kunne dokumentere forbrug og besparelse bagefter",
    ],
    pitfalls: [
      "At sælge styring som en teknisk platform i stedet for som lys, der følger arbejdet",
      "At love en besparelsesprocent uden at kende belægning og brændetimer",
      "At glemme, at styring kræver idriftsættelse (indregulering) — ellers står anlægget bare på 100%",
    ],
    keywords: [
      "styring",
      "zoner",
      "sensor",
      "tilstedeværelse",
      "dagslys",
      "tidsplan",
      "scener",
      "overvågning",
      "dæmpning",
    ],
  },
  {
    id: "st-dali",
    category: "styring",
    title: "DALI — den kablede, adresserbare standard",
    technical:
      "DALI (Digital Addressable Lighting Interface, IEC 62386) er en digital styrebus: to ekstra ledere ved siden af forsyningen, polaritetsfri, lav spænding. Hver driver får sin egen adresse — op til 64 adresser pr. buslinje, med 16 grupper og 16 scener pr. linje. Kommunikationen går begge veje, så driveren kan svare tilbage (fx lysniveau og fejl). Større anlæg bygges af flere linjer koblet sammen via controllere/gateways. I den oprindelige DALI-generation var kun selve driverne standardiseret — sensorer og tryk var fabrikatafhængige.",
    customerOutcome:
      "Kunden kan styre hvert enkelt armatur eller grupper af armaturer præcist, og kan lave zoner om senere uden at flytte kabler — det er programmering, ikke ombygning. Når produktionen omlægges eller kontoret møbleres om, følger lyset med.",
    useWhen: [
      "Nybyg eller renovering hvor der alligevel trækkes nye kabler",
      "Kunden vil have en åben, veldokumenteret standard frem for én leverandørs system",
      "Anlæg hvor lyset skal kunne zoneinddeles anderledes om få år",
    ],
    pitfalls: [
      "At sælge DALI ind i en eksisterende installation uden at have afklaret, om der overhovedet er trukket styrekabel — det er ofte projektets dyreste overraskelse",
      "At forklare bus, adresser og grupper til en driftschef, der bare vil vide, hvad lyset gør klokken 22",
    ],
    keywords: ["DALI", "bus", "adresse", "gruppe", "scene", "styrekabel", "IEC 62386", "kablet"],
  },
  {
    id: "st-dali-2",
    category: "styring",
    title: "DALI-2 — samme bus, men sensorer og tryk er også standardiseret",
    technical:
      "DALI-2 er den udvidede version af IEC 62386, hvor ikke kun styregear (drivere) men også input-enheder — bevægelses-/tilstedeværelsessensorer, dagslyssensorer, trykknapper — og applikationscontrollere er omfattet af standarden, og hvor flere controllere kan dele samme bus. Produkter certificeres gennem brancheorganisationen DiiA og optages i et offentligt register. Praktisk betyder det, at en sensor fra ét fabrikat kan arbejde sammen med en driver fra et andet, inden for de certificerede funktioner.",
    customerOutcome:
      "Kunden bliver ikke låst til ét fabrikat på sensorer og betjening. Om fem år kan en defekt sensor erstattes med en anden certificeret sensor — ikke kun med den ene, der stod i det oprindelige tilbud. Det er reservedelssikkerhed, ikke teknik.",
    useWhen: [
      "Kunden er bekymret for leverandørafhængighed",
      "Bygningsejere og offentlige kunder, der skal kunne vedligeholde anlægget i mange år",
      "Rådgiverstyrede projekter hvor der kræves en åben standard",
    ],
    pitfalls: [
      "At påstå at “DALI-2 er DALI-2” — certificeringen dækker de testede dele, mens systemfunktioner (apps, dashboards, scenehåndtering) stadig er fabrikatafhængige. Sig det ærligt.",
      "At bruge certificeringen som kvalitetsargument i stedet for som tryghedsargument",
    ],
    keywords: ["DALI-2", "DiiA", "certificering", "sensor", "tryk", "interoperabilitet", "åben standard"],
    indicative: true,
  },
  {
    id: "st-d4i",
    category: "styring",
    title: "D4i — data og strøm inde i armaturet",
    technical:
      "D4i er en DiiA-certificeret udvidelse af DALI-2 til det, der sker inde i armaturet: driveren kan levere hjælpespænding til en sensor eller en trådløs node monteret i/på armaturet, og den lagrer standardiserede data i faste hukommelsesbanke — armaturdata (fabrikat, type, nominel effekt, lysstrøm, produktionsdato) og driftsdata (energiforbrug i kWh, driftstimer, antal tændinger, drivertemperatur, fejlkoder). Kombineret med et Zhaga-stik gør det, at en trådløs styringsnode kan sættes i eller skiftes uden at åbne armaturet.",
    customerOutcome:
      "Kunden får et anlæg, der selv kan fortælle, hvad det bruger, hvor længe det har kørt, og hvad der er ved at fejle — i stedet for at det opdages, når hallen står mørk. Det giver et vedligeholdsbudget baseret på tal frem for gætværk, og et energital til kundens egen rapportering. Og hvis kunden senere vil have trådløs styring, kan noden sættes på uden at armaturet skal ned.",
    useWhen: [
      "Kunden arbejder med ESG-, energi- eller CO₂-rapportering",
      "Kunden har mange armaturer og ingen styr på hvad der sidder hvor (asset-data)",
      "Kunden vil kunne udvide med styring senere, uden at binde sig nu",
      "Højtsiddende armaturer hvor hver serviceudkørsel koster lift og driftstid",
    ],
    pitfalls: [
      "At sælge D4i som rapportering. D4i er data I armaturet — der skal et system/gateway til at samle dem op, før der kommer en rapport ud af det. Sig hvad der skal til.",
      "At bruge driverens energital som en afregningsmåling — det er driverens egen måling, ikke en kalibreret måler",
      "At tale om hukommelsesbanke i stedet for om, hvad kunden kan se på skærmen",
    ],
    keywords: ["D4i", "Zhaga", "asset", "driftsdata", "energidata", "driftstimer", "diagnostik", "ESG"],
    indicative: true,
  },
  {
    id: "st-daliplus",
    category: "styring",
    title: "DALI+ — den kablede styring uden kablet (og hvordan den sælges)",
    technical:
      "DALI+ er en DiiA-specifikation, hvor DALI-kommandoerne — samme applikationslag som DALI-2 og D4i, altså samme adresser, grupper, scener og data — sendes over et trådløst/IP-baseret bærelag i stedet for den klassiske to-leder bus. Første offentliggjorte bærelag er et trådløst mesh (Thread). Kablede DALI-segmenter og trådløse DALI+-segmenter kan kobles sammen via en bridge, så et anlæg kan være delvist kablet og delvist trådløst. Modenheden er lavere end DALI-2/D4i: der er færre produkter på markedet, og i praksis vil man ofte være afhængig af én producents implementering.",
    customerOutcome:
      "Sådan forklares det kommercielt — uden ét teknisk ord: “I kan få præcis den styring, der plejer at kræve et ekstra kabel til hvert eneste armatur — uden at vi skal op i loftet og trække nyt. Det er den samme styring; den kører bare trådløst. Det betyder kortere montagetid, færre dage hvor vi er i vejen for jer, og at I kan starte med ét område og bygge videre, uden at det første bliver spildt.” Kunden køber altså: mindre indgreb i driften, hurtigere gennemførelse, og samme muligheder for zoner, dagslys, tilstedeværelse og data som et kablet anlæg.",
    useWhen: [
      "Renovering i eksisterende bygning uden styrekabel — og hvor kunden er stoppet af prisen på at trække nyt",
      "Fredede/vanskelige bygninger, betondæk, kabelbakker der er fyldt op",
      "Kunden vil have en åben standard, men kan ikke leve med kabelarbejdet",
      "Etapevis udrulning hvor etape 1 skal kunne udvides",
    ],
    pitfalls: [
      "At forklare DALI+ teknisk. Kunden skal ikke høre om bærelag, mesh eller protokoller — kunden skal høre “samme styring, uden kabelarbejdet”.",
      "At sælge DALI+ som færdigmodent på niveau med DALI-2/D4i. Vær ærlig: udvalget er mindre, og løsningen bindes typisk til én producents implementering.",
      "At vælge trådløst udelukkende for at spare installation — dæknings- og placeringsplan skal stadig laves",
    ],
    keywords: ["DALI+", "trådløs", "retrofit", "uden styrekabel", "mesh", "bridge", "renovering"],
    indicative: true,
  },
  {
    id: "st-casambi",
    category: "styring",
    title: "Casambi — trådløst mesh, app-styret, hurtigt at sætte op",
    technical:
      "Casambi er et producentspecifikt trådløst mesh-netværk over Bluetooth Low Energy. Styringen ligger distribueret i selve enhederne — der skal ikke nødvendigvis en central controller til. Noden kan være indbygget i armaturet, sidde i driveren eller være et separat modul. Opsætning, zoner, scener og tidsplaner laves fra en app på telefon/tablet. En gateway giver fjernadgang og gør tidsplaner uafhængige af, om nogen står i bygningen med en telefon. Et netværk har en øvre grænse for antal enheder (typisk i størrelsesordenen 100-250 afhængigt af generation), så større anlæg deles op i flere netværk.",
    customerOutcome:
      "Kunden kan få rigtig lysstyring i en eksisterende bygning uden at der skal trækkes ét eneste nyt styrekabel — og kan selv ændre zoner og tidsplaner bagefter, når produktionen eller kontoret ændrer sig. På et mindre eller mellemstort anlæg er det ofte forskellen på, om styring overhovedet kan betale sig.",
    useWhen: [
      "Retrofit i eksisterende bygning, ingen styrekabler",
      "Mindre og mellemstore anlæg, kontorer, butikker, klubhuse, mindre haller",
      "Kunden vil selv kunne rette til efter ibrugtagning",
      "Pilotprojekt der skal stå og virke hurtigt",
    ],
    pitfalls: [
      "At glemme overdragelsen: den der har administratoradgangen/netværksnøglen, ejer reelt anlægget. Den SKAL overdrages dokumenteret til kunden — ellers har vi bygget en afhængighed, ikke en løsning.",
      "At antage at radioen “nok skal nå”: metalreoler, brandsektioner og betondæk kræver at netværket planlægges",
      "At sælge det ind på meget store anlæg uden at fortælle, at det bliver flere netværk med hver sin administration",
      "At love fjernadgang uden gateway og netværk",
    ],
    keywords: ["Casambi", "Bluetooth", "trådløs", "app", "mesh", "gateway", "retrofit", "zoner"],
    indicative: true,
  },
  {
    id: "st-valg-af-platform",
    category: "styring",
    title: "Sådan vælges styringsplatform (og hvorfor kunden ikke skal vælge den)",
    technical:
      "Valget afgøres af fire ting, ikke af smag: 1) findes der styrekabel, eller skal der trækkes nyt? 2) hvor stort og hvor opdelt er anlægget (antal adresser, zoner, bygninger)? 3) hvem skal kunne betjene og ændre det bagefter — en driftsafdeling, en ekstern serviceleverandør eller ingen? 4) skal der komme data ud (energi, driftstimer, fejl) til rapportering? Kablet DALI/DALI-2 er stærkest, hvor der alligevel trækkes nyt og anlægget skal leve længe; trådløst (Casambi, DALI+) er stærkest i renovering af eksisterende bygninger og i etapevis udrulning.",
    customerOutcome:
      "Kunden skal ikke tage stilling til protokoller. Kunden skal svare på, hvordan bygningen bruges, hvem der skal kunne ændre lyset, og hvad der skal kunne dokumenteres — så følger valget af sig selv. Det er præcis dér, green light er rådgiver frem for leverandør.",
    useWhen: [
      "Kunden spørger “hvilket system skal vi have?”",
      "Kunden har fået tre tilbud med tre forskellige styringer og kan ikke sammenligne",
      "Rådgiveren har allerede skrevet en platform ind i udbuddet",
    ],
    pitfalls: [
      "At starte i platformen i stedet for i bygningen og driften",
      "At vælge trådløst kun fordi det er billigst at montere — uden at spørge, hvem der skal have adgangen bagefter",
      "At lade kunden vælge system ud fra det, deres elektriker plejer at bruge",
    ],
    keywords: ["valg", "platform", "system", "sammenligning", "rådgivning", "styring"],
  },
  {
    id: "st-graenser-og-idriftsaettelse",
    category: "styring",
    title: "Styringens ærlige begrænsninger — og hvorfor idriftsættelsen afgør resultatet",
    technical:
      "Styring leverer ikke besparelse ved at blive monteret. Den leverer besparelse, når den er indreguleret: sensorernes dækning og efterløbstid, dagslysniveauer, grupper, scener og tidsplaner skal sættes efter, hvordan arealet faktisk bruges. Typiske fejl i praksis: sensorer placeret så de ser en kørevej i stedet for en arbejdsplads, efterløbstider sat så højt at lyset aldrig når at slukke, dagslysstyring indreguleret på en gråvejrsdag, og zoner der ikke svarer til, hvordan skiftene ligger. Dertil kommer, at anlægget skal overdrages: dokumentation, adgang, licenser og hvem der må ændre hvad.",
    customerOutcome:
      "Kunden får den besparelse, der blev regnet på, i stedet for et anlæg der står på fuldt lys, fordi ingen fik det sat rigtigt op. Og kunden ved, hvem der ejer adgangen den dag, den medarbejder der satte det op, har skiftet job.",
    useWhen: [
      "Kunden har prøvet styring før og var utilfreds ('sensorerne slukkede lyset for os')",
      "Ved sammenligning med et billigt tilbud hvor idriftsættelse ikke er med",
      "Ved overdragelse og aftale om næste skridt",
    ],
    pitfalls: [
      "At sælge styring uden at prissætte idriftsættelse og overdragelse — så bliver det kundens problem bagefter",
      "At love en besparelse uden at have set, hvordan arealet faktisk bruges i løbet af et døgn",
      "At undlade at fortælle, at der typisk skal justeres én gang mere efter et par uger i drift",
    ],
    keywords: [
      "idriftsættelse",
      "indregulering",
      "commissioning",
      "overdragelse",
      "efterløb",
      "sensor",
      "dokumentation",
    ],
  },

  /* ==================================================== PRODUKT (armaturer) */
  {
    id: "pd-specs",
    category: "produkt",
    title: "Armaturets specs — og hvad hver enkelt betyder for kunden",
    technical:
      "green light arbejder med de specs, der også ligger i Universet: lysstrøm (lumen), effekt (watt), virkningsgrad (lm/W), farvetemperatur (kelvin), farvegengivelse (CRI/Ra), lysfordeling/spredning, tæthedsgrad (IP), blændingstal (UGR), montageform og levetid. Levetid angives som L-værdi ved et antal timer (fx L80 ved 50.000 timer = 80% af lysstrømmen tilbage) og siger intet i sig selv uden temperatur- og driverforudsætninger.",
    customerOutcome:
      "Oversat til kundens sprog: lm/W = hvad det koster at have tændt. Kelvin og CRI = om folk kan se det, de arbejder med, og om lokalet føles rigtigt. Spredning = om lyset rammer arbejdspladsen eller gulvet mellem reolerne. IP = om armaturet holder til vask, støv og fugt. UGR = om folk får ondt i øjnene af at kigge op. Levetid = hvornår kunden skal have lift og montør ud igen.",
    useWhen: [
      "Kunden eller en rådgiver sammenligner datablade",
      "Ved oplæg til teknisk indkøber, hvor tallene skal kunne holde",
      "Når et billigt alternativ ser identisk ud på papiret",
    ],
    pitfalls: [
      "At gennemgå specs oppefra og ned. Vælg de 2-3 specs, der betyder noget i netop denne bygning, og oversæt dem.",
      "At sammenligne lumen på armaturet frem for lux på arbejdsfladen — det er dér kunden mærker forskellen",
      "At citere levetid uden forudsætninger",
    ],
    keywords: [
      "lumen",
      "watt",
      "lm/W",
      "kelvin",
      "CRI",
      "Ra",
      "spredning",
      "IP",
      "UGR",
      "levetid",
      "L80",
      "datablad",
    ],
  },
  {
    id: "pd-kategorier",
    category: "produkt",
    title: "Armaturkategorierne i Universet og hvad de skal kunne",
    technical:
      "Universet (green lights produktbibliotek) er inddelt i de områdetyper, salget faktisk møder: reception, administration/kontor, kontorlandskab og industri/lager. Reception vægter udseende, farvegengivelse og blødt lys; administration/kontor og kontorlandskab vægter blændingsbegrænsning (UGR), jævnhed og dagslysstyring mod facaden; industri/lager vægter lm/W, robusthed (IP/slagfasthed), lysfordeling ned mellem reoler eller ud over et arbejdsområde, og sensorrækkevidde ved store monteringshøjder. Estimatværktøjet arbejder tilsvarende med områdefaktorer på installationen (fx kontor 1,05 og industri 1,15).",
    customerOutcome:
      "Kunden får armaturer, der passer til det, rummet bruges til — ikke ét armatur brugt overalt, fordi det var billigst at købe hjem. Det er forskellen på et anlæg, der virker på tegningen, og et anlæg, der virker på gulvet.",
    useWhen: [
      "Ved gennemgang af en bygning med flere rumtyper",
      "Når kunden vil have “samme armatur i det hele” for at spare",
      "Ved brug af visualiseringsværktøjet, hvor kunden skal se sit eget lokale",
    ],
    pitfalls: [
      "At vise kontorarmaturer til en driftschef fra produktionen (og omvendt)",
      "At glemme monteringshøjden, som ændrer både lysfordeling og sensorvalg",
    ],
    keywords: ["reception", "kontor", "kontorlandskab", "industri", "lager", "univers", "områdetype", "montagehøjde"],
  },
  {
    id: "pd-atex",
    category: "produkt",
    title: "ATEX / eksplosionssikret belysning — hvor det gælder og hvad det ændrer",
    technical:
      "ATEX dækker to EU-regelsæt: udstyrsdirektivet (2014/34/EU) for udstyr til brug i eksplosiv atmosfære, og arbejdsmiljødirektivet (1999/92/EF) hvor arbejdsgiveren skal klassificere sine områder i zoner og udarbejde et eksplosionssikringsdokument. Zoner for gas/dampe: 0 (til stede konstant eller i lange perioder), 1 (lejlighedsvis under normal drift), 2 (sjældent og kortvarigt). For brændbart støv: 20, 21, 22. Armaturet skal have en udstyrskategori og beskyttelsesart, der matcher zonen, og en temperaturklasse/maks. overfladetemperatur, der ligger under stoffets antændelsestemperatur. Installation og eftersyn følger egne standarder (EN 60079-serien). Typiske danske områder: lakerings- og malerkabiner, silo, mølle, foderstof og korn, træstøv i træindustri, sprit- og opløsningsmiddelprocesser, biogas, spildevand, batteri- og brintanlæg.",
    customerOutcome:
      "Her køber kunden ikke lys — kunden køber, at anlægget kan godkendes, at Arbejdstilsynet og forsikringen ikke har en sag, og at hallen ikke skal stå stille, mens noget laves om. Fejlvalg opdages først ved eftersyn eller ved en forsikringssag, og det er dér, prisforskellen på et armatur bliver ligegyldig.",
    useWhen: [
      "Kunden nævner lakering, støv, sprit, silo, foder, korn, biogas, batteri eller brint",
      "Kunden har en zoneplan/eksplosionssikringsdokument liggende",
      "En konkurrent har budt med almindelige armaturer i et område, der er zoneklassificeret",
    ],
    pitfalls: [
      "ALDRIG selv at fastsætte zonen. Zoneklassificeringen ejes af kunden — vi læser den, vi opfinder den ikke. Bed om dokumentet.",
      "At antage at hele hallen er ATEX, fordi ét rum er det — det fordyrer projektet unødigt",
      "At love styring i zonen uden at have afklaret, hvad der findes Ex-godkendt; ofte styres Ex-armaturer fra sikkert område",
      "At undervurdere leveringstid og dokumentationskrav i tidsplanen",
    ],
    keywords: [
      "ATEX",
      "Ex",
      "zone",
      "eksplosion",
      "støv",
      "lakering",
      "silo",
      "foderstof",
      "biogas",
      "temperaturklasse",
    ],
    indicative: true,
  },
  /* ======================================================= ENERGI & ØKONOMI */
  {
    id: "en-besparelsens-anatomi",
    category: "energi",
    title: "Hvor besparelsen faktisk kommer fra (green lights beregningsmetode)",
    technical:
      "Besparelsen har tre kilder, og de lægges oven på hinanden i den rækkefølge: 1) selve armaturet — færre watt for samme lys (typisk fra ~58 W pr. gammelt armatur til ~35 W pr. nyt i estimatværktøjets standard, og fra 120-145 W til 55-87 W i industrihøjde); 2) styring — i green lights beregningsmetode spares 70% af det NYE anlægs forbrug; 3) dagslysstyring — som sparer yderligere 20% af det RESTERENDE forbrug efter styring, og vises separat. Regnestykket er: nyt basisforbrug = antal × watt × brændetimer ÷ 1000; derefter −70% (styring); derefter −20% af resten (dagslys).",
    customerOutcome:
      "Pointen for kunden: armaturet alene tager typisk omkring halvdelen. Det er styringen, der tager resten — fordi den fjerner de timer, hvor der brænder lys uden at nogen har gavn af det. Derfor er det billige tilbud uden styring sjældent det billigste tilbud; det er bare det billigste indkøb.",
    useWhen: [
      "Kunden vil kun skifte armaturer og springe styringen over",
      "Kunden sammenligner et tilbud med og et uden styring",
      "Ved opbygning af business casen i estimatværktøjet",
    ],
    pitfalls: [
      "At bruge 70% som et løfte. Det er beregningsmetodens standardandel — den reelle besparelse afhænger af belægning og brændetimer og skal regnes på kundens egne tal.",
      "At lægge dagslysstyringens 20% oven på det oprindelige forbrug i stedet for på restforbruget — det giver et for højt tal",
      "At regne på et areal uden at kende brændetimerne",
    ],
    keywords: ["besparelse", "energi", "styring", "dagslys", "kWh", "brændetimer", "beregning", "70%", "20%"],
    indicative: true,
  },
  {
    id: "en-braendetimer",
    category: "energi",
    title: "Brændetimer er den største enkeltfaktor — og den, ingen kender",
    technical:
      "Årsforbruget er lineært i brændetimerne: antal × watt × timer ÷ 1000. Estimatværktøjets standard er 2.500 timer/år, mens toskiftsdrift typisk ligger omkring 4.000 timer og døgndrift op mod 6.000-8.760 timer. En fejl på 1.000 timer flytter både forbrug, besparelse og tilbagebetalingstid mere end nogen anden enkelt antagelse i casen. El-prisen (standard 2,10 kr/kWh i værktøjet) er den anden store.",
    customerOutcome:
      "Kunden får en business case, der er bygget på deres egen virkelighed frem for et gennemsnit — og som holder, når controlleren kigger den efter. Derfor spørger vi til skiftehold, weekender, ferielukning og hvem der slukker om aftenen, før vi regner.",
    useWhen: [
      "Ved enhver energiberegning og forretningscase",
      "Når kunden er skeptisk over for besparelsestal",
      "Når to tilbud viser vidt forskellige besparelser — ofte er forskellen kun antagelserne",
    ],
    pitfalls: [
      "At gætte brændetimer for at komme videre i regnearket",
      "At bruge samme brændetimer for hele bygningen (lager, kontor og produktion har sjældent samme)",
      "At undlade at skrive antagelsen synligt i materialet — så bliver den senere til en påstand",
    ],
    keywords: ["brændetimer", "driftstid", "skiftehold", "elpris", "forbrug", "antagelser"],
    indicative: true,
  },
  {
    id: "en-forretningscase",
    category: "energi",
    title: "Forretningscasen: tilbagebetaling, nettogevinst, afkast",
    technical:
      "green lights forretningscase regner over 15 år med 3% årlig el-prisstigning på energidelen. Investeringen i tilbagebetalingstiden er materiale + styring (montage indgår ikke, jf. beregningsmetoden), og sparet vedligehold er sat konservativt til 0 kr pr. armatur, indtil der findes et reelt datagrundlag. Ud kommer: tilbagebetalingstid (året hvor akkumuleret besparelse passerer investeringen, interpoleret), nettogevinst over perioden, afkast i procent samt et akkumuleret cash flow med break-even. Estimatet vises altid med et budgetinterval på ±12% og et sikkerhedsniveau (Lav under 55, Middel 55-79, Høj 80+) ud fra hvor godt sagen er oplyst.",
    customerOutcome:
      "Kunden får noget, der kan lægges på et ledelsesmøde: hvad koster det, hvornår er det tjent hjem, hvad står vi tilbage med om 15 år — og hvor sikkert er tallet. Det gør beslutningen til en investeringsbeslutning i stedet for en indkøbsbeslutning, og det er den eneste form, der kan konkurrere med et lavere tilbud.",
    useWhen: [
      "Når kunden skal sælge projektet internt (CFO, bestyrelse, koncern)",
      "Ved “det er for dyrt” — flyt fra pris til totaløkonomi",
      "Ved budgetlægning og prioritering mellem projekter",
    ],
    pitfalls: [
      "At præsentere tilbagebetalingstiden uden at nævne, hvad den bygger på (brændetimer, elpris, styringsandel)",
      "At sætte vedligeholdsbesparelsen ind uden dokumentation — den er bevidst 0 i modellen",
      "At bruge estimatet som et tilbud. Det er et kvalificeret estimat, ikke et bindende tilbud — sig det, hver gang.",
    ],
    keywords: [
      "forretningscase",
      "business case",
      "tilbagebetaling",
      "payback",
      "ROI",
      "afkast",
      "nettogevinst",
      "cash flow",
      "totaløkonomi",
    ],
    indicative: true,
  },
  {
    id: "en-co2",
    category: "energi",
    title: "CO₂ — faktoren, omregningen og hvordan den bruges uden at blive tom",
    technical:
      "green light regner med 0,133 kg CO₂ pr. kWh (dansk miljødeklaration for el). Den årlige CO₂-besparelse = sparede kWh × 0,133. I den kundevendte præsentation omsættes tallet til genkendelige størrelser: ét træs årlige optag ≈ 21 kg, én personbils årlige udledning ≈ 2.000 kg, én flyrejse København-London tur/retur ≈ 230 kg, og en gennemsnitlig dansk husstands elforbrug ≈ 4.000 kWh/år.",
    customerOutcome:
      "Kunden får et tal, der kan bruges to steder: i den lovpligtige eller frivillige rapportering, og i den interne kommunikation, hvor “vi har sparet 17 tons CO₂ — svarende til hvad omkring 800 træer optager på et år” faktisk bliver læst. Det er ofte det, der gør et driftsprojekt til et ledelsesprojekt.",
    useWhen: [
      "Kunden arbejder med ESG, klimaregnskab eller grønne indkøbskrav",
      "Kunden skal have projektet gennem en ledelse, der ikke tænder på kWh",
      "Offentlige og kommunale kunder med politiske mål",
    ],
    pitfalls: [
      "At starte i CO₂. Økonomien bærer beslutningen; CO₂ forstærker den.",
      "At bruge omregningerne som salgsjargon over for en kunde, der arbejder professionelt med klimaregnskab — dér skal tallet stå rent, med faktoren nævnt",
      "At glemme at faktoren ændrer sig over tid og skal kunne dokumenteres",
    ],
    keywords: ["CO2", "CO₂", "klima", "ESG", "miljødeklaration", "0,133", "træer", "biler", "flyrejser"],
    indicative: true,
  },
  {
    id: "en-lux-og-effekt",
    category: "energi",
    title: "Lysniveauet flytter energien — ikke prisen",
    technical:
      "I estimatværktøjet er lux-niveauet næsten neutralt på prisen, men multiplicerer effektbehovet: 150 lx ≈ 0,55 × basiseffekt, 200 lx ≈ 0,7, 300 lx = 1,0, 500 lx ≈ 1,45 og 750 lx ≈ 1,9. At gå fra 300 til 500 lx i hele bygningen øger altså energiforbruget markant, selvom armaturprisen næsten er den samme. Derfor giver det mening at differentiere: arbejdsfladen får det niveau, opgaven kræver, mens gangarealer og transportzoner ligger lavere.",
    customerOutcome:
      "Kunden slipper for at betale for lys, hvor der ikke arbejdes. Vi lægger lyset, hvor opgaven er, i stedet for at hæve niveauet i hele hallen — det giver både bedre arbejdsforhold dér, hvor det tæller, og et lavere forbrug.",
    useWhen: [
      "Kunden beder om “mere lys overalt”",
      "Ved dimensionering og lysberegning",
      "Når et konkurrerende oplæg har markant flere armaturer",
    ],
    pitfalls: [
      "At sælge et højere lux-niveau som en kundefordel uden at nævne, hvad det koster i drift",
      "At underdimensionere for at vinde på pris — det er kundens arbejdsmiljø, der betaler",
    ],
    keywords: ["lux", "lysniveau", "belysningsstyrke", "effekt", "watt", "dimensionering", "300 lux", "500 lux"],
    indicative: true,
  },
  {
    id: "en-tilskud",
    category: "energi",
    title: "Tilskud og puljer — nævnes, loves aldrig",
    technical:
      "Der har over tid været danske tilskudsordninger til energieffektivisering i erhverv (senest Erhvervspuljen under Energistyrelsen), typisk med ansøgningsrunder, krav om at projektet ikke er igangsat før tilsagn, dokumenteret besparelse og en tilbagebetalingstid inden for et bestemt interval. Ordninger, satser, puljestørrelser og åbningsvinduer ændrer sig løbende og kan være lukkede.",
    customerOutcome:
      "Kunden får at vide, at der KAN være et tilskud, og hvad det i givet fald kræver — vigtigst at man ikke må gå i gang, før der er tilsagn. Det er et konkret råd, kunden sjældent får fra en leverandør, og det placerer green light som rådgiver.",
    useWhen: [
      "Kunden mangler budget i år",
      "Projektet er stort nok til at en ansøgning kan betale sig",
      "Kunden arbejder allerede med energiledelse",
    ],
    pitfalls: [
      "ALDRIG at love et tilskud eller en sats. Tjek aktuel status først, og sig “det skal vi have bekræftet”.",
      "At lade tilskuddet blive årsagen til at udskyde projektet",
      "At bygge tilbagebetalingstiden på et tilskud, der ikke er givet",
    ],
    keywords: ["tilskud", "pulje", "erhvervspuljen", "energistyrelsen", "støtte", "ansøgning", "budget"],
    indicative: true,
  },

  /* ============================================= PROJEKT (det vi laver for kunden) */
  {
    id: "pj-lysberegning",
    category: "projekt",
    title: "Lysberegning — dokumentation før beslutning",
    technical:
      "En lysberegning simulerer det færdige anlæg ud fra rummets mål, overfladernes refleksioner, monteringshøjde og armaturets fotometriske fil (IES/LDT): den beregner belysningsstyrke på arbejdsfladen (Em), jævnhed (U0), blændingstal (UGR) og forbrug pr. m². Beregningen laves før køb og indgår i dokumentationen. green light vedligeholder fotometri og specs på armaturerne i Universet, så beregningen bygger på de faktiske produkter — ikke på et generisk armatur.",
    customerOutcome:
      "Kunden får sort på hvidt, hvad lyset bliver — inden der er brugt en krone på montage. Ingen “vi håber det bliver godt nok”, ingen ekstra armaturer bestilt bagefter, og noget at holde leverandøren op på. Det er den enkeltdel, der fjerner mest risiko for kunden.",
    useWhen: [
      "Kunden har brændt sig på et anlæg, der blev for mørkt eller blændende",
      "Der stilles krav til lysniveau (arbejdsmiljø, kunde- eller myndighedskrav)",
      "Ved sammenligning med et tilbud uden beregning",
    ],
    pitfalls: [
      "At lave fuld lysberegning før sagen er kvalificeret — manualen er eksplicit: ingen store beregninger før der er en rimelig indikation af købsvilje",
      "At aflevere beregningen til rådgiveren i stedet for til slutbrugeren",
      "At vise beregningen som et teknisk bilag i stedet for som en garanti for resultatet",
    ],
    keywords: ["lysberegning", "dialux", "relux", "fotometri", "IES", "LDT", "lux", "jævnhed", "UGR", "dokumentation"],
  },
  {
    id: "pj-projektering",
    category: "projekt",
    title: "Projektering — fra beregning til noget der kan bygges",
    technical:
      "Projekteringen omsætter beregningen til en løsning, der kan udføres: armaturplacering og montageform (indbygning, påbygning, wire, kæde, skinne), ophængshøjder, gruppeopdeling og zoneplan, sensorplacering og -rækkevidde, styringstopologi, nødvendige tilslutninger, tilbehør og grænseflader til den eksisterende installation. Estimatværktøjets områdefaktorer på installationen (fx sportshal 1,25 og udendørs 1,35 mod kontor 1,05) afspejler netop, at montagen — ikke armaturet — er dét, der varierer mest fra bygning til bygning.",
    customerOutcome:
      "Kunden får en løsning, der kan sættes op i deres bygning, som den ser ud — ikke en ideel løsning, der falder fra hinanden ved første ophængsdetalje. Det er dér, ekstraregningerne normalt opstår, og det er dér, de undgås.",
    useWhen: [
      "Bygninger med besværlig geometri, høje lofter, kraner, ventilation eller sprinkler i vejen",
      "Når kunden har fået et tilbud, der kun indeholder armaturer",
      "Ved koordinering med kundens egen elektriker",
    ],
    pitfalls: [
      "At love en placering uden at have været på stedet eller set en plantegning",
      "At glemme tilbehør (ophæng, rammer, beslag) i estimatet — små poster, stor irritation",
    ],
    keywords: ["projektering", "montage", "ophæng", "zoneplan", "placering", "tilbehør", "grænseflader"],
  },
  {
    id: "pj-installation-og-ledelse",
    category: "projekt",
    title: "Installation og projektledelse — ét sted at ringe hen",
    technical:
      "Ud over materialet kan green light stå for koordineringen: tidsplan, adgang og nøgler, lift og materiel, sikkerhed, faseopdeling efter kundens drift, opfølgning med installatøren, idriftsættelse af styring, aflevering med dokumentation, som-udført-materiale og oplæring af kundens driftsfolk. Estimatet indeholder en installationspris pr. armatur ganget med en områdefaktor, netop fordi arbejdstiden pr. armatur afhænger af bygningen.",
    customerOutcome:
      "Kunden har ét sted at ringe hen, når noget ikke passer — i stedet for at stå mellem en leverandør, en elektriker og en rådgiver, der peger på hinanden. For en driftschef er det ofte den reelle grund til at vælge os: projektet bliver ikke hans problem.",
    useWhen: [
      "Kunden har begrænsede interne ressourcer til at følge et projekt",
      "Flere håndværkergrupper skal koordineres",
      "Kunden har dårlige erfaringer med et tidligere lysprojekt",
    ],
    pitfalls: [
      "At tage projektledelsen på sig uden at have prissat den",
      "At acceptere, at kundens elektriker “klarer resten”, uden at have afklaret grænsefladen skriftligt",
    ],
    keywords: ["installation", "projektledelse", "tidsplan", "koordinering", "aflevering", "oplæring", "dokumentation"],
  },
  {
    id: "pj-energiberegning",
    category: "projekt",
    title: "Energiberegning og dokumentation kunden kan bruge internt",
    technical:
      "green light leverer før/efter-beregningen: nuværende anlæg (antal, watt, brændetimer) mod det nye (antal og watt fra det valgte armatur), med styring og eventuel dagslysstyring vist separat, omregnet til kWh, kroner og CO₂ — og videre til tilbagebetalingstid, nettogevinst og afkast. Det hele samles i et kundevendt materiale (PDF og fuldskærmspræsentation) med forudsætningerne synlige og et sikkerhedsniveau på datagrundlaget.",
    customerOutcome:
      "Kunden får det materiale, der skal til for at få projektet godkendt hos dem selv — ikke bare et tilbud. Vores kontaktperson skal kunne sælge projektet videre internt, og det er den opgave, materialet er bygget til.",
    useWhen: [
      "Kontaktpersonen ikke selv er beslutningstager",
      "Projektet skal med i et budget eller en investeringsplan",
      "Kunden har brug for tal til ESG- eller energirapportering",
    ],
    pitfalls: [
      "At aflevere et regneark uden at gennemgå forudsætningerne — så bliver de anfægtet i vores fravær",
      "At bruge estimatet som et tilbud (standardforbeholdet skal altid med)",
      "At udelade sikkerhedsniveauet, når datagrundlaget er tyndt",
    ],
    keywords: ["energiberegning", "før/efter", "dokumentation", "PDF", "præsentation", "forudsætninger", "internt salg"],
  },
  {
    id: "pj-hoejt-til-loft",
    category: "projekt",
    title: "Høje lofter og adgang med lift",
    technical:
      "Ved monteringshøjder over ca. 6-8 meter styres projektet af adgangen, ikke af armaturet: lifttype og fremkommelighed, gulvbelastning, reoler og maskiner i vejen, kraner, sprinkler og ventilation, og hvor mange armaturer der kan nås pr. liftopstilling. Monteringshøjden afgør desuden sensorvalg (typisk sensorvarianter til op til 6 m, 12 m og 16 m) og lysfordeling — et armatur, der er rigtigt i 4 meter, er forkert i 12.",
    customerOutcome:
      "Kunden får en pris, der holder, og en tidsplan, der kan gennemføres — og undgår den klassiske ekstraregning, hvor liften står stille, fordi der holder en truck i vejen. Samtidig bliver det tydeligt, hvorfor lang levetid og fejlmelding er penge værd: hver eneste udskiftning heroppe koster lift og driftstid.",
    useWhen: [
      "Højlager, produktionshaller, sportshaller",
      "Kunden fokuserer på armaturprisen alene",
      "Ved argumentation for styring og driftsdata (færre udkørsler)",
    ],
    pitfalls: [
      "At regne montagetid som i et kontor",
      "At vælge sensorvariant ud fra pris frem for højde — så virker tilstedeværelsesstyringen aldrig ordentligt",
      "At planlægge liftarbejde uden at have afklaret, hvornår arealet kan ryddes",
    ],
    keywords: ["lift", "loftshøjde", "montagehøjde", "højlager", "adgang", "sensorrækkevidde", "12 m", "16 m"],
    indicative: true,
  },
  {
    id: "pj-drift-i-produktion",
    category: "projekt",
    title: "Produktion der ikke kan stoppe",
    technical:
      "Udskiftning i drift løses ved at opdele arbejdet: område for område eller række for række, arbejde i planlagte stop, weekender, ferielukning eller nattevagt, midlertidig belysning under arbejdet, og en rækkefølge, der matcher produktionsplanen frem for elektrikerens rute. Trådløs styring reducerer indgrebet yderligere, fordi der ikke skal trækkes styrekabel over produktionsarealet.",
    customerOutcome:
      "Kunden mister ikke produktionstimer for at få nyt lys. Vi tilpasser os deres kalender — ikke omvendt. For en produktionschef er nedetid ofte dyrere end hele lysprojektet, og det er dét, der afgør, hvem han vælger.",
    useWhen: [
      "Fødevare-, proces- og produktionsvirksomheder med lav tolerance for stop",
      "Kunden siger “vi kan ikke undvære hallen”",
      "Ved argumentation for trådløs styring i renovering",
    ],
    pitfalls: [
      "At love weekendarbejde uden at have priset det",
      "At planlægge etaper efter vores logistik i stedet for efter kundens ordrebog",
      "At glemme midlertidig belysning og oprydning mellem etaper",
    ],
    keywords: ["produktion", "nedetid", "etaper", "weekend", "natarbejde", "midlertidig belysning", "driftsstop"],
  },
  {
    id: "pj-gamle-installationer",
    category: "projekt",
    title: "Gamle installationer og ukendte kabler",
    technical:
      "I ældre bygninger er den typiske risiko: manglende eller forældet dokumentation, ukendt gruppeopdeling, gamle kabeltværsnit og armeret ledning, delte nul-ledere, HPFI/afbryderforhold der ikke er tidssvarende, og tændingsprincipper hvor hele hallen hænger på én kontakt. Det opdages først, når der åbnes op. Derfor bør sagen indeholde en gennemgang og et forbehold, og gerne en prøveopsætning i ét område, før hele bygningen prissættes.",
    customerOutcome:
      "Kunden får overraskelserne frem, mens de stadig kan planlægges — i stedet for som ekstraregninger midt i projektet. Det er også derfor, en prøveopsætning ofte er billigere end en diskussion om, hvem der skulle have vidst hvad.",
    useWhen: [
      "Bygninger fra før ca. 1990, eller hvor der er bygget om ad flere omgange",
      "Kunden har fået en meget lav pris fra en leverandør, der ikke har været på stedet",
      "Ved fastsættelse af forbehold i estimatet",
    ],
    pitfalls: [
      "At give en fast pris på en installation, ingen har set",
      "At love 1:1-udskiftning uden at kende tændingsprincip og gruppeopdeling",
      "At lade kunden tro, at eksisterende styring kan genbruges, før det er verificeret",
    ],
    keywords: ["gammel installation", "kabler", "gruppeopdeling", "dokumentation", "forbehold", "tænding", "renovering"],
  },
  {
    id: "pj-blandet-bestand",
    category: "projekt",
    title: "Blandet armaturbestand — mange typer, ingen reservedele",
    technical:
      "Typisk bygning i drift har tre til seks generationer af armaturer side om side: lysstof, metalhalogen, tidlig LED og nyere LED, ofte med forskellige farvetemperaturer, forskellige drivere og ingen samlet dokumentation. Konsekvensen er et lager af reservedele, der aldrig passer, lys der ser forskelligt ud i samme rum, og ingen mulighed for fælles styring. Standardisering på få typer og én styringsplatform er ofte den største driftsgevinst i sagen — større end den enkelte watt-besparelse.",
    customerOutcome:
      "Kunden går fra “hvad sidder der egentlig deroppe?” til én type, ét sæt reservedele, én måde at styre på — og et lokale, hvor lyset har samme farve hele vejen rundt. Det er den slags, driftsfolk mærker hver uge.",
    useWhen: [
      "Kunden klager over vedligehold og reservedele",
      "Ved argumentation for at tage hele arealet frem for at lappe",
      "Når kunden overvejer at skifte “dem der er gået”",
    ],
    pitfalls: [
      "At sælge standardisering som et ryddeligt lager. Sælg det som færre driftsstop og færre timer brugt på fejl.",
      "At overse, at delvis udskiftning giver synlig farveforskel i samme rum",
    ],
    keywords: ["blandet bestand", "reservedele", "standardisering", "vedligehold", "farveforskel", "generationer"],
  },
  {
    id: "pj-noedbelysning",
    category: "projekt",
    title: "Nødbelysning og panikbelysning — et selvstændigt spor",
    technical:
      "Nødbelysning (flugtvejs- og panikbelysning) er en selvstændig disciplin med egne krav til placering, lysniveau i flugtveje, funktionstid på batteri og til dokumenteret afprøvning og journalføring. Systemerne fås med lokalt batteri eller central batteriforsyning, og med selvtest, hvor armaturerne selv rapporterer testresultat. Krav og omfang afhænger af bygningens anvendelseskategori og brandstrategi, og skal afklares med kundens brandrådgiver eller myndighed — ikke fastsættes af os.",
    customerOutcome:
      "Kunden opdager det ikke først ved en brandsyn. Tages nødbelysningen med i samme projekt, sparer kunden en ekstra omgang lift, lukning og montage — og med selvtestende armaturer forsvinder den manuelle testrunde og journalen, som i praksis sjældent bliver ført.",
    useWhen: [
      "Ved enhver større renovering — spørg altid til nødbelysningens alder og tilstand",
      "Kunden nævner brandsyn, forsikring eller myndighedskrav",
      "Ved argumentation for at samle arbejdet i ét indgreb",
    ],
    pitfalls: [
      "At udtale sig om, hvad kunden er forpligtet til. Henvis til brandrådgiver/myndighed, og hold os til, hvad løsningen kan.",
      "At glemme nødbelysning i estimatet og få den ind som ekstraarbejde bagefter",
      "At love selvtest uden at have afklaret, hvem der modtager rapporterne",
    ],
    keywords: ["nødbelysning", "panikbelysning", "flugtvej", "batteri", "selvtest", "brandsyn", "journal"],
    indicative: true,
  },
  {
    id: "pj-etapevis",
    category: "projekt",
    title: "Etapevis udrulning og pilot",
    technical:
      "Et projekt kan opdeles efter areal (én hal, én afdeling, én etage), efter tid (budgetår, ferielukninger) eller efter funktion (først produktion, siden lager og kontor). Forudsætningen for at etaperne ikke bliver dyrere end ét samlet projekt er, at styringsplatform, armaturtyper og zoneprincip fastlægges i etape 1, så etape 2 kan kobles på uden at bygge om. Manualen kalder pilotprojektet vores stærkeste våben — gode pilotområder er ét kontor, ét rum, én hal, ét lagerområde eller én afdeling.",
    customerOutcome:
      "Kunden kan tage en lille beslutning i stedet for en stor, se resultatet i sin egen bygning og beslutte resten på fakta i stedet for på et tilbud. Risikoen bliver håndterbar, og det gør ja'et lettere for alle i beslutningskæden.",
    useWhen: [
      "Kunden tøver, eller beslutningen skal flere led op",
      "Budgettet rækker ikke til hele bygningen i år",
      "Kunden har brændt sig før og vil se det virke",
    ],
    pitfalls: [
      "At lave etape 1 uden at have besluttet platform og princip — så bliver etape 2 en ny sag i stedet for en fortsættelse",
      "At give piloten væk gratis uden nogen form for commitment om, hvad der sker, hvis den virker",
      "At vælge et pilotområde, hvor effekten ikke kan ses eller mærkes",
    ],
    keywords: ["pilot", "etape", "prøveopsætning", "udrulning", "budgetår", "afgrænset", "risiko"],
  },
  {
    id: "pj-udbud",
    category: "projekt",
    title: "Udbud og indkøbsafdelinger",
    technical:
      "Når sagen kører som udbud eller gennem indkøb, flytter beslutningen sig fra behov til kriterier: kravspecifikation, tildelingskriterier (pris vs. kvalitet/TCO), krav til dokumentation, referencer, garanti og eventuelt levetidsomkostninger. Er specifikationen allerede skrevet, når vi kommer ind, er vores rum reduceret til pris. Er vi med, før den skrives, kan kriterierne komme til at handle om det, kunden faktisk har brug for: lysniveau og jævnhed, blændingskrav, styringsfunktioner, driftsdata, dokumentation og totaløkonomi.",
    customerOutcome:
      "Kunden får et udbud, der køber det rigtige, i stedet for et udbud, hvor alle byder på det samme dårligste fællesnævner og der vindes på pris. Vores hjælp til at formulere kravene er reelt et gratis stykke rådgivningsarbejde — og den bedste måde at sikre, at slutbrugerens behov overlever indkøbsprocessen.",
    useWhen: [
      "Offentlige og kommunale kunder, større koncerner, ejendomsselskaber",
      "Kunden siger “det skal i udbud” eller “indkøb tager over”",
      "Ved rammeaftaler og flerårige udrulninger",
    ],
    pitfalls: [
      "At slippe slutbrugeren, når indkøb kommer ind — manualen er klar: bliver vi koblet af slutbrugeren, mister vi styringen og løsningen bliver ringere",
      "At byde på en specifikation, vi ved ikke løser kundens problem, uden at gøre opmærksom på det",
      "At bruge tid på et udbud uden at kende tildelingskriterierne",
    ],
    keywords: ["udbud", "indkøb", "kravspecifikation", "tildelingskriterier", "rammeaftale", "offentlig", "TCO"],
  },
  {
    id: "pj-estimat-forbehold",
    category: "projekt",
    title: "Estimat, ikke tilbud — og hvorfor forbeholdet styrker os",
    technical:
      "green lights estimatværktøj leverer et kvalificeret overslag: pris på materiale, installation og styring, pris pr. armatur, et budgetinterval på ±12% og et sikkerhedsniveau (Lav/Middel/Høj) ud fra hvor mange væsentlige felter der er udfyldt. Standardforbeholdet lyder: estimatet er vejledende, ikke et bindende tilbud, og kan ændre sig efter nærmere gennemgang, lysberegning, teknisk afklaring og endelig projektering.",
    customerOutcome:
      "Kunden kan få et troværdigt tal med hjem fra første møde — uden at nogen af parterne bliver låst. At vi selv siger, hvor sikkert tallet er, gør de øvrige tal mere troværdige, ikke mindre. Det er også dét, der giver en naturlig grund til næste skridt: “skal vi lave den gennemgang, der gør tallet skarpt?”",
    useWhen: [
      "På mødet, når kunden vil have “bare et cirkatal”",
      "Når kunden presser på for en pris, før sagen er oplyst",
      "Som brobygning til næste skridt (opmåling, lysberegning, prøveopsætning)",
    ],
    pitfalls: [
      "At sende estimatet som var det et tilbud",
      "At skjule sikkerhedsniveauet, når det er lavt — det er netop argumentet for næste skridt",
      "At bruge estimatet som undskyldning for ikke at kvalificere sagen først",
    ],
    keywords: ["estimat", "overslag", "forbehold", "budgetinterval", "sikkerhedsniveau", "cirkapris", "tilbud"],
  },
  /* ================================================= REGLER OG STANDARDER */
  /* Bemærk: alt i denne blok er markeret indicative, fordi en sælger skal
     kunne tale om det — men aldrig må fremstå som juridisk rådgiver. Formuler
     altid som "typisk" og henvis til kundens egen rådgiver/myndighed. */
  {
    id: "rg-en12464",
    category: "regler",
    title: "DS/EN 12464-1 — lysniveauer og blænding på arbejdspladser",
    technical:
      "DS/EN 12464-1 er den europæiske standard for belysning af indendørs arbejdspladser. Den fastsætter for hver opgavetype en vedligeholdt belysningsstyrke på arbejdsområdet (Em), en jævnhed (U0), et maksimalt blændingstal (UGR) og et mindste farvegengivelsesindeks (Ra). Typiske niveauer: kontor- og skrivebordsarbejde omkring 500 lx med UGR højst 19, mødelokaler tilsvarende, gangarealer og trapper omkring 100-150 lx, lagergange uden fast bemanding omkring 100 lx og med fast bemanding omkring 200 lx, grovere industriarbejde 200-300 lx, montage og finere arbejde 500-750 lx og opefter. Nyere udgaver af standarden stiller desuden krav til lys på vægge og lofter samt til cylindrisk belysningsstyrke, altså lyset på mennesker i rummet.",
    customerOutcome:
      "For kunden er standarden ikke et regelsæt, men en målestok: den gør det muligt at dokumentere, at arbejdspladsen har det lys, opgaven kræver — og at ingen bliver blændet af det. Det er argumentet, når medarbejdere klager, når AMO spørger, og når to tilbud skal sammenlignes på andet end pris.",
    useWhen: [
      "Kunden har klager over lyset eller en arbejdsmiljøsag",
      "Ved fastlæggelse af lysniveauer før lysberegning",
      "Når et konkurrerende oplæg har markant færre armaturer",
      "Ved kontorer, hvor blænding på skærme er problemet",
    ],
    pitfalls: [
      "At citere præcise lux-tal som lov. Værdierne afhænger af opgavetype og standardens udgave — sig “typisk” og få det bekræftet i lysberegningen.",
      "At bruge standarden til at presse et højere lysniveau ind, end opgaven kræver (det koster kunden energi)",
      "At tale om UGR uden at oversætte: blænding er noget, folk mærker i nakken og øjnene",
    ],
    keywords: ["EN 12464", "12464-1", "lux", "UGR", "blænding", "jævnhed", "Ra", "standard", "arbejdsplads"],
    indicative: true,
  },
  {
    id: "rg-arbejdsmiljoe",
    category: "regler",
    title: "Den danske arbejdsmiljøvinkel — arbejdsgiverens ansvar",
    technical:
      "Efter dansk arbejdsmiljølovgivning skal arbejdsstedet være indrettet, så arbejdet kan udføres sikkerheds- og sundhedsmæssigt fuldt forsvarligt, og det omfatter belysningen: der skal være tilstrækkelig almen- og arbejdsbelysning, tilpasset arbejdets art, og belysningen må ikke give blænding, generende reflekser eller flimmer. Arbejdstilsynet udgiver vejledninger om kunstig belysning, som i praksis læner sig op ad DS/EN 12464-1. Ansvaret ligger hos arbejdsgiveren — altså hos vores kunde — og forhold om lys indgår typisk i APV'en.",
    customerOutcome:
      "Det gør lys til en ledelsesopgave, ikke en indkøbsopgave. Kunden får dokumentation for, at arbejdspladsens belysning er i orden — og slipper for at diskutere det med hverken medarbejdere, AMO eller tilsyn. For mange driftschefer er det en større drivkraft end kWh.",
    useWhen: [
      "Kunden nævner klager, sygefravær, fejl i produktionen eller AMO",
      "Ved produktion, værksteder, lager og skoler",
      "Når projektet skal prioriteres op internt",
    ],
    pitfalls: [
      "Aldrig at optræde som myndighed eller antyde, at kunden overtræder loven. Stil spørgsmål i stedet: “hvordan oplever medarbejderne lyset i dag?”",
      "At bruge arbejdsmiljø som skræmmeargument frem for som noget, kunden selv sætter ord på",
    ],
    keywords: ["arbejdsmiljø", "Arbejdstilsynet", "APV", "AMO", "blænding", "medarbejdere", "ansvar"],
    indicative: true,
  },
  {
    id: "rg-ecodesign",
    category: "regler",
    title: "Ecodesign og energimærkning — hvorfor de gamle rør forsvinder",
    technical:
      "EU's ecodesign- og energimærkningsregler for lyskilder har sammen med begrænsningerne på kviksølv betydet, at de klassiske lysstofrør (T8 og T5) og kompaktlysrør i praksis er udfaset i løbet af 2023 — de præcise datoer varierer efter lyskildetype. Nye lyskilder skal desuden leve op til krav om virkningsgrad og være mærket efter den nuværende A-G-skala. Konsekvensen for eksisterende anlæg er ikke, at de skal skiftes, men at reservedele til dem bliver dyrere, dårligere tilgængelige og på sigt umulige at skaffe.",
    customerOutcome:
      "Kunden med et gammelt lysstofanlæg står ikke over for et valg mellem at skifte og at lade være — kunden står over for et valg mellem at skifte planlagt eller at skifte i panik, når rørene ikke kan skaffes og en hal står halvmørk. Det gør timing til et argument, uden at nogen behøver at presse.",
    useWhen: [
      "Kunden har lysstofanlæg og siger “det kører jo”",
      "Ved indvendingen “ikke lige nu” / “vi venter”",
      "Ved budgetlægning for næste år",
    ],
    pitfalls: [
      "At sige at lysstofrør er “forbudt”. De er udfaset i produktionen — det er ikke ulovligt at have dem hængende. Vær præcis, ellers mister vi troværdighed.",
      "At bruge udfasningen som eneste argument. Den flytter timingen; den bygger ikke casen.",
    ],
    keywords: ["ecodesign", "energimærkning", "lysstofrør", "T8", "T5", "udfasning", "reservedele", "kviksølv"],
    indicative: true,
  },
  {
    id: "rg-esg-rapportering",
    category: "regler",
    title: "ESG og CO₂-rapportering — spørg, påstå ikke",
    technical:
      "En voksende del af danske virksomheder skal eller vælger at rapportere på energiforbrug og klimapåvirkning — enten fordi de er omfattet af EU's bæredygtighedsrapportering, fordi deres bank, koncern eller store kunder kræver det, eller fordi de arbejder med energiledelse. Elforbrug hører under indirekte udledninger (scope 2), og en dokumenteret reduktion i kWh kan derfor indgå direkte. Hvem der er omfattet og hvornår, er ændret flere gange politisk, og tidslinjerne er blevet udskudt og indsnævret — så det skal aldrig påstås, kun afklares.",
    customerOutcome:
      "Når kunden alligevel skal indberette eller dokumentere, bliver et lysprojekt til et af de få tiltag, der både sparer penge og giver et tal, der kan rapporteres. Vi leverer dokumentationen — kWh før og efter, CO₂ med angivet faktor — så kunden ikke selv skal regne det ud.",
    useWhen: [
      "Kunden nævner ESG, klimaregnskab, CSRD, energiledelse eller krav fra kunder/bank",
      "Store og mellemstore virksomheder, koncernejede selskaber, offentlige kunder",
      "Når projektet skal have en ekstra grund til at ligge højt på prioriteringslisten",
    ],
    pitfalls: [
      "Aldrig at fortælle kunden, at de “er omfattet”. Spørg: “Har I en rapporteringsforpligtelse, eller er der nogen, der beder jer om tallene?”",
      "At sælge CO₂ til en driftschef, der måles på oppetid — find ud af, hvem i huset der faktisk har den dagsorden",
    ],
    keywords: ["ESG", "CSRD", "rapportering", "scope 2", "klimaregnskab", "energiledelse", "dokumentation"],
    indicative: true,
  },

  /* =============================================== BRANCHER OG KUNDETYPER */
  {
    id: "br-produktion",
    category: "branche",
    title: "Produktionsvirksomheder",
    technical:
      "Typisk: haller på 3.000-20.000 m², monteringshøjder 6-12 m, to- eller treholdsdrift med 4.000-6.000 brændetimer, blandet armaturbestand og ofte metalhalogen eller lysstof i højden. Krav til farvegengivelse ved kvalitetskontrol, lav blænding ved skærme og kontrolpladser, robusthed mod støv, vibration og temperatur, og zoner der matcher skiftene. Ofte findes der delområder med særlige krav (lakering, kemi, olie) — se ATEX.",
    customerOutcome:
      "Produktionschefen får lys, der følger skiftene, færre stop for at skifte armaturer i højden, og et arbejdsmiljø, hvor fejl opdages ved båndet og ikke ved kvalitetskontrollen. Energibesparelsen er stor her, fordi timerne er mange — men det er sjældent dét, der åbner døren.",
    useWhen: ["Prospektering", "Første møde med drifts- eller produktionschef", "Casebrug over for lignende virksomhed"],
    pitfalls: [
      "At åbne på energi. Åbn på drift, stop og arbejdsmiljø — energien kommer af sig selv i beregningen.",
      "At overse, at produktionen ikke kan stoppe (se projektudfordringer)",
    ],
    keywords: ["produktion", "industri", "hal", "skiftehold", "maskiner", "kvalitetskontrol", "montagehøjde"],
    indicative: true,
  },
  {
    id: "br-lager-logistik",
    category: "branche",
    title: "Lager og logistik",
    technical:
      "Typisk: højlager med reoler i 8-14 m, smalgange, truckkørsel, og lange perioder hvor der ikke er nogen i den enkelte gang. Lyset skal ned mellem reolerne (smal lysfordeling) frem for ud over gulvet, og sensorstyring pr. gang er dét, der afgør driftsomkostningen. Brændetimer kan være meget høje (op mod døgndrift), mens den faktiske belægning pr. gang er lav — netop den kombination, hvor styring giver mest.",
    customerOutcome:
      "Kunden betaler for lys i den gang, hvor trucken er — ikke i de tolv andre. Samtidig bliver plukkefejl og skader på reoler færre, når der er ordentligt lys hele vejen ned. Og armaturer, der sidder 12 meter oppe bag en reol, skal helst ikke skulle skiftes.",
    useWhen: ["Højlager, distributionscentre, 3PL", "Når styringens andel af besparelsen skal forklares", "Ved lifttunge projekter"],
    pitfalls: [
      "At bruge bred lysfordeling i smalgange — så rammer lyset reolsiderne i stedet for gulvet",
      "At regne besparelsen på fuld belægning i alle gange",
      "At glemme, at reolerne kan flyttes — zoneopdelingen skal kunne ændres",
    ],
    keywords: ["lager", "højlager", "logistik", "reoler", "smalgang", "truck", "plukning", "sensor"],
    indicative: true,
  },
  {
    id: "br-foedevare",
    category: "branche",
    title: "Fødevareindustri",
    technical:
      "Krav til hygiejne og rengøring styrer alt: høj tæthedsgrad (typisk IP65 og opefter, ved højtryksspuling IP69K), glatte kabinetter uden kanter der samler snavs, splintfri/afskærmede lyskilder af hensyn til fremmedlegemer, materialevalg der tåler rengøringsmidler, og ofte kølerum og frostrum med krav til lave temperaturer. Rengøring sker typisk om natten, og produktionen kører ellers i lange træk. Dokumentation til kvalitets- og egenkontrolsystem efterspørges.",
    customerOutcome:
      "Kvalitetschefen får armaturer, der kan spules ned uden at gå i stykker, og som ikke kan bidrage med glas eller plaststumper i en produktionslinje — altså færre afvigelser og ingen tilbagekaldelser med lys som årsag. Driften får armaturer, der holder til rengøringen i stedet for at ruste igennem på tre år.",
    useWhen: ["Slagterier, mejerier, bagerier, færdigvareproduktion, kølelager", "Når kunden nævner audit, egenkontrol eller fremmedlegemer", "Ved fugt-/rustproblemer på eksisterende armaturer"],
    pitfalls: [
      "At byde standard industriarmaturer ind i vådområder",
      "At undervurdere natrengøringens betydning for tidsplanen",
      "At love IP-grad uden at kende rengøringsmetoden (spuletryk og temperatur)",
    ],
    keywords: ["fødevare", "hygiejne", "IP69K", "IP65", "rengøring", "spuling", "kølerum", "audit", "fremmedlegemer"],
    indicative: true,
  },
  {
    id: "br-vaerksted",
    category: "branche",
    title: "Værksteder og autoværksteder",
    technical:
      "Mindre arealer (500-2.000 m²), lavere lofthøjder, men høje krav til farvegengivelse (lakvurdering, farvekoder på ledninger, fejlfinding) og til lys dér hvor arbejdet foregår — under og inde i maskiner og køretøjer, ikke kun over dem. Ofte skiftende arbejdspositioner, olie og støv, og et lyspunkt der skal kunne rette sig efter opgaven. Lakerings- og klargøringsområder kan have særlige krav (se ATEX).",
    customerOutcome:
      "Mekanikeren kan se, hvad han laver, uden at hente en lampe. Det giver færre fejl, hurtigere fejlfinding og færre omleveringer på lakarbejde — og det er tid, værkstedet kan fakturere i stedet for at bruge på at kigge efter.",
    useWhen: ["Auto, maskin- og smedeværksteder, service- og reparationsvirksomheder", "Mindre projekter hvor beslutningen tages af ejeren selv", "Når CRI og arbejdslys skal forklares"],
    pitfalls: [
      "At sælge en industriløsning i for stor skala til et lille værksted",
      "At overse, at ejeren ofte er beslutningstager — sagen kan lukkes hurtigere end i en koncern",
    ],
    keywords: ["værksted", "auto", "CRI", "farvegengivelse", "arbejdslys", "reparation", "lakering"],
    indicative: true,
  },
  {
    id: "br-kontor",
    category: "branche",
    title: "Kontorer og kontorlandskaber",
    technical:
      "Blændingsbegrænsning (UGR) og jævnhed er afgørende, fordi arbejdet foregår på skærme. Dagslysbidraget ved facaden er stort, hvilket gør dagslysstyring særligt effektiv i de yderste zoner, mens kernen kører på tilstedeværelse og tidsplan. Brændetimer er moderate (typisk 2.000-3.000 om året), så casen bæres mindst lige så meget af arbejdsmiljø, indeklima og fleksibilitet som af kWh. Tunable White bruges i møde- og fokusområder.",
    customerOutcome:
      "Medarbejderne får et lokale, hvor man kan sidde en hel dag uden at få ondt i øjnene, og hvor mødelokalet ikke ligner et lager. HR og ledelse får noget synligt at pege på i en tid, hvor mange skal overbevises om at møde ind. Og lyset kan flyttes med, når kontoret møbleres om.",
    useWhen: ["Kontordomiciler, administration, rådhuse, klinikker", "Når beslutningstageren er HR, facility eller direktion", "Ved ombygning eller ny lejer"],
    pitfalls: [
      "At bygge hele casen på energi. Med moderate brændetimer bliver tilbagebetalingstiden længere — arbejdsmiljø og fleksibilitet skal bære.",
      "At glemme dagslysstyring i facadezonen, hvor den giver mest",
      "At vise industriarmaturer eller tekniske datablade til en HR-chef",
    ],
    keywords: ["kontor", "kontorlandskab", "UGR", "skærmarbejde", "dagslys", "tunable white", "mødelokale", "indeklima"],
    indicative: true,
  },
  {
    id: "br-retail",
    category: "branche",
    title: "Retail og butik",
    technical:
      "Belysningen har to opgaver: almenlys, der skal være effektivt, og accentlys, der sælger varen — med høj farvegengivelse og bevidst lysretning. Brændetimer følger åbningstiden og er høje (ofte 4.000+ inklusive klargøring), og butikker ombygges hyppigt, hvilket gør skinnesystemer og fleksibel styring værdifuldt. Kædekunder beslutter typisk centralt og udruller butik for butik efter et koncept.",
    customerOutcome:
      "Butikschefen får varer, der ser rigtige ud, og et lokale kunderne bliver længere i. Kæden får et koncept, der kan gentages i næste butik, og en driftsbesparelse ganget med antallet af butikker. Piloten i én butik er næsten altid vejen ind.",
    useWhen: ["Butikskæder, showrooms, forhandlere", "Når pilot og udrulning skal foreslås", "Når kunden taler om oplevelse og præsentation frem for drift"],
    pitfalls: [
      "At regne kun på energi. I retail er omsætning pr. m² langt vigtigere end kWh — men vi må aldrig påstå en omsætningseffekt, vi ikke kan dokumentere.",
      "At overse, at kædekunder har en central beslutningsproces og en butikschef uden mandat",
    ],
    keywords: ["retail", "butik", "kæde", "accentlys", "skinne", "farvegengivelse", "showroom", "udrulning"],
    indicative: true,
  },
  {
    id: "br-sportshal",
    category: "branche",
    title: "Sportshaller og idrætsanlæg",
    technical:
      "Krav til lysniveau og jævnhed afhænger af idrætsgren og niveau (træning, turnering, TV), og der stilles særlige krav til flimmerfrihed ved kamera. Armaturerne skal være boldsikre/slagfaste og hænger typisk i 7-12 m, hvilket gør servicearbejde dyrt. Brugsmønsteret er meget svingende — tomt om formiddagen, fyldt om aftenen — og det gør zone- og bookingstyret tænding oplagt. Ejeren er ofte en kommune eller en selvejende institution med et halinspektørled imellem.",
    customerOutcome:
      "Hallen kan tændes i det niveau, aktiviteten kræver — træningslys om aftenen, fuldt lys til kamp — og slukker, når den sidste er gået. Det halverer typisk timerne på fuld effekt, og med LED er der ikke længere ventetid på, at lyset varmer op. Halinspektøren slipper for at bestille lift, hver gang en pære går.",
    useWhen: ["Kommunale haller, idrætsforeninger, selvejende institutioner", "Når budgetproces og politisk beslutning skal håndteres", "Ved argumentation for styring med tydelig effekt"],
    pitfalls: [
      "At love turneringsniveau uden at kende forbundets krav til den enkelte idrætsgren",
      "At glemme boldsikkerhed",
      "At behandle halinspektøren som beslutningstager — han er ofte vores vigtigste allierede, men pengene ligger et andet sted",
    ],
    keywords: ["sportshal", "idræt", "boldsikker", "jævnhed", "booking", "kommune", "hal", "flimmer"],
    indicative: true,
  },
  {
    id: "br-uddannelse",
    category: "branche",
    title: "Uddannelse — skoler, gymnasier, erhvervsskoler",
    technical:
      "Klasselokaler stiller krav til lysniveau på både borde og tavle, lav blænding og god farvegengivelse, og der er ofte et ønske om scener (tavlelys, projektor, gruppearbejde) samt i nogle tilfælde Tunable White. Bygningerne er sammensat af mange små rum plus fællesarealer, gange og faglokaler med hver sit behov. Arbejdet skal så godt som altid ligge i ferierne, og økonomien er politisk styret med årlige budgetter.",
    customerOutcome:
      "Skolen får lokaler, hvor eleverne kan se tavlen uden at sidde i et blændende loft, lærerne får en betjening, der kan bruges uden manual, og kommunen får en anlægsudgift, der kan deles op i etaper hen over flere års budgetter. Arbejdet foregår i ferien, så ingen undervisning aflyses.",
    useWhen: ["Skoler, gymnasier, erhvervsskoler, daginstitutioner", "Ved etapevis udrulning over flere budgetår", "Når brugerinddragelse (lærere, elever) skal indgå"],
    pitfalls: [
      "At planlægge uden hensyn til ferieplanen",
      "At levere en styring, der er for kompliceret til daglig brug — så bliver den sat på fast tændt",
      "At sælge Tunable White på pædagogiske effekter, vi ikke kan dokumentere",
    ],
    keywords: ["skole", "gymnasium", "klasselokale", "tavle", "ferie", "etaper", "kommune", "uddannelse"],
    indicative: true,
  },
  {
    id: "br-offentlig",
    category: "branche",
    title: "Kommunale og offentlige kunder",
    technical:
      "Beslutningen er delt: en teknisk forvaltning eller ejendomsafdeling driver sagen, indkøb styrer processen, og politisk niveau frigiver anlægsmidler. Der er typisk krav om udbud eller brug af rammeaftaler over visse beløbsgrænser, klimamål vedtaget politisk, og bygningsmasse på tværs af mange adresser med meget forskellig alder. Tidshorisonten er lang, og budgetåret styrer alt.",
    customerOutcome:
      "Kunden får en løsning, der kan gentages på tværs af ejendomme, dokumentation der kan bruges i både klimaregnskab og anlægsansøgning, og en etapeplan der passer til budgetårene. Vi gør det nemt at få projektet gennem systemet — det er ofte den reelle flaskehals, ikke prisen.",
    useWhen: ["Kommuner, regioner, statslige institutioner", "Når sagen skal gennem udbud eller politisk godkendelse", "Ved porteføljer af ejendomme frem for én bygning"],
    pitfalls: [
      "At behandle den tekniske kontaktperson som beslutningstager",
      "At undervurdere tidshorisonten og bruge for meget tid for tidligt",
      "At slippe brugeren (skolelederen, halinspektøren, driftsgården), når indkøb overtager",
    ],
    keywords: ["kommune", "offentlig", "udbud", "rammeaftale", "anlægsmidler", "budgetår", "politisk", "portefølje"],
    indicative: true,
  },
  {
    id: "br-ejendom",
    category: "branche",
    title: "Ejendomsejere og udlejere",
    technical:
      "Her er belysningen typisk delt i fællesarealer (trapper, gange, parkering, teknik, udearealer), som ejeren betaler og styrer, og lejemål, som lejeren betaler. Det giver den klassiske interessekonflikt: den der investerer, er ikke altid den der sparer. Til gengæld er fællesarealerne ofte tændt konstant, hvilket giver meget høje brændetimer og dermed korte tilbagebetalingstider. Belysning indgår desuden i ejendommens energimærke og i dokumentationen ved salg, belåning og udlejning.",
    customerOutcome:
      "Ejeren får en investering, der virker uanset hvem der lejer, lavere fællesudgifter der gør ejendommen lettere at leje ud, og et bedre datagrundlag ved energimærkning og finansiering. På parkering, trapper og gange, hvor lyset i dag brænder i døgndrift, er det ofte den hurtigste business case, der findes.",
    useWhen: ["Ejendomsselskaber, pensionskasser, administratorer, andels- og erhvervsudlejning", "Når fællesarealer og døgndrift kan bruges som indgang", "Når lejer/ejer-konflikten skal håndteres eksplicit"],
    pitfalls: [
      "At tale med en administrator som var han ejeren",
      "At foreslå investering i lejemål uden at have afklaret, hvem der får besparelsen",
      "At glemme, at ejeren måler på afkast og udlejningsværdi — ikke på kWh",
    ],
    keywords: ["ejendom", "udlejer", "fællesareal", "parkering", "trappe", "energimærke", "administrator", "afkast"],
    indicative: true,
  },
  /* =========================================== KONKURRENCE (fakta bag pladen) */
  /* Her ligger FAKTA om det, konkurrenterne byder ind med. Selve replikkerne
     og modspørgsmålene ligger i COMPETITOR_PLAYS længere nede. Manualen
     forbyder eksplicit "vi er bedre kvalitet" — derfor er alle punkter her
     formuleret som noget, der kan efterprøves, ikke som en påstand. */
  {
    id: "ko-led-er-led",
    category: "konkurrence",
    title: "“LED er LED” — hvad der faktisk adskiller to LED-armaturer",
    technical:
      "Fire ting kan efterprøves og forklarer stort set hele prisforskellen: 1) driveren — den fejler før dioderne, og dens levetid, overbelastningsmargin og udskiftelighed afgør armaturets reelle levetid; 2) termik — hvor godt varmen ledes væk, afgør både lysnedgang og levetid, og det ses ikke på et datablad; 3) grundlaget for levetidsangivelsen — en L-værdi (fx L80 ved 50.000 timer) skal hvile på målinger og fremskrivning ved en oplyst temperatur, ellers er den bare et tal; 4) dokumentation — fotometrisk fil, tolerance på lysstrøm og farve, flimmer, garantiens ordlyd og hvor reservedelene kommer fra om fem år.",
    customerOutcome:
      "For kunden er forskellen ikke “kvalitet”. Forskellen er, hvor meget lys der er tilbage i hal 2 om syv år, og hvor mange gange der skal bestilles lift i mellemtiden. Det kan regnes på — og det er præcis dét, vi tilbyder at gøre sammen med kunden, i stedet for at påstå noget.",
    useWhen: [
      "Kunden har et billigere tilbud, der ser identisk ud på papiret",
      "Indkøb eller rådgiver sammenligner udelukkende på lumen og watt",
      "Kunden spørger direkte, hvad forskellen er",
    ],
    pitfalls: [
      "At sige “vi er bedre kvalitet”. Manualen forbyder det — det er en påstand, kunden ikke kan efterprøve.",
      "At nedgøre konkurrenten. Stil i stedet spørgsmål, kunden selv kan svare på.",
      "At drukne kunden i fire tekniske punkter, når ét af dem er relevant for netop hans bygning",
    ],
    keywords: ["LED er LED", "driver", "levetid", "L80", "termik", "flimmer", "datablad", "sammenligning", "garanti"],
    indicative: true,
  },
  {
    id: "ko-billig-import",
    category: "konkurrence",
    title: "Billige importarmaturer — hvad der reelt er anderledes",
    technical:
      "Det, der adskiller sig, er sjældent selve dioden, men det omkringliggende: adgang til reservedele og drivere om 3-7 år, leveringstid når noget mangler, hvem der har ansvaret ved reklamation (importør, agent eller producent i udlandet), om der findes fotometrisk dokumentation for netop den vare, der leveres, om der er batchvariation i farve og lysstrøm mellem leverancer, og hvem der står for lift og arbejdsløn ved en udskiftning under garanti — garantien dækker ofte varen, ikke arbejdet.",
    customerOutcome:
      "Kundens risiko ligger ikke i indkøbsprisen, men i, hvad det koster at få det bragt i orden, hvis noget svigter, mens hallen kører. Det er dét regnestykke, kunden selv skal stille op — vi skal bare stille spørgsmålet, så det bliver stillet op inden beslutningen i stedet for bagefter.",
    useWhen: [
      "Kunden har et markant billigere tilbud",
      "Indkøb er kommet ind i sagen",
      "Ved højtsiddende armaturer, hvor arbejdslønnen ved udskiftning er stor",
    ],
    pitfalls: [
      "At tale nedsættende om oprindelsesland frem for om ansvar og reservedele",
      "At undlade at anerkende, at kunden faktisk KAN få det billigere — manualen siger det direkte: “I kan helt sikkert få det billigere.”",
      "At forsvare prisen i stedet for at undersøge, hvad kunden sammenligner med",
    ],
    keywords: ["billig", "import", "reservedele", "garanti", "reklamation", "leveringstid", "risiko", "totaløkonomi"],
    indicative: true,
  },
  {
    id: "ko-retrofit-roer",
    category: "konkurrence",
    title: "LED-rør og retrofit i eksisterende armaturer",
    technical:
      "Et LED-rør i et gammelt lysstofarmatur kræver typisk, at armaturet ombygges (forkobling/starter fjernes eller kobles udenom). Optikken i huset er designet til et lysstofrør og passer ikke nødvendigvis til rørets lysfordeling, så den fotometriske dokumentation for det oprindelige armatur gælder ikke længere. Der er ingen styring med, medmindre der tilføjes særskilt udstyr, og huset — reflektor, tætning, ophæng, ledninger — er stadig lige så gammelt som før. Når et armatur ombygges, flytter ansvaret for det ombyggede armatur sig typisk til den, der udfører ombygningen, og det bør altid afklares med installatøren.",
    customerOutcome:
      "Kunden får den laveste pris pr. lyspunkt og en besparelse på selve forbruget — det skal anerkendes. Til gengæld står kunden tilbage med de gamle huse, ingen styring (og dermed langt den mindste del af den mulige besparelse), ingen dokumentation for lysniveauet og en løsning, der skal laves om igen, når huset er slidt. Det kan være det rigtige valg i en bygning, der skal rives ned om tre år — og det forkerte alle andre steder.",
    useWhen: [
      "Kunden overvejer “bare at skifte rørene”",
      "Elektrikeren har foreslået retrofit",
      "Ved bygninger med kort restlevetid, hvor retrofit faktisk kan være rigtigt",
    ],
    pitfalls: [
      "At afvise retrofit på rygrad. Nogle gange ER det den rigtige løsning — sig det, og bevar troværdigheden.",
      "At undlade at pege på, at retrofit fjerner styringsdelen, altså den største del af besparelsen",
      "At udtale sig kategorisk om ansvarsforhold ved ombygning — henvis til installatøren",
    ],
    keywords: ["LED-rør", "retrofit", "lysstofarmatur", "ombygning", "forkobling", "billigst", "styring", "dokumentation"],
    indicative: true,
  },
  {
    id: "ko-elektrikerens-leverandoer",
    category: "konkurrence",
    title: "Elektrikerens egen leverandør",
    technical:
      "Installatøren køber typisk gennem grossist, arbejder med indkøbsrabatter og avance på materiel, og vælger det, der er hurtigt at montere og let at skaffe. Det er en fuldt legitim forretningsmodel — men den optimerer installationstid, indkøbspris og risiko for reklamation hos installatøren, ikke kundens drift, totaløkonomi eller arbejdsmiljø over 15 år. Manualen er skarp her: installatøren agerer ud fra “godt nok”, og er sjældent kunden — men ofte en god kilde til leads.",
    customerOutcome:
      "Kunden skal ikke vælge mellem sin elektriker og os. Kunden skal have de to ting adskilt: hvem der bestemmer HVAD der skal op (behovet, lysniveauet, styringen, dokumentationen), og hvem der sætter det op. Vi arbejder gerne sammen med kundens elektriker — vi slipper bare ikke dialogen med den, der skal leve med resultatet.",
    useWhen: [
      "Kunden siger “vores elektriker klarer det”",
      "Installatøren er kommet ind mellem os og slutbrugeren",
      "Ved trepartsmøder",
    ],
    pitfalls: [
      "At tale dårligt om elektrikeren — det rammer kunden, der har valgt ham",
      "At acceptere at køre hele sagen gennem installatøren; manualen: uden adgang til slutbrugeren mister vi styringen, og så skal vi overveje at stige af",
      "At glemme, at installatøren kan være en fremragende kilde til nye emner",
    ],
    keywords: ["elektriker", "installatør", "grossist", "mellemled", "slutbruger", "samarbejde", "avance"],
  },
  {
    id: "ko-raadgiver-spec",
    category: "konkurrence",
    title: "Rådgiverens specifikation der lukker os ude",
    technical:
      "Er projektet beskrevet af en rådgiver, før vi kommer ind, er kriterierne allerede sat — ofte med udgangspunkt i ét bestemt fabrikats fotometri, mål eller styringsplatform. Formuleringer som “eller tilsvarende” lyder åbne, men i praksis skal vi dokumentere ligeværdighed på rådgiverens præmisser, og alt der ikke står i beskrivelsen (idriftsættelse, driftsdata, oplæring, etapeplan) kan ikke prissættes ind. Kommer vi ind før beskrivelsen skrives, kan kriterierne i stedet komme til at handle om lysniveau og jævnhed, blænding, styringsfunktioner, driftsdata og totaløkonomi.",
    customerOutcome:
      "Slutbrugeren risikerer at få det, beskrivelsen bad om, i stedet for det, driften har brug for. Vores rolle er ikke at bekæmpe rådgiveren, men at sikre, at slutbrugerens hverdag står i kravene — det er også rådgiverens interesse, hvis han bliver spurgt i tide.",
    useWhen: [
      "Kunden siger “vores rådgiver har lavet beskrivelsen”",
      "Sagen dukker op som færdigt udbudsmateriale",
      "Ved deal rescue, hvor sagen er flyttet til rådgiveren",
    ],
    pitfalls: [
      "At underkende rådgiveren over for kunden",
      "At aflevere vores viden (beregninger, driftsargumenter) til rådgiveren i stedet for til slutbrugeren — manualen advarer eksplicit mod netop det",
      "At byde på en beskrivelse, vi ved ikke løser problemet, uden at sige det højt",
    ],
    keywords: ["rådgiver", "beskrivelse", "udbudsmateriale", "eller tilsvarende", "spec", "kriterier", "lukket ude"],
  },

  /* ================================= INDVENDINGER (fakta bag de typiske nej) */
  {
    id: "iv-vi-har-allerede-led",
    category: "indvending",
    title: "“Vi har allerede skiftet til LED”",
    technical:
      "Første generation af LED-armaturer (typisk fra omkring 2012-2016) ligger væsentligt lavere i virkningsgrad end nutidens, har ofte ingen dæmpning eller styring overhovedet, og en del af dem er nu så langt i deres levetid, at lysstrømmen er faldet mærkbart. Er der skiftet armaturer uden styring, er den største del af den mulige besparelse stadig urealiseret — det er den del, styringen står for. Omvendt: er anlægget nyt og velstyret, er der ingen case, og det skal siges ærligt.",
    customerOutcome:
      "Kunden får afklaret, om der stadig er noget at hente, i stedet for at antage at sagen er lukket. Er der ikke, siger vi det — og bruger i stedet tiden på de områder i bygningen, hvor der ER noget at hente. Det er sådan, man bliver ringet op næste gang.",
    useWhen: [
      "Indvendingen “vi har lige skiftet lyset”",
      "Kunden har skiftet i ét område og ikke i resten",
      "Kunden har skiftet armaturer, men ikke fået styring med",
    ],
    pitfalls: [
      "At antage at der er en case. Spørg først: hvornår, hvilke områder, og kom der styring med?",
      "At tale nedsættende om det, kunden lige har investeret i",
      "At overse, at det ofte kun er en del af bygningen, der er skiftet",
    ],
    keywords: ["allerede LED", "nyt lys", "første generation", "styring", "delvist skiftet", "lysnedgang"],
    indicative: true,
  },
  {
    id: "iv-prisen-ved-at-vente",
    category: "indvending",
    title: "Hvad det koster at vente (uden at presse)",
    technical:
      "Ventetiden har en pris, der kan regnes: den årlige besparelse, der ikke bliver realiseret, plus at energidelen i modellen fremskrives med 3% om året. Udskydes et projekt med en årlig besparelse på 250.000 kr et helt år, er de 250.000 kr væk — de kommer ikke igen. Dertil kommer det vedligehold, der udføres på et anlæg, som alligevel skal skiftes, og risikoen for at reservedele til gamle lysstofanlæg ikke kan skaffes.",
    customerOutcome:
      "Kunden får et tal på sit eget alternativ — “gøre ingenting” — i stedet for et pres fra en sælger. Manualens greb er konsekvensspørgsmålet, ikke argumentet: “Hvad sker der, hvis I ikke gør noget det næste år? Og hvad vil det koste jer?”",
    useWhen: [
      "Indvendingerne “ikke lige nu”, “vi venter til næste år”, “vi tager det med i budgettet næste gang”",
      "Ved prioritering mod andre projekter",
      "Når beslutningen skal flyttes fra drift til investering",
    ],
    pitfalls: [
      "At bruge tallet som pression. Stil spørgsmålet, og hold kæft bagefter — kunden regner selv.",
      "At regne på ventetiden uden at kende budgetprocessen — måske er svaret en etape i år og resten næste år",
      "At tale om tabt besparelse over for en kunde, der ikke har fået bekræftet besparelsen endnu",
    ],
    keywords: ["vente", "ikke lige nu", "timing", "udskyde", "budget", "konsekvens", "alternativomkostning"],
    indicative: true,
  },

  /* ================================================== CASE (brug af cases) */
  {
    id: "cs-brug-af-cases",
    category: "case",
    title: "Sådan bruger vi cases — og hvad vi aldrig gør",
    technical:
      "Casesamlingen i denne videnbase (`CASES`) består af ILLUSTRATIVE eksempler, ikke af verificerede kundereferencer. De er skrevet efter manualens struktur Situation → Problem → Konsekvens → Løsning → Resultat, med generiske beskrivelser (“produktionsvirksomhed på Sjælland, ca. 8.000 m²”) og uden navngivne kunder. Alle er markeret `indicative: true`, og tallene i dem er beregnet med green lights egen metode, ikke målt hos en kunde. De skal udskiftes med green lights rigtige, godkendte cases.",
    customerOutcome:
      "Kunden skal kunne genkende sin egen situation — det er hele formålet med en case. Derfor introduceres den som “et typisk eksempel fra en virksomhed, der lignede jer” og aldrig som en navngiven reference. Netop den ærlighed er det, der gør de tal, vi FAKTISK kan dokumentere, troværdige.",
    useWhen: [
      "Når kunden spørger “har I lavet noget lignende?”",
      "Ved dokumentationsdelen af en præsentation (manualens punkt 3: dokumentér kort)",
      "Når en tvivlende kunde skal kunne se sig selv i en anden virksomheds forløb",
    ],
    pitfalls: [
      "ALDRIG at opfinde eller antyde et kundenavn. Har vi ikke kundens accept, findes referencen ikke.",
      "At bruge et casetal som et løfte i stedet for som et eksempel — sig “typisk”, og tilbyd at regne på kundens egne tal",
      "At fortælle casen i stedet for at stille spørgsmål. Casen skal bekræfte kundens egen konklusion, ikke erstatte den.",
    ],
    keywords: ["case", "reference", "eksempel", "dokumentation", "troværdighed", "social proof"],
    indicative: true,
  },
];
/* --------------------------------------------------------- Referencecases */
/**
 * CustomerCase (jf. salgscoach/src/lib/types.ts):
 *   id, title, industry, customerType, situation, problem, consequence,
 *   solution, result[], useWhen[], indicative
 *
 * !!! LÆS FØRST !!!
 * Alle cases herunder er PLADSHOLDERE — illustrative, typiske forløb, ikke
 * verificerede kundereferencer. Ingen navngivne kunder. Alle er indicative.
 * Tallene er beregnet med green lights egen metode (styring sparer 70% af det
 * nye anlægs forbrug, dagslys 20% af resten, CO₂ 0,133 kg/kWh) på realistiske
 * — men opdigtede — forudsætninger. De skal erstattes af green lights rigtige,
 * godkendte cases. Indtil da må de kun bruges som "et typisk eksempel", aldrig
 * som dokumentation i tilbud eller kundevendt materiale.
 */
export const CASES = [
  {
    id: "case-produktion-sjaelland",
    title: "Produktionshal: lys der følger skiftene",
    industry: "Produktion",
    customerType: "Produktionsvirksomhed på Sjælland, ca. 8.000 m², ca. 320 armaturer, toholdsdrift",
    situation:
      "Hallen var belyst med højtsiddende lysstof- og metalhalogenarmaturer fra to forskellige ombygninger, monteret i 9-10 meters højde. Alt lys blev tændt om morgenen på én hovedafbryder og slukket, når den sidste gik hjem — også i de haldele, hvor der ikke havde været nogen hele dagen.",
    problem:
      "Armaturerne begyndte at falde ud, reservedele var svære at skaffe, og lysniveauet var faldet så meget, at der blev sat arbejdslamper op ved kontrolpladserne. Der var ingen mulighed for at slukke eller dæmpe delvist.",
    consequence:
      "Driftsafdelingen brugte efter eget udsagn adskillige timer om måneden på at skifte armaturer i højden, hvilket krævede lift og betød, at et område måtte lukkes ned. Kvalitetsafdelingen havde registreret flere fejl, som var opdaget for sent, og produktionsledelsen kunne ikke svare på, hvad belysningen kostede dem om året.",
    solution:
      "Lysberegning på hele hallen, udskiftning til LED-højtmonterede armaturer med indbygget sensor tilpasset monteringshøjden, zoneopdeling efter produktionsafsnit og skifteplan, samt idriftsættelse med efterjustering af sensorer efter tre uger i drift. Arbejdet blev udført afsnit for afsnit i planlagte stop og weekender, så produktionen ikke stod stille.",
    result: [
      "Belysningens energiforbrug reduceret med i størrelsesordenen 80-85% (ca. 130.000 kWh om året) — hvoraf armaturskiftet står for godt halvdelen og styringen for resten",
      "Ca. 17 tons CO₂ om året, svarende til ca. 800 træers årlige optag eller ca. 9 personbiler",
      "Tilbagebetalingstid i størrelsesordenen 2-3 år ved de forudsatte 4.000 brændetimer og 2,10 kr/kWh",
      "Arbejdslamperne ved kontrolpladserne kunne fjernes, og lysniveauet blev dokumenteret i lysberegningen",
      "Servicearbejde i højden reduceret til planlagt eftersyn frem for udkald",
    ],
    useWhen: [
      "Produktionsvirksomhed med højtsiddende, blandet armaturbestand",
      "Kunden fokuserer på armaturprisen frem for på driften",
      "Kunden siger, at produktionen ikke kan stoppe",
      "Når styringens andel af besparelsen skal gøres konkret",
    ],
    indicative: true,
  },
  {
    id: "case-hoejlager-trekantomraadet",
    title: "Højlager: lys i den gang, hvor trucken er",
    industry: "Lager og logistik",
    customerType: "Distributionslager i Trekantområdet, ca. 12.000 m², ca. 380 armaturer i 11 meters højde, tæt på døgndrift",
    situation:
      "Reolgange på op til 11 meter med smalgangstruck. Belysningen var oprindeligt dimensioneret til et åbent lager og var aldrig tilpasset, da reolerne kom op. Lyset kørte reelt i døgndrift, fordi der var aktivitet på alle tre skift — men kun i få gange ad gangen.",
    problem:
      "Lyset ramte reolsiderne i stedet for gulvet, plukkere brugte pandelamper i de nederste hylder, og der blev talt om plukkefejl. Ingen kunne slukke i en enkelt gang.",
    consequence:
      "Belysningen var en af de største enkeltposter på elregningen, og hver eneste armaturudskiftning krævede, at en gang blev ryddet og en lift kørt ind — hvilket i praksis blev udskudt, så lysniveauet faldt yderligere.",
    solution:
      "Nye højtmonterede armaturer med smal lysfordeling til reolgange, sensor pr. gang med tilpasset rækkevidde til monteringshøjden, zoner der kan ændres, hvis reolopstillingen laves om, samt driftsdata fra armaturerne, så kunden kan se timer og forbrug pr. område. Udrulning gang for gang uden at lukke lageret.",
    result: [
      "Belysningens energiforbrug reduceret med omkring 80% (i størrelsesordenen 280.000 kWh om året) — den store del kommer af, at gangene nu kun er tændt, når der er aktivitet",
      "Ca. 37 tons CO₂ om året",
      "Tilbagebetalingstid under 2 år ved de forudsatte høje brændetimer — tallet falder markant, hvis lyset reelt skal være tændt i flere gange ad gangen, og skal derfor altid genberegnes på kundens eget aktivitetsmønster",
      "Lysniveauet på gulvet i gangene dokumenteret ved lysberegning inden bestilling",
      "Kunden kan trække forbrug og driftstimer pr. område og bruge dem i sin energirapportering",
    ],
    useWhen: [
      "Højlager, distributionscenter, 3PL",
      "Når det skal forklares, hvorfor styring er større end armaturet",
      "Kunden har lav belægning pr. gang, men høj samlet brændetid",
      "Ved lifttunge projekter, hvor udskiftninger er dyre",
    ],
    indicative: true,
  },
  {
    id: "case-foedevare-nordjylland",
    title: "Fødevareproduktion: armaturer der kan spules ned",
    industry: "Fødevareindustri",
    customerType: "Fødevarevirksomhed i Nordjylland, ca. 3.500 m² produktion og pakkeri, ca. 160 armaturer",
    situation:
      "Produktions- og pakkeriområder blev spulet ned hver nat. Armaturerne var oprindeligt monteret som almindelige industriarmaturer med efterfølgende tætningsforsøg, og flere havde vand og korrosion i kabinettet.",
    problem:
      "Armaturer faldt ud i utide, og ved en intern audit blev der stillet spørgsmål til, om afskærmningen af lyskilderne var tilstrækkelig i forhold til risikoen for fremmedlegemer.",
    consequence:
      "Hver udskiftning skulle ske i nattens rengøringsvindue eller koste produktionstid, kvalitetsafdelingen brugte tid på afvigelser, og virksomheden risikerede en bemærkning i næste audit — hvilket vejede tungere hos ledelsen end elregningen.",
    solution:
      "Armaturer i høj tæthedsgrad egnet til daglig højtryksrengøring, glatte kabinetter uden samlepunkter for snavs, splintsikker afskærmning, dokumentation til egenkontrollen, samt zonestyring så pakkeri og produktion kan køre uafhængigt. Montage lagt i nattens rengøringsvindue, område for område.",
    result: [
      "Belysningens energiforbrug reduceret med i størrelsesordenen 80% (ca. 60.000 kWh om året), svarende til ca. 8 tons CO₂",
      "Dokumentation for tæthedsgrad og afskærmning vedlagt til kvalitetssystemet",
      "Ingen produktionstimer mistet under udskiftningen",
      "Udskiftninger på grund af fugt og korrosion faldt bort som post i vedligeholdsbudgettet",
    ],
    useWhen: [
      "Fødevare-, medico- og procesvirksomheder med daglig vådrengøring",
      "Når kunden nævner audit, egenkontrol eller fremmedlegemer",
      "Når hygiejne og dokumentation vejer tungere end energi",
    ],
    indicative: true,
  },
  {
    id: "case-vaerksted-fyn",
    title: "Værksted: et lille projekt, der blev besluttet på ét møde",
    industry: "Værksted",
    customerType: "Maskinværksted på Fyn, ca. 1.200 m², ca. 48 armaturer, ejerledet",
    situation:
      "Ét hallignende værkstedsrum med maskiner, arbejdsborde og et lille lager. Belysningen var lysstofarmaturer fra 1990'erne, suppleret med arbejdslamper ved de fleste arbejdsborde.",
    problem:
      "Lyset var gult og ujævnt, flere armaturer flimrede, og ved finere arbejde og fejlfinding kunne farver og detaljer ikke bedømmes ordentligt.",
    consequence:
      "Der blev lavet om, når noget var målt eller monteret forkert, svendene brokkede sig, og ejeren havde svært ved at tiltrække nye folk til et værksted, der så nedslidt ud indenfor.",
    solution:
      "Enkel løsning: nye armaturer med høj farvegengivelse, jævn fordeling over arbejdsområderne og let tilstedeværelsesstyring i lager- og gennemgangsområder. Trådløs styring, så der ikke skulle trækkes styrekabler i en gammel installation. Opsat på to dage uden at værkstedet lukkede.",
    result: [
      "Belysningens energiforbrug reduceret med i størrelsesordenen 80-85% (ca. 9.000 kWh om året) — et lille beløb i kroner, fordi anlægget er lille",
      "Tilbagebetalingstid i størrelsesordenen 3-4 år, altså længere end i de store haller — små projekter med moderate brændetimer skal bæres af arbejdsforhold, ikke af energi",
      "Arbejdslamperne ved bordene blev overflødige",
      "Ejeren nævnte selv rekruttering og indtryk over for kunder som den vigtigste gevinst",
    ],
    useWhen: [
      "Mindre virksomheder hvor ejeren selv beslutter",
      "Når en sælger tror, at små sager ikke kan bære en ordentlig proces",
      "Når casen skal bæres af arbejdsforhold frem for kWh",
      "Ved trådløs styring i en gammel installation",
    ],
    indicative: true,
  },
  {
    id: "case-kontordomicil",
    title: "Kontordomicil: blændfrit lys og dagslys i facadezonen",
    industry: "Kontor",
    customerType: "Kontordomicil i Storkøbenhavn, ca. 4.000 m² over tre etager, ca. 520 armaturer",
    situation:
      "Kontorlandskaber langs facaderne, mødelokaler og stillerum i kernen. Den oprindelige belysning var ældre indbygningsarmaturer, tændt etagevis fra en central afbryder morgen til aften.",
    problem:
      "Medarbejdere klagede over reflekser i skærmene og over, at det var alt for lyst ved vinduerne på solskinsdage, mens de inderste pladser føltes mørke. Mødelokalerne havde samme lys som kontoret, uanset om der blev holdt videomøde eller workshop.",
    consequence:
      "Emnet kom op i arbejdsmiljøorganisationen, HR fik det på dagsordenen, og enkelte medarbejdere havde selv slukket armaturer over deres pladser — hvilket gjorde lyset endnu mere ujævnt. Ledelsen ønskede samtidig at gøre kontoret mere attraktivt at møde ind på.",
    solution:
      "Armaturer med lav blænding til skærmarbejde, dokumenteret lysniveau og jævnhed pr. zone via lysberegning, dagslysstyring i facadezonerne, tilstedeværelsesstyring i mødelokaler og stillerum samt scener i mødelokalerne. Udført etage for etage, en etage ad gangen, mens de øvrige arbejdede.",
    result: [
      "Belysningens energiforbrug reduceret med i størrelsesordenen 80-85% (ca. 60.000 kWh om året), hvoraf dagslysstyringen i facadezonen står for en selvstændig del oven i den øvrige styring",
      "Tilbagebetalingstid i størrelsesordenen 4-5 år — længere end i industrien, fordi brændetimerne er lavere; beslutningen blev truffet på arbejdsmiljø og fleksibilitet, med økonomien som forudsætning frem for som drivkraft",
      "Klagerne over reflekser ophørte, og sagen kunne lukkes i arbejdsmiljøorganisationen",
      "Zoner og scener kan ændres ved næste kontorombygning uden nye kabler",
    ],
    useWhen: [
      "Kontorkunder hvor energibesparelsen alene ikke kan bære casen",
      "Når HR, facility eller arbejdsmiljø er indgangen",
      "Ved klager over blænding og reflekser",
      "Når dagslysstyringens separate bidrag skal forklares",
    ],
    indicative: true,
  },
  {
    id: "case-retail-pilot",
    title: "Butikskæde: én butik som pilot, før hele kæden",
    industry: "Retail",
    customerType: "Butikskæde med ca. 30 butikker, pilot i én butik på ca. 900 m², ca. 70 armaturer",
    situation:
      "Kæden overvejede at ændre belysningskoncept i alle butikker, men havde tidligere haft en dårlig oplevelse med en udrulning, der ikke virkede efter hensigten. Beslutningen lå centralt, mens butikscheferne mærkede resultatet.",
    problem:
      "Det eksisterende lys var ensartet og fladt: varerne trådte ikke frem, og farverne på tekstiler så anderledes ud i butikken end derhjemme. Samtidig var alt tændt på fuld styrke fra klargøring om morgenen til oprydning om aftenen.",
    consequence:
      "Butikschefen kunne ikke fremhæve kampagnevarer uden at flytte rundt på spots, og indkøb havde ingen dokumentation for, hvad et koncept ville betyde i drift, ganget med tredive butikker.",
    solution:
      "Pilot i én butik: almenlys med god farvegengivelse plus accentlys på skinne, så opstillingen kan ændres uden elektriker, natsænkning og dæmpning uden for åbningstid, samt dagslysstyring i den forreste zone. Piloten blev målt og gennemgået med både butikschef og indkøb, før der blev talt om resten af kæden.",
    result: [
      "Belysningens energiforbrug i pilotbutikken reduceret med omkring 60% (ca. 13.000 kWh om året) — bemærk at styringsandelen her er lavere end i værktøjets standard på 70%, fordi lyset ikke kan slukkes i åbningstiden; det er et godt eksempel på, at 70% er en beregningsantagelse og ikke en naturlov",
      "Et koncept der kunne gentages i de øvrige butikker med kendte forudsætninger",
      "Butikschefen kan flytte accentlys ved kampagneskift uden at bestille elektriker",
      "Beslutningen om udrulning blev truffet på et resultat, kæden selv havde set — ikke på et tilbud",
    ],
    useWhen: [
      "Kædekunder med central beslutning og lokal drift",
      "Når pilotprojekt skal foreslås som næste skridt",
      "Når kunden har brændt sig på en tidligere udrulning",
      "Når styringsandelen skal nuanceres ærligt",
    ],
    indicative: true,
  },
  {
    id: "case-sportshal-kommunal",
    title: "Sportshal: fuldt lys til kamp, træningslys til hverdag",
    industry: "Sport og fritid",
    customerType: "Kommunal idrætshal, én hal plus omklædning og fællesareal, ca. 40 hal-armaturer i ca. 9 meters højde",
    situation:
      "Hallen var belyst med metalhalogenarmaturer, der skulle varme op efter tænding og derfor blev tændt tidligt om eftermiddagen og først slukket, når den sidste forening var gået om aftenen. Halinspektøren tændte og slukkede manuelt.",
    problem:
      "Flere armaturer var faldet ud, lysniveauet var ujævnt, og der kunne ikke skrues ned til almindelig træning. Ved kampe blev der klaget over, at det var svært at følge bolden i den ene ende.",
    consequence:
      "Hver udskiftning krævede lift i hallen og dermed aflysning af aktiviteter, foreningerne klagede til kommunen, og hallen brugte strøm i mange timer, hvor der reelt kun var en enkelt aktivitet i gang.",
    solution:
      "Boldsikre LED-armaturer med dokumenteret lysniveau og jævnhed til de aktuelle idrætsgrene, zoneopdeling så halvdelen af hallen kan bruges alene, tre lysniveauer (rengøring, træning, kamp) og tænding koblet til hallens bookingrytme. Omklædning og fællesareal med tilstedeværelsesstyring.",
    result: [
      "Belysningens energiforbrug reduceret med i størrelsesordenen 75-80% (ca. 22.000 kWh om året), primært fordi der ikke længere køres fuldt lys i alle timer",
      "Tilbagebetalingstid i størrelsesordenen 3-5 år afhængigt af hallens faktiske belægning",
      "Lyset er øjeblikkeligt ved tænding — ingen opvarmningstid, og dermed heller ingen grund til at lade det stå tændt",
      "Halinspektøren slipper for at bestille lift ved enkeltudfald, og aktiviteter aflyses ikke",
    ],
    useWhen: [
      "Kommunale haller, foreningsdrevne anlæg, selvejende institutioner",
      "Når brugsmønsteret er meget svingende",
      "Når styringens effekt kan ses og mærkes med det samme",
      "Ved politisk styret budgetproces",
    ],
    indicative: true,
  },
  {
    id: "case-skole-etaper",
    title: "Skole: tre somre, tre etaper, ét princip",
    industry: "Uddannelse",
    customerType: "Folkeskole i en midtjysk kommune, ca. 6.000 m², ca. 640 armaturer, udført i tre etaper",
    situation:
      "Klasselokaler, faglokaler, gange og fællesarealer med belysning fra flere ombygninger. Skolen havde fået udskiftet lyset i én fløj få år forinden, men uden styring, og resten var oprindelige lysstofarmaturer.",
    problem:
      "Ujævnt lys i klasselokalerne, tavlen dårligere belyst end bordene, og lærerne kunne ikke dæmpe ved projektorbrug. Lyset stod tændt i gangene hele skoledagen.",
    consequence:
      "Lyset kom op på arbejdsmiljøudvalgets dagsorden, forældre og lærere efterspurgte handling, og kommunen kunne ikke frigive midler til hele skolen på ét år.",
    solution:
      "Fælles princip og platform blev fastlagt i etape 1, så etape 2 og 3 kunne kobles direkte på uden ombygning: blændfri armaturer i klasselokalerne med særskilt tavlebelysning, enkel betjening med få scener, tilstedeværelsesstyring i gange, toiletter og fællesarealer, og dagslysstyring mod syd. Alt arbejde udført i sommerferierne over tre år.",
    result: [
      "Belysningens energiforbrug reduceret med i størrelsesordenen 80% (ca. 55.000 kWh om året) ved fuld udrulning",
      "Tilbagebetalingstid i størrelsesordenen 5-6 år på grund af lave brændetimer — beslutningen blev truffet på arbejdsmiljø, undervisningskvalitet og en etapeplan, der passede til budgetårene",
      "Ingen undervisningsdage berørt, fordi arbejdet lå i ferierne",
      "Etape 2 og 3 kunne udbydes og udføres uden ny projektering af princippet",
    ],
    useWhen: [
      "Skoler, gymnasier og institutioner med årlige budgetter",
      "Når kunden ikke har råd til hele bygningen i år",
      "Når etapeplanens betingelse (fælles princip fastlagt i etape 1) skal forklares",
      "Når arbejdet skal ligge i ferier eller lukkeperioder",
    ],
    indicative: true,
  },
  {
    id: "case-kommunal-portefoelje",
    title: "Kommunal ejendomsportefølje: fra enkeltprojekt til rammeaftale",
    industry: "Offentlig",
    customerType: "Kommunal ejendomsafdeling med ca. 14 ejendomme i første bølge (haller, institutioner, administration, driftsgårde)",
    situation:
      "Kommunen havde vedtaget et klimamål og en energihandlingsplan, men ejendomsafdelingen manglede overblik over, hvor belysningen faktisk kostede mest, og hvordan projekterne skulle prioriteres mellem budgetårene.",
    problem:
      "Hver ejendom blev håndteret som en enkeltsag med hver sin leverandør og hver sin styring. Der var ingen fælles dokumentation, ingen ensartede armaturtyper og intet samlet tal til klimaregnskabet.",
    consequence:
      "Driftsafdelingen skulle vedligeholde mange forskellige systemer uden samlet adgang, indkøb brugte tid på gentagne processer, og klimarapporteringen byggede på skøn frem for på målte forbrugstal.",
    solution:
      "Screening og energiberegning på tværs af ejendommene med prioriteret rækkefølge efter brændetimer og tilstand, ét fælles princip for armaturvalg og styring på tværs, dokumentationspakke pr. ejendom, og et oplæg til kravformulering, som indkøb kunne bruge i udbud/rammeaftale — udarbejdet sammen med ejendomsafdelingen, før beskrivelsen blev skrevet.",
    result: [
      "En prioriteret plan, hvor de ejendomme med flest brændetimer (haller, driftsgårde, P-kældre) blev taget først, med tilbagebetalingstider i den korte ende",
      "Fælles armatur- og styringsprincip, så driften har ét system at forholde sig til på tværs af ejendomme",
      "Samlet dokumentation af kWh før/efter og CO₂ med angivet faktor, direkte anvendelig i kommunens klimaregnskab",
      "Kravformuleringen kom til at handle om lysniveau, blænding, styringsfunktioner, driftsdata og totaløkonomi — ikke kun om pris pr. armatur",
    ],
    useWhen: [
      "Kommuner, regioner og større ejendomsporteføljer",
      "Når indkøb eller udbud kommer ind i sagen",
      "Når kunden mangler overblik over, hvor der er mest at hente",
      "Når vi skal med, før specifikationen skrives",
    ],
    indicative: true,
  },
  {
    id: "case-ejendom-faellesareal",
    title: "Erhvervsejendom: fællesarealer og P-kælder i døgndrift",
    industry: "Ejendom",
    customerType: "Ejendomsselskab, én erhvervsejendom med ca. 120 armaturer i P-kælder, trapper, gange og teknikrum",
    situation:
      "Fællesarealer og parkeringskælder var tændt i døgndrift, fordi der ikke var nogen anden mulighed — anlægget var fra bygningens opførelse, og alt hang på få grupper. Lejemålene havde deres egne installationer og egne målere.",
    problem:
      "Fællesudgifterne var høje og steg med elprisen, og armaturerne i P-kælderen var slidte, med flere mørke felter mellem parkeringsbåsene, hvilket lejerne havde bemærket.",
    consequence:
      "Ejeren betalte for lys hele døgnet i arealer, der reelt var tomme det meste af natten, og de høje fællesudgifter var et argument, lejerne brugte ved genforhandling. Samtidig gav mørke områder i kælderen en tryghedsdiskussion.",
    solution:
      "LED-armaturer i P-kælder, trapper og gange med tilstedeværelsesstyring, hvor lyset dæmpes til et lavt grundniveau frem for at slukke helt (af hensyn til tryghed og kamera), zoneopdeling pr. kælderafsnit, og dokumentation af det nye forbrug til fællesudgiftsregnskabet.",
    result: [
      "Belysningens energiforbrug i fællesarealerne reduceret med i størrelsesordenen 80-85% (ca. 32.000 kWh om året), fordi udgangspunktet var reel døgndrift",
      "Tilbagebetalingstid under 2 år — det er typisk den hurtigste business case, der findes i en ejendom, netop på grund af brændetimerne",
      "Lavere fællesudgifter, som kunne dokumenteres over for lejerne",
      "Ensartet lysniveau i hele kælderen, uden mørke felter mellem båsene",
    ],
    useWhen: [
      "Ejendomsselskaber, administratorer, andels- og erhvervsudlejning",
      "Når lejer/ejer-konflikten skal omgås ved at starte i fællesarealerne",
      "Når en hurtig business case skal bruges som indgang til en større portefølje",
      "Ved døgndrift og parkeringsanlæg",
    ],
    indicative: true,
  },
  {
    id: "case-lille-produktion-pilot",
    title: "Mindre produktion: pilot i én hal blev til hele virksomheden",
    industry: "Produktion",
    customerType: "Mindre produktionsvirksomhed i Jylland, ca. 900 m² i to haller, i alt ca. 60 armaturer",
    situation:
      "Virksomheden havde fået tre tilbud på nye armaturer, hvoraf det billigste lå markant under de øvrige. Ejeren var i tvivl om, hvad forskellen egentlig var, og havde udskudt beslutningen i over et år.",
    problem:
      "Det eksisterende lys var gammelt og ujævnt, men ejeren kunne ikke gennemskue, om det dyrere tilbud var pengene værd, og ville ikke risikere at bruge et større beløb på noget, der viste sig at være det samme.",
    consequence:
      "Beslutningen blev udskudt igen og igen, mens der fortsat blev brugt tid på at skifte armaturer og på at høre om lyset fra medarbejderne. Alternativet — at gøre ingenting — kostede mere end nogen havde regnet på.",
    solution:
      "I stedet for at argumentere mod det billige tilbud blev der lavet en pilot i den mindste hal: 24 armaturer med styring, dokumenteret lysberegning før og målt forbrug efter. Aftalen var eksplicit: virkede det som beskrevet, blev hal 2 taget efterfølgende.",
    result: [
      "Ejeren kunne se og mærke forskellen i sin egen hal frem for at sammenligne datablade",
      "Hal 2 blev besluttet ca. seks uger senere, uden ny tilbudsrunde",
      "Belysningens energiforbrug i pilothallen reduceret med i størrelsesordenen 80%, og forudsætningerne for hal 2 var dermed kendte og ikke et skøn",
      "Beslutningen blev truffet på fakta fra kundens egen bygning — manualens pointe om, at piloten reducerer risiko og gør ja'et mindre",
    ],
    useWhen: [
      "Kunden tøver, sammenligner tilbud og kan ikke se forskellen",
      "Små og mellemstore sager hvor ejeren selv beslutter",
      "Når pilot skal bruges som næste skridt i stedet for pres",
      "Ved indvendingen “vi kan få det billigere”",
    ],
    indicative: true,
  },
  {
    id: "case-atex-lakering",
    title: "Lakeringsafdeling: ATEX-zone med almindelige armaturer",
    industry: "Produktion / ATEX",
    customerType: "Overfladebehandlingsvirksomhed, ca. 2.000 m², heraf en lakerings- og pulverafdeling med zoneklassificering",
    situation:
      "Virksomheden ville renovere belysningen i hele bygningen. I lakerings- og pulverafdelingen var der en zoneklassificering i eksplosionssikringsdokumentet, men den var flere år gammel, og armaturerne var udskiftet i mellemtiden.",
    problem:
      "Ved gennemgangen viste det sig, at der i det klassificerede område sad almindelige industriarmaturer, som ikke matchede zonen. Et konkurrerende tilbud havde prissat samme armaturtype i hele bygningen, inklusive det klassificerede område.",
    consequence:
      "Virksomheden stod med et forhold, der kunne give en bemærkning ved næste eftersyn og i værste fald en forsikringsdiskussion — og med et tilbud, der så billigt ud, fordi det ikke tog højde for zonen. Ingen af delene var opdaget, fordi ingen havde bedt om at se dokumentationen.",
    solution:
      "Zoneplanen blev hentet frem hos kunden og gennemgået med deres egen rådgiver — green light fastsætter ikke zoner. Ex-armaturer med korrekt kategori, beskyttelsesart og temperaturklasse i det klassificerede område, almindelige industriarmaturer i resten, styring placeret uden for zonen, og dokumentation samlet, så den kan fremvises ved eftersyn. Længere leveringstid på Ex-delen blev lagt ind i tidsplanen fra start.",
    result: [
      "Belysningen i det klassificerede område matcher nu zoneklassificeringen, med dokumentation der kan fremvises",
      "Resten af bygningen fik en almindelig LED-løsning med styring — Ex-kravet blev ikke unødigt bredt ud over hele bygningen, hvilket ville have fordyret projektet markant",
      "Forskellen til det billige tilbud blev synlig som et forhold, kunden selv kunne efterprøve, i stedet for som en påstand om kvalitet",
      "Tidsplanen holdt, fordi leveringstiden på Ex-armaturerne var kendt fra begyndelsen",
    ],
    useWhen: [
      "Kunden nævner lakering, pulver, sprit, støv, silo, foder eller biogas",
      "Når et konkurrerende tilbud ser billigt ud, fordi noget ikke er med",
      "Når det skal vises, hvordan man håndterer et forhold hos kunden uden at optræde som myndighed",
      "Ved projekter med lang leveringstid på dele af leverancen",
    ],
    indicative: true,
  },
];
/* ------------------------------------------------------- Konkurrentspil */
/**
 * Typiske konkurrentargumenter og green lights svar. Grundlaget er manualens
 * kapitel 8 (pris og billige alternativer) og kapitel 15 (rådgivere,
 * elektrikere og indkøb).
 *
 * REGLEN: Svaret må ALDRIG være "vi er bedre kvalitet". Manualen forbyder det
 * eksplicit, fordi det er en påstand, kunden ikke kan efterprøve. Svaret er
 * altid: anerkend → stil et risiko-/konsekvensspørgsmål → gør forskellen til
 * noget, kunden selv kan regne efter.
 *
 * Felter:
 *   id, label (kort, sikker at vise i browseren), claim (argumentet som det
 *   lyder), whoSaysIt, whatIsTrue (den ærlige anerkendelse), whatItMisses,
 *   greenLightAnswer (replik), questions, proofPoints, neverSay, manualRefs,
 *   keywords
 */
export const COMPETITOR_PLAYS = [
  {
    id: "kp-billig-import",
    label: "Billige importarmaturer",
    claim:
      "Vi kan få tilsvarende armaturer til det halve gennem en importør — de har samme lumen og samme watt.",
    whoSaysIt: "Indkøb, ejerleder, teknisk chef med et konkurrerende tilbud i hånden",
    whatIsTrue:
      "Det er rigtigt. Kunden KAN få det billigere, og på et datablad kan to armaturer se ens ud. Manualen siger det direkte: “I kan helt sikkert få det billigere.” At benægte det koster troværdighed med det samme.",
    whatItMisses:
      "Prisen dækker armaturet, ikke konsekvensen. Det, der ikke står i tilbuddet: hvem skaffer en driver om fem år, hvem betaler lift og arbejdsløn ved en udskiftning under garanti, findes der fotometrisk dokumentation for netop den leverede vare, og hvem står der, hvis noget svigter, mens hallen kører.",
    greenLightAnswer:
      "“I kan helt sikkert få det billigere. Spørgsmålet er bare: Hvad koster det jer, hvis løsningen ikke performer som forventet? Selve armaturet er ofte den mindste omkostning — det dyre kommer, hvis levetiden ikke holder, driverne skal skaffes hjem, eller I skal bruge lift og driftstid på udskiftninger igen om to-tre år. Skal vi ikke kigge på de forskelle sammen og så se, om I reelt kan nøjes med den billige løsning? Kan I det, så skal I vælge den — men på et oplyst grundlag.”",
    questions: [
      "Hvad sammenligner du med — må jeg se, hvad der er med i det tilbud?",
      "Hvad koster det jer hver gang, nogen skal bruge tid på en fejl deroppe?",
      "Hvor lang tid går der, fra et armatur fejler, til nogen kommer op til det i dag?",
      "Garanti er én ting — men hvem står der om fem år, hvis der opstår problemer?",
      "Er fokus mest indkøbspris eller totaløkonomi på det her projekt?",
    ],
    proofPoints: [
      "Lysberegning på kundens egen bygning, så lysniveauet er dokumenteret før køb — ikke lovet",
      "Regnestykket på arbejdsløn og lift ved udskiftning i højden, opstillet med kundens egne tal",
      "Driftsdata fra armaturerne (driftstimer, forbrug, fejl), så vedligehold kan planlægges frem for opdages",
      "Pilot/prøveopsætning i ét område, så kunden ser forskellen i sin egen bygning",
    ],
    neverSay: [
      "“Vi er bedre kvalitet.”",
      "“Kinesisk skidt.” — nedgør aldrig konkurrenten eller oprindelseslandet; stil spørgsmål i stedet.",
      "“Det kan ikke passe, at de kan levere til den pris.”",
    ],
    manualRefs: ["p8-aldrig-kun-pris", "p8-usikkerhed-om-billigt", "p8-for-dyrt"],
    keywords: ["billig", "import", "pris", "halv pris", "konkurrent", "tilbud", "totaløkonomi"],
  },
  {
    id: "kp-led-roer-retrofit",
    label: "LED-rør / retrofit i eksisterende armaturer",
    claim:
      "Vi sætter bare LED-rør i de armaturer, vi har. Det koster en brøkdel og giver da også en besparelse.",
    whoSaysIt: "Driftsleder, vicevært, elektriker med en hurtig løsning",
    whatIsTrue:
      "Det er den laveste pris pr. lyspunkt, og der ER en reel besparelse på selve forbruget. I en bygning, der skal rives ned eller sælges om få år, kan det være det rigtige valg — og det skal siges højt.",
    whatItMisses:
      "Huset er stadig lige så gammelt: reflektor, tætning, ophæng og ledninger. Optikken er designet til et lysstofrør, så den oprindelige lysdokumentation gælder ikke længere. Og der kommer ingen styring med — altså netop den del, der i green lights beregningsmetode står for hovedparten af den mulige besparelse.",
    greenLightAnswer:
      "“Det er faktisk en fornuftig løsning nogle steder — hvis bygningen skal bruges få år endnu, ville jeg selv pege på den. Det, I skal være opmærksomme på, er, at I får den mindste del af besparelsen: det er styringen, der fjerner de timer, hvor lyset brænder uden at nogen har gavn af det. Må jeg spørge — hvor længe regner I med at bruge hallen som i dag?”",
    questions: [
      "Hvor længe skal bygningen bruges, som den bruges i dag?",
      "Hvor mange timer om dagen er der reelt nogen i det område?",
      "Hvad gør I, når selve armaturhuset er slidt — er I så tilbage til den samme beslutning om tre år?",
      "Hvem har ansvaret for armaturet, når det er bygget om? Har I vendt det med jeres installatør?",
    ],
    proofPoints: [
      "Sammenligning af de to veje på kundens egne brændetimer: rør alene vs. armatur + styring",
      "Lysberegning der viser, hvad lysfordelingen bliver i det gamle hus kontra i et nyt armatur",
      "Etapeplan, hvor retrofit bruges i bygninger med kort restlevetid og nye armaturer, hvor bygningen skal leve længe",
    ],
    neverSay: [
      "“Det kan man ikke.” — jo, det kan man, og nogle gange er det rigtigt.",
      "“Det er ulovligt.” — vi udtaler os ikke om ansvarsforhold ved ombygning; det afklares med installatøren.",
    ],
    manualRefs: ["p8-usikkerhed-om-billigt", "p1-loesning-ikke-armatur", "p5-spc-vaerdi"],
    keywords: ["LED-rør", "retrofit", "billigst", "ombygning", "lysstof", "hurtig løsning"],
  },
  {
    id: "kp-led-er-led",
    label: "“LED er LED”",
    claim:
      "LED er LED. Dioderne kommer alligevel fra de samme fabrikker — så det er bare et spørgsmål om, hvem der er billigst.",
    whoSaysIt: "Indkøber, teknisk chef, rådgiver under prispres",
    whatIsTrue:
      "Der er noget om det: dioderne er i høj grad en råvare, og forskellen i selve lyskilden er blevet mindre. Anerkend det — ellers lyder vi som en sælger, der forsvarer sin pris.",
    whatItMisses:
      "Det, der fejler først, er ikke dioden, men driveren — og det, der bestemmer, hvor meget lys der er tilbage om syv år, er varmeafledning og driftsforhold. Dertil kommer, om levetidsangivelsen hviler på målinger ved en oplyst temperatur, om der findes fotometrisk dokumentation for netop den vare der leveres, og hvad garantien reelt dækker (varen eller også arbejdet).",
    greenLightAnswer:
      "“Du har ret i, at dioderne ligner hinanden mere og mere. Forskellen ligger et andet sted: det er driveren, der fejler først, og det er varmen, der afgør, hvor meget lys der er tilbage om syv år. Det behøver du ikke tage mit ord for — det står i dokumentationen, og vi kan gennemgå de to tilbud på præcis de punkter. Så kan du selv se, om der er en forskel, der betyder noget for jer.”",
    questions: [
      "Hvad står der om levetid i det andet tilbud — og ved hvilken temperatur?",
      "Hvad sker der hos jer, hvis lysniveauet er faldet 20% om fem år?",
      "Dækker garantien også arbejdet og liften, eller kun selve armaturet?",
      "Hvor mange armaturer må gerne fejle om året, før det bliver et problem for driften?",
    ],
    proofPoints: [
      "Gennemgang af de to tilbud punkt for punkt på driver, levetidsgrundlag, dokumentation og garantiens ordlyd",
      "Fotometrisk fil og lysberegning på kundens egen bygning",
      "Driftsdata fra armaturet (D4i), så kunden efterfølgende kan se, om anlægget opfører sig som lovet",
    ],
    neverSay: [
      "“Vi er bedre kvalitet.”",
      "“Deres armaturer holder ikke.” — vi taler om, hvad der kan efterprøves, ikke om, hvad vi tror om konkurrenten.",
    ],
    manualRefs: ["p8-aldrig-kun-pris", "p1-differentiering", "p10-praesentationsstruktur"],
    keywords: ["LED er LED", "diode", "ens", "sammenligning", "datablad", "levetid", "driver"],
  },
  {
    id: "kp-elektrikerens-leverandoer",
    label: "Elektrikerens egen leverandør",
    claim:
      "Vores elektriker klarer det — han har en leverandør, han plejer at bruge, og han giver os en god pris.",
    whoSaysIt: "Driftschef, ejerleder, teknisk ansvarlig med et fast håndværkersamarbejde",
    whatIsTrue:
      "Elektrikeren er dygtig til sit, kender bygningen, og relationen er værdifuld for kunden. Det skal respekteres — kunden har selv valgt ham.",
    whatItMisses:
      "Installatøren optimerer det, han bliver målt på: indkøbspris, montagetid og lav risiko for reklamation. Det er en legitim forretningsmodel, men den er ikke det samme som kundens drift, arbejdsmiljø og totaløkonomi over 15 år. Manualen er skarp: installatøren agerer ud fra “godt nok”.",
    greenLightAnswer:
      "“Det gør vi også gerne — jeres elektriker skal endelig være med, han kender jo huset. Men for at løsningen matcher jeres drift og hverdag, er det vigtigt, at vi også får jeres perspektiv med. Jeg slipper ikke dialogen direkte med dig, for jeg har et ansvar for, at det samlede resultat lever op til det, vi lover DIG. Giver det mening, at vi tager et fælles møde, så vi får alle perspektiver med?”",
    questions: [
      "Hvem beslutter, hvad der skal op — og hvem sætter det op? Er det den samme beslutning?",
      "Hvad er vigtigst for jer: at montagen er billigst muligt, eller at anlægget er billigst muligt at have?",
      "Hvad skete der sidste gang, I fik skiftet lys — blev det, som I havde forestillet jer?",
      "Hvad ville du gerne have haft med sidste gang, som ikke kom med?",
    ],
    proofPoints: [
      "Trepartsmøde med kunde, installatør og green light, hvor grænsefladen aftales åbent",
      "Lysberegning og zoneplan, som installatøren kan udføre efter",
      "Klar arbejdsdeling: vi tager behov, dokumentation og styring — installatøren tager udførelsen",
    ],
    neverSay: [
      "“Din elektriker ved ikke nok om lys.” — det rammer kunden, ikke elektrikeren.",
      "“Så skal I vælge, om det er ham eller os.” — det er en falsk modsætning.",
    ],
    manualRefs: ["p15-hold-fast-i-slutbrugeren", "p2-installatoer-som-kilde"],
    keywords: ["elektriker", "installatør", "leverandør", "mellemled", "treparts", "slutbruger"],
  },
  {
    id: "kp-raadgiver-spec",
    label: "Rådgiverens spec lukker os ude",
    claim:
      "Vores rådgiver har allerede lavet beskrivelsen. Du er velkommen til at byde på den — der står jo “eller tilsvarende”.",
    whoSaysIt: "Bygherre, ejendomschef, projektleder i et rådgiverstyret projekt",
    whatIsTrue:
      "Rådgiveren gør sit arbejde og har ofte styr på både proces og krav. Og ja — vi kan byde. Det skal anerkendes uden bitterhed.",
    whatItMisses:
      "Når beskrivelsen er skrevet, er kriterierne sat. Alt det, der ikke står i den — idriftsættelse, driftsdata, oplæring, etapeplan, hensyn til produktionen — kan ikke prissættes ind, og så vindes sagen på pris. Slutbrugeren får dét, beskrivelsen bad om, ikke nødvendigvis dét, driften har brug for. Manualen advarer desuden mod at aflevere vores viden til rådgiveren i stedet for til slutbrugeren.",
    greenLightAnswer:
      "“Det giver god mening, at I har fået lavet en beskrivelse — og vi byder gerne. Det eneste jeg vil sikre er, at de ting, du og jeg talte om omkring [drift/produktion/vedligehold], faktisk står i kravene. Ellers får du tilbud, der er billige på det, der er beskrevet, og dyre på det, du får bagefter. Må vi tage tyve minutter sammen med din rådgiver, så vi sikrer, at de vigtigste ting ikke går tabt?”",
    questions: [
      "Hvad vægter I ved tildelingen — pris alene, eller også drift og totaløkonomi?",
      "Står der noget i beskrivelsen om idriftsættelse, dokumentation og oplæring af jeres folk?",
      "Hvem har fortalt rådgiveren, hvordan hallen bruges i løbet af et døgn?",
      "Hvad ville du blive ærgerlig over at opdage, når anlægget står færdigt?",
    ],
    proofPoints: [
      "Oplæg til kravformulering (lysniveau, jævnhed, blænding, styringsfunktioner, driftsdata, totaløkonomi) leveret til slutbrugeren",
      "Lysberegning der viser, hvad beskrivelsen faktisk giver i deres bygning",
      "Trepartsmøde med rådgiver og slutbruger",
    ],
    neverSay: [
      "“Rådgiveren har lavet en dårlig beskrivelse.”",
      "“Den spec er skrevet til en bestemt leverandør.” — også selvom det kan se sådan ud; stil spørgsmål i stedet.",
    ],
    manualRefs: ["p15-hold-fast-i-slutbrugeren", "p16-deal-rescue", "p8-aldrig-kun-pris"],
    keywords: ["rådgiver", "beskrivelse", "udbud", "eller tilsvarende", "spec", "tildeling", "lukket ude"],
  },
  {
    id: "kp-eksisterende-leverandoer",
    label: "Vi har allerede en leverandør",
    claim:
      "Vi har en leverandør, vi er glade for, og vi har brugt dem i mange år.",
    whoSaysIt: "Indkøb, drift, teknisk chef med et eksisterende samarbejde",
    whatIsTrue:
      "En leverandør, kunden er glad for, er en styrke — ikke et problem, vi skal nedbryde. Og det er ofte sandt, at samarbejdet fungerer på det, det bruges til.",
    whatItMisses:
      "“Glad for” er sjældent det samme som “har fået set på hele bygningen”. Der er typisk områder, der aldrig er blevet kigget på, eller emner (styring, dokumentation, driftsdata, arbejdsmiljø), som ikke er en del af det eksisterende samarbejde.",
    greenLightAnswer:
      "“Det er kun en god ting — så er det ikke det, vi skal bruge tiden på. Må jeg i stedet spørge: hvad fungerer godt i dag, og hvad kunne fungere bedre? Der er tit et område eller et emne, som ikke rigtig har været kigget på, og det er dér, jeg måske kan gøre en forskel — hvis ikke, siger jeg det ærligt.”",
    questions: [
      "Hvad fungerer godt — og hvad kunne fungere bedre?",
      "Hvilke områder i bygningen har de ikke været inde over?",
      "Hvornår har I sidst fået lavet en lysberegning eller en energiberegning på det?",
      "Hvad ville få jer til at kigge på en anden løsning?",
    ],
    proofPoints: [
      "Screening af ét område, som den nuværende leverandør ikke har været inde over",
      "Energiberegning før/efter på kundens egne tal",
      "Pilot i et afgrænset område med aftalt succeskriterium",
    ],
    neverSay: [
      "“Dem kender jeg godt — det er ikke der, I skal købe.”",
      "“Vi er bedre end dem.”",
    ],
    manualRefs: ["p14-svar-aldrig-for-hurtigt", "p3-advarselstegn", "p2-rigtige-kunder"],
    keywords: ["leverandør", "eksisterende", "samarbejde", "loyalitet", "skifte", "konkurrent"],
  },
];
/* ---------------------------------------------------- Indvendingsbibliotek */
/**
 * Manualens typiske indvendinger (kapitel 14, suppleret af kapitel 2 og 8) plus
 * de indvendinger, man reelt møder i belysningssalg.
 *
 * Rækkefølgen i hvert opslag følger manualens metode:
 *   1) anerkend            (“Det giver god mening.”)
 *   2) grav dybere         (“Må jeg spørge hvad du tænker helt konkret?”)
 *   3) svar — først dér
 * `usuallyMeans` er coachens vigtigste felt: hvad indvendingen som regel REELT
 * dækker over. En sælger, der svarer på ordene i stedet for på meningen,
 * svarer på den forkerte indvending.
 *
 * Felter: id, label, objection, source ("manual" | "lys"), usuallyMeans,
 * firstMove, questions, response, outcomeFrame, pitfalls, manualRefs, keywords
 */
export const OBJECTION_LIBRARY = [
  {
    id: "iv-for-dyrt",
    label: "Det er for dyrt",
    objection: "Det er for dyrt. Vi kan få det billigere.",
    source: "manual",
    usuallyMeans:
      "Sjældent at prisen er for høj i absolut forstand. Som regel: værdien er ikke etableret endnu, kunden sammenligner med noget, vi ikke kender, eller kunden skal kunne forsvare beløbet over for en anden i huset. Manualen ser det som et købssignal — nu ved vi, at prisen betyder noget, og vi kan styre samtalen.",
    firstMove:
      "Anerkend uden at undskylde: “Det kan jeg godt forstå. Men må jeg spørge — hvad sammenligner du med?”",
    questions: [
      "Hvad sammenligner du med? Må jeg se, hvad der er med i det andet tilbud?",
      "Hvad ville være en fornuftig pris i dine øjne?",
      "Er fokus mest indkøbspris eller totaløkonomi?",
      "Hvad er det, der gør, at det føles dyrt — beløbet, eller det du får for det?",
    ],
    response:
      "“Det er jeg sikker på, I kan. Spørgsmålet er bare, hvad man får for prisen. Skulle vi to ikke kigge på forskellene og så se, om du reelt kan nøjes med den billige løsning? Kan du det, så skal du vælge den — men du skal gøre det på et ordentligt, oplyst grundlag, og det giver jeg dig rigtig gerne. Lad os starte med, hvad der betyder noget for dig.”",
    outcomeFrame:
      "Flyt fra pris til totaløkonomi og risiko: hvad koster det jer, hvis løsningen ikke performer? Armaturet er den mindste omkostning — driftstimer, lift og nedetid er den store.",
    pitfalls: [
      "At give rabat for at komme videre i samtalen",
      "At forsvare prisen med kvalitet",
      "At svare, før vi ved, hvad kunden sammenligner med",
    ],
    manualRefs: ["p8-for-dyrt", "p8-aldrig-kun-pris", "p8-usikkerhed-om-billigt"],
    keywords: ["for dyrt", "billigere", "pris", "rabat", "sammenligne", "budget"],
  },
  {
    id: "iv-ikke-lige-nu",
    label: "Ikke lige nu",
    objection: "Det er ikke lige nu. Vi kigger på det til næste år.",
    source: "manual",
    usuallyMeans:
      "Enten er konsekvensen af at gøre ingenting aldrig blevet sagt højt, eller også er der noget andet, der fylder mere lige nu. Nogle gange er det ægte (budgetår, ombygning på vej) — og så skal vi vide præcis hvornår og hvad der udløser det.",
    firstMove:
      "“Det giver god mening. Må jeg spørge — hvad gør, at timingen ikke er rigtig lige nu?”",
    questions: [
      "Hvad gør, at timingen ikke er rigtig? Og hvad er den rigtige timing?",
      "Hvad sker der, hvis I ikke gør noget det næste år — og hvad vil det koste jer?",
      "Hvad skal være anderledes, for at det bliver aktuelt?",
      "Hvis I ønsker det udført i [periode], hvornår skal beslutningen så reelt træffes?",
    ],
    response:
      "“Helt fair. Så lad os bruge tiden rigtigt: skal vi lave grundlaget nu, så I har tallene klar, når budgettet skal lægges? Så træffer I beslutningen på fakta i stedet for på et skøn — og I mister ikke et år på at skulle starte forfra.”",
    outcomeFrame:
      "Det, kunden udskyder, er ikke en udgift — det er en besparelse. Den besparelse, der ikke realiseres i år, kommer ikke igen. Og et gammelt lysstofanlæg bliver ikke lettere at skaffe reservedele til med tiden.",
    pitfalls: [
      "At acceptere udsættelsen uden at aftale en konkret dato og en udløsende begivenhed",
      "At bruge tabt besparelse som pression i stedet for som et spørgsmål",
      "At gå i dvale og “følge op om et halvt år” uden nyt indhold",
    ],
    manualRefs: ["p14-svar-aldrig-for-hurtigt", "p12-luk-processen", "p13-opfoelgning"],
    keywords: ["ikke lige nu", "timing", "næste år", "udskyde", "vente", "budgetår"],
  },
  {
    id: "iv-send-tilbud",
    label: "Send bare et tilbud",
    objection: "Send bare et tilbud, så kigger vi på det.",
    source: "manual",
    usuallyMeans:
      "Ofte et høfligt farvel, eller et ønske om et sammenligningsgrundlag til en beslutning, der reelt tages et andet sted. Manualen tæller det som et advarselstegn, når det kommer før behovet er forstået.",
    firstMove:
      "“Det gør jeg gerne — men så skal jeg sikre, at det rammer rigtigt. Kan vi drøfte, hvad dine krav er til projektet?”",
    questions: [
      "Hvad skal tilbuddet indeholde, for at du kan bruge det til noget?",
      "Hvem skal se det, og hvad vil være vigtigst for dem?",
      "Hvad sammenligner du det med?",
      "Hvis tallene ser fornuftige ud — hvad vil så være næste skridt hos jer?",
    ],
    response:
      "“Jeg sender gerne noget. Men et tilbud på et anlæg, jeg ikke har set, bliver enten for dyrt eller forkert — og så er det ikke til nogen nytte for dig. Giv mig tyve minutter i bygningen, så får du et tal, du kan regne med.”",
    outcomeFrame:
      "Kunden får et tilbud, der kan bruges til at træffe en beslutning, i stedet for et papir, der lægges i en bunke med to andre og sammenlignes på nederste linje.",
    pitfalls: [
      "At sende tilbuddet uden at kende beslutningsproces og krav — manualens port “før tilbud sendes”",
      "At bruge dage på et tilbud til en kunde, der bare mangler et sammenligningsgrundlag",
    ],
    manualRefs: ["p14-svar-aldrig-for-hurtigt", "p20-checklister", "p3-advarselstegn"],
    keywords: ["send tilbud", "tilbud", "materiale", "sammenligning", "pris"],
  },
  {
    id: "iv-send-paa-mail",
    label: "Send noget på mail",
    objection: "Send noget på mail, så kigger jeg på det.",
    source: "manual",
    usuallyMeans:
      "I telefonen: en høflig måde at afslutte samtalen på. Kunden har ikke haft nogen grund til at bruge tid endnu — den skal skabes, før materialet giver mening.",
    firstMove:
      "Sig ja — og køb forståelse først. Manualens formulering ordret.",
    questions: [
      "Hvor i jeres virksomhed kunne lyset blive bedre?",
      "Hvad er det, der gør, at I kigger på lyset lige nu?",
      "Hvad ville være relevant for dig at få tilsendt?",
    ],
    response:
      "“Det gør jeg gerne. Men for at det bliver relevant og ikke bare generisk materiale, skal jeg lige forstå jeres situation lidt bedre først. Skal vi tage 15 minutter?”",
    outcomeFrame:
      "Kunden får noget, der handler om deres bygning og deres drift — ikke en brochure, der alligevel ikke bliver læst.",
    pitfalls: [
      "“Ja, jeg sender lige noget” — og samtalen slutter",
      "At sende generisk materiale og kalde det opfølgning",
    ],
    manualRefs: ["p2-send-noget-paa-mail", "p2-canvas"],
    keywords: ["send på mail", "materiale", "brochure", "telefon", "canvas"],
  },
  {
    id: "iv-anden-loesning",
    label: "Vi vælger en anden løsning",
    objection: "Vi har besluttet at gå videre med en anden løsning.",
    source: "manual",
    usuallyMeans:
      "Enten er der noget i den anden løsning, der vejer tungere, end vi har forstået — eller også er beslutningen truffet på et grundlag, hvor vores del aldrig kom med. Det er information, ikke et nederlag.",
    firstMove:
      "“Det giver mening. Må jeg spørge — hvad gør den løsning mere attraktiv?”",
    questions: [
      "Hvad gør den løsning mere attraktiv?",
      "Hvad var udslagsgivende — pris, timing, eller noget helt tredje?",
      "Er der noget, jeg burde have gjort anderledes?",
      "Hvornår skal I tage stilling til næste område/etape?",
    ],
    response:
      "“Tak fordi du siger det direkte. Så vil jeg hellere lære noget af det end at bruge din tid på at overtale dig. Én ting vil jeg gerne sikre, inden I lukker den: at [konkret forhold, fx styringen/zoneopdelingen/nødbelysningen] er med i det, I har fået tilbudt — det er det, der plejer at koste bagefter. Er det med?”",
    outcomeFrame:
      "Kunden får et sidste, ærligt tjek af sin egen beslutning fra en, der ikke længere har noget at vinde ved det — og det er præcis dét, der gør, at vi bliver ringet op næste gang.",
    pitfalls: [
      "At forsøge at vinde sagen tilbage med rabat",
      "At gætte på årsagen i stedet for at spørge (manualens deal rescue-regel)",
      "At forlade sagen uden at aftale, hvornår næste anledning er",
    ],
    manualRefs: ["p14-svar-aldrig-for-hurtigt", "p16-deal-rescue"],
    keywords: ["tabt", "anden løsning", "valgt", "konkurrent", "nej", "deal rescue"],
  },
  {
    id: "iv-har-leverandoer",
    label: "Vi har allerede en leverandør",
    objection: "Vi har en leverandør, vi er glade for.",
    source: "manual",
    usuallyMeans:
      "Som regel sandt for det, samarbejdet bruges til — og samtidig et signal om, at ingen har spurgt til de områder eller emner, samarbejdet ikke dækker.",
    firstMove: "“Det er kun godt. Hvad fungerer godt — og hvad kunne fungere bedre?”",
    questions: [
      "Hvad fungerer godt, og hvad kunne fungere bedre?",
      "Hvilke områder har de ikke været inde over?",
      "Hvornår er der sidst lavet en lys- eller energiberegning på bygningen?",
    ],
    response:
      "“Så skal vi ikke bruge tiden på at tale om leverandører. Må jeg i stedet spørge til ét område, som jeg tror sjældent bliver kigget på — og hvis der ikke er noget at hente, siger jeg det ærligt.”",
    outcomeFrame:
      "Kunden risikerer ingenting ved at lade os kigge på ét område, og får i værste fald bekræftet, at det, de har, er i orden.",
    pitfalls: [
      "At angribe den nuværende leverandør",
      "At bruge stor indsats på en kunde, der reelt bare vil have et sammenligningstilbud (advarselstegn)",
    ],
    manualRefs: ["p14-svar-aldrig-for-hurtigt", "p3-advarselstegn"],
    keywords: ["leverandør", "eksisterende", "glade for", "samarbejde", "skifte"],
  },
  {
    id: "iv-lige-skiftet-led",
    label: "Vi har lige skiftet til LED",
    objection: "Vi har allerede skiftet til LED for nogle år siden.",
    source: "lys",
    usuallyMeans:
      "Næsten altid: dele af bygningen er skiftet, og der kom ingen styring med. Nogle gange er det helt korrekt, at der ikke er en case — og så skal vi sige det.",
    firstMove:
      "“Godt at høre. Må jeg spørge lidt ind — hvornår, hvilke områder, og kom der styring med?”",
    questions: [
      "Hvornår blev det skiftet, og i hvilke områder?",
      "Kom der sensorer eller anden styring med, eller er det tændt/slukket som før?",
      "Er der områder, der ikke blev taget dengang?",
      "Oplever I, at lyset er blevet svagere de steder, der blev skiftet først?",
    ],
    response:
      "“Så har I taget det største skridt. Det, jeg typisk ser, er, at armaturerne er skiftet, men at lyset stadig er tændt lige så mange timer som før — og det er dér, den største del af besparelsen ligger. Skal vi bruge tyve minutter på at se, om der er noget tilbage at hente, eller om I faktisk er i mål?”",
    outcomeFrame:
      "Kunden får afklaret, om sagen er lukket eller ej — og hvis den er, har vi sparet begge parter for tid og fået en relation, der holder til næste gang.",
    pitfalls: [
      "At antage at der er en case, før vi har spurgt",
      "At tale nedsættende om den investering, kunden lige har foretaget",
      "At overse, at det ofte kun er en del af bygningen, der er skiftet",
    ],
    manualRefs: ["p14-svar-aldrig-for-hurtigt", "p5-spc-vaerdi", "p2-lyt"],
    keywords: ["allerede LED", "skiftet", "nyt lys", "styring", "delvist"],
  },
  {
    id: "iv-elektrikeren-klarer-det",
    label: "Vores elektriker klarer det",
    objection: "Vores elektriker klarer det — han skaffer bare armaturerne.",
    source: "lys",
    usuallyMeans:
      "Kunden skelner ikke mellem at BESLUTTE hvad der skal op og at SÆTTE det op. Ofte også et ønske om ikke at have flere leverandører at holde styr på.",
    firstMove:
      "Anerkend elektrikeren — og adskil de to beslutninger.",
    questions: [
      "Hvem beslutter, hvad der skal op — og hvem sætter det op? Er det den samme beslutning?",
      "Hvad skete der sidste gang, I fik skiftet lys? Blev det, som I havde forestillet jer?",
      "Hvem laver lysberegningen, så I ved, hvad niveauet bliver, inden der bestilles?",
    ],
    response:
      "“Det gør vi også gerne — han skal endelig være med. Men for at sikre at løsningen matcher jeres drift og hverdag, er det vigtigt, at vi også får jeres perspektiv med. Jeg slipper ikke dialogen direkte med dig, for jeg har ansvaret for, at resultatet lever op til det, vi lover DIG.”",
    outcomeFrame:
      "Kunden beholder sin elektriker OG får en løsning, der er dimensioneret og dokumenteret efter driften — i stedet for efter hvad der var lettest at skaffe hjem.",
    pitfalls: [
      "At tale dårligt om elektrikeren",
      "At acceptere at køre hele sagen gennem installatøren — manualen: uden adgang til slutbrugeren mister vi styringen og bør overveje at stige af",
    ],
    manualRefs: ["p15-hold-fast-i-slutbrugeren", "p2-installatoer-som-kilde"],
    keywords: ["elektriker", "installatør", "klarer det", "mellemled", "slutbruger"],
  },
  {
    id: "iv-kan-ikke-stoppe-produktionen",
    label: "Vi kan ikke stoppe produktionen",
    objection: "Vi kan ikke lukke hallen ned for at få skiftet lys.",
    source: "lys",
    usuallyMeans:
      "En reel og fuldt legitim bekymring — og samtidig ofte en høflig måde at sige “det bliver for besværligt” på. Under den ligger et spørgsmål om, hvor meget projektet vil fylde i deres hverdag.",
    firstMove:
      "Tag bekymringen alvorligt og gør den konkret, i stedet for at love, at det nok skal gå.",
    questions: [
      "Hvornår på ugen eller året er der lavest aktivitet i det område?",
      "Hvad koster en times stop jer?",
      "Har I planlagte stop, ferielukning eller vedligeholdsvinduer, vi kan lægge os ind i?",
      "Hvor stort et område kan I undvære ad gangen?",
    ],
    response:
      "“Det skal I heller ikke. Vi planlægger efter jeres produktionsplan, ikke efter vores rute: område for område, i jeres planlagte stop, i weekender eller om natten, med midlertidigt lys undervejs. Og vælger vi trådløs styring, skal der ikke trækkes styrekabel hen over produktionen overhovedet.”",
    outcomeFrame:
      "Kunden mister ikke produktionstimer for at få nyt lys — og det er ofte det, der afgør valget, fordi nedetid kan koste mere end hele projektet.",
    pitfalls: [
      "At love weekend- og natarbejde uden at have priset det",
      "At planlægge etaper efter vores logistik i stedet for efter kundens ordrebog",
      "At overse behovet for midlertidig belysning",
    ],
    manualRefs: ["p1-udbytteord", "p11-pilot", "p5-spc-vaerdi"],
    keywords: ["produktion", "nedetid", "stop", "etaper", "weekend", "nat", "drift"],
  },
  {
    id: "iv-styring-for-kompliceret",
    label: "Styring er for kompliceret — vi bruger det ikke alligevel",
    objection: "Vi skal ikke have noget avanceret. Vi bruger det alligevel ikke, og så står det bare og fylder.",
    source: "lys",
    usuallyMeans:
      "Kunden har set eller hørt om et anlæg, ingen kunne finde ud af — typisk fordi det aldrig blev indreguleret ordentligt eller overdraget til nogen. Bekymringen handler om betjening og ejerskab, ikke om teknologi.",
    firstMove:
      "Giv kunden ret i bekymringen, og flyt samtalen fra “system” til “hvad der sker automatisk”.",
    questions: [
      "Har I prøvet det før — hvad gik galt?",
      "Hvem skulle i givet fald kunne ændre noget hos jer?",
      "Hvor mange knapper vil I have på væggen — og hvad skal de gøre?",
    ],
    response:
      "“Så lad os lave det, så I ikke skal bruge det. Lyset skal følge arbejdet af sig selv: tændt hvor der er nogen, nede hvor der ikke er, og slukket når den sidste går. De eneste knapper er dem, I selv beder om. Og vi indregulerer det og kommer tilbage og justerer efter et par uger — det er dér, forskellen ligger på et anlæg, der virker, og et, der står på fuldt lys.”",
    outcomeFrame:
      "Kunden får besparelsen uden at skulle betjene noget — og får dokumenteret adgang og ejerskab, så det ikke afhænger af én bestemt medarbejder.",
    pitfalls: [
      "At demonstrere en app for en kunde, der lige har sagt, at det ikke må være kompliceret",
      "At sælge styring uden at prissætte idriftsættelse og overdragelse",
      "At glemme at aftale, hvem der har adgangen bagefter",
    ],
    manualRefs: ["p1-loesning-ikke-armatur", "p10-praesentationsstruktur"],
    keywords: ["styring", "kompliceret", "app", "betjening", "sensor", "idriftsættelse", "overdragelse"],
  },
  {
    id: "iv-sensorer-slukkede-lyset",
    label: "Sidst slukkede sensorerne lyset for os",
    objection: "Vi har prøvet sensorer før — de slukkede lyset, mens folk stod og arbejdede.",
    source: "lys",
    usuallyMeans:
      "Sandt, og næsten altid et indreguleringsproblem: forkert sensortype til højden, forkert dækning, eller efterløbstid sat på fabriksindstilling. Kunden har en dårlig oplevelse, ikke en teknisk holdning.",
    firstMove: "Giv kunden ret. Det ER en klassisk fejl — og forklar hvorfor den opstår.",
    questions: [
      "Hvor sad sensorerne, og hvor høj er loftet der?",
      "Skete det i bestemte områder eller overalt?",
      "Blev anlægget justeret, efter I var flyttet ind i det?",
    ],
    response:
      "“Det er en af de mest almindelige fejl, og den er ærgerlig, fordi den giver hele styringen skylden. Den skyldes næsten altid, at sensoren er valgt eller placeret forkert i forhold til højden — og at ingen kom tilbage og justerede, efter I var begyndt at bruge lokalet. Derfor har vi efterjustering med som en del af arbejdet, ikke som noget der skal bestilles bagefter.”",
    outcomeFrame:
      "Kunden får et anlæg, der er sat efter, hvordan arealet faktisk bruges — og en aftale om, at nogen kommer tilbage og retter det til, når hverdagen har vist, hvordan det bruges i praksis.",
    pitfalls: [
      "At sige at det var “dårlige sensorer”",
      "At love, at det ikke sker, uden at forklare hvad vi gør anderledes",
      "At sælge styring uden efterjustering i tilbuddet",
    ],
    manualRefs: ["p14-svar-aldrig-for-hurtigt", "p8-usikkerhed-om-billigt"],
    keywords: ["sensor", "slukkede", "efterløb", "indregulering", "dårlig oplevelse", "styring"],
  },
  {
    id: "iv-garanti-paa-besparelsen",
    label: "Kan I garantere besparelsen?",
    objection: "Kan I garantere, at vi sparer det, I skriver?",
    source: "lys",
    usuallyMeans:
      "Kunden er reelt interesseret, men har brug for at kunne forsvare tallet internt. Ofte er det ikke en garanti, der efterspørges, men en forklaring, der holder til at blive udfordret af en controller.",
    firstMove:
      "Vær helt præcis om, hvad der er beregnet og hvad der er forudsat. Aldrig et løfte.",
    questions: [
      "Hvem skal du kunne forsvare tallet over for?",
      "Hvilke af forudsætningerne er du mest i tvivl om?",
      "Har I selv målinger på, hvad belysningen bruger i dag?",
    ],
    response:
      "“Jeg garanterer ikke en besparelse — jeg garanterer et regnestykke, du kan efterprøve. Forbruget før og efter kan vi regne præcist: antal, watt og timer. Det, der kan flytte sig, er, hvor mange timer lyset reelt kan være slukket eller dæmpet — og dét sætter vi sammen, ud fra hvordan I bruger arealet. Vil du have det helt sikkert, laver vi en pilot i ét område og måler.”",
    outcomeFrame:
      "Kunden får et tal, der kan udfordres og stadig holder — og en vej (pilot med måling) til at gøre det til et faktum i deres egen bygning.",
    pitfalls: [
      "At love en procent for at lukke sagen",
      "At skjule, at styringsandelen er en beregningsantagelse (70% af det nye anlægs forbrug), ikke en måling",
      "At undlade at tilbyde pilot, når kunden reelt beder om bevis",
    ],
    manualRefs: ["p8-aldrig-kun-pris", "p11-pilot", "p3-commitment-foer-ressourcer"],
    keywords: ["garanti", "besparelse", "dokumentation", "bevis", "måling", "forudsætninger", "pilot"],
  },
  {
    id: "iv-vi-lejer-bygningen",
    label: "Vi ejer ikke bygningen",
    objection: "Vi lejer os ind her — det er ikke os, der skal investere i bygningen.",
    source: "lys",
    usuallyMeans:
      "Den klassiske interessekonflikt: den der betaler elregningen, er ikke den der ejer installationen. Ofte er svaret hverken nej eller ja, men “hvem af os skal vi tale med sammen?”",
    firstMove: "Kortlæg, hvem der betaler hvad, før der argumenteres.",
    questions: [
      "Hvem betaler elforbruget i lejemålet — jer eller udlejer?",
      "Hvor mange år er der tilbage på lejekontrakten?",
      "Er der en aftale om forbedringer, eller har I gjort noget lignende før?",
      "Vil det give mening, at vi tager en snak med udlejer sammen?",
    ],
    response:
      "“Det er en helt normal situation, og den kan løses på flere måder. Betaler I selv strømmen, er det jeres besparelse — og så handler det om, hvad der kan aftales med udlejer. Skal jeg lave et regnestykke, I kan tage med til dem? Det plejer at være det, der får den snak i gang.”",
    outcomeFrame:
      "Kunden får et konkret oplæg, der kan bruges i dialogen med udlejer — i stedet for et projekt, der dør, fordi ingen af parterne tager fat i det.",
    pitfalls: [
      "At droppe sagen, så snart ordet “lejemål” falder",
      "At tale med lejeren om en investering, som lejeren ikke kan beslutte",
      "At overse, at udlejer selv kan være en langt større kunde (portefølje, fællesarealer)",
    ],
    manualRefs: ["p7-budget-beslutning", "p3-syv-krav"],
    keywords: ["leje", "udlejer", "lejemål", "fællesareal", "investering", "ejendom"],
  },
  {
    id: "iv-tre-tilbud",
    label: "Vi skal have tre tilbud",
    objection: "Vi skal have mindst tre tilbud, før vi beslutter noget.",
    source: "lys",
    usuallyMeans:
      "Ofte en intern regel eller en tryghedsmekanisme — ikke en holdning til os. Risikoen er, at tre tilbud på tre forskellige forudsætninger sammenlignes på nederste linje.",
    firstMove:
      "Accepter processen, og hjælp med at gøre tilbuddene sammenlignelige.",
    questions: [
      "Hvad kommer I til at sammenligne dem på?",
      "Får de tre samme grundlag at byde på — samme lysniveau, samme styring, samme omfang?",
      "Hvem laver sammenligningen, og hvad vejer tungest for vedkommende?",
      "Hvad ville få jer til at vælge et andet end det billigste?",
    ],
    response:
      "“Det er helt fair — jeg vil bare gerne sikre, at I får noget, der kan sammenlignes. Ellers står I med tre tilbud på tre forskellige løsninger, og så bliver nederste linje det eneste, der kan sammenlignes. Skal vi bruge tyve minutter på at få skrevet ned, hvad løsningen skal kunne? Så får alle tre det samme grundlag — også dem jeg konkurrerer med.”",
    outcomeFrame:
      "Kunden får en beslutning, der kan forsvares internt, fordi der sammenlignes æbler med æbler — og vi kommer med i formuleringen af kriterierne i stedet for kun i prisen.",
    pitfalls: [
      "At byde på et grundlag, vi ved er for tyndt, uden at sige det",
      "At bruge stor indsats, når vi kun er sammenligningsgrundlag (manualens advarselstegn)",
      "At tro, at det billigste tilbud altid vinder — det gør det ikke, hvis kriterierne er rigtige",
    ],
    manualRefs: ["p3-advarselstegn", "p8-aldrig-kun-pris", "p20-checklister"],
    keywords: ["tre tilbud", "udbud", "sammenligning", "indkøb", "kriterier", "proces"],
  },
];

/* ==========================================================================
 * Udvælgelse og render
 * ------------------------------------------------------------------------
 * Videnbasen dumpes ALDRIG i sin helhed ind i en prompt. Coachen skal have
 * det relevante — ikke et opslagsværk. Samme mønster som _manual.mjs.
 * ========================================================================== */

/** Læsbare navne til de ni kategorier i types.ts. */
const CATEGORY_LABELS = {
  produkt: "Produkt og armaturer",
  styring: "Lysstyring",
  energi: "Energi og økonomi",
  projekt: "Projekt og udførelse",
  regler: "Regler og standarder",
  case: "Cases",
  branche: "Brancher og kundetyper",
  konkurrence: "Konkurrence",
  indvending: "Indvendinger",
};

/**
 * Standardudvalg når intet matcher. Uden dette ville coachen i en helt åben
 * samtale stå uden fagligt grundlag overhovedet.
 */
const CORE_IDS = [
  "en-besparelsens-anatomi",
  "st-hvad-styring-giver",
  "en-forretningscase",
  "pj-lysberegning",
  "ko-led-er-led",
  "en-co2",
];

const norm = (s) => String(s ?? "").toLowerCase().trim();

/** Slår to strenge sammen som "hører de til hinanden" (tolerant match). */
function related(a, b) {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function scoreItem(item, { keywords, categories, ids }) {
  let score = 0;
  if (ids.includes(item.id)) score += 100;
  if (categories.includes(item.category)) score += 8;

  const itemKeys = item.keywords.map(norm);
  const hay = norm(
    `${item.title} ${item.technical} ${item.customerOutcome} ${item.keywords.join(" ")}`,
  );

  for (const raw of keywords) {
    const k = norm(raw);
    if (k.length < 3) continue;
    if (itemKeys.includes(k)) score += 8;
    else if (itemKeys.some((x) => related(x, k))) score += 5;
    else if (hay.includes(k)) score += 3;
  }
  return score;
}

/**
 * Let manifest til browseren: kun id, titel og kategori — ingen af de
 * formuleringer, argumenter eller cases der udgør green lights interne viden.
 * Sikker at sende til klienten, fx til et videns-overblik i UI'et.
 */
export function knowledgeManifest() {
  const counts = {};
  for (const item of KNOWLEDGE) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return {
    meta: { ...KNOWLEDGE_META },
    totals: {
      knowledge: KNOWLEDGE.length,
      cases: CASES.length,
      competitorPlays: COMPETITOR_PLAYS.length,
      objections: OBJECTION_LIBRARY.length,
    },
    categories: Object.keys(CATEGORY_LABELS).map((id) => ({
      id,
      label: CATEGORY_LABELS[id],
      count: counts[id] || 0,
    })),
    knowledge: KNOWLEDGE.map((k) => ({
      id: k.id,
      title: k.title,
      category: k.category,
      indicative: !!k.indicative,
    })),
    // Cases er pladsholdere — det skal fremgå hele vejen ud i UI'et.
    cases: CASES.map((c) => ({
      id: c.id,
      title: c.title,
      industry: c.industry,
      indicative: c.indicative,
    })),
    competitorPlays: COMPETITOR_PLAYS.map((p) => ({ id: p.id, label: p.label })),
    objections: OBJECTION_LIBRARY.map((o) => ({
      id: o.id,
      label: o.label,
      source: o.source,
    })),
  };
}

/**
 * Vælg de vidensstykker der er relevante lige nu.
 * Uden match falder den tilbage til kernesættet, så coachen aldrig står tom.
 */
export function selectKnowledge({
  keywords = [],
  categories = [],
  ids = [],
  limit = 8,
} = {}) {
  const opts = {
    keywords: Array.isArray(keywords) ? keywords : [keywords],
    categories: Array.isArray(categories) ? categories : [categories],
    ids: Array.isArray(ids) ? ids : [ids],
  };
  const scored = KNOWLEDGE.map((item) => ({ item, s: scoreItem(item, opts) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(1, limit))
    .map((x) => x.item);

  if (scored.length) return scored;
  return CORE_IDS.map((id) => KNOWLEDGE.find((k) => k.id === id)).filter(Boolean);
}

/** Cases der matcher branche/nøgleord — bruges kun internt af renderen. */
function selectCases({ keywords = [], industry = "", limit = 2 } = {}) {
  const terms = [...keywords, industry].map(norm).filter((t) => t.length >= 3);
  if (!terms.length) return [];
  const scored = CASES.map((c) => {
    const hay = norm(
      `${c.title} ${c.industry} ${c.customerType} ${c.situation} ${c.problem} ${c.useWhen.join(" ")}`,
    );
    let s = 0;
    for (const t of terms) {
      if (related(norm(c.industry), t)) s += 10;
      else if (hay.includes(t)) s += 3;
    }
    return { c, s };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(0, limit));
  return scored.map((x) => x.c);
}

/** Konkurrentspil og indvendinger der matcher — også kun internt. */
function selectByKeywords(collection, keywords, limit) {
  const terms = keywords.map(norm).filter((t) => t.length >= 3);
  if (!terms.length || limit <= 0) return [];
  return collection
    .map((entry) => {
      const keys = (entry.keywords || []).map(norm);
      const hay = norm(
        `${entry.label} ${entry.claim || entry.objection || ""} ${entry.usuallyMeans || entry.whatIsTrue || ""}`,
      );
      let s = 0;
      for (const t of terms) {
        if (keys.includes(t)) s += 8;
        else if (keys.some((k) => related(k, t))) s += 5;
        else if (hay.includes(t)) s += 3;
      }
      return { entry, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.entry);
}

const INDICATIVE_MARK = "  ⚠ typisk tal/erfaringstal — ikke dokumenteret for kunden";

function renderItem(item) {
  const lines = [
    `### ${item.title}  [${item.id} · ${CATEGORY_LABELS[item.category] || item.category}]`,
    `Teknisk: ${item.technical}`,
    `Kundeudbytte (sig ALTID denne — aldrig kun den tekniske): ${item.customerOutcome}`,
    `Brug når: ${item.useWhen.join(" · ")}`,
  ];
  if (item.pitfalls?.length) lines.push(`Faldgruber: ${item.pitfalls.join(" · ")}`);
  if (item.indicative) lines.push(INDICATIVE_MARK);
  return lines.join("\n");
}

function renderCase(c) {
  return [
    `### ${c.title}  [${c.id} · ${c.industry}]`,
    `ILLUSTRATIV PLADSHOLDER — ingen navngiven kunde. Introducér den som "et typisk eksempel", aldrig som en reference.`,
    `Kundetype: ${c.customerType}`,
    `Situation: ${c.situation}`,
    `Problem: ${c.problem}`,
    `Konsekvens: ${c.consequence}`,
    `Løsning: ${c.solution}`,
    `Resultat:\n- ${c.result.join("\n- ")}`,
    `Brug når: ${c.useWhen.join(" · ")}`,
  ].join("\n");
}

function renderPlay(p) {
  return [
    `### Konkurrentargument: ${p.label}  [${p.id}]`,
    `Lyder som: "${p.claim}"`,
    `Hvad der ER rigtigt (anerkend det først): ${p.whatIsTrue}`,
    `Hvad det overser: ${p.whatItMisses}`,
    `green lights svar: ${p.greenLightAnswer}`,
    `Spørgsmål: ${p.questions.join(" · ")}`,
    `Sig aldrig: ${p.neverSay.join(" · ")}`,
  ].join("\n");
}

function renderObjection(o) {
  return [
    `### Indvending: ${o.label}  [${o.id}]`,
    `Ordret: "${o.objection}"`,
    `Betyder som regel: ${o.usuallyMeans}`,
    `Første træk: ${o.firstMove}`,
    `Spørgsmål: ${o.questions.join(" · ")}`,
    `Svar: ${o.response}`,
    `Oversat til kundeudbytte: ${o.outcomeFrame}`,
  ].join("\n");
}

/**
 * Byg den videns-kontekst der lægges ind i coachens systeminstruktion.
 * Kompakt markdown, længdebegrænset — ikke hele basen.
 *
 * @param {object} o
 * @param {string[]} o.keywords  – emneord fra samtalen/scenariet
 * @param {string}   o.industry  – kundens branche (styrer case- og branchevalg)
 * @param {number}   o.limit     – maks. antal vidensstykker
 * @param {number}   o.maxChars  – hårdt loft på blokkens længde
 */
export function renderKnowledgeContext({
  keywords = [],
  industry = "",
  limit = 8,
  maxChars = 9000,
} = {}) {
  const terms = [...(Array.isArray(keywords) ? keywords : [keywords]), industry]
    .map((k) => String(k ?? "").trim())
    .filter(Boolean);

  const items = selectKnowledge({ keywords: terms, limit });
  const plays = selectByKeywords(COMPETITOR_PLAYS, terms, 2);
  const objections = selectByKeywords(OBJECTION_LIBRARY, terms, 2);
  const cases = selectCases({ keywords: terms, industry, limit: 2 });

  const header = [
    "# GREEN LIGHT-VIDEN (fagligt grundlag for coachen)",
    "",
    "## Stående instruktion — gælder hver eneste gang viden herfra bruges",
    "1. TEKNIK ALENE ER ALDRIG ET ARGUMENT. Hver gang en teknisk egenskab nævnes, skal den oversættes til et kundeudbytte (drift, arbejdsmiljø, driftssikkerhed, vedligehold, totaløkonomi, dokumentation). Manualen: “Vi sælger ikke armaturer – vi sælger den rigtige løsning.” Bruger sælgeren `Teknisk` uden `Kundeudbytte`, skal coachen slå ned på det.",
    "2. BRUG VIDEN SOM SPØRGSMÅL, FØR DU BRUGER DEN SOM SVAR. Fagligheden skal gøre spørgsmålene skarpere — ikke gøre svaret længere.",
    "3. SIG DET HØJT, NÅR ET TAL ER TYPISK. Alt markeret “⚠ typisk tal” er et erfaringstal eller en beregningsantagelse fra green lights eget estimatværktøj — ikke et dokumenteret tal for denne kunde. Formuler det som: “Det er et typisk tal; det skal regnes på jeres egne brændetimer og forbrug.” Aldrig som et løfte eller en garanti.",
    "4. CASES ER ILLUSTRATIVE PLADSHOLDERE. Ingen navngiven kunde findes i denne base. Præsentér altid en case som “et typisk eksempel fra en virksomhed, der lignede jer”. Opfind ALDRIG et kundenavn.",
    "5. SIG ALDRIG “VI ER BEDRE KVALITET”. Manualen forbyder det. Flyt i stedet til konsekvens, totaløkonomi og risiko — og lad kunden regne selv.",
    "6. VÆR ÆRLIG OM DET, VI IKKE VED. Zoneklassificering, brandkrav, rapporteringspligt og lovkrav afklares hos kundens egen rådgiver eller myndighed — vi optræder aldrig som myndighed.",
    "",
    `Beregningsgrundlag (green lights eget estimatværktøj): styring sparer ${Math.round(
      CALC_ASSUMPTIONS.controlSavingShare * 100,
    )}% af det NYE anlægs forbrug · dagslysstyring sparer yderligere ${Math.round(
      CALC_ASSUMPTIONS.daylightSavingShareOfRest * 100,
    )}% af det RESTERENDE forbrug · CO₂-faktor ${String(
      CALC_ASSUMPTIONS.co2FactorKgPerKwh,
    ).replace(".", ",")} kg/kWh · ${
      CALC_ASSUMPTIONS.horizonYears
    } års betragtningsperiode med ${CALC_ASSUMPTIONS.electricityPriceEscalationPct}% årlig el-prisstigning · montage indgår ikke i tilbagebetalingstiden · estimatet vises med ±${
      CALC_ASSUMPTIONS.budgetRangePct
    }% og et sikkerhedsniveau. Alle disse er ANTAGELSER, ikke målinger.`,
  ].join("\n");

  const blocks = [];
  if (items.length) {
    blocks.push({ title: "## Relevant viden", body: items.map(renderItem).join("\n\n") });
  }
  if (plays.length) {
    blocks.push({
      title: "## Relevante konkurrentargumenter",
      body: plays.map(renderPlay).join("\n\n"),
    });
  }
  if (objections.length) {
    blocks.push({
      title: "## Relevante indvendinger",
      body: objections.map(renderObjection).join("\n\n"),
    });
  }
  if (cases.length) {
    blocks.push({
      title: "## Relevante cases (illustrative — ikke referencer)",
      body: cases.map(renderCase).join("\n\n"),
    });
  }

  // Hårdt loft: header er altid med, resten tilføjes så længe der er plads.
  let out = header;
  for (const b of blocks) {
    const chunk = `\n\n${b.title}\n${b.body}`;
    if (out.length + chunk.length > maxChars) {
      const room = maxChars - out.length - b.title.length - 8;
      if (room > 400) out += `\n\n${b.title}\n${b.body.slice(0, room)}\n…`;
      break;
    }
    out += chunk;
  }
  return out;
}

