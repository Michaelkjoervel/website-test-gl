/* ============================================================================
   INDHOLD – det eneste sted, du skal redigere.

   1) Udskift alle "[UDFYLD: …]"-markeringer med dine egne oplysninger.
   2) Læs alle svar igennem – agenten må kun sige ting, du selv står inde for.
   3) Sæt meta.draft = false, når du er klar til at sende sitet.

   Tip: søg efter "UDFYLD" for at finde alle markeringer.
   ============================================================================ */

window.ANSOEGNING = {

  /* ------------------------------------------------------------------ */
  meta: {
    draft: true,
    name: "Michael Kjørvel",
    tagline: "Teknisk profil, der bygger AI-løsninger, folk faktisk bruger",
    city: "[UDFYLD: by]",
    email: "mkj@green-light.dk",
    phone: "[UDFYLD: telefonnummer, fx +45 12 34 56 78]",
    linkedin: "https://www.linkedin.com/in/michael-kjørvel/",
    mailSubject: "Samtale – Head of AI Transformation",
  },

  /* ------------------------------------------------------------------ */
  /* "Om mig" – den personlige del.                                      */
  about: {
    title: "Jeg taler ikke bare om digitalisering – jeg bygger den",
    lead:
      "Jeg arbejder i krydsfeltet mellem teknologi, forretning og mennesker – og " +
      "min force er at gøre AI konkret nok til, at den skaber værdi i hverdagen.",
    paragraphs: [
      "I dag arbejder jeg i energi- og belysningsbranchen hos green light a/s, hvor jeg " +
        "[UDFYLD: din rolle og dit hovedansvar i én sætning]. Det, der kendetegner mig, " +
        "er, at jeg ikke stopper ved idéer og oplæg: Jeg bygger fungerende løsninger og " +
        "sørger for, at de bliver taget i brug.",
      "AI er omdrejningspunktet i den måde, jeg arbejder på. Jeg bruger AI-assisteret " +
        "udvikling til at gå fra idé til fungerende værktøj på dage frem for måneder – " +
        "fx en estimerings- og business case-løsning, der regner ROI og CO₂ for kunderne, " +
        "og et internt tidsregistreringsværktøj. Dette ansøgningssite er bygget på samme " +
        "måde. For mig er AI ikke et buzzword, men en daglig arbejdsform: mennesket sætter " +
        "retningen, AI accelererer vejen derhen.",
      "[UDFYLD: et par personlige linjer – fx hvor du bor, familie, hvad der driver dig " +
        "uden for arbejdet, og hvorfor netop den maritime branche og Sydfyn trækker i dig. " +
        "Det er her, læseren får fornemmelsen af mennesket bag profilen.]",
    ],
    quickFacts: [
      { label: "Branche i dag", value: "Energi & belysning (green light a/s)" },
      { label: "Arbejdsform", value: "Hands-on, AI-assisteret udvikling" },
      { label: "Bopæl", value: "[UDFYLD: by/område]" },
      { label: "Sprog", value: "[UDFYLD: fx dansk & engelsk]" },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* "Erhvervserfaring" – CV-delen.                                      */
  /* VIGTIGT: Kun den nuværende rolles AI-/værktøjspunkt er bekræftet ud */
  /* fra dette repo. Alt andet er skabelon – udfyld med din rigtige CV.  */
  experience: {
    intro:
      "Et udpluk af min baggrund. Den røde tråd er, at jeg omsætter teknologi til " +
      "værktøjer og resultater, der bliver brugt i hverdagen – ikke til hyldevarer.",
    roles: [
      {
        period: "[UDFYLD: årstal]–nu",
        title: "[UDFYLD: din nuværende titel]",
        org: "green light a/s",
        note: "Energibesparende belysning til erhverv og industri",
        points: [
          "Designer og bygger interne digitale værktøjer med AI-assisteret udvikling – " +
            "bl.a. en estimerings- og business case-løsning (ROI & CO₂) og et " +
            "tidsregistreringsværktøj.",
          "[UDFYLD: dit primære ansvarsområde i rollen]",
          "[UDFYLD: ét konkret resultat, gerne med tal – fx sparet tid, øget hitrate eller hurtigere tilbud]",
        ],
      },
      {
        period: "[UDFYLD: årstal–årstal]",
        title: "[UDFYLD: tidligere titel]",
        org: "[UDFYLD: virksomhed]",
        note: "[UDFYLD: branche/kort kontekst]",
        points: [
          "[UDFYLD: dit ansvar og vigtigste resultat i rollen]",
        ],
      },
      {
        period: "[UDFYLD: årstal–årstal]",
        title: "[UDFYLD: tidligere titel]",
        org: "[UDFYLD: virksomhed]",
        note: "[UDFYLD: branche/kort kontekst]",
        points: [
          "[UDFYLD: dit ansvar og vigtigste resultat i rollen]",
        ],
      },
    ],
    education: [
      {
        period: "[UDFYLD: årstal]",
        title: "[UDFYLD: uddannelse/kursus]",
        org: "[UDFYLD: institution]",
      },
    ],
    // Kompetencer, der er dokumenteret i praksis via dette og dine øvrige projekter:
    skillsEvidenced: [
      "AI-assisteret udvikling (bl.a. Claude Code)",
      "React & TypeScript",
      "Business case- & ROI-modellering",
      "Data- & beregningslogik",
      "Energi- & CO₂-beregning",
      "Git & CI-deployment",
    ],
    skillsTodo:
      "[UDFYLD: øvrige kompetencer du vil fremhæve – fx Microsoft 365 Copilot, " +
      "Copilot Studio, Power Platform, projektledelse, ledelse, change management]",
  },

  /* ------------------------------------------------------------------ */
  /* "Match med rollen" – citater fra opslaget og dit svar på dem.       */
  match: [
    {
      quote: "… formidler AI på en måde, der gør det forståeligt og anvendeligt i praksis.",
      answer:
        "Jeg oversætter mellem maskinrum og direktionsgang. Min regel er, at hvis en " +
        "kollega ikke kan forklare, hvad løsningen gør for netop deres arbejdsdag, er " +
        "formidlingen ikke færdig. [UDFYLD: ét konkret eksempel – fx undervisning, " +
        "workshops eller en udrulning, hvor din formidling gjorde forskellen.]",
    },
    {
      quote: "… følger udviklingen inden for AI og identificerer og prioriterer, hvor AI kan skabe reel værdi.",
      answer:
        "Jeg tester selv nye værktøjer, før jeg anbefaler dem, og prioriterer altid efter " +
        "to akser: forretningsværdi og implementerbarhed. Ingen pilot uden en ejer i " +
        "forretningen og et målepunkt, der er aftalt på forhånd. [UDFYLD: eksempel på en " +
        "prioritering/business case, du har drevet.]",
    },
    {
      quote: "… omsætter ny viden til konkrete aktiviteter, driver implementeringen og sikrer, at løsninger bliver taget i brug.",
      answer:
        "Implementering er 20 % teknik og 80 % forankring. Jeg arbejder med superbrugere, " +
        "træning i arbejdsgange frem for værktøjer, og måler på faktisk anvendelse – ikke " +
        "kun på go-live. [UDFYLD: eksempel på en løsning, du har bragt fra idé til daglig " +
        "drift, gerne med tal.]",
    },
    {
      quote: "… erfaring med moderne AI-værktøjer og platforme … herunder opsætning, integration og governance.",
      answer:
        "[UDFYLD: dine konkrete platforme og værktøjer – fx Microsoft 365 Copilot, Copilot " +
        "Studio, Azure OpenAI, Claude/ChatGPT i virksomhedskontekst, automatisering og " +
        "integrationer.] Dette site er min arbejdsprøve: arkitektur, indhold og governance- " +
        "principper er beskrevet åbent længere nede – og kan efterprøves.",
    },
  ],

  /* ------------------------------------------------------------------ */
  /* 100-dages planen.                                                   */
  plan: [
    {
      week: "Uge 1–4",
      title: "Lyt og kortlæg",
      points: [
        "Rundtur i forretningen: projekter, service, produktion, salg og økonomi – hvor gør hverdagen ondt?",
        "Inventar over jeres nuværende AI-brug: kommercielle værktøjer, piloter og skyggebrug.",
        "Overblik over data- og systemlandskabet, herunder Microsoft 365-fundamentet.",
        "Shortlist af use cases scoret på værdi og implementerbarhed – sammen med de mennesker, der ejer processerne.",
      ],
      kpi: "Leverance: prioriteret use case-katalog og et ærligt billede af udgangspunktet.",
    },
    {
      week: "Uge 5–9",
      title: "Bevis værdi",
      points: [
        "2–3 piloter i drift – hver med en ejer i forretningen, en baseline og et aftalt målepunkt.",
        "Governance-fundament i letvægtsudgave: dataregler folk kan huske, leverandørvurdering og adgangsstyring.",
        "Første “AI i praksis”-sessioner: korte, konkrete og forankret i deltagernes egne opgaver.",
      ],
      kpi: "Leverance: målbar effekt i mindst én pilot – fx sparet tid pr. servicerapport eller hurtigere tilbudsproces.",
    },
    {
      week: "Uge 10–14",
      title: "Forankr og skalér",
      points: [
        "Fra pilot til drift: integration, ejerskab, support og løbende måling af anvendelse.",
        "12-måneders roadmap med beslutningsmodel for nye AI-idéer – så prioritering bliver en proces, ikke en kamp.",
        "Superbruger-netværk og kompetenceplan, der gør AI til en del af hverdagen – ikke et projekt ved siden af.",
      ],
      kpi: "Leverance: godkendt roadmap, driftssatte løsninger og en organisation, der ved, hvordan den næste idé bliver vurderet.",
    },
  ],

  /* ------------------------------------------------------------------ */
  /* Agentens vidensbase.                                                */
  /*  - q:        spørgsmålet, som det vises (bl.a. på chips)            */
  /*  - chip:     true => vises som forslag i chatten                    */
  /*  - keywords: ord/fraser der matcher spørgsmålet (små bogstaver;     */
  /*              fraser med mellemrum matcher som helhed og vægter mest)*/
  /*  - a:        svaret. Afsnit adskilles med \n\n, punktlister med "• "*/
  kb: [
    {
      id: "hvorfor-sh",
      q: "Hvorfor SH Group?",
      chip: true,
      keywords: ["hvorfor", "sh group", "shgroup", "motivation", "svendborg", "maritim", "maritime", "tiltrækker", "interesse", "drømmejob"],
      a:
        "Tre ting tiltrækker mig:\n\n" +
        "• I er en maritim vækstvirksomhed med rigtige produkter, rigtige kunder og processer, hvor AI kan mærkes på bundlinjen – ikke kun i slides.\n" +
        "• I er allerede i gang: kommercielle værktøjer og egne piloter. Det er langt mere interessant at accelerere en igangværende rejse end at starte fra nul.\n" +
        "• Rollen sidder i spændingsfeltet mellem teknologi, drift og forretning – præcis der, hvor jeg arbejder bedst.\n\n" +
        "[UDFYLD: din personlige motivation – fx forhold til det maritime, Sydfyn eller virksomhedstypen.]",
    },
    {
      id: "copilot",
      q: "Hvilken erfaring har du med Copilot og Copilot Studio?",
      chip: true,
      keywords: ["copilot", "copilot studio", "microsoft", "m365", "365", "power platform", "azure", "platforme", "værktøjer", "teams"],
      a:
        "Jeg er hands-on med moderne AI-værktøjer i praksis – ikke kun som bruger, men " +
        "som bygger. Jeg udvikler løsninger med AI-assisteret udvikling (bl.a. Claude Code) " +
        "og arbejder dagligt med kommercielle AI-værktøjer.\n\n" +
        "[UDFYLD: din konkrete erfaring med Microsoft 365 Copilot, Copilot Studio og " +
        "tilstødende platforme – fx agenter du har bygget, udrulning i en organisation, " +
        "opsætning, integrationer og governance i tenant'en. Hvis din erfaring her er " +
        "begrænset, så vær ærlig og fremhæv, hvor hurtigt du plejer at lære nye platforme.]\n\n" +
        "Generelt ser jeg Microsoft-økosystemet som det naturlige fundament i en " +
        "organisation som jeres: Det er der, medarbejderne allerede arbejder, og det er " +
        "der, adgangsstyring og datagovernance kan håndhæves centralt. Min tilgang er at " +
        "starte i det eksisterende økosystem og kun bygge specialløsninger, når værdien " +
        "beviseligt kræver det.",
    },
    {
      id: "prioritering",
      q: "Hvordan prioriterer du AI-projekter?",
      chip: true,
      keywords: ["prioriterer", "prioritering", "prioritere", "udvælger", "vælger", "roadmap", "business case", "værdi", "use case", "use cases", "projekter"],
      a:
        "Med to akser og tre benhårde krav.\n\n" +
        "Akserne: forretningsværdi (tid, kvalitet, gennemløb, risiko) og implementerbarhed " +
        "(data, integration, forandringsbyrde). Det giver et kort, alle kan diskutere ud fra – " +
        "også uden teknisk baggrund.\n\n" +
        "Kravene:\n" +
        "• En ejer i forretningen, der vil have løsningen – ikke bare acceptere den.\n" +
        "• En baseline målt før start, så effekten kan dokumenteres.\n" +
        "• En tidshorisont på højst ét kvartal til at vise første værdi.\n\n" +
        "Kan et projekt ikke opfylde de tre krav, er det ikke modent endnu – så ryger det " +
        "tilbage i kataloget, ikke ind i porteføljen.",
    },
    {
      id: "governance",
      q: "Hvad er din tilgang til AI-governance?",
      chip: true,
      keywords: ["governance", "sikkerhed", "gdpr", "compliance", "datasikkerhed", "regler", "retningslinjer", "ansvarlig", "etik", "ai act", "persondata", "risiko"],
      a:
        "Governance skal gøre det trygt at sige ja – ikke nemt at sige nej.\n\n" +
        "• Retningslinjer, folk kan huske: hvilke data må bruges hvor, i ét sprog uden jura-tåge.\n" +
        "• Dataklassifikation før værktøjsvalg: ved alle, hvad der er fortroligt, er resten meget lettere.\n" +
        "• Leverandørvurdering og adgangsstyring centralt – frihed i anvendelsen, kontrol i fundamentet.\n" +
        "• Logning og opfølgning, så vi kan svare på “hvem brugte hvad til hvad” – også når EU AI Act banker på.\n\n" +
        "Dette site er et lille eksempel på princippet: agenten her svarer kun fra godkendt " +
        "indhold, kører lokalt i din browser og sender ingen data nogen steder hen.",
    },
    {
      id: "forankring",
      q: "Hvordan sikrer du, at løsningerne faktisk bliver brugt?",
      chip: true,
      keywords: ["forankring", "adoption", "anvendelse", "taget i brug", "bliver brugt", "forandringsledelse", "kultur", "modstand", "medarbejdere", "træning", "uddannelse"],
      a:
        "Ved at behandle ibrugtagning som hovedleverancen – ikke som eftertanken.\n\n" +
        "• Løsninger designes med de mennesker, der skal bruge dem, fra første uge.\n" +
        "• Træning foregår i folks egne arbejdsgange og med deres egne opgaver – ikke i generiske kurser.\n" +
        "• Superbrugere i hver afdeling, der får tid og mandat til at hjælpe kollegerne.\n" +
        "• Anvendelse måles løbende: bliver løsningen ikke brugt, er det løsningen – ikke brugerne – der skal justeres.\n\n" +
        "Min erfaring er enkel: AI-projekter fejler sjældent på teknik. De fejler, når ingen " +
        "ejer dem i hverdagen.",
    },
    {
      id: "baggrund",
      q: "Hvad er din baggrund?",
      chip: false,
      keywords: ["baggrund", "uddannelse", "cv", "karriere", "erfaring generelt", "teknisk baggrund", "profil", "hvem er du", "fortæl om dig"],
      a:
        "Kort fortalt en teknisk profil, der bygger – ikke kun rådgiver.\n\n" +
        "I dag arbejder jeg i energi- og belysningsbranchen hos green light a/s, hvor jeg " +
        "[UDFYLD: din rolle], og hvor AI-assisteret udvikling er en fast del af mit arbejde: " +
        "Jeg har bl.a. bygget en estimerings- og business case-løsning (ROI & CO₂) og et " +
        "internt tidsregistreringsværktøj.\n\n" +
        "[UDFYLD: 2–3 sætninger om din uddannelse og tidligere karriere – fremhæv det " +
        "tekniske fundament og evt. ledelses-/projekterfaring.]\n\n" +
        "Vil I have hele historien, sender jeg gerne CV og referencer samme dag – skriv til " +
        "mig via kontaktsektionen nederst.",
    },
    {
      id: "resultater",
      q: "Hvilke konkrete resultater har du skabt med AI?",
      chip: true,
      keywords: ["resultater", "effekt", "skabt", "opnået", "eksempler", "konkrete", "leveret", "succeser", "cases", "tal", "gevinster", "besparelser"],
      a:
        "Et par eksempler fra min egen hverdag:\n\n" +
        "• En estimerings- og business case-løsning, der automatisk beregner ROI og CO₂ for " +
        "kunderne – bygget med AI-assisteret udvikling fra idé til fungerende værktøj.\n" +
        "• Et internt tidsregistreringsværktøj, udviklet på samme måde.\n" +
        "• Dette ansøgningssite, inkl. agenten du taler med nu.\n\n" +
        "[UDFYLD: tilføj 1–2 eksempler mere med tal – fx sparet tid, hurtigere tilbud eller " +
        "øget hitrate. Vær præcis og ærlig; det er agentens vigtigste svar.]\n\n" +
        "Fælles for eksemplerne er arbejdsformen: AI accelererer, mennesket styrer – og " +
        "løsningen er bygget til at blive brugt, ikke for at imponere.",
    },
    {
      id: "ai-rejse",
      q: "Hvordan arbejder du selv med AI til daglig?",
      chip: true,
      keywords: ["arbejder du selv", "til daglig", "din egen brug", "hands-on", "bygger", "udvikling", "kode", "selv bruger", "ai-rejse", "rejse", "hvordan bruger du"],
      a:
        "AI er ikke et projekt ved siden af mit arbejde – det er måden, jeg arbejder på.\n\n" +
        "Jeg bruger AI-assisteret udvikling til at gå fra idé til fungerende værktøj på dage " +
        "frem for måneder. Konkret har jeg bygget en business case-løsning (ROI & CO₂), et " +
        "tidsregistreringsværktøj og dette ansøgningssite på den måde.\n\n" +
        "Det giver mig en sjælden kombination i den her rolle: Jeg kan både sætte den " +
        "strategiske retning og selv bygge prototypen, der gør en beslutning konkret. Når " +
        "jeg formidler AI til en organisation, taler jeg derfor ud fra noget, jeg selv har " +
        "bygget – ikke kun læst om.",
    },
    {
      id: "maritimt",
      q: "Hvor kan AI skabe værdi i en virksomhed som SH Group?",
      chip: true,
      keywords: ["maritime use cases", "værdi hos jer", "hvilke muligheder", "hydraulik", "offshore", "service", "skib", "marine", "vores virksomhed", "vores branche", "muligheder", "potentiale", "ideer", "idéer"],
      a:
        "Mine hypoteser udefra – som fase 1 i 100-dages planen netop skal teste:\n\n" +
        "• Teknisk dokumentation og servicerapporter: udkast, opslag og oversættelse, så teknikernes tid bruges på teknik.\n" +
        "• Tilbud og kalkulation: genbrug af viden fra tidligere projekter, hurtigere og mere ensartede tilbud.\n" +
        "• Vidensopslag på tværs: “hvordan løste vi det her sidst?” besvaret på sekunder i stedet for ved at kende den rigtige kollega.\n" +
        "• Kvalitets- og compliance-dokumentation: struktur og førsteudkast, mennesket godkender.\n" +
        "• På sigt: dataunderstøttet vedligehold og service, når datagrundlaget er modent.\n\n" +
        "Men det ærlige svar er: De bedste use cases finder man ikke i et stillingsopslag. " +
        "De findes hos jeres teknikere, projektledere og sælgere – og det er dem, jeg vil " +
        "bruge mine første uger sammen med.",
    },
    {
      id: "hvorfor-ikke-llm",
      q: "Hvorfor er denne agent ikke en “rigtig” LLM?",
      chip: false,
      keywords: ["rigtig llm", "sprogmodel", "ægte ai", "bare en chatbot", "hallucination", "hallucinere", "hallucinationer", "gpt", "kunstig", "snyd", "fake", "hvordan virker du", "hvordan er du bygget"],
      a:
        "Godt spottet – og det er et bevidst valg, ikke en mangel.\n\n" +
        "Agenten svarer udelukkende fra en kurateret vidensbase, jeg selv har skrevet og " +
        "godkendt. I en ansøgning skal I kunne stole på hvert eneste svar, og en generativ " +
        "model uden kontrol kunne finde på at love ting på mine vegne. Det ville være dårlig " +
        "governance – i en ansøgning som i en virksomhed.\n\n" +
        "Arkitekturen er forberedt til at koble en hostet sprogmodel på bag adgangsstyring " +
        "og logging. Det er præcis den rækkefølge, jeg anbefaler i praksis: start med " +
        "kontrol over indholdet, og udvid med generativ AI dér, hvor rammerne er på plads.",
    },
    {
      id: "risici",
      q: "Hvad er de største risici ved AI-projekter?",
      chip: false,
      keywords: ["risici", "risiko", "faldgruber", "fejler", "går galt", "udfordringer", "barrierer", "pilot", "piloter", "skygge-ai", "shadow"],
      a:
        "De fire, jeg oftest ser – og mine modtræk:\n\n" +
        "• Pilot-kirkegården: alt forbliver eksperiment. Modtræk: ejer, baseline og målepunkt før start – og en plan for drift fra dag ét.\n" +
        "• Manglende ejerskab: IT ejer løsningen, forretningen kigger på. Modtræk: ingen pilot uden en forretningsejer, der vil have den.\n" +
        "• Urealistiske forventninger: AI sælges som magi og skuffer som software. Modtræk: ærlig formidling af, hvad teknologien kan i dag – og hvad den ikke kan.\n" +
        "• Skygge-AI: medarbejdere bruger private værktøjer uden rammer. Modtræk: giv gode, godkendte alternativer hurtigt – forbud uden alternativ virker aldrig.",
    },
    {
      id: "ledelse",
      q: "Hvordan leder du – og hvem skal du samarbejde med?",
      chip: false,
      keywords: ["leder", "ledelse", "ledelsesstil", "samarbejde", "stakeholder", "interessenter", "direktion", "organisation", "team", "tværfaglig"],
      a:
        "Rollen her kræver ledelse gennem indflydelse mere end gennem instruks: Resultaterne " +
        "skabes sammen med afdelinger, jeg ikke er chef for. Det trives jeg med.\n\n" +
        "Min stil er tydelig retning, korte feedback-loops og synlige resultater – og så er " +
        "jeg selv hands-on nok til at bygge prototypen, når det er den hurtigste vej til en " +
        "beslutning.\n\n" +
        "[UDFYLD: din konkrete ledelseserfaring – fx personaleansvar, projektledelse eller " +
        "tværgående roller.]",
    },
    {
      id: "vaerdi-maaling",
      q: "Hvordan måler du værdien af AI?",
      chip: false,
      keywords: ["måler", "måling", "værdi måling", "kpi", "roi", "effektmåling", "målbar", "dokumentere effekt", "gevinst"],
      a:
        "Reglen er: baseline før, måling efter – ellers er “værdi” bare en fornemmelse.\n\n" +
        "• Hård værdi: sparet tid pr. opgave, kortere gennemløbstid, færre fejl, hurtigere svartider.\n" +
        "• Blød værdi: medarbejdertilfredshed, oplevet kvalitet, mindre frustration ved rutineopgaver – målt simpelt, fx med tre spørgsmål før og efter.\n" +
        "• Anvendelse: hvor mange bruger løsningen ugentligt? Lav anvendelse æder al anden værdi.\n\n" +
        "Og så rapporterer jeg ærligt: Også de piloter, der ikke leverede, skal frem i lyset " +
        "– det er dem, organisationen lærer hurtigst af.",
    },
    {
      id: "opdateret",
      q: "Hvordan holder du dig opdateret på AI-udviklingen?",
      chip: false,
      keywords: ["opdateret", "følger med", "udviklingen", "nyheder", "trends", "ny viden", "nyt inden for", "læring"],
      a:
        "Struktureret og hands-on:\n\n" +
        "• Faste, udvalgte kilder frem for støj – og et netværk af praktikere, der deler, hvad der faktisk virker.\n" +
        "• Jeg tester selv nye værktøjer og modeller, før jeg anbefaler dem. Dette site er et eksempel på den vane.\n" +
        "• Vigtigst: Jeg oversætter altid “nyt” til “relevant for os?” – det meste af udviklingen kræver ingen handling, men det, der gør, skal fanges tidligt.\n\n" +
        "Opslagets formulering “ikke metode for metodens skyld” kunne også have stået over " +
        "mit skrivebord: Ny teknologi er kun interessant, når den kan blive til værdi hos jer.",
    },
    {
      id: "loen",
      q: "Hvad er dine lønforventninger?",
      chip: false,
      keywords: ["løn", "lønforventninger", "gage", "honorar", "betaling", "vilkår", "opsigelse", "opstart", "tiltrædelse", "starte", "ferie"],
      a:
        "Det tager vi i en rigtig samtale – løn og vilkår fortjener mennesker, ikke en agent.\n\n" +
        "Jeg kan love en hurtig og ærlig forventningsafstemning, og min opstartsdato kan vi " +
        "også afklare der. Brug kontaktsektionen nederst, så finder vi et tidspunkt.",
    },
    {
      id: "ordbog",
      q: "Hvad er forskellen på chatbots, copilots og agenter?",
      chip: false,
      keywords: ["forskel", "chatbot", "chatbots", "agent", "agenter", "forklar", "betyder", "rag", "llm", "prompt", "begreber", "hvad er en"],
      a:
        "Den korte version, som jeg ville forklare den på et afdelingsmøde:\n\n" +
        "• En chatbot svarer på spørgsmål – som den her, I taler med nu.\n" +
        "• En copilot hjælper dig i dit eget værktøj, mens du arbejder – fx udkast til en mail i Outlook eller et resumé i Teams.\n" +
        "• En agent kan selv udføre flertrins-opgaver inden for aftalte rammer – fx finde data, udfylde et udkast og lægge det klar til godkendelse.\n\n" +
        "Tommelfingerreglen: Jo mere selvstændighed, desto vigtigere bliver rammerne. Derfor " +
        "hænger agent-strategi og governance uløseligt sammen.",
    },
    {
      id: "cv",
      q: "Kan jeg se dit CV?",
      chip: false,
      keywords: ["cv", "referencer", "dokumentation", "ansøgning pdf", "bilag", "papirer", "eksamensbeviser"],
      a:
        "Selvfølgelig. Skriv eller ring via kontaktsektionen nederst, så sender jeg CV og " +
        "referencer samme dag.\n\n" +
        "Dette site er bevidst et supplement til – ikke en erstatning for – den klassiske " +
        "dokumentation.",
    },
    {
      id: "site-bygget",
      q: "Hvordan har du bygget dette site?",
      chip: false,
      keywords: ["bygget dette site", "lavet dette site", "lavet siden", "bygget siden", "website", "hjemmeside", "teknologi bag", "stack", "kode", "claude", "ai-assisteret"],
      a:
        "Med AI-assisteret udvikling og mig som arkitekt og ansvarlig redaktør – fra idé til " +
        "færdigt site på under en dag.\n\n" +
        "Teknisk er det bevidst enkelt: statisk HTML, CSS og JavaScript uden eksterne " +
        "afhængigheder, ingen cookies, ingen tracking, og agenten kører udelukkende i din " +
        "browser. AI accelererede kode, struktur og sparring; alt indhold er menneskeligt " +
        "kvalitetssikret.\n\n" +
        "Pointen er arbejdsformen: AI som accelerator, mennesket som ansvarlig. Det er den " +
        "form, jeg vil udbrede hos SH Group.",
    },
  ],

  /* ------------------------------------------------------------------ */
  greeting:
    "Hej! Jeg er ansøgnings-agenten. Jeg svarer på spørgsmål om kandidatens erfaring, " +
    "tilgang og motivation – baseret på en kurateret vidensbase. Prøv et af forslagene " +
    "nedenfor, eller stil dit eget spørgsmål.",

  fallback:
    "Det har jeg ikke et forberedt svar på – og jeg gætter ikke på kandidatens vegne. Det " +
    "er en del af mit design: Jeg svarer kun på det, der står i min godkendte vidensbase.\n\n" +
    "Prøv et af forslagene nedenfor, eller stil spørgsmålet direkte i en samtale – " +
    "kontaktoplysningerne står nederst på siden.",
};
