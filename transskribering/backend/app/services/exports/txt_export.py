from __future__ import annotations

from ...models import TranscriptionJob


def build_txt(job: TranscriptionJob) -> bytes:
    text = (job.document.edited_text if job.document and job.document.edited_text else "").strip()
    return text.encode("utf-8")
