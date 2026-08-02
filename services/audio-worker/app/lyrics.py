"""Lyrics extraction + temporal alignment onto chord events.

Priority:
1) Optional Whisper ASR with segment timestamps (when installed)
2) Plain lyrics supplied by creator (lyricsPlain) — time-stretched across vocal span
3) Deterministic stub from title/artist so Modo Estudo always has text

Prompt / STT tips (Whisper):
- Always pass language="pt" (or detect) + an initial_prompt with song context
- Prefer word_timestamps / segment timestamps and align by time, not by chord count
- Separating vocals (Demucs) before STT raises accuracy a lot on mixed tracks
- For known lyrics, use forced alignment (WhisperX / aeneas) instead of free ASR
"""

from __future__ import annotations

import re
from typing import Any

try:
    import whisper  # type: ignore

    HAS_WHISPER = True
except Exception:  # pragma: no cover
    HAS_WHISPER = False


def lyrics_engine() -> str:
    if HAS_WHISPER:
        return "whisper"
    return "align"


def _split_lines(text: str) -> list[str]:
    return [ln.strip() for ln in re.split(r"[\r\n]+", text) if ln.strip()]


def _word_starts(text: str) -> list[int]:
    return [m.start() for m in re.finditer(r"\S+", text)]


def _place_chords(text: str, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    starts = _word_starts(text)
    if not events:
        return []
    if not starts:
        return [
            {
                "symbol": ev["chord"]["symbol"],
                "charIndex": 0,
                "eventId": ev["id"],
            }
            for ev in events
        ]
    markers = []
    for i, ev in enumerate(events):
        if len(events) == 1:
            idx = 0
        else:
            idx = round(i / (len(events) - 1) * (len(starts) - 1))
        markers.append(
            {
                "symbol": ev["chord"]["symbol"],
                "charIndex": starts[idx],
                "eventId": ev["id"],
            }
        )
    return markers


def _whisper_prompt(title: str, artist: str, lyrics_hint: str | None) -> str:
    """Bias Whisper toward Portuguese sung lyrics (not speech/chat)."""
    base = (
        f"Transcrição de letra de música em português brasileiro. "
        f"Música: {title}. Artista: {artist}. "
        "Ignore falas, introduções e interjeições. "
        "Use uma linha por verso. Sem timestamps no texto."
    )
    if lyrics_hint:
        # Give a short seed (first ~400 chars) to stabilize vocabulary
        seed = lyrics_hint.strip()[:400]
        return f"{base} Trecho conhecido: {seed}"
    return base


def _transcribe_whisper_segments(
    path: str,
    *,
    title: str,
    artist: str,
    lyrics_hint: str | None = None,
) -> list[dict[str, Any]] | None:
    """Return [{text, start, end}, ...] from Whisper segments."""
    if not HAS_WHISPER:
        return None
    try:
        model = whisper.load_model("small")
        result = model.transcribe(
            path,
            language="pt",
            task="transcribe",
            fp16=False,
            verbose=False,
            condition_on_previous_text=True,
            temperature=0.0,
            compression_ratio_threshold=2.4,
            no_speech_threshold=0.55,
            initial_prompt=_whisper_prompt(title, artist, lyrics_hint),
            word_timestamps=True,
        )
        segments = result.get("segments") or []
        out: list[dict[str, Any]] = []
        for seg in segments:
            text = str(seg.get("text") or "").strip()
            if not text:
                continue
            # Drop very short non-lexical noise
            if len(re.sub(r"\W+", "", text)) < 2:
                continue
            out.append(
                {
                    "text": text,
                    "start": float(seg.get("start") or 0.0),
                    "end": float(seg.get("end") or seg.get("start") or 0.0),
                }
            )
        return out or None
    except Exception:
        return None


def _stub_lyrics(title: str, artist: str, n_lines: int) -> list[str]:
    seed = [
        f"{title}",
        f"por {artist}",
        "Acreditei no seu amor",
        "E acabei como eu estou",
        "Sozinho, sozinho",
        "Nessa canção que eu fiz",
        "Vem ficar um pouco mais",
        "Meu amor, vem cá",
    ]
    lines: list[str] = []
    i = 0
    while len(lines) < max(1, n_lines):
        lines.append(seed[i % len(seed)])
        i += 1
    return lines


def _events_overlapping(events: list[dict[str, Any]], t0: float, t1: float) -> list[dict[str, Any]]:
    span = max(0.15, t1 - t0)
    mid = t0 + span / 2
    hits = []
    for ev in events:
        et0 = float(ev.get("t") or 0)
        et1 = float(ev.get("tEnd") or (et0 + 1.0))
        if et1 < t0 or et0 > t1:
            continue
        hits.append(ev)
    if hits:
        return hits
    # nearest event by midpoint
    if not events:
        return []
    nearest = min(events, key=lambda ev: abs(float(ev.get("t") or 0) - mid))
    return [nearest]


def _align_plain_lines_to_events(
    lines: list[str],
    events: list[dict[str, Any]],
    duration: float,
    intro_cut: float,
) -> list[dict[str, Any]]:
    """Distribute plain lyric lines evenly across the vocal time span."""
    vocal = [e for e in events if float(e.get("t", 0)) >= intro_cut] or list(events)
    if not vocal or not lines:
        return []

    t_start = float(vocal[0]["t"])
    t_end = float(vocal[-1].get("tEnd") or vocal[-1]["t"] or duration)
    if t_end <= t_start:
        t_end = min(duration, t_start + max(1.0, len(lines) * 2.0))

    lyrics_out: list[dict[str, Any]] = []
    for i, text in enumerate(lines):
        frac0 = i / len(lines)
        frac1 = (i + 1) / len(lines)
        t0 = t_start + (t_end - t_start) * frac0
        t1 = t_start + (t_end - t_start) * frac1
        group = _events_overlapping(vocal, t0, t1)
        for ev in group:
            ev["lyricLine"] = text
        lyrics_out.append(
            {
                "id": f"l{i + 1}",
                "t": round(t0, 3),
                "tEnd": round(t1, 3),
                "text": text,
                "sectionId": group[0].get("sectionId") if group else None,
                "chords": _place_chords(text, group),
            }
        )
    return lyrics_out


def _align_timed_segments(
    segments: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    lyrics_out: list[dict[str, Any]] = []
    for i, seg in enumerate(segments):
        text = str(seg["text"]).strip()
        t0 = float(seg["start"])
        t1 = max(t0 + 0.2, float(seg["end"]))
        group = _events_overlapping(events, t0, t1)
        for ev in group:
            # Prefer the segment that covers most of the event
            if ev.get("lyricLine") is None:
                ev["lyricLine"] = text
        lyrics_out.append(
            {
                "id": f"l{i + 1}",
                "t": round(t0, 3),
                "tEnd": round(t1, 3),
                "text": text,
                "sectionId": group[0].get("sectionId") if group else None,
                "chords": _place_chords(text, group),
            }
        )
    return lyrics_out


def attach_lyrics(
    *,
    path: str,
    title: str,
    artist: str,
    events: list[dict[str, Any]],
    lyrics_plain: str | None = None,
    duration: float,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    """Return (events_with_lyricLine, lyrics_array, source)."""
    for ev in events:
        ev["lyricLine"] = None

    plain = (lyrics_plain or "").strip()
    source = "stub"
    lyrics_out: list[dict[str, Any]] = []

    # 1) Creator lyrics — best quality when provided (force-align by time)
    if plain:
        source = "creator"
        lines = _split_lines(plain)
        lyrics_out = _align_plain_lines_to_events(
            lines, events, duration, intro_cut=0.0
        )
    else:
        # 2) Whisper timed segments
        segments = _transcribe_whisper_segments(
            path, title=title, artist=artist, lyrics_hint=None
        )
        if segments:
            source = "whisper"
            lyrics_out = _align_timed_segments(segments, events)
        else:
            # 3) Stub
            source = "stub"
            n = max(3, (len(events) + 1) // 2)
            lines = _stub_lyrics(title, artist, n)
            lyrics_out = _align_plain_lines_to_events(
                lines,
                events,
                duration,
                intro_cut=min(2.0, duration * 0.1),
            )

    if not lyrics_out:
        lines = _stub_lyrics(title, artist, 3)
        lyrics_out = _align_plain_lines_to_events(lines, events, duration, 0.0)
        source = "stub"

    return events, lyrics_out, source
