"""FastAPI-applikation: opstart, CORS og oprydningsplan."""
from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.transcriptions import router as transcriptions_router
from .config import settings
from .database import init_db
from .services.jobs import cleanup_expired_audio

log = logging.getLogger("transskribering")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def _cleanup_loop(stop: threading.Event) -> None:
    while not stop.is_set():
        try:
            deleted = cleanup_expired_audio()
            if deleted:
                log.info("Ryddet %s udløbne lydfiler op", deleted)
        except Exception as exc:  # noqa: BLE001
            log.warning("Oprydning fejlede: %s", exc)
        stop.wait(timeout=15 * 60)  # tjek hvert kvarter


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    stop = threading.Event()
    thread = threading.Thread(target=_cleanup_loop, args=(stop,), daemon=True, name="cleanup")
    thread.start()
    try:
        yield
    finally:
        stop.set()


app = FastAPI(
    title="Transskribering",
    description="Webbaseret system til dansk transskribering af lydoptagelser.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcriptions_router)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "engine": settings.transcription_engine,
        "max_duration_seconds": settings.max_audio_duration_seconds,
        "max_upload_mb": settings.max_upload_size_mb,
        "audio_retention": settings.audio_retention,
    }
