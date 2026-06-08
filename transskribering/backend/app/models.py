from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _now() -> datetime:
    return datetime.utcnow()


class TranscriptionJob(Base):
    __tablename__ = "transcription_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_audio_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    converted_audio_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    file_type: Mapped[str] = mapped_column(String(32))
    file_size: Mapped[int] = mapped_column(Integer)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    language: Mapped[str] = mapped_column(String(8), default="da")
    transcription_mode: Mapped[str] = mapped_column(String(16), default="cleaned")  # verbatim | cleaned
    timestamp_mode: Mapped[str] = mapped_column(String(16), default="none")  # none | paragraph | interval | speaker
    speaker_detection_enabled: Mapped[bool] = mapped_column(default=False)

    status: Mapped[str] = mapped_column(String(32), default="queued")
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    current_step: Mapped[str] = mapped_column(String(64), default="venter")
    current_chunk: Mapped[int] = mapped_column(Integer, default=0)
    total_chunks: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    audio_deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    chunks: Mapped[list["AudioChunk"]] = relationship(
        back_populates="job", cascade="all, delete-orphan", order_by="AudioChunk.chunk_number"
    )
    document: Mapped[Optional["TranscriptionDocument"]] = relationship(
        back_populates="job", uselist=False, cascade="all, delete-orphan"
    )


class AudioChunk(Base):
    __tablename__ = "audio_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("transcription_jobs.id", ondelete="CASCADE"))
    chunk_number: Mapped[int] = mapped_column(Integer)
    start_seconds: Mapped[float] = mapped_column(Float)
    end_seconds: Mapped[float] = mapped_column(Float)
    file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    raw_transcription: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_transcription: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    job: Mapped[TranscriptionJob] = relationship(back_populates="chunks")


class TranscriptionDocument(Base):
    __tablename__ = "transcription_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("transcription_jobs.id", ondelete="CASCADE"), unique=True)
    raw_text: Mapped[str] = mapped_column(Text, default="")
    edited_text: Mapped[str] = mapped_column(Text, default="")
    structured_segments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON-streng
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    job: Mapped[TranscriptionJob] = relationship(back_populates="document")
