import { useMemo } from "react";
import type { CifraSyncDocument } from "../types";
import { buildStudyLines, formatChordRow } from "../studyLines";
import styles from "./StudyModeViewport.module.css";

type Props = {
  doc: CifraSyncDocument;
  activeEventId: string | null;
  currentTime: number;
  showLyrics: boolean;
  onSeekLine?: (t: number) => void;
};

/** How many neighbor lines to keep visible above/below the active one. */
const CONTEXT = 1;

export function StudyModeViewport({
  doc,
  activeEventId,
  currentTime,
  showLyrics,
  onSeekLine,
}: Props) {
  const lines = useMemo(() => buildStudyLines(doc), [doc]);

  const activeIndex = useMemo(() => {
    if (!lines.length) return 0;
    if (activeEventId) {
      const byEvent = lines.findIndex((l) => l.eventIds.includes(activeEventId));
      if (byEvent >= 0) return byEvent;
    }
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].t <= currentTime + 0.05) idx = i;
      else break;
    }
    return idx;
  }, [lines, activeEventId, currentTime]);

  const windowLines = useMemo(() => {
    if (!lines.length) return [];
    const start = Math.max(0, activeIndex - CONTEXT);
    const end = Math.min(lines.length, activeIndex + CONTEXT + 1);
    return lines.slice(start, end).map((line, offset) => ({
      line,
      absoluteIndex: start + offset,
    }));
  }, [lines, activeIndex]);

  if (!lines.length) {
    return (
      <div className={styles.viewport}>
        <p className={styles.empty}>Sem linhas de estudo nesta faixa.</p>
      </div>
    );
  }

  return (
    <div
      className={styles.viewport}
      data-lyrics={showLyrics ? "on" : "off"}
      role="region"
      aria-label="Modo estudo — linha atual"
      aria-live="polite"
    >
      <div className={styles.stage}>
        {windowLines.map(({ line, absoluteIndex }) => {
          const active = absoluteIndex === activeIndex;
          const chordRow = formatChordRow(line.text, line.chords);
          const role =
            absoluteIndex < activeIndex
              ? "prev"
              : absoluteIndex > activeIndex
                ? "next"
                : "active";

          return (
            <div
              key={line.id}
              className={`${styles.block} ${styles[role]}`}
              data-active={active ? "true" : "false"}
              onClick={() => onSeekLine?.(line.t)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSeekLine?.(line.t);
                }
              }}
              tabIndex={0}
              role="button"
              aria-current={active ? "true" : undefined}
              aria-label={
                showLyrics
                  ? `${chordRow || "acordes"} — ${line.text}`
                  : chordRow || "acordes"
              }
            >
              <pre className={styles.chords}>{chordRow || "\u00a0"}</pre>
              {showLyrics ? (
                <pre className={styles.lyrics}>{line.text}</pre>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
