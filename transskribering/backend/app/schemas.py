from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


TranscriptionMode = Literal["verbatim", "cleaned"]
TimestampMode = Literal["none", "paragraph", "interval", "speaker"]
JobStatus = Literal[
    "queued", "analyzing", "preparing", "chunking", "transcribing", "merging", "completed", "failed", "cancelled"
]


class JobCreate(BaseModel):
    transcription_mode: TranscriptionMode = "cleaned"
    timestamp_mode: TimestampMode = "none"
    speaker_detection_enabled: bool = False
    title: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    edited_text: Optional[str] = None


class ChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    chunk_number: int
    start_seconds: float
    end_seconds: float
    status: str
    error_message: Optional[str] = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    original_filename: str
    file_type: str
    file_size: int
    duration_seconds: Optional[float] = None
    language: str
    transcription_mode: str
    timestamp_mode: str
    speaker_detection_enabled: bool
    status: str
    progress_percent: int
    current_step: str
    current_chunk: int
    total_chunks: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    audio_deleted_at: Optional[datetime] = None


class JobDetail(JobOut):
    raw_text: str = ""
    edited_text: str = ""
    chunks: List[ChunkOut] = Field(default_factory=list)


class JobStatusOut(BaseModel):
    id: str
    status: str
    progress_percent: int
    current_step: str
    current_chunk: int
    total_chunks: int
    error_message: Optional[str] = None


DocumentTypeStr = Literal["executive_summary", "minutes", "next_steps", "followup"]


class GenerateDocumentResponse(BaseModel):
    type: DocumentTypeStr
    label: str
    content: str


class DocumentDocxRequest(BaseModel):
    content: str
