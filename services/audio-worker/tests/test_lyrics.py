from app.lyrics import attach_lyrics


def test_attach_creator_lyrics(tmp_path):
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"")
    events = [
        {
            "id": "e1",
            "t": 0.0,
            "tEnd": 2.0,
            "chord": {"symbol": "Em", "root": "E", "quality": "min"},
            "lyricLine": None,
            "sectionId": "s1",
        },
        {
            "id": "e2",
            "t": 2.0,
            "tEnd": 4.0,
            "chord": {"symbol": "Bm", "root": "B", "quality": "min"},
            "lyricLine": None,
            "sectionId": "s1",
        },
        {
            "id": "e3",
            "t": 4.0,
            "tEnd": 6.0,
            "chord": {"symbol": "Am", "root": "A", "quality": "min"},
            "lyricLine": None,
            "sectionId": "s1",
        },
        {
            "id": "e4",
            "t": 6.0,
            "tEnd": 8.0,
            "chord": {"symbol": "D", "root": "D", "quality": "maj"},
            "lyricLine": None,
            "sectionId": "s1",
        },
    ]
    updated, lyrics, source = attach_lyrics(
        path=str(audio),
        title="Demo",
        artist="Artista",
        events=events,
        lyrics_plain="Acreditei no seu amor\nSozinho, sozinho",
        duration=8.0,
    )
    assert source == "creator"
    assert len(lyrics) >= 1
    assert lyrics[0]["text"] == "Acreditei no seu amor"
    assert updated[0]["lyricLine"] == "Acreditei no seu amor"
    assert any(c["symbol"] == "Em" for c in lyrics[0]["chords"])


def test_fallback_has_lyrics(tmp_path):
    from app.analyze import _analyze_fallback

    audio = tmp_path / "silent.wav"
    audio.write_bytes(b"")
    result = _analyze_fallback(str(audio), "Demo", "Artist", lyrics_plain=None)
    assert len(result["syncDocument"]["lyrics"]) >= 1
    assert result["syncDocument"]["meta"]["lyricsSource"] in {"stub", "creator", "whisper"}
