"""End-to-end-test af hele transskriberingsflowet med dummy-motoren."""
from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path

import pytest


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


@pytest.fixture
def sample_audio(tmp_path: Path) -> Path:
    if not _ffmpeg_available():
        pytest.skip("ffmpeg ikke installeret")
    target = tmp_path / "sample.mp3"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=2",
            "-ar",
            "22050",
            "-ac",
            "1",
            str(target),
        ],
        check=True,
        capture_output=True,
    )
    return target


def test_full_flow_with_dummy_engine(client, sample_audio):
    with sample_audio.open("rb") as fh:
        r = client.post(
            "/api/transcriptions/upload",
            files={"file": ("hello.mp3", fh, "audio/mpeg")},
            data={"title": "Test", "transcription_mode": "cleaned"},
        )
    assert r.status_code == 201, r.text
    job_id = r.json()["id"]

    r = client.post(f"/api/transcriptions/{job_id}/start")
    assert r.status_code == 200

    deadline = time.time() + 30
    status = None
    while time.time() < deadline:
        r = client.get(f"/api/transcriptions/{job_id}/status")
        assert r.status_code == 200
        status = r.json()
        if status["status"] in ("completed", "failed"):
            break
        time.sleep(0.5)

    assert status is not None
    assert status["status"] == "completed", status

    r = client.get(f"/api/transcriptions/{job_id}")
    detail = r.json()
    assert detail["edited_text"]
    assert detail["duration_seconds"] > 0

    # Eksporter
    for fmt, ct in [
        ("txt", "text/plain"),
        ("docx", "application/vnd.openxmlformats"),
        ("pdf", "application/pdf"),
    ]:
        r = client.get(f"/api/transcriptions/{job_id}/export/{fmt}")
        assert r.status_code == 200, fmt
        assert ct in r.headers.get("content-type", ""), fmt
        assert len(r.content) > 50, fmt

    # Redigér og gem
    r = client.patch(
        f"/api/transcriptions/{job_id}",
        json={"edited_text": "Min redigerede tekst.", "title": "Nyt navn"},
    )
    assert r.status_code == 200
    assert r.json()["edited_text"] == "Min redigerede tekst."

    # Slet
    r = client.delete(f"/api/transcriptions/{job_id}")
    assert r.status_code == 204
    r = client.get(f"/api/transcriptions/{job_id}")
    assert r.status_code == 404
