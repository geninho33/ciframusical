from app.analyze import analyze_available, _analyze_fallback


def test_analyze_available():
    info = analyze_available()
    assert "librosa" in info
    assert info["engine"] in {"librosa", "fallback"}


def test_fallback_builds_sync(tmp_path):
    # empty file is enough for fallback duration default
    audio = tmp_path / "silent.wav"
    audio.write_bytes(b"")
    result = _analyze_fallback(str(audio), "Demo", "Artist")
    assert result["bpm"] > 0
    assert result["syncDocument"]["formatVersion"] == "1.0.0"
    assert len(result["syncDocument"]["events"]) >= 1
    assert len(result["syncDocument"]["lyrics"]) >= 1
