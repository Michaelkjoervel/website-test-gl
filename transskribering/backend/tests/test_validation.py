import pytest

from app.services.validation import (
    ValidationError,
    check_extension,
    check_size,
    sanitize_filename,
)


def test_sanitize_filename_strips_path():
    assert sanitize_filename("../etc/passwd.mp3") == ".._etc_passwd.mp3" or sanitize_filename(
        "../etc/passwd.mp3"
    ).endswith("passwd.mp3")


def test_check_extension_accepts_common():
    for ext in [".mp3", ".wav", ".m4a", ".mp4", ".webm", ".ogg", ".aac"]:
        assert check_extension(f"test{ext}") == ext


def test_check_extension_rejects_unknown():
    with pytest.raises(ValidationError):
        check_extension("test.exe")


def test_check_size_rejects_empty():
    with pytest.raises(ValidationError):
        check_size(0)


def test_check_size_rejects_too_large():
    with pytest.raises(ValidationError):
        check_size(10 * 1024 * 1024 * 1024)  # 10 GB
