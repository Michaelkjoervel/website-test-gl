# Live AI-demo — backend (Cloudflare Worker)

Denne lille Worker står mellem ansøgningssitet og Claude, så **din API-nøgle aldrig
ligger i frontend-koden**. Frontend sender kun `{useCaseId, input}`; Worker'en
holder nøglen som en secret, vælger den faste systemprompt for use casen, håndhæver
en fair-use-grænse og kalder Claude.

```
Browser  ──{useCaseId, input}──▶  Worker (nøgle + grænse)  ──▶  Claude API
   ▲                                                            │
   └──────────────── færdigt udkast ◀──────────────────────────┘
```

**Standardmodel:** `claude-haiku-4-5` (hurtig og billig – velegnet til en offentlig demo).
**Fair-use-grænse:** som standard 10 kald pr. besøgende pr. dag + 500 kald samlet pr. dag.

## Du skal bruge

- En Anthropic API-nøgle (platform.claude.com → API keys)
- En (gratis) Cloudflare-konto
- Node.js installeret

## Deploy på ~5 minutter

```bash
# 1. Installer Cloudflares CLI og log ind
npm install -g wrangler
wrangler login

# 2. Opret et KV-namespace til fair-use-tællerne (printer et id, du skal bruge)
wrangler kv namespace create RATE_KV
#   (ældre wrangler: wrangler kv:namespace create RATE_KV)

# 3. Opret wrangler.toml i denne mappe – indsæt KV-id'et fra trin 2:
cat > wrangler.toml <<'TOML'
name = "ansoegning-ai"
main = "worker.js"
compatibility_date = "2024-11-01"

[[kv_namespaces]]
binding = "RATE_KV"
id = "INDSÆT-KV-ID-HER"

# Valgfrit – standardværdier vist. Fjern # for at ændre.
# [vars]
# MODEL = "claude-opus-4-8"   # standard er claude-haiku-4-5
# PER_IP_DAILY = "10"
# GLOBAL_DAILY = "500"
TOML

# 4. Læg din API-nøgle ind som en secret (gemmes hos Cloudflare, ikke i koden)
wrangler secret put ANTHROPIC_API_KEY
#   → indsæt din nøgle, når den spørger

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

## Fair-use-grænsen

Worker'en tæller kald i KV-namespacet `RATE_KV` og afviser med en venlig besked (HTTP 429),
når en grænse er nået:

| Variabel | Standard | Betydning |
|----------|----------|-----------|
| `PER_IP_DAILY` | `10` | Maks. kald pr. besøgende (IP) pr. dag |
| `GLOBAL_DAILY` | `500` | Samlet loft pr. dag – binder den maksimale omkostning |

Justér ved at fjerne `#` ud for `[vars]` i `wrangler.toml` og sætte dine egne tal
(redeploy bagefter). Detaljer:

- Kun **gennemførte** kald tælles – afviste/fejlede forespørgsler æder ikke kvoten.
- Tællerne nulstilles automatisk hvert døgn (KV-TTL).
- KV er pr. datacenter og "eventually consistent", så tallene er omtrentlige – rigeligt
  til at forhindre misbrug, men ikke en hård transaktionsgrænse.
- Uden et `RATE_KV`-namespace kører Worker'en stadig, men **uden** grænse. Opret det
  (trin 2), så grænsen er aktiv.

## Vælg model: pris vs. kvalitet

Standard er **`claude-haiku-4-5`** – billig og hurtig, og rigeligt til at omsætte
stikord til et udkast. Vil du have skarpere svar, så sæt `MODEL = "claude-opus-4-8"`
under `[vars]` i `wrangler.toml`.

Cirka-priser pr. 1 mio. tokens (input/output): Haiku 4.5 ≈ $1/$5 · Opus 4.8 ≈ $5/$25.
Et typisk udkast bruger nogle få tusinde tokens, så et kald koster ører – og med
fair-use-grænsen er den samlede dagsomkostning bundet.

## En sidste skarp kant til produktion

- **Lås CORS:** I `worker.js` er `Access-Control-Allow-Origin` sat til `*`. Skift den
  til din rigtige URL (fx din Netlify-adresse), så kun dit site kan bruge endpointet.
- **Afgrænsning:** Worker'en accepterer kun de to kendte use cases og en maks.
  inputlængde – den kan altså ikke laves om til en gratis, generel chatbot.
