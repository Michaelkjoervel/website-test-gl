"""Fælles interface til transskriberingsmotorer. Skift af motor må ikke kræve ændringer i resten af systemet."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


@dataclass
class Segment:
    start_seconds: float
    end_seconds: float
    text: str
    speaker: Optional[str] = None


@dataclass
class TranscriptionResult:
    text: str
    segments: List[Segment] = field(default_factory=list)


class TranscriptionEngine(ABC):
    name: str = "abstract"

    @abstractmethod
    def transcribe(self, audio_path: Path, language: str = "da") -> TranscriptionResult:
        """Transskribér én lydfil. Skal være thread-safe."""

    @property
    def supports_speakers(self) -> bool:
        return False
