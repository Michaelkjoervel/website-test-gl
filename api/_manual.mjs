// =============================================================================
// api/_manual.mjs · green light Salgsmanual (V3) som struktureret videnbase
// -----------------------------------------------------------------------------
// KUN SERVER-SIDE. Denne fil importeres udelukkende af Vercel-funktionerne og
// bliver ALDRIG bundtet ind i den offentlige browser-JavaScript. Manualen er
// green lights interne salgsmetodik og skal ikke kunne læses af udefrakommende
// på det statiske site.
//
// Filnavn starter med "_" så Vercel ikke gør den til en HTTP-rute.
//
// Kilde: "SALGSMANUAL – GREEN LIGHT A/S · B2B belysningsløsninger direkte til
// slutbrugeren" (V3), kapitel 1-20. Formuleringer, scripts og replikker er
// bevaret ordret, fordi coachen skal kunne citere manualen — ikke parafrasere
// den. Ændres manualen, ændres denne fil (eller der uploades en ny version,
// som lægger sig ovenpå via coach_manual-tabellen i Supabase).
// =============================================================================

export const MANUAL_META = {
  title: "Salgsmanual – green light a/s",
  subtitle: "B2B belysningsløsninger direkte til slutbrugeren",
  version: "V3",
  chapters: 20,
  language: "da",
  /** Manualens egen konklusion — den sætning alt andet hænger på. */
  northStar:
    "Vi vil bare sikre, at den løsning der bliver valgt, også er den rigtige løsning for jer i praksis.",
};

/* ---------------------------------------------------------------- Kapitler */

export const CHAPTERS = [
  { no: 1, id: "salgs-dna", title: "green lights salgs-DNA" },
  { no: 2, id: "find-kunder", title: "Hvordan vi finder de rigtige kunder" },
  { no: 3, id: "kvalificering", title: "Hvordan vi kvalificerer kunder tidligt" },
  { no: 4, id: "foerste-moede", title: "Første møde – struktur og styring" },
  { no: 5, id: "behovsafdaekning", title: "Behovsafdækning – de rigtige spørgsmål" },
  { no: 6, id: "vil-kunden-koebe", title: "Sådan finder du ud af om kunden vil købe" },
  { no: 7, id: "budget-beslutning", title: "Budget, beslutning og prioritet" },
  { no: 8, id: "pris", title: "Prisdiskussioner og billige alternativer" },
  { no: 9, id: "delaccept", title: "Delaccept – kunsten at få små ja'er" },
  { no: 10, id: "praesentation", title: "Sådan præsenterer vi løsningen" },
  { no: 11, id: "pilot", title: "Pilotprojekter – vores stærkeste våben" },
  { no: 12, id: "closing", title: "Closing – hvordan vi får kunden til at træffe beslutningen" },
  { no: 13, id: "opfoelgning", title: "Opfølgning der skaber fremdrift" },
  { no: 14, id: "indvendinger", title: "Indvendinger og hvordan de håndteres" },
  { no: 15, id: "mellemled", title: "Når rådgivere, elektrikere og indkøb tager over" },
  { no: 16, id: "deal-rescue", title: "Deal rescue – når vi er ved at miste sagen" },
  { no: 17, id: "psykologi", title: "Psykologisk salg i praksis" },
  { no: 18, id: "saelgerkrav", title: "Krav til green light-sælgeren" },
  { no: 19, id: "scripts", title: "Praktiske scripts og formuleringer" },
  { no: 20, id: "checkliste", title: "Salgscheckliste" },
];

/* -------------------------------------------------------------- Principper */
/**
 * Hvert princip er skåret så coachen kan bruge det operationelt:
 *   statement    – princippet, som manualen siger det
 *   rationale    – hvorfor det findes (coachen skal kunne forsvare det)
 *   inPractice   – hvordan det ser ud, når det efterleves
 *   questions    – ordrette spørgsmål fra manualen
 *   antiPatterns – hvad det ligner, når det IKKE efterleves (coachens radar)
 *   modes        – hvilke træningsformer princippet især hører til
 */
export const PRINCIPLES = [
  /* ---- 1. Salgs-DNA ---- */
  {
    id: "p1-loesning-ikke-armatur",
    chapter: 1,
    category: "filosofi",
    title: "Vi sælger ikke armaturer – vi sælger den rigtige løsning",
    statement:
      "Vi sælger ikke armaturer. Vi sælger den rigtige løsning til kunden. Kunden køber ikke LED. Kunden køber et resultat.",
    rationale:
      "Så snart samtalen handler om armaturet, bliver green light sammenlignelig på pris med enhver anden leverandør. Når den handler om kundens resultat, er der ingen at sammenligne med.",
    inPractice: [
      "Sælgeren taler om kundens drift og hverdag, ikke om lumen, watt og armaturtyper.",
      "Tekniske egenskaber oversættes altid til et udbytte: lavere driftsomkostninger, bedre arbejdsmiljø, driftssikkerhed, tryghed, mindre vedligehold, dokumenterbare besparelser, en løsning der virker i praksis.",
      "Sælgeren spørger kunden, hvorfor green light er interessant for dem — i stedet for at antage det.",
    ],
    questions: [
      "Hvorfor er jeg her?",
      "Hvorfor vil du bruge tid på mig?",
      "Hvad er årsagen til, at du ønsker at tale lys med mig?",
    ],
    antiPatterns: [
      "Sælgeren præsenterer produkter, datablade eller armaturserier før kundens situation er forstået.",
      "Sælgeren siger “vi har en rigtig god løsning til jer” uden at kunne sige hvilket resultat den skaber.",
      "Sælgeren beskriver DALI, D4i eller Casambi teknisk uden at oversætte til kundens hverdag.",
    ],
    example:
      "Kunden spørger “hvad koster sådan et armatur?”. En green light-sælger svarer ikke med en pris, men med: “Det kommer an på, hvad løsningen skal kunne hos jer. Må jeg spørge — hvad er det, der gør, at I kigger på lyset lige nu?”",
    modes: ["kunderollespil", "afdaekning", "salgsmoede", "materialepraesentation", "manualeksamen"],
    keywords: ["løsning", "resultat", "produkt", "armatur", "LED", "udbytte", "værdi"],
  },
  {
    id: "p1-differentiering",
    chapter: 1,
    category: "filosofi",
    title: "Vores fire forskelle fra konkurrenterne",
    statement:
      "Vi tænker i kundens drift og hverdag. Vi sælger den rigtige løsning baseret på kunden – ikke bare den billigste. Vi går direkte til beslutningstageren. Vi positionerer os som rådgiver.",
    rationale:
      "Det er de fire ting, en sælger skal kunne svare på, når kunden spørger “hvorfor jer?”. Alt andet er markedsføringssprog.",
    inPractice: [
      "Sælgeren kan på 20 sekunder forklare, hvorfor kunden skal vælge green light — uden at bruge ordet kvalitet.",
      "Sælgeren opfører sig som rådgiver: stiller flere spørgsmål end kunden, og siger ærligt fra, hvis der ikke er et potentiale.",
    ],
    antiPatterns: [
      "“Vi er bedre kvalitet” som svar på hvorfor green light.",
      "Sælgeren kan ikke forklare forskellen uden at nævne produktet.",
    ],
    modes: ["kunderollespil", "indvendinger", "lynild", "manualeksamen"],
    keywords: ["differentiering", "hvorfor green light", "konkurrent", "rådgiver", "positionering"],
  },
  {
    id: "p1-udbytteord",
    chapter: 1,
    category: "kundetilgang",
    title: "De udfordringer vi løser (kundens sprog)",
    statement:
      "Vi berører forhold som: lavere driftsomkostninger, bedre arbejdsmiljø, driftssikkerhed, tryghed, bedre arbejdsforhold, mere effektiv drift, mindre vedligehold, dokumenterbare besparelser og en løsning der virker i praksis.",
    rationale:
      "Det er kundens ordforråd. Bruger sælgeren sit eget tekniske ordforråd, taber samtalen relevans.",
    inPractice: [
      "Sælgeren bruger kundens formuleringer tilbage til kunden.",
      "Sælgeren knytter hvert udsagn til noget, kunden selv har sagt.",
    ],
    antiPatterns: ["Sælgeren remser fordele op, som kunden ikke har bekræftet er relevante."],
    modes: ["afdaekning", "kunderollespil", "materialepraesentation"],
    keywords: ["drift", "arbejdsmiljø", "vedligehold", "besparelse", "driftssikkerhed"],
  },

  /* ---- 2. Find de rigtige kunder ---- */
  {
    id: "p2-rigtige-kunder",
    chapter: 2,
    category: "kundetilgang",
    title: "Vi leder ikke efter alle kunder – vi leder efter de rigtige",
    statement:
      "Den største fejl i opsøgende salg er tilfældige virksomheder, for brede målgrupper og kunder uden behov eller budget. Det giver lav hitrate, spildtid og mange tilbud uden ordrer.",
    rationale:
      "Sælgerens dyreste ressource er tid. Forkerte kunder koster den samme tid som rigtige kunder — men giver ingen ordre.",
    inPractice: [
      "Ideelle kunder: mange m² under tag, energiforbrug betyder noget, driftssikkerhed er vigtigt, medarbejdermiljø betyder noget, vedligehold koster tid og penge, ældre installationer, ESG/CO₂-arbejde, dårlig belysning påvirker produktiviteten — og hvor vi kan komme til at tale med slutbrugeren.",
      "Alle steder hvor mennesker arbejder under tag, med et vist antal kvm, har som udgangspunkt et potentiale.",
      "Kunder og opgavetyper der passer til netop dig som sælger og menneske.",
    ],
    antiPatterns: [
      "Sælgeren bruger lige meget tid på alle emner uanset kvalitet.",
      "Sælgeren kan ikke forklare, hvorfor netop denne virksomhed er et emne.",
    ],
    modes: ["kvalificering", "fri-coaching", "manualeksamen"],
    keywords: ["ideel kunde", "målgruppe", "emne", "prospektering", "hitrate"],
  },
  {
    id: "p2-canvas",
    chapter: 2,
    category: "metode",
    title: "Kold canvas skal skabe nysgerrighed – ikke sælge",
    statement:
      "Det vigtigste ved kold canvas er ikke at sælge i telefonen, men at skabe nysgerrighed, at finde ud af om de er værd at bruge tid på, og at booke et egentligt møde.",
    rationale:
      "Et telefonopkald kan ikke bære et løsningssalg. Det kan kun købe adgang til det møde, hvor salget kan begynde.",
    inPractice: [
      "Forbered nok til at kunne tale relevant: Hvad laver virksomheden? Hvem er beslutningstager? Hvad kan være deres problem?",
      "Ring til receptionen og spørg, hvem der er ansvarlig for lys.",
      "Foreslå et kort, konkret møde med lav modstand — og en ærlig exit.",
    ],
    questions: [
      "Hvor ville bedre lys gøre en forskel for jer?",
      "Hvor i jeres virksomhed kunne lyset blive bedre?",
      "Passer det bedst først eller sidst på ugen?",
    ],
    antiPatterns: [
      "Sælgeren pitcher produkter i telefonen.",
      "Sælgeren accepterer “send noget på mail” uden at forsøge at forstå situationen først.",
      "Sælgeren ringer uforberedt og lyder generisk.",
    ],
    example:
      "“Hej Lars, det er Michael fra green light. Jeg ringer fordi vi hjælper mange produktionsvirksomheder med at reducere energiforbrug og samtidig forbedre arbejdsmiljøet gennem den rigtige belysningsløsning. Og jeg kunne godt tænke mig at spørge, hvor bedre lys ville gøre en forskel for jer?” … “Det er præcis sådan nogle problemstillinger/virksomheder vi typisk hjælper.” … “Jeg foreslår, at vi tager 20 minutter, hvor vi ser på potentialet – og hvis der ikke er noget, siger jeg det ærligt.” … “Passer det bedst først eller sidst på ugen?”",
    modes: ["telefon", "kunderollespil", "manualeksamen"],
    keywords: ["kold canvas", "telefon", "møde", "booking", "nysgerrighed", "opsøgende"],
  },
  {
    id: "p2-send-noget-paa-mail",
    chapter: 2,
    category: "faldgruber",
    title: "“Send noget på mail” må ikke accepteres blankt",
    statement:
      "Svar: “Det gør jeg gerne. Men for at det bliver relevant og ikke bare generisk materiale, skal jeg lige forstå jeres situation lidt bedre først. Skal vi tage 15 minutter?”",
    rationale:
      "Materiale uden kontekst bliver ikke læst, og sælgeren mister både information og styring.",
    inPractice: ["Sælgeren siger ja til at sende — men køber sig til forståelse først."],
    antiPatterns: ["“Ja, jeg sender lige noget” — og samtalen slutter."],
    modes: ["telefon", "indvendinger", "tilbudsopfoelgning", "lynild"],
    keywords: ["send noget", "mail", "materiale", "brochure"],
  },
  {
    id: "p2-fysisk-canvas",
    chapter: 2,
    category: "metode",
    title: "Fysisk canvas – og kør aldrig langt kun for ét møde",
    statement:
      "Fysisk canvas er meget undervurderet, fordi næsten ingen gør det længere. Når du alligevel er ude i et område til et møde, så besøg nogle af de omkringliggende virksomheder. Kør aldrig langt kun for ét møde.",
    rationale:
      "Kørselstiden er allerede betalt, når først du er i området. Et møde alene i Sønderjylland er dyrt; tre besøg samme dag er billigt. Og døren, ingen andre banker på, er den, der står mest på klem.",
    inPractice: [
      "Spørg på kundemødet, om de kender nogen Facility Managers i området eller hos nabovirksomhederne — og brug det som indgang.",
      "Åbning 1: “Jeg har lige været til møde med Jørgen i virksomhed xx lidt nede af gaden. Han mente, at det ville være relevant at tale med jer, nu jeg var i området.”",
      "Åbning 2: “Jeg er faktisk lige ovre hos [virksomhed], hvor vi hjælper dem med deres belysning og energioptimering. Og nu hvor jeg alligevel er i området, tænkte jeg bare lige at høre, hvem der typisk har ansvar for drift eller facility hos jer?”",
      "Kør igennem et industriområde og skriv adresser ned. Se på bygninger med stor tagflade i Google Maps. Spørg dine venner, hvor de arbejder.",
    ],
    antiPatterns: [
      "Sælgeren kører to timer hver vej til ét møde og hjem igen uden at banke på en eneste anden dør.",
      "Sælgeren planlægger dagen efter kalenderen i stedet for efter geografien.",
      "Sælgeren venter på, at emnerne kommer ind af sig selv.",
    ],
    modes: ["telefon", "forberedelse", "fri-coaching", "manualeksamen"],
    keywords: ["fysisk canvas", "opsøgende", "område", "kørsel", "industriområde", "besøg", "adresser"],
  },
  {
    id: "p2-netvaerk",
    chapter: 2,
    category: "kundetilgang",
    title: "Brug netværket aktivt – ikke tilfældigt",
    statement:
      "Netværk er et af de stærkeste salgsredskaber. Men de fleste bruger det alt for tilfældigt. Netværket består også af dine nuværende kunder, dine emner og alle vores samarbejdspartnere.",
    rationale:
      "En introduktion fra en, kunden allerede stoler på, springer hele tillidsfasen over. Den koster ét spørgsmål på et møde, du alligevel holder — men den bliver aldrig stillet, hvis den ikke er planlagt.",
    inPractice: [
      "Spørg på kundemøder — hver gang, ikke når det lige falder for: det er der, netværket ligger.",
    ],
    questions: [
      "Hvem kender I ellers, der kunne have samme udfordring?",
      "Ser du andre virksomheder i jeres branche med samme problematik?",
      "Vi vil gerne arbejde med flere virksomheder som jer. Hvis du kender nogen, hvor det kunne give mening, må du meget gerne introducere os.",
    ],
    antiPatterns: [
      "Sælgeren forlader et godt møde uden at have bedt om én eneste henvisning.",
      "Sælgeren bruger kun netværket, når pipelinen er tom.",
    ],
    modes: ["salgsmoede", "naeste-skridt", "debriefing", "fri-coaching", "manualeksamen"],
    keywords: ["netværk", "henvisning", "reference", "introduktion", "samarbejdspartnere", "leads"],
  },
  {
    id: "p2-installatoer-som-kilde",
    chapter: 2,
    category: "kundetilgang",
    title: "Installatøren er sjældent kunden – men ofte en kilde",
    statement:
      "En installatørs liv er funderet på at købe billigt, sælge dyrt og undgå reklamationer. Installatøren agerer ud fra “godt nok”, og oftest ikke ud fra hvad der er bedst for kunden. Som udgangspunkt er elektrikeren kun et besværligt led i salgsprocessen. Har du ikke fat i slutbrugeren, eller vil slutbrugeren skubbe dig over til elektrikeren — så stig af bussen og spar tid og penge.",
    rationale:
      "green lights værdi kan kun betales af den, der får værdien. Det er slutbrugeren — ikke mellemleddet.",
    inPractice: [
      "Brug installatører til leads: “Hvilke kunder har store ældre installationer?”, “Hvor ser I meget vedligehold?”, “Hvilke kunder arbejder med energioptimering?”",
      "Hold altid kontakten til slutkunden.",
    ],
    antiPatterns: [
      "Sælgeren bygger hele sagen på elektrikeren og har aldrig talt med slutbrugeren.",
      "Sælgeren fortsætter med at investere tid, selvom adgangen til slutbrugeren er væk.",
    ],
    modes: ["kvalificering", "fri-coaching", "debriefing", "manualeksamen"],
    keywords: ["installatør", "elektriker", "mellemled", "leads", "slutbruger", "stig af bussen"],
  },
  {
    id: "p2-lyt",
    chapter: 2,
    category: "adfaerd",
    title: "Stop med at antage – lyt",
    statement:
      "Spørg kunden om deres udfordringer. Lyt, lyt, lyt! Stop med at antage. Spørger du rigtigt, fortæller kunden, hvad han vil købe af dig, og hvad du kan sælge.",
    rationale:
      "Antagelser er den hyppigste kilde til tabte sager: sælgeren løser et problem, kunden ikke har.",
    inPractice: [
      "Sælgeren kan efter mødet gengive kundens situation med kundens egne ord.",
      "Sælgeren skelner mellem hvad kunden har sagt, og hvad sælgeren har konkluderet.",
    ],
    antiPatterns: [
      "“Jeg tror de er interesserede.” — uden belæg.",
      "Sælgeren taler mere end kunden i en afdækning.",
    ],
    modes: ["afdaekning", "debriefing", "kvalificering", "lynild"],
    keywords: ["lytning", "antagelse", "fakta", "taletid"],
  },

  /* ---- 3. Kvalificering ---- */
  {
    id: "p3-kvalificer-tidligt",
    chapter: 3,
    category: "kvalificering",
    title: "Kvalificér tidligt – før vi investerer ressourcer",
    statement:
      "Vi bruger IKKE timer på store lysberegninger, opmålinger, omfattende tilbud eller projektering, før vi har en rimelig indikation af, at kunden reelt vil købe.",
    rationale:
      "Mange sælgere taber enorme mængder tid på kunder, der aldrig havde intention om at købe. Tiden er ikke gratis, selvom beregningen er.",
    inPractice: [
      "Indsatsen skaleres efter kvalificeringens resultat — ikke efter hvor sympatisk kunden er.",
      "Er kvalificeringen svag: hold processen let, brug minimal tid, få commitment først.",
    ],
    antiPatterns: [
      "Sælgeren laver en fuld lysberegning, fordi kunden bad om et tilbud.",
      "Sælgeren begrunder tidsforbruget med “de virkede interesserede”.",
    ],
    modes: ["kvalificering", "fri-coaching", "debriefing", "manualeksamen"],
    keywords: ["kvalificering", "ressourcer", "beregning", "opmåling", "tilbud", "tid"],
  },
  {
    id: "p3-syv-krav",
    chapter: 3,
    category: "kvalificering",
    title: "De syv ting sælgeren skal vide før stor indsats",
    statement:
      "Før vi investerer meget tid skal sælgeren vide: Har kunden et reelt problem? Har kunden motivation for at løse det? Har kunden økonomi eller adgang til budget? Er kunden seriøs? Har vi fat i den rigtige beslutningstager? Er der en realistisk tidsplan? Har kunden forstået vores værdi? Hvis ikke → ingen stor indsats endnu.",
    rationale:
      "Syv spørgsmål, der kan besvares med fakta. Kan sælgeren ikke svare, er sagen ikke kvalificeret — uanset mavefornemmelse.",
    inPractice: [
      "Hvert af de syv punkter skal kunne besvares med noget kunden har sagt — ikke med sælgerens tolkning.",
      "Punkter uden svar er videnshuller, der skal lukkes hos kunden.",
    ],
    questions: [
      "Hvad fungerer ikke optimalt i dag?",
      "Hvor oplever I de største udfordringer?",
      "Hvad frustrerer jer mest ved den nuværende løsning?",
      "Hvad betyder det i praksis?",
      "Koster det jer tid, energi eller drift?",
      "Er det noget medarbejderne mærker?",
      "Hvad er en god løsning for jer?",
      "Hvor vigtigt er det her for jer at få løst?",
      "Er det noget I aktivt ønsker at gøre noget ved?",
      "Har I budget afsat til forbedringer – og i så fald hvor meget?",
      "Hvordan prioriterer I projekter som dette?",
      "Er fokus mest investering eller totaløkonomi?",
      "Går vi efter Rolls Royce-løsningen eller en billigere model?",
      "Hvornår ønsker I realistisk at gøre noget ved det?",
      "Hvordan træffer I normalt beslutning om projekter som dette?",
      "Hvem skal involveres?",
      "Har I andre der kigger på projektet, eller en elektriker der skal involveres?",
      "Hvad er jeres alternativ til at gøre det rigtige med jeres lys?",
      "Så hvis vi kommer med et projekt, der lever op til de nævnte krav, så har vi en aftale?",
    ],
    antiPatterns: [
      "Sælgeren svarer “det tror jeg nok” på et af de syv punkter.",
      "Sælgeren kender kun sin kontaktperson og kalder vedkommende beslutningstager uden belæg.",
    ],
    modes: ["kvalificering", "debriefing", "fri-coaching", "lynild", "manualeksamen"],
    keywords: ["kvalificering", "problem", "motivation", "budget", "beslutningstager", "timing", "værdi"],
  },
  {
    id: "p3-advarselstegn",
    chapter: 3,
    category: "faldgruber",
    title: "Advarselstegn – kunder der sandsynligvis ikke køber",
    statement:
      "Kunden har allerede anden leverandør eller netværk de bruger. Kunden vil kun have gratis beregninger. Ingen reel smerte. Ingen beslutningstager involveret. Alt handler kun om pris. Ingen tidsplan. Kunden vil ikke investere tid selv. “Send bare noget.” Ingen vil mødes. De vil kun bruge os som sammenligningsgrundlag.",
    rationale:
      "Advarselstegnene optræder sjældent alene. Flere samtidig er et signal om at skrue indsatsen ned — ikke op.",
    inPractice: [
      "Når flere er til stede: hold processen let, brug minimal tid, få commitment først.",
    ],
    antiPatterns: [
      "Sælgeren ser advarselstegnene, men fortsætter alligevel med fuld indsats, fordi sagen “er stor”.",
    ],
    modes: ["kvalificering", "debriefing", "fri-coaching"],
    keywords: ["advarselstegn", "røde flag", "risiko", "sammenligningsgrundlag", "gratis"],
  },
  {
    id: "p3-commitment-foer-ressourcer",
    chapter: 3,
    category: "kvalificering",
    title: "Commitment før ressourcer",
    statement:
      "“Vi kan sagtens lave en grundig analyse og beregning – men for at det giver mening for begge parter, vil jeg gerne sikre mig, at der også er reel interesse i at gå videre, hvis tallene ser fornuftige ud. Hvis vi kan dokumentere en løsning, der holder sig inden for [definer mål], har vi så en aftale?”",
    rationale:
      "Et ja her er den billigste kvalificering, der findes. Et nej er også et resultat — det sparer ugers arbejde.",
    inPractice: [
      "Trækker kunden på det: “Hvad skal der til, for at vi har en aftale?”",
      "Vil kunden ikke give en form for commitment: så skal vi ikke bruge store interne ressourcer endnu.",
      "Man må gerne være lidt fræk her. Mister man kunden ved at spørge, var de nok allerede mistet alligevel.",
    ],
    antiPatterns: [
      "Sælgeren leverer analysen først og håber på gengæld bagefter.",
      "Sælgeren tør ikke spørge, fordi det “kan ødelægge stemningen”.",
    ],
    modes: ["kvalificering", "naeste-skridt", "forhandling", "lynild", "manualeksamen"],
    keywords: ["commitment", "aftale", "modydelse", "gratis arbejde", "analyse"],
  },

  /* ---- 4. Første møde ---- */
  {
    id: "p4-moedets-formaal",
    chapter: 4,
    category: "moedestruktur",
    title: "Første møde handler ikke om at præsentere produkter",
    statement:
      "Formålet er: at få kunden til at fortælle, at forstå kunden, problemerne, motivationen og beslutningsprocessen — og at afgøre om casen er værd at investere tid i.",
    rationale:
      "Et første møde, hvor sælgeren har talt mest, har kostet et møde og ikke købt information.",
    inPractice: [
      "Sælgeren måler mødet på, hvor meget han fik at vide — ikke på hvor meget han fik fortalt.",
      "Det er vigtigere at få kunden til at tale end at bruge lang tid på at præsentere green light.",
    ],
    antiPatterns: [
      "Sælgeren åbner sin præsentation på de første 10 minutter.",
      "Sælgeren forlader mødet med en god fornemmelse, men uden fakta.",
    ],
    modes: ["salgsmoede", "kunderollespil", "debriefing", "forberedelse"],
    keywords: ["første møde", "formål", "præsentation", "afdækning"],
  },
  {
    id: "p4-start-og-agenda",
    chapter: 4,
    category: "moedestruktur",
    title: "Start mødet rigtigt og sæt agendaen",
    statement:
      "“Tak fordi jeg måtte komme. Mit mål i dag er egentlig bare at forstå jeres setup og se, om der er et potentiale. Hvis ikke, siger jeg det ærligt.” Derefter agenda: se på jeres nuværende løsning · tale om udfordringer og ønsker · se om der er potentiale · præsentere green light og vores metoder · aftale næste skridt hvis det giver mening. “Lyder det fair?”",
    rationale:
      "Åbningen fjerner sælgerpres og skaber tillid. Den der styrer agendaen, styrer processen.",
    inPractice: [
      "Agendaen sættes højt, kort og med en lukket bekræftelse (“Lyder det fair?”).",
      "Næste skridt er nævnt allerede i agendaen — så det ikke kommer som en overraskelse til sidst.",
    ],
    antiPatterns: [
      "Mødet starter med smalltalk og glider direkte over i produkt.",
      "Ingen agenda — kunden styrer, og mødet ender uden næste skridt.",
    ],
    modes: ["salgsmoede", "kunderollespil", "forberedelse", "manualeksamen"],
    keywords: ["agenda", "mødestart", "styring", "åbning", "fair"],
  },
  {
    id: "p4-next-step",
    chapter: 4,
    category: "opfoelgning",
    title: "Gå aldrig fra et møde uden aftalt næste skridt",
    statement:
      "Sørg altid for at snakke next step med kunden, og gå aldrig fra et kundemøde uden at parterne er enige om næste skridt. Få næste møde lagt i kalenderen inden mødet afsluttes. Afklar hvem der har bolden på løse ender. Slip aldrig styringen.",
    rationale:
      "Så snart noget er uklart, er kunden utryg, og konkurrenter kan smutte ind.",
    inPractice: [
      "Næste skridt har en handling, en ejer, en dato og et formål.",
      "Altid opfølgning med beslutningstager/slutbruger — ikke med mellemleddet.",
    ],
    antiPatterns: [
      "“Jeg sender lige noget.”",
      "“Vi tales ved.”",
      "“Tænk over det og vend tilbage.”",
      "Næste møde er ikke i kalenderen, når sælgeren forlader mødet.",
    ],
    modes: ["naeste-skridt", "salgsmoede", "debriefing", "lynild", "kunderollespil"],
    keywords: ["næste skridt", "next step", "kalender", "commitment", "bolden", "aftale"],
  },

  /* ---- 5. Behovsafdækning ---- */
  {
    id: "p5-spoerg-foer-du-pitcher",
    chapter: 5,
    category: "spoergeteknik",
    title: "Stil spørgsmål før du pitcher",
    statement:
      "Hvis du pitcher for tidligt, mister du kontrollen, og kunden sammenligner kun pris.",
    rationale:
      "Pitchet uden kontekst reducerer green light til et produkt med en pris.",
    inPractice: ["Ingen løsningssnak før situation, problem, konsekvens og værdi er på plads."],
    antiPatterns: [
      "Sælgeren hopper til løsning, så snart kunden nævner et problem.",
      "Sælgeren svarer på et teknisk spørgsmål med en teknisk gennemgang i stedet for et modspørgsmål.",
    ],
    modes: ["afdaekning", "kunderollespil", "salgsmoede", "lynild"],
    keywords: ["pitch", "spørgsmål", "for tidligt", "kontrol", "pris"],
  },
  {
    id: "p5-spc-vaerdi",
    chapter: 5,
    category: "metode",
    title: "Situation → Problem → Konsekvens → Værdi",
    statement:
      "Her begynder salget: Kunder køber sjældent på problemet alene. De køber på konsekvensen.",
    rationale:
      "Problemet fortæller, at noget er galt. Konsekvensen fortæller, hvad det koster. Værdien fortæller, hvad det er værd at gøre noget ved. Uden konsekvens er der ingen grund til at handle nu.",
    inPractice: [
      "Situation: “Hvordan fungerer jeres belysning i dag?”, “Hvor gammel er installationen?”, “Hvad fungerer godt?”, “Hvor fik I sidst lavet nyt lys?”, “Hvad var I ikke tilfreds med ved sidste udskiftning?”",
      "Problem: “Hvor oplever I udfordringer?”, “Er der områder medarbejderne klager over?”, “Har I problemer med vedligehold?”, “Oplever I driftsforstyrrelser?”",
      "Konsekvens: “Hvad betyder det i praksis?”, “Hvad koster det jer?”, “Hvor meget tid bruger I på det?”, “Hvordan påvirker det produktionen?”",
      "Værdi: “Hvis det blev løst – hvad ville det betyde for jer?”, “Hvor vigtigt er driftssikkerhed for jer?”, “Hvor vigtigt er energibesparelser?”, “Hvor vigtigt er arbejdsmiljø?”",
      "Prioritering: “Hvor højt ligger det her på jeres prioriteringsliste?”, “Er det noget I ønsker løst i år?”",
    ],
    antiPatterns: [
      "Sælgeren finder et problem og går direkte til løsning uden at etablere konsekvensen.",
      "Konsekvensen står i sælgerens hoved i stedet for i kundens mund.",
      "Sælgeren spørger til værdi, før kunden har sat ord på konsekvensen.",
    ],
    example:
      "Kunden siger: “Vi bruger vel omkring seks timer om ugen på at skifte armaturer.” Det er konsekvensen, der åbner sig. Bliv dér: hvem bruger de timer, hvad koster det, hvad går i stå imens, hvad sker der til vinter?",
    modes: ["afdaekning", "kunderollespil", "salgsmoede", "debriefing", "kvalificering", "manualeksamen"],
    keywords: ["situation", "problem", "konsekvens", "værdi", "SPC", "afdækning", "prioritering"],
  },
  {
    id: "p5-budgetspoergsmaal",
    chapter: 5,
    category: "kvalificering",
    title: "Budget er normal forretningsdialog",
    statement:
      "Mange sælgere er bange for budgetspørgsmålet. Det er en fejl. Hvis vi ikke får afklaret budgettet, ved vi ikke om der er reel interesse, og hvilke rammer vi arbejder under.",
    rationale:
      "Uden budgetramme kan sælgeren hverken dimensionere løsningen eller vurdere sagens realisme.",
    inPractice: [
      "Gør det afslappet — det er en normal forretningsdialog.",
    ],
    questions: [
      "Arbejder I med et budgetområde på sådan et projekt?",
      "Er fokus mest investering eller totaløkonomi?",
      "Går vi efter Rolls Royce, eller skal vi finde en Skoda?",
      "Hvad har I afsat til projektet / udskiftning af lys?",
      "Hvis det ligger omkring T.DKK xxx, har det så fortsat interesse?",
    ],
    antiPatterns: [
      "Sælgeren springer budget over for ikke at virke påtrængende.",
      "Sælgeren gætter på budgettet ud fra virksomhedens størrelse.",
    ],
    modes: ["kvalificering", "afdaekning", "forhandling", "lynild", "manualeksamen"],
    keywords: ["budget", "økonomi", "investering", "totaløkonomi", "Rolls Royce", "Skoda"],
  },

  /* ---- 6. Vil kunden købe ---- */
  {
    id: "p6-det-vigtigste-spoergsmaal",
    chapter: 6,
    category: "kvalificering",
    title: "Det vigtigste spørgsmål",
    statement:
      "“Hvis vi kan dokumentere en løsning, der lever op til [definer mål] – hvad vil så være næste skridt hos jer?”",
    rationale:
      "Spørgsmålet tester på én gang beslutningsprocessen, alvoren og næste skridt — uden at presse.",
    inPractice: [
      "Stilles først når kundens ønsker inden for økonomi, komfort og trivsel er afklaret.",
    ],
    questions: [
      "Hvornår ser du projektet som seriøst? Hvad er seriøst for dig?",
      "Hvornår vil du handle aktivt på dette projekt? Hvad skal der til?",
      "Hvis løsningen giver mening – er det så realistisk, at I går videre?",
      "Hvornår giver løsningen mening? Hvornår og hvordan kommer vi videre?",
      "Hvad skal der til, før I siger ja?",
    ],
    antiPatterns: ["Sælgeren spørger “hvad synes du?” i stedet for at teste næste skridt."],
    modes: ["kvalificering", "naeste-skridt", "salgsmoede", "lynild", "manualeksamen"],
    keywords: ["næste skridt", "dokumentere", "mål", "seriøs", "ja"],
  },
  {
    id: "p6-koebssignaler",
    chapter: 6,
    category: "kvalificering",
    title: "Tegn på reel og på lav købsinteresse",
    statement:
      "Reel interesse: kunden deler detaljer, inviterer flere personer ind, spørger til implementering, drift, økonomi og levering, afsætter tid og viser rundt. Lav interesse: korte svar, ingen spørgsmål tilbage, alt handler kun om pris, ingen vil mødes igen, ingen beslutningstager involveres, “send bare et tilbud”.",
    rationale:
      "Købssignaler er adfærd, ikke stemning. De kan observeres og dokumenteres.",
    inPractice: [
      "Sælgeren kan efter et møde pege på konkrete signaler — ikke på en fornemmelse.",
    ],
    antiPatterns: ["“De virkede meget interesserede.” — uden et eneste observerbart signal."],
    modes: ["kvalificering", "debriefing", "fri-coaching"],
    keywords: ["købssignal", "interesse", "adfærd", "signal"],
  },

  /* ---- 7. Budget, beslutning, prioritet ---- */
  {
    id: "p7-hvor-deals-doer",
    chapter: 7,
    category: "opportunity",
    title: "Mange deals dør på budget, beslutningsproces og prioritet",
    statement:
      "Ikke fordi løsningen er dårlig, men fordi sælgeren aldrig fik afklaret budget, beslutningsproces og prioritet.",
    rationale:
      "En god løsning uden en beslutningsvej bliver aldrig købt. Mange projekter dør på lav prioritet — ikke på pris.",
    inPractice: [
      "Beslutningsafklaring: “Hvordan træffer I beslutninger på projekter som dette?” — og opfølg med “Hvem skal involveres?”, “Hvad vil være vigtigst for dem?”, “Hvad kan typisk stoppe sådan et projekt?”",
      "Prioritering: “Jeg ved I sikkert har mange projekter. Hvor højt ligger dette realistisk på listen?”",
      "Budget: “Hvordan prioriterer I investeringer som dette?”, “Er der afsat midler til energioptimering?”, “Hvordan vurderer I normalt investering vs. drift?”",
    ],
    antiPatterns: [
      "Sælgeren kender ikke, hvem der kan stoppe projektet.",
      "Sælgeren har ikke spurgt til prioritet og bliver overrasket over, at sagen udskydes.",
    ],
    modes: ["kvalificering", "fri-coaching", "debriefing", "lynild", "manualeksamen"],
    keywords: ["beslutningsproces", "prioritet", "budget", "stoppe", "interessenter"],
  },

  /* ---- 8. Pris ---- */
  {
    id: "p8-aldrig-kun-pris",
    chapter: 8,
    category: "forhandling",
    title: "Konkurrér aldrig kun på pris",
    statement:
      "Den vigtigste regel: Konkurrér aldrig kun på pris. Hvis vi kun konkurrerer på pris, taber vi ofte. Brug IKKE “vi er bedre kvalitet”. Flyt fokus til konsekvens, totaløkonomi og sikkerhed.",
    rationale:
      "“Bedre kvalitet” er en påstand, kunden ikke kan efterprøve. Konsekvensspørgsmål får kunden til selv at regne risikoen ud.",
    inPractice: [
      "Afklar tidligt om kunden vil have den gode eller den billige løsning: “Hvad er vigtigst for jer i projektet?”, “Hvad er vigtigst – lav investering eller lav drift over tid?”, “Hvordan vægter I kvalitet vs. pris?”, “Er fokus mest totaløkonomi eller indkøbspris?”, “Hvor vigtigt er driftssikkerhed?”, “Hvor dyrt er nedbrud for jer?”",
      "Vil kunden kun have billigst muligt: tilpas indsatsen, brug mindre tid, hold processen simpel.",
    ],
    antiPatterns: [
      "Sælgeren forsvarer prisen med kvalitet.",
      "Sælgeren giver rabat for at komme videre i samtalen.",
      "Sælgeren matcher konkurrentens pris uden at forstå, hvad kunden sammenligner med.",
    ],
    modes: ["forhandling", "indvendinger", "kunderollespil", "lynild", "manualeksamen"],
    keywords: ["pris", "rabat", "billig", "kvalitet", "totaløkonomi", "konkurrent"],
  },
  {
    id: "p8-usikkerhed-om-billigt",
    chapter: 8,
    category: "forhandling",
    title: "Sæt tanker i gang om det billige alternativs risiko",
    statement:
      "“I kan helt sikkert få det billigere. Spørgsmålet er bare: Hvad koster det jer, hvis løsningen ikke performer som forventet?”",
    rationale:
      "Risiko er den eneste valuta, der kan konkurrere med en lavere pris.",
    inPractice: [
      "“Selve armaturet er ofte den mindste omkostning. Det dyre kommer, hvis levetiden ikke holder, driverne fejler og skal skaffes hjem fra Kina, lyset ikke fungerer i praksis, eller I skal bruge lift og driftstid på udskiftninger igen om 2-3 år.”",
      "“Mange undervurderer faktisk vedligeholdelsesomkostningen. Hvad koster det jer hver gang: nogen skal bruge tid på fejl, produktionen påvirkes, eller der skal bestilles lift og montører? Er det værd at løbe risikoen?”",
      "“Garanti er én ting. Men det vigtigste er jo egentlig: Hvem står der om 5 år, hvis der opstår problemer?”",
      "“Det er sjældent svært at finde en billigere løsning. Det svære er at finde en løsning, der stadig performer om 7-10 år.”",
      "“Hvis laveste pris er det vigtigste parameter, så er vi sandsynligvis ikke det rigtige match. Men hvis drift, levetid og totaløkonomi betyder noget, så giver det mening at kigge lidt dybere på løsningen.”",
    ],
    antiPatterns: ["Sælgeren nedgør konkurrenten i stedet for at stille risikospørgsmål."],
    modes: ["forhandling", "indvendinger", "kunderollespil", "materialepraesentation"],
    keywords: ["risiko", "levetid", "driver", "Kina", "vedligehold", "garanti", "totaløkonomi"],
  },
  {
    id: "p8-for-dyrt",
    chapter: 8,
    category: "indvendinger",
    title: "“Det er for dyrt” og “vi kan få det billigere”",
    statement:
      "Anerkend først: “Det kan jeg godt forstå. Men må jeg spørge hvad du sammenligner med?” — Og: “Det er jeg sikker på. Spørgsmålet er bare, hvad man får for prisen.”",
    rationale:
      "At kunden italesætter prisen er et godt købssignal. Nu kan vi styre samtalen, fordi vi ved, at prisen er vigtig. Salget begynder først rigtigt, når man har fået et nej — ved vi ikke hvad kunden siger nej til, har vi ikke fundet grænsen.",
    inPractice: [
      "Kina-armatur-scriptet: “green light har været her i 35 år, og vores kundegruppe tæller virksomheder som […]. Hvis vi solgte produkter, der var for dyre, ville vi ikke have en plads i markedet. Der er forskel på produkterne, men skulle vi to ikke kigge på disse forskelle og så se, om du reelt kan nøjes med et Kina-armatur? Kan du det, så skal du vælge en løsning til halv pris. Men du skal gøre det på et ordentligt, oplyst grundlag — og det giver jeg dig rigtig gerne. Så kan du beslutte. Lad os starte med, hvad du lægger vægt på, og hvad der betyder noget for dig?”",
    ],
    antiPatterns: [
      "Sælgeren undskylder prisen.",
      "Sælgeren spørger ikke, hvad kunden sammenligner med.",
    ],
    modes: ["indvendinger", "forhandling", "kunderollespil", "lynild"],
    keywords: ["for dyrt", "billigere", "sammenligne", "nej", "Kina", "35 år"],
  },

  {
    id: "p8-nej-er-hvor-salget-begynder",
    chapter: 8,
    category: "adfaerd",
    title: "Salget begynder først, når man har fået et nej",
    statement:
      "Husk: salget begynder først rigtigt, når man har fået et nej. Ved vi ikke, hvad kunden siger nej til, har vi ikke fundet grænsen. Hellere gå efter et nej end at bruge alt for meget tid på et håb, der ikke er der.",
    rationale:
      "Et høfligt ja uden indhold er dyrere end et nej. Nej'et fortæller, hvor grænsen går — og først dér ved sælgeren, hvad han reelt forhandler om. Uden et nej arbejder han i blinde på en sag, der måske aldrig fandtes.",
    inPractice: [
      "At kunden italesætter prisen eller siger nej, er et købssignal: nu ved vi, hvad der betyder noget, og nu kan vi styre samtalen.",
      "Gå udfordringerne i møde og tag styringen — også når svaret risikerer at blive nej.",
      "Man må gerne være lidt fræk. Mister man kunden ved at spørge, var de nok allerede mistet alligevel.",
      "Når nej'et falder: “Det giver mening. Hvad ligger bag?” — og bliv i svaret.",
    ],
    questions: [
      "Hvad er det, der holder jer tilbage?",
      "Hvad skal der til, før I siger ja?",
      "Hvad ligger bag?",
    ],
    antiPatterns: [
      "Sælgeren undgår de spørgsmål, der kan udløse et nej, og holder sagen kunstigt i live.",
      "Sælgeren tolker et høfligt “vi vender tilbage” som et ja, der bare mangler tid.",
      "Sælgeren behandler nej'et som samtalens slutning i stedet for som dens begyndelse.",
    ],
    modes: [
      "indvendinger",
      "forhandling",
      "kvalificering",
      "tilbudsopfoelgning",
      "naeste-skridt",
      "fri-coaching",
      "lynild",
      "manualeksamen",
    ],
    keywords: ["nej", "grænse", "håb", "modstand", "mod", "afklaring", "købssignal"],
  },

  /* ---- 9. Delaccept ---- */
  {
    id: "p9-delaccept",
    chapter: 9,
    category: "metode",
    title: "Delaccept – store salg lukkes gennem mange små ja'er",
    statement:
      "Store salg bliver ikke lukket på ét spørgsmål. De bliver lukket gennem mange små acceptpunkter.",
    rationale:
      "Mennesker ønsker at være konsistente. Når kunden først har sagt ja til problemet, konsekvensen og værdien, bliver det langt lettere at sige ja til løsningen. Kunden bygger selv sin beslutning.",
    inPractice: [
      "“Giver det mening, at energiforbruget er højt her?”",
      "“Er vi enige om, at driftssikkerhed er vigtigt?”",
      "“Ville det være en fordel at reducere vedligehold?”",
      "“Giver det mening at kigge på totaløkonomien?”",
      "“Kan vi blive enige om, at medarbejdermiljøet er vigtigt?”",
    ],
    antiPatterns: [
      "Sælgeren gemmer alle spørgsmål til ét stort ja til sidst.",
      "Sælgeren får aldrig kunden til at bekræfte problemet højt.",
    ],
    modes: ["kunderollespil", "salgsmoede", "naeste-skridt", "manualeksamen"],
    keywords: ["delaccept", "små ja", "konsistens", "acceptpunkt"],
  },

  /* ---- 10. Præsentation ---- */
  {
    id: "p10-praesentationsstruktur",
    chapter: 10,
    category: "moedestruktur",
    title: "Sådan præsenterer vi løsningen",
    statement:
      "Den største fejl sælgere laver er at vise og tale om produkter. Kunder køber IKKE produkter — kunder køber løsninger på problemer. Struktur: 1) knyt til deres behov, 2) forklar simpelt, 3) dokumentér fakta, men kort.",
    rationale:
      "Præsentationen skal spejle kundens egne ord tilbage. Ellers bliver den en generisk leverandørpræsentation.",
    inPractice: [
      "Knyt til behov: “Ud fra det du siger omkring vedligehold og energiforbrug, giver denne løsning mening fordi…”",
      "Forklar simpelt: hvad løsningen gør, hvorfor den passer, hvilken effekt den giver. Ikke teknisk overload.",
      "Dokumentér kort: cases, tal, ROI, besparelser, levetid, referencer.",
    ],
    antiPatterns: [
      "Slides med produktspecifikationer før kundens situation er nævnt.",
      "Teknisk gennemgang af styring uden et eneste kundeudbytte.",
    ],
    modes: ["materialepraesentation", "salgsmoede", "kunderollespil", "forberedelse"],
    keywords: ["præsentation", "materiale", "struktur", "case", "ROI", "referencer"],
  },

  /* ---- 11. Pilot ---- */
  {
    id: "p11-pilot",
    chapter: 11,
    category: "metode",
    title: "Pilotprojekter er vores stærkeste våben",
    statement:
      "“I stedet for at tage en stor beslutning nu, foreslår jeg, at vi starter med et afgrænset område. Så kan I selv se effekten i praksis og tage beslutningen på fakta.”",
    rationale:
      "Pilot reducerer risiko, gør ja'et lettere, lader kunden opleve løsningen fysisk, skaber højere tillid og mindre intern modstand.",
    inPractice: ["Gode pilotområder: 1 kontor, 1 rum, 1 hal, 1 lagerområde, 1 afdeling."],
    antiPatterns: [
      "Sælgeren presser på for hele projektet, når kunden tøver — i stedet for at gøre beslutningen mindre.",
    ],
    modes: ["naeste-skridt", "indvendinger", "forhandling", "kunderollespil", "manualeksamen"],
    keywords: ["pilot", "prøveopsætning", "afgrænset", "risiko", "demo"],
  },

  /* ---- 12. Closing ---- */
  {
    id: "p12-luk-processen",
    chapter: 12,
    category: "metode",
    title: "I store salg lukker vi ikke salget – vi lukker processen",
    statement:
      "Beslutnings-close: “For at vi ikke taber momentum – hvordan træffer I normalt beslutning på projekter som dette?” · Multi-stakeholder: “Giver det mening, at vi samler alle relevante personer, så vi får alle perspektiver med?” · Økonomi: “Hvis tallene holder – har vi så en aftale?” · Risiko: “Lad os starte småt, så risikoen bliver minimal.” · Konsekvens: “Hvad sker der, hvis I ikke gør noget det næste år? Og hvad vil det koste jer?” · Tidslinje: “Hvis I ønsker det implementeret i Q3, hvornår skal beslutningen så træffes?” · Direkte: “Skal vi sætte projektet i gang?”",
    rationale:
      "Beslutningen træffes af en organisation over tid. Closing er at gøre den proces konkret — ikke at presse et ja frem.",
    inPractice: ["Vælg den close, der matcher det, der reelt blokerer — ikke den, der føles tryggest."],
    antiPatterns: [
      "Sælgeren “closer” ved at spørge om kunden vil have et tilbud.",
      "Sælgeren bruger den direkte close, selvom beslutningsprocessen er ukendt.",
    ],
    modes: ["naeste-skridt", "salgsmoede", "kunderollespil", "manualeksamen"],
    keywords: ["closing", "close", "beslutning", "momentum", "tidslinje"],
  },
  {
    id: "p12-stilhed",
    chapter: 12,
    category: "adfaerd",
    title: "Efter closing-spørgsmålet: hold kæft",
    statement:
      "Efter closing-spørgsmålet: HOLD KÆFT. Ingen ekstra forklaringer. Ingen nervøs snak. Stilhed er et af de stærkeste værktøjer i salg.",
    rationale:
      "Kunden begynder ofte at sælge til sig selv i pausen. Den der taler først, har tabt.",
    inPractice: ["Stil spørgsmålet. Vent. Lad pausen være ubehagelig."],
    antiPatterns: [
      "Sælgeren stiller et stærkt spørgsmål og besvarer det selv.",
      "Sælgeren fylder pausen med et nyt argument.",
    ],
    modes: ["naeste-skridt", "kunderollespil", "forhandling", "lynild", "salgsmoede"],
    keywords: ["stilhed", "pause", "tavshed", "vent"],
  },

  /* ---- 13. Opfølgning ---- */
  {
    id: "p13-opfoelgning",
    chapter: 13,
    category: "opfoelgning",
    title: "Opfølgning der skaber fremdrift",
    statement:
      "Forkert opfølgning: “Har du set mit tilbud?” Rigtig opfølgning: “Hvad tænker du om løsningen?”, “Hvad taler for – og hvad taler imod?”, “Hvad mangler for at kunne tage næste skridt?”",
    rationale:
      "Den der styrer opfølgningen, styrer processen. Et statusspørgsmål flytter ingenting; et indholdsspørgsmål flytter sagen.",
    inPractice: [
      "Trækker kunden tiden: “Må jeg stille et lidt direkte spørgsmål? Hvad holder jer egentlig tilbage lige nu?”",
      "Opfølgningsrytme: 2-3 dage efter, 1 uge efter, derefter struktureret.",
    ],
    antiPatterns: [
      "“Jeg ville bare høre, om du havde set mit tilbud.”",
      "“Jeg følger lige op.” — uden formål.",
      "Sælgeren venter på, at kunden vender tilbage.",
    ],
    modes: ["tilbudsopfoelgning", "naeste-skridt", "telefon", "lynild", "manualeksamen"],
    keywords: ["opfølgning", "tilbud", "fremdrift", "rytme", "holder tilbage"],
  },

  /* ---- 14. Indvendinger ---- */
  {
    id: "p14-svar-aldrig-for-hurtigt",
    chapter: 14,
    category: "indvendinger",
    title: "Svar aldrig for hurtigt på en indvending",
    statement:
      "Start med at anerkende: “Det giver god mening.” Grav derefter dybere: “Må jeg spørge hvad du tænker helt konkret?” Først når du forstår, kan du komme med det rigtige svar.",
    rationale:
      "Et hurtigt svar er et svar på den indvending, sælgeren tror han hørte — ikke på den kunden har.",
    inPractice: [
      "Den stærkeste replik: “Må jeg være helt ærlig – hvad er det, der holder jer tilbage?”",
    ],
    questions: [
      "“Det er for dyrt” → “Hvad sammenligner du med?” / “Hvad ville være en fornuftig pris?”",
      "“Vi har en leverandør” → “Hvad fungerer godt – og hvad kunne fungere bedre?”",
      "“Ikke lige nu” → “Hvad gør, at timingen ikke er rigtig?” / “Hvad er den rigtige timing?”",
      "“Send et tilbud” → “Det gør jeg gerne, men så skal jeg sikre, at det rammer rigtigt. Kan vi drøfte, hvad dine krav er til projektet/tilbuddet?”",
      "“Vi vælger en anden løsning” → “Hvad gør den løsning mere attraktiv?”",
    ],
    antiPatterns: [
      "Sælgeren modargumenterer med det samme.",
      "Sælgeren behandler indvendingen som en fejl, der skal rettes, i stedet for information.",
    ],
    modes: ["indvendinger", "kunderollespil", "forhandling", "lynild", "manualeksamen"],
    keywords: ["indvending", "anerkend", "grav dybere", "holder tilbage", "modstand"],
  },

  /* ---- 15. Mellemled ---- */
  {
    id: "p15-hold-fast-i-slutbrugeren",
    chapter: 15,
    category: "opportunity",
    title: "Slip aldrig dialogen med slutbrugeren",
    statement:
      "Bliver vi koblet af dialogen med slutbrugeren, bliver løsningen ringere — bl.a. fordi der kommer fokus på de forkerte ting. Gør alt for at holde fast i slutbrugeren, ellers mister vi styringen.",
    rationale:
      "Elektrikeren optimerer installation, egen avance og enkel udførelse — ikke nødvendigvis drift, totaløkonomi og slutbrugeroplevelse. Men han er ofte tæt på kunden og kan køre os af banen. Derfor er han en vigtig samarbejdspartner, vi skal tage styringen over for — ikke en modstander, vi ignorerer.",
    inPractice: [
      "Tag styringen over for BÅDE slutbruger og elektriker. Find ud af, hvad der driver elektrikeren, og find den rigtige gulerod til, at han går med os.",
      "“Det gør vi også gerne. Men for at sikre at løsningen matcher jeres drift og hverdag, er det vigtigt at vi også får jeres perspektiv med.”",
      "“Selvfølgelig vil jeg rigtig gerne i dialog med både din rådgiver og din elektriker. Men jeg slipper ikke dialogen direkte med dig, for jeg har et ansvar for, at det samlede resultat lever op til det, green light lover DIG.”",
      "Det stærke kort: “Skubber du mig over på rådgiveren, så fratager du mig muligheden for at få dig tæt med på rejsen og få afdækket dine behov — så melder jeg hellere fra på opgaven, da jeg så ikke kan finde den rigtige løsning til dig.” Det virker, fordi du tager noget fra folk. Gør man det, vil de bare have det igen.",
      "Treparts-møde: “Giver det mening at vi tager et fælles møde med rådgiver/elektriker, så vi får alle perspektiver med?”",
      "Vores position over for slutbrugeren: “Det handler ikke om produktet. Det handler om, hvordan løsningen fungerer i jeres hverdag.”",
    ],
    antiPatterns: [
      "Sælgeren accepterer at “køre det gennem rådgiveren” uden modstand.",
      "Sælgeren afleverer sin viden til rådgiveren i stedet for til slutbrugeren.",
      "Sælgeren behandler elektrikeren som en modstander og finder aldrig ud af, hvad der driver ham.",
    ],
    modes: ["indvendinger", "kvalificering", "fri-coaching", "kunderollespil", "manualeksamen"],
    keywords: ["rådgiver", "elektriker", "indkøb", "slutbruger", "styring", "mellemled", "treparts"],
  },

  /* ---- 16. Deal rescue ---- */
  {
    id: "p16-deal-rescue",
    chapter: 16,
    category: "opportunity",
    title: "Deal rescue – reagér hurtigt og bring ny værdi",
    statement:
      "Første regel: reagér hurtigt og afklar hvad der sker. Har vi stadig adgang til slutbrugeren? Hvem styrer processen? Hvad er vigtigst for kunden? Er vi stadig relevante? Hellere gå efter et nej end at bruge alt for meget tid på et håb, der ikke er der.",
    rationale:
      "En sag der er gået i stå, flyttes ikke af opfølgning. Den flyttes af ny viden, der reducerer kundens usikkerhed.",
    inPractice: [
      "Re-entry: “Hej [navn]. Jeg kan se projektet nu kører via [rådgiver/elektriker]. Vi vil bare sikre, at den løsning der ender med at blive valgt, også matcher det vi talte om omkring [konkret behov].” … “Må vi tage 20 minutter, så vi sikrer at de vigtigste ting ikke går tabt?”",
      "Bring ny værdi: ny besparelsesberegning, risikoanalyse, demo/prøveopsætning, case, driftsperspektiv.",
      "Find årsagen — antag ikke. Tal med kunden.",
      "Aflever aldrig vores viden til rådgiveren. Den skal til slutbrugeren, så han kan se, hvem der skaber værdien.",
    ],
    antiPatterns: [
      "Sælgeren sender endnu en opfølgningsmail uden nyt indhold.",
      "Sælgeren gætter på, hvorfor sagen er gået i stå.",
    ],
    modes: ["tilbudsopfoelgning", "fri-coaching", "telefon"],
    keywords: ["deal rescue", "gået i stå", "re-entry", "tabt", "ny værdi", "risikoanalyse"],
  },

  /* ---- 17. Psykologi ---- */
  {
    id: "p17-psykologi",
    chapter: 17,
    category: "metode",
    title: "Psykologisk salg i praksis",
    statement:
      "Reciprocation, authority, social proof, loss aversion, future pacing og stilhed — små ting, der faktisk gør en forskel i samtalen.",
    rationale:
      "green lights egen manual anerkender adfærdspsykologi som en del af håndværket — brugt som forstærkning af en ærlig dialog, ikke som manipulation.",
    inPractice: [
      "Reciprocation: giv først en lille ting (rundstykker, kage, gratis for-analyse, lille gadget) — folk giver tilbage med tid, villighed og opmærksomhed.",
      "Authority: tal som en ekspert, ikke som en desperat sælger — “Det vi typisk ser i virksomheder som jeres…”",
      "Social proof: “Flere virksomheder i jeres branche har haft samme udfordring…”",
      "Loss aversion: “Hvis I ikke gør noget, vil det typisk koste jer X om året.” Tab motiverer mere end gevinst.",
      "Future pacing: “Forestil jer at løsningen er implementeret – hvad vil det betyde for jeres hverdag?” Kunden begynder mentalt at eje løsningen.",
      "Stilhed: efter et vigtigt spørgsmål — VENT. Kunden begynder ofte at sælge til sig selv.",
    ],
    antiPatterns: ["Sælgeren bruger teknikkerne mekanisk uden at have et reelt indhold bag."],
    modes: ["kunderollespil", "forhandling", "naeste-skridt", "fri-coaching", "manualeksamen"],
    keywords: ["psykologi", "reciprocation", "authority", "social proof", "loss aversion", "future pacing", "stilhed"],
  },

  /* ---- 18. Krav til sælgeren ---- */
  {
    id: "p18-kan-tor-vil-gor",
    chapter: 18,
    category: "adfaerd",
    title: "Jeg Kan! Jeg Tør! Jeg Vil! Jeg Gør!",
    statement:
      "Jeg Kan: Har jeg den nødvendige viden? · Jeg Tør: Har jeg modet til at tale pris, udfordre kunden, stille svære spørgsmål og gå efter at lukke handlen? · Jeg Vil: Prioriterer jeg det, der skaber salg, eller lader jeg mig forstyrre af uvæsentlige detaljer og overspringshandlinger? · Jeg Gør: Er jeg konsekvent i mine aktiviteter? Holder jeg altid ord, og er jeg konsekvent i min opfølgning?",
    rationale:
      "green lights egen ramme for sælgerudvikling. Coachen bruger den til at adressere, om det er viden, mod, vilje eller konsekvens, der mangler.",
    inPractice: [
      "Når en sælger undgår budgetspørgsmålet, er det sjældent “Kan” — det er “Tør”.",
      "Når en sælger ikke følger op til tiden, er det “Gør”.",
    ],
    antiPatterns: ["Sælgeren forklarer manglende mod med manglende viden."],
    modes: ["fri-coaching", "debriefing", "lynild", "manualeksamen"],
    keywords: ["kan", "tør", "vil", "gør", "mod", "vilje", "konsekvens", "disciplin"],
  },

  /* ---- 20. Checkliste ---- */
  {
    id: "p20-checklister",
    chapter: 20,
    category: "kvalificering",
    title: "Salgschecklisten – tre porte i processen",
    statement:
      "Før opmåling og større beregninger: reelt problem? motivation? budget eller realistisk økonomi? adgang til beslutningstager? realistisk timing? commitment? Hvis nej → hold processen let. · Før tilbud sendes: er behov forstået? er værdi tydelig? er beslutningsproces afklaret? er næste skridt aftalt? · Før closing: kender vi kundens problem? kender vi konsekvensen? har kunden accepteret værdien? er risiko reduceret? er beslutningstager med? er næste skridt tydeligt?",
    rationale:
      "Tre porte, der hver især forhindrer et typisk spild: spildt projektering, spildt tilbud og et for tidligt forsøg på at lukke.",
    inPractice: ["Coachen kan bruge checklisten direkte som kvalificeringsramme i en gennemgang."],
    antiPatterns: ["Sælgeren passerer en port uden at kunne svare ja på punkterne."],
    modes: ["kvalificering", "fri-coaching", "debriefing", "manualeksamen"],
    keywords: ["checkliste", "port", "tilbud", "closing", "opmåling"],
  },
];

/* --------------------------------------------------------------- Scripts */
/** Ordrette formuleringer fra kapitel 19 + de mest brugte replikker. */
export const SCRIPTS = [
  { situation: "Når kunden tøver", line: "Hvad sidder du egentlig og tænker?" },
  { situation: "Når kunden fokuserer på pris", line: "Hvad er vigtigst for jer – lav pris nu eller lav samlet drift over tid?" },
  { situation: "Når kunden virker usikker", line: "Hvad skal der til, for at det føles trygt?" },
  { situation: "Når kunden er positiv men passiv", line: "Hvad vil være det naturlige næste skridt herfra?" },
  { situation: "Når kunden siger nej", line: "Det giver mening. Hvad ligger bag?" },
  { situation: "Når kunden trækker tiden", line: "Hvad sker der, hvis I ikke gør noget det næste år?" },
  {
    situation: "Når kunden vil have gratis arbejde",
    line: "Vi investerer gerne tiden i en grundig analyse – men jeg vil gerne sikre, at der også er reel interesse i at arbejde videre, hvis potentialet er der.",
  },
  {
    situation: "Den stærkeste replik ved indvendinger",
    line: "Må jeg være helt ærlig – hvad er det, der holder jer tilbage?",
  },
  {
    situation: "Den vigtigste sætning i hele green light",
    line: "Vi vil bare sikre, at den løsning der bliver valgt, også er den rigtige løsning for jer i praksis.",
  },
];

/* ------------------------------------------------------------ Checklister */
export const CHECKLISTS = [
  {
    id: "foer-opmaaling",
    title: "Før opmåling og større beregninger",
    items: [
      "Har kunden et reelt problem?",
      "Har kunden motivation?",
      "Har kunden budget eller realistisk økonomi?",
      "Har vi adgang til beslutningstager?",
      "Er der realistisk timing?",
      "Har kunden givet commitment?",
    ],
    ifNo: "Hold processen let.",
  },
  {
    id: "foer-tilbud",
    title: "Før tilbud sendes",
    items: [
      "Er behov forstået?",
      "Er værdi tydelig?",
      "Er beslutningsproces afklaret?",
      "Er næste skridt aftalt?",
    ],
    ifNo: "Send ikke tilbuddet endnu — luk hullet først.",
  },
  {
    id: "foer-closing",
    title: "Før closing",
    items: [
      "Kender vi kundens problem?",
      "Kender vi konsekvensen?",
      "Har kunden accepteret værdien?",
      "Er risiko reduceret?",
      "Er beslutningstager med?",
      "Er næste skridt tydeligt?",
    ],
    ifNo: "Så er det ikke closing, der mangler — det er afdækning.",
  },
];

/* ---------------------------------------------------- Udvælgelse & render */

/** Let manifest til klienten: ingen manual-prosa, kun navne til visning. */
export function manualManifest() {
  return {
    meta: { ...MANUAL_META },
    chapters: CHAPTERS,
    principles: PRINCIPLES.map((p) => ({
      id: p.id,
      title: p.title,
      chapter: p.chapter,
      category: p.category,
      modes: p.modes,
    })),
    checklists: CHECKLISTS.map((c) => ({ id: c.id, title: c.title, items: c.items })),
  };
}

function scorePrinciple(p, { modeId, keywords = [], principleIds = [] }) {
  let score = 0;
  if (principleIds.includes(p.id)) score += 100;
  if (modeId && p.modes.includes(modeId)) score += 10;
  const hay = `${p.title} ${p.statement} ${p.keywords.join(" ")}`.toLowerCase();
  for (const k of keywords) {
    const kk = String(k || "").toLowerCase().trim();
    if (kk.length > 2 && hay.includes(kk)) score += 3;
  }
  return score;
}

/**
 * Vælg de principper der er relevante lige nu. Manualen dumpes ALDRIG i sin
 * helhed ind i en prompt — coachen skal bruge det relevante, ikke recitere.
 */
export function selectPrinciples({ modeId, keywords = [], principleIds = [], limit = 8 } = {}) {
  return PRINCIPLES.map((p) => ({ p, s: scorePrinciple(p, { modeId, keywords, principleIds }) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p);
}

function renderPrinciple(p, { full = true } = {}) {
  const lines = [`### ${p.title}  [${p.id} · kap. ${p.chapter}]`, p.statement];
  if (full) {
    if (p.rationale) lines.push(`Hvorfor: ${p.rationale}`);
    if (p.inPractice?.length) lines.push(`I praksis:\n- ${p.inPractice.join("\n- ")}`);
    if (p.questions?.length) lines.push(`Manualens spørgsmål:\n- ${p.questions.join("\n- ")}`);
    if (p.antiPatterns?.length) lines.push(`Sådan ser det ud når det IKKE følges:\n- ${p.antiPatterns.join("\n- ")}`);
    if (p.example) lines.push(`Eksempel: ${p.example}`);
  }
  return lines.join("\n");
}

/**
 * Byg den manual-kontekst der lægges ind i coachens systeminstruktion.
 * `depth`: "kerne" = kun udvalgte principper · "bred" = flere, kortere.
 */
export function renderManualContext({
  modeId,
  keywords = [],
  principleIds = [],
  limit = 8,
  depth = "kerne",
} = {}) {
  const chosen = selectPrinciples({ modeId, keywords, principleIds, limit });
  const parts = [
    `# GREEN LIGHT SALGSMANUAL (${MANUAL_META.version}) — primær sandhedskilde`,
    `Manualens egen konklusion: "${MANUAL_META.northStar}"`,
    "",
    "## Relevante principper for denne session",
    chosen.map((p) => renderPrinciple(p, { full: depth === "kerne" })).join("\n\n"),
  ];

  if (depth === "kerne") {
    parts.push(
      "",
      "## Manualens ordrette replikker (brug dem — de er green lights sprog)",
      SCRIPTS.map((s) => `- ${s.situation}: “${s.line}”`).join("\n"),
    );
  }
  return parts.join("\n");
}

/** Hele manualen i komprimeret form — bruges kun til manual-eksamen. */
export function renderFullManualOutline() {
  return [
    `# ${MANUAL_META.title} (${MANUAL_META.version})`,
    CHAPTERS.map((c) => `${c.no}. ${c.title}`).join("\n"),
    "",
    PRINCIPLES.map((p) => renderPrinciple(p, { full: true })).join("\n\n"),
    "",
    "## Checklister",
    CHECKLISTS.map((c) => `${c.title}\n- ${c.items.join("\n- ")}\n→ Hvis nej: ${c.ifNo}`).join("\n\n"),
  ].join("\n");
}
