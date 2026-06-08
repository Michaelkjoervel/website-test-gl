"""Baggrundsjob: transskriberingsprocessen for ét job, kørt i en separat thread."""
from __future__ import annotations

import json
import logging
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Iterable

from sqlalchemy import select

from ..config import settings
from ..database import SessionLocal
from ..models import AudioChunk, TranscriptionDocument, TranscriptionJob
from . import audio as audio_svc
from . import postprocess
from .transcription import get_engine
from .transcription.base import TranscriptionResult

log = logging.getLogger("transskribering.jobs")
_active_jobs: set[str] = set()
_lock = threading.Lock()


def is_active(job_id: str) -> bool:
    with _lock:
        return job_id in _active_jobs


def _mark_active(job_id: str) -> bool:
    with _lock:
        if job_id in _active_jobs:
            return False
        _active_jobs.add(job_id)
        return True


def _mark_inactive(job_id: str) -> None:
    with _lock:
        _active_jobs.discard(job_id)


def start_job(job_id: str) -> bool:
    """Start jobbet i en baggrundstråd. Returner False hvis det allerede kører."""
    if not _mark_active(job_id):
        return False
    thread = threading.Thread(target=_run_job, args=(job_id,), daemon=True, name=f"job-{job_id}")
    thread.start()
    return True


def _update_job(db, job: TranscriptionJob, **kwargs) -> None:
    for k, v in kwargs.items():
        setattr(job, k, v)
    db.add(job)
    db.commit()


def _run_job(job_id: str) -> None:
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        if job is None:
            log.warning("Job %s findes ikke", job_id)
            return
        if job.status == "completed":
            return

        try:
            _process(db, job)
        except Exception as exc:  # noqa: BLE001
            log.exception("Job %s fejlede", job_id)
            _update_job(
                db,
                job,
                status="failed",
                error_message=str(exc)[:1000],
                current_step="fejl",
            )
    finally:
        db.close()
        _mark_inactive(job_id)


def _process(db, job: TranscriptionJob) -> None:
    engine = get_engine()
    stored = Path(job.stored_audio_path) if job.stored_audio_path else None
    if not stored or not stored.exists():
        raise FileNotFoundError("Lydfilen kunne ikke findes på serveren.")

    # 1. Analyse
    _update_job(db, job, status="analyzing", current_step="Analyserer lydfil", progress_percent=5)
    info = audio_svc.probe(stored)
    if not info.has_audio:
        raise ValueError("Der blev ikke fundet noget lydspor i filen.")
    duration = info.duration_seconds
    if duration <= 0:
        raise ValueError("Filen kunne ikke læses. Prøv en anden fil.")
    if duration > settings.max_audio_duration_seconds:
        raise ValueError("Lydoptagelsen må maksimalt være 2 timer.")
    _update_job(db, job, duration_seconds=duration)

    # 2. Forbered (konvertér til ensartet format)
    _update_job(db, job, status="preparing", current_step="Klargør lydfil", progress_percent=10)
    converted_path = settings.temp_path / f"{job.id}_converted.mp3"
    audio_svc.convert_to_transcription_format(stored, converted_path)
    _update_job(db, job, converted_audio_path=str(converted_path))

    # 3. Opdel
    _update_job(db, job, status="chunking", current_step="Opdeler lydfilen", progress_percent=15)
    chunk_plan = audio_svc.plan_chunks(duration)
    db.query(AudioChunk).filter(AudioChunk.job_id == job.id).delete()
    db.commit()

    chunks: list[AudioChunk] = []
    for chunk_number, start, end in chunk_plan:
        chunk_file = settings.temp_path / f"{job.id}_chunk_{chunk_number:03d}.mp3"
        audio_svc.extract_chunk(converted_path, chunk_file, start, end)
        chunk = AudioChunk(
            id=str(uuid.uuid4()),
            job_id=job.id,
            chunk_number=chunk_number,
            start_seconds=start,
            end_seconds=end,
            file_path=str(chunk_file),
            status="pending",
        )
        db.add(chunk)
        chunks.append(chunk)
    job.total_chunks = len(chunks)
    db.commit()

    # 4. Transskribér hver chunk
    _update_job(
        db,
        job,
        status="transcribing",
        current_step="Transskribering er i gang",
        progress_percent=20,
    )
    results: list[TranscriptionResult] = []
    total = len(chunks)
    max_attempts = 3
    for idx, chunk in enumerate(chunks, start=1):
        chunk_path = Path(chunk.file_path) if chunk.file_path else None
        if not chunk_path or not chunk_path.exists():
            raise FileNotFoundError(f"Lyddel {chunk.chunk_number} mangler på disken.")

        last_error: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            chunk.attempts = attempt
            try:
                result = engine.transcribe(chunk_path, language=job.language or settings.default_language)
                chunk.raw_transcription = result.text
                chunk.status = "completed"
                chunk.error_message = None
                results.append(_shift_segments(result, chunk.start_seconds))
                db.add(chunk)
                db.commit()
                break
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                chunk.status = "retrying"
                chunk.error_message = str(exc)[:500]
                db.add(chunk)
                db.commit()
                if attempt >= max_attempts:
                    chunk.status = "failed"
                    db.add(chunk)
                    db.commit()
                    raise RuntimeError(
                        f"Lyddel {chunk.chunk_number} kunne ikke transskriberes: {exc}"
                    ) from exc

        progress = 20 + int(70 * idx / total)
        _update_job(
            db,
            job,
            current_chunk=idx,
            progress_percent=progress,
            current_step=f"Del {idx} af {total} transskriberes",
        )

    # 5. Saml
    _update_job(
        db,
        job,
        status="merging",
        current_step="Teksten samles",
        progress_percent=92,
    )

    raw_texts = [r.text for r in results]
    merged_raw = postprocess.merge_with_overlap_dedup(raw_texts)

    if job.transcription_mode == "cleaned":
        edited = postprocess.split_into_paragraphs(postprocess.clean_text(merged_raw))
    else:
        edited = postprocess.split_into_paragraphs(merged_raw)

    edited_with_timestamps = _apply_timestamp_mode(edited, results, job.timestamp_mode)

    document = job.document
    if document is None:
        document = TranscriptionDocument(
            id=str(uuid.uuid4()),
            job_id=job.id,
        )
    document.raw_text = merged_raw
    document.edited_text = edited_with_timestamps
    document.structured_segments = json.dumps(
        [
            {
                "start": s.start_seconds,
                "end": s.end_seconds,
                "text": s.text,
                "speaker": s.speaker,
            }
            for r in results
            for s in r.segments
        ]
    )
    db.add(document)
    db.commit()

    # 6. Færdig + oprydning
    _update_job(
        db,
        job,
        status="completed",
        current_step="Transskriberingen er færdig",
        progress_percent=100,
        completed_at=datetime.utcnow(),
    )

    for chunk in chunks:
        audio_svc.safe_delete(Path(chunk.file_path) if chunk.file_path else None)
        chunk.file_path = None
        db.add(chunk)
    db.commit()

    # 7. Oprydning af originalen, hvis retention er "immediate"
    if settings.retention_seconds == 0:
        audio_svc.safe_delete(stored)
        audio_svc.safe_delete(converted_path)
        job.stored_audio_path = None
        job.converted_audio_path = None
        job.audio_deleted_at = datetime.utcnow()
        db.add(job)
        db.commit()
    else:
        audio_svc.safe_delete(converted_path)
        job.converted_audio_path = None
        db.add(job)
        db.commit()


def _shift_segments(result: TranscriptionResult, offset: float) -> TranscriptionResult:
    for s in result.segments:
        s.start_seconds += offset
        s.end_seconds += offset
    return result


def _apply_timestamp_mode(text: str, results: Iterable[TranscriptionResult], mode: str) -> str:
    if mode == "none" or not text:
        return text

    all_segments = [s for r in results for s in r.segments]
    if not all_segments:
        return text

    if mode == "paragraph":
        paragraphs = text.split("\n\n")
        if not paragraphs:
            return text
        seg_idx = 0
        prepared: list[str] = []
        for para in paragraphs:
            if seg_idx < len(all_segments):
                ts = postprocess.format_timestamp(all_segments[seg_idx].start_seconds)
                prepared.append(f"{ts} {para}")
                seg_idx += max(1, len(para) // 200)
            else:
                prepared.append(para)
        return "\n\n".join(prepared)

    if mode == "interval":
        lines: list[str] = []
        next_threshold = 0.0
        interval = 60.0
        for seg in all_segments:
            if seg.start_seconds >= next_threshold:
                lines.append(f"\n{postprocess.format_timestamp(seg.start_seconds)} {seg.text}")
                next_threshold = seg.start_seconds + interval
            else:
                lines.append(seg.text)
        return " ".join(lines).strip()

    return text


def cleanup_expired_audio() -> int:
    """Slet originale lydfiler for afsluttede jobs der har overskredet retention."""
    seconds = settings.retention_seconds
    if seconds is None:
        return 0
    db = SessionLocal()
    deleted = 0
    try:
        stmt = select(TranscriptionJob).where(
            TranscriptionJob.completed_at.is_not(None),
            TranscriptionJob.stored_audio_path.is_not(None),
        )
        for job in db.execute(stmt).scalars():
            if not job.completed_at:
                continue
            age = (datetime.utcnow() - job.completed_at).total_seconds()
            if age >= seconds:
                audio_svc.safe_delete(Path(job.stored_audio_path) if job.stored_audio_path else None)
                job.stored_audio_path = None
                job.audio_deleted_at = datetime.utcnow()
                db.add(job)
                deleted += 1
        db.commit()
    finally:
        db.close()
    return deleted
