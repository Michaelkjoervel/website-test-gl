import os
import sys
import tempfile
from pathlib import Path

import pytest

# Sørg for at appen kan importeres
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Brug en isoleret datadir per test-session
_tmp = tempfile.mkdtemp(prefix="transskribering-test-")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_tmp}/test.db")
os.environ.setdefault("UPLOAD_DIRECTORY", f"{_tmp}/uploads")
os.environ.setdefault("TEMP_DIRECTORY", f"{_tmp}/temp")
os.environ.setdefault("TRANSCRIPTION_ENGINE", "dummy")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from app.database import init_db
    from app.main import app

    init_db()
    return TestClient(app)
