import io


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


def test_upload_rejects_unknown_extension(client):
    fake = io.BytesIO(b"not really audio")
    r = client.post(
        "/api/transcriptions/upload",
        files={"file": ("phishing.exe", fake, "application/octet-stream")},
    )
    assert r.status_code == 400


def test_upload_rejects_empty_file(client):
    fake = io.BytesIO(b"")
    r = client.post(
        "/api/transcriptions/upload",
        files={"file": ("tom.mp3", fake, "audio/mpeg")},
    )
    assert r.status_code == 400


def test_get_unknown_job_returns_404(client):
    r = client.get("/api/transcriptions/does-not-exist")
    assert r.status_code == 404


def test_list_jobs(client):
    r = client.get("/api/transcriptions")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
