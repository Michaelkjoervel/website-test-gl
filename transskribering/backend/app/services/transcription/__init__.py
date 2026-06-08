from ...config import settings
from .base import TranscriptionEngine, TranscriptionResult
from .dummy_engine import DummyEngine
from .openai_engine import OpenAIWhisperEngine


def get_engine() -> TranscriptionEngine:
    """Vælg transskriberingsmotor ud fra konfiguration. Tilføj nye motorer her."""
    if settings.transcription_engine == "dummy":
        return DummyEngine()
    return OpenAIWhisperEngine()


__all__ = ["TranscriptionEngine", "TranscriptionResult", "get_engine"]
