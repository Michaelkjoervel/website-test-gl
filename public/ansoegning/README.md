# Ansøgningssite · Head of AI Transformation · SH Group A/S

Et selvstændigt, 100 % statisk ansøgningssite med en indbygget "ansøgnings-agent",
som rekrutteringsteamet kan interviewe. Ingen build-step, ingen eksterne
afhængigheder, ingen tracking.

## Filerne

| Fil          | Indhold                                                        |
|--------------|----------------------------------------------------------------|
| `content.js` | **Alt indhold**: dine oplysninger, svar i agentens vidensbase, 100-dages plan. Det eneste sted, du skal redigere. |
| `index.html` | Sidens struktur og faste tekster                               |
| `styles.css` | Design                                                         |
| `app.js`     | Agent-motor og rendering (skal normalt ikke ændres)            |

## Før du sender den

1. Åbn `content.js` og udskift **alle** `[UDFYLD: …]`-markeringer med dine egne
   oplysninger. Søg efter `UDFYLD` for at finde dem alle.
2. Læs hvert eneste svar i vidensbasen igennem – agenten må kun sige ting, du
   selv kan stå inde for til en samtale.
3. Sæt `meta.draft = false` i `content.js`.
   (Det gule kladde-banner vises automatisk, så længe `draft` er `true`
   *eller* der stadig findes `[UDFYLD …]`-markeringer.)

## Se sitet lokalt

Fra repo-roden:

```bash
npm run dev
# åbn http://localhost:5173/ansoegning/
```

Eller åbn `index.html` direkte i en browser – sitet kræver ingen server.

## Deployment

Mappen er flytbar: kopiér `public/ansoegning/` hvorhen du vil.

- **Eget GitHub Pages-repo (anbefalet):** Læg de fire filer i et nyt, privat
  repo med Pages slået til. Så blander ansøgningen sig ikke med firmaets site,
  og du kan give SH Group en ren URL (evt. på eget domæne).
- **Netlify/Vercel:** Træk mappen ind i Netlify Drop – færdig på et minut.

Siden er markeret `noindex, nofollow`, så søgemaskiner ikke indekserer den.

## Vil du koble en rigtig LLM på senere?

Agenten er bevidst deterministisk (kurateret vidensbase = ingen hallucinationer
i en ansøgningskontekst – det er en pointe over for SH Group, se governance-
sektionen på sitet). Vil du alligevel have generative svar, er snittet enkelt:
erstat `findAnswer()` i `app.js` med et `fetch`-kald til en lille serverless
funktion (Cloudflare Worker / Azure Function), der holder din API-nøgle og
kalder modellen med vidensbasen som kontekst. Læg aldrig API-nøglen i
frontend-koden.

## Anbefalet brug i ansøgningen

Sitet er et **supplement**, ikke en erstatning: Send en kort, klassisk
ansøgning (½–1 side) + CV via deres normale kanal, og brug sitet som det
centrale link i ansøgningen, fx:

> "Frem for kun at beskrive, hvordan jeg arbejder med AI, har jeg bygget et
> lille eksempel: [link]. Her kan I bl.a. interviewe min ansøgnings-agent og
> se min plan for de første 100 dage."
