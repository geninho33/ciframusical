import { useEffect, useRef } from "react";
import type { CifraSyncDocument } from "../types";
import { handlePlayerKeydown } from "../playerKeyboard";
import { selectDisplayDoc, usePlayerStore } from "../playerStore";
import { ChordDiagram } from "./ChordDiagram";
import { ChordScrollViewport } from "./ChordScrollViewport";
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
  const autoScroll = usePlayerStore((s) => s.autoScroll);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const transposeSemitones = usePlayerStore((s) => s.transposeSemitones);
  const load = usePlayerStore((s) => s.load);
  const tick = usePlayerStore((s) => s.tick);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const setTranspose = usePlayerStore((s) => s.setTranspose);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const toggleLoop = usePlayerStore((s) => s.toggleLoop);
  const clearLoop = usePlayerStore((s) => s.clearLoop);
  const dispose = usePlayerStore((s) => s.dispose);
  const displayDoc = usePlayerStore(selectDisplayDoc);
  const rootRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    void load({ trackId, syncDoc, audioUrl });
    return () => {
      void dispose();
    };
  }, [trackId, syncDoc, audioUrl, load, dispose]);

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
      aria-label={`Play-along ${title}`}
    >
      <p className={styles.srOnly} id="player-shortcuts">
        Atalhos: Espaço play/pause, setas seek, Home/End, J/K, L loop, +/− tom,
        [ ] velocidade, Esc limpa loop.
      </p>
      <header className={styles.hud}>
        <div>
          <p className={styles.artist}>{artist}</p>
          <h1 className={styles.title}>{title}</h1>
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
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
        </dl>
      </header>

      <div
        className={styles.live}
        aria-live="polite"
        aria-atomic="true"
      >
        Acorde atual: {activeEvent?.chord.symbol ?? "—"}
      </div>

      <div className={styles.body}>
        <ChordScrollViewport
          doc={doc}
          activeEventId={activeEventId}
          autoScroll={autoScroll}
        />
        <aside className={styles.side}>
          <ChordDiagram symbol={activeEvent?.chord.symbol ?? "—"} />
          {!audioUrl ? (
            <p className={styles.note}>
              Fixture sem MP3 — o clock Tone.js guia a cifra (play-along).
            </p>
          ) : null}
          <p className={styles.hint} aria-describedby="player-shortcuts">
            Teclado: Espaço · ←/→ · +/− · [ ] · L
          </p>
        </aside>
      </div>

      <TransportBar />
    </div>
  );
}
