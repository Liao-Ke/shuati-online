from auth import _load_secret_key


def test_secret_key_from_env(monkeypatch, tmp_path):
    monkeypatch.setenv("SECRET_KEY", "env-test-key-12345")
    key = _load_secret_key(tmp_path / ".secret_key")
    assert key == "env-test-key-12345"
    assert not (tmp_path / ".secret_key").exists()


def test_secret_key_from_file(monkeypatch, tmp_path):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    key_path = tmp_path / ".secret_key"
    key_path.write_text("file-stored-key-67890", encoding="utf-8")
    key = _load_secret_key(key_path)
    assert key == "file-stored-key-67890"


def test_secret_key_generated_and_persisted(monkeypatch, tmp_path):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    key_path = tmp_path / ".secret_key"
    key = _load_secret_key(key_path)
    assert len(key) == 64
    assert key_path.read_text(encoding="utf-8") == key


def test_secret_key_persisted_across_restarts(monkeypatch, tmp_path):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    key_path = tmp_path / ".secret_key"
    first = _load_secret_key(key_path)
    second = _load_secret_key(key_path)
    assert first == second
