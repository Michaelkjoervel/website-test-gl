/* ============================================================================
   Cloudflare Worker — proxy mellem ansøgningssitet og Claude.

   Hvorfor: API-nøglen skal ALDRIG ligge i frontend-koden. Den bor som en
   secret her på serveren. Frontend sender kun {useCaseId, input}; systemprompten
   er fast og afgrænset pr. use case, så endpointet ikke kan misbruges som en
   generel gratis-LLM.

   Deploy: se README.md i denne mappe.
   ============================================================================ */

// Systemprompterne SKAL matche dem i ../content.js (aiDemo.presets).
const USE_CASES = {
  servicerapport: {
    system:
      "Du er SH Groups interne assistent, der hjælper teknikere med at skrive " +
      "professionelle servicerapporter på dansk. Ud fra teknikerens stikord " +
      "skriver du et struktureret udkast med afsnittene: Udført arbejde, " +
      "Observationer, Anbefalinger og Næste skridt. Vær konkret og faglig. " +
      "Opfind aldrig oplysninger, der ikke fremgår af stikordene – marker i " +
      "stedet manglende info med [ ... ]. Afslut med en kort note om, at en " +
      "tekniker skal gennemlæse og godkende rapporten før afsendelse.",
  },
  kundesvar: {
    system:
      "Du er SH Groups interne assistent, der hjælper med at skrive " +
      "professionelle, imødekommende kundesvar og tilbudsudkast på dansk. Ud " +
      "fra noterne skriver du et klart, høfligt udkast med passende struktur: " +
      "indledning, svar/indhold, næste skridt og en venlig afslutning. Opfind " +
      "aldrig priser, datoer eller tekniske detaljer, der ikke står i noterne – " +
      "marker manglende info med [ ... ]. Afslut med en kort note om, at en " +
      "medarbejder skal gennemlæse udkastet før afsendelse.",
  },
};

const DEFAULT_MODEL = "claude-opus-4-8"; // skift evt. til "claude-haiku-4-5" via MODEL-variablen
const MAX_INPUT = 4000;

// Stram "Allow-Origin" til din rigtige URL i produktion, fx
// "https://dit-site.netlify.app", så kun dit site kan kalde endpointet.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "Ugyldig JSON" }, 400);
    }

    const useCase = USE_CASES[body && body.useCaseId];
    const input = ((body && body.input) || "").toString();

    if (!useCase) return json({ error: "Ukendt use case" }, 400);
    if (!input.trim()) return json({ error: "Tom input" }, 400);
    if (input.length > MAX_INPUT) return json({ error: "Input er for langt" }, 413);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "API-nøgle mangler på serveren" }, 500);

    let r, data;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: env.MODEL || DEFAULT_MODEL,
          max_tokens: 1500,
          system: useCase.system,
          messages: [{ role: "user", content: input }],
        }),
      });
      data = await r.json();
    } catch (e) {
      return json({ error: "Kunne ikke nå Anthropic" }, 502);
    }

    if (!r.ok) {
      return json({ error: (data && data.error && data.error.message) || ("Anthropic-fejl " + r.status) }, 502);
    }
    if (data.stop_reason === "refusal") {
      return json({ error: "Modellen afviste forespørgslen." });
    }
    const textBlock = (data.content || []).find(function (b) { return b.type === "text"; });
    return json({ text: textBlock ? textBlock.text : "(tomt svar)" });
  },
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json" }, CORS),
  });
}
