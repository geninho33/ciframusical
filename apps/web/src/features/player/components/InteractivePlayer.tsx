import { useEffect, useRef, useState } from "react";
import type { CifraSyncDocument } from "../types";
import { handlePlayerKeydown } from "../playerKeyboard";
import { selectDisplayDoc, usePlayerStore } from "../playerStore";
import { ChordDiagram } from "./ChordDiagram";
import { StudyModeViewport } from "./StudyModeViewport";
import { TransportBar } from "./TransportBar";
import styles from "./InteractivePlayer.module.css";

type Props = {
  trackId: string;
  syncDoc: CifraSyncDocument;
  audioUrl?: string | null;
  title: string;
  artist: string;
};

export function InteractivePlayer({
  trackId,
  syncDoc,
  audioUrl,
  title,
  artist,
}: Props) {
  const status = usePlayerStore((s) => s.status);
  const activeEventId = usePlayerStore((s) => s.activeEventId);
  const activeEvent = usePlayerStore((s) => s.activeEvent);
  const displayKey = usePlayerStore((s) => s.displayKey);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const transposeSemitones = usePlayerStore((s) => s.transposeSemitones);
  const displayDoc = usePlayerStore(selectDisplayDoc);
  const load = usePlayerStore((s) => s.load);
  const tick = usePlayerStore((s) => s.tick);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const setTranspose = usePlayerStore((s) => s.setTranspose);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const toggleLoop = usePlayerStore((s) => s.toggleLoop);
  const clearLoop = usePlayerStore((s) => s.clearLoop);
  const dispose = usePlayerStore((s) => s.dispose);
  const rootRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const [showLyrics, setShowLyrics] = useState(true);

  useEffect(() => {
    void load({ trackId, syncDoc, audioUrl });
    return () => {
      void dispose();
    };
    // syncDoc comes from PracticePage fetch; transpose does not replace this prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, audioUrl, syncDoc]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      tickRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const editable =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      // Shift+L → toggle letra (vinculado ao switch do header)
      if (!editable && e.code === "KeyL" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        setShowLyrics((v) => !v);
        return;
      }

      handlePlayerKeydown(e, {
        toggle,
        seekBy: (delta) => {
          const next = Math.min(duration, Math.max(0, currentTime + delta));
          seek(next);
        },
        seekToStart: () => seek(0),
        seekToEnd: () => seek(duration),
        nudgeTranspose: (delta) =>
          setTranspose(Math.min(6, Math.max(-6, transposeSemitones + delta))),
        nudgeRate: (delta) =>
          setPlaybackRate(
            Math.round(Math.min(1.5, Math.max(0.5, playbackRate + delta)) * 100) /
              100,
          ),
        toggleLoop,
        clearLoop,
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    toggle,
    seek,
    currentTime,
    duration,
    setTranspose,
    transposeSemitones,
    setPlaybackRate,
    playbackRate,
    toggleLoop,
    clearLoop,
  ]);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, [trackId]);

  const doc = displayDoc ?? syncDoc;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      tabIndex={0}
      role="application"
      aria-label={`Modo estudo ${title}`}
    >
      <p className={styles.srOnly} id="player-shortcuts">
        Modo estudo. Atalhos: Espaço play/pause, setas seek, Shift+L letra,
        L loop, +/− tom.
      </p>
      <header className={styles.hud}>
        <div className={styles.hudTop}>
          <div className={styles.hudLeft}>
            <p className={styles.mode}>Modo Estudo</p>
            <p className={styles.artist}>{artist}</p>
            <h1 className={styles.title}>{title}</h1>
          </div>

          <div className={styles.hudCenter}>
            <div className={styles.switch}>
              <span className={styles.switchLabel} id="lyrics-toggle-label">
                Letra
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showLyrics}
                aria-labelledby="lyrics-toggle-label"
                aria-keyshortcuts="Shift+L"
                title="Shift+L"
                aria-label={showLyrics ? "Ocultar letra (Shift+L)" : "Exibir letra (Shift+L)"}
                className={styles.switchTrack}
                data-on={showLyrics}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowLyrics((v) => !v);
                }}
              >
                <span className={styles.switchThumb} />
              </button>
              <kbd className={styles.kbd}>⇧L</kbd>
            </div>
          </div>

          <div className={styles.hudSpacer} aria-hidden />
        </div>

        <dl className={styles.meta}>
          <div>
            <dt>Tom</dt>
            <dd>{displayKey ?? doc.track.originalKey}</dd>
          </div>
          <div>
            <dt>BPM</dt>
            <dd>{Math.round(doc.track.bpm * playbackRate)}</dd>
          </div>
          <div>
            <dt>Acorde</dt>
            <dd>{activeEvent?.chord.symbol ?? "—"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.live} aria-live="polite" aria-atomic="true">
        Acorde atual: {activeEvent?.chord.symbol ?? "—"}
      </div>

      <div className={styles.body}>
        <StudyModeViewport
          doc={doc}
          activeEventId={activeEventId}
          currentTime={currentTime}
          showLyrics={showLyrics}
          onSeekLine={seek}
        />
        <aside className={styles.side}>
          <ChordDiagram symbol={activeEvent?.chord.symbol ?? "—"} />
          <p className={styles.hint} aria-describedby="player-shortcuts">
            Viewport fixa na linha atual · Shift+L letra
          </p>
        </aside>
      </div>

      <TransportBar />
    </div>
  );
}
