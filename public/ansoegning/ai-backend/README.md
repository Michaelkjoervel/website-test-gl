# Live AI-demo — backend (Cloudflare Worker)

Denne lille Worker står mellem ansøgningssitet og Claude, så **din API-nøgle aldrig
ligger i frontend-koden**. Frontend sender kun `{useCaseId, input}`; Worker'en
holder nøglen som en secret, vælger den faste systemprompt for use casen og kalder
Claude. Det er den governance-rigtige måde at bygge en offentlig AI-funktion på.

```
Browser  ──{useCaseId, input}──▶  Worker (har nøglen)  ──▶  Claude API
   ▲                                                          │
   └──────────────── færdigt udkast ◀────────────────────────┘
```

## Du skal bruge

- En Anthropic API-nøgle (platform.claude.com → API keys)
- En (gratis) Cloudflare-konto
- Node.js installeret

## Deploy på 5 minutter

```bash
# 1. Installer Cloudflares CLI og log ind
npm install -g wrangler
wrangler login

# 2. I denne mappe (ai-backend/) – opret en wrangler.toml:
cat > wrangler.toml <<'TOML'
name = "ansoegning-ai"
main = "worker.js"
compatibility_date = "2024-11-01"
TOML

# 3. Læg din API-nøgle ind som en secret (gemmes hos Cloudflare, ikke i koden)
wrangler secret put ANTHROPIC_API_KEY
#   → indsæt din nøgle, når den spørger

# 4. (valgfrit) vælg en billigere/hurtigere model end standard (claude-opus-4-8)
#    wrangler secret put MODEL    →  fx: claude-haiku-4-5

# 5. Deploy
wrangler deploy
```

Til sidst printer `wrangler deploy` en URL i stil med
`https://ansoegning-ai.<dit-subdomæne>.workers.dev`.

**Kopiér den URL ind i `../content.js`:**

```js
aiDemo: {
  ...
  endpoint: "https://ansoegning-ai.<dit-subdomæne>.workers.dev",
  ...
}
```

Genbyg/redeploy sitet — nu er demoen live.

## Test lokalt først (uden at deploye)

```bash
wrangler dev        # kører Worker'en på http://localhost:8787
```

Sæt midlertidigt `aiDemo.endpoint` til `http://localhost:8787` og åbn sitet lokalt.

## Vælg model: pris vs. kvalitet

Demoen rammer en offentlig URL, som SH Group selv prøver. Standardmodellen er
`claude-opus-4-8` (skarpest, men dyrest). For en offentlig demo er
**`claude-haiku-4-5`** ofte et bedre valg: markant billigere og hurtigere, og rigeligt
til at omsætte stikord til et udkast. Skift via `MODEL`-secret'en (trin 4).

Cirka-priser pr. 1 mio. tokens (input/output): Opus 4.8 ≈ $5/$25 · Haiku 4.5 ≈ $1/$5.
Et typisk udkast bruger nogle få tusinde tokens, så det koster ører pr. kald.

## Et par skarpe kanter til produktion

- **Lås CORS:** I `worker.js` er `Access-Control-Allow-Origin` sat til `*`. Skift den
  til din rigtige URL (fx din Netlify-adresse), så kun dit site kan bruge endpointet.
- **Rate limiting:** Vil du undgå misbrug, kan du slå Cloudflares
  [Rate Limiting](https://developers.cloudflare.com/workers/) til på Worker-ruten.
- **Afgrænsning:** Worker'en accepterer kun de to kendte use cases og en maks.
  inputlængde – den kan altså ikke laves om til en gratis, generel chatbot.
