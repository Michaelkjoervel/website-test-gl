from pathlib import Path
from typing import List, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str = ""
    transcription_engine: Literal["openai", "dummy"] = "openai"
    openai_transcription_model: str = "whisper-1"

    database_url: str = "sqlite:///./data/transskribering.db"

    upload_directory: str = "./data/uploads"
    temp_directory: str = "./data/temp"

    max_audio_duration_seconds: int = 7200
    max_upload_size_mb: int = 500

    chunk_duration_seconds: int = 900
    chunk_overlap_seconds: int = 3

    audio_retention: Literal["immediate", "24h", "7d", "never"] = "24h"

    default_language: str = "da"

    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_directory).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def temp_path(self) -> Path:
        p = Path(self.temp_directory).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def retention_seconds(self) -> int | None:
        mapping = {"immediate": 0, "24h": 24 * 3600, "7d": 7 * 24 * 3600, "never": None}
        return mapping[self.audio_retention]


settings = Settings()
