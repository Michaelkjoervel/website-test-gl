"""Lydbehandling med FFmpeg: probe, konvertering og opdeling."""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List

from ..config import settings


class FFmpegError(RuntimeError):
    pass


def _require_tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise FFmpegError(
            f"{name} blev ikke fundet i PATH. Installér ffmpeg for at kunne behandle lydfiler."
        )
    return path


@dataclass
class AudioInfo:
    duration_seconds: float
    has_audio: bool
    codec: str | None
    sample_rate: int | None
    container: str | None


def probe(file_path: Path) -> AudioInfo:
    """Kør ffprobe og returnér metadata om filen."""
    ffprobe = _require_tool("ffprobe")
    cmd = [
        ffprobe,
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(file_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise FFmpegError(f"ffprobe fejlede: {result.stderr.strip()}")

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise FFmpegError(f"Kunne ikke læse ffprobe-output: {exc}") from exc

    streams = data.get("streams", [])
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    fmt = data.get("format", {})

    duration = 0.0
    try:
        duration = float(fmt.get("duration", 0.0))
    except (TypeError, ValueError):
        duration = 0.0

    if duration <= 0 and audio_streams:
        try:
            duration = float(audio_streams[0].get("duration", 0.0))
        except (TypeError, ValueError):
            duration = 0.0

    return AudioInfo(
        duration_seconds=duration,
        has_audio=bool(audio_streams),
        codec=audio_streams[0].get("codec_name") if audio_streams else None,
        sample_rate=int(audio_streams[0].get("sample_rate")) if audio_streams and audio_streams[0].get("sample_rate") else None,
        container=fmt.get("format_name"),
    )


def convert_to_transcription_format(input_path: Path, output_path: Path) -> Path:
    """Konverter til mono 16 kHz MP3 — robust og lille filstørrelse til transskribering."""
    ffmpeg = _require_tool("ffmpeg")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        "-f",
        "mp3",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise FFmpegError(f"Konvertering fejlede: {result.stderr.strip()[-400:]}")
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise FFmpegError("Konvertering producerede en tom fil.")
    return output_path


@dataclass
class ChunkSpec:
    chunk_number: int
    start_seconds: float
    end_seconds: float
    file_path: Path


def plan_chunks(
    duration_seconds: float,
    chunk_duration: int | None = None,
    overlap_seconds: int | None = None,
) -> List[tuple[int, float, float]]:
    """Returnér en liste over (chunk_number, start, end) tuples."""
    cd = chunk_duration or settings.chunk_duration_seconds
    overlap = overlap_seconds if overlap_seconds is not None else settings.chunk_overlap_seconds
    if duration_seconds <= cd:
        return [(1, 0.0, duration_seconds)]

    chunks: List[tuple[int, float, float]] = []
    start = 0.0
    n = 1
    while start < duration_seconds:
        end = min(start + cd, duration_seconds)
        chunks.append((n, start, end))
        if end >= duration_seconds:
            break
        start = end - overlap
        n += 1
    return chunks


def extract_chunk(
    source_path: Path,
    output_path: Path,
    start_seconds: float,
    end_seconds: float,
) -> Path:
    """Skær et stykke ud af kildefilen til en separat MP3."""
    ffmpeg = _require_tool("ffmpeg")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.1, end_seconds - start_seconds)
    cmd = [
        ffmpeg,
        "-y",
        "-ss",
        f"{start_seconds:.3f}",
        "-t",
        f"{duration:.3f}",
        "-i",
        str(source_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        "-f",
        "mp3",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise FFmpegError(f"Kunne ikke skære lyd ud: {result.stderr.strip()[-400:]}")
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise FFmpegError("Lydstykket blev tomt.")
    return output_path


def safe_delete(path: Path | None) -> None:
    if not path:
        return
    try:
        p = Path(path)
        if p.exists() and p.is_file():
            p.unlink()
    except OSError:
        pass
