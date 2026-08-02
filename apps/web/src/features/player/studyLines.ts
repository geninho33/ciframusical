import type { CifraSyncDocument, SyncEvent } from "./types";

export type StudyChordMark = {
  symbol: string;
  charIndex: number;
  eventId: string;
};

export type StudyLine = {
  id: string;
  t: number;
  tEnd?: number;
  text: string;
  chords: StudyChordMark[];
  eventIds: string[];
};

/** Spread chord markers across word starts of a lyric line. */
export function placeChordsOnText(
  text: string,
  events: SyncEvent[],
): StudyChordMark[] {
  if (!events.length) return [];
  const words: { start: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    words.push({ start: m.index });
  }
  if (!words.length) {
    return events.map((ev, i) => ({
      symbol: ev.chord.symbol,
      charIndex: Math.min(i, Math.max(0, text.length - 1)),
      eventId: ev.id,
    }));
  }

  return events.map((ev, i) => {
    const idx =
      events.length === 1
        ? 0
        : Math.round((i / (events.length - 1)) * (words.length - 1));
    return {
      symbol: ev.chord.symbol,
      charIndex: words[idx]?.start ?? 0,
      eventId: ev.id,
    };
  });
}

/**
 * Build study-mode blocks (chord row + lyric row) from a sync document.
 * Prefers `lyrics[]` with optional chord markers; falls back to event.lyricLine.
 */
export function buildStudyLines(doc: CifraSyncDocument): StudyLine[] {
  if (doc.lyrics?.length) {
    return doc.lyrics.map((lyric) => {
      const related = doc.events.filter((ev) => {
        if (lyric.tEnd != null) {
          return ev.t >= lyric.t - 0.05 && ev.t < lyric.tEnd;
        }
        return (
          Math.abs(ev.t - lyric.t) < 0.25 ||
          (ev.lyricLine != null &&
            ev.lyricLine.trim() === lyric.text.trim())
        );
      });
      const fromMeta = lyric.chords;
      const chords: StudyChordMark[] = fromMeta?.length
        ? fromMeta.map((c) => ({
            symbol: c.symbol,
            charIndex: c.charIndex,
            eventId: c.eventId ?? "",
          }))
        : placeChordsOnText(lyric.text, related.length ? related : []);
      return {
        id: lyric.id,
        t: lyric.t,
        tEnd: lyric.tEnd,
        text: lyric.text,
        chords,
        eventIds: chords.map((c) => c.eventId).filter(Boolean),
      };
    });
  }

  const lines: StudyLine[] = [];
  const withLyrics = doc.events.filter((e) => e.lyricLine?.trim());
  if (!withLyrics.length) {
    // Instrumental: show chords as compact lines (2–4 per row)
    const chunk = 2;
    for (let i = 0; i < doc.events.length; i += chunk) {
      const group = doc.events.slice(i, i + chunk);
      const text = "·".repeat(Math.max(12, group.length * 8));
      lines.push({
        id: `inst-${group[0].id}`,
        t: group[0].t,
        tEnd: group[group.length - 1].tEnd,
        text,
        chords: placeChordsOnText(text, group),
        eventIds: group.map((g) => g.id),
      });
    }
    return lines;
  }

  let i = 0;
  while (i < withLyrics.length) {
    const text = withLyrics[i].lyricLine!.trim();
    const group: SyncEvent[] = [withLyrics[i]];
    let j = i + 1;
    // Merge consecutive events that share the same lyric line text
    while (
      j < withLyrics.length &&
      withLyrics[j].lyricLine?.trim() === text
    ) {
      group.push(withLyrics[j]);
      j++;
    }
    // Also pair next unique short line's first chord onto previous if same section? keep simple.
    lines.push({
      id: `line-${group[0].id}`,
      t: group[0].t,
      tEnd: group[group.length - 1].tEnd ?? withLyrics[j - 1]?.tEnd,
      text,
      chords: placeChordsOnText(text, group),
      eventIds: group.map((g) => g.id),
    });
    i = j;
  }
  return lines;
}

/** Render monospace chord row aligned to lyric character columns. */
export function formatChordRow(text: string, chords: StudyChordMark[]): string {
  if (!chords.length) return "";
  const width = Math.max(text.length, ...chords.map((c) => c.charIndex + c.symbol.length));
  const cells = Array.from({ length: width }, () => " ");
  const sorted = [...chords].sort((a, b) => a.charIndex - b.charIndex);
  for (const mark of sorted) {
    const start = Math.max(0, Math.min(mark.charIndex, width - 1));
    for (let k = 0; k < mark.symbol.length; k++) {
      const pos = start + k;
      if (pos < width) cells[pos] = mark.symbol[k] ?? " ";
    }
  }
  return cells.join("").trimEnd();
}
