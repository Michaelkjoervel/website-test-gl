export type TranscriptionMode = "verbatim" | "cleaned";
export type TimestampMode = "none" | "paragraph" | "interval" | "speaker";

export type JobStatus =
  | "queued"
  | "analyzing"
  | "preparing"
  | "chunking"
  | "transcribing"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobOut {
  id: string;
  title: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  duration_seconds: number | null;
  language: string;
  transcription_mode: TranscriptionMode;
  timestamp_mode: TimestampMode;
  speaker_detection_enabled: boolean;
  status: JobStatus;
  progress_percent: number;
  current_step: string;
  current_chunk: number;
  total_chunks: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  audio_deleted_at: string | null;
}

export interface JobChunk {
  chunk_number: number;
  start_seconds: number;
  end_seconds: number;
  status: string;
  error_message: string | null;
}

export interface JobDetail extends JobOut {
  raw_text: string;
  edited_text: string;
  chunks: JobChunk[];
}

export interface JobStatusOut {
  id: string;
  status: JobStatus;
  progress_percent: number;
  current_step: string;
  current_chunk: number;
  total_chunks: number;
  error_message: string | null;
}
