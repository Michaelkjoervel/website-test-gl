"""Dummy-motor til lokal udvikling og test uden ekstern API."""
from __future__ import annotations

from pathlib import Path

from .base import Segment, TranscriptionEngine, TranscriptionResult


class DummyEngine(TranscriptionEngine):
    name = "dummy"

    def transcribe(self, audio_path: Path, language: str = "da") -> TranscriptionResult:
        text = (
            f"[dummy-transskribering af {audio_path.name}]\n"
            "Dette er en lokal test uden ekstern API. Sæt TRANSCRIPTION_ENGINE=openai og en OPENAI_API_KEY "
            "for at få rigtig dansk transskribering."
        )
        return TranscriptionResult(
            text=text,
            segments=[Segment(start_seconds=0.0, end_seconds=5.0, text=text)],
        )
