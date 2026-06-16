"""REST API til transskriberingsjobs."""
from __future__ import annotations

import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import TranscriptionJob
from ..schemas import (
    DocumentDocxRequest,
    GenerateDocumentResponse,
    JobDetail,
    JobOut,
    JobStatusOut,
    JobUpdate,
)
from ..services import audio as audio_svc
from ..services import jobs as job_svc
from ..services.exports import build_docx, build_pdf, build_srt, build_summary_docx, build_txt
from ..services.summary import DOCUMENT_LABELS, SummaryError, generate_document
from ..services.validation import (
    ValidationError,
    check_extension,
    check_size,
    sanitize_filename,
    verify_magic_bytes,
)

router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])


def _job_to_detail(job: TranscriptionJob) -> JobDetail:
    base = JobOut.model_validate(job).model_dump()
    base["raw_text"] = job.document.raw_text if job.document else ""
    base["edited_text"] = job.document.edited_text if job.document else ""
    base["chunks"] = [
        {
            "chunk_number": c.chunk_number,
            "start_seconds": c.start_seconds,
            "end_seconds": c.end_seconds,
            "status": c.status,
            "error_message": c.error_message,
        }
        for c in job.chunks
    ]
    return JobDetail(**base)


@router.post("/upload", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def upload(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    transcription_mode: str = Form("cleaned"),
    timestamp_mode: str = Form("none"),
    speaker_detection_enabled: bool = Form(False),
    db: Session = Depends(get_db),
) -> JobOut:
    """Upload én lydfil og opret et job. Starter ikke transskriberingen automatisk."""
    if not file.filename:
        raise HTTPException(400, "Ingen fil modtaget.")

    safe_name = sanitize_filename(file.filename)
    try:
        ext = check_extension(safe_name)
    except ValidationError as exc:
        raise HTTPException(400, str(exc)) from exc

    job_id = str(uuid.uuid4())
    stored_path = settings.upload_path / f"{job_id}{ext}"

    # Stream til disk, så vi ikke holder hele filen i hukommelsen
    written = 0
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    try:
        with stored_path.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    out.close()
                    stored_path.unlink(missing_ok=True)
                    raise HTTPException(
                        413,
                        f"Filen er for stor. Maksimal størrelse er {settings.max_upload_size_mb} MB.",
                    )
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(500, "Filen kunne ikke gemmes på serveren.") from exc

    try:
        check_size(written)
        verify_magic_bytes(stored_path)
    except ValidationError as exc:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(400, str(exc)) from exc

    # Probe så vi kan afvise tidligt hvis lyden mangler eller er for lang
    try:
        info = audio_svc.probe(stored_path)
    except audio_svc.FFmpegError as exc:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(400, "Filen kunne ikke læses. Prøv en anden fil.") from exc

    if not info.has_audio:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(400, "Der blev ikke fundet noget lydspor i filen.")
    if info.duration_seconds > settings.max_audio_duration_seconds:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(400, "Lydoptagelsen må maksimalt være 2 timer.")
    if info.duration_seconds <= 0:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(400, "Filen kunne ikke læses. Prøv en anden fil.")

    if transcription_mode not in {"verbatim", "cleaned"}:
        transcription_mode = "cleaned"
    if timestamp_mode not in {"none", "paragraph", "interval", "speaker"}:
        timestamp_mode = "none"

    job = TranscriptionJob(
        id=job_id,
        title=(title or safe_name).strip()[:255] or safe_name,
        original_filename=safe_name,
        stored_audio_path=str(stored_path),
        file_type=ext.lstrip("."),
        file_size=written,
        duration_seconds=info.duration_seconds,
        language=settings.default_language,
        transcription_mode=transcription_mode,
        timestamp_mode=timestamp_mode,
        speaker_detection_enabled=bool(speaker_detection_enabled),
        status="queued",
        current_step="venter",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return JobOut.model_validate(job)


@router.post("/{job_id}/start", response_model=JobStatusOut)
def start(job_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> JobStatusOut:
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    if job.status in {"transcribing", "analyzing", "preparing", "chunking", "merging"}:
        return JobStatusOut(
            id=job.id,
            status=job.status,
            progress_percent=job.progress_percent,
            current_step=job.current_step,
            current_chunk=job.current_chunk,
            total_chunks=job.total_chunks,
            error_message=job.error_message,
        )
    if job.status == "completed":
        raise HTTPException(409, "Transskriberingen er allerede afsluttet.")

    if not job.stored_audio_path or not Path(job.stored_audio_path).exists():
        raise HTTPException(410, "Lydfilen er ikke længere tilgængelig.")

    job.status = "queued"
    job.current_step = "Lægger job i kø"
    job.progress_percent = 1
    job.error_message = None
    db.add(job)
    db.commit()
    job_svc.start_job(job.id)

    return JobStatusOut(
        id=job.id,
        status=job.status,
        progress_percent=job.progress_percent,
        current_step=job.current_step,
        current_chunk=job.current_chunk,
        total_chunks=job.total_chunks,
        error_message=job.error_message,
    )


@router.get("", response_model=List[JobOut])
def list_jobs(db: Session = Depends(get_db)) -> List[JobOut]:
    jobs = db.query(TranscriptionJob).order_by(TranscriptionJob.created_at.desc()).all()
    return [JobOut.model_validate(j) for j in jobs]


@router.get("/{job_id}", response_model=JobDetail)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobDetail:
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    return _job_to_detail(job)


@router.get("/{job_id}/status", response_model=JobStatusOut)
def status_endpoint(job_id: str, db: Session = Depends(get_db)) -> JobStatusOut:
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    return JobStatusOut(
        id=job.id,
        status=job.status,
        progress_percent=job.progress_percent,
        current_step=job.current_step,
        current_chunk=job.current_chunk,
        total_chunks=job.total_chunks,
        error_message=job.error_message,
    )


@router.patch("/{job_id}", response_model=JobDetail)
def update_job(job_id: str, payload: JobUpdate, db: Session = Depends(get_db)) -> JobDetail:
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    if payload.title is not None:
        title = payload.title.strip()
        if title:
            job.title = title[:255]
    if payload.edited_text is not None:
        if not job.document:
            from ..models import TranscriptionDocument

            doc = TranscriptionDocument(id=str(uuid.uuid4()), job_id=job.id, raw_text="", edited_text=payload.edited_text)
            db.add(doc)
        else:
            job.document.edited_text = payload.edited_text
            job.document.updated_at = datetime.utcnow()
            db.add(job.document)
    job.updated_at = datetime.utcnow()
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_detail(job)


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, db: Session = Depends(get_db)) -> Response:
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    if job.stored_audio_path:
        audio_svc.safe_delete(Path(job.stored_audio_path))
    if job.converted_audio_path:
        audio_svc.safe_delete(Path(job.converted_audio_path))
    for c in job.chunks:
        if c.file_path:
            audio_svc.safe_delete(Path(c.file_path))
    db.delete(job)
    db.commit()
    return Response(status_code=204)


@router.get("/{job_id}/audio")
def get_audio(job_id: str, db: Session = Depends(get_db)):
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    if not job.stored_audio_path or not Path(job.stored_audio_path).exists():
        raise HTTPException(410, "Lydfilen er ikke længere tilgængelig.")
    return FileResponse(job.stored_audio_path, filename=job.original_filename)


def _export_filename(job: TranscriptionJob, ext: str) -> str:
    base = Path(job.title or job.original_filename or "transskribering").stem or "transskribering"
    safe = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in base)[:80]
    return f"{safe}.{ext}"


@router.get("/{job_id}/export/txt")
def export_txt(job_id: str, db: Session = Depends(get_db)):
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    data = build_txt(job)
    return Response(
        data,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={_export_filename(job, 'txt')}"},
    )


@router.get("/{job_id}/export/docx")
def export_docx(job_id: str, db: Session = Depends(get_db)):
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    data = build_docx(job)
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={_export_filename(job, 'docx')}"},
    )


@router.get("/{job_id}/export/pdf")
def export_pdf(job_id: str, db: Session = Depends(get_db)):
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    data = build_pdf(job)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={_export_filename(job, 'pdf')}"},
    )


@router.get("/{job_id}/export/srt")
def export_srt(job_id: str, db: Session = Depends(get_db)):
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    data = build_srt(job)
    if not data:
        raise HTTPException(404, "SRT er ikke tilgængelig — der er ingen tidsstempler at eksportere.")
    return Response(
        data,
        media_type="application/x-subrip",
        headers={"Content-Disposition": f"attachment; filename={_export_filename(job, 'srt')}"},
    )


@router.get("/meta/document-types")
def document_types() -> list[dict]:
    """Hvilke AI-dokumenter brugeren kan vælge imellem."""
    from ..services.summary import DOCUMENT_DESCRIPTIONS

    return [
        {"type": key, "label": label, "description": DOCUMENT_DESCRIPTIONS[key]}
        for key, label in DOCUMENT_LABELS.items()
    ]


@router.post("/{job_id}/documents/{doc_type}", response_model=GenerateDocumentResponse)
def generate_doc(job_id: str, doc_type: str, db: Session = Depends(get_db)) -> GenerateDocumentResponse:
    """Generér et AI-dokument (summary/referat/næste skridt/opfølgning) fra transskriberingen."""
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    if doc_type not in DOCUMENT_LABELS:
        raise HTTPException(400, "Ukendt dokumenttype.")
    if job.status != "completed":
        raise HTTPException(400, "Transskriberingen er ikke færdig endnu.")
    if not job.document:
        raise HTTPException(400, "Der er ingen tekst at generere ud fra.")

    text = (job.document.edited_text or job.document.raw_text or "").strip()
    if not text:
        raise HTTPException(400, "Der er ingen tekst at generere ud fra.")

    try:
        content = generate_document(text, doc_type)
    except SummaryError as exc:
        raise HTTPException(400, str(exc)) from exc

    return GenerateDocumentResponse(
        type=doc_type,  # type: ignore[arg-type]
        label=DOCUMENT_LABELS[doc_type],
        content=content,
    )


@router.post("/{job_id}/documents/{doc_type}/docx")
def download_doc_docx(
    job_id: str,
    doc_type: str,
    payload: DocumentDocxRequest,
    db: Session = Depends(get_db),
):
    """Modtag brugerens (evt. redigerede) indhold og returnér det som Word-fil."""
    job = db.get(TranscriptionJob, job_id)
    if not job:
        raise HTTPException(404, "Transskriberingen blev ikke fundet.")
    if doc_type not in DOCUMENT_LABELS:
        raise HTTPException(400, "Ukendt dokumenttype.")
    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(400, "Indholdet er tomt.")

    data = build_summary_docx(job, doc_type, content)
    suffix = doc_type.replace("_", "-")
    base = Path(job.title or job.original_filename or "dokument").stem or "dokument"
    safe = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in base)[:80]
    filename = f"{safe}_{suffix}.docx"
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
