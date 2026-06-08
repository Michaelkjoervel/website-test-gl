"""OpenAI Whisper API som transskriberingsmotor."""
from __future__ import annotations

import time
from pathlib import Path

from ...config import settings
from .base import Segment, TranscriptionEngine, TranscriptionResult


class OpenAIError(RuntimeError):
    pass


class RateLimitError(OpenAIError):
    pass


class OpenAIWhisperEngine(TranscriptionEngine):
    name = "openai-whisper"

    def __init__(self) -> None:
        if not settings.openai_api_key:
            # Vi rejser ikke her — først ved første kald, så systemet kan starte uden nøgle.
            self._client = None
        else:
            from openai import OpenAI

            self._client = OpenAI(api_key=settings.openai_api_key)

    def _ensure_client(self):
        if self._client is None:
            raise OpenAIError(
                "OPENAI_API_KEY mangler. Tilføj den i .env for at bruge OpenAI Whisper."
            )
        return self._client

    def transcribe(self, audio_path: Path, language: str = "da") -> TranscriptionResult:
        client = self._ensure_client()
        from openai import APIError, RateLimitError as OpenRateLimit  # type: ignore

        max_attempts = 3
        backoff = 4.0
        last_error: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                with audio_path.open("rb") as fh:
                    response = client.audio.transcriptions.create(
                        model=settings.openai_transcription_model,
                        file=fh,
                        language=language,
                        response_format="verbose_json",
                        prompt=(
                            "Transskribér til dansk. Brug danske bogstaver æ, ø og å. "
                            "Indsæt naturlig tegnsætning. Bevar navne og fagudtryk præcist. "
                            "Marker utydelige passager som [utydeligt]."
                        ),
                    )
                segments_data = getattr(response, "segments", None) or []
                segments = [
                    Segment(
                        start_seconds=float(s.get("start", 0.0)),
                        end_seconds=float(s.get("end", 0.0)),
                        text=str(s.get("text", "")).strip(),
                    )
                    for s in segments_data
                ]
                text = (getattr(response, "text", "") or "").strip()
                return TranscriptionResult(text=text, segments=segments)
            except OpenRateLimit as exc:  # type: ignore
                last_error = exc
                if attempt < max_attempts:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                raise RateLimitError(f"OpenAI rate limit: {exc}") from exc
            except APIError as exc:  # type: ignore
                last_error = exc
                if attempt < max_attempts and getattr(exc, "status_code", 500) >= 500:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                raise OpenAIError(f"OpenAI API-fejl: {exc}") from exc
            except Exception as exc:
                last_error = exc
                if attempt < max_attempts:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                raise OpenAIError(f"Transskribering fejlede: {exc}") from exc
        raise OpenAIError(f"Transskribering fejlede efter {max_attempts} forsøg: {last_error}")
