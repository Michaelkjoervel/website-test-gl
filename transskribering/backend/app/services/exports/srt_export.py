from __future__ import annotations

import json

from ...models import TranscriptionJob


def _format_srt_time(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(job: TranscriptionJob) -> bytes:
    if not job.document or not job.document.structured_segments:
        return b""
    try:
        segments = json.loads(job.document.structured_segments)
    except json.JSONDecodeError:
        return b""

    lines: list[str] = []
    for idx, seg in enumerate(segments, start=1):
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start + 2.0))
        if end <= start:
            end = start + 2.0
        lines.append(str(idx))
        lines.append(f"{_format_srt_time(start)} --> {_format_srt_time(end)}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines).encode("utf-8")
