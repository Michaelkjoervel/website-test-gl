"""Generér resumé-dokumenter fra en transskribering via OpenAI Chat."""
from __future__ import annotations

import time
from typing import Literal

from ..config import settings

DocumentType = Literal["executive_summary", "minutes", "next_steps", "followup"]

DOCUMENT_LABELS: dict[str, str] = {
    "executive_summary": "Executive summary",
    "minutes": "Referat",
    "next_steps": "Næste skridt",
    "followup": "Opfølgning",
}

DOCUMENT_DESCRIPTIONS: dict[str, str] = {
    "executive_summary": "Kort overblik til ledelsen — de vigtigste pointer, beslutninger og konklusioner.",
    "minutes": "Struktureret referat med emner, diskussioner og beslutninger.",
    "next_steps": "Liste over konkrete aftaler: hvad skal gøres, af hvem, og hvornår.",
    "followup": "Opfølgningsplan med åbne spørgsmål, uafklarede punkter og næste trin.",
}

_SYSTEM_PROMPTS: dict[str, str] = {
    "executive_summary": """Du er en professionel referent. Skriv et kort, præcist executive summary på dansk baseret på en transskribering.

Krav:
- Maks. 250 ord.
- Professionelt, ledelsesegnet sprog.
- Inkluder kun de vigtigste pointer, beslutninger og konklusioner.
- Opfind aldrig information. Hvis noget er uklart i transskriptionen, så udelad det.
- Bevar navne, tal og fagudtryk præcist som de fremgår.
- Output skal være på dansk, i flydende prosa.

Format:
- Start med en kort overskriftslinje (én sætning) der beskriver mødets eller optagelsens emne.
- Derefter 2-4 korte afsnit med de vigtigste pointer.
- Brug ikke punktopstilling og ikke markdown-syntaks.""",

    "minutes": """Du er en professionel referent. Skriv et detaljeret referat på dansk baseret på en transskribering af et møde eller en samtale.

Krav:
- Strukturér efter emner eller dagsordenspunkter, hvis de fremgår.
- Inkluder vigtige diskussionspunkter, beslutninger og åbne spørgsmål.
- Hvis det fremgår tydeligt, så notér hvem der sagde hvad. Brug betegnelser som "Taler 1" hvis navne ikke er nævnt.
- Opfind aldrig information. Marker uklare passager som [uklart].
- Bevar navne, tal, datoer og fagudtryk præcist.
- Skriv i et neutralt, professionelt sprog. Output skal være på dansk.

Format:
- Brug en emneoverskrift på egen linje for hvert emne (uden markdown — bare ren tekst på egen linje).
- Brug bindestreger til punktopstilling under hver overskrift.
- Fremhæv beslutninger som "Beslutning: ...".""",

    "next_steps": """Du er en professionel referent. Udtræk aftalte handlinger og næste skridt fra en transskribering på dansk.

Krav:
- Lav en liste over alle konkrete aftaler, opgaver og næste skridt.
- For hver opgave skal du notere: hvad skal gøres, hvem gør det (hvis nævnt), og hvornår (hvis nævnt).
- Opfind aldrig opgaver, deadlines eller ansvarlige.
- Hvis ingen ansvarlig eller deadline blev nævnt, så skriv "ikke angivet".
- Output skal være på dansk.

Format:
- Brug bindestreger til punktopstilling.
- For hver opgave: tre linjer i formatet
  - Opgave: [hvad]
    Ansvarlig: [hvem eller "ikke angivet"]
    Frist: [hvornår eller "ikke angivet"]
- Hvis der ikke blev aftalt nogen konkrete handlinger, så skriv "Der blev ikke aftalt konkrete handlinger."
""",

    "followup": """Du er en professionel referent. Lav en opfølgningsplan på dansk baseret på en transskribering.

Krav:
- Identificér hvilke punkter der skal følges op på.
- Inkluder åbne spørgsmål, uafklarede beslutninger og emner der skal genoptages senere.
- Opfind aldrig punkter. Hvis ingen punkter i en kategori, så udelad kategorien.
- Output skal være på dansk.

Format:
- Brug en overskrift på egen linje (uden markdown) for hver kategori, fx "Åbne spørgsmål", "Uafklarede beslutninger", "Næste møde", "Personer at kontakte".
- Brug bindestreger til punktopstilling under hver overskrift.""",
}


class SummaryError(RuntimeError):
    pass


def generate_document(text: str, doc_type: str) -> str:
    """Send transskribering til OpenAI Chat og få det ønskede dokument tilbage."""
    if doc_type not in _SYSTEM_PROMPTS:
        raise SummaryError("Ukendt dokumenttype.")
    if not text or not text.strip():
        raise SummaryError("Der er ingen tekst at generere ud fra.")
    if not settings.openai_api_key:
        raise SummaryError("OPENAI_API_KEY mangler. Tilføj den i .env for at kunne generere dokumenter.")

    from openai import APIError, OpenAI, RateLimitError  # type: ignore

    client = OpenAI(api_key=settings.openai_api_key)
    system = _SYSTEM_PROMPTS[doc_type]
    user = f"Her er transskriberingen:\n\n{text.strip()}"

    backoff = 4.0
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            response = client.chat.completions.create(
                model=settings.summary_model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.3,
            )
            content = (response.choices[0].message.content or "").strip()
            if not content:
                raise SummaryError("Modellen returnerede et tomt svar. Prøv igen.")
            return content
        except RateLimitError as exc:  # type: ignore
            last_error = exc
            if attempt < 3:
                time.sleep(backoff)
                backoff *= 2
                continue
            raise SummaryError(f"OpenAI har midlertidig kødannelse. Prøv igen om lidt.") from exc
        except APIError as exc:  # type: ignore
            last_error = exc
            status = getattr(exc, "status_code", 500)
            if attempt < 3 and status >= 500:
                time.sleep(backoff)
                backoff *= 2
                continue
            raise SummaryError(f"OpenAI API-fejl: {exc}") from exc
        except Exception as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(backoff)
                backoff *= 2
                continue
            raise SummaryError(f"Genereringen fejlede: {exc}") from exc

    raise SummaryError(f"Genereringen fejlede efter flere forsøg: {last_error}")
