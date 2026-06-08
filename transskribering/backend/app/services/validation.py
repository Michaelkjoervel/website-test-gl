"""Filvalidering: størrelse, filtype og MIME-kontrol."""
from __future__ import annotations

import re
from pathlib import Path

from ..config import settings

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".mpeg", ".mpga", ".webm", ".aac", ".ogg", ".oga"}

ALLOWED_MIME_PREFIXES = ("audio/", "video/")

# Magic bytes for de mest almindelige formater. Bruges til reel MIME-kontrol.
_MAGIC_SIGNATURES: list[tuple[bytes, int]] = [
    (b"ID3", 0),
    (b"\xff\xfb", 0),  # MPEG audio frame
    (b"\xff\xf3", 0),
    (b"\xff\xf2", 0),
    (b"RIFF", 0),
    (b"OggS", 0),
    (b"fLaC", 0),
    (b"ftyp", 4),  # mp4/m4a (offset 4)
    (b"\x1aE\xdf\xa3", 0),  # webm/matroska
    (b"\xff\xf1", 0),  # AAC ADTS
]


class ValidationError(ValueError):
    pass


SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(name: str) -> str:
    base = Path(name).name
    cleaned = SAFE_NAME_RE.sub("_", base).strip("._") or "lydfil"
    if len(cleaned) > 120:
        cleaned = cleaned[-120:]
    return cleaned


def check_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError("Filtypen understøttes ikke.")
    return ext


def check_size(file_size_bytes: int) -> None:
    if file_size_bytes <= 0:
        raise ValidationError("Filen kunne ikke læses. Prøv en anden fil.")
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if file_size_bytes > max_bytes:
        raise ValidationError(
            f"Filen er for stor. Maksimal størrelse er {settings.max_upload_size_mb} MB."
        )


def check_duration(duration_seconds: float) -> None:
    if duration_seconds <= 0:
        raise ValidationError("Filen kunne ikke læses. Prøv en anden fil.")
    if duration_seconds > settings.max_audio_duration_seconds:
        max_h = settings.max_audio_duration_seconds // 3600
        raise ValidationError(f"Lydoptagelsen må maksimalt være {max_h} timer.")


def verify_magic_bytes(file_path: Path) -> None:
    """Læs første få bytes og bekræft at filen ligner en lyd-/videofil."""
    try:
        with file_path.open("rb") as fh:
            head = fh.read(32)
    except OSError as exc:
        raise ValidationError("Filen kunne ikke læses. Prøv en anden fil.") from exc

    for signature, offset in _MAGIC_SIGNATURES:
        if head[offset : offset + len(signature)] == signature:
            return
    raise ValidationError("Filen kunne ikke læses. Prøv en anden fil.")
