"""Audio analysis → CifraSyncDocument.

Uses librosa when available; otherwise a deterministic fallback grid so the
pipeline remains usable without native audio deps on every host.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import numpy as np

from app.lyrics import attach_lyrics, lyrics_engine

try:
    import librosa

    HAS_LIBROSA = True
except Exception:  # pragma: no cover - optional dependency
    HAS_LIBROSA = False

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
TRIADS = {
    "maj": np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], dtype=float),
    "min": np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], dtype=float),
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _estimate_key(chroma_mean: np.ndarray) -> tuple[str, float]:
    best_key = "C"
    best_score = -1.0
    for i, name in enumerate(PITCH_CLASSES):
        maj = float(np.corrcoef(np.roll(MAJOR_PROFILE, i), chroma_mean)[0, 1])
        minor = float(np.corrcoef(np.roll(MINOR_PROFILE, i), chroma_mean)[0, 1])
        if maj >= minor and maj > best_score:
            best_score = maj
            best_key = name
        elif minor > best_score:
            best_score = minor
            best_key = f"{name}m"
    confidence = max(0.0, min(1.0, (best_score + 1) / 2))
    return best_key, confidence


def _chord_from_chroma(frame: np.ndarray) -> tuple[str, str, str, float]:
    frame = frame / (np.linalg.norm(frame) + 1e-9)
    best = ("C", "maj", "C", -1.0)
    for i, root in enumerate(PITCH_CLASSES):
        for quality, template in TRIADS.items():
            rolled = np.roll(template, i)
            score = float(np.dot(frame, rolled / (np.linalg.norm(rolled) + 1e-9)))
            if score > best[3]:
                symbol = root if quality == "maj" else f"{root}m"
                best = (root, quality, symbol, score)
    return best[0], best[1], best[2], max(0.0, min(1.0, best[3]))


def analyze_file(
    path: str,
    title: str,
    artist: str,
    lyrics_plain: str | None = None,
) -> dict[str, Any]:
    if HAS_LIBROSA:
        return _analyze_librosa(path, title, artist, lyrics_plain=lyrics_plain)
    return _analyze_fallback(path, title, artist, lyrics_plain=lyrics_plain)


def _analyze_librosa(
    path: str,
    title: str,
    artist: str,
    lyrics_plain: str | None = None,
) -> dict[str, Any]:
    y, sr = librosa.load(path, sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])
    bpm = float(np.clip(bpm, 40, 240))
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    if len(beat_times) < 2:
        step = 60.0 / bpm
        beat_times = [i * step for i in range(int(duration / step) + 1)]

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    key, key_conf = _estimate_key(chroma_mean)

    # Segment ~2 beats per chord event
    events = []
    confidences = []
    hop = 2
    for idx in range(0, max(1, len(beat_times) - 1), hop):
        t = float(beat_times[idx])
        t_end = float(beat_times[min(idx + hop, len(beat_times) - 1)])
        if t_end <= t:
            t_end = min(duration, t + 60.0 / bpm * hop)
        frame_idx = min(chroma.shape[1] - 1, int(librosa.time_to_frames(t, sr=sr)))
        root, quality, symbol, conf = _chord_from_chroma(chroma[:, frame_idx])
        confidences.append(conf)
        events.append(
            {
                "id": f"e{len(events) + 1}",
                "t": round(t, 3),
                "tEnd": round(t_end, 3),
                "chord": {
                    "symbol": symbol,
                    "root": root,
                    "quality": quality,
                    "bass": None,
                    "extensions": [],
                },
                "lyricLine": None,
                "sectionId": "s1" if t < duration / 2 else "s2",
            }
        )

    if not events:
        events = [
            {
                "id": "e1",
                "t": 0.0,
                "tEnd": duration,
                "chord": {
                    "symbol": key.replace("m", "") if key.endswith("m") else key,
                    "root": key.replace("m", ""),
                    "quality": "min" if key.endswith("m") else "maj",
                    "bass": None,
                    "extensions": [],
                },
                "lyricLine": None,
                "sectionId": "s1",
            }
        ]

    chords_avg = float(np.mean(confidences)) if confidences else 0.5
    events, lyrics, lyrics_source = attach_lyrics(
        path=path,
        title=title,
        artist=artist,
        events=events,
        lyrics_plain=lyrics_plain,
        duration=duration,
    )
    doc = _build_doc(
        title=title,
        artist=artist,
        key=key,
        bpm=bpm,
        duration=duration,
        events=events,
        lyrics=lyrics,
        confidence={
            "bpm": 0.9,
            "key": key_conf,
            "chordsAvg": chords_avg,
            "lyrics": 0.85 if lyrics_source in {"whisper", "creator"} else 0.35,
        },
        generator="cifratrack-worker/librosa",
        lyrics_source=lyrics_source,
    )
    return {
        "syncDocument": doc,
        "bpm": bpm,
        "originalKey": key,
        "durationSec": duration,
        "confidence": doc["meta"]["confidence"],
    }


def _analyze_fallback(
    path: str,
    title: str,
    artist: str,
    lyrics_plain: str | None = None,
) -> dict[str, Any]:
    # Duration via soundfile when possible
    duration = 32.0
    try:
        import soundfile as sf

        info = sf.info(path)
        duration = float(info.duration or duration)
    except Exception:
        duration = 32.0

    bpm = 100.0
    step = 60.0 / bpm * 2  # chord every 2 beats
    progression = [
        ("G", "maj", "G"),
        ("Em", "min", "E"),
        ("C", "maj", "C"),
        ("D", "maj", "D"),
    ]
    events = []
    t = 0.0
    i = 0
    while t < duration:
        root_symbol, quality, root = progression[i % len(progression)]
        t_end = min(duration, t + step)
        events.append(
            {
                "id": f"e{len(events) + 1}",
                "t": round(t, 3),
                "tEnd": round(t_end, 3),
                "chord": {
                    "symbol": root_symbol if quality == "maj" else f"{root}m",
                    "root": root,
                    "quality": quality,
                    "bass": None,
                    "extensions": [],
                },
                "lyricLine": None,
                "sectionId": "s1" if t < duration / 2 else "s2",
            }
        )
        t = t_end
        i += 1

    events, lyrics, lyrics_source = attach_lyrics(
        path=path,
        title=title,
        artist=artist,
        events=events,
        lyrics_plain=lyrics_plain,
        duration=duration,
    )
    doc = _build_doc(
        title=title,
        artist=artist,
        key="G",
        bpm=bpm,
        duration=duration,
        events=events,
        lyrics=lyrics,
        confidence={
            "bpm": 0.4,
            "key": 0.35,
            "chordsAvg": 0.35,
            "lyrics": 0.8 if lyrics_source == "creator" else 0.3,
        },
        generator="cifratrack-worker/fallback",
        lyrics_source=lyrics_source,
    )
    return {
        "syncDocument": doc,
        "bpm": bpm,
        "originalKey": "G",
        "durationSec": duration,
        "confidence": doc["meta"]["confidence"],
    }


def _build_doc(
    *,
    title: str,
    artist: str,
    key: str,
    bpm: float,
    duration: float,
    events: list[dict[str, Any]],
    lyrics: list[dict[str, Any]],
    confidence: dict[str, float],
    generator: str,
    lyrics_source: str,
) -> dict[str, Any]:
    mid = duration / 2
    return {
        "formatVersion": "1.0.0",
        "track": {
            "title": title,
            "artist": artist,
            "originalKey": key,
            "bpm": round(bpm, 2),
            "timeSignature": "4/4",
            "durationSec": round(duration, 3),
            "tuning": ["E", "A", "D", "G", "B", "E"],
        },
        "meta": {
            "source": "auto",
            "generatedAt": _now_iso(),
            "generator": generator,
            "confidence": confidence,
            "lyricsSource": lyrics_source,
        },
        "sections": [
            {"id": "s1", "name": "A", "startSec": 0.0, "endSec": round(mid, 3)},
            {"id": "s2", "name": "B", "startSec": round(mid, 3), "endSec": round(duration, 3)},
        ],
        "events": events,
        "lyrics": lyrics,
    }


def analyze_available() -> dict[str, Any]:
    return {
        "librosa": HAS_LIBROSA,
        "engine": "librosa" if HAS_LIBROSA else "fallback",
        "lyrics": lyrics_engine(),
    }
